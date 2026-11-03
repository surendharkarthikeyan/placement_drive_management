package repositories

import (
	"errors"
	"fmt"
	"math"
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

func (r *DriveRepository) GetDB() *gorm.DB {
	return r.db
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

	// Compute counts for stages and substages in drive
	for i := range drive.Stages {
		var pCount int64
		var cCount int64
		r.db.Model(&models.PlacementStageResult{}).
			Where("stage_id = ?", drive.Stages[i].ID).
			Count(&pCount)
		r.db.Model(&models.PlacementStageResult{}).
			Where("stage_id = ? AND outcome = 'cleared'", drive.Stages[i].ID).
			Count(&cCount)
		drive.Stages[i].ParticipantsCount = pCount
		drive.Stages[i].ClearedCount = cCount

		for j := range drive.Stages[i].Substages {
			subID := drive.Stages[i].Substages[j].ID
			var subPCount int64
			var subCCount int64
			r.db.Model(&models.PlacementStageResult{}).
				Where("stage_id = ? AND substage_id = ?", drive.Stages[i].ID, subID).
				Count(&subPCount)
			r.db.Model(&models.PlacementStageResult{}).
				Where("stage_id = ? AND substage_id = ? AND outcome = 'cleared'", drive.Stages[i].ID, subID).
				Count(&subCCount)
			drive.Stages[i].Substages[j].ParticipantsCount = subPCount
			drive.Stages[i].Substages[j].ClearedCount = subCCount
		}
	}

	drive.RosterConfirmed = r.IsRosterConfirmed(drive.ID)

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

	// InitiallyEligible should be scoped to the drive's target academic batches from placement_drive.batch_id
	var drive models.PlacementDrive
	if err := r.db.First(&drive, driveID).Error; err == nil && len(drive.BatchIDs) > 0 {
		var initiallyEligible int64
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id IN ?", []uint64(drive.BatchIDs)).
			Count(&initiallyEligible)
		stats.InitiallyEligible = initiallyEligible
	} else {
		var initiallyEligible int64
		r.db.Model(&models.PlacementStudentBasicDetails{}).Count(&initiallyEligible)
		stats.InitiallyEligible = initiallyEligible
	}

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

	// Offered students count: students who cleared the final stage of the drive
	if err == nil {
		stats.OfferedStudents = stats.ReachedFinalStage
	}

	return stats
}

// ComputeDataCompletion computes the dynamic 6-checkpoint data completion percentage for a placement drive
func (r *DriveRepository) ComputeDataCompletion(driveID uint64) models.DataCompletionStats {
	var drive models.PlacementDrive
	if err := r.db.Preload("Company").
		Preload("Eligibility").
		Preload("Stages").
		First(&drive, driveID).Error; err != nil {
		return models.DataCompletionStats{
			OverallPercentage: 0,
			TotalEarned:       0,
			Checkpoints:       []models.CheckpointDetail{},
		}
	}

	checkpoints := make([]models.CheckpointDetail, 6)

	// Checkpoint 1: Company & Job Details Completed (15%)
	// Mandatory 6 fields: Company Name, Job Role, Placement Type, Package, Drive Owner, Target Academic Batch
	validFields := 0
	if drive.Company != nil && strings.TrimSpace(drive.Company.CompanyName) != "" {
		validFields++
	}
	if strings.TrimSpace(drive.JobRole) != "" {
		validFields++
	}
	if strings.TrimSpace(drive.PlacementType) != "" {
		validFields++
	}
	if drive.PackageLPA > 0 {
		validFields++
	}
	if drive.DriveOwnerUserID != nil && *drive.DriveOwnerUserID > 0 {
		validFields++
	}
	if len(drive.BatchIDs) > 0 {
		validFields++
	}

	cp1Earned := (float64(validFields) / 6.0) * 15.0
	checkpoints[0] = models.CheckpointDetail{
		Index:       1,
		Title:       "Company & Job Details Completed",
		Weightage:   15.0,
		Earned:      cp1Earned,
		IsCompleted: validFields == 6,
		Detail:      fmt.Sprintf("%d of 6 fields completed", validFields),
	}

	// Checkpoint 2: Student Eligibility & Drive Roster Confirmed (10%)
	// Considered completed when:
	// 1) Eligibility criteria are configured (or explicitly set to "No Criteria / Open to All"), OR
	// 2) Student roster is confirmed/saved (records exist in placement_drive_students)
	_ = drive.Eligibility //
	// isNoCriteria := false
	if false {
		elig := drive.Eligibility
		if elig.MinCGPA == nil &&
			elig.MinTenthMark == nil &&
			elig.MinTwelfthMark == nil &&
			elig.MaxCurrentArrears == nil &&
			elig.MaxHistoryArrears == nil &&
			elig.MaxExistingOfferLPA == nil {
			// isNoCriteria = true
		}
	}
	var rosterCount int64
	r.db.Model(&models.PlacementDriveStudent{}).Where("drive_id = ?", driveID).Count(&rosterCount)
	isRosterConfirmed := r.IsRosterConfirmed(driveID)

	cp2Earned := 0.0
	// Award full 10% if "No Criteria (Open to All)" was configured, OR if both criteria and roster are confirmed
	cp2Completed := isRosterConfirmed
	if cp2Completed {
		cp2Earned = 10.0
	}
	checkpoints[1] = models.CheckpointDetail{
		Index:       2,
		Title:       "Student Eligibility & Drive Roster Confirmed",
		Weightage:   10.0,
		Earned:      cp2Earned,
		IsCompleted: cp2Completed,
		Detail:      fmt.Sprintf("%d students on roster", rosterCount),
	}

	// Checkpoint 3: Recruitment Stages & Outcomes Updated (25%)
	// Once at least one recruitment stage is successfully created and saved, award complete 25%.
	totalStages := len(drive.Stages)
	cp3Earned := 0.0
	cp3Completed := totalStages > 0
	if cp3Completed {
		cp3Earned = 25.0
	}
	checkpoints[2] = models.CheckpointDetail{
		Index:       3,
		Title:       "Recruitment Stages & Outcomes Updated",
		Weightage:   25.0,
		Earned:      cp3Earned,
		IsCompleted: cp3Completed,
		Detail:      fmt.Sprintf("%d stages configured", totalStages),
	}

	// Checkpoint 4: All Recruitment Stages Completed (25%)
	// Based on completed stages: (completedStages / totalStages) * 25
	// When all stages completed and Recruitment Process Completion button clicked (overall_status in awaiting_final_result, completed, or logged), award full 25% and mark completed.
	completedStages := 0
	for _, st := range drive.Stages {
		if st.StageStatus == "completed" {
			completedStages++
		}
	}

	var recLogCount int64
	r.db.Model(&models.PlacementDriveActivityLog{}).
		Where("drive_id = ? AND (activity_type = 'RECRUITMENT_COMPLETED' OR activity_description LIKE ?)", driveID, "%recruitment%completed%").
		Count(&recLogCount)

	isRecruitmentProcessConfirmed := recLogCount > 0 ||
		drive.OverallStatus == "awaiting_final_result" ||
		drive.OverallStatus == "completed"

	cp4Earned := 0.0
	cp4Completed := false
	if totalStages > 0 {
		cp4Earned = (float64(completedStages) / float64(totalStages)) * 25.0
		if isRecruitmentProcessConfirmed || (completedStages == totalStages && totalStages > 0) {
			cp4Earned = 25.0
			cp4Completed = true
		}
	}
	checkpoints[3] = models.CheckpointDetail{
		Index:       4,
		Title:       "All Recruitment Stages Completed",
		Weightage:   25.0,
		Earned:      cp4Earned,
		IsCompleted: cp4Completed,
		Detail:      fmt.Sprintf("%d of %d stages completed", completedStages, totalStages),
	}

	// Checkpoint 5: Final Selection Results Received (10%)
	// Student items listed in final selection tab, or explicitly recorded zero-selection result.
	finalData, _ := r.GetFinalSelectionData(driveID)
	totalFinalCandidates := 0
	if finalData != nil {
		totalFinalCandidates = len(finalData.Students)
	}

	var finalConfirmedLog int64
	r.db.Model(&models.PlacementDriveActivityLog{}).
		Where("drive_id = ? AND (activity_description LIKE ? OR activity_description LIKE ?)",
			driveID, "%final selection%", "%Final selection%").
		Count(&finalConfirmedLog)

	cp5Completed := isRecruitmentProcessConfirmed //

		// completed
		// awaiting

	cp5Earned := 0.0
	if cp5Completed {
		cp5Earned = 10.0
	}
	checkpoints[4] = models.CheckpointDetail{
		Index:       5,
		Title:       "Final Selection Results Received",
		Weightage:   10.0,
		Earned:      cp5Earned,
		IsCompleted: cp5Completed,
		Detail:      fmt.Sprintf("%d final candidates listed", totalFinalCandidates),
	}

	// Checkpoint 6: Selected Students & Offer Details Updated (15%)
	// For each selected student, 3 details must be available: Final Job Role, Offered Package, Offer Letter uploaded.
	cp6Earned := 0.0
	cp6Completed := false
	if totalFinalCandidates > 0 && finalData != nil {
		completeOfferCount := 0
		for _, st := range finalData.Students {
			hasRole := strings.TrimSpace(st.FinalRole) != ""
			hasPkg := st.PackageLPA != nil && *st.PackageLPA > 0
			hasOfferLetter := st.OfferLetterFile != nil && strings.TrimSpace(*st.OfferLetterFile) != ""
			if hasRole && hasPkg && hasOfferLetter {
				completeOfferCount++
			}
		}
		cp6Earned = (float64(completeOfferCount) / float64(totalFinalCandidates)) * 15.0
		if completeOfferCount == totalFinalCandidates && completeOfferCount > 0 {
			cp6Completed = true
			cp6Earned = 15.0
		}
		checkpoints[5] = models.CheckpointDetail{
			Index:       6,
			Title:       "Selected Students & Offer Details Updated",
			Weightage:   15.0,
			Earned:      cp6Earned,
			IsCompleted: cp6Completed,
			Detail:      fmt.Sprintf("%d of %d offers completed", completeOfferCount, totalFinalCandidates),
		}
	} else {
		checkpoints[5] = models.CheckpointDetail{
			Index:       6,
			Title:       "Selected Students & Offer Details Updated",
			Weightage:   15.0,
			Earned:      0.0,
			IsCompleted: false,
			Detail:      "No selected students",
		}
	}

	totalSum := 0.0
	for _, cp := range checkpoints {
		totalSum += cp.Earned
	}
	if totalSum > 100.0 {
		totalSum = 100.0
	}
	roundedOverall := int(math.Round(totalSum))

	return models.DataCompletionStats{
		OverallPercentage: roundedOverall,
		TotalEarned:       totalSum,
		Checkpoints:       checkpoints,
	}
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

// LogActivityWithSuppression logs an activity event if a matching event hasn't occurred within 30 minutes
func (r *DriveRepository) LogActivityWithSuppression(tx *gorm.DB, log *models.PlacementDriveActivityLog) error {
	db := r.db
	if tx != nil {
		db = tx
	}

	windowStart := time.Now().Add(-30 * time.Minute)

	// Check for duplicate event: drive_id + user_id + activity_type + entity_type + entity_id within 30 minutes
	query := db.Model(&models.PlacementDriveActivityLog{}).
		Where("drive_id = ? AND activity_type = ? AND entity_type = ? AND entity_id = ? AND created_at >= ?",
			log.DriveID, log.ActivityType, log.EntityType, log.EntityID, windowStart)

	if log.UserID != nil {
		query = query.Where("user_id = ?", *log.UserID)
	} else {
		query = query.Where("user_id IS NULL")
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		// Duplicate event within 30 minutes: suppress log insertion
		return nil
	}

	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	return db.Create(log).Error
}

// CreateActivityLog appends a new drive activity log entry
func (r *DriveRepository) CreateActivityLog(log *models.PlacementDriveActivityLog) error {
	return r.LogActivityWithSuppression(nil, log)
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

	// Fetch all students across college to allow special entries from any batch / department
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

	// Set of target batch IDs for the drive
	targetBatchMap := make(map[uint64]bool)
	for _, bid := range drive.BatchIDs {
		targetBatchMap[bid] = true
	}

	for _, s := range rows {
		isEligible := true
		var reasons []string

		// Check if student belongs to one of the drive's target academic batches (if configured)
		inTargetBatch := true
		if len(drive.BatchIDs) > 0 {
			if !targetBatchMap[s.BatchID] {
				inTargetBatch = false
				isEligible = false
				reasons = append(reasons, "Outside drive target academic batch")
			}
		}

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
		// If the drive record hasn't explicitly set a status for this student yet:
		// Automatically include them if they meet eligibility criteria AND belong to the drive target batch!
		if !hasStatus {
			if isEligible && inTargetBatch {
				status = "included"
			} else {
				status = "" // Not in roster!
			}
		}

		isIncluded := (status == "included" || status == "special_entry")

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
			HasRosterRecord:    hasStatus,
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

// PopulateEligibleStudentsForDrive evaluates eligibility against candidate pool and creates/syncs rows in placement_drive_students
func (r *DriveRepository) PopulateEligibleStudentsForDrive(driveID uint64) (int, error) {
	candidates, err := r.GetDriveStudentsList(driveID)
	if err != nil {
		return 0, err
	}

	createdCount := 0
	err = r.db.Transaction(func(tx *gorm.DB) error {
		for _, c := range candidates {
			// Check if a record already exists in placement_drive_students
			var existing models.PlacementDriveStudent
			err := tx.Where("drive_id = ? AND user_id = ?", driveID, c.UserID).First(&existing).Error
			if err != nil {
				// No row exists yet. If student is eligible, automatically create the 'included' row!
				if c.IsEligible {
					newRecord := models.PlacementDriveStudent{
						DriveID:     driveID,
						UserID:      c.UserID,
						DriveStatus: "included",
						IncludedAt:  time.Now(),
						Notes:       "Automatically included based on eligibility criteria",
					}
					if err := tx.Create(&newRecord).Error; err != nil {
						return err
					}
					createdCount++
				}
			} else {
				// Record exists: If it was standard 'included' but no longer meets criteria and not special_entry, we can update or keep
				// But if user explicitly set excluded or special_entry, preserve user's decision!
				if existing.DriveStatus != "special_entry" && existing.DriveStatus != "excluded" {
					if c.IsEligible && existing.DriveStatus != "included" {
						_ = tx.Model(&existing).Update("drive_status", "included").Error
					}
				}
			}
		}
		return nil
	})

	return createdCount, err
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
		includedCount := 0
		excludedCount := 0
		specialEntryCount := 0

		for _, item := range updates {
			if item.DriveStatus == "excluded" {
				var existing models.PlacementDriveStudent
				err := tx.Where("drive_id = ? AND user_id = ?", driveID, item.UserID).First(&existing).Error
				if err == nil {
					if existing.DriveStatus != "excluded" {
						excludedCount++
					}
					if err := tx.Model(&existing).Update("drive_status", "excluded").Error; err != nil {
						return err
					}
				} else {
					// Create row with status 'excluded' if it didn't exist yet
					newRecord := models.PlacementDriveStudent{
						DriveID:     driveID,
						UserID:      item.UserID,
						DriveStatus: "excluded",
						IncludedAt:  time.Now(),
						Notes:       "Excluded by placement officer",
					}
					if err := tx.Create(&newRecord).Error; err != nil {
						return err
					}
					excludedCount++
				}
			} else if item.DriveStatus == "included" || item.DriveStatus == "special_entry" {
				var existing models.PlacementDriveStudent
				err := tx.Where("drive_id = ? AND user_id = ?", driveID, item.UserID).First(&existing).Error
				if err != nil {
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
					if item.DriveStatus == "special_entry" {
						specialEntryCount++
					} else {
						includedCount++
					}
				} else {
					if existing.DriveStatus != item.DriveStatus {
						if item.DriveStatus == "special_entry" {
							specialEntryCount++
						} else {
							includedCount++
						}
					}
					if err := tx.Model(&existing).Update("drive_status", item.DriveStatus).Error; err != nil {
						return err
					}
				}
			}
		}

		var d models.PlacementDrive
		_ = tx.First(&d, driveID).Error

		if specialEntryCount > 0 {
			actLog := models.PlacementDriveActivityLog{
				DriveID:             driveID,
				UserID:              d.DriveOwnerUserID,
				ActivityType:        "SPECIAL_ENTRY_ADDED",
				EntityType:          "ROSTER",
				EntityID:            fmt.Sprintf("%d", driveID),
				ActivityDescription: fmt.Sprintf("%d students added through special entry", specialEntryCount),
				CreatedAt:           time.Now(),
			}
			_ = r.LogActivityWithSuppression(tx, &actLog)
		} else if includedCount > 0 {
			actLog := models.PlacementDriveActivityLog{
				DriveID:             driveID,
				UserID:              d.DriveOwnerUserID,
				ActivityType:        "STUDENTS_INCLUDED",
				EntityType:          "ROSTER",
				EntityID:            fmt.Sprintf("%d", driveID),
				ActivityDescription: fmt.Sprintf("%d students included in the drive", includedCount),
				CreatedAt:           time.Now(),
			}
			_ = r.LogActivityWithSuppression(tx, &actLog)
		} else if excludedCount > 0 {
			actLog := models.PlacementDriveActivityLog{
				DriveID:             driveID,
				UserID:              d.DriveOwnerUserID,
				ActivityType:        "STUDENTS_EXCLUDED",
				EntityType:          "ROSTER",
				EntityID:            fmt.Sprintf("%d", driveID),
				ActivityDescription: fmt.Sprintf("%d students excluded from the drive", excludedCount),
				CreatedAt:           time.Now(),
			}
			_ = r.LogActivityWithSuppression(tx, &actLog)
		} else if len(updates) > 0 {
			actLog := models.PlacementDriveActivityLog{
				DriveID:             driveID,
				UserID:              d.DriveOwnerUserID,
				ActivityType:        "ROSTER_UPDATED",
				EntityType:          "ROSTER",
				EntityID:            fmt.Sprintf("%d", driveID),
				ActivityDescription: "Student roster updated",
				CreatedAt:           time.Now(),
			}
			_ = r.LogActivityWithSuppression(tx, &actLog)
		}

		return nil
	})
}

// ConfirmRosterResult is the response payload for student list confirmation
type ConfirmRosterResult struct {
	Success    bool   `json:"success"`
	MovedCount int    `json:"moved_count"`
	StageID    uint64 `json:"stage_id"`
	StageName  string `json:"stage_name"`
	Message    string `json:"message"`
}

// IsRosterConfirmed checks if the student roster for a drive has been confirmed to Stage 1
func (r *DriveRepository) IsRosterConfirmed(driveID uint64) bool {
	var actCount int64
	r.db.Model(&models.PlacementDriveActivityLog{}).
		Where("drive_id = ? AND activity_type = 'ROSTER_CONFIRMED'", driveID).
		Count(&actCount)
	if actCount > 0 {
		return true
	}

	var stage1 models.PlacementDriveStage
	if err := r.db.Where("drive_id = ?", driveID).Order("sequence_no asc").First(&stage1).Error; err == nil {
		var resCount int64
		r.db.Model(&models.PlacementStageResult{}).
			Where("stage_id = ?", stage1.ID).
			Count(&resCount)
		return resCount > 0
	}

	return false
}

// ConfirmDriveStudentRoster moves students with status included and special_entry into Stage 1
func (r *DriveRepository) ConfirmDriveStudentRoster(driveID uint64, officerUserID *uint64) (*ConfirmRosterResult, error) {
	var result ConfirmRosterResult
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var drive models.PlacementDrive
		if err := tx.Where("id = ?", driveID).First(&drive).Error; err != nil {
			return errors.New("placement drive not found")
		}

		if drive.OverallStatus == "completed" || drive.OverallStatus == "awaiting_final_result" {
			return errors.New("cannot confirm student roster: recruitment process is already completed and locked")
		}

		// 1. Ensure placement_drive_students records exist
		var driveStudents []models.PlacementDriveStudent
		tx.Where("drive_id = ? AND drive_status IN ('included', 'special_entry')", driveID).Find(&driveStudents)

		if len(driveStudents) == 0 {
			// Populate from eligibility
			_, _ = r.PopulateEligibleStudentsForDrive(driveID)
			tx.Where("drive_id = ? AND drive_status IN ('included', 'special_entry')", driveID).Find(&driveStudents)
		}

		if len(driveStudents) == 0 {
			return errors.New("no students with status 'included' or 'special entry' found to confirm")
		}

		// 2. Find or create Stage 1
		var stage1 models.PlacementDriveStage
		err := tx.Where("drive_id = ?", driveID).Order("sequence_no asc").First(&stage1).Error
		if err != nil {
			// Auto create Stage 1 if none exists
			stage1 = models.PlacementDriveStage{
				DriveID:       driveID,
				StageName:     "Stage 1",
				SequenceNo:    1,
				StageStatus:   "pending",
				InternalNotes: "Auto-created on student roster confirmation",
			}
			if err := tx.Create(&stage1).Error; err != nil {
				return err
			}
		}

		// 3. Check if Stage 1 has substages
		var substages []models.PlacementDriveSubstage
		tx.Where("stage_id = ?", stage1.ID).Order("sequence_no asc").Find(&substages)
		var firstSubstageID *uint64
		if len(substages) > 0 {
			firstSubstageID = &substages[0].ID
		}

		// drive verified

		now := time.Now()
		movedCount := 0

		for _, ds := range driveStudents {
			var existingRes models.PlacementStageResult
			query := tx.Where("drive_student_id = ? AND stage_id = ?", ds.ID, stage1.ID)
			if firstSubstageID != nil {
				query = query.Where("substage_id = ?", *firstSubstageID)
			} else {
				query = query.Where("substage_id IS NULL")
			}

			if err := query.First(&existingRes).Error; err != nil {
				prevStatus := "cleared"
				if ds.DriveStatus == "special_entry" {
					prevStatus = "spl_entry"
				}
				newRes := models.PlacementStageResult{
					DriveStudentID:      ds.ID,
					StageID:             stage1.ID,
					SubstageID:          firstSubstageID,
					PreviousStageStatus: prevStatus,
					Outcome:             "pending",
					Remarks:             "",
					UpdatedBy:           officerUserID,
					CreatedAt:           now,
					UpdatedAt:           now,
				}
				if err := tx.Create(&newRes).Error; err != nil {
					return err
				}
				movedCount++
			}
		}

		// 4. Clean up any excluded students who might have results in stage1
		var excludedIDs []uint64
		tx.Model(&models.PlacementDriveStudent{}).Where("drive_id = ? AND drive_status = 'excluded'", driveID).Pluck("id", &excludedIDs)
		if len(excludedIDs) > 0 {
			tx.Where("stage_id = ? AND drive_student_id IN ?", stage1.ID, excludedIDs).Delete(&models.PlacementStageResult{})
		}

		// 5. Log activity
		actLog := models.PlacementDriveActivityLog{
			DriveID:             driveID,
			UserID:              officerUserID,
			ActivityType:        "ROSTER_CONFIRMED",
			EntityType:          "DRIVE",
			EntityID:            fmt.Sprintf("%d", driveID),
			ActivityDescription: fmt.Sprintf("Confirmed student list: %d candidates moved to %s", len(driveStudents), stage1.StageName),
			CreatedAt:           now,
		}
		_ = r.LogActivityWithSuppression(tx, &actLog)

		result = ConfirmRosterResult{
			Success:    true,
			MovedCount: len(driveStudents),
			StageID:    stage1.ID,
			StageName:  stage1.StageName,
			Message:    fmt.Sprintf("Confirmed student list: %d candidate(s) moved to %s", len(driveStudents), stage1.StageName),
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	return &result, nil
}

// GetDriveStages fetches all stages with their substages for a drive ordered by sequence_no,
// and computes live participants_count and cleared_count for each stage and substage
func (r *DriveRepository) GetDriveStages(driveID uint64) ([]models.PlacementDriveStage, error) {
	var stages []models.PlacementDriveStage
	err := r.db.Preload("Substages", func(db *gorm.DB) *gorm.DB {
		return db.Order("placement_drive_substages.sequence_no asc")
	}).Where("drive_id = ?", driveID).Order("sequence_no asc").Find(&stages).Error
	if err != nil {
		return nil, err
	}

	for i := range stages {
		// Check if stage has substages
		var lastSub models.PlacementDriveSubstage
		hasSubstages := false
		if len(stages[i].Substages) > 0 {
			hasSubstages = true
			lastSub = stages[i].Substages[len(stages[i].Substages)-1]
		}

		var pCount int64
		var cCount int64

		if hasSubstages {
			// Distinct students entered in this stage (first substage or any substage of this stage)
			r.db.Model(&models.PlacementStageResult{}).
				Where("stage_id = ?", stages[i].ID).
				Distinct("drive_student_id").
				Count(&pCount)

			// Stage cleared count = students who cleared the FINAL substage of this stage
			r.db.Model(&models.PlacementStageResult{}).
				Where("stage_id = ? AND substage_id = ? AND outcome = 'cleared'", stages[i].ID, lastSub.ID).
				Distinct("drive_student_id").
				Count(&cCount)
		} else {
			// Simple stage without substages
			r.db.Model(&models.PlacementStageResult{}).
				Where("stage_id = ?", stages[i].ID).
				Distinct("drive_student_id").
				Count(&pCount)

			r.db.Model(&models.PlacementStageResult{}).
				Where("stage_id = ? AND outcome = 'cleared'", stages[i].ID).
				Distinct("drive_student_id").
				Count(&cCount)
		}

		stages[i].ParticipantsCount = pCount
		stages[i].ClearedCount = cCount

		// Substage level counts:
		for j := range stages[i].Substages {
			subID := stages[i].Substages[j].ID
			var subPCount int64
			var subCCount int64
			r.db.Model(&models.PlacementStageResult{}).
				Where("stage_id = ? AND substage_id = ?", stages[i].ID, subID).
				Distinct("drive_student_id").
				Count(&subPCount)
			r.db.Model(&models.PlacementStageResult{}).
				Where("stage_id = ? AND substage_id = ? AND outcome = 'cleared'", stages[i].ID, subID).
				Distinct("drive_student_id").
				Count(&subCCount)
			stages[i].Substages[j].ParticipantsCount = subPCount
			stages[i].Substages[j].ClearedCount = subCCount
		}
	}

	return stages, nil
}

// StageCreateInput holds payload to create a new stage
type SubstageCreateInput struct {
	SubstageName  string     `json:"substage_name"`
	ScheduledDate *time.Time `json:"scheduled_date"`
	Status        string     `json:"status"`
	InternalNotes string     `json:"internal_notes"`
}

type StageCreateInput struct {
	StageName     string                `json:"stage_name"`
	ScheduledDate *time.Time            `json:"scheduled_date"`
	InitialStatus string                `json:"initial_status"`
	InternalNotes string                `json:"internal_notes"`
	Substages     []SubstageCreateInput `json:"substages"`
}

// CreateStage creates a stage, optional substages, and initializes results for eligible roster students if first stage
func (r *DriveRepository) CreateStage(driveID uint64, input StageCreateInput) (*models.PlacementDriveStage, error) {
	var createdStage models.PlacementDriveStage
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var drive models.PlacementDrive
		if false {
			if drive.OverallStatus == "completed" || drive.OverallStatus == "awaiting_final_result" {
				return errors.New("cannot create stage: recruitment process is already completed and locked")
			}
		}

		// Calculate next sequence_no
		// calculate sequence

	var maxSeq int
		tx.Model(&models.PlacementDriveStage{}).Where("drive_id = ?", driveID).Select("COALESCE(MAX(sequence_no), 0)").Scan(&maxSeq)
		nextSeq := maxSeq + 1

		status := input.InitialStatus
		if status == "" {
			status = "pending"
		}

		stage := models.PlacementDriveStage{
			DriveID:       driveID,
			StageName:     input.StageName,
			SequenceNo:    nextSeq,
			ScheduledDate: input.ScheduledDate,
			InternalNotes: input.InternalNotes,
			StageStatus:   status,
		}

		if err := tx.Create(&stage).Error; err != nil {
			return err
		}

		// Create substages if provided
		var createdSubstages []models.PlacementDriveSubstage
		for i, sub := range input.Substages {
			subStatus := sub.Status
			if subStatus == "" {
				subStatus = "pending"
			}
			substage := models.PlacementDriveSubstage{
				StageID:        stage.ID,
				SubstageName:   sub.SubstageName,
				SequenceNo:     i + 1,
				ScheduledDate:  sub.ScheduledDate,
				SubstageStatus: subStatus,
				InternalNotes:  sub.InternalNotes,
			}
			if err := tx.Create(&substage).Error; err != nil {
				return err
			}
			createdSubstages = append(createdSubstages, substage)
		}
		stage.Substages = createdSubstages
		createdStage = stage

		// Initialize student results:
		// If this is stage 1 (first stage created for this drive):
		// initialize results for all included / special_entry students in placement_drive_students
		if nextSeq == 1 && r.IsRosterConfirmed(driveID) {
			var driveStudents []models.PlacementDriveStudent
			tx.Where("drive_id = ? AND drive_status IN ('included', 'special_entry')", driveID).Find(&driveStudents)

			// If no explicit DB records yet, dynamically ensure records exist from GetDriveStudentsList
			if len(driveStudents) == 0 {
				candidateList, err := r.GetDriveStudentsList(driveID)
				if err == nil {
					for _, c := range candidateList {
						if c.DriveStatus == "included" || c.DriveStatus == "special_entry" {
							rec := models.PlacementDriveStudent{
								DriveID:     driveID,
								UserID:      c.UserID,
								DriveStatus: c.DriveStatus,
								IncludedAt:  time.Now(),
								Notes:       "Initialized for recruitment stage",
							}
							if err := tx.Create(&rec).Error; err == nil {
								driveStudents = append(driveStudents, rec)
							}
						}
					}
				}
			}

			// For each student, initialize stage result
			for _, ds := range driveStudents {
				if len(createdSubstages) > 0 {
					// Initialize for the first substage
					firstSub := createdSubstages[0]
					res := models.PlacementStageResult{
						DriveStudentID:      ds.ID,
						StageID:             stage.ID,
						SubstageID:          &firstSub.ID,
						PreviousStageStatus: "cleared",
						Outcome:             "pending",
						Remarks:             "",
						CreatedAt:           time.Now(),
						UpdatedAt:           time.Now(),
					}
					tx.Create(&res)
				} else {
					// Single stage: initialize result directly for main stage
					res := models.PlacementStageResult{
						DriveStudentID:      ds.ID,
						StageID:             stage.ID,
						SubstageID:          nil,
						PreviousStageStatus: "cleared",
						Outcome:             "pending",
						Remarks:             "",
						CreatedAt:           time.Now(),
						UpdatedAt:           time.Now(),
					}
					tx.Create(&res)
				}
			}
		}

		var d models.PlacementDrive
		_ = tx.First(&d, driveID).Error

		actLog := models.PlacementDriveActivityLog{
			DriveID:             driveID,
			UserID:              d.DriveOwnerUserID,
			ActivityType:        "STAGE_CREATED",
			EntityType:          "STAGE",
			EntityID:            fmt.Sprintf("%d", stage.ID),
			ActivityDescription: fmt.Sprintf("Created %s stage", stage.StageName),
			CreatedAt:           time.Now(),
		}
		_ = r.LogActivityWithSuppression(tx, &actLog)

		return nil
	})

	if err != nil {
		return nil, err
	}
	return &createdStage, nil
}

// UpdateStage updates stage name, dates, status, notes, and syncs substages
type StageUpdateInput struct {
	StageName     string                `json:"stage_name"`
	ScheduledDate *time.Time            `json:"scheduled_date"`
	StageStatus   string                `json:"stage_status"`
	InternalNotes string                `json:"internal_notes"`
	Substages     []SubstageCreateInput `json:"substages"`
}

func (r *DriveRepository) UpdateStage(stageID uint64, input StageUpdateInput) (*models.PlacementDriveStage, error) {
	var stage models.PlacementDriveStage
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", stageID).First(&stage).Error; err != nil {
			return err
		}

		var drive models.PlacementDrive
		if err := tx.Where("id = ?", stage.DriveID).First(&drive).Error; err == nil {
			if drive.OverallStatus == "completed" || drive.OverallStatus == "awaiting_final_result" {
				return errors.New("cannot edit stage: recruitment process is already completed and locked")
			}
		}

		updates := map[string]interface{}{
			"stage_name":     input.StageName,
			"scheduled_date": input.ScheduledDate,
			"stage_status":   input.StageStatus,
			"internal_notes": input.InternalNotes,
		}

		if err := tx.Model(&stage).Updates(updates).Error; err != nil {
			return err
		}

		// If substages are provided in update payload:
		// Smartly sync existing substages without breaking foreign key references in placement_stage_results
		if len(input.Substages) > 0 {
			var existingSubstages []models.PlacementDriveSubstage
			tx.Where("stage_id = ?", stageID).Order("sequence_no asc").Find(&existingSubstages)

			for i, sub := range input.Substages {
				subStatus := sub.Status
				if subStatus == "" {
					subStatus = "pending"
				}
				if i < len(existingSubstages) {
					// Update existing substage
					tx.Model(&existingSubstages[i]).Updates(map[string]interface{}{
						"substage_name":   sub.SubstageName,
						"scheduled_date":  sub.ScheduledDate,
						"substage_status": subStatus,
						"internal_notes":  sub.InternalNotes,
					})
				} else {
					// Create new substage
					newSub := models.PlacementDriveSubstage{
						StageID:        stageID,
						SubstageName:   sub.SubstageName,
						SequenceNo:     i + 1,
						ScheduledDate:  sub.ScheduledDate,
						SubstageStatus: subStatus,
						InternalNotes:  sub.InternalNotes,
					}
					if err := tx.Create(&newSub).Error; err != nil {
						return err
					}
				}
			}

			// Delete excess substages if any removed
			if len(existingSubstages) > len(input.Substages) {
				for i := len(input.Substages); i < len(existingSubstages); i++ {
					tx.Where("id = ?", existingSubstages[i].ID).Delete(&models.PlacementDriveSubstage{})
				}
			}
		}

		var d models.PlacementDrive
		_ = tx.First(&d, stage.DriveID).Error

		actLog := models.PlacementDriveActivityLog{
			DriveID:             stage.DriveID,
			UserID:              d.DriveOwnerUserID,
			ActivityType:        "STAGE_UPDATED",
			EntityType:          "STAGE",
			EntityID:            fmt.Sprintf("%d", stage.ID),
			ActivityDescription: fmt.Sprintf("Updated %s stage", stage.StageName),
			CreatedAt:           time.Now(),
		}
		_ = r.LogActivityWithSuppression(tx, &actLog)

		return nil
	})

	if err != nil {
		return nil, err
	}

	r.db.Preload("Substages").First(&stage, stageID)
	return &stage, nil
}

