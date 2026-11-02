package models

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

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

// StudentRecruitmentHistoryItem represents a single company recruitment entry
type StudentRecruitmentHistoryItem struct {
	DriveID         uint64 `json:"drive_id"`
	DriveStudentID  uint64 `json:"drive_student_id"`
	CompanyName     string `json:"company_name"`
	CompanyCode     string `json:"company_code"`
	JobRole         string `json:"job_role"`
	Status          string `json:"status"` // "Offered", "In Process", "Failed / Cancelled"
	RoundName       string `json:"round_name"`
	RoundNumber     int    `json:"round_number"`
	RoundDetailText string `json:"round_detail_text"`
	Timestamp       string `json:"timestamp"`
	DateFormatted   string `json:"date_formatted"`
}

// StudentRecruitmentHistoryResponse represents the paginated response for recruitment history
type StudentRecruitmentHistoryResponse struct {
	Items       []StudentRecruitmentHistoryItem `json:"items"`
	TotalCount  int                             `json:"total_count"`
	CurrentPage int                             `json:"current_page"`
	TotalPages  int                             `json:"total_pages"`
	Limit       int                             `json:"limit"`
}

// StudentProcessRound represents an individual round attended by the student in a company process
type StudentProcessRound struct {
	RoundIndex int      `json:"round_index"`
	RoundName  string   `json:"round_name"`
	Outcome    string   `json:"outcome"`
	IsCleared  bool     `json:"is_cleared"`
	Score      *float64 `json:"score,omitempty"`
}

// StudentCompanyProcessItem represents a company-wise recruitment process card
type StudentCompanyProcessItem struct {
	DriveID       uint64                `json:"drive_id"`
	CompanyName   string                `json:"company_name"`
	JobRole       string                `json:"job_role"`
	PackageLPA    *float64              `json:"package_lpa"`
	OverallStatus string                `json:"overall_status"` // "Offered" or "Failed"
	StatusText    string                `json:"status_text"`    // "Offered", "Final round failed", etc.
	FailedRound   string                `json:"failed_round,omitempty"`
	Rounds        []StudentProcessRound `json:"rounds"`
	AttendedAt    string                `json:"attended_at"`
}

// ReviewAnalyticsFilter represents the left-panel filters for student review
type ReviewAnalyticsFilter struct {
	Batch                 string   `json:"batch"`
	Departments           []string `json:"departments"`
	StudentCategory       string   `json:"student_category"`
	PlacementInterestedIn string   `json:"placement_interested_in"`
	PlacementStatus       string   `json:"placement_status"` // "all", "placed", "not_placed"
	NipCategory           string   `json:"nip_category"`
	JourneyStatus         string   `json:"journey_status"`
	OfferHolders          string   `json:"offer_holders"`
	PackageMin            *float64 `json:"package_min"`
	PackageMax            *float64 `json:"package_max"`
	FinalFailures         string   `json:"final_failures"`
	OpportunityPriority   string   `json:"opportunity_priority"`
	ActiveProcess         string   `json:"active_process"`
}

