package models

// StudentReviewStats holds the 6 key stat card metrics requested for the right panel
type StudentReviewStats struct {
	Invitations   int64  `json:"invitations"`    // count of records in placement_drive_students
	Accepted      int64  `json:"accepted"`       // count in placement_stage_results where outcome IN ('cleared', 'not_cleared') (Attended)
	Processes     int64  `json:"processes"`      // count in placement_stage_results where outcome = 'pending'
	FinalMisses   int64  `json:"final_misses"`   // count of drives where student reached final round but missed offer
	Offers        int64  `json:"offers"`         // count in placement_drive_offers
	RoundsCleared int64  `json:"rounds_cleared"` // count of stages with outcome = 'cleared'
	TotalRounds   int64  `json:"total_rounds"`   // total rounds evaluated
	RoundsText    string `json:"rounds_text"`    // formatted string e.g. "10 of 16"
}

// StudentReviewNoteItem represents a single recommendation note entry
type StudentReviewNoteItem struct {
	ID         uint64 `json:"id"`
	Note       string `json:"note"`
	AuthorName string `json:"author_name"`
	CreatedAt  string `json:"created_at"`
}

// OpportunityScoreData holds the 2-metric calculation, priority level, reasons, and review notes
type OpportunityScoreData struct {
	EligibleCompanies    int64                   `json:"eligible_companies"`
	CompaniesAttended    int64                   `json:"companies_attended"`
	AttendancePercentage float64                 `json:"attendance_percentage"`
	TotalRoundsAttended  int64                   `json:"total_rounds_attended"`
	RoundsCleared        int64                   `json:"rounds_cleared"`
	RoundsClearedPct     float64                 `json:"rounds_cleared_pct"`
	PendingRounds        int64                   `json:"pending_rounds"`
	Score                float64                 `json:"score"`
	PriorityLevel        string                  `json:"priority_level"` // "High", "Mid", "Low", "Needs Improvement & Interest"
	Reasons              []string                `json:"reasons"`
	Notes                []StudentReviewNoteItem `json:"notes"`                // All notes listed in order
	RecommendationNote   string                  `json:"recommendation_note"` // Latest note for fallback
	RecommendationAuthor string                  `json:"recommendation_author"`
	RecommendationDate   string                  `json:"recommendation_date"`
	HasInsufficientData  bool                    `json:"has_insufficient_data"`
}

// StudentReviewOfferItem holds details of an offer received by the student
type StudentReviewOfferItem struct {
	OfferID     uint64   `json:"offer_id"`
	CompanyCode string   `json:"company_code"`
	CompanyName string   `json:"company_name"`
	Role        string   `json:"role"`
	PackageLPA  *float64 `json:"package_lpa"`
	Status      string   `json:"status"` // "Accepted", "Offered", etc.
}

// StudentReviewDetail holds student metadata, placed badge, category badge, stats cards, and opportunity priority
type StudentReviewDetail struct {
	UserID           uint64                   `json:"user_id"`
	Name             string                   `json:"name"`
	RollNo           string                   `json:"roll_no"`
	DepartmentName   string                   `json:"department_name"`
	DepartmentCode   string                   `json:"department_code"`
	BatchName        string                   `json:"batch_name"`
	CGPA             *float64                 `json:"cgpa"`
	TenthMark        *float64                 `json:"tenth_mark"`
	TwelfthMark      *float64                 `json:"twelfth_mark"`
	CurrentArrears   int                      `json:"current_arrears"`
	HistoryOfArrears int                      `json:"history_of_arrears"`
	IsPlaced         bool                     `json:"is_placed"`       // offers > 0
	CategoryBadge    string                   `json:"category_badge"` // "NIP", "Core", "Software"
	StudentType      string                   `json:"student_type"`   // "nip", "ip"
	Stats            StudentReviewStats       `json:"stats"`
	Offers           []StudentReviewOfferItem `json:"offers"`
	Opportunity      OpportunityScoreData     `json:"opportunity"`
}

