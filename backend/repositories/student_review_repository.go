package repositories

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
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

	// 1. Invitations: how many distinct placement drives the student was invited to
	var invitations int64
	r.db.Table("placement_drive_students").
		Where("user_id = ? AND drive_status != 'excluded'", userID).
		Distinct("drive_id").
		Count(&invitations)

	// 2. Attended (Accepted): how many distinct placement drives the student attended
	var accepted int64
	r.db.Table("placement_stage_results psr").
		Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
		Where("pds.user_id = ? AND psr.outcome IN ('cleared', 'not_cleared', 'absent', 'withdrawn')", userID).
		Distinct("pds.drive_id").
		Count(&accepted)

	if accepted > invitations && invitations > 0 {
		accepted = invitations
	}

	// 3. Processes: how many distinct placement drives are currently in process (pending)
	var processes int64
	r.db.Table("placement_stage_results psr").
		Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
		Where("pds.user_id = ? AND psr.outcome = 'pending'", userID).
		Distinct("pds.drive_id").
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

// UpdateReviewNote updates the note text in placement_review_notes
func (r *StudentReviewRepository) UpdateReviewNote(noteID uint64, note string) error {
	return r.db.Exec(`
		UPDATE placement_review_notes 
		SET note = ?, updated_at = NOW() 
		WHERE id = ?
	`, note, noteID).Error
}

