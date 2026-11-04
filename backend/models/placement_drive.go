package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

type Uint64Array []uint64

func (a Uint64Array) Value() (driver.Value, error) {
	if a == nil {
		return "[]", nil
	}
	return json.Marshal(a)
}

func (a *Uint64Array) Scan(value interface{}) error {
	if value == nil {
		*a = []uint64{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return errors.New("cannot scan type into Uint64Array")
	}
	return json.Unmarshal(bytes, a)
}

type MasterUser struct {
	ID           uint64  `gorm:"primaryKey;autoIncrement" json:"id"`
	RollNo       *string `gorm:"size:20" json:"roll_no"`
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
	InitiallyEligible   int64 `json:"initially_eligible"`
	IncludedInDrive     int64 `json:"included_in_drive"`
	ReachedFinalStage   int64 `json:"reached_final_stage"`
	AwaitingFinalResult int64 `json:"awaiting_final_result"`
	NotClearedAbsent    int64 `json:"not_cleared_absent"`
	OfferedStudents     int64 `json:"offered_students"`
}

type CheckpointDetail struct {
	Index       int     `json:"index"`
	Title       string  `json:"title"`
	Weightage   float64 `json:"weightage"`
	Earned      float64 `json:"earned"`
	IsCompleted bool    `json:"is_completed"`
	Detail      string  `json:"detail"`
}

type DataCompletionStats struct {
	OverallPercentage int                `json:"overall_percentage"`
	TotalEarned       float64            `json:"total_earned"`
	Checkpoints       []CheckpointDetail `json:"checkpoints"`
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
	BatchIDs              Uint64Array                `gorm:"column:batch_id;type:json" json:"batch_ids"`
	Batches               []Batch                    `gorm:"-" json:"batches,omitempty"`

	Stages      []PlacementDriveStage      `gorm:"foreignKey:DriveID" json:"stages,omitempty"`
	Eligibility *PlacementDriveEligibility `gorm:"foreignKey:DriveID" json:"eligibility,omitempty"`
	Stats       PlacementDriveStats        `gorm:"-" json:"stats"`
	DataCompletion *DataCompletionStats    `gorm:"-" json:"data_completion,omitempty"`

	TotalStudents   int64  `gorm:"-" json:"total_students"`
	PendingOutcomes int64  `gorm:"-" json:"pending_outcomes"`
	SubtitleMeta    string `gorm:"-" json:"subtitle_meta"`
	StatusGroup     string `gorm:"-" json:"status_group"`
	RosterConfirmed bool   `gorm:"-" json:"roster_confirmed"`
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
	InternalNotes string                   `gorm:"type:text" json:"internal_notes"`
	StageStatus   string                   `gorm:"type:enum('pending','pending_date_not_announced','scheduled','in_progress','awaiting_result','completed');default:'pending'" json:"stage_status"`
	Substages     []PlacementDriveSubstage `gorm:"foreignKey:StageID" json:"substages,omitempty"`

	ParticipantsCount int64 `gorm:"-" json:"participants_count"`
	ClearedCount      int64 `gorm:"-" json:"cleared_count"`
}

func (PlacementDriveStage) TableName() string {
	return "placement_drive_stages"
}

type PlacementDriveSubstage struct {
	ID             uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	StageID        uint64     `gorm:"not null" json:"stage_id"`
	SubstageName   string     `gorm:"size:150;not null" json:"substage_name"`
	SequenceNo     int        `gorm:"not null" json:"sequence_no"`
	ScheduledDate  *time.Time `json:"scheduled_date"`
	SubstageStatus string     `gorm:"type:enum('pending','pending_date_not_announced','scheduled','in_progress','awaiting_result','completed');default:'pending'" json:"substage_status"`
	InternalNotes  string     `gorm:"type:text" json:"internal_notes"`

	ParticipantsCount int64 `gorm:"-" json:"participants_count"`
	ClearedCount      int64 `gorm:"-" json:"cleared_count"`
}

func (PlacementDriveSubstage) TableName() string {
	return "placement_drive_substages"
}

type PlacementDriveStudent struct {
	ID          uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	DriveID     uint64      `gorm:"not null" json:"drive_id"`
	UserID      uint64      `gorm:"not null" json:"user_id"`
	DriveStatus string      `gorm:"type:enum('included','excluded','special_entry');default:'included'" json:"drive_status"`
	User        *MasterUser `gorm:"foreignKey:UserID" json:"user,omitempty"`
	IncludedAt  time.Time   `json:"included_at"`
	Notes       string      `gorm:"type:text" json:"notes"`
}

func (PlacementDriveStudent) TableName() string {
	return "placement_drive_students"
}

type PlacementStageResult struct {
	ID                  uint64                 `gorm:"primaryKey;autoIncrement" json:"id"`
	DriveStudentID      uint64                 `gorm:"not null" json:"drive_student_id"`
	StageID             uint64                 `gorm:"not null" json:"stage_id"`
	SubstageID          *uint64                `json:"substage_id"`
	PreviousStageStatus string                 `gorm:"type:enum('cleared','spl_entry');default:'cleared'" json:"previous_stage_status"`
	Outcome             string                 `gorm:"type:enum('pending','cleared','not_cleared','absent','withdrawn');default:'pending'" json:"outcome"`
	Score               *float64               `gorm:"type:decimal(8,2)" json:"score"`
	Remarks             string                 `gorm:"type:text" json:"remarks"`
	UpdatedBy           *uint64                `json:"updated_by"`
	Updater             *MasterUser            `gorm:"foreignKey:UpdatedBy" json:"updater,omitempty"`
	DriveStudent        *PlacementDriveStudent `gorm:"foreignKey:DriveStudentID" json:"drive_student,omitempty"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
}

func (PlacementStageResult) TableName() string {
	return "placement_stage_results"
}

type PlacementDriveActivityLog struct {
	ID                  uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	DriveID             uint64      `gorm:"not null" json:"drive_id"`
	UserID              *uint64     `json:"user_id"`
	User                *MasterUser `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ActivityType        string      `gorm:"size:50" json:"activity_type,omitempty"`
	EntityType          string      `gorm:"size:50" json:"entity_type,omitempty"`
	EntityID            string      `gorm:"size:50" json:"entity_id,omitempty"`
	ActivityDescription string      `gorm:"size:500;not null" json:"activity_description"`
	CreatedAt           time.Time   `json:"created_at"`
}

func (PlacementDriveActivityLog) TableName() string {
	return "placement_drive_activity_log"
}

// PlacementCompanyBatchPlacement records the number of students placed per participating batch for a completed drive
type PlacementCompanyBatchPlacement struct {
	ID             uint64 `gorm:"primaryKey;autoIncrement" json:"id"`
	CompanyID      int64  `gorm:"column:company_id;not null" json:"company_id"`
	DriveID        uint64 `gorm:"column:drive_id;not null" json:"drive_id"`
	Batch          string `gorm:"column:batch;size:9;not null" json:"batch"`
	StudentsPlaced int    `gorm:"column:students_placed;default:0" json:"students_placed"`
	Status         string `gorm:"column:status;type:enum('0','1');default:'1'" json:"status"`
}

func (PlacementCompanyBatchPlacement) TableName() string {
	return "placement_company_batch_placements"
}
