package repositories

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
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
	} else if strings.Contains(lower, "artificial") || strings.Contains(lower, "ai") {
		return "AI & ML"
	}
	return name
}

// GetIndustryMatrix calculates real recruiter network health metrics from MySQL database
func (r *PlacementIntelligenceRepository) GetIndustryMatrix(sectorParam, deptParam string) (*models.IndustryNetworkHealthResponse, error) {
	// 1. Domain filtering using company_domain ('SOFTWARE', 'CORE', 'BOTH')
	var domainFilter []string
	cleanSector := strings.ToUpper(strings.TrimSpace(sectorParam))
	if cleanSector == "SOFTWARE" {
		domainFilter = []string{"SOFTWARE", "BOTH"}
	} else if cleanSector == "CORE" {
		domainFilter = []string{"CORE", "BOTH"}
	} else if cleanSector == "BOTH" {
		domainFilter = []string{"BOTH"}
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
	if len(domainFilter) > 0 {
		baseCompQuery = baseCompQuery.Where("pc.company_domain IN ?", domainFilter)
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
		CompanyDomain     string `gorm:"column:company_domain"`
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

	// 4. Batches strictly from database (ordered DESC so current / latest batch is in front)
	var dbBatches []models.Batch
	r.db.Order("name DESC").Find(&dbBatches)
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

	// 5. Gather placement records and drives per company and batch
	// Map: batchYear -> companyID -> offerCount
	batchCompanyOffers := make(map[string]map[int64]int64)
	// Map: batchYear -> set of participating companyIDs
	batchVisitedCompanies := make(map[string]map[int64]bool)
	// Map: companyID -> list of all batch years visited
	compVisitedBatches := make(map[int64][]string)

	for _, bYear := range allBatches {
		batchCompanyOffers[bYear] = make(map[int64]int64)
		batchVisitedCompanies[bYear] = make(map[int64]bool)
	}

	if len(companyIDs) > 0 {
		// 5a. Listen to placement_company_batch_placements table
		type PlacedResult struct {
			Batch          string `gorm:"column:batch"`
			CompanyID      int64  `gorm:"column:company_id"`
			StudentsPlaced int64  `gorm:"column:students_placed"`
		}
		var placedResults []PlacedResult
		r.db.Table("placement_company_batch_placements").
			Where("status = '1' AND company_id IN ?", companyIDs).
			Scan(&placedResults)

		for _, pr := range placedResults {
			parts := strings.Split(pr.Batch, "-")
			gradYear := pr.Batch
			if len(parts) == 2 {
				gradYear = strings.TrimSpace(parts[1])
			}
			if batchVisitedCompanies[gradYear] == nil {
				batchVisitedCompanies[gradYear] = make(map[int64]bool)
			}
			if batchCompanyOffers[gradYear] == nil {
				batchCompanyOffers[gradYear] = make(map[int64]int64)
			}
			batchVisitedCompanies[gradYear][pr.CompanyID] = true
			compVisitedBatches[pr.CompanyID] = append(compVisitedBatches[pr.CompanyID], gradYear)
			if pr.StudentsPlaced > batchCompanyOffers[gradYear][pr.CompanyID] {
				batchCompanyOffers[gradYear][pr.CompanyID] = pr.StudentsPlaced
			}
		}

		// 5b. Also listen to placement_drive table for active drives
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
			for bID, bYear := range batchIDToYear {
				jsonPattern := fmt.Sprintf("[%d]", bID)
				containsID := strings.Contains(dr.BatchIDs, jsonPattern) || 
					strings.Contains(dr.BatchIDs, fmt.Sprintf("%d", bID))
				if containsID {
					if batchVisitedCompanies[bYear] == nil {
						batchVisitedCompanies[bYear] = make(map[int64]bool)
					}
					if batchCompanyOffers[bYear] == nil {
						batchCompanyOffers[bYear] = make(map[int64]int64)
					}
					batchVisitedCompanies[bYear][dr.CompanyID] = true
					compVisitedBatches[dr.CompanyID] = append(compVisitedBatches[dr.CompanyID], bYear)
					if dr.OffersCount > batchCompanyOffers[bYear][dr.CompanyID] {
						batchCompanyOffers[bYear][dr.CompanyID] = dr.OffersCount
					}
				}
			}
		}
	}

	// 5c. Identify earliest / first batch each company started visiting
	firstVisitBatch := make(map[int64]string)
	for cID, bList := range compVisitedBatches {
		earliest := ""
		for _, b := range bList {
			if earliest == "" || b < earliest {
				earliest = b
			}
		}
		firstVisitBatch[cID] = earliest
	}

	// 6. Build the metric rows (Total industries removed as requested)
	rowVisited := models.IndustryMetricRow{
		Key:    "visited",
		Title:  "Industries visited",
		Note:   "Recruitment process conducted / placements recorded during the academic batch.",
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
		// Industries visited (from placement_company_batch_placements & drives)
		rowVisited.Values[bYear] = int64(len(batchVisitedCompanies[bYear]))

		// New industries visited: count companies whose first-ever recorded visit is in bYear
		var newCount int64
		for _, firstB := range firstVisitBatch {
			if firstB == bYear {
				newCount++
			}
		}
		rowNew.Values[bYear] = newCount

		// Visited in previous 3 years but not this year
		// In DESC order, previous batches are at i+1, i+2, i+3
		if i+1 < len(allBatches) {
			var missedCount int64
			for _, cID := range companyIDs {
				visitedPrev := false
				for nextIdx := i + 1; nextIdx < len(allBatches) && nextIdx <= i+3; nextIdx++ {
					py := allBatches[nextIdx]
					if batchVisitedCompanies[py][cID] {
						visitedPrev = true
						break
					}
				}
				if visitedPrev && !batchVisitedCompanies[bYear][cID] {
					missedCount++
				}
			}
			rowMissed.Values[bYear] = missedCount
		} else {
			rowMissed.Values[bYear] = "—"
		}

		// Offers comparisons with last year (i+1 in DESC order)
		if i+1 < len(allBatches) {
			prevYear := allBatches[i+1]
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
			rowEqualLast.Values[bYear] = "—"
			rowLessLast.Values[bYear] = "—"
		}

		// Offers comparisons with previous 3 years (i+1, i+2, i+3 in DESC order)
		if i+3 < len(allBatches) {
			var eqMax3 int64
			var lessMin3 int64
			for _, cID := range companyIDs {
				curOff := batchCompanyOffers[bYear][cID]
				var maxPrev int64 = 0
				var minPrev int64 = 999999
				hasPrev := false
				for nextIdx := i + 1; nextIdx <= i+3; nextIdx++ {
					pOff := batchCompanyOffers[allBatches[nextIdx]][cID]
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
			rowEqualMax3.Values[bYear] = "—"
			rowLessMin3.Values[bYear] = "—"
		}
	}

	// 7. Extract signals from the current active batch
	var resp models.IndustryNetworkHealthResponse
	resp.Batches = allBatches
	resp.Signals.TotalDatabase = totalCompaniesInDB
	currentBatch := ""
	for _, b := range allBatches {
		if v, ok := rowVisited.Values[b].(int64); ok && v > 0 {
			currentBatch = b
			break
		}
	}
	if currentBatch == "" && len(allBatches) > 0 {
		currentBatch = allBatches[0]
	}
	if val, ok := rowVisited.Values[currentBatch].(int64); ok {
		resp.Signals.VisitedRecruiters = val
	}
	if val, ok := rowNew.Values[currentBatch].(int64); ok {
		resp.Signals.NewRecruiters = val
	}
	if val, ok := rowMissed.Values[currentBatch].(int64); ok {
		resp.Signals.MissedRecruiters = val
	}
	if val, ok := rowEqualLast.Values[currentBatch].(int64); ok {
		resp.Signals.GrowthRecruiters = val
	}
	if val, ok := rowEqualMax3.Values[currentBatch].(int64); ok {
		resp.Signals.Max3Recruiters = val
	}

	resp.Matrix = []models.IndustryMetricRow{
		rowVisited,
		rowNew,
		rowMissed,
		rowEqualLast,
		rowEqualMax3,
		rowLessLast,
		rowLessMin3,
	}

	return &resp, nil
}

func formatTimeAgo(t time.Time) string {
	now := time.Now()
	diff := now.Sub(t)
	if diff < time.Minute {
		return "Just now"
	} else if diff < time.Hour {
		mins := int(diff.Minutes())
		return fmt.Sprintf("%d mins ago", mins)
	} else if diff < 24*time.Hour {
		hrs := int(diff.Hours())
		if hrs == 1 {
			return "1 hour ago"
		}
		return fmt.Sprintf("%d hours ago", hrs)
	} else if diff < 48*time.Hour {
		return "Yesterday"
	}
	return t.Format("Jan 02, 2006")
}

// GetIndustryRightPanelData computes the right panel data for Industry Intelligence
func (r *PlacementIntelligenceRepository) GetIndustryRightPanelData(batchParam, sectorParam, deptParam string) (*models.IndustryRightPanelResponse, error) {
	// 1. Fetch all batches in DB ordered DESC
	var dbBatches []models.Batch
	r.db.Order("name DESC").Find(&dbBatches)

	batchIDToYear := make(map[uint64]string)
	yearToBatchID := make(map[string]uint64)
	for _, b := range dbBatches {
		parts := strings.Split(b.Name, "-")
		gradYear := b.Name
		if len(parts) == 2 {
			gradYear = strings.TrimSpace(parts[1])
		}
		batchIDToYear[b.ID] = gradYear
		yearToBatchID[gradYear] = b.ID
	}

	// Determine targeted batch
	cleanBatch := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(batchParam, "Batch"), "batch"))
	cleanBatch = strings.ReplaceAll(cleanBatch, "–", "-")
	cleanBatch = strings.ReplaceAll(cleanBatch, "—", "-")
	cleanBatch = strings.TrimSpace(cleanBatch)

	var targetBatch models.Batch
	if cleanBatch != "" && cleanBatch != "All" && cleanBatch != "all" {
		for _, b := range dbBatches {
			if strings.Contains(b.Name, cleanBatch) || fmt.Sprintf("%d", b.ID) == cleanBatch {
				targetBatch = b
				break
			}
		}
	}
	// Default to batch 2026 or latest with drives
	if targetBatch.ID == 0 {
		for _, b := range dbBatches {
			if strings.Contains(b.Name, "2026") {
				targetBatch = b
				break
			}
		}
		if targetBatch.ID == 0 && len(dbBatches) > 0 {
			targetBatch = dbBatches[0]
		}
	}

	targetGradYear := targetBatch.Name
	parts := strings.Split(targetBatch.Name, "-")
	if len(parts) == 2 {
		targetGradYear = strings.TrimSpace(parts[1])
	}

	// 2. Domain filtering using company_domain ('SOFTWARE', 'CORE', 'BOTH')
	var domainFilter []string
	cleanSector := strings.ToUpper(strings.TrimSpace(sectorParam))
	if cleanSector == "SOFTWARE" {
		domainFilter = []string{"SOFTWARE", "BOTH"}
	} else if cleanSector == "CORE" {
		domainFilter = []string{"CORE", "BOTH"}
	} else if cleanSector == "BOTH" {
		domainFilter = []string{"BOTH"}
	}

	// 3. Department filtering
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

	// 4. Base matching companies
	baseCompQuery := r.db.Table("placement_company pc").Where("pc.status = ?", "1")
	if len(domainFilter) > 0 {
		baseCompQuery = baseCompQuery.Where("pc.company_domain IN ?", domainFilter)
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

	type CompBasic struct {
		ID                int64  `gorm:"column:id"`
		CompanyName       string `gorm:"column:company_name"`
		CollaborationType string `gorm:"column:collaboration_type"`
		Category          string `gorm:"column:category"`
		CompanyDomain     string `gorm:"column:company_domain"`
	}
	var matchingCompanies []CompBasic
	baseCompQuery.Find(&matchingCompanies)

	compIDs := make([]int64, 0, len(matchingCompanies))
	compMap := make(map[int64]CompBasic)
	for _, c := range matchingCompanies {
		compIDs = append(compIDs, c.ID)
		compMap[c.ID] = c
	}

	// 5. Query batch-specific drives
	batchJsonPattern := fmt.Sprintf("[%d]", targetBatch.ID)
	batchStrPattern := fmt.Sprintf("%d", targetBatch.ID)
	driveWhere := "(JSON_CONTAINS(pd.batch_id, ?) OR pd.batch_id LIKE ?)"
	driveWhereArgs := []interface{}{batchJsonPattern, "%" + batchStrPattern + "%"}

	// --- 6 CARDS ---
	var cards models.IndustryMetricCardStats

	// 1. Total Recruiters - placement_company table
	var totalRecruitersCount int64
	compActiveQuery := r.db.Table("placement_company pc").Where("pc.status = '1'")
	if len(domainFilter) > 0 {
		compActiveQuery = compActiveQuery.Where("pc.company_domain IN ?", domainFilter)
	}
	compActiveQuery.Count(&totalRecruitersCount)
	cards.TotalActiveRecruiters = totalRecruitersCount

	if len(compIDs) > 0 {
		// 2. Visited Recruiters - placement_drive
		var visitedCount int64
		r.db.Table("placement_drive pd").
			Where(driveWhere, driveWhereArgs...).
			Where("pd.company_id IN ?", compIDs).
			Distinct("pd.company_id").
			Count(&visitedCount)
		cards.VisitedRecruiters = visitedCount

		// 3. Ongoing recruitments - placement_drive
		var ongoingCount int64
		r.db.Table("placement_drive pd").
			Where(driveWhere, driveWhereArgs...).
			Where("pd.company_id IN ?", compIDs).
			Where("LOWER(pd.overall_status) NOT IN ('completed', 'completed placements', 'cancelled')").
			Distinct("pd.company_id").
			Count(&ongoingCount)
		cards.OngoingRecruitments = ongoingCount

		// 4. Completed recruitments - placement_company_batch_placements & placement_drive
		var completedCount int64
		r.db.Table("placement_company_batch_placements pcbp").
			Where("pcbp.status = '1' AND (pcbp.batch = ? OR pcbp.batch LIKE ?)", targetBatch.Name, "%"+targetGradYear+"%").
			Where("pcbp.company_id IN ?", compIDs).
			Count(&completedCount)

		var completedDrives int64
		r.db.Table("placement_drive pd").
			Where(driveWhere, driveWhereArgs...).
			Where("pd.company_id IN ?", compIDs).
			Where("pd.overall_status = 'completed'").
			Count(&completedDrives)
		if completedDrives > completedCount {
			completedCount = completedDrives
		}
		cards.CompletedRecruitments = completedCount

		// 5. New Recruiters
		type AllBatchVisit struct {
			CompanyID int64  `gorm:"column:company_id"`
			Batch     string `gorm:"column:batch"`
		}
		var allVisits []AllBatchVisit
		r.db.Table("placement_company_batch_placements").
			Where("status = '1' AND company_id IN ?", compIDs).
			Scan(&allVisits)

		compMinBatch := make(map[int64]string)
		for _, v := range allVisits {
			parts := strings.Split(v.Batch, "-")
			gYear := v.Batch
			if len(parts) == 2 {
				gYear = strings.TrimSpace(parts[1])
			}
			if cur, exists := compMinBatch[v.CompanyID]; !exists || gYear < cur {
				compMinBatch[v.CompanyID] = gYear
			}
		}

		type DriveBatchVisit struct {
			CompanyID int64  `gorm:"column:company_id"`
			BatchID   string `gorm:"column:batch_id"`
		}
		var driveVisits []DriveBatchVisit
		r.db.Table("placement_drive").
			Select("company_id, batch_id").
			Where("company_id IN ?", compIDs).
			Scan(&driveVisits)

		for _, dv := range driveVisits {
			for bID, bYear := range batchIDToYear {
				jsonPat := fmt.Sprintf("[%d]", bID)
				if strings.Contains(dv.BatchID, jsonPat) || strings.Contains(dv.BatchID, fmt.Sprintf("%d", bID)) {
					if cur, exists := compMinBatch[dv.CompanyID]; !exists || bYear < cur {
						compMinBatch[dv.CompanyID] = bYear
					}
				}
			}
		}

		var newRecruitersCount int64
		for _, minB := range compMinBatch {
			if minB == targetGradYear {
				newRecruitersCount++
			}
		}
		cards.NewRecruiters = newRecruitersCount

		// 6. Highest Offer - in this batch
		var highestOffer float64
		r.db.Table("placement_drive pd").
			Select("COALESCE(MAX(pd.package_lpa), 0)").
			Where(driveWhere, driveWhereArgs...).
			Where("pd.company_id IN ?", compIDs).
			Scan(&highestOffer)
		cards.HighestOfferLPA = highestOffer
	}

	// --- SECTION A: Recruiters requiring attention ---
	attentionList := make([]models.AttentionRecruiter, 0)
	if len(compIDs) > 0 {
		var prevBatchNames []string
		foundTarget := false
		for _, b := range dbBatches {
			if b.ID == targetBatch.ID {
				foundTarget = true
				continue
			}
			if foundTarget {
				prevBatchNames = append(prevBatchNames, b.Name)
				parts := strings.Split(b.Name, "-")
				if len(parts) == 2 {
					prevBatchNames = append(prevBatchNames, strings.TrimSpace(parts[1]))
				}
				break
			}
		}

		if len(prevBatchNames) == 0 {
			for _, b := range dbBatches {
				parts := strings.Split(b.Name, "-")
				gYear := b.Name
				if len(parts) == 2 {
					gYear = strings.TrimSpace(parts[1])
				}
				if gYear < targetGradYear {
					prevBatchNames = append(prevBatchNames, b.Name, gYear)
					break
				}
			}
		}

		if len(prevBatchNames) > 0 {
			var visitedInCurrent []int64
			r.db.Table("placement_drive pd").
				Where(driveWhere, driveWhereArgs...).
				Pluck("DISTINCT pd.company_id", &visitedInCurrent)

			currentVisitedSet := make(map[int64]bool)
			for _, id := range visitedInCurrent {
				currentVisitedSet[id] = true
			}

			type PrevPlacement struct {
				CompanyID      int64   `gorm:"column:company_id"`
				Batch          string  `gorm:"column:batch"`
				StudentsPlaced int64   `gorm:"column:students_placed"`
				PackageLPA     float64 `gorm:"column:package_lpa"`
			}
			var prevPlacements []PrevPlacement
			r.db.Table("placement_company_batch_placements pcbp").
				Select("pcbp.company_id, pcbp.batch, SUM(pcbp.students_placed) as students_placed, COALESCE(MAX(pd.package_lpa), 0) as package_lpa").
				Joins("LEFT JOIN placement_drive pd ON pcbp.drive_id = pd.id").
				Where("pcbp.status = '1' AND pcbp.company_id IN ?", compIDs).
				Where("pcbp.batch IN ?", prevBatchNames).
				Group("pcbp.company_id, pcbp.batch").
				Scan(&prevPlacements)

			for _, pp := range prevPlacements {
				if !currentVisitedSet[pp.CompanyID] {
					c := compMap[pp.CompanyID]
					attentionList = append(attentionList, models.AttentionRecruiter{
						CompanyID:          pp.CompanyID,
						CompanyName:        c.CompanyName,
						Category:           c.Category,
						CompanyDomain:      c.CompanyDomain,
						CollaborationType:  c.CollaborationType,
						LastYearBatch:      pp.Batch,
						LastYearPlacements: pp.StudentsPlaced,
						LastYearPackageLPA: pp.PackageLPA,
					})
				}
			}
		}
	}

	// --- SECTION B: Top recruiters ---
	topSalary := make([]models.TopRecruiterItem, 0)
	topCount := make([]models.TopRecruiterItem, 0)

	if len(compIDs) > 0 {
		// Top by Salary
		type SalaryRankRow struct {
			CompanyID   int64   `gorm:"column:company_id"`
			CompanyName string  `gorm:"column:company_name"`
			Category    string  `gorm:"column:category"`
			JobRole     string  `gorm:"column:job_role"`
			PackageLPA  float64 `gorm:"column:package_lpa"`
		}
		var rawSalary []SalaryRankRow
		r.db.Table("placement_drive pd").
			Select("pd.company_id, pc.company_name, pc.category, pd.job_role, MAX(pd.package_lpa) as package_lpa").
			Joins("JOIN placement_company pc ON pd.company_id = pc.id").
			Where(driveWhere, driveWhereArgs...).
			Where("pd.company_id IN ?", compIDs).
			Group("pd.company_id, pc.company_name, pc.category, pd.job_role").
			Order("package_lpa DESC").
			Limit(10).
			Scan(&rawSalary)

		for idx, s := range rawSalary {
			c := compMap[s.CompanyID]
			topSalary = append(topSalary, models.TopRecruiterItem{
				Rank:          idx + 1,
				CompanyID:     s.CompanyID,
				CompanyName:   s.CompanyName,
				Category:      s.Category,
				CompanyDomain: c.CompanyDomain,
				JobRole:       s.JobRole,
				PackageLPA:    s.PackageLPA,
			})
		}

		// Top by Students Count
		type CountRankRow struct {
			CompanyID     int64  `gorm:"column:company_id"`
			CompanyName   string `gorm:"column:company_name"`
			Category      string `gorm:"column:category"`
			StudentsCount int64  `gorm:"column:students_count"`
		}
		var rawCount []CountRankRow
		r.db.Table("placement_company_batch_placements pcbp").
			Select("pcbp.company_id, pc.company_name, pc.category, SUM(pcbp.students_placed) as students_count").
			Joins("JOIN placement_company pc ON pcbp.company_id = pc.id").
			Where("pcbp.status = '1' AND (pcbp.batch = ? OR pcbp.batch LIKE ?)", targetBatch.Name, "%"+targetGradYear+"%").
			Where("pcbp.company_id IN ?", compIDs).
			Group("pcbp.company_id, pc.company_name, pc.category").
			Order("students_count DESC").
			Limit(10).
			Scan(&rawCount)

		for idx, cRow := range rawCount {
			c := compMap[cRow.CompanyID]
			topCount = append(topCount, models.TopRecruiterItem{
				Rank:          idx + 1,
				CompanyID:     cRow.CompanyID,
				CompanyName:   cRow.CompanyName,
				Category:      cRow.Category,
				CompanyDomain: c.CompanyDomain,
				StudentsCount: cRow.StudentsCount,
			})
		}
	}

	// --- SECTION C: Recent recruitment activity ---
	activities := make([]models.RecentRecruitmentActivity, 0)
	if len(compIDs) > 0 {
		type ActRow struct {
			ID                  uint64    `gorm:"column:id"`
			DriveID             uint64    `gorm:"column:drive_id"`
			CompanyID           int64     `gorm:"column:company_id"`
			CompanyName         string    `gorm:"column:company_name"`
			JobRole             string    `gorm:"column:job_role"`
			ActivityDescription string    `gorm:"column:activity_description"`
			CreatedAt           time.Time `gorm:"column:created_at"`
		}
		var rawActs []ActRow
		r.db.Table("placement_drive_activity_log al").
			Select("al.id, al.drive_id, pd.company_id, pc.company_name, pd.job_role, al.activity_description, al.created_at").
			Joins("JOIN placement_drive pd ON al.drive_id = pd.id").
			Joins("JOIN placement_company pc ON pd.company_id = pc.id").
			Where(driveWhere, driveWhereArgs...).
			Where("pd.company_id IN ?", compIDs).
			Order("al.created_at DESC").
			Limit(15).
			Scan(&rawActs)

		for _, a := range rawActs {
			activities = append(activities, models.RecentRecruitmentActivity{
				ID:                  a.ID,
				DriveID:             a.DriveID,
				CompanyID:           a.CompanyID,
				CompanyName:         a.CompanyName,
				JobRole:             a.JobRole,
				ActivityDescription: a.ActivityDescription,
				CreatedAt:           a.CreatedAt.Format("2006-01-02 15:04:05"),
				TimeAgo:             formatTimeAgo(a.CreatedAt),
			})
		}
	}

	return &models.IndustryRightPanelResponse{
		SelectedBatch:       targetBatch.Name,
		Cards:               cards,
		AttentionRecruiters: attentionList,
		TopRecruitersSalary: topSalary,
		TopRecruitersCount:  topCount,
		RecentActivities:    activities,
	}, nil
}

// GetIndustryMetricCompanies returns the companies corresponding to a clicked metric cell or KPI card
func (r *PlacementIntelligenceRepository) GetIndustryMetricCompanies(metricKey, batchParam, sectorParam, deptParam string) (*models.IndustryMetricCompaniesResponse, error) {
	// 1. Fetch batches from DB
	var dbBatches []models.Batch
	r.db.Order("name DESC").Find(&dbBatches)

	var allBatches []string
	batchIDToYear := make(map[uint64]string)
	yearToBatchID := make(map[string]uint64)
	for _, b := range dbBatches {
		parts := strings.Split(b.Name, "-")
		gradYear := b.Name
		if len(parts) == 2 {
			gradYear = strings.TrimSpace(parts[1])
		}
		allBatches = append(allBatches, gradYear)
		batchIDToYear[b.ID] = gradYear
		yearToBatchID[gradYear] = b.ID
	}

	// 2. Identify target batch
	cleanBatch := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(batchParam, "Batch"), "batch"))
	cleanBatch = strings.ReplaceAll(cleanBatch, "–", "-")
	cleanBatch = strings.ReplaceAll(cleanBatch, "—", "-")
	cleanBatch = strings.TrimSpace(cleanBatch)

	var targetBatch models.Batch
	if cleanBatch != "" && cleanBatch != "All" && cleanBatch != "all" {
		for _, b := range dbBatches {
			if strings.Contains(b.Name, cleanBatch) || fmt.Sprintf("%d", b.ID) == cleanBatch {
				targetBatch = b
				break
			}
		}
	}
	if targetBatch.ID == 0 {
		for _, b := range dbBatches {
			if strings.Contains(b.Name, "2027") || strings.Contains(b.Name, "2026") {
				targetBatch = b
				break
			}
		}
		if targetBatch.ID == 0 && len(dbBatches) > 0 {
			targetBatch = dbBatches[0]
		}
	}

	targetGradYear := targetBatch.Name
	parts := strings.Split(targetBatch.Name, "-")
	if len(parts) == 2 {
		targetGradYear = strings.TrimSpace(parts[1])
	}

	// Find index of targetGradYear in allBatches
	batchIndex := -1
	for idx, bY := range allBatches {
		if bY == targetGradYear {
			batchIndex = idx
			break
		}
	}

	// 3. Domain filtering using company_domain ('SOFTWARE', 'CORE', 'BOTH')
	var domainFilter []string
	cleanSector := strings.ToUpper(strings.TrimSpace(sectorParam))
	if cleanSector == "SOFTWARE" {
		domainFilter = []string{"SOFTWARE", "BOTH"}
	} else if cleanSector == "CORE" {
		domainFilter = []string{"CORE", "BOTH"}
	} else if cleanSector == "BOTH" {
		domainFilter = []string{"BOTH"}
	}

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

	baseCompQuery := r.db.Table("placement_company pc").Where("pc.status = ?", "1")
	if len(domainFilter) > 0 {
		baseCompQuery = baseCompQuery.Where("pc.company_domain IN ?", domainFilter)
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

	type CompBasic struct {
		ID                int64  `gorm:"column:id"`
		CompanyName       string `gorm:"column:company_name"`
		CollaborationType string `gorm:"column:collaboration_type"`
		Category          string `gorm:"column:category"`
		CompanyDomain     string `gorm:"column:company_domain"`
	}
	var matchingCompanies []CompBasic
	baseCompQuery.Find(&matchingCompanies)

	compIDs := make([]int64, 0, len(matchingCompanies))
	compMap := make(map[int64]CompBasic)
	for _, c := range matchingCompanies {
		compIDs = append(compIDs, c.ID)
		compMap[c.ID] = c
	}

	// 4. Gather visits and offers per batch
	batchCompanyOffers := make(map[string]map[int64]int64)
	batchVisitedCompanies := make(map[string]map[int64]bool)
	compVisitedBatches := make(map[int64][]string)
	batchCompanyDriveStatus := make(map[string]map[int64]string)
	batchCompanyPackageLPA := make(map[string]map[int64]float64)
	batchCompanyJobRoles := make(map[string]map[int64]string)
	batchCompanyHasOngoingDrive := make(map[string]map[int64]bool)
	batchCompanyOngoingDriveStatus := make(map[string]map[int64]string)
	batchCompanyOngoingPackageLPA := make(map[string]map[int64]float64)
	batchCompanyOngoingJobRoles := make(map[string]map[int64]string)
	batchCompanyDriveID := make(map[string]map[int64]uint64)
	batchCompanyOngoingDriveID := make(map[string]map[int64]uint64)

	for _, bYear := range allBatches {
		batchCompanyOffers[bYear] = make(map[int64]int64)
		batchVisitedCompanies[bYear] = make(map[int64]bool)
		batchCompanyDriveStatus[bYear] = make(map[int64]string)
		batchCompanyPackageLPA[bYear] = make(map[int64]float64)
		batchCompanyJobRoles[bYear] = make(map[int64]string)
		batchCompanyHasOngoingDrive[bYear] = make(map[int64]bool)
		batchCompanyOngoingDriveStatus[bYear] = make(map[int64]string)
		batchCompanyOngoingPackageLPA[bYear] = make(map[int64]float64)
		batchCompanyOngoingJobRoles[bYear] = make(map[int64]string)
		batchCompanyDriveID[bYear] = make(map[int64]uint64)
		batchCompanyOngoingDriveID[bYear] = make(map[int64]uint64)
	}

	companyOverallLatestRole := make(map[int64]string)
	companyOverallLatestPkg := make(map[int64]float64)
	companyOverallLatestDriveID := make(map[int64]uint64)

	if len(compIDs) > 0 {
		// 4a. placement_company_batch_placements
		type PlacedResult struct {
			Batch          string `gorm:"column:batch"`
			CompanyID      int64  `gorm:"column:company_id"`
			StudentsPlaced int64  `gorm:"column:students_placed"`
		}
		var placedResults []PlacedResult
		r.db.Table("placement_company_batch_placements").
			Where("status = '1' AND company_id IN ?", compIDs).
			Scan(&placedResults)

		for _, pr := range placedResults {
			parts := strings.Split(pr.Batch, "-")
			gradYear := pr.Batch
			if len(parts) == 2 {
				gradYear = strings.TrimSpace(parts[1])
			}
			if batchVisitedCompanies[gradYear] == nil {
				batchVisitedCompanies[gradYear] = make(map[int64]bool)
				batchCompanyOffers[gradYear] = make(map[int64]int64)
				batchCompanyDriveStatus[gradYear] = make(map[int64]string)
				batchCompanyPackageLPA[gradYear] = make(map[int64]float64)
				batchCompanyJobRoles[gradYear] = make(map[int64]string)
			}
			batchVisitedCompanies[gradYear][pr.CompanyID] = true
			compVisitedBatches[pr.CompanyID] = append(compVisitedBatches[pr.CompanyID], gradYear)
			if pr.StudentsPlaced > batchCompanyOffers[gradYear][pr.CompanyID] {
				batchCompanyOffers[gradYear][pr.CompanyID] = pr.StudentsPlaced
			}
			if batchCompanyDriveStatus[gradYear][pr.CompanyID] == "" {
				batchCompanyDriveStatus[gradYear][pr.CompanyID] = "Completed Placements"
			}
		}

		// 4b. placement_drive
		type DriveDetailResult struct {
			ID            uint64  `gorm:"column:id"`
			CompanyID     int64   `gorm:"column:company_id"`
			BatchIDs      string  `gorm:"column:batch_id"`
			OverallStatus string  `gorm:"column:overall_status"`
			JobRole       string  `gorm:"column:job_role"`
			PackageLPA    float64 `gorm:"column:package_lpa"`
			OffersCount   int64   `gorm:"column:offers_count"`
		}
		var driveDetails []DriveDetailResult
		r.db.Table("placement_drive pd").
			Select("pd.id as id, pd.company_id, pd.batch_id, pd.overall_status, pd.job_role, pd.package_lpa, COUNT(pdo.id) as offers_count").
			Joins("LEFT JOIN placement_drive_students pds ON pd.id = pds.drive_id").
			Joins("LEFT JOIN placement_drive_offers pdo ON pds.id = pdo.drive_student_id").
			Where("pd.company_id IN ?", compIDs).
			Group("pd.id, pd.company_id, pd.batch_id, pd.overall_status, pd.job_role, pd.package_lpa").
			Scan(&driveDetails)

		for _, dd := range driveDetails {
			for bID, bYear := range batchIDToYear {
				jsonPattern := fmt.Sprintf("[%d]", bID)
				containsID := strings.Contains(dd.BatchIDs, jsonPattern) || 
					strings.Contains(dd.BatchIDs, fmt.Sprintf("%d", bID))
				if containsID {
					if batchVisitedCompanies[bYear] == nil {
						batchVisitedCompanies[bYear] = make(map[int64]bool)
						batchCompanyOffers[bYear] = make(map[int64]int64)
						batchCompanyDriveStatus[bYear] = make(map[int64]string)
						batchCompanyPackageLPA[bYear] = make(map[int64]float64)
						batchCompanyJobRoles[bYear] = make(map[int64]string)
						batchCompanyHasOngoingDrive[bYear] = make(map[int64]bool)
						batchCompanyOngoingDriveStatus[bYear] = make(map[int64]string)
						batchCompanyOngoingPackageLPA[bYear] = make(map[int64]float64)
						batchCompanyOngoingJobRoles[bYear] = make(map[int64]string)
						batchCompanyDriveID[bYear] = make(map[int64]uint64)
						batchCompanyOngoingDriveID[bYear] = make(map[int64]uint64)
					}
					if batchCompanyDriveID[bYear] == nil {
						batchCompanyDriveID[bYear] = make(map[int64]uint64)
						batchCompanyOngoingDriveID[bYear] = make(map[int64]uint64)
					}
					batchCompanyDriveID[bYear][dd.CompanyID] = dd.ID
					batchVisitedCompanies[bYear][dd.CompanyID] = true
					compVisitedBatches[dd.CompanyID] = append(compVisitedBatches[dd.CompanyID], bYear)
					if dd.OffersCount > batchCompanyOffers[bYear][dd.CompanyID] {
						batchCompanyOffers[bYear][dd.CompanyID] = dd.OffersCount
					}
					if dd.PackageLPA > batchCompanyPackageLPA[bYear][dd.CompanyID] {
						batchCompanyPackageLPA[bYear][dd.CompanyID] = dd.PackageLPA
					}
					if dd.OverallStatus != "" {
						batchCompanyDriveStatus[bYear][dd.CompanyID] = dd.OverallStatus
					}
					if dd.JobRole != "" {
						batchCompanyJobRoles[bYear][dd.CompanyID] = dd.JobRole
						if companyOverallLatestRole[dd.CompanyID] == "" {
							companyOverallLatestRole[dd.CompanyID] = dd.JobRole
						}
					}
					if dd.PackageLPA > 0 && companyOverallLatestPkg[dd.CompanyID] == 0 {
						companyOverallLatestPkg[dd.CompanyID] = dd.PackageLPA
					}
					if dd.ID > 0 && companyOverallLatestDriveID[dd.CompanyID] == 0 {
						companyOverallLatestDriveID[dd.CompanyID] = dd.ID
					}

					// Ongoing Recruitment logic: If a drive has been created, it is considered ongoing
					// UNLESS its overall_status is 'completed' or 'cancelled'.
					stClean := strings.ToLower(strings.TrimSpace(dd.OverallStatus))
					if stClean != "completed" && stClean != "completed placements" && stClean != "cancelled" {
						batchCompanyHasOngoingDrive[bYear][dd.CompanyID] = true
						batchCompanyOngoingDriveStatus[bYear][dd.CompanyID] = dd.OverallStatus
						batchCompanyOngoingDriveID[bYear][dd.CompanyID] = dd.ID
						if dd.PackageLPA > batchCompanyOngoingPackageLPA[bYear][dd.CompanyID] {
							batchCompanyOngoingPackageLPA[bYear][dd.CompanyID] = dd.PackageLPA
						}
						if dd.JobRole != "" {
							batchCompanyOngoingJobRoles[bYear][dd.CompanyID] = dd.JobRole
						}
					}
				}
			}
		}
	}

	// 4c. First visited batch
	firstVisitBatch := make(map[int64]string)
	for cID, bList := range compVisitedBatches {
		earliest := ""
		for _, b := range bList {
			if earliest == "" || b < earliest {
				earliest = b
			}
		}
		firstVisitBatch[cID] = earliest
	}

	// 5. Match companies based on selected metric
	normalizedMetric := strings.ToLower(strings.TrimSpace(metricKey))
	var resultList []models.IndustryMetricCompanyDetail
	var metricTitle string

	getCleanDriveStatus := func(rawStatus string) string {
		if rawStatus == "" {
			return "Not Started"
		}
		switch strings.ToLower(rawStatus) {
		case "draft":
			return "Draft"
		case "registration_open":
			return "Registration Open"
		case "scheduled":
			return "Scheduled"
		case "in_progress":
			return "In Progress"
		case "awaiting_next_round":
			return "Awaiting Round"
		case "awaiting_final_result":
			return "Awaiting Result"
		case "completed", "completed placements":
			return "Completed"
		case "on_hold":
			return "On Hold"
		case "cancelled":
			return "Cancelled"
		default:
			return strings.Title(strings.ReplaceAll(rawStatus, "_", " "))
		}
	}

	getCompanyRole := func(bYear string, compID int64) string {
		if r := batchCompanyJobRoles[bYear][compID]; r != "" {
			return r
		}
		return companyOverallLatestRole[compID]
	}
	getCompanyPkg := func(bYear string, compID int64) float64 {
		if p := batchCompanyPackageLPA[bYear][compID]; p > 0 {
			return p
		}
		return companyOverallLatestPkg[compID]
	}
	getCompanyDriveID := func(bYear string, compID int64) uint64 {
		if id := batchCompanyDriveID[bYear][compID]; id > 0 {
			return id
		}
		return companyOverallLatestDriveID[compID]
	}

	switch normalizedMetric {
	case "visited", "visited_recruiters":
		metricTitle = "Industries Visited"
		for _, c := range matchingCompanies {
			if batchVisitedCompanies[targetGradYear][c.ID] {
				status := getCleanDriveStatus(batchCompanyDriveStatus[targetGradYear][c.ID])
				placed := batchCompanyOffers[targetGradYear][c.ID]
				pkg := batchCompanyPackageLPA[targetGradYear][c.ID]
				roles := batchCompanyJobRoles[targetGradYear][c.ID]
				resultList = append(resultList, models.IndustryMetricCompanyDetail{
					CompanyID:         c.ID,
					DriveID:           batchCompanyDriveID[targetGradYear][c.ID],
					CompanyName:       c.CompanyName,
					Category:          c.Category,
					CompanyDomain:     c.CompanyDomain,
					CollaborationType: c.CollaborationType,
					DriveStatus:       status,
					StudentsPlaced:    placed,
					OffersCount:       placed,
					PackageLPA:        pkg,
					JobRoles:          roles,
					FirstVisitedBatch: firstVisitBatch[c.ID],
				})
			}
		}

	case "new", "new_recruiters":
		metricTitle = "New Industries Visited"
		for _, c := range matchingCompanies {
			if firstVisitBatch[c.ID] == targetGradYear {
				status := getCleanDriveStatus(batchCompanyDriveStatus[targetGradYear][c.ID])
				placed := batchCompanyOffers[targetGradYear][c.ID]
				pkg := batchCompanyPackageLPA[targetGradYear][c.ID]
				roles := batchCompanyJobRoles[targetGradYear][c.ID]
				resultList = append(resultList, models.IndustryMetricCompanyDetail{
					CompanyID:         c.ID,
					DriveID:           batchCompanyDriveID[targetGradYear][c.ID],
					CompanyName:       c.CompanyName,
					Category:          c.Category,
					CompanyDomain:     c.CompanyDomain,
					CollaborationType: c.CollaborationType,
					DriveStatus:       status,
					StudentsPlaced:    placed,
					OffersCount:       placed,
					PackageLPA:        pkg,
					JobRoles:          roles,
					FirstVisitedBatch: targetGradYear,
				})
			}
		}

	case "missed", "attention":
		metricTitle = "Visited in Previous 3 Years but Not This Year"
		if batchIndex >= 0 && batchIndex+1 < len(allBatches) {
			for _, c := range matchingCompanies {
				visitedPrev := false
				var lastVisited string
				for nextIdx := batchIndex + 1; nextIdx < len(allBatches) && nextIdx <= batchIndex+3; nextIdx++ {
					py := allBatches[nextIdx]
					if batchVisitedCompanies[py][c.ID] {
						visitedPrev = true
						if lastVisited == "" {
							lastVisited = py
						}
					}
				}
				if visitedPrev && !batchVisitedCompanies[targetGradYear][c.ID] {
					pkg := getCompanyPkg(lastVisited, c.ID)
					roles := getCompanyRole(lastVisited, c.ID)
					dID := getCompanyDriveID(lastVisited, c.ID)
					resultList = append(resultList, models.IndustryMetricCompanyDetail{
						CompanyID:         c.ID,
						DriveID:           dID,
						CompanyName:       c.CompanyName,
						Category:          c.Category,
						CompanyDomain:     c.CompanyDomain,
						CollaborationType: c.CollaborationType,
						DriveStatus:       "Not Started",
						StudentsPlaced:    0,
						OffersCount:       0,
						PackageLPA:        pkg,
						JobRoles:          roles,
						LastVisitedBatch:  lastVisited,
						FirstVisitedBatch: firstVisitBatch[c.ID],
					})
				}
			}
		}

	case "equallast", "equal_last":
		metricTitle = "Offers Equal to or Higher Than Last Year"
		if batchIndex >= 0 && batchIndex+1 < len(allBatches) {
			prevYear := allBatches[batchIndex+1]
			for _, c := range matchingCompanies {
				curOff := batchCompanyOffers[targetGradYear][c.ID]
				prevOff := batchCompanyOffers[prevYear][c.ID]
				if curOff > 0 && curOff >= prevOff {
					status := getCleanDriveStatus(batchCompanyDriveStatus[targetGradYear][c.ID])
					pkg := batchCompanyPackageLPA[targetGradYear][c.ID]
					roles := batchCompanyJobRoles[targetGradYear][c.ID]
					resultList = append(resultList, models.IndustryMetricCompanyDetail{
						CompanyID:         c.ID,
						CompanyName:       c.CompanyName,
						Category:          c.Category,
						CompanyDomain:     c.CompanyDomain,
						CollaborationType: c.CollaborationType,
						DriveStatus:       status,
						StudentsPlaced:    curOff,
						OffersCount:       curOff,
						PackageLPA:        pkg,
						JobRoles:          roles,
						FirstVisitedBatch: firstVisitBatch[c.ID],
					})
				}
			}
		}

	case "lesslast", "less_last":
		metricTitle = "Offers Lower Than Last Year"
		if batchIndex >= 0 && batchIndex+1 < len(allBatches) {
			prevYear := allBatches[batchIndex+1]
			for _, c := range matchingCompanies {
				curOff := batchCompanyOffers[targetGradYear][c.ID]
				prevOff := batchCompanyOffers[prevYear][c.ID]
				if prevOff > 0 && curOff < prevOff {
					status := getCleanDriveStatus(batchCompanyDriveStatus[targetGradYear][c.ID])
					pkg := batchCompanyPackageLPA[targetGradYear][c.ID]
					roles := batchCompanyJobRoles[targetGradYear][c.ID]
					resultList = append(resultList, models.IndustryMetricCompanyDetail{
						CompanyID:         c.ID,
						CompanyName:       c.CompanyName,
						Category:          c.Category,
						CompanyDomain:     c.CompanyDomain,
						CollaborationType: c.CollaborationType,
						DriveStatus:       status,
						StudentsPlaced:    curOff,
						OffersCount:       curOff,
						PackageLPA:        pkg,
						JobRoles:          roles,
						FirstVisitedBatch: firstVisitBatch[c.ID],
					})
				}
			}
		}

	case "equalmax3", "equal_max_3":
		metricTitle = "Offers ≥ Previous 3-Year Maximum"
		if batchIndex >= 0 && batchIndex+3 < len(allBatches) {
			for _, c := range matchingCompanies {
				curOff := batchCompanyOffers[targetGradYear][c.ID]
				var maxPrev int64 = 0
				hasPrev := false
				for nextIdx := batchIndex + 1; nextIdx <= batchIndex+3; nextIdx++ {
					pOff := batchCompanyOffers[allBatches[nextIdx]][c.ID]
					if pOff > 0 {
						hasPrev = true
						if pOff > maxPrev {
							maxPrev = pOff
						}
					}
				}
				if hasPrev && curOff >= maxPrev && curOff > 0 {
					status := getCleanDriveStatus(batchCompanyDriveStatus[targetGradYear][c.ID])
					pkg := batchCompanyPackageLPA[targetGradYear][c.ID]
					roles := batchCompanyJobRoles[targetGradYear][c.ID]
					resultList = append(resultList, models.IndustryMetricCompanyDetail{
						CompanyID:         c.ID,
						CompanyName:       c.CompanyName,
						Category:          c.Category,
						CompanyDomain:     c.CompanyDomain,
						CollaborationType: c.CollaborationType,
						DriveStatus:       status,
						StudentsPlaced:    curOff,
						OffersCount:       curOff,
						PackageLPA:        pkg,
						JobRoles:          roles,
						FirstVisitedBatch: firstVisitBatch[c.ID],
					})
				}
			}
		}

	case "lessmin3", "less_min_3":
		metricTitle = "Offers Below Previous 3-Year Minimum"
		if batchIndex >= 0 && batchIndex+3 < len(allBatches) {
			for _, c := range matchingCompanies {
				curOff := batchCompanyOffers[targetGradYear][c.ID]
				var minPrev int64 = 999999
				hasPrev := false
				for nextIdx := batchIndex + 1; nextIdx <= batchIndex+3; nextIdx++ {
					pOff := batchCompanyOffers[allBatches[nextIdx]][c.ID]
					if pOff > 0 {
						hasPrev = true
						if pOff < minPrev {
							minPrev = pOff
						}
					}
				}
				if hasPrev && curOff < minPrev {
					status := getCleanDriveStatus(batchCompanyDriveStatus[targetGradYear][c.ID])
					pkg := batchCompanyPackageLPA[targetGradYear][c.ID]
					roles := batchCompanyJobRoles[targetGradYear][c.ID]
					resultList = append(resultList, models.IndustryMetricCompanyDetail{
						CompanyID:         c.ID,
						CompanyName:       c.CompanyName,
						Category:          c.Category,
						CompanyDomain:     c.CompanyDomain,
						CollaborationType: c.CollaborationType,
						DriveStatus:       status,
						StudentsPlaced:    curOff,
						OffersCount:       curOff,
						PackageLPA:        pkg,
						JobRoles:          roles,
						FirstVisitedBatch: firstVisitBatch[c.ID],
					})
				}
			}
		}

	case "ongoing", "ongoing_recruitments":
		metricTitle = "Ongoing Recruitments"
		for _, c := range matchingCompanies {
			if batchCompanyHasOngoingDrive[targetGradYear][c.ID] {
				placed := batchCompanyOffers[targetGradYear][c.ID]
				pkg := batchCompanyOngoingPackageLPA[targetGradYear][c.ID]
				if pkg == 0 {
					pkg = batchCompanyPackageLPA[targetGradYear][c.ID]
				}
				roles := batchCompanyOngoingJobRoles[targetGradYear][c.ID]
				if roles == "" {
					roles = batchCompanyJobRoles[targetGradYear][c.ID]
				}
				st := batchCompanyOngoingDriveStatus[targetGradYear][c.ID]
				resultList = append(resultList, models.IndustryMetricCompanyDetail{
					CompanyID:         c.ID,
					DriveID:           batchCompanyOngoingDriveID[targetGradYear][c.ID],
					CompanyName:       c.CompanyName,
					Category:          c.Category,
					CompanyDomain:     c.CompanyDomain,
					CollaborationType: c.CollaborationType,
					DriveStatus:       getCleanDriveStatus(st),
					StudentsPlaced:    placed,
					OffersCount:       placed,
					PackageLPA:        pkg,
					JobRoles:          roles,
					FirstVisitedBatch: firstVisitBatch[c.ID],
				})
			}
		}

	case "completed", "completed_recruitments":
		metricTitle = "Completed Recruitments"
		for _, c := range matchingCompanies {
			st := strings.ToLower(batchCompanyDriveStatus[targetGradYear][c.ID])
			placed := batchCompanyOffers[targetGradYear][c.ID]
			if st == "completed" || st == "completed placements" || placed > 0 {
				pkg := batchCompanyPackageLPA[targetGradYear][c.ID]
				roles := batchCompanyJobRoles[targetGradYear][c.ID]
				resultList = append(resultList, models.IndustryMetricCompanyDetail{
					CompanyID:         c.ID,
					DriveID:           batchCompanyDriveID[targetGradYear][c.ID],
					CompanyName:       c.CompanyName,
					Category:          c.Category,
					CompanyDomain:     c.CompanyDomain,
					CollaborationType: c.CollaborationType,
					DriveStatus:       "Completed",
					StudentsPlaced:    placed,
					OffersCount:       placed,
					PackageLPA:        pkg,
					JobRoles:          roles,
					FirstVisitedBatch: firstVisitBatch[c.ID],
				})
			}
		}

	case "total", "total_active_recruiters":
		metricTitle = "Total Active Recruiters"
		for _, c := range matchingCompanies {
			placed := batchCompanyOffers[targetGradYear][c.ID]
			pkg := batchCompanyPackageLPA[targetGradYear][c.ID]
			roles := batchCompanyJobRoles[targetGradYear][c.ID]
			status := getCleanDriveStatus(batchCompanyDriveStatus[targetGradYear][c.ID])
			resultList = append(resultList, models.IndustryMetricCompanyDetail{
				CompanyID:         c.ID,
				DriveID:           batchCompanyDriveID[targetGradYear][c.ID],
				CompanyName:       c.CompanyName,
				Category:          c.Category,
				CompanyDomain:     c.CompanyDomain,
				CollaborationType: c.CollaborationType,
				DriveStatus:       status,
				StudentsPlaced:    placed,
				OffersCount:       placed,
				PackageLPA:        pkg,
				JobRoles:          roles,
				FirstVisitedBatch: firstVisitBatch[c.ID],
			})
		}

	default:
		metricTitle = "Recruiters"
		for _, c := range matchingCompanies {
			if batchVisitedCompanies[targetGradYear][c.ID] {
				resultList = append(resultList, models.IndustryMetricCompanyDetail{
					CompanyID:         c.ID,
					CompanyName:       c.CompanyName,
					Category:          c.Category,
					CompanyDomain:     c.CompanyDomain,
					CollaborationType: c.CollaborationType,
					DriveStatus:       getCleanDriveStatus(batchCompanyDriveStatus[targetGradYear][c.ID]),
					StudentsPlaced:    batchCompanyOffers[targetGradYear][c.ID],
					OffersCount:       batchCompanyOffers[targetGradYear][c.ID],
					PackageLPA:        batchCompanyPackageLPA[targetGradYear][c.ID],
					JobRoles:          batchCompanyJobRoles[targetGradYear][c.ID],
					FirstVisitedBatch: firstVisitBatch[c.ID],
				})
			}
		}
	}

	return &models.IndustryMetricCompaniesResponse{
		MetricKey:   normalizedMetric,
		MetricTitle: metricTitle,
		Batch:       targetBatch.Name,
		TotalCount:  len(resultList),
		Companies:   resultList,
	}, nil
}

// GetCompanyRecruitmentDrives returns all recruitment phases/drives grouped by placement year for a selected company
func (r *PlacementIntelligenceRepository) GetCompanyRecruitmentDrives(companyIDParam, companyNameParam, batchParam, roleParam, deptParam string) (*models.CompanyRecruitmentDrivesResponse, error) {
	// 1. Identify company
	var company models.PlacementCompany
	if companyIDParam != "" && companyIDParam != "0" {
		r.db.Where("id = ?", companyIDParam).First(&company)
	}
	if company.ID == 0 && companyNameParam != "" {
		r.db.Where("company_name LIKE ?", "%"+companyNameParam+"%").First(&company)
	}
	if company.ID == 0 {
		return nil, fmt.Errorf("company not found")
	}

	// 2. Fetch master batches
	var allBatches []models.Batch
	r.db.Order("name desc").Find(&allBatches)
	batchIDMap := make(map[uint64]models.Batch)
	for _, b := range allBatches {
		batchIDMap[b.ID] = b
	}

	// 3. Fetch master departments
	var allDepts []models.Department
	r.db.Find(&allDepts)
	deptIDMap := make(map[uint64]models.Department)
	for _, d := range allDepts {
		deptIDMap[d.ID] = d
	}

	// 4. Query drives for this company
	type DriveRaw struct {
		ID             uint64     `gorm:"column:id"`
		CompanyID      int64      `gorm:"column:company_id"`
		BatchIDs       string     `gorm:"column:batch_id"`
		JobRole        string     `gorm:"column:job_role"`
		PackageLPA     float64    `gorm:"column:package_lpa"`
		OverallStatus  string     `gorm:"column:overall_status"`
		DriveStartDate *time.Time `gorm:"column:drive_start_date"`
		CreatedAt      time.Time  `gorm:"column:created_at"`
	}
	var rawDrives []DriveRaw
	r.db.Table("placement_drive").
		Where("company_id = ?", company.ID).
		Order("created_at desc, id desc").
		Scan(&rawDrives)

	// Helper to extract departments for a drive
	getDriveDepartments := func(driveID uint64) []string {
		var deptIDsJSON string
		r.db.Table("placement_drive_eligibility").
			Where("drive_id = ?", driveID).
			Pluck("department_ids", &deptIDsJSON)

		deptNames := make([]string, 0)
		if deptIDsJSON != "" && deptIDsJSON != "null" {
			var ids []uint64
			if err := json.Unmarshal([]byte(deptIDsJSON), &ids); err == nil && len(ids) > 0 {
				for _, id := range ids {
					if d, ok := deptIDMap[id]; ok {
						deptNames = append(deptNames, strings.TrimSpace(d.Name))
					}
				}
			}
		}
		if len(deptNames) == 0 {
			var studentDepts []string
			r.db.Table("placement_drive_students pds").
				Joins("JOIN master_users u ON pds.user_id = u.id").
				Joins("JOIN departments d ON u.department_id = d.id").
				Where("pds.drive_id = ?", driveID).
				Distinct("d.name").
				Pluck("d.name", &studentDepts)
			for _, dName := range studentDepts {
				deptNames = append(deptNames, strings.TrimSpace(dName))
			}
		}
		seen := make(map[string]bool)
		uniqueDepts := make([]string, 0, len(deptNames))
		for _, dn := range deptNames {
			if !seen[dn] && dn != "" {
				seen[dn] = true
				uniqueDepts = append(uniqueDepts, dn)
			}
		}
		return uniqueDepts
	}

	// Helper to build recruitment stages pipeline strictly from MySQL DB records
	getDriveStagesFunnel := func(driveID uint64, overallStatus string) []models.CompanyDriveStageItem {
		var stages []models.CompanyDriveStageItem
		step := 1

		// 1. Registered students: actual count from placement_drive_students
		var registeredCount int64
		r.db.Model(&models.PlacementDriveStudent{}).
			Where("drive_id = ?", driveID).
			Count(&registeredCount)

		stages = append(stages, models.CompanyDriveStageItem{
			Step:   step,
			Label:  "Registered",
			Value:  registeredCount,
			Active: false,
		})
		step++

		// 2. Eligible students: students included or evaluated eligible in placement_drive_students
		var eligibleCount int64
		r.db.Model(&models.PlacementDriveStudent{}).
			Where("drive_id = ? AND drive_status IN ('included', 'special_entry')", driveID).
			Count(&eligibleCount)
		if eligibleCount == 0 && registeredCount > 0 {
			eligibleCount = registeredCount
		}

		stages = append(stages, models.CompanyDriveStageItem{
			Step:   step,
			Label:  "Eligible",
			Value:  eligibleCount,
			Active: false,
		})
		step++

		// 3. Real stages from placement_drive_stages for this drive
		var dbStages []models.PlacementDriveStage
		r.db.Where("drive_id = ?", driveID).Order("sequence_no asc, id asc").Find(&dbStages)

		for _, s := range dbStages {
			var partCount int64
			r.db.Model(&models.PlacementStageResult{}).
				Where("stage_id = ?", s.ID).
				Count(&partCount)

			// Stage is active if status is in_progress or awaiting_result
			isActive := s.StageStatus == "in_progress" || s.StageStatus == "awaiting_result"

			stages = append(stages, models.CompanyDriveStageItem{
				Step:   step,
				Label:  s.StageName,
				Value:  partCount,
				Active: isActive,
			})
			step++
		}

		// 4. Offers: actual count from placement_drive_offers
		var offersCount int64
		r.db.Table("placement_drive_offers pdo").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
			Where("pds.drive_id = ?", driveID).
			Count(&offersCount)

		if offersCount == 0 {
			var batchPlaced int64
			r.db.Table("placement_company_batch_placements").
				Where("drive_id = ? AND status = '1'", driveID).
				Select("COALESCE(SUM(students_placed), 0)").
				Scan(&batchPlaced)
			if batchPlaced > 0 {
				offersCount = batchPlaced
			}
		}

		stages = append(stages, models.CompanyDriveStageItem{
			Step:   step,
			Label:  "Offers",
			Value:  offersCount,
			Active: false,
		})

		return stages
	}

	batchSet := make(map[string]bool)
	roleSet := make(map[string]bool)
	deptSet := make(map[string]bool)

	type ProcessedDrive struct {
		DriveID       uint64
		BatchName     string
		PlacementYear string
		JobRole       string
		PackageLPA    float64
		OverallStatus string
		Date          string
		Departments   []string
		OffersCount   int64
		Stages        []models.CompanyDriveStageItem
	}
	var processedList []ProcessedDrive

	for _, rd := range rawDrives {
		var targetYears []string
		if rd.BatchIDs != "" {
			for bID, bObj := range batchIDMap {
				p := fmt.Sprintf("[%d]", bID)
				if strings.Contains(rd.BatchIDs, p) || strings.Contains(rd.BatchIDs, fmt.Sprintf("%d", bID)) {
					parts := strings.Split(bObj.Name, "-")
					gYear := bObj.Name
					if len(parts) == 2 {
						gYear = strings.TrimSpace(parts[1])
					}
					targetYears = append(targetYears, gYear)
					batchSet[gYear] = true
				}
			}
		}
		if len(targetYears) == 0 && len(allBatches) > 0 {
			parts := strings.Split(allBatches[0].Name, "-")
			gYear := allBatches[0].Name
			if len(parts) == 2 {
				gYear = strings.TrimSpace(parts[1])
			}
			targetYears = append(targetYears, gYear)
			batchSet[gYear] = true
		}

		if rd.JobRole != "" {
			roleSet[rd.JobRole] = true
		}

		depts := getDriveDepartments(rd.ID)
		for _, dn := range depts {
			deptSet[dn] = true
		}

		dateStr := rd.CreatedAt.Format("02 Jan 2006")
		if rd.DriveStartDate != nil {
			dateStr = rd.DriveStartDate.Format("02 Jan 2006")
		}

		var offCount int64
		r.db.Table("placement_drive_offers pdo").
			Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
			Where("pds.drive_id = ?", rd.ID).
			Count(&offCount)
		if offCount == 0 {
			var batchPlaced int64
			r.db.Table("placement_company_batch_placements").
				Where("drive_id = ? AND status = '1'", rd.ID).
				Select("COALESCE(SUM(students_placed), 0)").
				Scan(&batchPlaced)
			if batchPlaced > 0 {
				offCount = batchPlaced
			}
		}

		stages := getDriveStagesFunnel(rd.ID, rd.OverallStatus)

		for _, pYear := range targetYears {
			processedList = append(processedList, ProcessedDrive{
				DriveID:       rd.ID,
				BatchName:     pYear,
				PlacementYear: pYear,
				JobRole:       rd.JobRole,
				PackageLPA:    rd.PackageLPA,
				OverallStatus: rd.OverallStatus,
				Date:          dateStr,
				Departments:   depts,
				OffersCount:   offCount,
				Stages:        stages,
			})
		}
	}

	filterBatches := []string{"All Batches"}
	batchSeen := make(map[string]bool)
	for _, b := range allBatches {
		trimmed := strings.TrimSpace(b.Name)
		if trimmed != "" && !batchSeen[trimmed] {
			batchSeen[trimmed] = true
			filterBatches = append(filterBatches, trimmed)
		}
	}

	filterRoles := []string{"All Roles"}
	var sortedRoles []string
	for r := range roleSet {
		trimmed := strings.TrimSpace(r)
		if trimmed != "" {
			sortedRoles = append(sortedRoles, trimmed)
		}
	}
	sort.Strings(sortedRoles)
	filterRoles = append(filterRoles, sortedRoles...)

	// Build department options strictly from the departments database table (full names)
	filterDepts := []string{"All Departments"}
	deptNameMap := make(map[string]bool)
	var sortedDepts []string
	for _, d := range allDepts {
		if d.ID == 4 || strings.EqualFold(strings.TrimSpace(d.Name), "placement") || strings.Contains(strings.ToLower(d.Name), "placement") {
			continue
		}
		name := strings.TrimSpace(d.Name)
		if name != "" && !deptNameMap[name] {
			deptNameMap[name] = true
			sortedDepts = append(sortedDepts, name)
		}
	}
	sort.Strings(sortedDepts)
	filterDepts = append(filterDepts, sortedDepts...)

	cleanBatch := strings.TrimSpace(batchParam)
	cleanRole := strings.TrimSpace(roleParam)
	cleanDept := strings.TrimSpace(deptParam)

	var selectedBatches []string
	if cleanBatch != "" && !strings.EqualFold(cleanBatch, "all") && !strings.EqualFold(cleanBatch, "all batches") {
		for _, b := range strings.Split(cleanBatch, ",") {
			tb := strings.TrimSpace(b)
			if tb != "" && !strings.EqualFold(tb, "all") && !strings.EqualFold(tb, "all batches") {
				selectedBatches = append(selectedBatches, tb)
			}
		}
	}

	var selectedRoles []string
	if cleanRole != "" && !strings.EqualFold(cleanRole, "all") && !strings.EqualFold(cleanRole, "all roles") {
		for _, r := range strings.Split(cleanRole, ",") {
			tr := strings.TrimSpace(r)
			if tr != "" && !strings.EqualFold(tr, "all") && !strings.EqualFold(tr, "all roles") {
				selectedRoles = append(selectedRoles, tr)
			}
		}
	}

	var selectedDepts []string
	if cleanDept != "" && !strings.EqualFold(cleanDept, "all") && !strings.EqualFold(cleanDept, "all departments") {
		for _, d := range strings.Split(cleanDept, ",") {
			td := strings.TrimSpace(d)
			if td != "" && !strings.EqualFold(td, "all") && !strings.EqualFold(td, "all departments") {
				selectedDepts = append(selectedDepts, td)
			}
		}
	}

	var filteredDrives []ProcessedDrive
	for _, pd := range processedList {
		// 1. Batch filter: match if drive matches ANY selected batch
		if len(selectedBatches) > 0 {
			batchMatched := false
			for _, sb := range selectedBatches {
				if strings.EqualFold(pd.PlacementYear, sb) ||
					strings.EqualFold(pd.BatchName, sb) ||
					strings.Contains(strings.ToLower(sb), strings.ToLower(pd.PlacementYear)) ||
					strings.Contains(strings.ToLower(pd.BatchName), strings.ToLower(sb)) {
					batchMatched = true
					break
				}
			}
			if !batchMatched {
				continue
			}
		}

		// 2. Role filter: match if drive matches ANY selected role
		if len(selectedRoles) > 0 {
			roleMatched := false
			for _, sr := range selectedRoles {
				if strings.EqualFold(pd.JobRole, sr) {
					roleMatched = true
					break
				}
			}
			if !roleMatched {
				continue
			}
		}

		// 3. Department filter: match if ANY of drive's departments matches ANY selected department
		if len(selectedDepts) > 0 {
			deptMatched := false
			for _, sd := range selectedDepts {
				for _, d := range pd.Departments {
					if strings.EqualFold(d, sd) ||
						strings.Contains(strings.ToLower(d), strings.ToLower(sd)) ||
						strings.Contains(strings.ToLower(sd), strings.ToLower(d)) {
						deptMatched = true
						break
					}
				}
				if deptMatched {
					break
				}
			}
			if !deptMatched {
				continue
			}
		}

		filteredDrives = append(filteredDrives, pd)
	}

	yearGroupsMap := make(map[string][]ProcessedDrive)
	for _, fd := range filteredDrives {
		yearGroupsMap[fd.PlacementYear] = append(yearGroupsMap[fd.PlacementYear], fd)
	}

	var sortedYears []string
	for y := range yearGroupsMap {
		sortedYears = append(sortedYears, y)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(sortedYears)))

	var yearGroups []models.CompanyPlacementYearGroup
	var totalOffersAll int64 = 0

	for _, y := range sortedYears {
		drivesInYear := yearGroupsMap[y]
		var totalYearOffers int64 = 0
		var phaseList []models.CompanyRecruitmentDrivePhase

		for idx, d := range drivesInYear {
			totalYearOffers += d.OffersCount
			totalOffersAll += d.OffersCount

			statusBadge := "Ongoing"
			statusClass := "bg-[#fffbeb] text-[#b45309] border-[#fde68a]"
			lowSt := strings.ToLower(d.OverallStatus)
			if lowSt == "completed" {
				statusBadge = "Completed"
				statusClass = "bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]"
			} else if lowSt == "cancelled" || lowSt == "canceled" {
				statusBadge = "Cancelled"
				statusClass = "bg-[#fff1f2] text-[#e11d48] border-[#fecdd3]"
			} else if lowSt == "awaiting_final_result" || lowSt == "awaiting_result" || strings.Contains(lowSt, "awaiting") {
				statusBadge = "Awaiting for final result"
				statusClass = "bg-[#faf5ff] text-[#9333ea] border-[#e9d5ff]"
			} else {
				// All active/created drives that are not completed/cancelled/awaiting result are Ongoing
				statusBadge = "Ongoing"
				statusClass = "bg-[#fffbeb] text-[#b45309] border-[#fde68a]"
			}

			phaseNum := idx + 1
			title := fmt.Sprintf("%s · Phase %d", d.JobRole, phaseNum)
			if d.JobRole == "" {
				title = fmt.Sprintf("Campus Drive · Phase %d", phaseNum)
			}

			phaseList = append(phaseList, models.CompanyRecruitmentDrivePhase{
				DriveID:          d.DriveID,
				Title:            title,
				PhaseName:        fmt.Sprintf("Phase %d", phaseNum),
				JobRole:          d.JobRole,
				Date:             d.Date,
				Departments:      d.Departments,
				PackageLPA:       d.PackageLPA,
				OverallStatus:    statusBadge,
				StatusBadgeClass: statusClass,
				OffersCount:      d.OffersCount,
				Stages:           d.Stages,
			})
		}

		yearGroups = append(yearGroups, models.CompanyPlacementYearGroup{
			Year:        y,
			PhasesCount: len(phaseList),
			TotalOffers: totalYearOffers,
			Drives:      phaseList,
		})
	}

	return &models.CompanyRecruitmentDrivesResponse{
		Company: models.CompanyBasicInfo{
			ID:                company.ID,
			CompanyName:       company.CompanyName,
			Category:          company.Category,
			CompanyDomain:     company.CompanyDomain,
			CollaborationType: company.CollaborationType,
		},
		FilterOptions: models.CompanyDriveFilterOptions{
			Batches:     filterBatches,
			Roles:       filterRoles,
			Departments: filterDepts,
		},
		Years:       yearGroups,
		TotalDrives: len(filteredDrives),
		TotalOffers: totalOffersAll,
	}, nil
}