// DeleteReviewNote removes a note from placement_review_notes
func (r *StudentReviewRepository) DeleteReviewNote(noteID uint64) error {
	return r.db.Exec(`
		DELETE FROM placement_review_notes 
		WHERE id = ?
	`, noteID).Error
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

// GetStudentRecruitmentHistory returns all recruitment processes attended by the student,
// ordered by latest activity timestamp descending, with pagination support (5 per page).
func (r *StudentReviewRepository) GetStudentRecruitmentHistory(userID uint64, page, limit int) (*models.StudentRecruitmentHistoryResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 5
	}

	type DriveStudentRow struct {
		DriveStudentID     uint64     `gorm:"column:drive_student_id"`
		DriveID            uint64     `gorm:"column:drive_id"`
		JobRole            string     `gorm:"column:job_role"`
		DriveOverallStatus string     `gorm:"column:drive_overall_status"`
		CompanyName        string     `gorm:"column:company_name"`
		CompanyCode        string     `gorm:"column:company_code"`
		IncludedAt         *time.Time `gorm:"column:included_at"`
		DriveUpdatedAt     *time.Time `gorm:"column:drive_updated_at"`
	}

	var driveRows []DriveStudentRow
	err := r.db.Table("placement_drive_students pds").
		Select("pds.id as drive_student_id, pds.drive_id, pd.job_role, pd.overall_status as drive_overall_status, pc.company_name, pc.company_code, pds.included_at, pd.updated_at as drive_updated_at").
		Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
		Joins("JOIN placement_company pc ON pd.company_id = pc.id").
		Where("pds.user_id = ? AND pds.drive_status != 'excluded'", userID).
		Scan(&driveRows).Error

	if err != nil {
		return nil, err
	}

	type historyWithTime struct {
		item         models.StudentRecruitmentHistoryItem
		activityTime time.Time
	}

	var allItems []historyWithTime

	for _, dRow := range driveRows {
		// 1. Check for offer
		type OfferRow struct {
			ID        uint64    `gorm:"column:id"`
			FinalRole *string   `gorm:"column:final_role"`
			CreatedAt time.Time `gorm:"column:created_at"`
		}
		var offer OfferRow
		hasOffer := false
		if err := r.db.Table("placement_drive_offers").
			Where("drive_student_id = ?", dRow.DriveStudentID).
			Order("id DESC").
			Limit(1).
			Take(&offer).Error; err == nil && offer.ID > 0 {
			hasOffer = true
		}

		// 2. Fetch all stage results for this student in this drive
		type StageResultRow struct {
			ID           uint64     `gorm:"column:id"`
			StageID      uint64     `gorm:"column:stage_id"`
			SubstageID   *uint64    `gorm:"column:substage_id"`
			Outcome      string     `gorm:"column:outcome"`
			StageName    string     `gorm:"column:stage_name"`
			StageSeq     int        `gorm:"column:stage_seq"`
			SubstageName *string    `gorm:"column:substage_name"`
			SubstageSeq  *int       `gorm:"column:substage_seq"`
			UpdatedAt    *time.Time `gorm:"column:updated_at"`
			CreatedAt    *time.Time `gorm:"column:created_at"`
		}
		var results []StageResultRow
		_ = r.db.Table("placement_stage_results psr").
			Select("psr.id, psr.stage_id, psr.substage_id, psr.outcome, psr.updated_at, psr.created_at, st.stage_name, st.sequence_no as stage_seq, sub.substage_name, sub.sequence_no as substage_seq").
			Joins("JOIN placement_drive_stages st ON psr.stage_id = st.id").
			Joins("LEFT JOIN placement_drive_substages sub ON psr.substage_id = sub.id").
			Where("psr.drive_student_id = ?", dRow.DriveStudentID).
			Order("st.sequence_no ASC, COALESCE(sub.sequence_no, 0) ASC").
			Scan(&results).Error

		// 3. Compute the latest activity timestamp for ordering
		latestTime := time.Time{}
		if dRow.IncludedAt != nil {
			latestTime = *dRow.IncludedAt
		}
		if dRow.DriveUpdatedAt != nil && dRow.DriveUpdatedAt.After(latestTime) {
			latestTime = *dRow.DriveUpdatedAt
		}
		for _, res := range results {
			if res.UpdatedAt != nil && res.UpdatedAt.After(latestTime) {
				latestTime = *res.UpdatedAt
			} else if res.CreatedAt != nil && res.CreatedAt.After(latestTime) {
				latestTime = *res.CreatedAt
			}
		}
		if hasOffer && offer.CreatedAt.After(latestTime) {
			latestTime = offer.CreatedAt
		}

		// 4. Determine overall status and current/final round details
		var status string
		var roundName string
		var roundNumber int
		var roundDetailText string

		if hasOffer {
			// Offered (Green)
			status = "Offered"
			roundName = "Offer"
			roundNumber = 0
			if len(results) > 0 {
				lastRes := results[len(results)-1]
				roundNumber = lastRes.StageSeq
				if lastRes.SubstageName != nil && *lastRes.SubstageName != "" {
					roundName = *lastRes.SubstageName
				} else {
					roundName = lastRes.StageName
				}
			}
			roundDetailText = "Offer · Accepted"
		} else if dRow.DriveOverallStatus == "cancelled" {
			// Failed / Cancelled (Red)
			status = "Failed / Cancelled"
			roundName = "Drive Cancelled"
			roundNumber = 0
			roundDetailText = "Process Cancelled"
		} else {
			// Check if any stage resulted in failure (not_cleared, absent, withdrawn)
			var failedResult *StageResultRow
			for i := len(results) - 1; i >= 0; i-- {
				if results[i].Outcome == "not_cleared" || results[i].Outcome == "absent" || results[i].Outcome == "withdrawn" {
					failedResult = &results[i]
					break
				}
			}

			if failedResult != nil {
				// Failed / Cancelled (Red)
				status = "Failed / Cancelled"
				rName := failedResult.StageName
				if failedResult.SubstageName != nil && *failedResult.SubstageName != "" {
					rName = *failedResult.SubstageName
				}
				roundName = rName
				roundNumber = failedResult.StageSeq
				outcomeText := "Not Selected"
				if failedResult.Outcome == "absent" {
					outcomeText = "Absent"
				} else if failedResult.Outcome == "withdrawn" {
					outcomeText = "Withdrawn"
				}
				roundDetailText = fmt.Sprintf("%s (Round no: %d) · %s", rName, roundNumber, outcomeText)
			} else {
				// In Process (Orange)
				status = "In Process"

				// Look for pending round
				var pendingResult *StageResultRow
				for i := range results {
					if results[i].Outcome == "pending" {
						pendingResult = &results[i]
						break
					}
				}

				if pendingResult != nil {
					rName := pendingResult.StageName
					if pendingResult.SubstageName != nil && *pendingResult.SubstageName != "" {
						rName = *pendingResult.SubstageName
					}
					roundName = rName
					roundNumber = pendingResult.StageSeq
					roundDetailText = fmt.Sprintf("%s (Round no: %d) · In Process", rName, roundNumber)
				} else if len(results) > 0 {
					// All attempted rounds cleared so far, awaiting next round
					lastRes := results[len(results)-1]
					rName := lastRes.StageName
					if lastRes.SubstageName != nil && *lastRes.SubstageName != "" {
						rName = *lastRes.SubstageName
					}
					roundName = rName
					roundNumber = lastRes.StageSeq
					roundDetailText = fmt.Sprintf("%s (Round no: %d) · Cleared", rName, roundNumber)
				} else {
					// Registered, awaiting round 1
					type FirstStageRow struct {
						StageName  string `gorm:"column:stage_name"`
						SequenceNo int    `gorm:"column:sequence_no"`
					}
					var fs FirstStageRow
					_ = r.db.Table("placement_drive_stages").
						Where("drive_id = ?", dRow.DriveID).
						Order("sequence_no ASC").
						Limit(1).
						Scan(&fs).Error
					if fs.StageName != "" {
						roundName = fs.StageName
						roundNumber = fs.SequenceNo
						roundDetailText = fmt.Sprintf("%s (Round no: %d) · In Process", fs.StageName, fs.SequenceNo)
					} else {
						roundName = "Registration"
						roundNumber = 1
						roundDetailText = "Registration · In Process"
					}
				}
			}
		}

		dateFormatted := ""
		if !latestTime.IsZero() {
			dateFormatted = latestTime.Format("02 Jan 2006, 03:04 PM")
		}

		allItems = append(allItems, historyWithTime{
			item: models.StudentRecruitmentHistoryItem{
				DriveID:         dRow.DriveID,
				DriveStudentID:  dRow.DriveStudentID,
				CompanyName:     dRow.CompanyName,
				CompanyCode:     dRow.CompanyCode,
				JobRole:         dRow.JobRole,
				Status:          status,
				RoundName:       roundName,
				RoundNumber:     roundNumber,
				RoundDetailText: roundDetailText,
				Timestamp:       latestTime.Format(time.RFC3339),
				DateFormatted:   dateFormatted,
			},
			activityTime: latestTime,
		})
	}

	// Sort newest first
	sort.Slice(allItems, func(i, j int) bool {
		return allItems[i].activityTime.After(allItems[j].activityTime)
	})

	totalCount := len(allItems)
	totalPages := 0
	if totalCount > 0 {
		totalPages = (totalCount + limit - 1) / limit
	}

	start := (page - 1) * limit
	end := start + limit
	var pagedItems []models.StudentRecruitmentHistoryItem

	if start < totalCount {
		if end > totalCount {
			end = totalCount
		}
		for _, it := range allItems[start:end] {
			pagedItems = append(pagedItems, it.item)
		}
	}
	if pagedItems == nil {
		pagedItems = []models.StudentRecruitmentHistoryItem{}
	}

	return &models.StudentRecruitmentHistoryResponse{
		Items:       pagedItems,
		TotalCount:  totalCount,
		CurrentPage: page,
		TotalPages:  totalPages,
		Limit:       limit,
	}, nil
}