// CreateSubstage adds a new substage to an existing stage
func (r *DriveRepository) CreateSubstage(stageID uint64, input SubstageCreateInput) (*models.PlacementDriveSubstage, error) {
	var stage models.PlacementDriveStage
	if err := r.db.Where("id = ?", stageID).First(&stage).Error; err != nil {
		return nil, err
	}

	var drive models.PlacementDrive
	if err := r.db.Where("id = ?", stage.DriveID).First(&drive).Error; err == nil {
		if drive.OverallStatus == "completed" || drive.OverallStatus == "awaiting_final_result" {
			return nil, errors.New("cannot add substage: recruitment process is already completed and locked")
		}
	}

	var maxSeq int
	r.db.Model(&models.PlacementDriveSubstage{}).Where("stage_id = ?", stageID).Select("COALESCE(MAX(sequence_no), 0)").Scan(&maxSeq)
	nextSeq := maxSeq + 1

	status := input.Status
	if status == "" {
		status = "pending"
	}

	substage := models.PlacementDriveSubstage{
		StageID:        stageID,
		SubstageName:   input.SubstageName,
		SequenceNo:     nextSeq,
		ScheduledDate:  input.ScheduledDate,
		SubstageStatus: status,
		InternalNotes:  input.InternalNotes,
	}

	if err := r.db.Create(&substage).Error; err != nil {
		return nil, err
	}

	actLog := models.PlacementDriveActivityLog{
		DriveID:             stage.DriveID,
		ActivityType:        "SUBSTAGE_CREATED",
		EntityType:          "SUBSTAGE",
		EntityID:            fmt.Sprintf("%d", substage.ID),
		ActivityDescription: fmt.Sprintf("Added %s under %s", substage.SubstageName, stage.StageName),
		CreatedAt:           time.Now(),
	}
	_ = r.LogActivityWithSuppression(r.db, &actLog)

	return &substage, nil
}

