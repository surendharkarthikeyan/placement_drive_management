package controllers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"placement-management/config"
	"placement-management/repositories"
	"placement-management/models"
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

// GetDataCompletion returns the dynamic 6-checkpoint data completion for a drive
func (ctrl *DriveController) GetDataCompletion(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	id := c.Param("id")
	driveIDUint, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid drive id"})
		return
	}

	dc := ctrl.service.GetDataCompletion(driveIDUint)
	c.JSON(http.StatusOK, gin.H{"data": dc})
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

// GetDriveEligibleStudents handles fetching student list evaluated against drive eligibility
func (ctrl *DriveController) GetDriveEligibleStudents(c *gin.Context) {
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

	students, err := ctrl.service.GetDriveEligibleStudents(driveIDUint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  students,
		"total": len(students),
	})
}

// UpdateDriveStudentsRoster updates students inclusion, special_entry, and exclusion
func (ctrl *DriveController) UpdateDriveStudentsRoster(c *gin.Context) {
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
		Updates []repositories.StudentRosterUpdateItem `json:"updates"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ctrl.service.UpdateDriveStudentsRoster(driveIDUint, req.Updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return updated list
	updatedList, _ := ctrl.service.GetDriveEligibleStudents(driveIDUint)
	c.JSON(http.StatusOK, gin.H{
		"message": "Student roster updated successfully",
		"data":    updatedList,
	})
}

// GetDriveStages returns stages for a drive
func (ctrl *DriveController) GetDriveStages(c *gin.Context) {
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

	stages, err := ctrl.service.GetDriveStages(driveIDUint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": stages})
}

func sanitizeStatus(status string) string {
	s := strings.TrimSpace(strings.ToLower(status))
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "-", "_")
	switch s {
	case "pending_date_not_announced", "scheduled", "in_progress", "awaiting_result", "completed":
		return s
	case "pending":
		return "pending"
	default:
		if s == "" {
			return "pending"
		}
		return s
	}
}

// CreateStage adds a new recruitment stage (single or with substages)
func (ctrl *DriveController) CreateStage(c *gin.Context) {
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
		StageName     string                           `json:"stage_name" binding:"required"`
		ScheduledDate string                           `json:"scheduled_date"`
		InitialStatus string                           `json:"initial_status"`
		StageStatus   string                           `json:"stage_status"`
		InternalNotes string                           `json:"internal_notes"`
		Substages     []repositories.SubstageCreateInput `json:"substages"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var schedDate *time.Time
	if req.ScheduledDate != "" {
		parsed, err := time.Parse("2006-01-02", req.ScheduledDate)
		if err == nil {
			schedDate = &parsed
		}
	}

	status := req.InitialStatus
	if status == "" {
		status = req.StageStatus
	}
	status = sanitizeStatus(status)

	var sanitizedSubstages []repositories.SubstageCreateInput
	for _, sub := range req.Substages {
		sub.Status = sanitizeStatus(sub.Status)
		sanitizedSubstages = append(sanitizedSubstages, sub)
	}

	input := repositories.StageCreateInput{
		StageName:     req.StageName,
		ScheduledDate: schedDate,
		InitialStatus: status,
		InternalNotes: req.InternalNotes,
		Substages:     sanitizedSubstages,
	}

	stage, err := ctrl.service.CreateStage(driveIDUint, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Recruitment stage created successfully",
		"data":    stage,
	})
}

