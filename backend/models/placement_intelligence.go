package models

// BatchPlacementSummary holds aggregated student and placement metrics per batch from the database
type BatchPlacementSummary struct {
	ID                 uint64 `json:"id"`
	BatchName          string `json:"batch_name"`
	TotalStudents      int64  `json:"total_students"`
	PlacedStudents     int64  `json:"placed_students"`
	NotPlacedStudents  int64  `json:"not_placed_students"`
	NipCount           int64  `json:"nip_count"`
	HigherStudiesCount int64  `json:"higher_studies_count"`
	StartupCount       int64  `json:"startup_count"`
	BusinessCount      int64  `json:"business_count"`
	NotEligibleCount   int64  `json:"not_eligible_count"`
	OffersCount        int64  `json:"offers_count"`
}

// OutcomeGroupSummary holds real counts for each outcome track
type OutcomeGroupSummary struct {
	NotPlacedCount     int64 `json:"not_placed_count"`
	NotEligibleCount   int64 `json:"not_eligible_count"`
	HigherStudiesCount int64 `json:"higher_studies_count"`
	EntrepreneurCount  int64 `json:"entrepreneur_count"`
}

// SalaryScaleBreakdown represents counts across different salary scale tiers
type SalaryScaleBreakdown struct {
	Gt40   int64 `json:"gt40"`   // > ₹40L
	P30_40 int64 `json:"p30_40"` // ₹30–40L
	P20_30 int64 `json:"p20_30"` // ₹20–30L
	P10_20 int64 `json:"p10_20"` // ₹10–20L
	P6_10  int64 `json:"p6_10"`  // ₹6–10L
	P4_6   int64 `json:"p4_6"`   // ₹4–6L
	P3_4   int64 `json:"p3_4"`   // ₹3–4L
}

// BatchOffersSalaryRow is a row in "Number of Offers by Salary Scale"
type BatchOffersSalaryRow struct {
	BatchID       uint64               `json:"batch_id"`
	Batch         string               `json:"batch"`
	TotalStudents int64                `json:"total_students"`
	Offers        SalaryScaleBreakdown `json:"offers"`
}

// BatchUniqueStudentsRow is a row in "Unique Students by Best Offer"
type BatchUniqueStudentsRow struct {
	BatchID          uint64               `json:"batch_id"`
	Batch            string               `json:"batch"`
	Total            int64                `json:"total"`
	Unique           SalaryScaleBreakdown `json:"unique"`
	NotEligible      int64                `json:"not_eligible"`
	Entrepreneurship int64                `json:"entrepreneurship"`
	HigherStudies    int64                `json:"higher_studies"`
	NotPlaced        int64                `json:"not_placed"`
}

// SignalKPIStats holds the summary banner indicators
type SignalKPIStats struct {
	TotalOffers        int64 `json:"total_offers"`
	UniqueOfferHolders int64 `json:"unique_offer_holders"`
	NotYetPlaced       int64 `json:"not_yet_placed"`
	HigherStudies      int64 `json:"higher_studies"`
	Entrepreneurship   int64 `json:"entrepreneurship"`
}

// OverallPlacementStatsResponse is the complete response for center workspace
type OverallPlacementStatsResponse struct {
	Signals               SignalKPIStats           `json:"signals"`
	OffersBySalaryScale   []BatchOffersSalaryRow   `json:"offers_by_salary_scale"`
	UniqueStudentsByOffer []BatchUniqueStudentsRow `json:"unique_students_by_offer"`
}

// IntelligenceOutcomeStudent represents a student belonging to an outcome group
type IntelligenceOutcomeStudent struct {
	ID             uint64  `json:"id"`
	Name           string  `json:"name"`
	RollNo         string  `json:"roll_no"`
	DepartmentID   uint64  `json:"department_id"`
	DepartmentName string  `json:"department_name"`
	DepartmentCode string  `json:"department_code"`
	BatchID        uint64  `json:"batch_id"`
	BatchName      string  `json:"batch_name"`
	CGPA           float64 `json:"cgpa"`
	Status         string  `json:"status"` // "Not Placed", "Higher Studies", "Entrepreneurship", or "₹20 LPA"
	OutcomeGroup   string  `json:"outcome_group"`
	PackageLPA     float64 `json:"package_lpa,omitempty"`
}