// GetStageResults fetches student results for a stage or substage
func (r *DriveRepository) GetStageResults(driveID uint64, stageID uint64, substageID *uint64) ([]models.StageStudentResultView, error) {
	type resultRow struct {
		ResultID            uint64   `gorm:"column:result_id"`
		DriveStudentID      uint64   `gorm:"column:drive_student_id"`
		UserID              uint64   `gorm:"column:user_id"`
		Name                string   `gorm:"column:name"`
		RollNo              *string  `gorm:"column:roll_no"`
		Email               string   `gorm:"column:email"`
		DepartmentName      string   `gorm:"column:dept_name"`
		BatchName           string   `gorm:"column:batch_name"`
		PreviousStageStatus string   `gorm:"column:previous_stage_status"`
		Outcome             string   `gorm:"column:outcome"`
		Score               *float64 `gorm:"column:score"`
		Remarks             string   `gorm:"column:remarks"`
		UpdatedBy           *uint64  `gorm:"column:updated_by"`
		UpdatedByName       *string  `gorm:"column:updated_by_name"`
		UpdatedAt           time.Time `gorm:"column:updated_at"`
	}

	query := r.db.Table("placement_stage_results r").
		Select("r.id as result_id, r.drive_student_id, pds.user_id, u.name, u.roll_no, u.email, d.name as dept_name, b.name as batch_name, r.previous_stage_status, r.outcome, r.score, r.remarks, r.updated_by, u2.name as updated_by_name, r.updated_at").
		Joins("JOIN placement_drive_students pds ON r.drive_student_id = pds.id").
		Joins("JOIN master_users u ON pds.user_id = u.id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Joins("LEFT JOIN batches b ON u.batch_id = b.id").
		Joins("LEFT JOIN master_users u2 ON r.updated_by = u2.id").
		Where("pds.drive_id = ? AND r.stage_id = ? AND pds.drive_status != 'excluded'", driveID, stageID)

	if substageID != nil && *substageID > 0 {
		query = query.Where("r.substage_id = ?", *substageID)
	} else {
		// When viewing main stage results: show records where substage_id IS NULL OR substage_id matches the first substage
		query = query.Where("r.substage_id IS NULL")
	}

	var rows []resultRow
	if err := query.Order("u.name asc").Scan(&rows).Error; err != nil {
		return nil, err
	}

	var results []models.StageStudentResultView
	for _, row := range rows {
		rollNo := ""
		if row.RollNo != nil {
			rollNo = *row.RollNo
		}
		updatedName := "Placement Team"
		if row.UpdatedByName != nil && *row.UpdatedByName != "" {
			updatedName = *row.UpdatedByName
		}

		results = append(results, models.StageStudentResultView{
			ResultID:            row.ResultID,
			DriveStudentID:      row.DriveStudentID,
			UserID:              row.UserID,
			Name:                row.Name,
			RollNo:              rollNo,
			Email:               row.Email,
			DepartmentName:      row.DepartmentName,
			BatchName:           row.BatchName,
			PreviousStageStatus: row.PreviousStageStatus,
			Outcome:             row.Outcome,
			Score:               row.Score,
			Remarks:             row.Remarks,
			UpdatedBy:           row.UpdatedBy,
			UpdatedByName:       updatedName,
			UpdatedAt:           row.UpdatedAt.Format("02 Jan 2006"),
		})
	}

	return results, nil
}

// StudentOutcomeUpdateItem represents a single result update
type StudentOutcomeUpdateItem struct {
	ResultID uint64   `json:"result_id"`
	Outcome  string   `json:"outcome"`
	Score    *float64 `json:"score"`
	Remarks  *string  `json:"remarks"`
}

// UpdateStageResults updates outcomes, scores, and remarks
func (r *DriveRepository) UpdateStageResults(officerUserID *uint64, updates []StudentOutcomeUpdateItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			var sampleRes models.PlacementStageResult
			if err := tx.Where("id = ?", updates[0].ResultID).First(&sampleRes).Error; err == nil {
				var st models.PlacementDriveStage
				if err := tx.Where("id = ?", sampleRes.StageID).First(&st).Error; err == nil {
					if st.StageStatus == "completed" {
						return errors.New("cannot edit student outcome: stage is already completed and locked")
					}
					var drive models.PlacementDrive
					if err := tx.Where("id = ?", st.DriveID).First(&drive).Error; err == nil {
						if drive.OverallStatus == "completed" || drive.OverallStatus == "awaiting_final_result" {
							return errors.New("cannot edit student outcome: recruitment process is already completed and locked")
						}
					}
				}
			}
		}

		for _, u := range updates {
			fields := map[string]interface{}{
				"outcome":    u.Outcome,
				"updated_at": time.Now(),
			}
			if officerUserID != nil && *officerUserID > 0 {
				fields["updated_by"] = *officerUserID
			}
			if u.Score != nil {
				fields["score"] = *u.Score
			}
			if u.Remarks != nil {
				fields["remarks"] = *u.Remarks
			}
			if err := tx.Model(&models.PlacementStageResult{}).Where("id = ?", u.ResultID).Updates(fields).Error; err != nil {
				return err
			}
		}

		if len(updates) > 0 {
			// Fetch first result to identify stage and drive
			var firstRes models.PlacementStageResult
			if err := tx.Where("id = ?", updates[0].ResultID).First(&firstRes).Error; err == nil {
				var st models.PlacementDriveStage
				_ = tx.Where("id = ?", firstRes.StageID).First(&st).Error

				clearedCount := 0
				notClearedCount := 0
				for _, item := range updates {
					if item.Outcome == "cleared" {
						clearedCount++
					} else if item.Outcome == "not_cleared" {
						notClearedCount++
					}
				}

				var actType string
				var actDesc string
				if clearedCount > 0 && notClearedCount > 0 {
					actType = "OUTCOMES_UPDATED"
					actDesc = fmt.Sprintf("Updated %s results: %d cleared, %d not cleared", st.StageName, clearedCount, notClearedCount)
				} else if clearedCount > 0 {
					actType = "STUDENTS_CLEARED"
					actDesc = fmt.Sprintf("%d students cleared %s", clearedCount, st.StageName)
				} else if notClearedCount > 0 {
					actType = "STUDENTS_NOT_CLEARED"
					actDesc = fmt.Sprintf("%d students did not clear %s", notClearedCount, st.StageName)
				} else {
					actType = "OUTCOMES_UPDATED"
					actDesc = fmt.Sprintf("Updated %s results for %d students", st.StageName, len(updates))
				}

				actLog := models.PlacementDriveActivityLog{
					DriveID:             st.DriveID,
					UserID:              officerUserID,
					ActivityType:        actType,
					EntityType:          "STAGE",
					EntityID:            fmt.Sprintf("%d", st.ID),
					ActivityDescription: actDesc,
					CreatedAt:           time.Now(),
				}
				_ = r.LogActivityWithSuppression(tx, &actLog)
			}
		}

		return nil
	})
}

