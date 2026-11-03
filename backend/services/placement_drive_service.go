package services

import (
	"errors"
	"fmt"
	"time"

	"placement-management/models"
	"placement-management/repositories"
)

type DriveService struct {
	repo *repositories.DriveRepository
}

func NewDriveService(repo *repositories.DriveRepository) *DriveService {
	return &DriveService{repo: repo}
}

// GetDrives processes listing with status grouping & subtitle metadata
func (s *DriveService) GetDrives(statusFilter, searchQuery, batchName string) ([]models.PlacementDrive, error) {
	drives, err := s.repo.FetchDrives(statusFilter, searchQuery, batchName)
	if err != nil {
		return nil, err
	}

	for i := range drives {
		studentCount, _ := s.repo.CountDriveStudents(drives[i].ID)
		drives[i].TotalStudents = studentCount

		switch drives[i].OverallStatus {
		case "completed":
			drives[i].StatusGroup = "Recently Completed"
			if drives[i].DriveEndDate != nil {
				drives[i].SubtitleMeta = drives[i].DriveEndDate.Format("02 Jan 2006")
			} else {
				drives[i].SubtitleMeta = drives[i].UpdatedAt.Format("02 Jan 2006")
			}
		case "cancelled":
			drives[i].StatusGroup = "Recently Completed"
			drives[i].SubtitleMeta = "Drive cancelled"
		case "on_hold":
			drives[i].StatusGroup = "Requires Attention"
			drives[i].SubtitleMeta = "Drive temporarily on hold"
		case "registration_open":
			drives[i].StatusGroup = "Upcoming"
			drives[i].SubtitleMeta = "Student registration active"
		case "scheduled", "draft":
			drives[i].StatusGroup = "Upcoming"
			if drives[i].DriveStartDate != nil {
				drives[i].SubtitleMeta = drives[i].DriveStartDate.Format("02 Jan 2006")
			} else {
				drives[i].SubtitleMeta = "Date to be announced"
			}
		default: // in_progress, awaiting_next_round, awaiting_final_result
			drives[i].StatusGroup = "Requires Attention"
			if drives[i].OverallStatus == "awaiting_final_result" {
				drives[i].SubtitleMeta = "Final result pending"
			} else if drives[i].OverallStatus == "awaiting_next_round" {
				drives[i].SubtitleMeta = "Next round not announced"
			} else {
				drives[i].SubtitleMeta = "Rounds active"
			}
		}
	}

	return drives, nil
}

// GetDriveByID retrieves drive details and populates calculated statistics
func (s *DriveService) GetDriveByID(id string) (*models.PlacementDrive, error) {
	drive, err := s.repo.GetDriveByID(id)
	if err != nil {
		return nil, err
	}

	stats := s.repo.ComputeDriveStats(drive.ID)
	drive.Stats = stats
	drive.TotalStudents = stats.IncludedInDrive

	dc := s.repo.ComputeDataCompletion(drive.ID)
	drive.DataCompletion = &dc

	return drive, nil
}

// GetDataCompletion retrieves the computed dynamic data completion breakdown for a drive
func (s *DriveService) GetDataCompletion(driveID uint64) models.DataCompletionStats {
	return s.repo.ComputeDataCompletion(driveID)
}

// CreateDrive creates a new drive adhering to MySQL schema constraints
func (s *DriveService) CreateDrive(companyName, jobRole, placementType string, packageLPA float64, startDate, endDate string, ownerID *uint64, jobDescription string, batchIDs []uint64) (*models.PlacementDrive, error) {
	company, err := s.repo.FindOrCreateCompany(companyName)
	if err != nil {
		return nil, fmt.Errorf("failed to create or find company: %v", err)
	}

	dbPlacementType := "Full-time Placement"
	switch placementType {
	case "Full-time Placement", "Full-time Placment":
		dbPlacementType = "Full-time Placement"
	case "Internship + PPO":
		dbPlacementType = "Internship + PPO"
	case "Internship":
		dbPlacementType = "Internship"
	case "Apprenticeship":
		dbPlacementType = "Apprenticeship"
	default:
		dbPlacementType = "Full-time Placement"
	}

	var parsedStart *time.Time
	if startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			parsedStart = &t
		}
	}

	var parsedEnd *time.Time
	if endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			parsedEnd = &t
		}
	}

	if len(batchIDs) == 0 {
		return nil, fmt.Errorf("please choose the target academic batch option")
	}

	newDrive := models.PlacementDrive{
		CompanyID:        company.ID,
		JobRole:          jobRole,
		PlacementType:    dbPlacementType,
		PackageLPA:       packageLPA,
		DriveStartDate:   parsedStart,
		DriveEndDate:     parsedEnd,
		DriveOwnerUserID: ownerID,
		JobDescription:   jobDescription,
		BatchIDs:         models.Uint64Array(batchIDs),
		OverallStatus:    "draft",
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.repo.SaveDrive(&newDrive); err != nil {
		return nil, err
	}

	log := models.PlacementDriveActivityLog{
		DriveID:             newDrive.ID,
		UserID:              ownerID,
		ActivityType:        "DRIVE_CREATED",
		EntityType:          "DRIVE",
		EntityID:            fmt.Sprintf("%d", newDrive.ID),
		ActivityDescription: fmt.Sprintf("Created %s placement drive", jobRole),
		CreatedAt:           time.Now(),
	}
	s.repo.CreateActivityLog(&log)

	return s.repo.GetDriveByID(fmt.Sprintf("%d", newDrive.ID))
}