// IndustryMetricRow represents a single metric row in Recruiter Network Health
type IndustryMetricRow struct {
	Key    string                 `json:"key"`
	Title  string                 `json:"title"`
	Note   string                 `json:"note"`
	Values map[string]interface{} `json:"values"`
}

// IndustryNetworkHealthSignals holds the top KPI indicators for industries
type IndustryNetworkHealthSignals struct {
	TotalDatabase     int64 `json:"total_database"`
	VisitedRecruiters int64 `json:"visited_recruiters"`
	NewRecruiters     int64 `json:"new_recruiters"`
	MissedRecruiters  int64 `json:"missed_recruiters"`
	GrowthRecruiters  int64 `json:"growth_recruiters"`
	Max3Recruiters    int64 `json:"max3_recruiters"`
}

// IndustryNetworkHealthResponse is the response for Industry Intelligence
type IndustryNetworkHealthResponse struct {
	Signals IndustryNetworkHealthSignals `json:"signals"`
	Batches []string                     `json:"batches"`
	Matrix  []IndustryMetricRow          `json:"matrix"`
}

// IndustryMetricCardStats holds the 6 KPI cards for the right panel
type IndustryMetricCardStats struct {
	TotalActiveRecruiters int64   `json:"total_active_recruiters"` // 1. Total Active Recruiters - placement_company table
	VisitedRecruiters     int64   `json:"visited_recruiters"`       // 2. Visited Recruiters - placement_drive
	OngoingRecruitments   int64   `json:"ongoing_recruitments"`     // 3. Ongoing recruitments - placement_drive
	CompletedRecruitments int64   `json:"completed_recruitments"`   // 4. Completed recruitments - placement_company_batch_placements
	NewRecruiters         int64   `json:"new_recruiters"`           // 5. New Recruiters
	HighestOfferLPA       float64 `json:"highest_offer_lpa"`        // 6. Highest Offer - in this batch
}

// AttentionRecruiter represents companies that participated in previous year but have not started a drive this year
type AttentionRecruiter struct {
	CompanyID          int64   `json:"company_id"`
	CompanyName        string  `json:"company_name"`
	Category           string  `json:"category"`
	CompanyDomain      string  `json:"company_domain"`
	CollaborationType  string  `json:"collaboration_type"`
	LastYearBatch      string  `json:"last_year_batch"`
	LastYearPlacements int64   `json:"last_year_placements"`
	LastYearPackageLPA float64 `json:"last_year_package_lpa"`
}

// TopRecruiterItem represents a ranked company by salary or students count
type TopRecruiterItem struct {
	Rank          int     `json:"rank"`
	CompanyID     int64   `json:"company_id"`
	CompanyName   string  `json:"company_name"`
	Category      string  `json:"category"`
	CompanyDomain string  `json:"company_domain"`
	JobRole       string  `json:"job_role,omitempty"`
	PackageLPA    float64 `json:"package_lpa"`
	StudentsCount int64   `json:"students_count"`
}

// RecentRecruitmentActivity represents historical activity logs for drives in this batch
type RecentRecruitmentActivity struct {
	ID                  uint64 `json:"id"`
	DriveID             uint64 `json:"drive_id"`
	CompanyID           int64  `json:"company_id"`
	CompanyName         string `json:"company_name"`
	JobRole             string `json:"job_role"`
	ActivityDescription string `json:"activity_description"`
	CreatedAt           string `json:"created_at"`
	TimeAgo             string `json:"time_ago"`
}

// IndustryRightPanelResponse is the response payload for the industry intelligence right panel
type IndustryRightPanelResponse struct {
	SelectedBatch        string                      `json:"selected_batch"`
	Cards                IndustryMetricCardStats     `json:"cards"`
	AttentionRecruiters  []AttentionRecruiter        `json:"attention_recruiters"`
	TopRecruitersSalary  []TopRecruiterItem          `json:"top_recruiters_salary"`
	TopRecruitersCount   []TopRecruiterItem          `json:"top_recruiters_count"`
	RecentActivities     []RecentRecruitmentActivity `json:"recent_activities"`
}