// AddSpecialEntryToStage adds students directly into a stage/substage with spl_entry and outcome pending
func (r *DriveRepository) AddSpecialEntryToStage(driveID uint64, stageID uint64, substageID *uint64, userIDs []uint64, officerUserID *uint64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var drive models.PlacementDrive
		if false {
			if drive.OverallStatus == "completed" || drive.OverallStatus == "awaiting_final_result" {
				return errors.New("cannot add special entry: recruitment process is already completed and locked")
			}
		}

		for _, uID := range userIDs {
			// Find or create placement_drive_students record
			var ds models.PlacementDriveStudent
			err := tx.Where("drive_id = ? AND user_id = ?", driveID, uID).First(&ds).Error
			if err != nil {
				ds = models.PlacementDriveStudent{
					DriveID:     driveID,
					UserID:      uID,
					DriveStatus: "special_entry",
					IncludedAt:  time.Now(),
					Notes:       "Special entry added to recruitment stage",
				}
				if err := tx.Create(&ds).Error; err != nil {
					return err
				}
			}

			// Ensure not already in this stage/substage
			var existingRes models.PlacementStageResult
			resQuery := tx.Where("drive_student_id = ? AND stage_id = ?", ds.ID, stageID)
			if substageID != nil && *substageID > 0 {
				resQuery = resQuery.Where("substage_id = ?", *substageID)
			} else {
				resQuery = resQuery.Where("substage_id IS NULL")
			}
			if err := resQuery.First(&existingRes).Error; err == nil {
				// Already exists: update previous_stage_status to spl_entry if not cleared
				tx.Model(&existingRes).Update("previous_stage_status", "spl_entry")
				continue
			}

			newRes := models.PlacementStageResult{
				DriveStudentID:      ds.ID,
				StageID:             stageID,
				SubstageID:          substageID,
				PreviousStageStatus: "spl_entry",
				Outcome:             "pending",
				UpdatedBy:           officerUserID,
				CreatedAt:           time.Now(),
				UpdatedAt:           time.Now(),
			}
			if err := tx.Create(&newRes).Error; err != nil {
				return err
			}
		}

		if len(userIDs) > 0 {
			var st models.PlacementDriveStage
			_ = tx.Where("id = ?", stageID).First(&st).Error

			actLog := models.PlacementDriveActivityLog{
				DriveID:             driveID,
				UserID:              officerUserID,
				ActivityType:        "ROUND_SPECIAL_ENTRY",
				EntityType:          "STAGE",
				EntityID:            fmt.Sprintf("%d", stageID),
				ActivityDescription: fmt.Sprintf("Added %d students through special entry in %s", len(userIDs), st.StageName),
				CreatedAt:           time.Now(),
			}
			_ = r.LogActivityWithSuppression(tx, &actLog)
		}

		return nil
	})
}

