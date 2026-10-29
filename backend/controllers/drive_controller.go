package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"placement-management/config"
	"placement-management/models"
)

// GetDrives handles fetching drives with their company details
func GetDrives(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"message": "Database not connected. Please verify MySQL connection in .env",
			"data":    []models.PlacementDrive{},
		})
		return
	}

	var drives []models.PlacementDrive
	statusFilter := c.Query("status")

	query := config.DB.Preload("Company")
	if statusFilter != "" && statusFilter != "All" {
		query = query.Where("overall_status = ?", statusFilter)
	}

	if err := query.Find(&drives).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": drives})
}

// GetDriveByID fetches detailed drive information including stages and substages
func GetDriveByID(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database not connected"})
		return
	}

	id := c.Param("id")
	var drive models.PlacementDrive

	if err := config.DB.Preload("Company").
		Preload("Stages.Substages").
		First(&drive, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Drive not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": drive})
}

// UpdateDriveStatus updates the overall status of a placement drive
func UpdateDriveStatus(c *gin.Context) {
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

	if err := config.DB.Model(&models.PlacementDrive{}).
		Where("id = ?", id).
		Update("overall_status", req.OverallStatus).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully"})
}

// GetDriveActivities returns recent activity log entries for a drive
func GetDriveActivities(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{"data": []models.PlacementDriveActivityLog{}})
		return
	}

	driveID := c.Param("id")
	var logs []models.PlacementDriveActivityLog

	if err := config.DB.Preload("User").
		Where("drive_id = ?", driveID).
		Order("created_at desc").
		Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}
