package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"placement-management/config"
	"placement-management/middleware"
	"placement-management/routes"
)

func main() {
	// Load .env variables
	_ = godotenv.Load()

	// Initialize MySQL connection with GORM
	config.ConnectDB()

	// Set Gin mode
	ginMode := os.Getenv("GIN_MODE")
	if ginMode != "" {
		gin.SetMode(ginMode)
	}

	r := gin.Default()

	// Enable CORS for frontend Vite application
	r.Use(middleware.CORSMiddleware())

	// Register API routes
	routes.SetupRoutes(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[INFO] Server is running on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("[FATAL] Failed to start server: %v", err)
	}
}
