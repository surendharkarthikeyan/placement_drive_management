package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"placement-management/config"
	"placement-management/repositories"
	"placement-management/services"
)

type DriveController struct {
	service *services.DriveService
}

func NewDriveController() *DriveController {
	repo := repositories.NewDriveRepository(config.DB)
	service := services.NewDriveService(repo)
	return &DriveController{service: service}
}

// GetDrives handles fetching drives with company preload and status grouping
func (ctrl *DriveController) GetDrives(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		return
	}

	statusFilter := c.Query("status")
	searchQuery := strings.TrimSpace(c.Query("search"))
	batchName := strings.TrimSpace(c.Query("batch"))

	drives, err := ctrl.service.GetDrives(statusFilter, searchQuery, batchName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": drives})
}

// GetDriveByID retrieves a drive by its ID with calculated statistics
func (ctrl *DriveController) GetDriveByID(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	id := c.Param("id")
	drive, err := ctrl.service.GetDriveByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Drive not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": drive})
}

// CreateDrive creates a new placement drive
func (ctrl *DriveController) CreateDrive(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	var req struct {
		CompanyName      string   `json:"company_name" binding:"required"`
		JobRole          string   `json:"job_role" binding:"required"`
		PlacementType    string   `json:"placement_type"`
		PackageLPA       float64  `json:"package_lpa"`
		DriveStartDate   string   `json:"drive_start_date"`
		DriveEndDate     string   `json:"drive_end_date"`
		DriveOwnerUserID *uint64  `json:"drive_owner_user_id"`
		JobDescription   string   `json:"job_description"`
		BatchIDs         []uint64 `json:"batch_ids"`
		BatchID          *uint64  `json:"batch_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batchIDs := req.BatchIDs
	if len(batchIDs) == 0 && req.BatchID != nil {
		batchIDs = []uint64{*req.BatchID}
	}

	drive, err := ctrl.service.CreateDrive(
		req.CompanyName,
		req.JobRole,
		req.PlacementType,
		req.PackageLPA,
		req.DriveStartDate,
		req.DriveEndDate,
		req.DriveOwnerUserID,
		req.JobDescription,
		batchIDs,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Placement drive created successfully",
		"data":    drive,
	})
}

// UpdateDriveDetails updates drive fields (JobRole, PlacementType, Package, Dates, Owner, JD)
func (ctrl *DriveController) UpdateDriveDetails(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	id := c.Param("id")
	var req struct {
		JobRole          string   `json:"job_role"`
		PlacementType    string   `json:"placement_type"`
		PackageLPA       float64  `json:"package_lpa"`
		DriveStartDate   string   `json:"drive_start_date"`
		DriveEndDate     string   `json:"drive_end_date"`
		DriveOwnerUserID *uint64  `json:"drive_owner_user_id"`
		JobDescription   string   `json:"job_description"`
		BatchIDs         []uint64 `json:"batch_ids"`
		BatchID          *uint64  `json:"batch_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batchIDs := req.BatchIDs
	if len(batchIDs) == 0 && req.BatchID != nil {
		batchIDs = []uint64{*req.BatchID}
	}

	drive, err := ctrl.service.UpdateDriveDetails(
		id,
		req.JobRole,
		req.PlacementType,
		req.PackageLPA,
		req.DriveStartDate,
		req.DriveEndDate,
		req.DriveOwnerUserID,
		req.JobDescription,
		batchIDs,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Drive updated successfully",
		"data":    drive,
	})
}

// UpdateDriveStatus updates the overall status of a placement drive
func (ctrl *DriveController) UpdateDriveStatus(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	id := c.Param("id")
	var req struct {
		OverallStatus string `json:"overall_status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ctrl.service.UpdateDriveStatus(id, req.OverallStatus); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully"})
}

// GetDriveActivities returns recent activity log entries for a drive
func (ctrl *DriveController) GetDriveActivities(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		return
	}

	id := c.Param("id")
	logs, err := ctrl.service.GetDriveActivities(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// UpdateDriveEligibility updates or creates eligibility criteria
func (ctrl *DriveController) UpdateDriveEligibility(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	driveID := c.Param("id")
	driveIDUint, err := strconv.ParseUint(driveID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid drive id"})
		return
	}

	var req struct {
		MinCGPA             *float64 `json:"min_cgpa"`
		MinTenthMark        *float64 `json:"min_tenth_mark"`
		MinTwelfthMark      *float64 `json:"min_twelfth_mark"`
		MaxCurrentArrears   *int     `json:"max_current_arrears"`
		MaxHistoryArrears   *int     `json:"max_history_arrears"`
		MaxExistingOfferLPA *float64 `json:"max_existing_offer_lpa"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	eligibility, err := ctrl.service.UpdateDriveEligibility(
		driveIDUint,
		req.MinCGPA,
		req.MinTenthMark,
		req.MinTwelfthMark,
		req.MaxCurrentArrears,
		req.MaxHistoryArrears,
		req.MaxExistingOfferLPA,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Eligibility criteria updated successfully",
		"data":    eligibility,
	})
}