// IndustryMetricCompanyDetail represents a company returned when inspecting a metric cell or KPI card
type IndustryMetricCompanyDetail struct {
	CompanyID         int64   `json:"company_id"`
	DriveID           uint64  `json:"drive_id,omitempty"`
	CompanyName       string  `json:"company_name"`
	Category          string  `json:"category"`
	CompanyDomain     string  `json:"company_domain,omitempty"`
	CollaborationType string  `json:"collaboration_type"`
	DriveStatus       string  `json:"drive_status"`
	StudentsPlaced    int64   `json:"students_placed"`
	OffersCount       int64   `json:"offers_count"`
	PackageLPA        float64 `json:"package_lpa"`
	JobRoles          string  `json:"job_roles,omitempty"`
	FirstVisitedBatch string  `json:"first_visited_batch,omitempty"`
	LastVisitedBatch  string  `json:"last_visited_batch,omitempty"`
	ContextNote       string  `json:"context_note,omitempty"`
}

// IndustryMetricCompaniesResponse is the response payload for company drilldown
type IndustryMetricCompaniesResponse struct {
	MetricKey    string                        `json:"metric_key"`
	MetricTitle  string                        `json:"metric_title"`
	Batch        string                        `json:"batch"`
	TotalCount   int                           `json:"total_count"`
	Companies    []IndustryMetricCompanyDetail `json:"companies"`
}

// CompanyDriveStageItem represents one stage in the recruitment pipeline
type CompanyDriveStageItem struct {
	Step        int    `json:"step"`        // 1, 2, 3...
	Label       string `json:"label"`       // "Registered", "Eligible", "Assessment", "Technical", "Interview", "Offers"
	Value       int64  `json:"value"`       // Student count
	Active      bool   `json:"active"`      // Highlighted active stage
	StageStatus string `json:"stage_status,omitempty"`
}

// CompanyRecruitmentDrivePhase represents a single drive/phase in a placement year
type CompanyRecruitmentDrivePhase struct {
	DriveID          uint64                  `json:"drive_id"`
	Title            string                  `json:"title"`             // e.g. "Product Engineering · Phase 1"
	PhaseName        string                  `json:"phase_name"`        // "Phase 1"
	JobRole          string                  `json:"job_role"`          // "Product Engineering"
	Date             string                  `json:"date"`              // "18 Aug 2026"
	Departments      []string                `json:"departments"`       // ["CSE", "IT", "AI & ML", "ECE"]
	PackageLPA       float64                 `json:"package_lpa"`       // 44
	OverallStatus    string                  `json:"overall_status"`    // "Completed", "In Progress", "Draft", etc.
	StatusBadgeClass string                  `json:"status_badge_class"`// Styling badge
	OffersCount      int64                   `json:"offers_count"`
	Stages           []CompanyDriveStageItem `json:"stages"`
}

// CompanyPlacementYearGroup groups drives under a placement year
type CompanyPlacementYearGroup struct {
	Year        string                         `json:"year"`         // "2027"
	PhasesCount int                            `json:"phases_count"` // 2
	TotalOffers int64                          `json:"total_offers"` // 13
	Drives      []CompanyRecruitmentDrivePhase `json:"drives"`
}

// CompanyBasicInfo contains primary recruiter metadata
type CompanyBasicInfo struct {
	ID                int64  `json:"id"`
	CompanyName       string `json:"company_name"`
	Category          string `json:"category"`
	CompanyDomain     string `json:"company_domain"`
	CollaborationType string `json:"collaboration_type"`
}

// CompanyDriveFilterOptions provides distinct available filter values for the UI
type CompanyDriveFilterOptions struct {
	Batches     []string `json:"batches"`
	Roles       []string `json:"roles"`
	Departments []string `json:"departments"`
}

// CompanyRecruitmentDrivesResponse is the full response for a selected company's recruitment history
type CompanyRecruitmentDrivesResponse struct {
	Company       CompanyBasicInfo            `json:"company"`
	FilterOptions CompanyDriveFilterOptions   `json:"filter_options"`
	Years         []CompanyPlacementYearGroup `json:"years"`
	TotalDrives   int                         `json:"total_drives"`
	TotalOffers   int64                       `json:"total_offers"`
}


