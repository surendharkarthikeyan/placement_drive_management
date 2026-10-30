package models

type PlacementStudentBasicDetails struct {
	ID                 int64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID             uint64   `gorm:"not null" json:"user_id"`
	SchoolPercentage   *float64 `gorm:"type:decimal(5,2)" json:"school_percentage"`
	TenthMark          *float64 `gorm:"column:tenth_mark;type:decimal(6,2)" json:"tenth_mark"`
	TwelfthMark        *float64 `gorm:"column:twelth_mark;type:decimal(6,2)" json:"twelfth_mark"`
	CGPA               *float64 `gorm:"type:decimal(4,2)" json:"cgpa"`
	AdmissionQuota     string   `gorm:"type:enum('GQ','MQ')" json:"admission_quota"`
	NIP                string   `gorm:"type:enum('0','1');default:'0'" json:"nip"`
	IP                 string   `gorm:"type:enum('0','1');default:'0'" json:"ip"`
	CurrentArrearCount int      `gorm:"default:0" json:"current_arrear_count"`
	HistoryArrearCount int      `gorm:"default:0" json:"history_arrear_count"`
	HigherStudies      string   `gorm:"type:enum('0','1');default:'0'" json:"higher_studies"`
	Startup            string   `gorm:"type:enum('0','1');default:'0'" json:"startup"`
	Business           string   `gorm:"type:enum('0','1');default:'0'" json:"business"`
	SoftwareCompany    string   `gorm:"type:enum('0','1');default:'0'" json:"software_company"`
	CoreCompany        string   `gorm:"type:enum('0','1');default:'0'" json:"core_company"`
}

func (PlacementStudentBasicDetails) TableName() string {
	return "placement_student_basic_details"
}

// StudentEligibilityView represents a student with academic metrics and eligibility status for a drive
type StudentEligibilityView struct {
	UserID             uint64   `json:"user_id"`
	RollNo             *string  `json:"roll_no"`
	Name               string   `json:"name"`
	Email              string   `json:"email"`
	DepartmentName     string   `json:"department_name"`
	BatchName          string   `json:"batch_name"`
	CGPA               *float64 `json:"cgpa"`
	TenthMark          *float64 `json:"tenth_mark"`
	TwelfthMark        *float64 `json:"twelfth_mark"`
	CurrentArrearCount int      `json:"current_arrear_count"`
	HistoryArrearCount int      `json:"history_arrear_count"`
	MaxExistingOffer   *float64 `json:"max_existing_offer"`
	IsEligible         bool     `json:"is_eligible"`
	IneligibleReasons  []string `json:"ineligible_reasons"`
	IsIncludedInDrive  bool     `json:"is_included_in_drive"`
	DriveStatus        string   `json:"drive_status"`    // 'included', 'special_entry', 'excluded', or ''
	HasRosterRecord    bool     `json:"has_roster_record"` // whether user already has a record in placement_drive_students
}

type Batch struct {
	ID   uint64 `gorm:"primaryKey;autoIncrement" json:"id"`
	Name string `gorm:"size:50;not null;unique" json:"name"`
}

func (Batch) TableName() string {
	return "batches"
}