// UpdateStage updates stage details
func (ctrl *DriveController) UpdateStage(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	stageID := c.Param("stage_id")
	stageIDUint, err := strconv.ParseUint(stageID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stage id"})
		return
	}

	var req struct {
		StageName     string                           `json:"stage_name" binding:"required"`
		ScheduledDate string                           `json:"scheduled_date"`
		StageStatus   string                           `json:"stage_status"`
		InitialStatus string                           `json:"initial_status"`
		InternalNotes string                           `json:"internal_notes"`
		Substages     []repositories.SubstageCreateInput `json:"substages"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var schedDate *time.Time
	if req.ScheduledDate != "" {
		parsed, err := time.Parse("2006-01-02", req.ScheduledDate)
		if err == nil {
			schedDate = &parsed
		}
	}

	status := req.StageStatus
	if status == "" {
		status = req.InitialStatus
	}
	status = sanitizeStatus(status)

	var sanitizedSubstages []repositories.SubstageCreateInput
	for _, sub := range req.Substages {
		sub.Status = sanitizeStatus(sub.Status)
		sanitizedSubstages = append(sanitizedSubstages, sub)
	}

	input := repositories.StageUpdateInput{
		StageName:     req.StageName,
		ScheduledDate: schedDate,
		StageStatus:   status,
		InternalNotes: req.InternalNotes,
		Substages:     sanitizedSubstages,
	}

	stage, err := ctrl.service.UpdateStage(stageIDUint, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Stage updated successfully",
		"data":    stage,
	})
}

// CreateSubstage adds a substage to an existing stage
func (ctrl *DriveController) CreateSubstage(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	stageID := c.Param("stage_id")
	stageIDUint, err := strconv.ParseUint(stageID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stage id"})
		return
	}

	var req struct {
		SubstageName  string `json:"substage_name" binding:"required"`
		ScheduledDate string `json:"scheduled_date"`
		Status        string `json:"status"`
		InternalNotes string `json:"internal_notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var schedDate *time.Time
	if req.ScheduledDate != "" {
		parsed, err := time.Parse("2006-01-02", req.ScheduledDate)
		if err == nil {
			schedDate = &parsed
		}
	}

	input := repositories.SubstageCreateInput{
		SubstageName:  req.SubstageName,
		ScheduledDate: schedDate,
		Status:        req.Status,
		InternalNotes: req.InternalNotes,
	}

	substage, err := ctrl.service.CreateSubstage(stageIDUint, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Substage created successfully",
		"data":    substage,
	})
}

// GetStageResults fetches results for a stage/substage
func (ctrl *DriveController) GetStageResults(c *gin.Context) {
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

	stageID := c.Param("stage_id")
	stageIDUint, err := strconv.ParseUint(stageID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stage id"})
		return
	}

	var substageIDPtr *uint64
	substageIDStr := c.Query("substage_id")
	if substageIDStr != "" {
		if subID, err := strconv.ParseUint(substageIDStr, 10, 64); err == nil {
			substageIDPtr = &subID
		}
	}

	results, err := ctrl.service.GetStageResults(driveIDUint, stageIDUint, substageIDPtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  results,
		"total": len(results),
	})
}

// UpdateStageResults updates individual or bulk student outcomes, scores, and remarks
func (ctrl *DriveController) UpdateStageResults(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	var req struct {
		OfficerUserID *uint64                                  `json:"officer_user_id"`
		Updates       []repositories.StudentOutcomeUpdateItem `json:"updates"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ctrl.service.UpdateStageResults(req.OfficerUserID, req.Updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Results updated successfully",
	})
}

// AddSpecialEntryToStage handles adding students midway into a stage/substage
func (ctrl *DriveController) AddSpecialEntryToStage(c *gin.Context) {
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

	stageID := c.Param("stage_id")
	stageIDUint, err := strconv.ParseUint(stageID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stage id"})
		return
	}

	var req struct {
		SubstageID    *uint64  `json:"substage_id"`
		UserIDs       []uint64 `json:"user_ids" binding:"required"`
		OfficerUserID *uint64  `json:"officer_user_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ctrl.service.AddSpecialEntryToStage(driveIDUint, stageIDUint, req.SubstageID, req.UserIDs, req.OfficerUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Special entry students added to stage successfully",
	})
}

// CompleteStage completes a recruitment stage and progresses cleared candidates
func (ctrl *DriveController) CompleteStage(c *gin.Context) {
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

	stageID := c.Param("stage_id")
	stageIDUint, err := strconv.ParseUint(stageID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stage id"})
		return
	}

	var req struct {
		OfficerUserID *uint64 `json:"officer_user_id"`
	}
	c.ShouldBindJSON(&req)

	if err := ctrl.service.CompleteStage(driveIDUint, stageIDUint, req.OfficerUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Stage completed and eligible cleared students progressed successfully",
	})
}

// UpdateSubstageStatus updates the status of an individual substage directly
func (ctrl *DriveController) UpdateSubstageStatus(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	stageID := c.Param("stage_id")
	stageIDUint, err := strconv.ParseUint(stageID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stage id"})
		return
	}

	substageID := c.Param("substage_id")
	substageIDUint, err := strconv.ParseUint(substageID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid substage id"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sanitized := sanitizeStatus(req.Status)
	if err := ctrl.service.UpdateSubstageStatus(stageIDUint, substageIDUint, sanitized); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Substage status updated successfully",
		"status":  sanitized,
	})
}