// GetCompanyStatistics returns the real recruiter ranking data, status summaries, and filter options
func (r *PlacementIntelligenceRepository) GetCompanyStatistics(batchParam, sectorParam, deptParam, statusParam, sortParam, searchParam string) (*models.CompanyStatisticsResponse, error) {
	// 1. Fetch all batches in DB ordered ASC so the current/primary graduating batch comes first
	var dbBatches []models.Batch
	if err := r.db.Order("name ASC").Find(&dbBatches).Error; err != nil {
		return nil, err
	}

	batchNames := make([]string, 0, len(dbBatches))
	batchIDMap := make(map[uint64]models.Batch)
	batchIDToYear := make(map[uint64]string)
	yearToBatchID := make(map[string]uint64)
	for _, b := range dbBatches {
		batchNames = append(batchNames, b.Name)
		batchIDMap[b.ID] = b
		parts := strings.Split(b.Name, "-")
		gradYear := b.Name
		if len(parts) == 2 {
			gradYear = strings.TrimSpace(parts[1])
		}
		batchIDToYear[b.ID] = gradYear
		yearToBatchID[gradYear] = b.ID
	}

	// Determine targeted batch. Default: choose the first batch
	var targetBatch models.Batch
	cleanBatch := strings.TrimSpace(batchParam)
	if cleanBatch != "" && cleanBatch != "default" && cleanBatch != "all" && cleanBatch != "All" {
		for _, b := range dbBatches {
			if b.Name == cleanBatch || fmt.Sprintf("%d", b.ID) == cleanBatch || strings.Contains(b.Name, cleanBatch) {
				targetBatch = b
				break
			}
		}
	}
	if targetBatch.ID == 0 && len(dbBatches) > 0 {
		targetBatch = dbBatches[0]
	}

	// 2. Identify previous batches for YoY and 3-Year Max
	var chronBatches []models.Batch
	r.db.Order("name ASC").Find(&chronBatches)
	targetIdx := -1
	for idx, b := range chronBatches {
		if b.ID == targetBatch.ID {
			targetIdx = idx
			break
		}
	}

	var prevBatch *models.Batch
	var prev3Batches []*models.Batch
	if targetIdx > 0 {
		prevBatch = &chronBatches[targetIdx-1]
		start := targetIdx - 3
		if start < 0 {
			start = 0
		}
		for i := targetIdx - 1; i >= start; i-- {
			prev3Batches = append(prev3Batches, &chronBatches[i])
		}
	}

	// 3. Fetch master departments (strictly excluding Placement / PL)
	var allDepts []models.Department
	r.db.Where("LOWER(name) != 'placement' AND LOWER(COALESCE(short_code, '')) != 'pl' AND id != 4").Order("id ASC").Find(&allDepts)

	// Ensure each department has its correct ShortCode from DB
	deptIDMap := make(map[uint64]models.Department)
	deptFilterList := make([]models.DepartmentFilterItem, 0, len(allDepts))
	for i := range allDepts {
		if allDepts[i].ShortCode == "" {
			n := strings.ToLower(allDepts[i].Name)
			if strings.Contains(n, "computer") || strings.Contains(n, "cse") {
				allDepts[i].ShortCode = "CSE"
			} else if strings.Contains(n, "information") || strings.Contains(n, "it") {
				allDepts[i].ShortCode = "IT"
			} else if strings.Contains(n, "electronics") || strings.Contains(n, "ece") {
				allDepts[i].ShortCode = "ECE"
			} else if strings.Contains(n, "artificial") || strings.Contains(n, "ai") {
				allDepts[i].ShortCode = "AI & DS"
			}
		}
		deptIDMap[allDepts[i].ID] = allDepts[i]
		deptFilterList = append(deptFilterList, models.DepartmentFilterItem{
			ID:        allDepts[i].ID,
			Name:      allDepts[i].Name,
			ShortCode: allDepts[i].ShortCode,
		})
	}

	// 4. Fetch placement companies
	var dbCompanies []models.PlacementCompany
	compQuery := r.db.Table("placement_company").Where("status = '1'")

	cleanSector := strings.ToUpper(strings.TrimSpace(sectorParam))
	if cleanSector == "SOFTWARE" {
		compQuery = compQuery.Where("company_domain IN ('SOFTWARE', 'BOTH')")
	} else if cleanSector == "CORE" {
		compQuery = compQuery.Where("company_domain IN ('CORE', 'BOTH')")
	}

	if searchParam != "" {
		compQuery = compQuery.Where("company_name LIKE ?", "%"+searchParam+"%")
	}

	if err := compQuery.Order("company_name ASC").Find(&dbCompanies).Error; err != nil {
		return nil, err
	}

	// 5. Gather drives for this batch and all previous batches
	type DriveInfo struct {
		ID            uint64     `gorm:"column:id"`
		CompanyID     int64      `gorm:"column:company_id"`
		BatchIDs      string     `gorm:"column:batch_id"`
		JobRole       string     `gorm:"column:job_role"`
		PackageLPA    float64    `gorm:"column:package_lpa"`
		OverallStatus string     `gorm:"column:overall_status"`
		DriveDeptIDs  string     `gorm:"column:department_ids"`
		CreatedAt     time.Time  `gorm:"column:created_at"`
		UpdatedAt     time.Time  `gorm:"column:updated_at"`
		StartDate     *time.Time `gorm:"column:drive_start_date"`
	}

	var allDrives []DriveInfo
	r.db.Table("placement_drive pd").
		Select("pd.id, pd.company_id, pd.batch_id, pd.job_role, pd.package_lpa, pd.overall_status, pd.created_at, pd.updated_at, pd.drive_start_date, COALESCE(pde.department_ids, '') as department_ids").
		Joins("LEFT JOIN placement_drive_eligibility pde ON pd.id = pde.drive_id").
		Scan(&allDrives)

	// Query real student offers broken down by company_id, drive_id, and student batch_id
	type DriveBatchOffer struct {
		CompanyID int64  `gorm:"column:company_id"`
		DriveID   uint64 `gorm:"column:drive_id"`
		BatchID   uint64 `gorm:"column:batch_id"`
		Count     int64  `gorm:"column:count"`
	}
	var driveBatchOfferRows []DriveBatchOffer
	r.db.Table("placement_drive_offers pdo").
		Select("pd.company_id, pds.drive_id, u.batch_id, COUNT(pdo.id) as count").
		Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
		Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
		Joins("JOIN master_users u ON pds.user_id = u.id").
		Group("pd.company_id, pds.drive_id, u.batch_id").
		Scan(&driveBatchOfferRows)

	// Map: companyID -> batchID -> offers count
	compBatchOffersByBatchID := make(map[int64]map[uint64]int64)
	driveBatchOfferMap := make(map[uint64]int64)
	driveDonesWithOffers := make(map[uint64]bool)
	for _, dbo := range driveBatchOfferRows {
		if compBatchOffersByBatchID[dbo.CompanyID] == nil {
			compBatchOffersByBatchID[dbo.CompanyID] = make(map[uint64]int64)
		}
		compBatchOffersByBatchID[dbo.CompanyID][dbo.BatchID] += dbo.Count
		driveDonesWithOffers[dbo.DriveID] = true
		if dbo.BatchID == targetBatch.ID {
			driveBatchOfferMap[dbo.DriveID] += dbo.Count
		}
	}

	// Query placed students for this specific batch
	type StudentOfferDetail struct {
		CompanyID  int64   `gorm:"column:company_id"`
		DriveID    uint64  `gorm:"column:drive_id"`
		BatchID    uint64  `gorm:"column:batch_id"`
		UserID     uint64  `gorm:"column:user_id"`
		Name       string  `gorm:"column:name"`
		RollNo     string  `gorm:"column:roll_no"`
		Department string  `gorm:"column:dept"`
		PackageLPA float64 `gorm:"column:package_lpa"`
		JobRole    string  `gorm:"column:job_role"`
	}
	var allStudentOffers []StudentOfferDetail
	r.db.Table("placement_drive_offers pdo").
		Select("pd.company_id, pds.drive_id, u.batch_id, u.id as user_id, u.name, u.roll_no, COALESCE(d.short_code, d.name, '') as dept, COALESCE(NULLIF(pdo.package_lpa, 0), pd.package_lpa) as package_lpa, pd.job_role").
		Joins("JOIN placement_drive_students pds ON pdo.drive_student_id = pds.id").
		Joins("JOIN placement_drive pd ON pds.drive_id = pd.id").
		Joins("JOIN master_users u ON pds.user_id = u.id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Where("u.batch_id = ?", targetBatch.ID).
		Order("u.name ASC").
		Scan(&allStudentOffers)

	compPlacedStudents := make(map[int64][]models.CompanyPlacedStudent)
	for _, so := range allStudentOffers {
		compPlacedStudents[so.CompanyID] = append(compPlacedStudents[so.CompanyID], models.CompanyPlacedStudent{
			UserID:     so.UserID,
			Name:       so.Name,
			RollNo:     so.RollNo,
			Department: so.Department,
			PackageLPA: so.PackageLPA,
			JobRole:    so.JobRole,
		})
	}

	// Fetch placement_company_batch_placements for any historical drives/batches not in placement_drive_offers
	type BatchPlacementInfo struct {
		CompanyID      int64  `gorm:"column:company_id"`
		DriveID        uint64 `gorm:"column:drive_id"`
		Batch          string `gorm:"column:batch"`
		StudentsPlaced int64  `gorm:"column:students_placed"`
	}
	var batchPlacements []BatchPlacementInfo
	r.db.Table("placement_company_batch_placements").
		Where("status = '1'").
		Scan(&batchPlacements)

	for _, bp := range batchPlacements {
		// Avoid double counting if the drive already has offers recorded in driveBatchOfferRows
		if bp.DriveID > 0 && driveDonesWithOffers[bp.DriveID] {
			continue
		}
		var bID uint64
		for id, b := range batchIDMap {
			if b.Name == bp.Batch || batchIDToYear[id] == bp.Batch {
				bID = id
				break
			}
		}
		if bID > 0 {
			if compBatchOffersByBatchID[bp.CompanyID] == nil {
				compBatchOffersByBatchID[bp.CompanyID] = make(map[uint64]int64)
			}
			compBatchOffersByBatchID[bp.CompanyID][bID] += bp.StudentsPlaced
		}
	}

	// Check drives for target batch
	compTargetDrives := make(map[int64][]DriveInfo)
	for _, dr := range allDrives {
		hasBatch := false
		var bIDs []uint64
		if err := json.Unmarshal([]byte(dr.BatchIDs), &bIDs); err == nil {
			for _, bid := range bIDs {
				if bid == targetBatch.ID {
					hasBatch = true
					break
				}
			}
		} else {
			if dr.BatchIDs == fmt.Sprintf("%d", targetBatch.ID) ||
				strings.Contains(dr.BatchIDs, fmt.Sprintf("[%d]", targetBatch.ID)) ||
				strings.Contains(dr.BatchIDs, fmt.Sprintf("[%d,", targetBatch.ID)) ||
				strings.Contains(dr.BatchIDs, fmt.Sprintf(",%d]", targetBatch.ID)) ||
				strings.Contains(dr.BatchIDs, fmt.Sprintf(", %d]", targetBatch.ID)) ||
				strings.Contains(dr.BatchIDs, fmt.Sprintf(", %d,", targetBatch.ID)) {
				hasBatch = true
			}
		}
		if hasBatch {
			compTargetDrives[dr.CompanyID] = append(compTargetDrives[dr.CompanyID], dr)
		}
	}

	// Build items for each company
	var allItems []models.CompanyStatisticsItem
	statusCounts := models.CompanyStatisticsStatusCounts{}

	compEligibleDeptIDs := make(map[int64]map[uint64]bool)
	compEligibleShortCodes := make(map[int64]map[string]bool)

	for _, comp := range dbCompanies {
		drives := compTargetDrives[comp.ID]

		hasBatchPlacement := compBatchOffersByBatchID[comp.ID] != nil && compBatchOffersByBatchID[comp.ID][targetBatch.ID] > 0

		// Strictly include only companies that have an actual drive or recorded placements in the selected batch
		if len(drives) == 0 && !hasBatchPlacement {
			continue
		}

		compEligibleDeptIDs[comp.ID] = make(map[uint64]bool)
		compEligibleShortCodes[comp.ID] = make(map[string]bool)

		// Determine Sector
		sector := "Software"
		if comp.CompanyDomain == "CORE" {
			sector = "Core"
		} else if comp.CompanyDomain == "BOTH" {
			sector = "Software / Core"
		}

		// Determine Status & Stage
		status := "Ongoing" // default for drives not in other 3 categories
		stage := "Upcoming / Draft"

		hasCompleted := false
		hasAwaiting := false
		allCancelled := len(drives) > 0
		hasAnyDrive := len(drives) > 0

		var maxPkg float64
		totalOffers := int64(0)
		if compBatchOffersByBatchID[comp.ID] != nil {
			totalOffers = compBatchOffersByBatchID[comp.ID][targetBatch.ID]
		}

		for _, d := range drives {
			if d.PackageLPA > maxPkg {
				maxPkg = d.PackageLPA
			}

			s := strings.ToLower(strings.TrimSpace(d.OverallStatus))
			if s == "completed" {
				hasCompleted = true
				allCancelled = false
			} else if s == "awaiting_final_result" || strings.Contains(s, "awaiting") {
				hasAwaiting = true
				allCancelled = false
			} else if s == "cancelled" {
				// is cancelled
			} else {
				allCancelled = false
			}

			// Extract departments from DriveDeptIDs
			rawDeptIDs := strings.TrimSpace(d.DriveDeptIDs)
			if rawDeptIDs == "[]" {
				// Explicitly Open to All departments
				for _, ad := range allDepts {
					compEligibleDeptIDs[comp.ID][ad.ID] = true
					compEligibleShortCodes[comp.ID][ad.ShortCode] = true
				}
			} else if rawDeptIDs != "" && rawDeptIDs != "null" {
				var ids []uint64
				if err := json.Unmarshal([]byte(rawDeptIDs), &ids); err == nil {
					if len(ids) == 0 {
						// Empty array also means Open to All
						for _, ad := range allDepts {
							compEligibleDeptIDs[comp.ID][ad.ID] = true
							compEligibleShortCodes[comp.ID][ad.ShortCode] = true
						}
					} else {
						for _, id := range ids {
							if id != 4 {
								compEligibleDeptIDs[comp.ID][id] = true
								if dpt, ok := deptIDMap[id]; ok {
									compEligibleShortCodes[comp.ID][dpt.ShortCode] = true
								}
							}
						}
					}
				}
			}

			// If no eligibility configured on drive, check student participants
			if len(compEligibleDeptIDs[comp.ID]) == 0 {
				var studentDeptIDs []uint64
				r.db.Table("placement_drive_students pds").
					Joins("JOIN master_users u ON pds.user_id = u.id").
					Where("pds.drive_id = ? AND u.department_id IS NOT NULL", d.ID).
					Distinct("u.department_id").
					Pluck("u.department_id", &studentDeptIDs)
				for _, sID := range studentDeptIDs {
					if sID != 4 {
						compEligibleDeptIDs[comp.ID][sID] = true
						if dpt, ok := deptIDMap[sID]; ok {
							compEligibleShortCodes[comp.ID][dpt.ShortCode] = true
						}
					}
				}
			}
		}

		// If no drives in this batch, check across all drives of this company
		if len(compEligibleDeptIDs[comp.ID]) == 0 {
			for _, dr := range allDrives {
				if dr.CompanyID == comp.ID {
					rawDeptIDs := strings.TrimSpace(dr.DriveDeptIDs)
					if rawDeptIDs == "[]" {
						for _, ad := range allDepts {
							compEligibleDeptIDs[comp.ID][ad.ID] = true
							compEligibleShortCodes[comp.ID][ad.ShortCode] = true
						}
					} else if rawDeptIDs != "" && rawDeptIDs != "null" {
						var ids []uint64
						if err := json.Unmarshal([]byte(rawDeptIDs), &ids); err == nil {
							if len(ids) == 0 {
								for _, ad := range allDepts {
									compEligibleDeptIDs[comp.ID][ad.ID] = true
									compEligibleShortCodes[comp.ID][ad.ShortCode] = true
								}
							} else {
								for _, id := range ids {
									if id != 4 {
										compEligibleDeptIDs[comp.ID][id] = true
										if dpt, ok := deptIDMap[id]; ok {
											compEligibleShortCodes[comp.ID][dpt.ShortCode] = true
										}
									}
								}
							}
						}
					}
					if len(compEligibleDeptIDs[comp.ID]) == 0 {
						var studentDeptIDs []uint64
						r.db.Table("placement_drive_students pds").
							Joins("JOIN master_users u ON pds.user_id = u.id").
							Where("pds.drive_id = ? AND u.department_id IS NOT NULL", dr.ID).
							Distinct("u.department_id").
							Pluck("u.department_id", &studentDeptIDs)
						for _, sID := range studentDeptIDs {
							if sID != 4 {
								compEligibleDeptIDs[comp.ID][sID] = true
								if dpt, ok := deptIDMap[sID]; ok {
									compEligibleShortCodes[comp.ID][dpt.ShortCode] = true
								}
							}
						}
					}
				}
			}
		}

		// If still empty (e.g. general recruiters like TCS, Survey Sparrow), assign standard academic engineering departments
		if len(compEligibleDeptIDs[comp.ID]) == 0 {
			for _, d := range allDepts {
				compEligibleDeptIDs[comp.ID][d.ID] = true
				compEligibleShortCodes[comp.ID][d.ShortCode] = true
			}
		}

		// Build sorted list of short codes for this company
		var shortCodeList []string
		for sc := range compEligibleShortCodes[comp.ID] {
			if sc != "" && sc != "PL" {
				shortCodeList = append(shortCodeList, sc)
			}
		}
		sort.Strings(shortCodeList)

		if hasCompleted || totalOffers > 0 {
			status = "Completed"
			stage = "Offers Released"
		} else if allCancelled && hasAnyDrive {
			status = "Cancelled"
			stage = "Drive Cancelled"
		} else if hasAwaiting {
			status = "Awaiting Final Result"
			stage = "Final Result Awaited"
		} else {
			status = "Ongoing"
			if hasAnyDrive {
				latestStatus := drives[0].OverallStatus
				if latestStatus == "in_progress" {
					stage = "Technical Round In Progress"
				} else if latestStatus == "registration_open" {
					stage = "Registration Open"
				} else if latestStatus == "scheduled" {
					stage = "Drive Scheduled"
				} else {
					stage = "Technical Round Underway"
				}
			} else {
				stage = "Active Recruitment Underway"
			}
		}

		// Last Year Offers (from immediate preceding batch)
		var lastYearOffers int64
		if prevBatch != nil && compBatchOffersByBatchID[comp.ID] != nil {
			lastYearOffers = compBatchOffersByBatchID[comp.ID][prevBatch.ID]
		}

		// YoY
		yoy := totalOffers - lastYearOffers

		// 3-Year Max
		var max3 int64
		for _, pb := range prev3Batches {
			if compBatchOffersByBatchID[comp.ID] != nil {
				if off := compBatchOffersByBatchID[comp.ID][pb.ID]; off > max3 {
					max3 = off
				}
			}
		}

		// Aggregate Status Counts
		switch status {
		case "Completed":
			statusCounts.Completed++
		case "Cancelled":
			statusCounts.Cancelled++
		case "Awaiting Final Result":
			statusCounts.AwaitingFinalResult++
		default:
			statusCounts.Ongoing++
		}
		statusCounts.Total++

		// Build drive details for this batch
		var driveList []models.CompanyDriveDetail
		for _, d := range drives {
			dateStr := d.CreatedAt.Format("02 Jan 2006, 03:04 PM")
			if d.StartDate != nil && !d.StartDate.IsZero() {
				dateStr = d.StartDate.Format("02 Jan 2006")
			}
			driveList = append(driveList, models.CompanyDriveDetail{
				DriveID:       d.ID,
				JobRole:       d.JobRole,
				PackageLPA:    d.PackageLPA,
				OverallStatus: d.OverallStatus,
				OffersCount:   driveBatchOfferMap[d.ID],
				CreatedAt:     d.CreatedAt.Format(time.RFC3339),
				UpdatedAt:     d.UpdatedAt.Format(time.RFC3339),
				DateFormatted: dateStr,
			})
		}

		allItems = append(allItems, models.CompanyStatisticsItem{
			CompanyID:      comp.ID,
			Company:        comp.CompanyName,
			Sector:         sector,
			Departments:    shortCodeList,
			Status:         status,
			Stage:          stage,
			Offers:         totalOffers,
			LastYear:       lastYearOffers,
			YoY:            yoy,
			Max3:           max3,
			Package:        maxPkg,
			Drives:         driveList,
			PlacedStudents: compPlacedStudents[comp.ID],
		})
	}

	// 6. Filter by department if specified
	cleanDept := strings.ToLower(strings.TrimSpace(deptParam))
	if cleanDept != "" && cleanDept != "all" && cleanDept != "all departments" {
		var targetDeptID uint64
		var targetShortCode string
		for _, d := range allDepts {
			if strings.EqualFold(d.Name, cleanDept) ||
				strings.EqualFold(d.ShortCode, cleanDept) ||
				fmt.Sprintf("%d", d.ID) == cleanDept {
				targetDeptID = d.ID
				targetShortCode = strings.ToUpper(strings.TrimSpace(d.ShortCode))
				break
			}
		}

		var filteredByDept []models.CompanyStatisticsItem
		for _, item := range allItems {
			matches := false
			if targetDeptID > 0 && compEligibleDeptIDs[item.CompanyID][targetDeptID] {
				matches = true
			} else if targetShortCode != "" && compEligibleShortCodes[item.CompanyID][targetShortCode] {
				matches = true
			} else {
				for _, sc := range item.Departments {
					if strings.EqualFold(sc, cleanDept) || (targetShortCode != "" && strings.EqualFold(sc, targetShortCode)) {
						matches = true
						break
					}
				}
			}

			if matches {
				filteredByDept = append(filteredByDept, item)
			}
		}
		allItems = filteredByDept
	}

	// 7. Filter by Status (from left panel or status filter)
	cleanStatus := strings.TrimSpace(statusParam)
	if cleanStatus != "" && cleanStatus != "all" && cleanStatus != "All" {
		var filteredByStatus []models.CompanyStatisticsItem
		for _, item := range allItems {
			if strings.EqualFold(item.Status, cleanStatus) {
				filteredByStatus = append(filteredByStatus, item)
			}
		}
		allItems = filteredByStatus
	}

	// 8. Sorting
	cleanSort := strings.ToLower(strings.TrimSpace(sortParam))
	switch cleanSort {
	case "package", "package_desc", "package · high → low":
		sort.SliceStable(allItems, func(i, j int) bool {
			return allItems[i].Package > allItems[j].Package
		})
	case "growth", "growth_desc", "growth · high → low":
		sort.SliceStable(allItems, func(i, j int) bool {
			return allItems[i].YoY > allItems[j].YoY
		})
	case "decline", "decline_desc", "decline · highest":
		sort.SliceStable(allItems, func(i, j int) bool {
			return allItems[i].YoY < allItems[j].YoY
		})
	case "name", "name_asc", "company · a → z":
		sort.SliceStable(allItems, func(i, j int) bool {
			return strings.ToLower(allItems[i].Company) < strings.ToLower(allItems[j].Company)
		})
	default: // offers · high → low (default)
		sort.SliceStable(allItems, func(i, j int) bool {
			if allItems[i].Offers != allItems[j].Offers {
				return allItems[i].Offers > allItems[j].Offers
			}
			return allItems[i].Package > allItems[j].Package
		})
	}

	return &models.CompanyStatisticsResponse{
		SelectedBatch: targetBatch.Name,
		Batches:       batchNames,
		Departments:   deptFilterList,
		Sectors:       []string{"All Sectors", "Software", "Core"},
		StatusCounts:  statusCounts,
		TotalCount:    len(allItems),
		Companies:     allItems,
	}, nil
}