// CompleteStage marks a stage completed and progresses students with outcome 'cleared' to the next stage
func (r *DriveRepository) CompleteStage(driveID uint64, stageID uint64, officerUserID *uint64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var currentStage models.PlacementDriveStage
		if err := tx.Where("id = ? AND drive_id = ?", stageID, driveID).First(&currentStage).Error; err != nil {
			return errors.New("stage not found")
		}

		var drive models.PlacementDrive
		if false {
			if drive.OverallStatus == "completed" || drive.OverallStatus == "awaiting_final_result" {
				return errors.New("cannot complete stage: recruitment process is already completed and locked")
			}
		}

		// Validation: If this stage has substages, ensure all substages are completed first
		var uncompletedSubstagesCount int64
		if err := tx.Model(&models.PlacementDriveSubstage{}).
			Where("stage_id = ? AND substage_status != 'completed'", stageID).
			Count(&uncompletedSubstagesCount).Error; err == nil {
			if uncompletedSubstagesCount > 0 {
				return errors.New("cannot complete stage: all substages must be marked as completed first")
			}
		}

		// Update current stage to completed
		// drive verified

		now := time.Now()
		if err := tx.Model(&currentStage).Updates(map[string]interface{}{
			"stage_status": "completed",
			"completed_at": now,
		}).Error; err != nil {
			return err
		}

		// Find next stage in sequence
		var nextStage models.PlacementDriveStage
		err := tx.Where("drive_id = ? AND sequence_no > ?", driveID, currentStage.SequenceNo).
			Order("sequence_no asc").First(&nextStage).Error
		if err != nil {
			// No next stage: this was the final stage
			return nil
		}

		// Check if next stage has substages
		var nextSubstages []models.PlacementDriveSubstage
		tx.Where("stage_id = ?", nextStage.ID).Order("sequence_no asc").Find(&nextSubstages)
		var nextSubstageID *uint64
		if len(nextSubstages) > 0 {
			nextSubstageID = &nextSubstages[0].ID
		}

		// Fetch students who cleared the current stage:
		// If current stage has substages, ONLY students who cleared the FINAL substage qualify to move to next main stage.
		var clearedResults []models.PlacementStageResult
		var currentSubstages []models.PlacementDriveSubstage
		tx.Where("stage_id = ?", currentStage.ID).Order("sequence_no asc").Find(&currentSubstages)

		if len(currentSubstages) > 0 {
			finalSubstage := currentSubstages[len(currentSubstages)-1]
			tx.Where("stage_id = ? AND substage_id = ? AND outcome = 'cleared'", currentStage.ID, finalSubstage.ID).Find(&clearedResults)
		} else {
			tx.Where("stage_id = ? AND outcome = 'cleared'", currentStage.ID).Find(&clearedResults)
		}

		// Distinct student IDs that cleared
		seenStudent := make(map[uint64]bool)
		for _, cr := range clearedResults {
			if seenStudent[cr.DriveStudentID] {
				continue
			}
			seenStudent[cr.DriveStudentID] = true

			// Check if already in next stage
			var existing models.PlacementStageResult
			chkQuery := tx.Where("drive_student_id = ? AND stage_id = ?", cr.DriveStudentID, nextStage.ID)
			if nextSubstageID != nil {
				chkQuery = chkQuery.Where("substage_id = ?", *nextSubstageID)
			} else {
				chkQuery = chkQuery.Where("substage_id IS NULL")
			}
			if err := chkQuery.First(&existing).Error; err == nil {
				// If student already exists in next stage with spl_entry or pending, ensure previous_stage_status is 'cleared'
				if existing.PreviousStageStatus != "cleared" {
					tx.Model(&existing).Update("previous_stage_status", "cleared")
				}
				continue // already created
			}

			// Insert result record in next stage with outcome 'pending' & previous_stage_status = 'cleared'
			nextRes := models.PlacementStageResult{
				DriveStudentID:      cr.DriveStudentID,
				StageID:             nextStage.ID,
				SubstageID:          nextSubstageID,
				PreviousStageStatus: "cleared",
				Outcome:             "pending",
				UpdatedBy:           officerUserID,
				CreatedAt:           now,
				UpdatedAt:           now,
			}
			if err := tx.Create(&nextRes).Error; err != nil {
				return err
			}
		}

		actLog := models.PlacementDriveActivityLog{
			DriveID:             driveID,
			UserID:              officerUserID,
			ActivityType:        "STAGE_COMPLETED",
			EntityType:          "STAGE",
			EntityID:            fmt.Sprintf("%d", stageID),
			ActivityDescription: fmt.Sprintf("%s stage marked as completed", currentStage.StageName),
			CreatedAt:           now,
		}
		_ = r.LogActivityWithSuppression(tx, &actLog)

		return nil
	})
}

