package repositories

import (
	"fmt"
	"strings"
	"placement-management/config"
	"placement-management/models"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

type PlacementIntelligenceRepository struct {
	db *gorm.DB
}

func NewPlacementIntelligenceRepository() *PlacementIntelligenceRepository {
	return &PlacementIntelligenceRepository{
		db: config.DB,
	}
}

// GetBatchSummaries calculates batch-wise real student counts and placement outcomes from the database
func (r *PlacementIntelligenceRepository) GetBatchSummaries() ([]models.BatchPlacementSummary, error) {
	var batches []models.Batch
	if err := r.db.Order("name ASC").Find(&batches).Error; err != nil {
		return nil, err
	}

	summaries := make([]models.BatchPlacementSummary, 0, len(batches))

	for _, b := range batches {
		var summary models.BatchPlacementSummary
		summary.ID = b.ID
		summary.BatchName = b.Name

		// Total students in this batch (role_id = 1)
		r.db.Table("master_users").
			Where("role_id = 1 AND batch_id = ?", b.ID).
			Count(&summary.TotalStudents)

		// Total NIP count (students opted for NIP or not interested in placement)
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id = ? AND (COALESCE(s.nip, '0') = '1' OR COALESCE(s.ip, '1') = '0' OR COALESCE(s.higher_studies, '0') = '1' OR COALESCE(s.startup, '0') = '1' OR COALESCE(s.business, '0') = '1')", b.ID).
			Count(&summary.NipCount)

		// Higher Studies count
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id = ? AND COALESCE(s.higher_studies, '0') = '1'", b.ID).
			Count(&summary.HigherStudiesCount)

		// Startup count
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id = ? AND COALESCE(s.startup, '0') = '1'", b.ID).
			Count(&summary.StartupCount)

		// Business count
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id = ? AND COALESCE(s.business, '0') = '1'", b.ID).
			Count(&summary.BusinessCount)

		// Placed count (students who received at least one offer)
		r.db.Table("master_users u").
			Where("u.role_id = 1 AND u.batch_id = ?", b.ID).
			Where("u.id IN (SELECT DISTINCT pds.user_id FROM placement_drive_offers pdo JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id)").
			Count(&summary.PlacedStudents)

		// Total offers released for this batch
		r.db.Table("placement_drive_offers pdo").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
			Joins("JOIN master_users u ON pds.user_id = u.id").
			Where("u.role_id = 1 AND u.batch_id = ?", b.ID).
			Count(&summary.OffersCount)

		// Not Eligible count (no logic for now)
		summary.NotEligibleCount = 0

		// Not Placed count = Total students - Placed students - Higher studies - Startup/Business
		notPlaced := summary.TotalStudents - summary.PlacedStudents - summary.HigherStudiesCount - (summary.StartupCount + summary.BusinessCount)
		if notPlaced < 0 {
			notPlaced = summary.TotalStudents - summary.PlacedStudents
		}
		if notPlaced < 0 {
			notPlaced = 0
		}
		summary.NotPlacedStudents = notPlaced

		summaries = append(summaries, summary)
	}

	return summaries, nil
}

// GetOutcomeGroupSummary aggregates outcome metrics overall or for a given batch
func (r *PlacementIntelligenceRepository) GetOutcomeGroupSummary(batchID string) (*models.OutcomeGroupSummary, error) {
	var summary models.OutcomeGroupSummary

	// Batch condition filter
	batchCondition := "u.role_id = 1"
	var args []interface{}
	if batchID != "" && batchID != "all" {
		batchCondition += " AND (u.batch_id = ? OR EXISTS (SELECT 1 FROM batches b WHERE b.id = u.batch_id AND (b.name = ? OR b.name LIKE ?)))"
		args = append(args, batchID, batchID, "%"+batchID+"%")
	}

	// Higher Studies
	r.db.Table("master_users u").
		Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
		Where(batchCondition, args...).
		Where("COALESCE(s.higher_studies, '0') = '1'").
		Count(&summary.HigherStudiesCount)

	// Entrepreneurship (Startup or Business enum '1')
	r.db.Table("master_users u").
		Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
		Where(batchCondition, args...).
		Where("(COALESCE(s.startup, '0') IN ('1', 'true', 'yes') OR COALESCE(s.business, '0') IN ('1', 'true', 'yes'))").
		Count(&summary.EntrepreneurCount)

	// Not Eligible (no logic for now)
	summary.NotEligibleCount = 0

	// Total students in scope
	var totalStudents int64
	r.db.Table("master_users u").
		Where(batchCondition, args...).
		Count(&totalStudents)

	// Placed students in scope
	var placedStudents int64
	r.db.Table("master_users u").
		Where(batchCondition, args...).
		Where("u.id IN (SELECT DISTINCT pds.user_id FROM placement_drive_offers pdo JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id)").
		Count(&placedStudents)

	// Not Placed count consistent with GetBatchSummaries: Total - Placed - Higher Studies - Entrepreneur
	notPlaced := totalStudents - placedStudents - summary.HigherStudiesCount - summary.EntrepreneurCount
	if notPlaced < 0 {
		notPlaced = totalStudents - placedStudents
	}
	if notPlaced < 0 {
		notPlaced = 0
	}
	summary.NotPlacedCount = notPlaced

	return &summary, nil
}

// GetOverallPlacementMatrix computes salary scale and unique best offer matrices from real DB
func (r *PlacementIntelligenceRepository) GetOverallPlacementMatrix(batchParam, deptParam string) (*models.OverallPlacementStatsResponse, error) {
	// 1. Fetch batches from DB
	var batches []models.Batch
	bQuery := r.db.Order("name ASC")
	if batchParam != "" && batchParam != "all" && batchParam != "All" {
		// Clean batchParam for matching e.g. "2026-27" -> "2027", "2022-2026", en-dash vs hyphen
		cleanBatch := strings.ReplaceAll(batchParam, "–", "-")
		cleanBatch = strings.ReplaceAll(cleanBatch, "—", "-")
		cleanBatch = strings.TrimSpace(cleanBatch)
		bQuery = bQuery.Where("id = ? OR name = ? OR name LIKE ? OR REPLACE(REPLACE(name, '–', '-'), '—', '-') LIKE ?",
			batchParam, cleanBatch, "%"+cleanBatch+"%", "%"+cleanBatch+"%")
	}
	if err := bQuery.Find(&batches).Error; err != nil {
		return nil, err
	}

	// 2. Department condition
	deptCond := ""
	var deptArgs []interface{}
	if deptParam != "" && deptParam != "all" && deptParam != "All" && deptParam != "All Departments" {
		lowerDept := strings.ToLower(deptParam)
		searchPattern := "%" + deptParam + "%"
		if lowerDept == "cse" || strings.Contains(lowerDept, "computer") {
			searchPattern = "%Computer Science%"
		} else if lowerDept == "it" || strings.Contains(lowerDept, "information") {
			searchPattern = "%Information Technology%"
		} else if lowerDept == "ece" || strings.Contains(lowerDept, "electronics") {
			searchPattern = "%Electronics%"
		} else if lowerDept == "eee" || strings.Contains(lowerDept, "electrical") {
			searchPattern = "%Electrical%"
		} else if lowerDept == "mech" || strings.Contains(lowerDept, "mechanical") {
			searchPattern = "%Mechanical%"
		} else if lowerDept == "civil" {
			searchPattern = "%Civil%"
		}

		deptCond = " AND (u.department_id = ? OR EXISTS (SELECT 1 FROM departments d WHERE d.id = u.department_id AND (d.name = ? OR d.name LIKE ?)))"
		deptArgs = append(deptArgs, deptParam, deptParam, searchPattern)
	}

	var response models.OverallPlacementStatsResponse
	response.OffersBySalaryScale = make([]models.BatchOffersSalaryRow, 0, len(batches))
	response.UniqueStudentsByOffer = make([]models.BatchUniqueStudentsRow, 0, len(batches))

	for _, b := range batches {
		var offerRow models.BatchOffersSalaryRow
		offerRow.BatchID = b.ID
		offerRow.Batch = b.Name

		var uniqueRow models.BatchUniqueStudentsRow
		uniqueRow.BatchID = b.ID
		uniqueRow.Batch = b.Name

		// Total students in this batch + dept
		baseArgs := append([]interface{}{b.ID}, deptArgs...)
		r.db.Table("master_users u").
			Where("u.role_id = 1 AND u.batch_id = ?"+deptCond, baseArgs...).
			Count(&offerRow.TotalStudents)
		uniqueRow.Total = offerRow.TotalStudents

		// Fetch all offers for this batch (+ dept)
		type OfferRecord struct {
			UserID     uint64  `gorm:"column:user_id"`
			PackageLPA float64 `gorm:"column:package_lpa"`
		}
		var offers []OfferRecord
		r.db.Table("placement_drive_offers pdo").
			Select("pds.user_id, COALESCE(pdo.package_lpa, pd.package_lpa, 0) as package_lpa").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
			Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
			Joins("JOIN master_users u ON pds.user_id = u.id").
			Where("u.role_id = 1 AND u.batch_id = ?"+deptCond, baseArgs...).
			Scan(&offers)

		// Categorize offers by salary scale
		userMaxOffer := make(map[uint64]float64)
		for _, off := range offers {
			pkg := off.PackageLPA
			if pkg > 40 {
				offerRow.Offers.Gt40++
			} else if pkg >= 30 {
				offerRow.Offers.P30_40++
			} else if pkg >= 20 {
				offerRow.Offers.P20_30++
			} else if pkg >= 10 {
				offerRow.Offers.P10_20++
			} else if pkg >= 6 {
				offerRow.Offers.P6_10++
			} else if pkg >= 4 {
				offerRow.Offers.P4_6++
			} else if pkg >= 3 {
				offerRow.Offers.P3_4++
			}

			if curMax, exists := userMaxOffer[off.UserID]; !exists || pkg > curMax {
				userMaxOffer[off.UserID] = pkg
			}
		}

		// Categorize unique students by best offer
		for _, bestPkg := range userMaxOffer {
			if bestPkg > 40 {
				uniqueRow.Unique.Gt40++
			} else if bestPkg >= 30 {
				uniqueRow.Unique.P30_40++
			} else if bestPkg >= 20 {
				uniqueRow.Unique.P20_30++
			} else if bestPkg >= 10 {
				uniqueRow.Unique.P10_20++
			} else if bestPkg >= 6 {
				uniqueRow.Unique.P6_10++
			} else if bestPkg >= 4 {
				uniqueRow.Unique.P4_6++
			} else if bestPkg >= 3 {
				uniqueRow.Unique.P3_4++
			}
		}

		// Higher Studies count
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id = ? AND COALESCE(s.higher_studies, '0') = '1'"+deptCond, baseArgs...).
			Count(&uniqueRow.HigherStudies)

		// Entrepreneurship (Startup or Business enum '1')
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id = ? AND (COALESCE(s.startup, '0') IN ('1', 'true', 'yes') OR COALESCE(s.business, '0') IN ('1', 'true', 'yes'))"+deptCond, baseArgs...).
			Count(&uniqueRow.Entrepreneurship)

		// Not Eligible (no logic for now)
		uniqueRow.NotEligible = 0

		// Placed count
		placedStudents := int64(len(userMaxOffer))

		// Not Placed = Total - Placed - Higher Studies - Entrepreneurship
		notPlaced := offerRow.TotalStudents - placedStudents - uniqueRow.HigherStudies - uniqueRow.Entrepreneurship
		if notPlaced < 0 {
			notPlaced = offerRow.TotalStudents - placedStudents
		}
		if notPlaced < 0 {
			notPlaced = 0
		}
		uniqueRow.NotPlaced = notPlaced

		response.OffersBySalaryScale = append(response.OffersBySalaryScale, offerRow)
		response.UniqueStudentsByOffer = append(response.UniqueStudentsByOffer, uniqueRow)

		// Aggregate to Signals
		response.Signals.TotalOffers += int64(len(offers))
		response.Signals.UniqueOfferHolders += placedStudents
		response.Signals.NotYetPlaced += notPlaced
		response.Signals.HigherStudies += uniqueRow.HigherStudies
		response.Signals.Entrepreneurship += uniqueRow.Entrepreneurship
	}

	return &response, nil
}

// ExportOverallPlacementMatrixExcel generates a styled Excel spreadsheet containing:
// 1. Number of Offers by Salary Scale
// 2. Unique Students by Best Offer
// with the exact styling (navy header, clear borders, tags) matching Student Placement Review export
func (r *PlacementIntelligenceRepository) ExportOverallPlacementMatrixExcel(batchParam, deptParam string) ([]byte, error) {
	matrix, err := r.GetOverallPlacementMatrix(batchParam, deptParam)
	if err != nil {
		return nil, err
	}

	f := excelize.NewFile()
	defer f.Close()

	sheet := "Overall Statistics"
	f.SetSheetName("Sheet1", sheet)

	// Styles
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

	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Color: "#172554",
			Size:  14,
		},
		Alignment: &excelize.Alignment{
			Vertical: "center",
		},
	})

	subtitleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Color: "#64748B",
			Size:  10,
		},
		Alignment: &excelize.Alignment{
			Vertical: "center",
		},
	})

	secTitleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Color: "#1E293B",
			Size:  12,
		},
		Alignment: &excelize.Alignment{
			Vertical: "center",
		},
	})

	batchColStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Color: "#1E293B",
			Size:  11,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "left",
			Vertical:   "center",
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#E2E8F0", Style: 1},
			{Type: "bottom", Color: "#E2E8F0", Style: 1},
			{Type: "left", Color: "#E2E8F0", Style: 1},
			{Type: "right", Color: "#E2E8F0", Style: 1},
		},
	})

	centerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Color: "#334155",
			Size:  11,
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

	highlightStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Color: "#2563EB",
			Size:  11,
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
			Size:  11,
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

	// Row 1: Document Title
	_ = f.SetRowHeight(sheet, 1, 28)
	_ = f.SetCellValue(sheet, "A1", "OVERALL PLACEMENT STATISTICS")
	_ = f.SetCellStyle(sheet, "A1", "A1", titleStyle)

	// Row 2: Subtitle with filters
	filterInfo := "All Graduating Batches | All Departments"
	if batchParam != "" && batchParam != "All" {
		filterInfo = fmt.Sprintf("Batch: %s", batchParam)
	}
	if deptParam != "" && deptParam != "All" {
		filterInfo += fmt.Sprintf(" | Department: %s", deptParam)
	}
	_ = f.SetRowHeight(sheet, 2, 20)
	_ = f.SetCellValue(sheet, "A2", filterInfo)
	_ = f.SetCellStyle(sheet, "A2", "A2", subtitleStyle)

	// ----------------------------------------------------
	// TABLE 1: Number of Offers by Salary Scale
	// ----------------------------------------------------
	currRow := 4
	_ = f.SetRowHeight(sheet, currRow, 24)
	_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", currRow), "Number of Offers by Salary Scale")
	_ = f.SetCellStyle(sheet, fmt.Sprintf("A%d", currRow), fmt.Sprintf("A%d", currRow), secTitleStyle)

	currRow++
	_ = f.SetRowHeight(sheet, currRow, 18)
	_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", currRow), "Every confirmed offer is counted. One student may contribute to multiple salary bands when holding multiple offers.")
	_ = f.SetCellStyle(sheet, fmt.Sprintf("A%d", currRow), fmt.Sprintf("A%d", currRow), subtitleStyle)

	currRow++
	t1HeaderRow := currRow
	_ = f.SetRowHeight(sheet, t1HeaderRow, 28)
	t1Headers := []string{
		"Batch",
		"Total Students",
		"> ₹40L",
		"₹30–40L",
		"₹20–30L",
		"₹10–20L",
		"₹6–10L",
		"₹4–6L",
		"₹3–4L",
	}
	for i, h := range t1Headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, t1HeaderRow)
		_ = f.SetCellValue(sheet, cell, h)
		_ = f.SetCellStyle(sheet, cell, cell, headerStyle)
	}

	for _, r1 := range matrix.OffersBySalaryScale {
		currRow++
		_ = f.SetRowHeight(sheet, currRow, 22)
		cells := []interface{}{
			fmt.Sprintf("Batch %s", r1.Batch),
			r1.TotalStudents,
			r1.Offers.Gt40,
			r1.Offers.P30_40,
			r1.Offers.P20_30,
			r1.Offers.P10_20,
			r1.Offers.P6_10,
			r1.Offers.P4_6,
			r1.Offers.P3_4,
		}
		for i, val := range cells {
			cell, _ := excelize.CoordinatesToCellName(i+1, currRow)
			_ = f.SetCellValue(sheet, cell, val)
			if i == 0 {
				_ = f.SetCellStyle(sheet, cell, cell, batchColStyle)
			} else if i >= 2 && val.(int64) > 0 {
				_ = f.SetCellStyle(sheet, cell, cell, highlightStyle)
			} else {
				_ = f.SetCellStyle(sheet, cell, cell, centerStyle)
			}
		}
	}

	// ----------------------------------------------------
	// TABLE 2: Unique Students by Best Offer
	// ----------------------------------------------------
	currRow += 3
	_ = f.SetRowHeight(sheet, currRow, 24)
	_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", currRow), "Unique Students by Best Offer")
	_ = f.SetCellStyle(sheet, fmt.Sprintf("A%d", currRow), fmt.Sprintf("A%d", currRow), secTitleStyle)

	currRow++
	_ = f.SetRowHeight(sheet, currRow, 18)
	_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", currRow), "Every student is counted once under the salary band of the student's highest confirmed offer.")
	_ = f.SetCellStyle(sheet, fmt.Sprintf("A%d", currRow), fmt.Sprintf("A%d", currRow), subtitleStyle)

	currRow++
	t2HeaderRow := currRow
	_ = f.SetRowHeight(sheet, t2HeaderRow, 28)
	t2Headers := []string{
		"Batch",
		"Total",
		"> ₹40L",
		"₹30–40L",
		"₹20–30L",
		"₹10–20L",
		"₹6–10L",
		"₹4–6L",
		"₹3–4L",
		"Not Eligible",
		"Entrepreneurship",
		"Higher Studies",
		"Not Placed",
	}
	for i, h := range t2Headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, t2HeaderRow)
		_ = f.SetCellValue(sheet, cell, h)
		_ = f.SetCellStyle(sheet, cell, cell, headerStyle)
	}

	for _, r2 := range matrix.UniqueStudentsByOffer {
		currRow++
		_ = f.SetRowHeight(sheet, currRow, 22)
		cells := []interface{}{
			fmt.Sprintf("Batch %s", r2.Batch),
			r2.Total,
			r2.Unique.Gt40,
			r2.Unique.P30_40,
			r2.Unique.P20_30,
			r2.Unique.P10_20,
			r2.Unique.P6_10,
			r2.Unique.P4_6,
			r2.Unique.P3_4,
			r2.NotEligible,
			r2.Entrepreneurship,
			r2.HigherStudies,
			r2.NotPlaced,
		}
		for i, val := range cells {
			cell, _ := excelize.CoordinatesToCellName(i+1, currRow)
			_ = f.SetCellValue(sheet, cell, val)
			if i == 0 {
				_ = f.SetCellStyle(sheet, cell, cell, batchColStyle)
			} else if i == 12 { // Not Placed
				_ = f.SetCellStyle(sheet, cell, cell, notPlacedStyle)
			} else if i >= 2 && i <= 8 && val.(int64) > 0 {
				_ = f.SetCellStyle(sheet, cell, cell, highlightStyle)
			} else {
				_ = f.SetCellStyle(sheet, cell, cell, centerStyle)
			}
		}
	}

	// Auto column widths
	colWidths := map[int]float64{
		1:  20, // Batch
		2:  16, // Total Students / Total
		3:  14, // > ₹40L
		4:  14, // ₹30–40L
		5:  14, // ₹20–30L
		6:  14, // ₹10–20L
		7:  14, // ₹6–10L
		8:  14, // ₹4–6L
		9:  14, // ₹3–4L
		10: 17, // Not Eligible
		11: 20, // Entrepreneurship
		12: 18, // Higher Studies
		13: 16, // Not Placed
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

// GetOutcomeGroupStudents returns students belonging to the chosen outcome group (notPlaced, higherStudies, entrepreneur, or salary bands)
func (r *PlacementIntelligenceRepository) GetOutcomeGroupStudents(outcomeParam, batchParam, deptParam, typeParam string) ([]models.IntelligenceOutcomeStudent, error) {
	cleanBatch := strings.ReplaceAll(batchParam, "–", "-")
	cleanBatch = strings.ReplaceAll(cleanBatch, "—", "-")
	cleanBatch = strings.TrimSpace(cleanBatch)
	cleanBatch = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(cleanBatch, "Batch"), "batch"))

	normalizedOutcome := strings.ToLower(strings.TrimSpace(outcomeParam))

	// Check if outcomeParam is a salary band
	var isSalaryBand bool
	var whereBand string
	var havingClause string

	switch normalizedOutcome {
	case "gt40", ">40l", ">40", "> 40l":
		isSalaryBand = true
		whereBand = "COALESCE(pdo.package_lpa, pd.package_lpa, 0) > 40"
		havingClause = "MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) > 40"
	case "p30_40", "30-40l", "30-40", "30_40":
		isSalaryBand = true
		whereBand = "COALESCE(pdo.package_lpa, pd.package_lpa, 0) >= 30 AND COALESCE(pdo.package_lpa, pd.package_lpa, 0) <= 40"
		havingClause = "MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) >= 30 AND MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) <= 40"
	case "p20_30", "20-30l", "20-30", "20_30":
		isSalaryBand = true
		whereBand = "COALESCE(pdo.package_lpa, pd.package_lpa, 0) >= 20 AND COALESCE(pdo.package_lpa, pd.package_lpa, 0) < 30"
		havingClause = "MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) >= 20 AND MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) < 30"
	case "p10_20", "10-20l", "10-20", "10_20":
		isSalaryBand = true
		whereBand = "COALESCE(pdo.package_lpa, pd.package_lpa, 0) >= 10 AND COALESCE(pdo.package_lpa, pd.package_lpa, 0) < 20"
		havingClause = "MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) >= 10 AND MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) < 20"
	case "p6_10", "6-10l", "6-10", "6_10":
		isSalaryBand = true
		whereBand = "COALESCE(pdo.package_lpa, pd.package_lpa, 0) >= 6 AND COALESCE(pdo.package_lpa, pd.package_lpa, 0) < 10"
		havingClause = "MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) >= 6 AND MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) < 10"
	case "p4_6", "4-6l", "4-6", "4_6":
		isSalaryBand = true
		whereBand = "COALESCE(pdo.package_lpa, pd.package_lpa, 0) >= 4 AND COALESCE(pdo.package_lpa, pd.package_lpa, 0) < 6"
		havingClause = "MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) >= 4 AND MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) < 6"
	case "p3_4", "3-4l", "3-4", "3_4":
		isSalaryBand = true
		whereBand = "COALESCE(pdo.package_lpa, pd.package_lpa, 0) >= 3 AND COALESCE(pdo.package_lpa, pd.package_lpa, 0) < 4"
		havingClause = "MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) >= 3 AND MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) < 4"
	}

	if isSalaryBand {
		query := r.db.Table("master_users u").
			Select("u.id, u.name, u.roll_no, u.department_id, COALESCE(d.name, '') as department_name, u.batch_id, b.name as batch_name, COALESCE(s.cgpa, 0) as cgpa, MAX(COALESCE(pdo.package_lpa, pd.package_lpa, 0)) as package_lpa").
			Joins("JOIN batches b ON u.batch_id = b.id").
			Joins("LEFT JOIN departments d ON u.department_id = d.id").
			Joins("LEFT JOIN placement_student_basic_details s ON u.id = s.user_id").
			Joins("JOIN placement_drive_students pds ON u.id = pds.user_id").
			Joins("JOIN placement_drive_offers pdo ON pds.id = pdo.drive_student_id").
			Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
			Where("u.role_id = 1")

		if cleanBatch != "" && cleanBatch != "all" && cleanBatch != "All" {
			query = query.Where("u.batch_id = ? OR b.name = ? OR b.name LIKE ? OR REPLACE(REPLACE(b.name, '–', '-'), '—', '-') LIKE ?",
				cleanBatch, cleanBatch, "%"+cleanBatch+"%", "%"+cleanBatch+"%")
		}

		if deptParam != "" && deptParam != "all" && deptParam != "All" && deptParam != "All Departments" {
			lowerDept := strings.ToLower(deptParam)
			searchPattern := "%" + deptParam + "%"
			if lowerDept == "cse" || strings.Contains(lowerDept, "computer") {
				searchPattern = "%Computer Science%"
			} else if lowerDept == "it" || strings.Contains(lowerDept, "information") {
				searchPattern = "%Information Technology%"
			} else if lowerDept == "ece" || strings.Contains(lowerDept, "electronics") {
				searchPattern = "%Electronics%"
			} else if lowerDept == "eee" || strings.Contains(lowerDept, "electrical") {
				searchPattern = "%Electrical%"
			} else if lowerDept == "mech" || strings.Contains(lowerDept, "mechanical") {
				searchPattern = "%Mechanical%"
			} else if lowerDept == "civil" {
				searchPattern = "%Civil%"
			}
			query = query.Where("u.department_id = ? OR d.name = ? OR d.name LIKE ?", deptParam, deptParam, searchPattern)
		}

		if strings.ToLower(strings.TrimSpace(typeParam)) == "unique" {
			query = query.Group("u.id, u.name, u.roll_no, u.department_id, d.name, u.batch_id, b.name, s.cgpa").
				Having(havingClause).
				Order("package_lpa DESC, u.name ASC")
		} else {
			// type is offers / offer volume (default): include all students with an offer in this band
			query = query.Where(whereBand).
				Group("u.id, u.name, u.roll_no, u.department_id, d.name, u.batch_id, b.name, s.cgpa").
				Order("package_lpa DESC, u.name ASC")
		}

		type SalaryStudentRow struct {
			ID             uint64  `gorm:"column:id"`
			Name           string  `gorm:"column:name"`
			RollNo         string  `gorm:"column:roll_no"`
			DepartmentID   uint64  `gorm:"column:department_id"`
			DepartmentName string  `gorm:"column:department_name"`
			BatchID        uint64  `gorm:"column:batch_id"`
			BatchName      string  `gorm:"column:batch_name"`
			CGPA           float64 `gorm:"column:cgpa"`
			PackageLPA     float64 `gorm:"column:package_lpa"`
		}

		var rawSalaryList []SalaryStudentRow
		if err := query.Scan(&rawSalaryList).Error; err != nil {
			return nil, err
		}

		result := make([]models.IntelligenceOutcomeStudent, 0, len(rawSalaryList))
		for _, s := range rawSalaryList {
			code := getDeptCode(s.DepartmentName)
			statusStr := fmt.Sprintf("₹%g LPA", s.PackageLPA)
			result = append(result, models.IntelligenceOutcomeStudent{
				ID:             s.ID,
				Name:           s.Name,
				RollNo:         s.RollNo,
				DepartmentID:   s.DepartmentID,
				DepartmentName: s.DepartmentName,
				DepartmentCode: code,
				BatchID:        s.BatchID,
				BatchName:      s.BatchName,
				CGPA:           s.CGPA,
				Status:         statusStr,
				OutcomeGroup:   normalizedOutcome,
				PackageLPA:     s.PackageLPA,
			})
		}
		return result, nil
	}

	query := r.db.Table("master_users u").
		Select("u.id, u.name, u.roll_no, u.department_id, COALESCE(d.name, '') as department_name, u.batch_id, b.name as batch_name, COALESCE(s.cgpa, 0) as cgpa").
		Joins("JOIN batches b ON u.batch_id = b.id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Joins("LEFT JOIN placement_student_basic_details s ON u.id = s.user_id").
		Where("u.role_id = 1")

	// Batch filter
	if cleanBatch != "" && cleanBatch != "all" && cleanBatch != "All" {
		query = query.Where("u.batch_id = ? OR b.name = ? OR b.name LIKE ? OR REPLACE(REPLACE(b.name, '–', '-'), '—', '-') LIKE ?",
			cleanBatch, cleanBatch, "%"+cleanBatch+"%", "%"+cleanBatch+"%")
	}

	// Department filter
	if deptParam != "" && deptParam != "all" && deptParam != "All" && deptParam != "All Departments" {
		lowerDept := strings.ToLower(deptParam)
		searchPattern := "%" + deptParam + "%"
		if lowerDept == "cse" || strings.Contains(lowerDept, "computer") {
			searchPattern = "%Computer Science%"
		} else if lowerDept == "it" || strings.Contains(lowerDept, "information") {
			searchPattern = "%Information Technology%"
		} else if lowerDept == "ece" || strings.Contains(lowerDept, "electronics") {
			searchPattern = "%Electronics%"
		} else if lowerDept == "eee" || strings.Contains(lowerDept, "electrical") {
			searchPattern = "%Electrical%"
		} else if lowerDept == "mech" || strings.Contains(lowerDept, "mechanical") {
			searchPattern = "%Mechanical%"
		} else if lowerDept == "civil" {
			searchPattern = "%Civil%"
		}
		query = query.Where("u.department_id = ? OR d.name = ? OR d.name LIKE ?", deptParam, deptParam, searchPattern)
	}

	var statusLabel string

	switch normalizedOutcome {
	case "higherstudies", "higher_studies":
		query = query.Where("COALESCE(s.higher_studies, '0') IN ('1', 'true', 'yes')")
		statusLabel = "Higher Studies"

	case "entrepreneur", "entrepreneurship":
		query = query.Where("(COALESCE(s.startup, '0') IN ('1', 'true', 'yes') OR COALESCE(s.business, '0') IN ('1', 'true', 'yes'))")
		statusLabel = "Entrepreneurship"

	case "notplaced", "not_placed", "not yet placed":
		fallthrough
	default:
		// Not placed: NOT in offers, NOT higher studies, NOT entrepreneur
		query = query.Where("u.id NOT IN (SELECT DISTINCT pds.user_id FROM placement_drive_offers pdo JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id)")
		query = query.Where("COALESCE(s.higher_studies, '0') NOT IN ('1', 'true', 'yes')")
		query = query.Where("COALESCE(s.startup, '0') NOT IN ('1', 'true', 'yes') AND COALESCE(s.business, '0') NOT IN ('1', 'true', 'yes')")
		statusLabel = "Not Placed"
	}

	query = query.Order("u.name ASC")

	type TempStudent struct {
		ID             uint64  `gorm:"column:id"`
		Name           string  `gorm:"column:name"`
		RollNo         string  `gorm:"column:roll_no"`
		DepartmentID   uint64  `gorm:"column:department_id"`
		DepartmentName string  `gorm:"column:department_name"`
		BatchID        uint64  `gorm:"column:batch_id"`
		BatchName      string  `gorm:"column:batch_name"`
		CGPA           float64 `gorm:"column:cgpa"`
	}

	var rawList []TempStudent
	if err := query.Scan(&rawList).Error; err != nil {
		return nil, err
	}

	result := make([]models.IntelligenceOutcomeStudent, 0, len(rawList))
	for _, s := range rawList {
		code := getDeptCode(s.DepartmentName)
		result = append(result, models.IntelligenceOutcomeStudent{
			ID:             s.ID,
			Name:           s.Name,
			RollNo:         s.RollNo,
			DepartmentID:   s.DepartmentID,
			DepartmentName: s.DepartmentName,
			DepartmentCode: code,
			BatchID:        s.BatchID,
			BatchName:      s.BatchName,
			CGPA:           s.CGPA,
			Status:         statusLabel,
			OutcomeGroup:   normalizedOutcome,
		})
	}

	return result, nil
}