// UpdateDriveDetails updates drive fields and logs changes
func (s *DriveService) UpdateDriveDetails(id string, jobRole, placementType string, packageLPA float64, startDate, endDate string, ownerID *uint64, jobDescription string, batchIDs []uint64) (*models.PlacementDrive, error) {
	drive, err := s.repo.GetDriveByID(id)
	if err != nil {
		return nil, err
	}

	if drive.OverallStatus == "completed" {
		return nil, errors.New("cannot edit drive details: placement drive is completed and locked")
	}

	// Track changes to detect if actual data changed and if owner changed
	hasChanged := false
	ownerChanged := false
	var oldOwnerID *uint64 = drive.DriveOwnerUserID

	if (ownerID != nil && oldOwnerID == nil) || (ownerID == nil && oldOwnerID != nil) || (ownerID != nil && oldOwnerID != nil && *ownerID != *oldOwnerID) {
		ownerChanged = true
		hasChanged = true
	}
	if jobRole != "" && drive.JobRole != jobRole {
		hasChanged = true
		drive.JobRole = jobRole
	}
	if placementType != "" && drive.PlacementType != placementType {
		hasChanged = true
		drive.PlacementType = placementType
	}
	if packageLPA > 0 && drive.PackageLPA != packageLPA {
		hasChanged = true
		drive.PackageLPA = packageLPA
	}
	if drive.JobDescription != jobDescription {
		hasChanged = true
		drive.JobDescription = jobDescription
	}
	if len(batchIDs) > 0 {
		hasChanged = true
		drive.BatchIDs = models.Uint64Array(batchIDs)
	}

	var parsedStart *time.Time
	if startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			parsedStart = &t
		}
	}
	if (parsedStart != nil && drive.DriveStartDate == nil) || (parsedStart == nil && drive.DriveStartDate != nil) {
		hasChanged = true
	}
	drive.DriveStartDate = parsedStart

	var parsedEnd *time.Time
	if endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			parsedEnd = &t
		}
	}
	if (parsedEnd != nil && drive.DriveEndDate == nil) || (parsedEnd == nil && drive.DriveEndDate != nil) {
		hasChanged = true
	}
	drive.DriveEndDate = parsedEnd

	drive.DriveOwnerUserID = ownerID
	drive.UpdatedAt = time.Now()

	err = s.repo.SaveDriveFields(drive, "JobRole", "PlacementType", "PackageLPA", "JobDescription", "DriveOwnerUserID", "DriveStartDate", "DriveEndDate", "BatchIDs", "UpdatedAt")
	if err != nil {
		return nil, err
	}

	// Only log if actual values changed
	if hasChanged {
		if ownerChanged && ownerID != nil {
			ownerName := "Placement Officer"
			var u models.MasterUser
			if err := s.repo.GetDB().Where("id = ?", *ownerID).First(&u).Error; err == nil && u.Name != "" {
				ownerName = u.Name
			}
			ownerLog := models.PlacementDriveActivityLog{
				DriveID:             drive.ID,
				UserID:              ownerID,
				ActivityType:        "DRIVE_OWNER_CHANGED",
				EntityType:          "DRIVE",
				EntityID:            fmt.Sprintf("%d", drive.ID),
				ActivityDescription: fmt.Sprintf("Drive owner changed to %s", ownerName),
				CreatedAt:           time.Now(),
			}
			_ = s.repo.LogActivityWithSuppression(s.repo.GetDB(), &ownerLog)
		} else {
			driveLog := models.PlacementDriveActivityLog{
				DriveID:             drive.ID,
				UserID:              ownerID,
				ActivityType:        "DRIVE_UPDATED",
				EntityType:          "DRIVE",
				EntityID:            fmt.Sprintf("%d", drive.ID),
				ActivityDescription: fmt.Sprintf("Updated placement drive details for %s", drive.JobRole),
				CreatedAt:           time.Now(),
			}
			_ = s.repo.LogActivityWithSuppression(s.repo.GetDB(), &driveLog)
		}
	}

	return s.repo.GetDriveByID(id)
}

