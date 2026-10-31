package repositories

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"placement-management/models"
)

type StudentReviewRepository struct {
	db *gorm.DB
}

func NewStudentReviewRepository(db *gorm.DB) *StudentReviewRepository {
	return &StudentReviewRepository{db: db}
}

func formatDepartmentCode(name string) string {
	lower := strings.ToLower(name)
	if strings.Contains(lower, "computer science") {
		return "CSE"
	}
	if strings.Contains(lower, "information technology") {
		return "IT"
	}
	if strings.Contains(lower, "electronics and communication") {
		return "ECE"
	}
	if strings.Contains(lower, "mechanical") {
		return "MECH"
	}
	if strings.Contains(lower, "electrical") {
		return "EEE"
	}
	if strings.Contains(lower, "civil") {
		return "CIVIL"
	}
	words := strings.Fields(name)
	if len(words) >= 2 {
		var code []byte
		for _, w := range words {
			if len(w) > 0 && w[0] >= 'A' && w[0] <= 'Z' {
				code = append(code, w[0])
			}
		}
		if len(code) > 0 {
			return string(code)
		}
	}
	return name
}

// GetStudentReviewDetail returns the profile, badges, and stat card metrics for a student
func (r *StudentReviewRepository) GetStudentReviewDetail(userID uint64) (*models.StudentReviewDetail, error) {
	type studentRow struct {
		UserID             uint64   `gorm:"column:user_id"`
		Name               string   `gorm:"column:name"`
		RollNo             *string  `gorm:"column:roll_no"`
		DepartmentName     string   `gorm:"column:dept_name"`
		BatchName          string   `gorm:"column:batch_name"`
		CGPA               *float64 `gorm:"column:cgpa"`
		TenthMark          *float64 `gorm:"column:tenth_mark"`
		TwelthMark         *float64 `gorm:"column:twelth_mark"`
		CurrentArrearCount int      `gorm:"column:current_arrear_count"`
		HistoryArrearCount int      `gorm:"column:history_arrear_count"`
		NIP                string   `gorm:"column:nip"`
		IP                 string   `gorm:"column:ip"`
		CoreCompany        string   `gorm:"column:core_company"`
		SoftwareCompany    string   `gorm:"column:software_company"`
	}

	var row studentRow
	err := r.db.Table("master_users u").
		Select("u.id as user_id, u.name, u.roll_no, d.name as dept_name, b.name as batch_name, s.cgpa, s.tenth_mark, s.twelth_mark, COALESCE(s.current_arrear_count, 0) as current_arrear_count, COALESCE(s.history_arrear_count, 0) as history_arrear_count, COALESCE(s.nip, '0') as nip, COALESCE(s.ip, '0') as ip, COALESCE(s.core_company, '0') as core_company, COALESCE(s.software_company, '0') as software_company").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Joins("LEFT JOIN batches b ON u.batch_id = b.id").
		Joins("LEFT JOIN placement_student_basic_details s ON u.id = s.user_id").
		Where("u.id = ?", userID).
		Take(&row).Error

	if err != nil {
		return nil, err
	}

	// 1. Invitations: how many times his data repeated in placement_drive_students
	var invitations int64
	r.db.Table("placement_drive_students").
		Where("user_id = ?", userID).
		Count(&invitations)

	// 2. Accepted: in his row the outcome is cleared or not_cleared in placement_stage_results
	var accepted int64
	r.db.Table("placement_stage_results psr").
		Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
		Where("pds.user_id = ? AND psr.outcome IN ('cleared', 'not_cleared')", userID).
		Count(&accepted)

	// 3. Processes: if the outcome status is pending
	var processes int64
	r.db.Table("placement_stage_results psr").
		Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
		Where("pds.user_id = ? AND psr.outcome = 'pending'", userID).
		Count(&processes)

	// 4. Final Misses: reached highest/final stage of the drive but was not cleared or drive completed without offer
	var finalMisses int64
	r.db.Table("placement_drive_students pds").
		Joins("JOIN placement_drive d ON pds.drive_id = d.id").
		Joins(`JOIN (
			SELECT s1.drive_id, s1.id as stage_id 
			FROM placement_drive_stages s1 
			WHERE s1.sequence_no = (
				SELECT MAX(s2.sequence_no) 
				FROM placement_drive_stages s2 
				WHERE s2.drive_id = s1.drive_id
			)
		) fs ON pds.drive_id = fs.drive_id`).
		Joins("JOIN placement_stage_results psr ON psr.drive_student_id = pds.id AND psr.stage_id = fs.stage_id").
		Joins("LEFT JOIN placement_drive_offers pdo ON pdo.drive_student_id = pds.id").
		Where("pds.user_id = ? AND (psr.outcome = 'not_cleared' OR (pdo.id IS NULL AND d.overall_status = 'completed'))", userID).
		Distinct("pds.drive_id").
		Count(&finalMisses)

	// 5. Offers: refer the placement_drive_offers table
	var offers int64
	r.db.Table("placement_drive_offers pdo").
		Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
		Where("pds.user_id = ?", userID).
		Count(&offers)

	// 6. Recruitment rounds cleared (e.g. "10 of 16")
	var roundsCleared int64
	r.db.Table("placement_stage_results psr").
		Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
		Where("pds.user_id = ? AND psr.outcome = 'cleared'", userID).
		Count(&roundsCleared)

	var totalRounds int64
	r.db.Table("placement_stage_results psr").
		Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
		Where("pds.user_id = ? AND psr.outcome IN ('cleared', 'not_cleared')", userID).
		Count(&totalRounds)

	if totalRounds < roundsCleared {
		totalRounds = roundsCleared
	}
	roundsText := fmt.Sprintf("%d of %d", roundsCleared, totalRounds)

	// Fetch detailed offer rows for the student
	var offerItems []models.StudentReviewOfferItem
	r.db.Table("placement_drive_offers pdo").
		Select("pdo.id as offer_id, COALESCE(c.company_code, '') as company_code, COALESCE(c.company_name, 'Company') as company_name, COALESCE(pdo.final_role, d.job_role, 'Role') as role, COALESCE(pdo.package_lpa, d.package_lpa) as package_lpa, 'Accepted' as status").
		Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
		Joins("JOIN placement_drive d ON pds.drive_id = d.id").
		Joins("LEFT JOIN placement_company c ON d.company_id = c.id").
		Where("pds.user_id = ?", userID).
		Scan(&offerItems)

	if offerItems == nil {
		offerItems = []models.StudentReviewOfferItem{}
	}

	// 7. Opportunity Priority Score Calculations (Two-Metric Algorithm)
	// Metric 1: Eligible Companies vs Attended Companies
	var eligibleCompanies int64
	r.db.Table("placement_drive_students").
		Where("user_id = ?", userID).
		Distinct("drive_id").
		Count(&eligibleCompanies)

	var companiesAttended int64
	r.db.Table("placement_stage_results psr").
		Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
		Where("pds.user_id = ? AND psr.outcome IN ('cleared', 'not_cleared')", userID).
		Distinct("pds.drive_id").
		Count(&companiesAttended)

	var attendancePct float64
	hasEligible := eligibleCompanies > 0
	if hasEligible {
		attendancePct = (float64(companiesAttended) / float64(eligibleCompanies)) * 100.0
		if attendancePct > 100.0 {
			attendancePct = 100.0
		}
	}

	// Metric 2: Total Rounds Attended vs Rounds Cleared
	var totalRoundsAttended int64
	r.db.Table("placement_stage_results psr").
		Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
		Where("pds.user_id = ? AND psr.outcome IN ('cleared', 'not_cleared')", userID).
		Count(&totalRoundsAttended)

	var roundsClearedPct float64
	hasRounds := totalRoundsAttended > 0
	if hasRounds {
		roundsClearedPct = (float64(roundsCleared) / float64(totalRoundsAttended)) * 100.0
		if roundsClearedPct > 100.0 {
			roundsClearedPct = 100.0
		}
	}

	var pendingRounds int64
	r.db.Table("placement_stage_results psr").
		Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
		Where("pds.user_id = ? AND psr.outcome = 'pending'", userID).
		Count(&pendingRounds)

	// Equal weighting: (Attendance % * 0.5) + (Rounds Cleared % * 0.5)
	var opportunityScore float64
	if hasEligible && hasRounds {
		opportunityScore = (attendancePct * 0.5) + (roundsClearedPct * 0.5)
	} else if hasEligible {
		opportunityScore = attendancePct * 0.5
	} else if hasRounds {
		opportunityScore = roundsClearedPct * 0.5
	} else {
		opportunityScore = 0.0
	}

	// Category Classification using weaker threshold:
	// Attendance: High > 90%, Mid > 75%, Low > 50%, Needs Improvement <= 50%
	attRank := 1
	if attendancePct > 90.0 {
		attRank = 4
	} else if attendancePct > 75.0 {
		attRank = 3
	} else if attendancePct > 50.0 {
		attRank = 2
	} else {
		attRank = 1
	}

	// Rounds Cleared: High > 60%, Mid > 40%, Low > 25%, Needs Improvement <= 25%
	roundsRank := 1
	if roundsClearedPct > 60.0 {
		roundsRank = 4
	} else if roundsClearedPct > 40.0 {
		roundsRank = 3
	} else if roundsClearedPct > 25.0 {
		roundsRank = 2
	} else {
		roundsRank = 1
	}

	minRank := attRank
	if roundsRank < minRank {
		minRank = roundsRank
	}
	if !hasEligible || !hasRounds {
		minRank = 1
	}

	priorityLevel := "Needs Improvement & Interest"
	switch minRank {
	case 4:
		priorityLevel = "High"
	case 3:
		priorityLevel = "Mid"
	case 2:
		priorityLevel = "Low"
	case 1:
		priorityLevel = "Needs Improvement & Interest"
	}

	// Generate dynamic reasons
	reasons := []string{}
	if offers == 0 {
		reasons = append(reasons, "Student does not currently hold a placement offer.")
	} else {
		reasons = append(reasons, fmt.Sprintf("Student has secured %d placement offer(s).", offers))
	}

	if !hasEligible {
		reasons = append(reasons, "No eligible placement drives recorded yet.")
	} else if attendancePct >= 90.0 {
		reasons = append(reasons, fmt.Sprintf("Strong attendance (%.0f%%) across eligible company invitations.", attendancePct))
	} else if attendancePct >= 70.0 {
		reasons = append(reasons, fmt.Sprintf("Moderate attendance (%.0f%%) across eligible company invitations.", attendancePct))
	} else {
		reasons = append(reasons, fmt.Sprintf("Low attendance (%.0f%%), missing multiple eligible opportunities.", attendancePct))
	}

	if !hasRounds {
		reasons = append(reasons, "Recruitment round performance pending initial stage participation.")
	} else if roundsClearedPct >= 60.0 {
		reasons = append(reasons, fmt.Sprintf("Strong performance in recruitment stages (%.0f%% cleared).", roundsClearedPct))
	} else if roundsClearedPct >= 30.0 {
		reasons = append(reasons, fmt.Sprintf("Moderate stage clearance (%.0f%% cleared of %d attended).", roundsClearedPct, totalRoundsAttended))
	} else {
		reasons = append(reasons, "Multiple unsuccessful attempts indicate a need for targeted interview and technical support.")
	}

	if pendingRounds > 0 {
		reasons = append(reasons, fmt.Sprintf("%d recruitment round(s) currently awaiting finalized results.", pendingRounds))
	}

	// Fetch all recommendation notes from placement_review_notes in order (newest first)
	type ReviewNoteRow struct {
		ID         uint64    `gorm:"column:id"`
		Note       string    `gorm:"column:note"`
		AuthorName string    `gorm:"column:author_name"`
		CreatedAt  time.Time `gorm:"column:created_at"`
	}
	var noteRows []ReviewNoteRow
	_ = r.db.Table("placement_review_notes prn").
		Select("prn.id, prn.note, COALESCE(u.name, 'Placement Officer') as author_name, prn.created_at").
		Joins("LEFT JOIN master_users u ON prn.created_by = u.id").
		Where("prn.user_id = ?", userID).
		Order("prn.created_at DESC, prn.id DESC").
		Scan(&noteRows).Error

	notes := make([]models.StudentReviewNoteItem, 0, len(noteRows))
	recommendationNote := ""
	recommendationAuthor := ""
	recommendationDate := ""

	for i, n := range noteRows {
		dateStr := n.CreatedAt.Format("02 Jan 2006, 03:04 PM")
		notes = append(notes, models.StudentReviewNoteItem{
			ID:         n.ID,
			Note:       n.Note,
			AuthorName: n.AuthorName,
			CreatedAt:  dateStr,
		})
		if i == 0 {
			recommendationNote = n.Note
			recommendationAuthor = n.AuthorName
			recommendationDate = dateStr
		}
	}

	rollNo := ""
	if row.RollNo != nil {
		rollNo = *row.RollNo
	}

	// Determine category badge
	categoryBadge := "Placement Interested"
	studentType := "ip"
	if row.NIP == "1" {
		categoryBadge = "NIP"
		studentType = "nip"
	} else if row.IP == "1" {
		if row.CoreCompany == "1" && row.SoftwareCompany == "1" {
			categoryBadge = "Core & Software"
		} else if row.CoreCompany == "1" {
			categoryBadge = "Core"
		} else if row.SoftwareCompany == "1" {
			categoryBadge = "Software"
		}
	}

	detail := &models.StudentReviewDetail{
		UserID:         row.UserID,
		Name:           row.Name,
		RollNo:         rollNo,
		DepartmentName: row.DepartmentName,
		DepartmentCode: formatDepartmentCode(row.DepartmentName),
		BatchName:      row.BatchName,
		CGPA:             row.CGPA,
		TenthMark:        row.TenthMark,
		TwelfthMark:      row.TwelthMark,
		CurrentArrears:   row.CurrentArrearCount,
		HistoryOfArrears: row.HistoryArrearCount,
		IsPlaced:         offers > 0,
		CategoryBadge:    categoryBadge,
		StudentType:      studentType,
		Stats: models.StudentReviewStats{
			Invitations:   invitations,
			Accepted:      accepted,
			Processes:     processes,
			FinalMisses:   finalMisses,
			Offers:        offers,
			RoundsCleared: roundsCleared,
			TotalRounds:   totalRounds,
			RoundsText:    roundsText,
		},
		Offers: offerItems,
		Opportunity: models.OpportunityScoreData{
			EligibleCompanies:    eligibleCompanies,
			CompaniesAttended:    companiesAttended,
			AttendancePercentage: attendancePct,
			TotalRoundsAttended:  totalRoundsAttended,
			RoundsCleared:        roundsCleared,
			RoundsClearedPct:     roundsClearedPct,
			PendingRounds:        pendingRounds,
			Score:                opportunityScore,
			PriorityLevel:        priorityLevel,
			Reasons:              reasons,
			Notes:                notes,
			RecommendationNote:   recommendationNote,
			RecommendationAuthor: recommendationAuthor,
			RecommendationDate:   recommendationDate,
			HasInsufficientData:  !hasEligible || !hasRounds,
		},
	}

	return detail, nil
}

// SaveReviewNote adds a new recommendation note in placement_review_notes
func (r *StudentReviewRepository) SaveReviewNote(userID uint64, note string, createdBy uint64) error {
	if createdBy == 0 {
		createdBy = 6 // Placement Officer fallback
	}
	return r.db.Exec(`
		INSERT INTO placement_review_notes (user_id, note, created_by, created_at, updated_at) 
		VALUES (?, ?, ?, NOW(), NOW())
	`, userID, note, createdBy).Error
}

// GetDefaultStudentReviewDetail returns the review details of the first student in the database
func (r *StudentReviewRepository) GetDefaultStudentReviewDetail() (*models.StudentReviewDetail, error) {
	var firstUserID uint64
	err := r.db.Table("master_users").
		Where("role_id = 1").
		Order("id ASC").
		Select("id").
		Limit(1).
		Row().
		Scan(&firstUserID)

	if err != nil {
		return nil, err
	}

	return r.GetStudentReviewDetail(firstUserID)
}
