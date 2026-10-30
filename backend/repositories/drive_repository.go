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
	query := r.db.Preload("Company")

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
		query = query.Where("JSON_CONTAINS(placement_drive.batch_id, CAST((SELECT id FROM batches WHERE name = ?) AS JSON))", batchName)
	}

	err := query.Order("placement_drive.created_at DESC").Find(&drives).Error
	if err != nil {
		return nil, err
	}

	// Populate batch details
	var allBatches []models.Batch
	r.db.Find(&allBatches)
	batchMap := make(map[uint64]models.Batch)
	for _, b := range allBatches {
		batchMap[b.ID] = b
	}

	for i := range drives {
		drives[i].Batches = make([]models.Batch, 0)
		for _, bID := range drives[i].BatchIDs {
			if b, exists := batchMap[bID]; exists {
				drives[i].Batches = append(drives[i].Batches, b)
			}
		}
	}

	return drives, nil
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
		First(&drive, id).Error
	if err != nil {
		return nil, err
	}

	if len(drive.BatchIDs) > 0 {
		var batches []models.Batch
		r.db.Where("id IN ?", []uint64(drive.BatchIDs)).Find(&batches)
		drive.Batches = batches
	}

	return &drive, nil
}

// GetAllBatchIDs returns all batch IDs from batches table
func (r *DriveRepository) GetAllBatchIDs() ([]uint64, error) {
	var ids []uint64
	err := r.db.Model(&models.Batch{}).Pluck("id", &ids).Error
	return ids, err
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

// GetDriveStudentsList returns eligible and included students for a drive
func (r *DriveRepository) GetDriveStudentsList(driveID uint64) ([]models.StudentEligibilityView, error) {
	drive, err := r.GetDriveByID(fmt.Sprintf("%d", driveID))
	if err != nil {
		return nil, err
	}

	// 1. Fetch all students belonging to the drive's target batches (or all students if no batch specified)
	type studentRow struct {
		UserID             uint64   `gorm:"column:user_id"`
		RollNo             *string  `gorm:"column:roll_no"`
		Name               string   `gorm:"column:name"`
		Email              string   `gorm:"column:email"`
		DepartmentName     string   `gorm:"column:dept_name"`
		BatchName          string   `gorm:"column:batch_name"`
		BatchID            uint64   `gorm:"column:batch_id"`
		CGPA               *float64 `gorm:"column:cgpa"`
		TenthMark          *float64 `gorm:"column:tenth_mark"`
		TwelfthMark        *float64 `gorm:"column:twelth_mark"`
		CurrentArrearCount int      `gorm:"column:current_arrear_count"`
		HistoryArrearCount int      `gorm:"column:history_arrear_count"`
	}

	query := r.db.Table("master_users u").
		Select("u.id as user_id, u.roll_no, u.name, u.email, d.name as dept_name, b.name as batch_name, u.batch_id, s.cgpa, s.tenth_mark, s.twelth_mark, COALESCE(s.current_arrear_count, 0) as current_arrear_count, COALESCE(s.history_arrear_count, 0) as history_arrear_count").
		Joins("LEFT JOIN placement_student_basic_details s ON u.id = s.user_id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Joins("LEFT JOIN batches b ON u.batch_id = b.id").
		Where("u.role_id = 1")

	var rows []studentRow
	if err := query.Order("u.name asc").Scan(&rows).Error; err != nil {
		return nil, err
	}

	// 2. Fetch students currently attached to this drive with drive_status
	type driveStudentRow struct {
		UserID      uint64 `gorm:"column:user_id"`
		DriveStatus string `gorm:"column:drive_status"`
	}
	var driveStudentRows []driveStudentRow
	r.db.Table("placement_drive_students").
		Select("user_id, drive_status").
		Where("drive_id = ?", driveID).
		Scan(&driveStudentRows)

	driveStatusMap := make(map[uint64]string)
	for _, ds := range driveStudentRows {
		driveStatusMap[ds.UserID] = ds.DriveStatus
	}

	// 3. Fetch max existing offers per student from placement_drive_offers
	type offerRow struct {
		UserID     uint64  `gorm:"column:user_id"`
		MaxPackage float64 `gorm:"column:max_package"`
	}
	var offers []offerRow
	r.db.Table("placement_drive_offers o").
		Select("pds.user_id, MAX(o.package_lpa) as max_package").
		Joins("JOIN placement_drive_students pds ON o.drive_student_id = pds.id").
		Group("pds.user_id").
		Scan(&offers)

	offersMap := make(map[uint64]float64)
	for _, o := range offers {
		offersMap[o.UserID] = o.MaxPackage
	}

	// 4. Evaluate eligibility criteria
	elig := drive.Eligibility
	var result []models.StudentEligibilityView

	for _, s := range rows {
		isEligible := true
		var reasons []string

		var maxOffer *float64
		if pkg, ok := offersMap[s.UserID]; ok {
			maxOffer = &pkg
		}

		if elig != nil {
			if elig.MinCGPA != nil && (s.CGPA == nil || *s.CGPA < *elig.MinCGPA) {
				isEligible = false
				reasons = append(reasons, fmt.Sprintf("CGPA below %.2f", *elig.MinCGPA))
			}
			if elig.MinTenthMark != nil && (s.TenthMark == nil || *s.TenthMark < *elig.MinTenthMark) {
				isEligible = false
				reasons = append(reasons, fmt.Sprintf("10th mark below %.1f%%", *elig.MinTenthMark))
			}
			if elig.MinTwelfthMark != nil && (s.TwelfthMark == nil || *s.TwelfthMark < *elig.MinTwelfthMark) {
				isEligible = false
				reasons = append(reasons, fmt.Sprintf("12th mark below %.1f%%", *elig.MinTwelfthMark))
			}
			if elig.MaxCurrentArrears != nil && s.CurrentArrearCount > *elig.MaxCurrentArrears {
				isEligible = false
				reasons = append(reasons, fmt.Sprintf("Current arrears exceed %d", *elig.MaxCurrentArrears))
			}
			if elig.MaxHistoryArrears != nil && s.HistoryArrearCount > *elig.MaxHistoryArrears {
				isEligible = false
				reasons = append(reasons, fmt.Sprintf("History arrears exceed %d", *elig.MaxHistoryArrears))
			}
			if elig.MaxExistingOfferLPA != nil && maxOffer != nil && *maxOffer > *elig.MaxExistingOfferLPA {
				isEligible = false
				reasons = append(reasons, fmt.Sprintf("Existing offer (%.2f LPA) exceeds cap of %.2f LPA", *maxOffer, *elig.MaxExistingOfferLPA))
			}
		}

		status, hasStatus := driveStatusMap[s.UserID]
		isIncluded := hasStatus && (status == "included" || status == "special_entry")

		result = append(result, models.StudentEligibilityView{
			UserID:             s.UserID,
			RollNo:             s.RollNo,
			Name:               s.Name,
			Email:              s.Email,
			DepartmentName:     s.DepartmentName,
			BatchName:          s.BatchName,
			CGPA:               s.CGPA,
			TenthMark:          s.TenthMark,
			TwelfthMark:        s.TwelfthMark,
			CurrentArrearCount: s.CurrentArrearCount,
			HistoryArrearCount: s.HistoryArrearCount,
			MaxExistingOffer:   maxOffer,
			IsEligible:         isEligible,
			IneligibleReasons:  reasons,
			IsIncludedInDrive:  isIncluded,
			DriveStatus:        status,
		})
	}

	return result, nil
}

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

// StudentRosterUpdateItem payload for batch update
type StudentRosterUpdateItem struct {
	UserID      uint64 `json:"user_id"`
	DriveStatus string `json:"drive_status"` // 'included', 'special_entry', 'excluded'
}

// UpdateDriveStudentsRoster manages student membership and statuses in a drive
func (r *DriveRepository) UpdateDriveStudentsRoster(driveID uint64, updates []StudentRosterUpdateItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range updates {
			if item.DriveStatus == "excluded" {
				// Remove from drive or update status to excluded
				if err := tx.Where("drive_id = ? AND user_id = ?", driveID, item.UserID).
					Delete(&models.PlacementDriveStudent{}).Error; err != nil {
					return err
				}
			} else {
				// Upsert placement_drive_students record with drive_status
				var existing models.PlacementDriveStudent
				err := tx.Where("drive_id = ? AND user_id = ?", driveID, item.UserID).First(&existing).Error
				if err != nil {
					// Create new entry
					newRecord := models.PlacementDriveStudent{
						DriveID:     driveID,
						UserID:      item.UserID,
						DriveStatus: item.DriveStatus,
						IncludedAt:  time.Now(),
						Notes:       "",
					}
					if err := tx.Create(&newRecord).Error; err != nil {
						return err
					}
				} else {
					// Update existing status
					if err := tx.Model(&existing).Update("drive_status", item.DriveStatus).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
}