// UpdateDriveStatus updates the overall recruitment status and logs the transition
func (s *DriveService) UpdateDriveStatus(id string, overallStatus string) error {
	drive, err := s.repo.GetDriveByID(id)
	if err != nil {
		return err
	}

	oldStatus := drive.OverallStatus
	if oldStatus == overallStatus {
		// No change: do not log or update
		return nil
	}

	if err := s.repo.UpdateStatus(id, overallStatus); err != nil {
		return err
	}

	formatStatusLabel := func(st string) string {
		switch st {
		case "draft":
			return "Draft"
		case "registration_open":
			return "Registration Open"
		case "scheduled":
			return "Scheduled"
		case "in_progress":
			return "In Progress"
		case "awaiting_next_round":
			return "Awaiting Next Round Date"
		case "awaiting_final_result":
			return "Awaiting Final Result"
		case "completed":
			return "Completed"
		case "on_hold":
			return "On Hold"
		case "cancelled":
			return "Cancelled"
		default:
			return st
		}
	}

	actType := "DRIVE_STATUS_CHANGED"
	desc := fmt.Sprintf("Drive status changed from %s to %s", formatStatusLabel(oldStatus), formatStatusLabel(overallStatus))
	if overallStatus == "completed" {
		actType = "DRIVE_COMPLETED"
		desc = "Placement drive marked as completed"
	}

	log := models.PlacementDriveActivityLog{
		DriveID:             drive.ID,
		UserID:              drive.DriveOwnerUserID,
		ActivityType:        actType,
		EntityType:          "DRIVE",
		EntityID:            fmt.Sprintf("%d", drive.ID),
		ActivityDescription: desc,
		CreatedAt:           time.Now(),
	}
	_ = s.repo.LogActivityWithSuppression(s.repo.GetDB(), &log)

	return nil
}

// GetDriveActivities returns activity logs
func (s *DriveService) GetDriveActivities(driveID string) ([]models.PlacementDriveActivityLog, error) {
	return s.repo.GetActivities(driveID)
}

// UpdateDriveEligibility updates or creates eligibility criteria and logs the change
func (s *DriveService) UpdateDriveEligibility(driveID uint64, minCGPA, minTenth, minTwelfth *float64, maxCurrentArr, maxHistArr *int, maxOfferLPA *float64) (*models.PlacementDriveEligibility, error) {
	drive, errDrive := s.repo.GetDriveByID(fmt.Sprintf("%d", driveID))
	if errDrive == nil && drive.OverallStatus == "completed" {
		return nil, errors.New("cannot edit eligibility: placement drive is completed and locked")
	}

	eligibility, err := s.repo.GetEligibility(driveID)
	isNew := err != nil

	eligibility.DriveID = driveID
	eligibility.MinCGPA = minCGPA
	eligibility.MinTenthMark = minTenth
	eligibility.MinTwelfthMark = minTwelfth
	eligibility.MaxCurrentArrears = maxCurrentArr
	eligibility.MaxHistoryArrears = maxHistArr
	eligibility.MaxExistingOfferLPA = maxOfferLPA

	if err := s.repo.SaveEligibility(eligibility, isNew); err != nil {
		return nil, err
	}

	// Create rows in placement_drive_students for eligible candidates
	_, _ = s.repo.PopulateEligibleStudentsForDrive(driveID)

	actType := "ELIGIBILITY_UPDATED"
	desc := "Updated eligibility criteria"
	if isNew {
		actType = "ELIGIBILITY_CONFIGURED"
		if minCGPA != nil {
			desc = fmt.Sprintf("Added eligibility criteria: CGPA ≥ %.1f", *minCGPA)
		} else {
			desc = "Configured eligibility criteria (Open to All Students)"
		}
	} else if minCGPA != nil {
		desc = fmt.Sprintf("Updated eligibility criteria: CGPA ≥ %.1f", *minCGPA)
	}

	var d models.PlacementDrive
	_ = s.repo.GetDB().First(&d, driveID).Error

	log := models.PlacementDriveActivityLog{
		DriveID:             driveID,
		UserID:              d.DriveOwnerUserID,
		ActivityType:        actType,
		EntityType:          "ELIGIBILITY",
		EntityID:            fmt.Sprintf("%d", driveID),
		ActivityDescription: desc,
		CreatedAt:           time.Now(),
	}
	_ = s.repo.LogActivityWithSuppression(s.repo.GetDB(), &log)

	return eligibility, nil
}

