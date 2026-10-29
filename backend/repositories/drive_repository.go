package repositories

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"placement-management/models"
)

type DriveRepository struct {
	db *gorm.DB
}

func NewDriveRepository(db *gorm.DB) *DriveRepository {
	return &DriveRepository{db: db}
}

// FetchDrives retrieves drives with company preload and filtering
func (r *DriveRepository) FetchDrives(statusFilter, searchQuery, batchName string) ([]models.PlacementDrive, error) {
	var drives []models.PlacementDrive
	query := r.db.Preload("Company").Preload("Batch")

	if statusFilter == "active" {
		query = query.Where("overall_status NOT IN ('completed', 'cancelled')")
	} else if statusFilter == "completed" {
		query = query.Where("overall_status = 'completed'")
	} else if statusFilter != "" && !strings.EqualFold(statusFilter, "all") {
		query = query.Where("overall_status = ?", statusFilter)
	}

	if searchQuery != "" {
		pattern := "%" + searchQuery + "%"
		query = query.Joins("LEFT JOIN placement_company ON placement_company.id = placement_drive.company_id").
			Where("placement_drive.job_role LIKE ? OR placement_company.company_name LIKE ?", pattern, pattern)
	}

	if batchName != "" && !strings.EqualFold(batchName, "all") {
		query = query.Joins("LEFT JOIN batches ON batches.id = placement_drive.batch_id").
			Where("batches.name = ? OR placement_drive.batch_id IS NULL", batchName)
	}

	err := query.Order("placement_drive.created_at DESC").Find(&drives).Error
	return drives, err
}

// CountDriveStudents counts students attached to a drive
func (r *DriveRepository) CountDriveStudents(driveID uint64) (int64, error) {
	var count int64
	err := r.db.Model(&models.PlacementDriveStudent{}).Where("drive_id = ?", driveID).Count(&count).Error
	return count, err
}

// GetDriveByID retrieves a single drive with stages, substages, eligibility, and owner
func (r *DriveRepository) GetDriveByID(id string) (*models.PlacementDrive, error) {
	var drive models.PlacementDrive
	err := r.db.Preload("Company").
		Preload("DriveOwnerUser").
		Preload("Eligibility").
		Preload("Stages.Substages").
		Preload("Batch").
		First(&drive, id).Error
	return &drive, err
}

// ComputeDriveStats computes KPI metrics for a drive
func (r *DriveRepository) ComputeDriveStats(driveID uint64) models.PlacementDriveStats {
	var stats models.PlacementDriveStats

	r.db.Model(&models.PlacementDriveStudent{}).Where("drive_id = ?", driveID).Count(&stats.IncludedInDrive)

	var initiallyEligible int64
	r.db.Model(&models.PlacementStudentBasicDetails{}).Count(&initiallyEligible)
	stats.InitiallyEligible = initiallyEligible

	var lastStage models.PlacementDriveStage
	err := r.db.Where("drive_id = ?", driveID).Order("sequence_no desc").First(&lastStage).Error
	if err == nil {
		r.db.Model(&models.PlacementStageResult{}).
			Where("stage_id = ? AND outcome = 'cleared'", lastStage.ID).
			Count(&stats.ReachedFinalStage)
	}

	r.db.Table("placement_stage_results").
		Joins("JOIN placement_drive_students ON placement_drive_students.id = placement_stage_results.drive_student_id").
		Where("placement_drive_students.drive_id = ? AND placement_stage_results.outcome = 'pending'", driveID).
		Count(&stats.AwaitingFinalResult)

	r.db.Table("placement_stage_results").
		Joins("JOIN placement_drive_students ON placement_drive_students.id = placement_stage_results.drive_student_id").
		Where("placement_drive_students.drive_id = ? AND placement_stage_results.outcome IN ('not_cleared', 'absent', 'withdrawn')", driveID).
		Count(&stats.NotClearedAbsent)

	return stats
}

// SaveDrive creates or updates a drive model
func (r *DriveRepository) SaveDrive(drive *models.PlacementDrive) error {
	return r.db.Save(drive).Error
}

// SaveDriveFields updates selective fields including nullable columns
func (r *DriveRepository) SaveDriveFields(drive *models.PlacementDrive, fields ...string) error {
	return r.db.Select(fields).Save(drive).Error
}

// UpdateStatus updates the overall_status of a drive
func (r *DriveRepository) UpdateStatus(id string, status string) error {
	return r.db.Model(&models.PlacementDrive{}).Where("id = ?", id).Update("overall_status", status).Error
}

// CreateActivityLog appends a new drive activity log entry
func (r *DriveRepository) CreateActivityLog(log *models.PlacementDriveActivityLog) error {
	return r.db.Create(log).Error
}

// GetActivities fetches activity logs for a drive
func (r *DriveRepository) GetActivities(driveID string) ([]models.PlacementDriveActivityLog, error) {
	var logs []models.PlacementDriveActivityLog
	err := r.db.Preload("User").Where("drive_id = ?", driveID).Order("created_at desc").Find(&logs).Error
	return logs, err
}

// GetEligibility gets or creates eligibility criteria for a drive
func (r *DriveRepository) GetEligibility(driveID uint64) (*models.PlacementDriveEligibility, error) {
	var eligibility models.PlacementDriveEligibility
	err := r.db.Where("drive_id = ?", driveID).First(&eligibility).Error
	return &eligibility, err
}

// SaveEligibility creates or saves eligibility criteria
func (r *DriveRepository) SaveEligibility(eligibility *models.PlacementDriveEligibility, isNew bool) error {
	if isNew {
		return r.db.Create(eligibility).Error
	}
	return r.db.Save(eligibility).Error
}

// FindOrCreateCompany returns existing or created company
func (r *DriveRepository) FindOrCreateCompany(name string) (*models.PlacementCompany, error) {
	var company models.PlacementCompany
	err := r.db.Where("company_name = ?", name).First(&company).Error
	if err == nil {
		return &company, nil
	}

	companyCode := strings.ToUpper(strings.ReplaceAll(name, " ", ""))
	if len(companyCode) > 10 {
		companyCode = companyCode[:10]
	}

	company = models.PlacementCompany{
		CompanyCode:       companyCode,
		CompanyName:       name,
		CollaborationType: "NEW",
		ContactStatus:     "CONTACTED",
		Category:          "PRODUCT",
		RecruitingQuarter: "Q3",
		EmployeeSize:      "101-200",
		FoundedYear:       time.Now().Year(),
		Spoc1Name:         "HR Contact",
		Spoc1Email:        fmt.Sprintf("hr@%s.example", strings.ToLower(companyCode)),
		Spoc1Contact:      "9876543210",
		Status:            "1",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := r.db.Create(&company).Error; err != nil {
		return nil, err
	}
	return &company, nil
}