// UpdateSubstageStatus updates the status of an existing substage
func (r *DriveRepository) UpdateSubstageStatus(stageID uint64, substageID uint64, status string) error {
	var sub models.PlacementDriveSubstage
	if err := r.db.Where("id = ? AND stage_id = ?", substageID, stageID).First(&sub).Error; err != nil {
		return err
	}
	if err := r.db.Model(&sub).Update("substage_status", status).Error; err != nil {
		return err
	}
	var stage models.PlacementDriveStage
	_ = r.db.Where("id = ?", stageID).First(&stage).Error

	actLog := models.PlacementDriveActivityLog{
		DriveID:             stage.DriveID,
		ActivityType:        "SUBSTAGE_UPDATED",
		EntityType:          "SUBSTAGE",
		EntityID:            fmt.Sprintf("%d", substageID),
		ActivityDescription: fmt.Sprintf("Updated %s status to %s", sub.SubstageName, status),
		CreatedAt:           time.Now(),
	}
	_ = r.LogActivityWithSuppression(r.db, &actLog)
	return nil
}

// CompleteSubstage marks a substage completed and progresses cleared students to the next substage
func (r *DriveRepository) CompleteSubstage(driveID uint64, stageID uint64, substageID uint64, officerUserID *uint64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var currentSubstage models.PlacementDriveSubstage
		if err := tx.Where("id = ? AND stage_id = ?", substageID, stageID).First(&currentSubstage).Error; err != nil {
			return errors.New("substage not found")
		}

		// drive verified

		now := time.Now()
		if err := tx.Model(&currentSubstage).Updates(map[string]interface{}{
			"substage_status": "completed",
			"completed_at":    now,
		}).Error; err != nil {
			return err
		}

		// Find next substage in sequence within the same stage
		var nextSubstage models.PlacementDriveSubstage
		err := tx.Where("stage_id = ? AND sequence_no > ?", stageID, currentSubstage.SequenceNo).
			Order("sequence_no asc").First(&nextSubstage).Error
		if err != nil {
			// No next substage in this stage
			return nil
		}

		// Fetch all students who cleared this substage
		var clearedResults []models.PlacementStageResult
		tx.Where("stage_id = ? AND substage_id = ? AND outcome = 'cleared'", stageID, currentSubstage.ID).Find(&clearedResults)

		seenStudent := make(map[uint64]bool)
		for _, cr := range clearedResults {
			if seenStudent[cr.DriveStudentID] {
				continue
			}
			seenStudent[cr.DriveStudentID] = true

			// Check if already in next substage
			var existing models.PlacementStageResult
			chkQuery := tx.Where("drive_student_id = ? AND stage_id = ? AND substage_id = ?", cr.DriveStudentID, stageID, nextSubstage.ID)
			if err := chkQuery.First(&existing).Error; err == nil {
				if existing.PreviousStageStatus != "cleared" {
					tx.Model(&existing).Update("previous_stage_status", "cleared")
				}
				continue
			}

			// Insert result record in next substage
			nextRes := models.PlacementStageResult{
				DriveStudentID:      cr.DriveStudentID,
				StageID:             stageID,
				SubstageID:          &nextSubstage.ID,
				PreviousStageStatus: "cleared",
				Outcome:             "pending",
				UpdatedBy:           officerUserID,
				CreatedAt:           now,
				UpdatedAt:           now,
			}
			if err := tx.Create(&nextRes).Error; err != nil {
				return err
			}
		}

		actLog := models.PlacementDriveActivityLog{
			DriveID:             driveID,
			UserID:              officerUserID,
			ActivityType:        "SUBSTAGE_COMPLETED",
			EntityType:          "SUBSTAGE",
			EntityID:            fmt.Sprintf("%d", substageID),
			ActivityDescription: fmt.Sprintf("%s round marked as completed", currentSubstage.SubstageName),
			CreatedAt:           now,
		}
		_ = r.LogActivityWithSuppression(tx, &actLog)

		return nil
	})
}


