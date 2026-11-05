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
	TotalDatabase    int64 `json:"total_database"`
	NewRecruiters    int64 `json:"new_recruiters"`
	MissedRecruiters int64 `json:"missed_recruiters"`
	GrowthRecruiters int64 `json:"growth_recruiters"`
	Max3Recruiters   int64 `json:"max3_recruiters"`
}

// IndustryNetworkHealthResponse is the response for Industry Intelligence
type IndustryNetworkHealthResponse struct {
	Signals IndustryNetworkHealthSignals `json:"signals"`
	Batches []string                     `json:"batches"`
	Matrix  []IndustryMetricRow          `json:"matrix"`
}

