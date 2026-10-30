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
			drives.GET("/:id/completion", driveCtrl.GetDataCompletion)
			drives.PUT("/:id/details", driveCtrl.UpdateDriveDetails)
			drives.PUT("/:id", driveCtrl.UpdateDriveDetails)
			drives.PUT("/:id/eligibility", driveCtrl.UpdateDriveEligibility)
			drives.GET("/:id/students", driveCtrl.GetDriveEligibleStudents)
			drives.POST("/:id/students", driveCtrl.UpdateDriveStudentsRoster)
			drives.PATCH("/:id/status", driveCtrl.UpdateDriveStatus)
			drives.GET("/:id/activities", driveCtrl.GetDriveActivities)

			// Stages & Outcomes endpoints
			drives.GET("/:id/stages", driveCtrl.GetDriveStages)
			drives.POST("/:id/stages", driveCtrl.CreateStage)
			drives.PUT("/:id/stages/:stage_id", driveCtrl.UpdateStage)
			drives.POST("/:id/stages/:stage_id/substages", driveCtrl.CreateSubstage)
			drives.GET("/:id/stages/:stage_id/results", driveCtrl.GetStageResults)
			drives.PUT("/:id/stages/:stage_id/results", driveCtrl.UpdateStageResults)
			drives.POST("/:id/stages/:stage_id/special-entry", driveCtrl.AddSpecialEntryToStage)
			drives.POST("/:id/stages/:stage_id/complete", driveCtrl.CompleteStage)
			drives.PATCH("/:id/stages/:stage_id/substages/:substage_id/status", driveCtrl.UpdateSubstageStatus)
			drives.POST("/:id/stages/:stage_id/substages/:substage_id/complete", driveCtrl.CompleteSubstage)
			drives.POST("/:id/complete-recruitment", driveCtrl.CompleteRecruitmentProcess)
			drives.GET("/:id/final-selection", driveCtrl.GetFinalSelection)
			drives.POST("/:id/final-selection", driveCtrl.SaveFinalSelection)
			drives.POST("/:id/upload-reference-doc", driveCtrl.UploadReferenceDocument)
			drives.POST("/:id/upload-offer-letter", driveCtrl.UploadOfferLetter)
			drives.GET("/:id/download-offer-letter/:student_id", driveCtrl.DownloadOfferLetter)
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
