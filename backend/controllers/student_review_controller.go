package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"placement-management/config"
	"placement-management/repositories"
)

type StudentReviewController struct {
	repo *repositories.StudentReviewRepository
}

func NewStudentReviewController() *StudentReviewController {
	return &StudentReviewController{
		repo: repositories.NewStudentReviewRepository(config.DB),
	}
}

// GetStudentReviewDetail returns the review details, badges, and 4 stat card counts for a student
func (c *StudentReviewController) GetStudentReviewDetail(ctx *gin.Context) {
	userIdParam := ctx.Param("user_id")

	if userIdParam == "" || userIdParam == "default" {
		detail, err := c.repo.GetDefaultStudentReviewDetail()
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch default student review details: " + err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, detail)
		return
	}

	userId, err := strconv.ParseUint(userIdParam, 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	detail, err := c.repo.GetStudentReviewDetail(userId)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Student review details not found: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, detail)
}

type SaveReviewNoteRequest struct {
	Note      string  `json:"note" binding:"required"`
	CreatedBy *uint64 `json:"created_by"`
}

// SaveStudentReviewNote adds a new recommendation note in placement_review_notes
func (c *StudentReviewController) SaveStudentReviewNote(ctx *gin.Context) {
	userIdParam := ctx.Param("user_id")
	userId, err := strconv.ParseUint(userIdParam, 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req SaveReviewNoteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note payload: " + err.Error()})
		return
	}

	var createdBy uint64 = 6 // Placement Officer fallback
	if req.CreatedBy != nil && *req.CreatedBy > 0 {
		createdBy = *req.CreatedBy
	}

	if err := c.repo.SaveReviewNote(userId, req.Note, createdBy); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save recommendation note: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Recommendation note saved successfully",
	})
}