// GetStudentCompanyProcesses returns all company recruitment processes where the student actually participated,
// with sequential rounds, individual outcomes (cleared/not cleared), package LPA, and overall status (Offered / Failed).
func (r *StudentReviewRepository) GetStudentCompanyProcesses(userID uint64, search string) ([]models.StudentCompanyProcessItem, error) {
	type DriveStudentRow struct {
		DriveStudentID     uint64     `gorm:"column:drive_student_id"`
		DriveID            uint64     `gorm:"column:drive_id"`
		JobRole            string     `gorm:"column:job_role"`
		PackageLPA         *float64   `gorm:"column:package_lpa"`
		DriveOverallStatus string     `gorm:"column:drive_overall_status"`
		CompanyName        string     `gorm:"column:company_name"`
		CompanyCode        string     `gorm:"column:company_code"`
		IncludedAt         *time.Time `gorm:"column:included_at"`
		DriveUpdatedAt     *time.Time `gorm:"column:drive_updated_at"`
	}

	query := r.db.Table("placement_drive_students pds").
		Select("pds.id as drive_student_id, pds.drive_id, pd.job_role, pd.package_lpa, pd.overall_status as drive_overall_status, pc.company_name, pc.company_code, pds.included_at, pd.updated_at as drive_updated_at").
		Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
		Joins("JOIN placement_company pc ON pd.company_id = pc.id").
		Where("pds.user_id = ? AND pds.drive_status != 'excluded'", userID)

	search = strings.TrimSpace(search)
	if search != "" {
		likePattern := "%" + search + "%"
		query = query.Where("(pc.company_name LIKE ? OR pd.job_role LIKE ?)", likePattern, likePattern)
	}

	var driveRows []DriveStudentRow
	if err := query.Scan(&driveRows).Error; err != nil {
		return nil, err
	}

	type processWithTime struct {
		item         models.StudentCompanyProcessItem
		activityTime time.Time
	}

	var processList []processWithTime

	for _, dRow := range driveRows {
		// 1. Check for offer in placement_drive_offers
		type OfferRow struct {
			ID         uint64    `gorm:"column:id"`
			PackageLPA *float64  `gorm:"column:package_lpa"`
			CreatedAt  time.Time `gorm:"column:created_at"`
		}
		var offer OfferRow
		hasOffer := false
		if err := r.db.Table("placement_drive_offers").
			Where("drive_student_id = ?", dRow.DriveStudentID).
			Order("id DESC").
			Limit(1).
			Take(&offer).Error; err == nil && offer.ID > 0 {
			hasOffer = true
		}

		// 2. Fetch all stage results for this student in this drive
		type StageResultRow struct {
			ID           uint64     `gorm:"column:id"`
			StageID      uint64     `gorm:"column:stage_id"`
			SubstageID   *uint64    `gorm:"column:substage_id"`
			Outcome      string     `gorm:"column:outcome"`
			Score        *float64   `gorm:"column:score"`
			StageName    string     `gorm:"column:stage_name"`
			StageSeq     int        `gorm:"column:stage_seq"`
			SubstageName *string    `gorm:"column:substage_name"`
			SubstageSeq  *int       `gorm:"column:substage_seq"`
			UpdatedAt    *time.Time `gorm:"column:updated_at"`
			CreatedAt    *time.Time `gorm:"column:created_at"`
		}
		var results []StageResultRow
		_ = r.db.Table("placement_stage_results psr").
			Select("psr.id, psr.stage_id, psr.substage_id, psr.outcome, psr.score, psr.updated_at, psr.created_at, st.stage_name, st.sequence_no as stage_seq, sub.substage_name, sub.sequence_no as substage_seq").
			Joins("JOIN placement_drive_stages st ON psr.stage_id = st.id").
			Joins("LEFT JOIN placement_drive_substages sub ON psr.substage_id = sub.id").
			Where("psr.drive_student_id = ?", dRow.DriveStudentID).
			Order("st.sequence_no ASC, COALESCE(sub.sequence_no, 0) ASC").
			Scan(&results).Error

		// 3. Filter only stages the student ACTUALLY ATTENDED
		// (Do not display companies for which the student was only eligible or invited but never attended)
		var attendedRounds []models.StudentProcessRound
		var failedRoundName string
		latestTime := time.Time{}
		if dRow.IncludedAt != nil {
			latestTime = *dRow.IncludedAt
		}
		if dRow.DriveUpdatedAt != nil && dRow.DriveUpdatedAt.After(latestTime) {
			latestTime = *dRow.DriveUpdatedAt
		}

		roundCounter := 1
		for _, res := range results {
			// Attended means outcome is recorded and not unattempted pending
			if res.Outcome != "pending" && res.Outcome != "" {
				rName := res.StageName
				if res.SubstageName != nil && *res.SubstageName != "" {
					rName = *res.SubstageName
				}

				isCleared := (res.Outcome == "cleared")
				if !isCleared && failedRoundName == "" {
					failedRoundName = rName
				}

				if res.UpdatedAt != nil && res.UpdatedAt.After(latestTime) {
					latestTime = *res.UpdatedAt
				} else if res.CreatedAt != nil && res.CreatedAt.After(latestTime) {
					latestTime = *res.CreatedAt
				}

				attendedRounds = append(attendedRounds, models.StudentProcessRound{
					RoundIndex: roundCounter,
					RoundName:  rName,
					Outcome:    res.Outcome,
					IsCleared:  isCleared,
					Score:      res.Score,
				})
				roundCounter++
			}
		}

		if hasOffer && offer.CreatedAt.After(latestTime) {
			latestTime = offer.CreatedAt
		}

		// If no rounds attended and no offer, the student NEVER attended this company -> skip!
		if len(attendedRounds) == 0 && !hasOffer {
			continue
		}

		// 4. Determine overall status ("Offered", "Ongoing", or "Failed")
		var overallStatus string
		var statusText string

		if hasOffer {
			overallStatus = "Offered"
			statusText = "Offered"
		} else if failedRoundName != "" {
			overallStatus = "Failed"
			lowerName := strings.ToLower(failedRoundName)
			if strings.HasSuffix(lowerName, " interview") {
				base := strings.TrimSpace(failedRoundName[:len(failedRoundName)-len(" interview")])
				statusText = base + " round failed"
			} else if strings.HasSuffix(lowerName, " round") {
				statusText = failedRoundName + " failed"
			} else {
				statusText = failedRoundName + " round failed"
			}
		} else if dRow.DriveOverallStatus == "cancelled" {
			overallStatus = "Failed"
			statusText = "Process cancelled"
		} else {
			// Student attended rounds and has NOT failed any round -> ongoing!
			overallStatus = "Ongoing"
			statusText = "Ongoing"
		}

		// Determine package
		pkg := dRow.PackageLPA
		if hasOffer && offer.PackageLPA != nil {
			pkg = offer.PackageLPA
		}

		processList = append(processList, processWithTime{
			item: models.StudentCompanyProcessItem{
				DriveID:       dRow.DriveID,
				CompanyName:   dRow.CompanyName,
				JobRole:       dRow.JobRole,
				PackageLPA:    pkg,
				OverallStatus: overallStatus,
				StatusText:    statusText,
				FailedRound:   failedRoundName,
				Rounds:        attendedRounds,
				AttendedAt:    latestTime.Format("02 Jan 2006"),
			},
			activityTime: latestTime,
		})
	}

	// Sort newest first
	sort.Slice(processList, func(i, j int) bool {
		return processList[i].activityTime.After(processList[j].activityTime)
	})

	output := make([]models.StudentCompanyProcessItem, 0, len(processList))
	for _, p := range processList {
		output = append(output, p.item)
	}

	return output, nil
}

