package controllers

import (
	"net/http"
	"placement-management/repositories"
	"github.com/gin-gonic/gin"
)

type PlacementIntelligenceController struct {
	repo *repositories.PlacementIntelligenceRepository
}

func NewPlacementIntelligenceController() *PlacementIntelligenceController {
	return &PlacementIntelligenceController{
		repo: repositories.NewPlacementIntelligenceRepository(),
	}
}

// GetBatchSummaries returns real batch statistics from database
func (ctrl *PlacementIntelligenceController) GetBatchSummaries(c *gin.Context) {
	summaries, err := ctrl.repo.GetBatchSummaries()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch batch summaries: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": summaries})
}

// GetOutcomeGroupSummary returns outcome metrics aggregated from database
func (ctrl *PlacementIntelligenceController) GetOutcomeGroupSummary(c *gin.Context) {
	batchID := c.Query("batch")
	summary, err := ctrl.repo.GetOutcomeGroupSummary(batchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch outcome summary: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": summary})
}

// GetOverallPlacementMatrix returns salary scale offer breakdown and unique student outcomes from DB
func (ctrl *PlacementIntelligenceController) GetOverallPlacementMatrix(c *gin.Context) {
	batch := c.Query("batch")
	department := c.Query("department")
	matrix, err := ctrl.repo.GetOverallPlacementMatrix(batch, department)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch overall placement matrix: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": matrix})
}

// ExportOverallPlacementMatrixExcel generates a styled Excel spreadsheet with both placement intelligence tables
func (ctrl *PlacementIntelligenceController) ExportOverallPlacementMatrixExcel(c *gin.Context) {
	batch := c.Query("batch")
	department := c.Query("department")

	excelBytes, err := ctrl.repo.ExportOverallPlacementMatrixExcel(batch, department)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate Excel document: " + err.Error()})
		return
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=Overall_Placement_Statistics.xlsx")
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excelBytes)
}

// GetOutcomeGroupStudents returns the list of students for the selected outcome group, batch, and department
func (ctrl *PlacementIntelligenceController) GetOutcomeGroupStudents(c *gin.Context) {
	outcome := c.Query("outcome")
	batch := c.Query("batch")
	department := c.Query("department")
	typeParam := c.Query("type")

	students, err := ctrl.repo.GetOutcomeGroupStudents(outcome, batch, department, typeParam)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch outcome students: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": students})
}

// GetIndustryMatrix returns recruiter network health matrix computed from database
func (ctrl *PlacementIntelligenceController) GetIndustryMatrix(c *gin.Context) {
	sector := c.Query("sector")
	if sector == "" {
		sector = c.Query("domain")
	}
	dept := c.Query("department")
	matrix, err := ctrl.repo.GetIndustryMatrix(sector, dept)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch industry matrix: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": matrix})
}

// GetIndustryRightPanel returns the 6 metric cards, attention recruiters, top recruiters and recent activities
func (ctrl *PlacementIntelligenceController) GetIndustryRightPanel(c *gin.Context) {
	batch := c.Query("batch")
	sector := c.Query("sector")
	if sector == "" {
		sector = c.Query("domain")
	}
	dept := c.Query("department")
	data, err := ctrl.repo.GetIndustryRightPanelData(batch, sector, dept)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch industry right panel: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GetIndustryCompanies returns the list of companies for a specific metric cell or KPI card
func (ctrl *PlacementIntelligenceController) GetIndustryCompanies(c *gin.Context) {
	metric := c.Query("metric")
	batch := c.Query("batch")
	sector := c.Query("sector")
	if sector == "" {
		sector = c.Query("domain")
	}
	dept := c.Query("department")

	data, err := ctrl.repo.GetIndustryMetricCompanies(metric, batch, sector, dept)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch industry companies: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GetCompanyRecruitmentDrives returns all recruitment phases/drives grouped by placement year for a selected company
func (ctrl *PlacementIntelligenceController) GetCompanyRecruitmentDrives(c *gin.Context) {
	companyID := c.Query("company_id")
	companyName := c.Query("company_name")
	batch := c.Query("batch")
	role := c.Query("role")
	department := c.Query("department")

	data, err := ctrl.repo.GetCompanyRecruitmentDrives(companyID, companyName, batch, role, department)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch company recruitment drives: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GetCompanyStatistics returns real company placement rankings, status counts, and filter options
func (ctrl *PlacementIntelligenceController) GetCompanyStatistics(c *gin.Context) {
	batch := c.Query("batch")
	sector := c.Query("sector")
	department := c.Query("department")
	status := c.Query("status")
	sort := c.Query("sort")
	search := c.Query("search")

	data, err := ctrl.repo.GetCompanyStatistics(batch, sector, department, status, sort, search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch company statistics: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}