// CompleteSubstage completes a recruitment substage and progresses cleared candidates to the next substage
func (ctrl *DriveController) CompleteSubstage(c *gin.Context) {
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

	stageID := c.Param("stage_id")
	stageIDUint, err := strconv.ParseUint(stageID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stage id"})
		return
	}

	substageID := c.Param("substage_id")
	substageIDUint, err := strconv.ParseUint(substageID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid substage id"})
		return
	}

	var req struct {
		OfficerUserID *uint64 `json:"officer_user_id"`
	}
	c.ShouldBindJSON(&req)

	if err := ctrl.service.CompleteSubstage(driveIDUint, stageIDUint, substageIDUint, req.OfficerUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Substage completed and cleared students progressed to the next substage successfully",
	})
}




// CompleteRecruitmentProcess marks all recruitment stages completed and transitions drive to awaiting final result
func (ctrl *DriveController) CompleteRecruitmentProcess(c *gin.Context) {
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
		OfficerUserID *uint64 `json:"officer_user_id"`
	}
	c.ShouldBindJSON(&req)

	if err := ctrl.service.CompleteRecruitmentProcess(driveIDUint, req.OfficerUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Recruitment process completed successfully. Students moved to Final Selection.",
	})
}

// GetFinalSelection returns candidates who reached the final recruitment stage and drive final info
func (ctrl *DriveController) GetFinalSelection(c *gin.Context) {
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

	data, err := ctrl.service.GetFinalSelectionData(driveIDUint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": data,
	})
}

