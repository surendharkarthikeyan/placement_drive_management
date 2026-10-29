package routes

import (
	"github.com/gin-gonic/gin"
	"placement-management/controllers"
)

func SetupRoutes(r *gin.Engine) {
	driveCtrl := controllers.NewDriveController()
	masterCtrl := controllers.NewMasterController()

	api := r.Group("/api")
	{
		// Placement Drives
		drives := api.Group("/drives")
		{
			drives.GET("", driveCtrl.GetDrives)
			drives.POST("", driveCtrl.CreateDrive)
			drives.GET("/:id", driveCtrl.GetDriveByID)
			drives.PUT("/:id", driveCtrl.UpdateDriveDetails)
			drives.PUT("/:id/eligibility", driveCtrl.UpdateDriveEligibility)
			drives.GET("/:id/students", driveCtrl.GetDriveEligibleStudents)
			drives.PATCH("/:id/status", driveCtrl.UpdateDriveStatus)
			drives.GET("/:id/activities", driveCtrl.GetDriveActivities)
		}

		// Companies lookup
		companies := api.Group("/companies")
		{
			companies.GET("", masterCtrl.GetCompanies)
		}

		// Placement officers lookup (department_id = 4)
		officers := api.Group("/placement-officers")
		{
			officers.GET("", masterCtrl.GetPlacementOfficers)
		}

		// Batches lookup
		batches := api.Group("/batches")
		{
			batches.GET("", masterCtrl.GetBatches)
		}

		// Health Check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"status":  "healthy",
				"service": "placement-backend",
			})
		})
	}
}