// CompleteRecruitmentProcess marks all stages as completed, sets drive overall_status to awaiting_final_result
func (r *DriveRepository) CompleteRecruitmentProcess(driveID uint64, officerUserID *uint64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// drive verified

		now := time.Now()
		// Mark all stages for this drive as completed if not already completed
		if err := tx.Model(&models.PlacementDriveStage{}).
			Where("drive_id = ?", driveID).
			Updates(map[string]interface{}{
				"stage_status": "completed",
				"completed_at": now,
			}).Error; err != nil {
			return err
		}

		// Update overall_status of drive to awaiting_final_result
		if err := tx.Model(&models.PlacementDrive{}).
			Where("id = ?", driveID).
			Updates(map[string]interface{}{
				"overall_status": "awaiting_final_result",
				"updated_at":     now,
			}).Error; err != nil {
			return err
		}

		// Log activity
		actLog := models.PlacementDriveActivityLog{
			DriveID:             driveID,
			UserID:              officerUserID,
			ActivityType:        "RECRUITMENT_COMPLETED",
			EntityType:          "DRIVE",
			EntityID:            fmt.Sprintf("%d", driveID),
			ActivityDescription: "All recruitment stages completed; moved to Final Selection",
			CreatedAt:           now,
		}
		_ = r.LogActivityWithSuppression(tx, &actLog)

		return nil
	})
}

