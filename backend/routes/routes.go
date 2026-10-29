package routes

import (
	"github.com/gin-gonic/gin"
	"placement-management/controllers"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		// Drives endpoints
		drives := api.Group("/drives")
		{
			drives.GET("", controllers.GetDrives)
			drives.GET("/:id", controllers.GetDriveByID)
			drives.PATCH("/:id/status", controllers.UpdateDriveStatus)
			drives.GET("/:id/activities", controllers.GetDriveActivities)
		}

		// Health check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"status":  "healthy",
				"service": "placement-backend",
			})
		})
	}
}