// SaveFinalSelection updates final result publication information and candidate offers
func (ctrl *DriveController) SaveFinalSelection(c *gin.Context) {
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
		ResultPublicationDate *string `json:"result_publication_date"`
		ResultReference       string  `json:"result_reference"`
		ResultNotes           string  `json:"result_notes"`
		MarkCompleted         bool    `json:"mark_completed"`
		OfficerUserID         *uint64 `json:"officer_user_id"`
		Offers                []struct {
			DriveStudentID  uint64   `json:"drive_student_id"`
			FinalRole       *string  `json:"final_role"`
			PackageLPA      *float64 `json:"package_lpa"`
			OfferLetterFile *string  `json:"offer_letter_file"`
		} `json:"offers"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var pubDate *time.Time
	if req.ResultPublicationDate != nil && *req.ResultPublicationDate != "" {
		t, err := time.Parse("2006-01-02", *req.ResultPublicationDate)
		if err == nil {
			pubDate = &t
		}
	}

	offers := make([]models.PlacementDriveOffer, 0, len(req.Offers))
	for _, o := range req.Offers {
		offers = append(offers, models.PlacementDriveOffer{
			DriveStudentID:  o.DriveStudentID,
			FinalRole:       o.FinalRole,
			PackageLPA:      o.PackageLPA,
			OfferLetterFile: o.OfferLetterFile,
		})
	}

	if err := ctrl.service.SaveFinalSelections(
		driveIDUint,
		pubDate,
		req.ResultReference,
		req.ResultNotes,
		offers,
		req.MarkCompleted,
		req.OfficerUserID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Final selection saved successfully",
	})
}


// UploadReferenceDocument saves official reference document to C:\BIT\placement\placement_drive_management\document_db\final_result_info
func (ctrl *DriveController) UploadReferenceDocument(c *gin.Context) {
	driveID := c.Param("id")
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded: " + err.Error()})
		return
	}
	defer file.Close()

	destDir := `C:\BIT\placement\placement_drive_management\document_db\final_result_info`
	if err := os.MkdirAll(destDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create directory: " + err.Error()})
		return
	}

	ext := filepath.Ext(header.Filename)
	baseName := strings.TrimSuffix(filepath.Base(header.Filename), ext)
	filename := fmt.Sprintf("drive_%s_%s%s", driveID, baseName, ext)
	targetPath := filepath.Join(destDir, filename)

	out, err := os.Create(targetPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file: " + err.Error()})
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file: " + err.Error()})
		return
	}

	// Update result_reference in placement_drive
	driveIDUint, _ := strconv.ParseUint(driveID, 10, 64)
	if config.DB != nil && driveIDUint > 0 {
		config.DB.Model(&models.PlacementDrive{}).Where("id = ?", driveIDUint).Update("result_reference", filename)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Reference document uploaded successfully",
		"file_name": filename,
		"path":      targetPath,
	})
}

// UploadOfferLetter saves student offer letter to C:\BIT\placement\placement_drive_management\document_db\student_offer_letters
// using filename pattern: rollno_company_code.ext
func (ctrl *DriveController) UploadOfferLetter(c *gin.Context) {
	driveID := c.Param("id")
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded: " + err.Error()})
		return
	}
	defer file.Close()

	rollNo := strings.TrimSpace(c.PostForm("roll_no"))
	companyCode := strings.TrimSpace(c.PostForm("company_code"))
	driveStudentIDStr := strings.TrimSpace(c.PostForm("drive_student_id"))
	driveStudentID, _ := strconv.ParseUint(driveStudentIDStr, 10, 64)

	// Fallback lookup if not provided
	if (rollNo == "" || companyCode == "") && config.DB != nil && driveStudentID > 0 {
		var pds models.PlacementDriveStudent
		if err := config.DB.Preload("User").First(&pds, driveStudentID).Error; err == nil {
			if pds.User != nil && pds.User.RollNo != nil {
				rollNo = *pds.User.RollNo
			}
		}
		var drive models.PlacementDrive
		driveIDUint, _ := strconv.ParseUint(driveID, 10, 64)
		if err := config.DB.Preload("Company").First(&drive, driveIDUint).Error; err == nil {
			if drive.Company != nil {
				companyCode = drive.Company.CompanyCode
			}
		}
	}

	if rollNo == "" {
		rollNo = fmt.Sprintf("student_%d", driveStudentID)
	}
	if companyCode == "" {
		companyCode = fmt.Sprintf("drive_%s", driveID)
	}

	// Sanitize filenames
	cleanRollNo := strings.ReplaceAll(rollNo, "/", "_")
	cleanCompanyCode := strings.ReplaceAll(companyCode, "/", "_")
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".pdf"
	}

	filename := fmt.Sprintf("%s_%s%s", cleanRollNo, cleanCompanyCode, ext)
	destDir := `C:\BIT\placement\placement_drive_management\document_db\student_offer_letters`
	if err := os.MkdirAll(destDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create directory: " + err.Error()})
		return
	}

	targetPath := filepath.Join(destDir, filename)
	out, err := os.Create(targetPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file: " + err.Error()})
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file: " + err.Error()})
		return
	}

	// Update placement_drive_offers: store the full path of the document in result_reference
	if config.DB != nil && driveStudentID > 0 {
		var existing models.PlacementDriveOffer
		now := time.Now()
		if err := config.DB.Where("drive_student_id = ?", driveStudentID).First(&existing).Error; err == nil {
			config.DB.Model(&existing).Updates(map[string]interface{}{
				"result_reference":  targetPath,
				"offer_letter_file": targetPath,
			})
		} else {
			newOffer := models.PlacementDriveOffer{
				DriveStudentID:  driveStudentID,
				ResultReference: &targetPath,
				OfferLetterFile: &targetPath,
				CreatedAt:       now,
			}
			_ = config.DB.Create(&newOffer).Error
		}

		driveIDUint, _ := strconv.ParseUint(driveID, 10, 64)
		actLog := models.PlacementDriveActivityLog{
			DriveID:             driveIDUint,
			ActivityType:        "OFFER_LETTER_UPLOADED",
			EntityType:          "STUDENT",
			EntityID:            fmt.Sprintf("%d", driveStudentID),
			ActivityDescription: fmt.Sprintf("Uploaded offer letter for %s", rollNo),
			CreatedAt:           now,
		}
		_ = ctrl.service.LogActivityWithSuppression(&actLog)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Offer letter uploaded successfully",
		"file_name": filename,
		"path":      targetPath,
	})
}

// DownloadOfferLetter handles downloading a student's uploaded offer letter document
func (ctrl *DriveController) DownloadOfferLetter(c *gin.Context) {
	driveID := c.Param("id")
	studentIDStr := c.Param("student_id")
	studentID, err := strconv.ParseUint(studentIDStr, 10, 64)
	if err != nil || studentID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student id"})
		return
	}

	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	var offer models.PlacementDriveOffer
	if err := config.DB.Where("drive_student_id = ?", studentID).First(&offer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No offer found for this student"})
		return
	}

	filePath := ""
	if offer.ResultReference != nil && *offer.ResultReference != "" {
		filePath = *offer.ResultReference
	} else if offer.OfferLetterFile != nil && *offer.OfferLetterFile != "" {
		filePath = *offer.OfferLetterFile
	}

	if filePath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "No offer letter file associated with this student"})
		return
	}

	// If only filename is stored without full directory path, prepend directory
	if !filepath.IsAbs(filePath) {
		filePath = filepath.Join(`C:\BIT\placement\placement_drive_management\document_db\student_offer_letters`, filePath)
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Offer letter document not found on server disk"})
		return
	}

	downloadName := filepath.Base(filePath)
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", downloadName))
	c.Header("Content-Type", "application/octet-stream")
	c.File(filePath)
	_ = driveID
}
