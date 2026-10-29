package models

import (
	"time"
)

type MasterUser struct {
	ID           uint64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name         string  `gorm:"size:150;not null" json:"name"`
	Email        string  `gorm:"size:255;not null;unique" json:"email"`
	DepartmentID *uint64 `json:"department_id"`
	RoleID       uint64  `gorm:"not null" json:"role_id"`
	BatchID      *uint64 `json:"batch_id"`
}

func (MasterUser) TableName() string {
	return "master_users"
}

type PlacementCompany struct {
	ID                int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	CompanyCode       string    `gorm:"size:30" json:"company_code"`
	CompanyName       string    `gorm:"size:200;not null" json:"company_name"`
	CollaborationType string    `gorm:"type:enum('ACTIVE','INACTIVE','NEW')" json:"collaboration_type"`
	ContactStatus     string    `gorm:"type:enum('CONTACTED','NOT_CONTACTED')" json:"contact_status"`
	Category          string    `gorm:"type:enum('PRODUCT','SERVICE','CORE_FINANCE','NETWORKING','HEALTHCARE')" json:"category"`
	RecruitingQuarter string    `gorm:"type:enum('Q1','Q2','Q3','Q4','NA')" json:"recruiting_quarter"`
	EmployeeSize      string    `json:"employee_size"`
	FoundedYear       int       `json:"founded_year"`
	Spoc1Name         string    `gorm:"size:150" json:"spoc1_name"`
	Spoc1Email        string    `gorm:"size:150" json:"spoc1_email"`
	Spoc1Contact      string    `gorm:"size:20" json:"spoc1_contact"`
	Spoc2Name         string    `gorm:"size:150" json:"spoc2_name"`
	Spoc2Email        string    `gorm:"size:150" json:"spoc2_email"`
	Spoc2Contact      string    `gorm:"size:20" json:"spoc2_contact"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	Status            string    `gorm:"type:enum('0','1');default:'1'" json:"status"`
}

func (PlacementCompany) TableName() string {
	return "placement_company"
}

type PlacementDriveEligibility struct {
	ID                  uint64   `gorm:"primaryKey;autoIncrement" json:"id"`
	DriveID             uint64   `gorm:"not null;uniqueIndex" json:"drive_id"`
	MinCGPA             *float64 `gorm:"type:decimal(4,2)" json:"min_cgpa"`
	MinTenthMark        *float64 `gorm:"type:decimal(5,2)" json:"min_tenth_mark"`
	MinTwelfthMark      *float64 `gorm:"type:decimal(5,2)" json:"min_twelfth_mark"`
	MaxCurrentArrears   *int     `json:"max_current_arrears"`
	MaxHistoryArrears   *int     `json:"max_history_arrears"`
	MaxExistingOfferLPA *float64 `gorm:"type:decimal(8,2)" json:"max_existing_offer_lpa"`
}

func (PlacementDriveEligibility) TableName() string {
	return "placement_drive_eligibility"
}

type PlacementDriveStats struct {
	InitiallyEligible  int64 `json:"initially_eligible"`
	IncludedInDrive    int64 `json:"included_in_drive"`
	ReachedFinalStage  int64 `json:"reached_final_stage"`
	AwaitingFinalResult int64 `json:"awaiting_final_result"`
	NotClearedAbsent   int64 `json:"not_cleared_absent"`
}

type PlacementDrive struct {
	ID                    uint64                     `gorm:"primaryKey;autoIncrement" json:"id"`
	CompanyID             int64                      `gorm:"not null" json:"company_id"`
	Company               *PlacementCompany          `gorm:"foreignKey:CompanyID" json:"company,omitempty"`
	JobRole               string                     `gorm:"size:200;not null" json:"job_role"`
	PlacementType         string                     `gorm:"size:100;not null" json:"placement_type"`
	PackageLPA            float64                    `gorm:"type:decimal(8,2)" json:"package_lpa"`
	DriveStartDate        *time.Time                 `json:"drive_start_date"`
	DriveEndDate          *time.Time                 `json:"drive_end_date"`
	DriveOwnerUserID      *uint64                    `json:"drive_owner_user_id"`
	DriveOwnerUser        *MasterUser                `gorm:"foreignKey:DriveOwnerUserID" json:"drive_owner_user,omitempty"`
	JobDescription        string                     `gorm:"type:text" json:"job_description"`
	OverallStatus         string                     `gorm:"type:enum('draft','registration_open','scheduled','in_progress','awaiting_next_round','awaiting_final_result','completed','on_hold','cancelled');default:'draft'" json:"overall_status"`
	ResultPublicationDate *time.Time                 `json:"result_publication_date"`
	ResultReference       string                     `gorm:"size:255" json:"result_reference"`
	ResultNotes           string                     `gorm:"type:text" json:"result_notes"`
	CreatedAt             time.Time                  `json:"created_at"`
	UpdatedAt             time.Time                  `json:"updated_at"`
	BatchID               *uint64                    `json:"batch_id"`
	Batch                 *Batch                     `gorm:"foreignKey:BatchID" json:"batch,omitempty"`

	Stages      []PlacementDriveStage      `gorm:"foreignKey:DriveID" json:"stages,omitempty"`
	Eligibility *PlacementDriveEligibility `gorm:"foreignKey:DriveID" json:"eligibility,omitempty"`
	Stats       PlacementDriveStats        `gorm:"-" json:"stats"`

	TotalStudents   int64  `gorm:"-" json:"total_students"`
	PendingOutcomes int64  `gorm:"-" json:"pending_outcomes"`
	SubtitleMeta    string `gorm:"-" json:"subtitle_meta"`
	StatusGroup     string `gorm:"-" json:"status_group"`
}

func (PlacementDrive) TableName() string {
	return "placement_drive"
}

type PlacementDriveStage struct {
	ID            uint64                   `gorm:"primaryKey;autoIncrement" json:"id"`
	DriveID       uint64                   `gorm:"not null" json:"drive_id"`
	StageName     string                   `gorm:"size:150;not null" json:"stage_name"`
	SequenceNo    int                      `gorm:"not null" json:"sequence_no"`
	ScheduledDate *time.Time               `json:"scheduled_date"`
	CompletedAt   *time.Time               `json:"completed_at"`
	Substages     []PlacementDriveSubstage `gorm:"foreignKey:StageID" json:"substages,omitempty"`
}

func (PlacementDriveStage) TableName() string {
	return "placement_drive_stages"
}

type PlacementDriveSubstage struct {
	ID           uint64 `gorm:"primaryKey;autoIncrement" json:"id"`
	StageID      uint64 `gorm:"not null" json:"stage_id"`
	SubstageName string `gorm:"size:150;not null" json:"substage_name"`
	SequenceNo   int    `gorm:"not null" json:"sequence_no"`
}

func (PlacementDriveSubstage) TableName() string {
	return "placement_drive_substages"
}

type PlacementDriveStudent struct {
	ID         uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	DriveID    uint64      `gorm:"not null" json:"drive_id"`
	UserID     uint64      `gorm:"not null" json:"user_id"`
	User       *MasterUser `gorm:"foreignKey:UserID" json:"user,omitempty"`
	IncludedAt time.Time   `json:"included_at"`
	Notes      string      `gorm:"type:text" json:"notes"`
}

func (PlacementDriveStudent) TableName() string {
	return "placement_drive_students"
}

type PlacementStageResult struct {
	ID             uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DriveStudentID uint64     `gorm:"not null" json:"drive_student_id"`
	StageID        uint64     `gorm:"not null" json:"stage_id"`
	SubstageID     *uint64    `json:"substage_id"`
	Outcome        string     `gorm:"type:enum('pending','cleared','not_cleared','absent','withdrawn');default:'pending'" json:"outcome"`
	Score          *float64   `gorm:"type:decimal(8,2)" json:"score"`
	Remarks        string     `gorm:"type:text" json:"remarks"`
	UpdatedBy      *uint64    `json:"updated_by"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func (PlacementStageResult) TableName() string {
	return "placement_stage_results"
}

type PlacementDriveActivityLog struct {
	ID                  uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	DriveID             uint64      `gorm:"not null" json:"drive_id"`
	UserID              *uint64     `json:"user_id"`
	User                *MasterUser `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ActivityDescription string      `gorm:"size:500;not null" json:"activity_description"`
	CreatedAt           time.Time   `json:"created_at"`
}

func (PlacementDriveActivityLog) TableName() string {
	return "placement_drive_activity_log"
}
