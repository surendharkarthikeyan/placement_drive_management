package models

import "time"

type PlacementDriveOffer struct {
	ID              uint64                 `gorm:"primaryKey;autoIncrement" json:"id"`
	DriveStudentID  uint64                 `gorm:"not null" json:"drive_student_id"`
	FinalRole       *string                `gorm:"size:200" json:"final_role"`
	PackageLPA      *float64               `gorm:"type:decimal(8,2)" json:"package_lpa"`
	ConfirmedAt     *time.Time             `json:"confirmed_at"`
	ResultReference *string                `gorm:"size:255" json:"result_reference"`
	Notes           *string                `gorm:"type:text" json:"notes"`
	OfferLetterFile *string                `gorm:"size:255" json:"offer_letter_file"`
	CreatedAt       time.Time              `json:"created_at"`
	DriveStudent    *PlacementDriveStudent `gorm:"foreignKey:DriveStudentID" json:"drive_student,omitempty"`
}

func (PlacementDriveOffer) TableName() string {
	return "placement_drive_offers"
}

type FinalSelectionStudentItem struct {
	DriveStudentID  uint64   `json:"drive_student_id"`
	UserID          uint64   `json:"user_id"`
	Name            string   `json:"name"`
	RollNo          string   `json:"roll_no"`
	DepartmentName  string   `json:"department_name"`
	Outcome         string   `json:"outcome"`
	FinalRole       string   `json:"final_role"`
	PackageLPA      *float64 `json:"package_lpa"`
	OfferLetterFile *string  `json:"offer_letter_file,omitempty"`
}

type FinalSelectionData struct {
	DriveID                uint64                      `json:"drive_id"`
	OverallStatus          string                      `json:"overall_status"`
	ResultPublicationDate  *string                     `json:"result_publication_date"`
	ResultReference        string                      `json:"result_reference"`
	ResultNotes            string                      `json:"result_notes"`
	CompanyCode            string                      `json:"company_code"`
	CompanyName            string                      `json:"company_name"`
	DefaultRole            string                      `json:"default_role"`
	DefaultPackageLPA      float64                     `json:"default_package_lpa"`
	Students               []FinalSelectionStudentItem `json:"students"`
	TotalFinalCandidates   int                         `json:"total_final_candidates"`
	ClearedCandidatesCount int                         `json:"cleared_candidates_count"`
}