// GetFinalSelectionData retrieves all candidates reaching the final stage and existing offers
func (r *DriveRepository) GetFinalSelectionData(driveID uint64) (*models.FinalSelectionData, error) {
	var drive models.PlacementDrive
	if err := r.db.Preload("Company").First(&drive, driveID).Error; err != nil {
		return nil, errors.New("drive not found")
	}

	var pubDateStr *string
	if drive.ResultPublicationDate != nil {
		s := drive.ResultPublicationDate.Format("2006-01-02")
		pubDateStr = &s
	}

	companyCode := ""
	companyName := ""
	if drive.Company != nil {
		companyCode = drive.Company.CompanyCode
		companyName = drive.Company.CompanyName
	}

	baseData := &models.FinalSelectionData{
		DriveID:                drive.ID,
		OverallStatus:          drive.OverallStatus,
		ResultPublicationDate:  pubDateStr,
		ResultReference:        drive.ResultReference,
		ResultNotes:            drive.ResultNotes,
		CompanyCode:            companyCode,
		CompanyName:            companyName,
		DefaultRole:            drive.JobRole,
		DefaultPackageLPA:      drive.PackageLPA,
		Students:               []models.FinalSelectionStudentItem{},
		TotalFinalCandidates:   0,
		ClearedCandidatesCount: 0,
	}

	var lastStage models.PlacementDriveStage
	err := r.db.Where("drive_id = ?", driveID).Order("sequence_no desc").First(&lastStage).Error
	if err != nil {
		// Drive has no stages configured yet: return valid empty dataset without error
		return baseData, nil
	}

	// If last stage has substages, find the last substage
	var lastSubstage models.PlacementDriveSubstage
	hasSubstages := false
	if err := r.db.Where("stage_id = ?", lastStage.ID).Order("sequence_no desc").First(&lastSubstage).Error; err == nil {
		hasSubstages = true
	}

	finalRoundName := lastStage.StageName
	if hasSubstages {
		finalRoundName = fmt.Sprintf("%s - %s", lastStage.StageName, lastSubstage.SubstageName)
	}
	baseData.FinalRoundName = finalRoundName

	var actCount int64
	r.db.Model(&models.PlacementDriveActivityLog{}).
		Where("drive_id = ? AND activity_type = 'RECRUITMENT_COMPLETED'", driveID).
		Count(&actCount)

	isRecruitmentProcessCompleted := drive.OverallStatus == "awaiting_final_result" || drive.OverallStatus == "completed" || actCount > 0
	baseData.FinalRoundCompleted = isRecruitmentProcessCompleted

	if !isRecruitmentProcessCompleted {
		return baseData, nil
	}

	query := r.db.Table("placement_stage_results psr").
		Select(`
			pds.id as drive_student_id,
			pds.user_id,
			u.name,
			COALESCE(u.roll_no, '') as roll_no,
			COALESCE(d.name, '') as department_name,
			psr.outcome,
			COALESCE(o.final_role, ?) as final_role,
			COALESCE(o.package_lpa, ?) as package_lpa,
			o.offer_letter_file as offer_letter_file
		`, drive.JobRole, drive.PackageLPA).
		Joins("JOIN placement_drive_students pds ON pds.id = psr.drive_student_id").
		Joins("JOIN master_users u ON u.id = pds.user_id").
		Joins("LEFT JOIN departments d ON d.id = u.department_id").
		Joins("LEFT JOIN placement_drive_offers o ON o.drive_student_id = pds.id").
		Where("psr.stage_id = ? AND psr.outcome = 'cleared'", lastStage.ID)

	if hasSubstages {
		var subCount int64
		r.db.Model(&models.PlacementStageResult{}).Where("stage_id = ? AND substage_id = ?", lastStage.ID, lastSubstage.ID).Count(&subCount)
		if subCount > 0 {
			query = query.Where("psr.substage_id = ?", lastSubstage.ID)
		}
	}

	type rawStudent struct {
		DriveStudentID  uint64
		UserID          uint64
		Name            string
		RollNo          string
		DepartmentName  string
		Outcome         string
		FinalRole       string
		PackageLPA      *float64
		OfferLetterFile *string
	}

	var rows []rawStudent
	if err := query.Order("u.name asc").Scan(&rows).Error; err != nil {
		return nil, err
	}

	studentItems := make([]models.FinalSelectionStudentItem, 0, len(rows))
	clearedCount := 0
	for _, row := range rows {
		if row.Outcome == "cleared" {
			clearedCount++
		}
		pkg := row.PackageLPA
		if pkg == nil {
			val := drive.PackageLPA
			pkg = &val
		}
		role := row.FinalRole
		if role == "" {
			role = drive.JobRole
		}
		studentItems = append(studentItems, models.FinalSelectionStudentItem{
			DriveStudentID:  row.DriveStudentID,
			UserID:          row.UserID,
			Name:            row.Name,
			RollNo:          row.RollNo,
			DepartmentName:  row.DepartmentName,
			Outcome:         row.Outcome,
			FinalRole:       role,
			PackageLPA:      pkg,
			OfferLetterFile: row.OfferLetterFile,
		})
	}

	return &models.FinalSelectionData{
		DriveID:                drive.ID,
		OverallStatus:          drive.OverallStatus,
		ResultPublicationDate:  pubDateStr,
		ResultReference:        drive.ResultReference,
		ResultNotes:            drive.ResultNotes,
		CompanyCode:            companyCode,
		CompanyName:            companyName,
		DefaultRole:            drive.JobRole,
		DefaultPackageLPA:      drive.PackageLPA,
		Students:               studentItems,
		TotalFinalCandidates:   len(studentItems),
		ClearedCandidatesCount: clearedCount,
		FinalRoundCompleted:    isRecruitmentProcessCompleted,
		FinalRoundName:         finalRoundName,
	}, nil
}

// SaveFinalSelections saves publication info, creates/updates offers, and optionally completes the drive
func (r *DriveRepository) SaveFinalSelections(
	driveID uint64,
	pubDate *time.Time,
	reference string,
	notes string,
	offers []models.PlacementDriveOffer,
	markCompleted bool,
	officerUserID *uint64,
) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// drive verified

		now := time.Now()
		driveUpdates := map[string]interface{}{
			"result_reference": reference,
			"result_notes":     notes,
			"updated_at":       now,
		}
		if pubDate != nil {
			driveUpdates["result_publication_date"] = pubDate
		}
		if markCompleted {
			driveUpdates["overall_status"] = "completed"
		}

		if err := tx.Model(&models.PlacementDrive{}).Where("id = ?", driveID).Updates(driveUpdates).Error; err != nil {
			return err
		}

		for _, offer := range offers {
			var existing models.PlacementDriveOffer
			err := tx.Where("drive_student_id = ?", offer.DriveStudentID).First(&existing).Error
			
			// Student's offer letter reference: ONLY use an explicit offer letter file or existing offer letter, NEVER fallback to drive-level reference document
			var studentOfferFile *string
			if offer.OfferLetterFile != nil && *offer.OfferLetterFile != "" {
				studentOfferFile = offer.OfferLetterFile
			} else if existing.OfferLetterFile != nil && *existing.OfferLetterFile != "" {
				studentOfferFile = existing.OfferLetterFile
			}

			if err != nil {
				// Create new offer
				offer.ConfirmedAt = &now
				offer.CreatedAt = now
				offer.ResultReference = studentOfferFile
				offer.OfferLetterFile = studentOfferFile
				offer.Notes = &notes
				if err := tx.Create(&offer).Error; err != nil {
					return err
				}
			} else {
				// Update existing offer
				upd := map[string]interface{}{
					"final_role":   offer.FinalRole,
					"package_lpa":  offer.PackageLPA,
					"confirmed_at": now,
					"notes":        notes,
				}
				if studentOfferFile != nil {
					upd["result_reference"] = studentOfferFile
					upd["offer_letter_file"] = studentOfferFile
				}
				if err := tx.Model(&existing).Updates(upd).Error; err != nil {
					return err
				}
			}
		}

		var actType string
		var actDesc string
		if markCompleted {
			actType = "DRIVE_COMPLETED"
			actDesc = "Placement drive marked as completed"
		} else if len(offers) > 0 {
			actType = "OFFER_DETAILS_UPDATED"
			actDesc = fmt.Sprintf("Updated offer details for %d students", len(offers))
		} else {
			actType = "FINAL_RESULTS_RECEIVED"
			actDesc = "Final selection results recorded from the company"
		}
		actLog := models.PlacementDriveActivityLog{
			DriveID:             driveID,
			UserID:              officerUserID,
			ActivityType:        actType,
			EntityType:          "DRIVE",
			EntityID:            fmt.Sprintf("%d", driveID),
			ActivityDescription: actDesc,
			CreatedAt:           now,
		}
		_ = r.LogActivityWithSuppression(tx, &actLog)

		return nil
	})
}