func getDeptCode(name string) string {
	lower := strings.ToLower(name)
	if strings.Contains(lower, "computer") {
		return "CSE"
	} else if strings.Contains(lower, "information") {
		return "IT"
	} else if strings.Contains(lower, "electronics") {
		return "ECE"
	} else if strings.Contains(lower, "electrical") {
		return "EEE"
	} else if strings.Contains(lower, "mechanical") {
		return "MECH"
	} else if strings.Contains(lower, "civil") {
		return "CIVIL"
	}
	return name
}

// GetIndustryMatrix calculates real recruiter network health metrics from MySQL database
func (r *PlacementIntelligenceRepository) GetIndustryMatrix(sectorParam, deptParam string) (*models.IndustryNetworkHealthResponse, error) {
	// 1. Sector filtering
	var sectorCategories []string
	if sectorParam == "software" {
		sectorCategories = []string{"PRODUCT", "SERVICE", "NETWORKING"}
	} else if sectorParam == "core" {
		sectorCategories = []string{"CORE_FINANCE", "HEALTHCARE"}
	}

	// 2. Department filtering
	var deptID uint64
	hasDeptFilter := deptParam != "" && deptParam != "All" && deptParam != "All Departments"
	if hasDeptFilter {
		searchPattern := "%" + deptParam + "%"
		lowerDept := strings.ToLower(deptParam)
		if lowerDept == "cse" || strings.Contains(lowerDept, "computer") {
			searchPattern = "%Computer Science%"
		} else if lowerDept == "it" || strings.Contains(lowerDept, "information") {
			searchPattern = "%Information Technology%"
		} else if lowerDept == "ece" || strings.Contains(lowerDept, "electronics") {
			searchPattern = "%Electronics%"
		} else if lowerDept == "eee" || strings.Contains(lowerDept, "electrical") {
			searchPattern = "%Electrical%"
		} else if lowerDept == "mech" || strings.Contains(lowerDept, "mechanical") {
			searchPattern = "%Mechanical%"
		}
		r.db.Table("departments").Where("id = ? OR name = ? OR name LIKE ?", deptParam, deptParam, searchPattern).Pluck("id", &deptID)
	}

	// 3. Base company query
	baseCompQuery := r.db.Table("placement_company pc").Where("pc.status = ?", "1")
	if len(sectorCategories) > 0 {
		baseCompQuery = baseCompQuery.Where("pc.category IN ?", sectorCategories)
	}
	if hasDeptFilter && deptID > 0 {
		baseCompQuery = baseCompQuery.Where(`pc.id IN (
			SELECT DISTINCT pd.company_id FROM placement_drive pd 
			LEFT JOIN placement_drive_eligibility pde ON pd.id = pde.drive_id
			LEFT JOIN placement_drive_students pds ON pd.id = pds.drive_id
			LEFT JOIN master_users u ON pds.user_id = u.id
			WHERE JSON_CONTAINS(pde.department_ids, CAST(? AS JSON)) OR u.department_id = ?
		)`, fmt.Sprintf("[%d]", deptID), deptID)
	}

	var totalCompaniesInDB int64
	baseCompQuery.Count(&totalCompaniesInDB)

	// Fetch all matching companies
	type CompInfo struct {
		ID                int64  `gorm:"column:id"`
		CompanyName       string `gorm:"column:company_name"`
		CollaborationType string `gorm:"column:collaboration_type"`
		Category          string `gorm:"column:category"`
		CreatedAt         string `gorm:"column:created_at"`
	}
	var companies []CompInfo
	baseCompQuery.Find(&companies)

	companyIDs := make([]int64, 0, len(companies))
	companyMap := make(map[int64]CompInfo)
	for _, c := range companies {
		companyIDs = append(companyIDs, c.ID)
		companyMap[c.ID] = c
	}

	// 4. Batches strictly from database
	var dbBatches []models.Batch
	r.db.Order("name ASC").Find(&dbBatches)
	var allBatches []string
	batchIDToYear := make(map[uint64]string)
	yearToBatchID := make(map[string]uint64)
	for _, b := range dbBatches {
		// "2022-2026" -> "2026"
		parts := strings.Split(b.Name, "-")
		gradYear := b.Name
		if len(parts) == 2 {
			gradYear = strings.TrimSpace(parts[1])
		}
		allBatches = append(allBatches, gradYear)
		batchIDToYear[b.ID] = gradYear
		yearToBatchID[gradYear] = b.ID
	}

	// 5. Gather drives and offers per company and batch
	// Map: batchYear -> companyID -> offerCount
	batchCompanyOffers := make(map[string]map[int64]int64)
	// Map: batchYear -> set of participating companyIDs
	batchParticipatingCompanies := make(map[string]map[int64]bool)

	for _, bYear := range allBatches {
		batchCompanyOffers[bYear] = make(map[int64]int64)
		batchParticipatingCompanies[bYear] = make(map[int64]bool)
	}

	if len(companyIDs) > 0 {
		// Query drives
		type DriveResult struct {
			CompanyID   int64  `gorm:"column:company_id"`
			BatchIDs    string `gorm:"column:batch_id"`
			OffersCount int64  `gorm:"column:offers_count"`
		}
		var driveResults []DriveResult
		r.db.Table("placement_drive pd").
			Select("pd.company_id, pd.batch_id, COUNT(pdo.id) as offers_count").
			Joins("LEFT JOIN placement_drive_students pds ON pd.id = pds.drive_id").
			Joins("LEFT JOIN placement_drive_offers pdo ON pds.id = pdo.drive_student_id").
			Where("pd.company_id IN ?", companyIDs).
			Group("pd.id, pd.company_id, pd.batch_id").
			Scan(&driveResults)

		for _, dr := range driveResults {
			// Check which batch year this drive belongs to
			for bID, bYear := range batchIDToYear {
				jsonPattern := fmt.Sprintf("[%d]", bID)
				containsID := strings.Contains(dr.BatchIDs, jsonPattern) || 
					strings.Contains(dr.BatchIDs, fmt.Sprintf("%d", bID))
				if containsID {
					if batchParticipatingCompanies[bYear] == nil {
						batchParticipatingCompanies[bYear] = make(map[int64]bool)
					}
					if batchCompanyOffers[bYear] == nil {
						batchCompanyOffers[bYear] = make(map[int64]int64)
					}
					batchParticipatingCompanies[bYear][dr.CompanyID] = true
					batchCompanyOffers[bYear][dr.CompanyID] += dr.OffersCount
				}
			}
		}

		// Also check placement_company_batch_placements
		type PlacedResult struct {
			Batch          string `gorm:"column:batch"`
			CompanyID      int64  `gorm:"column:company_id"`
			StudentsPlaced int64  `gorm:"column:students_placed"`
		}
		var placedResults []PlacedResult
		r.db.Table("placement_company_batch_placements").
			Where("company_id IN ?", companyIDs).
			Scan(&placedResults)

		for _, pr := range placedResults {
			parts := strings.Split(pr.Batch, "-")
			gradYear := pr.Batch
			if len(parts) == 2 {
				gradYear = strings.TrimSpace(parts[1])
			}
			if batchParticipatingCompanies[gradYear] == nil {
				batchParticipatingCompanies[gradYear] = make(map[int64]bool)
			}
			if batchCompanyOffers[gradYear] == nil {
				batchCompanyOffers[gradYear] = make(map[int64]int64)
			}
			batchParticipatingCompanies[gradYear][pr.CompanyID] = true
			if pr.StudentsPlaced > batchCompanyOffers[gradYear][pr.CompanyID] {
				batchCompanyOffers[gradYear][pr.CompanyID] = pr.StudentsPlaced
			}
		}
	}

	// 6. Build the 7 metric rows
	rowDatabase := models.IndustryMetricRow{
		Key:    "database",
		Title:  "Total industries in database",
		Note:   "Recruiters maintained in the institutional recruiter database.",
		Values: make(map[string]interface{}),
	}
	rowNew := models.IndustryMetricRow{
		Key:    "new",
		Title:  "New industries visited / committed",
		Note:   "First-time recruiters or newly activated relationships.",
		Values: make(map[string]interface{}),
	}
	rowMissed := models.IndustryMetricRow{
		Key:    "missed",
		Title:  "Visited in previous 3 years but not this year",
		Note:   "Previously active recruiters that have not participated this year.",
		Values: make(map[string]interface{}),
	}
	rowEqualLast := models.IndustryMetricRow{
		Key:    "equalLast",
		Title:  "Offers equal to or higher than last year",
		Note:   "Recruiters maintaining or improving year-on-year offer volume.",
		Values: make(map[string]interface{}),
	}
	rowEqualMax3 := models.IndustryMetricRow{
		Key:    "equalMax3",
		Title:  "Offers ≥ previous 3-year maximum",
		Note:   "Recruiters achieving or exceeding their recent historical best.",
		Values: make(map[string]interface{}),
	}
	rowLessLast := models.IndustryMetricRow{
		Key:    "lessLast",
		Title:  "Offers lower than last year",
		Note:   "Recruiters showing year-on-year reduction in offer volume.",
		Values: make(map[string]interface{}),
	}
	rowLessMin3 := models.IndustryMetricRow{
		Key:    "lessMin3",
		Title:  "Offers below previous 3-year minimum",
		Note:   "Recruiters with offer volume falling below their 3-year floor.",
		Values: make(map[string]interface{}),
	}

	for i, bYear := range allBatches {
		// Total in DB for this batch
		rowDatabase.Values[bYear] = totalCompaniesInDB

		// New recruiters
		var newCount int64
		for cID := range batchParticipatingCompanies[bYear] {
			comp := companyMap[cID]
			if comp.CollaborationType == "NEW" {
				newCount++
			}
		}
		// Also count companies registered as NEW in DB for current batch
		if bYear == "2026" {
			var dbNewCount int64
			baseCompQuery.Where("pc.collaboration_type = ?", "NEW").Count(&dbNewCount)
			if dbNewCount > newCount {
				newCount = dbNewCount
			}
		}
		rowNew.Values[bYear] = newCount

		// Visited in previous 3 years but not this year
		// Check if there are earlier batches in allBatches
		if i > 0 {
			var missedCount int64
			for _, cID := range companyIDs {
				visitedPrev := false
				for prevIdx := 0; prevIdx < i && prevIdx >= i-3; prevIdx++ {
					py := allBatches[prevIdx]
					if batchParticipatingCompanies[py][cID] {
						visitedPrev = true
						break
					}
				}
				if visitedPrev && !batchParticipatingCompanies[bYear][cID] {
					missedCount++
				}
			}
			rowMissed.Values[bYear] = missedCount
		} else {
			rowMissed.Values[bYear] = "—"
		}

		// Offers comparisons with last year
		if i > 0 {
			prevYear := allBatches[i-1]
			var eqLast int64
			var lessLast int64
			for _, cID := range companyIDs {
				curOff := batchCompanyOffers[bYear][cID]
				prevOff := batchCompanyOffers[prevYear][cID]
				if curOff > 0 && curOff >= prevOff {
					eqLast++
				} else if prevOff > 0 && curOff < prevOff {
					lessLast++
				}
			}
			rowEqualLast.Values[bYear] = eqLast
			rowLessLast.Values[bYear] = lessLast
		} else {
			var initialOffers int64
			for _, cID := range companyIDs {
				if batchCompanyOffers[bYear][cID] > 0 {
					initialOffers++
				}
			}
			rowEqualLast.Values[bYear] = initialOffers
			rowLessLast.Values[bYear] = "—"
		}

		// Offers comparisons with previous 3 years
		if i >= 3 {
			var eqMax3 int64
			var lessMin3 int64
			for _, cID := range companyIDs {
				curOff := batchCompanyOffers[bYear][cID]
				var maxPrev int64 = 0
				var minPrev int64 = 999999
				hasPrev := false
				for prevIdx := i - 3; prevIdx < i; prevIdx++ {
					pOff := batchCompanyOffers[allBatches[prevIdx]][cID]
					if pOff > 0 {
						hasPrev = true
						if pOff > maxPrev {
							maxPrev = pOff
						}
						if pOff < minPrev {
							minPrev = pOff
						}
					}
				}
				if hasPrev {
					if curOff >= maxPrev && curOff > 0 {
						eqMax3++
					} else if curOff < minPrev {
						lessMin3++
					}
				}
			}
			rowEqualMax3.Values[bYear] = eqMax3
			rowLessMin3.Values[bYear] = lessMin3
		} else {
			if i == 0 {
				var activeWithOffers int64
				for _, cID := range companyIDs {
					if batchCompanyOffers[bYear][cID] > 0 {
						activeWithOffers++
					}
				}
				rowEqualMax3.Values[bYear] = activeWithOffers
			} else {
				rowEqualMax3.Values[bYear] = "—"
			}
			rowLessMin3.Values[bYear] = "—"
		}
	}

	// 7. Extract signals from current batch (2026)
	var resp models.IndustryNetworkHealthResponse
	resp.Batches = allBatches
	resp.Signals.TotalDatabase = totalCompaniesInDB
	if val, ok := rowNew.Values["2026"].(int64); ok {
		resp.Signals.NewRecruiters = val
	}
	if val, ok := rowMissed.Values["2026"].(int64); ok {
		resp.Signals.MissedRecruiters = val
	}
	if val, ok := rowEqualLast.Values["2026"].(int64); ok {
		resp.Signals.GrowthRecruiters = val
	}
	if val, ok := rowEqualMax3.Values["2026"].(int64); ok {
		resp.Signals.Max3Recruiters = val
	}

	resp.Matrix = []models.IndustryMetricRow{
		rowDatabase,
		rowNew,
		rowMissed,
		rowEqualLast,
		rowEqualMax3,
		rowLessLast,
		rowLessMin3,
	}

	return &resp, nil
}


