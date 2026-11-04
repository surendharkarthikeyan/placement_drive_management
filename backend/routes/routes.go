package routes

import (
	"github.com/gin-gonic/gin"
	"placement-management/controllers"
)

func SetupRoutes(r *gin.Engine) {
	driveCtrl := controllers.NewDriveController()
	masterCtrl := controllers.NewMasterController()
	studentReviewCtrl := controllers.NewStudentReviewController()
	intelligenceCtrl := controllers.NewPlacementIntelligenceController()

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
			drives.POST("/:id/confirm-students", driveCtrl.ConfirmDriveStudentsRoster)
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
			drives.PUT("/:id/offers/:student_id", driveCtrl.UpdateStudentOffer)
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

		// Departments lookup
		departments := api.Group("/departments")
		{
			departments.GET("", masterCtrl.GetDepartments)
		}

		// Student Placement Review
		studentReview := api.Group("/student-review")
		{
			studentReview.GET("/analytics", studentReviewCtrl.GetReviewAnalytics)
			studentReview.POST("/analytics", studentReviewCtrl.GetReviewAnalytics)
			studentReview.GET("/students", studentReviewCtrl.GetReviewStudents)
			studentReview.POST("/students", studentReviewCtrl.GetReviewStudents)
			studentReview.POST("/export", studentReviewCtrl.ExportReviewStudentsExcel)
			studentReview.GET("/:user_id", studentReviewCtrl.GetStudentReviewDetail)
			studentReview.GET("/:user_id/history", studentReviewCtrl.GetStudentRecruitmentHistory)
			studentReview.GET("/:user_id/company-processes", studentReviewCtrl.GetStudentCompanyProcesses)
			studentReview.POST("/:user_id/notes", studentReviewCtrl.SaveStudentReviewNote)
			studentReview.PUT("/notes/:note_id", studentReviewCtrl.UpdateStudentReviewNote)
			studentReview.DELETE("/notes/:note_id", studentReviewCtrl.DeleteStudentReviewNote)
		}

		// Placement Intelligence
		intelligence := api.Group("/intelligence")
		{
			intelligence.GET("/batch-summaries", intelligenceCtrl.GetBatchSummaries)
			intelligence.GET("/outcome-summary", intelligenceCtrl.GetOutcomeGroupSummary)
			intelligence.GET("/overall-stats", intelligenceCtrl.GetOverallPlacementMatrix)
			intelligence.GET("/overall-stats/export", intelligenceCtrl.ExportOverallPlacementMatrixExcel)
			intelligence.GET("/outcome-students", intelligenceCtrl.GetOutcomeGroupStudents)
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
