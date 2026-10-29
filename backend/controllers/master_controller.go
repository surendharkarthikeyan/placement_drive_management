package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"placement-management/config"
	"placement-management/repositories"
)

type MasterController struct {
	repo *repositories.MasterRepository
}

func NewMasterController() *MasterController {
	repo := repositories.NewMasterRepository(config.DB)
	return &MasterController{repo: repo}
}

// GetPlacementOfficers returns master_users with department_id = 4
func (ctrl *MasterController) GetPlacementOfficers(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		return
	}

	users, err := ctrl.repo.GetPlacementOfficers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": users})
}

// GetCompanies returns active companies from placement_company table
func (ctrl *MasterController) GetCompanies(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		return
	}

	companies, err := ctrl.repo.GetCompanies()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": companies})
}

// GetBatches returns batches list
func (ctrl *MasterController) GetBatches(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		return
	}

	batches, err := ctrl.repo.GetBatches()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": batches})
}

