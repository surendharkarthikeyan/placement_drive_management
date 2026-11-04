package config

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func ConnectDB() {
	_ = godotenv.Load()

	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "root"
	}
	dbPass := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "127.0.0.1"
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "3306"
	}
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "placement"
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		dbUser, dbPass, dbHost, dbPort, dbName,
	)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Printf("[WARN] Failed to connect to MySQL database: %v", err)
		log.Println("[INFO] Ensure MySQL is running on", dbHost+":"+dbPort, "with database:", dbName)
		return
	}

	log.Println("[SUCCESS] Connected to MySQL database successfully.")

	// Automatically update any students with outcome 'pending' in completed stages to 'not_cleared'
	DB.Exec(`
		UPDATE placement_stage_results psr
		JOIN placement_drive_stages pds ON psr.stage_id = pds.id
		SET psr.outcome = 'not_cleared', psr.updated_at = NOW()
		WHERE pds.stage_status = 'completed' AND (psr.outcome = 'pending' OR psr.outcome IS NULL OR psr.outcome = '')
	`)
	DB.Exec(`
		UPDATE placement_stage_results psr
		JOIN placement_drive_substages pdsub ON psr.substage_id = pdsub.id
		SET psr.outcome = 'not_cleared', psr.updated_at = NOW()
		WHERE pdsub.substage_status = 'completed' AND (psr.outcome = 'pending' OR psr.outcome IS NULL OR psr.outcome = '')
	`)
}
