package repositories

import (
	"strings"
	"placement-management/config"
	"placement-management/models"
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

		// Not Eligible count (e.g. current arrears > 0 or history arrears > 0 or nip = 1)
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id = ? AND (COALESCE(s.current_arrear_count, 0) > 0 OR COALESCE(s.nip, '0') = '1')", b.ID).
			Count(&summary.NotEligibleCount)

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

	// Entrepreneurship (Startup or Business)
	r.db.Table("master_users u").
		Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
		Where(batchCondition, args...).
		Where("(COALESCE(s.startup, '0') = '1' OR COALESCE(s.business, '0') = '1')").
		Count(&summary.EntrepreneurCount)

	// Not Eligible (Current arrears > 0 or nip = 1)
	r.db.Table("master_users u").
		Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
		Where(batchCondition, args...).
		Where("(COALESCE(s.current_arrear_count, 0) > 0 OR COALESCE(s.nip, '0') = '1')").
		Count(&summary.NotEligibleCount)

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
		// Clean batchParam for matching e.g. "2026-27" -> "2027", "2022-2026"
		cleanBatch := batchParam
		bQuery = bQuery.Where("id = ? OR name = ? OR name LIKE ?", batchParam, cleanBatch, "%"+cleanBatch+"%")
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

		// Entrepreneurship (Startup or Business)
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id = ? AND (COALESCE(s.startup, '0') = '1' OR COALESCE(s.business, '0') = '1')"+deptCond, baseArgs...).
			Count(&uniqueRow.Entrepreneurship)

		// Not Eligible (Current arrears > 0 or nip = '1')
		r.db.Table("master_users u").
			Joins("JOIN placement_student_basic_details s ON u.id = s.user_id").
			Where("u.role_id = 1 AND u.batch_id = ? AND (COALESCE(s.current_arrear_count, 0) > 0 OR COALESCE(s.nip, '0') = '1')"+deptCond, baseArgs...).
			Count(&uniqueRow.NotEligible)

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