// UnmarshalJSON provides resilient unmarshaling for camelCase, snake_case, and heterogeneous types
func (f *ReviewAnalyticsFilter) UnmarshalJSON(data []byte) error {
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	// 1. Batch
	if v, ok := raw["batch"]; ok && v != nil {
		f.Batch = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	// 2. Departments (supports []interface{}, []string, single values, numbers)
	if v, ok := raw["departments"]; ok && v != nil {
		switch arr := v.(type) {
		case []interface{}:
			f.Departments = make([]string, 0, len(arr))
			for _, item := range arr {
				if item != nil {
					s := strings.TrimSpace(fmt.Sprintf("%v", item))
					if s != "" && s != "all" {
						f.Departments = append(f.Departments, s)
					}
				}
			}
		case []string:
			f.Departments = arr
		case string:
			s := strings.TrimSpace(arr)
			if s != "" && s != "all" {
				f.Departments = []string{s}
			}
		case float64:
			f.Departments = []string{fmt.Sprintf("%.0f", arr)}
		}
	} else if v, ok := raw["department"]; ok && v != nil {
		s := strings.TrimSpace(fmt.Sprintf("%v", v))
		if s != "" && s != "all" {
			f.Departments = []string{s}
		}
	}

	// 3. Student Category (snake_case and camelCase)
	if v, ok := raw["student_category"]; ok && v != nil {
		f.StudentCategory = strings.TrimSpace(fmt.Sprintf("%v", v))
	} else if v, ok := raw["studentCategory"]; ok && v != nil {
		f.StudentCategory = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	// 4. Placement Interested In (snake_case and camelCase)
	if v, ok := raw["placement_interested_in"]; ok && v != nil {
		f.PlacementInterestedIn = strings.TrimSpace(fmt.Sprintf("%v", v))
	} else if v, ok := raw["placementInterestedIn"]; ok && v != nil {
		f.PlacementInterestedIn = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	// 4.1 Placement Status (snake_case and camelCase)
	if v, ok := raw["placement_status"]; ok && v != nil {
		f.PlacementStatus = strings.TrimSpace(fmt.Sprintf("%v", v))
	} else if v, ok := raw["placementStatus"]; ok && v != nil {
		f.PlacementStatus = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	// 5. NIP Category (snake_case and camelCase)
	if v, ok := raw["nip_category"]; ok && v != nil {
		f.NipCategory = strings.TrimSpace(fmt.Sprintf("%v", v))
	} else if v, ok := raw["nipCategory"]; ok && v != nil {
		f.NipCategory = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	// 6. Journey Status
	if v, ok := raw["journey_status"]; ok && v != nil {
		f.JourneyStatus = strings.TrimSpace(fmt.Sprintf("%v", v))
	} else if v, ok := raw["journeyStatus"]; ok && v != nil {
		f.JourneyStatus = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	// 7. Offer Holders (snake_case and camelCase)
	if v, ok := raw["offer_holders"]; ok && v != nil {
		f.OfferHolders = strings.TrimSpace(fmt.Sprintf("%v", v))
	} else if v, ok := raw["offerHolders"]; ok && v != nil {
		f.OfferHolders = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	// 7.1 Package Min & Max (snake_case and camelCase)
	if v, ok := raw["package_min"]; ok && v != nil {
		if val, err := strconv.ParseFloat(fmt.Sprintf("%v", v), 64); err == nil {
			f.PackageMin = &val
		}
	} else if v, ok := raw["packageMin"]; ok && v != nil {
		if val, err := strconv.ParseFloat(fmt.Sprintf("%v", v), 64); err == nil {
			f.PackageMin = &val
		}
	}

	if v, ok := raw["package_max"]; ok && v != nil {
		if val, err := strconv.ParseFloat(fmt.Sprintf("%v", v), 64); err == nil {
			f.PackageMax = &val
		}
	} else if v, ok := raw["packageMax"]; ok && v != nil {
		if val, err := strconv.ParseFloat(fmt.Sprintf("%v", v), 64); err == nil {
			f.PackageMax = &val
		}
	}

	// 8. Final Failures
	if v, ok := raw["final_failures"]; ok && v != nil {
		f.FinalFailures = strings.TrimSpace(fmt.Sprintf("%v", v))
	} else if v, ok := raw["finalFailures"]; ok && v != nil {
		f.FinalFailures = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	// 9. Opportunity Priority
	if v, ok := raw["opportunity_priority"]; ok && v != nil {
		f.OpportunityPriority = strings.TrimSpace(fmt.Sprintf("%v", v))
	} else if v, ok := raw["opportunityPriority"]; ok && v != nil {
		f.OpportunityPriority = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	// 10. Active Process
	if v, ok := raw["active_process"]; ok && v != nil {
		f.ActiveProcess = strings.TrimSpace(fmt.Sprintf("%v", v))
	} else if v, ok := raw["activeProcess"]; ok && v != nil {
		f.ActiveProcess = strings.TrimSpace(fmt.Sprintf("%v", v))
	}

	return nil
}

// ReviewAnalyticsResponse holds the metrics for the 5 analytics cards
type ReviewAnalyticsResponse struct {
	StudentsInReview         int64   `json:"students_in_review"`         // Dynamic
	InvitationAcceptanceRate float64 `json:"invitation_acceptance_rate"` // Dynamic (%)
	StudentsWithOffers       int64   `json:"students_with_offers"`       // Static: 42
	NeedNextOpportunity      int64   `json:"need_next_opportunity"`      // Static: 24
	NeedInterviewSupport     int64   `json:"need_interview_support"`     // Static: 11
}

// ReviewStudentListItem represents a student row in the Review workspace table
type ReviewStudentListItem struct {
	ID                  uint64   `json:"id"`
	Name                string   `json:"name"`
	RollNo              string   `json:"roll_no"`
	DepartmentCode      string   `json:"department_code"`
	DepartmentName      string   `json:"department_name"`
	BatchName           string   `json:"batch_name"`
	CGPA                *float64 `json:"cgpa"`
	Initials            string   `json:"initials"`
	CompaniesAttended   int      `json:"companies_attended"`
	CompaniesEligible   int      `json:"companies_eligible"`
	AttendancePct       float64  `json:"attendance_pct"`
	PriorityScore       float64  `json:"priority_score"`
	PriorityLevel       string   `json:"priority_level"` // "High", "Mid", "Low", "Needs Improvement & Interest"
	OffersCount         int      `json:"offers_count"`
	UnsuccessfulCount   int      `json:"unsuccessful_count"`
	Attempts            int      `json:"attempts"`
	TotalRoundsAttended int      `json:"total_rounds_attended"`
	FailedProcesses     int      `json:"failed_processes"`
	InvitationsCount    int      `json:"invitations_count"`
	BestPackageLPA      *float64 `json:"best_package_lpa"`
	IsPlaced            bool     `json:"is_placed"`
}