// GetDriveEligibleStudents returns evaluated student roster for drive
func (s *DriveService) GetDriveEligibleStudents(driveID uint64) ([]models.StudentEligibilityView, error) {
	return s.repo.GetDriveStudentsList(driveID)
}

// UpdateDriveStudentsRoster manages inclusion, exclusion and special entries
func (s *DriveService) UpdateDriveStudentsRoster(driveID uint64, updates []repositories.StudentRosterUpdateItem) error {
	return s.repo.UpdateDriveStudentsRoster(driveID, updates)
}

// ConfirmDriveStudentRoster confirms student roster and moves included and special entry students to Stage 1
func (s *DriveService) ConfirmDriveStudentRoster(driveID uint64, officerUserID *uint64) (*repositories.ConfirmRosterResult, error) {
	return s.repo.ConfirmDriveStudentRoster(driveID, officerUserID)
}

// GetDriveStages returns all stages for a drive
func (s *DriveService) GetDriveStages(driveID uint64) ([]models.PlacementDriveStage, error) {
	return s.repo.GetDriveStages(driveID)
}

// CreateStage creates a new stage and optional substages
func (s *DriveService) CreateStage(driveID uint64, input repositories.StageCreateInput) (*models.PlacementDriveStage, error) {
	return s.repo.CreateStage(driveID, input)
}

// UpdateStage updates stage details
func (s *DriveService) UpdateStage(stageID uint64, input repositories.StageUpdateInput) (*models.PlacementDriveStage, error) {
	return s.repo.UpdateStage(stageID, input)
}

// CreateSubstage adds a substage to an existing stage
func (s *DriveService) CreateSubstage(stageID uint64, input repositories.SubstageCreateInput) (*models.PlacementDriveSubstage, error) {
	return s.repo.CreateSubstage(stageID, input)
}

// GetStageResults returns student results for a stage/substage
func (s *DriveService) GetStageResults(driveID uint64, stageID uint64, substageID *uint64) ([]models.StageStudentResultView, error) {
	return s.repo.GetStageResults(driveID, stageID, substageID)
}

// UpdateStageResults updates individual or bulk student stage results
func (s *DriveService) UpdateStageResults(officerUserID *uint64, updates []repositories.StudentOutcomeUpdateItem) error {
	return s.repo.UpdateStageResults(officerUserID, updates)
}

// AddSpecialEntryToStage adds students directly to a stage
func (s *DriveService) AddSpecialEntryToStage(driveID uint64, stageID uint64, substageID *uint64, userIDs []uint64, officerUserID *uint64) error {
	return s.repo.AddSpecialEntryToStage(driveID, stageID, substageID, userIDs, officerUserID)
}

// CompleteStage completes a stage and moves cleared students to next stage
func (s *DriveService) CompleteStage(driveID uint64, stageID uint64, officerUserID *uint64) error {
	return s.repo.CompleteStage(driveID, stageID, officerUserID)
}

// UpdateSubstageStatus updates a substage status directly
func (s *DriveService) UpdateSubstageStatus(stageID uint64, substageID uint64, status string) error {
	return s.repo.UpdateSubstageStatus(stageID, substageID, status)
}

// CompleteSubstage completes a substage and moves cleared students to next substage
func (s *DriveService) CompleteSubstage(driveID uint64, stageID uint64, substageID uint64, officerUserID *uint64) error {
	return s.repo.CompleteSubstage(driveID, stageID, substageID, officerUserID)
}





// LogActivityWithSuppression logs an activity with the 30-minute duplicate prevention window
func (s *DriveService) LogActivityWithSuppression(log *models.PlacementDriveActivityLog) error {
	return s.repo.LogActivityWithSuppression(s.repo.GetDB(), log)
}

// CompleteRecruitmentProcess completes all stages and moves drive to final selection stage
func (s *DriveService) CompleteRecruitmentProcess(driveID uint64, officerUserID *uint64) error {
	return s.repo.CompleteRecruitmentProcess(driveID, officerUserID)
}

// GetFinalSelectionData retrieves the final candidates and existing offers
func (s *DriveService) GetFinalSelectionData(driveID uint64) (*models.FinalSelectionData, error) {
	return s.repo.GetFinalSelectionData(driveID)
}

// SaveFinalSelections updates final selection result info and student offers
func (s *DriveService) SaveFinalSelections(
	driveID uint64,
	pubDate *time.Time,
	reference string,
	notes string,
	offers []models.PlacementDriveOffer,
	markCompleted bool,
	officerUserID *uint64,
) error {
	return s.repo.SaveFinalSelections(driveID, pubDate, reference, notes, offers, markCompleted, officerUserID)
}
