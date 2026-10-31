package repositories

import (
	"gorm.io/gorm"
	"placement-management/models"
)

type MasterRepository struct {
	db *gorm.DB
}

func NewMasterRepository(db *gorm.DB) *MasterRepository {
	return &MasterRepository{db: db}
}

// GetPlacementOfficers fetches master_users where department_id = 4
func (r *MasterRepository) GetPlacementOfficers() ([]models.MasterUser, error) {
	var users []models.MasterUser
	err := r.db.Where("department_id = ?", 4).Order("name ASC").Find(&users).Error
	return users, err
}

// GetCompanies fetches active companies
func (r *MasterRepository) GetCompanies() ([]models.PlacementCompany, error) {
	var companies []models.PlacementCompany
	err := r.db.Where("status = ?", "1").Order("company_name ASC").Find(&companies).Error
	return companies, err
}

// GetBatches fetches all academic batches
func (r *MasterRepository) GetBatches() ([]models.Batch, error) {
	var batches []models.Batch
	err := r.db.Order("name ASC").Find(&batches).Error
	return batches, err
}

// GetDepartments fetches academic departments
func (r *MasterRepository) GetDepartments() ([]models.Department, error) {
	var depts []models.Department
	err := r.db.Where("id != 4").Order("name ASC").Find(&depts).Error
	return depts, err
}