// GetReviewAnalytics calculates dynamic counts for Students in Current Review & Invitation Acceptance Rate
// based on left-panel filters, while keeping the 3 static cards (Students with Offers = 42,
// Need Next Opportunity = 24, Need Interview Support = 11) unchanged.
func (r *StudentReviewRepository) GetReviewAnalytics(filter models.ReviewAnalyticsFilter) (*models.ReviewAnalyticsResponse, error) {
	query := r.db.Table("master_users u").
		Joins("LEFT JOIN placement_student_basic_details s ON u.id = s.user_id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Joins("LEFT JOIN batches b ON u.batch_id = b.id").
		Where("u.role_id = 1")

	// 1. Academic Batch filter
	if filter.Batch != "" && filter.Batch != "all" {
		cleanBatch := strings.ReplaceAll(filter.Batch, "–", "-")
		cleanBatch = strings.TrimSpace(cleanBatch)
		query = query.Where("(b.name = ? OR b.name = ? OR b.id = ?)", filter.Batch, cleanBatch, cleanBatch)
	}

	// 2. Department filter
	if len(filter.Departments) > 0 {
		query = query.Where("(u.department_id IN (?) OR d.name IN (?))", filter.Departments, filter.Departments)
	}

	// 3. Student Category (placement_interested vs nip)
	if filter.StudentCategory == "nip" {
		query = query.Where("(COALESCE(s.nip, '0') = '1' OR COALESCE(s.ip, '1') = '0')")
	} else if filter.StudentCategory == "placement_interested" {
		query = query.Where("COALESCE(s.nip, '0') = '0' AND COALESCE(s.ip, '1') = '1'")

		// Placement Interested In: All, Software, Core
		if filter.PlacementInterestedIn == "software" {
			query = query.Where("COALESCE(s.software_company, '0') = '1'")
		} else if filter.PlacementInterestedIn == "core" {
			query = query.Where("COALESCE(s.core_company, '0') = '1'")
		}
	}

	// 4. Placement Status filter: "all", "placed", "not_placed"
	if filter.PlacementStatus == "placed" {
		offerSubQuery := r.db.Table("placement_drive_offers pdo").
			Select("DISTINCT pds.user_id").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id")
		query = query.Where("u.id IN (?)", offerSubQuery)
	} else if filter.PlacementStatus == "not_placed" {
		offerSubQuery := r.db.Table("placement_drive_offers pdo").
			Select("DISTINCT pds.user_id").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id")
		query = query.Where("u.id NOT IN (?)", offerSubQuery)
	}

	// 5. Offer Holders & Package Range (only applicable when placed or all)
	if filter.PlacementStatus != "not_placed" {
		if filter.OfferHolders == "one_offer" || filter.OfferHolders == "multiple_offers" {
			offerCountSubQuery := r.db.Table("placement_drive_offers pdo").
				Select("pds.user_id, COUNT(DISTINCT pdo.id) as offer_count").
				Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
				Group("pds.user_id")

			if filter.OfferHolders == "one_offer" {
				query = query.Joins("JOIN (?) off ON off.user_id = u.id AND off.offer_count = 1", offerCountSubQuery)
			} else if filter.OfferHolders == "multiple_offers" {
				query = query.Joins("JOIN (?) off ON off.user_id = u.id AND off.offer_count > 1", offerCountSubQuery)
			}
		}

		minPkg := 0.0
		if filter.PackageMin != nil {
			minPkg = *filter.PackageMin
		}
		maxPkg := 100.0
		if filter.PackageMax != nil {
			maxPkg = *filter.PackageMax
		}
		if minPkg > 0.0 || maxPkg < 100.0 {
			pkgSubQuery := r.db.Table("placement_drive_offers pdo").
				Select("pds.user_id, MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) as max_pkg").
				Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
				Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
				Group("pds.user_id")

			query = query.Joins("JOIN (?) pkg ON pkg.user_id = u.id AND pkg.max_pkg >= ? AND pkg.max_pkg <= ?", pkgSubQuery, minPkg, maxPkg)
		}
	}

	// 6. Final Round Failures filter
	if filter.FinalFailures != "" && filter.FinalFailures != "all" {
		failSubQuery := r.db.Table("placement_stage_results psr").
			Select("pds.user_id, COUNT(DISTINCT pds.drive_id) as fail_count").
			Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
			Where("psr.outcome IN ('not_cleared', 'absent', 'withdrawn')").
			Group("pds.user_id")

		if filter.FinalFailures == "1" {
			query = query.Joins("JOIN (?) fc ON fc.user_id = u.id AND fc.fail_count = 1", failSubQuery)
		} else if filter.FinalFailures == "2" {
			query = query.Joins("JOIN (?) fc ON fc.user_id = u.id AND fc.fail_count = 2", failSubQuery)
		} else if filter.FinalFailures == "more" || filter.FinalFailures == "3+" {
			query = query.Joins("JOIN (?) fc ON fc.user_id = u.id AND fc.fail_count >= 3", failSubQuery)
		}
	}

	// 7. Active Recruitment Process filter
	if strings.ToLower(filter.ActiveProcess) == "yes" {
		activeSubQuery := r.db.Table("placement_drive_students pds").
			Select("DISTINCT pds.user_id").
			Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
			Where("pds.drive_status != 'excluded' AND pd.overall_status IN ('active', 'in_progress', 'scheduled', 'ongoing')")
		query = query.Where("u.id IN (?)", activeSubQuery)
	} else if strings.ToLower(filter.ActiveProcess) == "no" {
		activeSubQuery := r.db.Table("placement_drive_students pds").
			Select("DISTINCT pds.user_id").
			Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
			Where("pds.drive_status != 'excluded' AND pd.overall_status IN ('active', 'in_progress', 'scheduled', 'ongoing')")
		query = query.Where("u.id NOT IN (?)", activeSubQuery)
	}

	// Fetch matching student IDs
	var userIDs []uint64
	if err := query.Pluck("u.id", &userIDs).Error; err != nil {
		return nil, err
	}

	studentsCount := int64(len(userIDs))

	// Invitation Acceptance Rate calculation for these filtered students
	var acceptanceRate float64 = 74.0 // fallback reference rate
	if studentsCount > 0 {
		var totalInvitations int64
		_ = r.db.Table("placement_drive_students").
			Where("user_id IN (?) AND drive_status != 'excluded'", userIDs).
			Count(&totalInvitations).Error

		var totalAccepted int64
		_ = r.db.Table("placement_stage_results psr").
			Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
			Where("pds.user_id IN (?) AND psr.outcome IN ('cleared', 'not_cleared')", userIDs).
			Count(&totalAccepted).Error

		if totalInvitations > 0 {
			rate := (float64(totalAccepted) / float64(totalInvitations)) * 100.0
			if rate > 100.0 {
				rate = 100.0
			}
			acceptanceRate = rate
		}
	} else {
		acceptanceRate = 0.0
	}

	// Card 1: Students in Current Review (Dynamic from filtered students count)
	// Card 2: Invitation Acceptance Rate (Dynamic)
	// Card 3: Students with Offers (from DB)
	var studentsWithOffers int64
	_ = r.db.Table("placement_drive_offers pdo").
		Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
		Distinct("pds.user_id").
		Count(&studentsWithOffers).Error

	// Card 4: Need Next Opportunity (from DB: placement-interested students without an offer)
	var needNextOpp int64
	_ = r.db.Table("master_users u").
		Joins("LEFT JOIN placement_student_basic_details s ON u.id = s.user_id").
		Where("u.role_id = 1 AND COALESCE(s.nip, '0') = '0' AND COALESCE(s.ip, '1') = '1'").
		Where("u.id NOT IN (SELECT DISTINCT pds.user_id FROM placement_drive_offers pdo JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id)").
		Count(&needNextOpp).Error

	// Card 5: Need Interview Support (from DB: students with interview misses / arrears)
	var needInterviewSupport int64
	_ = r.db.Table("master_users u").
		Joins("JOIN placement_drive_students pds ON u.id = pds.user_id").
		Joins("JOIN placement_stage_results psr ON pds.id = psr.drive_student_id").
		Where("u.role_id = 1 AND psr.outcome IN ('not_cleared', 'absent', 'withdrawn')").
		Distinct("u.id").
		Count(&needInterviewSupport).Error
	if needInterviewSupport == 0 {
		_ = r.db.Table("placement_student_basic_details").
			Where("current_arrear_count > 0 OR history_arrear_count > 0").
			Count(&needInterviewSupport).Error
	}

	return &models.ReviewAnalyticsResponse{
		StudentsInReview:         studentsCount,
		InvitationAcceptanceRate: acceptanceRate,
		StudentsWithOffers:       studentsWithOffers,
		NeedNextOpportunity:      needNextOpp,
		NeedInterviewSupport:     needInterviewSupport,
	}, nil
}

func getInitials(name string) string {
	parts := strings.Fields(strings.TrimSpace(name))
	if len(parts) == 0 {
		return "ST"
	}
	if len(parts) == 1 {
		runes := []rune(parts[0])
		if len(runes) >= 2 {
			return strings.ToUpper(string(runes[:2]))
		}
		return strings.ToUpper(string(runes))
	}
	first := string([]rune(parts[0])[0])
	last := string([]rune(parts[len(parts)-1])[0])
	return strings.ToUpper(first + last)
}

// GetReviewStudents returns the list of students matching the left-panel filters,
// computed metrics (Attendance %, Priority Score, Offers, Best Package), and sorted according to sortBy technique.
func (r *StudentReviewRepository) GetReviewStudents(filter models.ReviewAnalyticsFilter, sortBy string) ([]models.ReviewStudentListItem, error) {
	type StudentBaseRow struct {
		ID             uint64   `gorm:"column:id"`
		Name           string   `gorm:"column:name"`
		RollNo         *string  `gorm:"column:roll_no"`
		DepartmentName string   `gorm:"column:dept_name"`
		BatchName      string   `gorm:"column:batch_name"`
		CGPA           *float64 `gorm:"column:cgpa"`
	}

	query := r.db.Table("master_users u").
		Select("u.id, u.name, u.roll_no, d.name as dept_name, b.name as batch_name, s.cgpa").
		Joins("LEFT JOIN placement_student_basic_details s ON u.id = s.user_id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Joins("LEFT JOIN batches b ON u.batch_id = b.id").
		Where("u.role_id = 1")

	// 1. Academic Batch filter
	if filter.Batch != "" && filter.Batch != "all" {
		cleanBatch := strings.ReplaceAll(filter.Batch, "–", "-")
		cleanBatch = strings.TrimSpace(cleanBatch)
		query = query.Where("(b.name = ? OR b.name = ? OR b.id = ?)", filter.Batch, cleanBatch, cleanBatch)
	}

	// 2. Department filter
	if len(filter.Departments) > 0 {
		query = query.Where("(u.department_id IN (?) OR d.name IN (?))", filter.Departments, filter.Departments)
	}

	// 3. Student Category (placement_interested vs nip)
	if filter.StudentCategory == "nip" {
		query = query.Where("(COALESCE(s.nip, '0') = '1' OR COALESCE(s.ip, '1') = '0')")
	} else if filter.StudentCategory == "placement_interested" {
		query = query.Where("COALESCE(s.nip, '0') = '0' AND COALESCE(s.ip, '1') = '1'")

		// Placement Interested In: All, Software, Core
		if filter.PlacementInterestedIn == "software" {
			query = query.Where("COALESCE(s.software_company, '0') = '1'")
		} else if filter.PlacementInterestedIn == "core" {
			query = query.Where("COALESCE(s.core_company, '0') = '1'")
		}
	}

	// 4. Placement Status filter: "all", "placed", "not_placed"
	if filter.PlacementStatus == "placed" {
		offerSubQuery := r.db.Table("placement_drive_offers pdo").
			Select("DISTINCT pds.user_id").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id")
		query = query.Where("u.id IN (?)", offerSubQuery)
	} else if filter.PlacementStatus == "not_placed" {
		offerSubQuery := r.db.Table("placement_drive_offers pdo").
			Select("DISTINCT pds.user_id").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id")
		query = query.Where("u.id NOT IN (?)", offerSubQuery)
	}

	// 5. Offer Holders & Package Range (only applicable when placed or all)
	if filter.PlacementStatus != "not_placed" {
		if filter.OfferHolders == "one_offer" || filter.OfferHolders == "multiple_offers" {
			offerCountSubQuery := r.db.Table("placement_drive_offers pdo").
				Select("pds.user_id, COUNT(DISTINCT pdo.id) as offer_count").
				Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
				Group("pds.user_id")

			if filter.OfferHolders == "one_offer" {
				query = query.Joins("JOIN (?) off ON off.user_id = u.id AND off.offer_count = 1", offerCountSubQuery)
			} else if filter.OfferHolders == "multiple_offers" {
				query = query.Joins("JOIN (?) off ON off.user_id = u.id AND off.offer_count > 1", offerCountSubQuery)
			}
		}

		minPkg := 0.0
		if filter.PackageMin != nil {
			minPkg = *filter.PackageMin
		}
		maxPkg := 100.0
		if filter.PackageMax != nil {
			maxPkg = *filter.PackageMax
		}
		if minPkg > 0.0 || maxPkg < 100.0 {
			pkgSubQuery := r.db.Table("placement_drive_offers pdo").
				Select("pds.user_id, MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) as max_pkg").
				Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
				Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
				Group("pds.user_id")

			query = query.Joins("JOIN (?) pkg ON pkg.user_id = u.id AND pkg.max_pkg >= ? AND pkg.max_pkg <= ?", pkgSubQuery, minPkg, maxPkg)
		}
	}

	// 6. Final Round Failures filter
	if filter.FinalFailures != "" && filter.FinalFailures != "all" {
		failSubQuery := r.db.Table("placement_stage_results psr").
			Select("pds.user_id, COUNT(DISTINCT pds.drive_id) as fail_count").
			Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
			Where("psr.outcome IN ('not_cleared', 'absent', 'withdrawn')").
			Group("pds.user_id")

		if filter.FinalFailures == "1" {
			query = query.Joins("JOIN (?) fc ON fc.user_id = u.id AND fc.fail_count = 1", failSubQuery)
		} else if filter.FinalFailures == "2" {
			query = query.Joins("JOIN (?) fc ON fc.user_id = u.id AND fc.fail_count = 2", failSubQuery)
		} else if filter.FinalFailures == "more" || filter.FinalFailures == "3+" {
			query = query.Joins("JOIN (?) fc ON fc.user_id = u.id AND fc.fail_count >= 3", failSubQuery)
		}
	}

	// 7. Active Recruitment Process filter
	if strings.ToLower(filter.ActiveProcess) == "yes" {
		activeSubQuery := r.db.Table("placement_drive_students pds").
			Select("DISTINCT pds.user_id").
			Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
			Where("pds.drive_status != 'excluded' AND pd.overall_status IN ('active', 'in_progress', 'scheduled', 'ongoing')")
		query = query.Where("u.id IN (?)", activeSubQuery)
	} else if strings.ToLower(filter.ActiveProcess) == "no" {
		activeSubQuery := r.db.Table("placement_drive_students pds").
			Select("DISTINCT pds.user_id").
			Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
			Where("pds.drive_status != 'excluded' AND pd.overall_status IN ('active', 'in_progress', 'scheduled', 'ongoing')")
		query = query.Where("u.id NOT IN (?)", activeSubQuery)
	}

	var studentRows []StudentBaseRow
	if err := query.Scan(&studentRows).Error; err != nil {
		return nil, err
	}

	resultList := make([]models.ReviewStudentListItem, 0, len(studentRows))

	for _, s := range studentRows {
		rollNo := ""
		if s.RollNo != nil {
			rollNo = *s.RollNo
		}

		deptCode := formatDepartmentCode(s.DepartmentName)

		// Calculate Drive & Stage Metrics for student
		var eligibleCompanies int64
		_ = r.db.Table("placement_drive_students").
			Where("user_id = ? AND drive_status != 'excluded'", s.ID).
			Count(&eligibleCompanies).Error

		var companiesAttended int64
		_ = r.db.Table("placement_stage_results psr").
			Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
			Where("pds.user_id = ? AND psr.outcome IN ('cleared', 'not_cleared', 'absent', 'withdrawn')", s.ID).
			Select("COUNT(DISTINCT pds.drive_id)").
			Row().
			Scan(&companiesAttended)

		attendancePct := 0.0
		if eligibleCompanies > 0 {
			attendancePct = (float64(companiesAttended) / float64(eligibleCompanies)) * 100.0
			if attendancePct > 100.0 {
				attendancePct = 100.0
			}
		}

		var totalRoundsAttended int64
		_ = r.db.Table("placement_stage_results psr").
			Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
			Where("pds.user_id = ? AND psr.outcome IN ('cleared', 'not_cleared', 'absent', 'withdrawn')", s.ID).
			Count(&totalRoundsAttended).Error

		var roundsCleared int64
		_ = r.db.Table("placement_stage_results psr").
			Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
			Where("pds.user_id = ? AND psr.outcome = 'cleared'", s.ID).
			Count(&roundsCleared).Error

		roundsClearedPct := 0.0
		if totalRoundsAttended > 0 {
			roundsClearedPct = (float64(roundsCleared) / float64(totalRoundsAttended)) * 100.0
			if roundsClearedPct > 100.0 {
				roundsClearedPct = 100.0
			}
		}

		priorityScore := 0.0
		if eligibleCompanies > 0 && totalRoundsAttended > 0 {
			priorityScore = (attendancePct * 0.5) + (roundsClearedPct * 0.5)
		} else if eligibleCompanies > 0 {
			priorityScore = attendancePct * 0.5
		} else if totalRoundsAttended > 0 {
			priorityScore = roundsClearedPct * 0.5
		}

		attRank := 1
		if attendancePct > 90.0 {
			attRank = 4
		} else if attendancePct > 75.0 {
			attRank = 3
		} else if attendancePct > 50.0 {
			attRank = 2
		}

		roundsRank := 1
		if roundsClearedPct > 60.0 {
			roundsRank = 4
		} else if roundsClearedPct > 40.0 {
			roundsRank = 3
		} else if roundsClearedPct > 25.0 {
			roundsRank = 2
		}

		minRank := attRank
		if roundsRank < minRank {
			minRank = roundsRank
		}
		if eligibleCompanies == 0 || totalRoundsAttended == 0 {
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

		var offersCount int64
		_ = r.db.Table("placement_drive_offers pdo").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
			Where("pds.user_id = ?", s.ID).
			Count(&offersCount).Error

		var maxPackage *float64
		_ = r.db.Table("placement_drive_offers pdo").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
			Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
			Where("pds.user_id = ?", s.ID).
			Select("MAX(COALESCE(pdo.package_lpa, pd.package_lpa))").
			Row().
			Scan(&maxPackage)

		var failedProcesses int64
		_ = r.db.Table("placement_stage_results psr").
			Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
			Where("pds.user_id = ? AND psr.outcome IN ('not_cleared', 'absent', 'withdrawn')", s.ID).
			Select("COUNT(DISTINCT pds.drive_id)").
			Row().
			Scan(&failedProcesses)

		item := models.ReviewStudentListItem{
			ID:                  s.ID,
			Name:                s.Name,
			RollNo:              rollNo,
			DepartmentCode:      deptCode,
			DepartmentName:      s.DepartmentName,
			BatchName:           s.BatchName,
			CGPA:                s.CGPA,
			Initials:            getInitials(s.Name),
			CompaniesAttended:   int(companiesAttended),
			CompaniesEligible:   int(eligibleCompanies),
			AttendancePct:       attendancePct,
			PriorityScore:       priorityScore,
			PriorityLevel:       priorityLevel,
			OffersCount:         int(offersCount),
			UnsuccessfulCount:   int(failedProcesses),
			Attempts:            int(companiesAttended),
			TotalRoundsAttended: int(totalRoundsAttended),
			FailedProcesses:     int(failedProcesses),
			InvitationsCount:    int(eligibleCompanies),
			BestPackageLPA:      maxPackage,
			IsPlaced:            offersCount > 0,
		}

		if filter.OpportunityPriority != "" && filter.OpportunityPriority != "all" {
			reqPriority := strings.ToLower(filter.OpportunityPriority)
			studPriority := strings.ToLower(priorityLevel)
			if reqPriority == "needs_improvement" {
				if !strings.Contains(studPriority, "needs improvement") {
					continue
				}
			} else if reqPriority != studPriority {
				continue
			}
		}

		resultList = append(resultList, item)
	}

	// Apply Sorting Techniques
	switch strings.ToLower(sortBy) {
	case "most attempts", "most_attempts":
		sort.Slice(resultList, func(i, j int) bool {
			if resultList[i].Attempts != resultList[j].Attempts {
				return resultList[i].Attempts > resultList[j].Attempts
			}
			return resultList[i].TotalRoundsAttended > resultList[j].TotalRoundsAttended
		})
	case "most offers", "most_offers":
		sort.Slice(resultList, func(i, j int) bool {
			if resultList[i].OffersCount != resultList[j].OffersCount {
				return resultList[i].OffersCount > resultList[j].OffersCount
			}
			return resultList[i].PriorityScore > resultList[j].PriorityScore
		})
	case "highest package", "highest_package":
		sort.Slice(resultList, func(i, j int) bool {
			p1 := 0.0
			if resultList[i].BestPackageLPA != nil {
				p1 = *resultList[i].BestPackageLPA
			}
			p2 := 0.0
			if resultList[j].BestPackageLPA != nil {
				p2 = *resultList[j].BestPackageLPA
			}
			if p1 != p2 {
				return p1 > p2
			}
			return resultList[i].PriorityScore > resultList[j].PriorityScore
		})
	case "most failed processes", "most_failed_processes":
		sort.Slice(resultList, func(i, j int) bool {
			if resultList[i].FailedProcesses != resultList[j].FailedProcesses {
				return resultList[i].FailedProcesses > resultList[j].FailedProcesses
			}
			return resultList[i].PriorityScore > resultList[j].PriorityScore
		})
	case "most invitations", "most_invitations":
		sort.Slice(resultList, func(i, j int) bool {
			if resultList[i].InvitationsCount != resultList[j].InvitationsCount {
				return resultList[i].InvitationsCount > resultList[j].InvitationsCount
			}
			return resultList[i].PriorityScore > resultList[j].PriorityScore
		})
	default: // "Sort: Opportunity priority", "opportunity_priority"
		sort.Slice(resultList, func(i, j int) bool {
			if resultList[i].PriorityScore != resultList[j].PriorityScore {
				return resultList[i].PriorityScore > resultList[j].PriorityScore
			}
			return resultList[i].AttendancePct > resultList[j].AttendancePct
		})
	}

	return resultList, nil
}

// ExportStudentsExcel generates a native XLSX spreadsheet containing the requested student fields
func (r *StudentReviewRepository) ExportStudentsExcel(userIDs []uint64) ([]byte, error) {
	type StudentExportRow struct {
		ID                 uint64   `gorm:"column:id"`
		Name               string   `gorm:"column:name"`
		RollNo             *string  `gorm:"column:roll_no"`
		DepartmentName     string   `gorm:"column:dept_name"`
		BatchName          string   `gorm:"column:batch_name"`
		TenthMark          *float64 `gorm:"column:tenth_mark"`
		TwelthMark         *float64 `gorm:"column:twelth_mark"`
		CGPA               *float64 `gorm:"column:cgpa"`
		CurrentArrearCount int      `gorm:"column:current_arrear_count"`
		HistoryArrearCount int      `gorm:"column:history_arrear_count"`
	}

	query := r.db.Table("master_users u").
		Select("u.id, u.name, u.roll_no, COALESCE(d.name, 'Department') as dept_name, COALESCE(b.name, '') as batch_name, s.tenth_mark, s.twelth_mark, s.cgpa, COALESCE(s.current_arrear_count, 0) as current_arrear_count, COALESCE(s.history_arrear_count, 0) as history_arrear_count").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Joins("LEFT JOIN batches b ON u.batch_id = b.id").
		Joins("LEFT JOIN placement_student_basic_details s ON u.id = s.user_id").
		Where("u.role_id = 1")

	if len(userIDs) > 0 {
		query = query.Where("u.id IN (?)", userIDs)
	}

	var rows []StudentExportRow
	if err := query.Order("u.id ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}

	f := excelize.NewFile()
	defer f.Close()

	sheet := "Students"
	f.SetSheetName("Sheet1", sheet)

	headers := []string{
		"Name",
		"Roll No",
		"Department",
		"Batch",
		"10th",
		"12th",
		"CGPA",
		"Current Arrears",
		"History of Arrears",
		"Attended / Invitations",
		"Placed or Not Placed",
		"Offers with Package",
	}

	// Create header style
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Color: "#FFFFFF",
			Size:  11,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#1E40AF"},
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
			WrapText:   true,
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#CBD5E1", Style: 1},
			{Type: "bottom", Color: "#CBD5E1", Style: 1},
			{Type: "left", Color: "#CBD5E1", Style: 1},
			{Type: "right", Color: "#CBD5E1", Style: 1},
		},
	})

	// Create data row styles
	dataStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{
			Vertical: "center",
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#E2E8F0", Style: 1},
			{Type: "bottom", Color: "#E2E8F0", Style: 1},
			{Type: "left", Color: "#E2E8F0", Style: 1},
			{Type: "right", Color: "#E2E8F0", Style: 1},
		},
	})

	centerStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#E2E8F0", Style: 1},
			{Type: "bottom", Color: "#E2E8F0", Style: 1},
			{Type: "left", Color: "#E2E8F0", Style: 1},
			{Type: "right", Color: "#E2E8F0", Style: 1},
		},
	})

	placedStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Color: "#854D0E",
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#FEF9C3"},
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#E2E8F0", Style: 1},
			{Type: "bottom", Color: "#E2E8F0", Style: 1},
			{Type: "left", Color: "#E2E8F0", Style: 1},
			{Type: "right", Color: "#E2E8F0", Style: 1},
		},
	})

	notPlacedStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Color: "#92400E",
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#FEF3C7"},
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#E2E8F0", Style: 1},
			{Type: "bottom", Color: "#E2E8F0", Style: 1},
			{Type: "left", Color: "#E2E8F0", Style: 1},
			{Type: "right", Color: "#E2E8F0", Style: 1},
		},
	})

	// Set row height for header
	_ = f.SetRowHeight(sheet, 1, 28)

	// Write headers
	for colIdx, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
		_ = f.SetCellStyle(sheet, cell, cell, headerStyle)
	}

	// Write data rows
	for rowIdx, st := range rows {
		rowNum := rowIdx + 2
		_ = f.SetRowHeight(sheet, rowNum, 22)

		rollNo := ""
		if st.RollNo != nil {
			rollNo = *st.RollNo
		}

		tenthStr := "—"
		if st.TenthMark != nil {
			tenthStr = fmt.Sprintf("%.2f%%", *st.TenthMark)
		}

		twelfthStr := "—"
		if st.TwelthMark != nil {
			twelfthStr = fmt.Sprintf("%.2f%%", *st.TwelthMark)
		}

		cgpaStr := "—"
		if st.CGPA != nil {
			cgpaStr = fmt.Sprintf("%.2f", *st.CGPA)
		}

		// Calculate Attended / Invitations
		var eligibleCount int64
		_ = r.db.Table("placement_drive_students").
			Where("user_id = ? AND drive_status != 'excluded'", st.ID).
			Count(&eligibleCount).Error

		var attendedCount int64
		_ = r.db.Table("placement_stage_results psr").
			Joins("JOIN placement_drive_students pds ON psr.drive_student_id = pds.id").
			Where("pds.user_id = ? AND psr.outcome IN ('cleared', 'not_cleared', 'absent', 'withdrawn')", st.ID).
			Select("COUNT(DISTINCT pds.drive_id)").
			Row().
			Scan(&attendedCount)

		attInvStr := fmt.Sprintf("%d / %d", attendedCount, eligibleCount)

		// Calculate Offers with Package
		type OfferItemRow struct {
			CompanyName string   `gorm:"column:company_name"`
			PackageLPA  *float64 `gorm:"column:package_lpa"`
		}
		var offerList []OfferItemRow
		_ = r.db.Table("placement_drive_offers pdo").
			Select("COALESCE(pc.company_name, 'Company') as company_name, COALESCE(pdo.package_lpa, pd.package_lpa) as package_lpa").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
			Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
			Joins("LEFT JOIN placement_company pc ON pd.company_id = pc.id").
			Where("pds.user_id = ?", st.ID).
			Order("pdo.id ASC").
			Scan(&offerList).Error

		isPlaced := len(offerList) > 0
		placedStr := "Not Placed"
		if isPlaced {
			placedStr = "Placed"
		}

		offersFormatted := make([]string, 0, len(offerList))
		for _, off := range offerList {
			if off.PackageLPA != nil && *off.PackageLPA > 0 {
				offersFormatted = append(offersFormatted, fmt.Sprintf("%s (%.2f LPA)", off.CompanyName, *off.PackageLPA))
			} else {
				offersFormatted = append(offersFormatted, off.CompanyName)
			}
		}

		offersStr := "—"
		if len(offersFormatted) > 0 {
			offersStr = strings.Join(offersFormatted, ", ")
		}

		rowValues := []interface{}{
			st.Name,
			rollNo,
			st.DepartmentName,
			st.BatchName,
			tenthStr,
			twelfthStr,
			cgpaStr,
			st.CurrentArrearCount,
			st.HistoryArrearCount,
			attInvStr,
			placedStr,
			offersStr,
		}

		for colIdx, val := range rowValues {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowNum)
			_ = f.SetCellValue(sheet, cell, val)

			if colIdx == 10 { // Placed or Not Placed
				if isPlaced {
					_ = f.SetCellStyle(sheet, cell, cell, placedStyle)
				} else {
					_ = f.SetCellStyle(sheet, cell, cell, notPlacedStyle)
				}
			} else if colIdx == 1 || colIdx == 3 || colIdx == 4 || colIdx == 5 || colIdx == 6 || colIdx == 7 || colIdx == 8 || colIdx == 9 {
				_ = f.SetCellStyle(sheet, cell, cell, centerStyle)
			} else {
				_ = f.SetCellStyle(sheet, cell, cell, dataStyle)
			}
		}
	}

	// Auto-fit column widths
	colWidths := map[int]float64{
		1:  22, // Name
		2:  14, // Roll No
		3:  32, // Department
		4:  15, // Batch
		5:  12, // 10th
		6:  12, // 12th
		7:  10, // CGPA
		8:  16, // Current Arrears
		9:  18, // History of Arrears
		10: 22, // Attended / Invitations
		11: 20, // Placed or Not Placed
		12: 40, // Offers with Package
	}
	for colIdx, width := range colWidths {
		colName, _ := excelize.ColumnNumberToName(colIdx)
		_ = f.SetColWidth(sheet, colName, colName, width)
	}

	buffer, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}

	return buffer.Bytes(), nil
}




