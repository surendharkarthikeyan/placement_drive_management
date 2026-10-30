package services

import (
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

	return drive, nil
}

// CreateDrive creates a new drive adhering to MySQL schema constraints
func (s *DriveService) CreateDrive(companyName, jobRole, placementType string, packageLPA float64, startDate, endDate string, ownerID *uint64, jobDescription string, batchIDs []uint64) (*models.PlacementDrive, error) {
	company, err := s.repo.FindOrCreateCompany(companyName)
	if err != nil {
		return nil, fmt.Errorf("failed to create or find company: %v", err)
	}

	dbPlacementType := "Full-time Placment"
	switch placementType {
	case "Internship + PPO":
		dbPlacementType = "Internship + PPO"
	case "Internship":
		dbPlacementType = "Internship"
	case "Apprenticeship":
		dbPlacementType = "Apprenticeship"
	default:
		dbPlacementType = "Full-time Placment"
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

	// If no batch was selected ("Open to All"), explicitly write all existing batch IDs (never null)
	if len(batchIDs) == 0 {
		if allIDs, err := s.repo.GetAllBatchIDs(); err == nil && len(allIDs) > 0 {
			batchIDs = allIDs
		}
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
		ActivityDescription: fmt.Sprintf("Drive record created in draft status for %s", jobRole),
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

	drive.DriveOwnerUserID = ownerID
	if jobRole != "" {
		drive.JobRole = jobRole
	}
	if placementType != "" {
		drive.PlacementType = placementType
	}
	if packageLPA > 0 {
		drive.PackageLPA = packageLPA
	}
	drive.JobDescription = jobDescription
	if len(batchIDs) > 0 {
		drive.BatchIDs = models.Uint64Array(batchIDs)
	}

	if startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			drive.DriveStartDate = &t
		}
	} else {
		drive.DriveStartDate = nil
	}

	if endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			drive.DriveEndDate = &t
		}
	} else {
		drive.DriveEndDate = nil
	}

	drive.UpdatedAt = time.Now()
	err = s.repo.SaveDriveFields(drive, "JobRole", "PlacementType", "PackageLPA", "JobDescription", "DriveOwnerUserID", "DriveStartDate", "DriveEndDate", "BatchIDs", "UpdatedAt")
	if err != nil {
		return nil, err
	}

	log := models.PlacementDriveActivityLog{
		DriveID:             drive.ID,
		UserID:              drive.DriveOwnerUserID,
		ActivityDescription: fmt.Sprintf("Updated drive setup information for %s", drive.JobRole),
		CreatedAt:           time.Now(),
	}
	s.repo.CreateActivityLog(&log)

	return s.repo.GetDriveByID(id)
}

// UpdateDriveStatus updates the overall recruitment status
func (s *DriveService) UpdateDriveStatus(id string, overallStatus string) error {
	return s.repo.UpdateStatus(id, overallStatus)
}

// GetDriveActivities returns activity logs
func (s *DriveService) GetDriveActivities(driveID string) ([]models.PlacementDriveActivityLog, error) {
	return s.repo.GetActivities(driveID)
}

// UpdateDriveEligibility updates or creates eligibility criteria
func (s *DriveService) UpdateDriveEligibility(driveID uint64, minCGPA, minTenth, minTwelfth *float64, maxCurrentArr, maxHistArr *int, maxOfferLPA *float64) (*models.PlacementDriveEligibility, error) {
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

