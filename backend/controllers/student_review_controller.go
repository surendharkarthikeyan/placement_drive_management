package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"placement-management/config"
	"placement-management/models"
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

type UpdateReviewNoteRequest struct {
	Note string `json:"note" binding:"required"`
}

// UpdateStudentReviewNote modifies an existing recommendation note
func (c *StudentReviewController) UpdateStudentReviewNote(ctx *gin.Context) {
	noteIdParam := ctx.Param("note_id")
	noteId, err := strconv.ParseUint(noteIdParam, 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	var req UpdateReviewNoteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note payload: " + err.Error()})
		return
	}

	if err := c.repo.UpdateReviewNote(noteId, req.Note); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update recommendation note: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Recommendation note updated successfully",
	})
}

// DeleteStudentReviewNote deletes a note by note_id
func (c *StudentReviewController) DeleteStudentReviewNote(ctx *gin.Context) {
	noteIdParam := ctx.Param("note_id")
	noteId, err := strconv.ParseUint(noteIdParam, 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	if err := c.repo.DeleteReviewNote(noteId); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete recommendation note: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Recommendation note deleted successfully",
	})
}

// GetStudentRecruitmentHistory returns the paginated company recruitment history for the student
func (c *StudentReviewController) GetStudentRecruitmentHistory(ctx *gin.Context) {
	userIdParam := ctx.Param("user_id")
	if userIdParam == "" || userIdParam == "default" {
		defaultDetail, err := c.repo.GetDefaultStudentReviewDetail()
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch default student: " + err.Error()})
			return
		}
		userIdParam = strconv.FormatUint(defaultDetail.UserID, 10)
	}

	userId, err := strconv.ParseUint(userIdParam, 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "5"))

	history, err := c.repo.GetStudentRecruitmentHistory(userId, page, limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recruitment history: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, history)
}

// GetStudentCompanyProcesses returns company recruitment processes attended by the student
func (c *StudentReviewController) GetStudentCompanyProcesses(ctx *gin.Context) {
	userIdParam := ctx.Param("user_id")
	if userIdParam == "" || userIdParam == "default" {
		defaultDetail, err := c.repo.GetDefaultStudentReviewDetail()
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch default student: " + err.Error()})
			return
		}
		userIdParam = strconv.FormatUint(defaultDetail.UserID, 10)
	}

	userId, err := strconv.ParseUint(userIdParam, 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	search := ctx.Query("search")
	processes, err := c.repo.GetStudentCompanyProcesses(userId, search)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch company recruitment processes: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, processes)
}

// GetReviewAnalytics returns the 5 analytics cards based on left-panel filters
func (c *StudentReviewController) GetReviewAnalytics(ctx *gin.Context) {
	var filter models.ReviewAnalyticsFilter

	if ctx.Request.Method == "POST" {
		// Try binding direct filter or wrapped filter
		type WrappedBody struct {
			Filter models.ReviewAnalyticsFilter `json:"filter"`
		}
		var wrapped WrappedBody
		if err := ctx.ShouldBindJSON(&wrapped); err == nil && (wrapped.Filter.Batch != "" || len(wrapped.Filter.Departments) > 0 || wrapped.Filter.StudentCategory != "") {
			filter = wrapped.Filter
		} else {
			_ = ctx.ShouldBindJSON(&filter)
		}
	} else {
		filter.Batch = ctx.Query("batch")
		if dept := ctx.Query("department"); dept != "" && dept != "all" {
			filter.Departments = []string{dept}
		}
		filter.StudentCategory = ctx.Query("student_category")
		filter.PlacementInterestedIn = ctx.Query("placement_interested_in")
		filter.NipCategory = ctx.Query("nip_category")
	}

	analytics, err := c.repo.GetReviewAnalytics(filter)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate review analytics: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, analytics)
}

// GetReviewStudents returns the list of students matching the left-panel filters and sorted
func (c *StudentReviewController) GetReviewStudents(ctx *gin.Context) {
	var filter models.ReviewAnalyticsFilter
	sortBy := ctx.DefaultQuery("sort", "opportunity_priority")

	if ctx.Request.Method == "POST" {
		type RequestBody struct {
			Filter models.ReviewAnalyticsFilter `json:"filter"`
			Sort   string                       `json:"sort"`
		}
		var body RequestBody
		if err := ctx.ShouldBindJSON(&body); err == nil && (body.Filter.Batch != "" || len(body.Filter.Departments) > 0 || body.Filter.StudentCategory != "") {
			filter = body.Filter
			if body.Sort != "" {
				sortBy = body.Sort
			}
		} else {
			_ = ctx.ShouldBindJSON(&filter)
		}
	} else {
		filter.Batch = ctx.Query("batch")
		if dept := ctx.Query("department"); dept != "" && dept != "all" {
			filter.Departments = []string{dept}
		}
		filter.StudentCategory = ctx.Query("student_category")
		filter.PlacementInterestedIn = ctx.Query("placement_interested_in")
		filter.NipCategory = ctx.Query("nip_category")
	}

	students, err := c.repo.GetReviewStudents(filter, sortBy)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch review students: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, students)
}

// ExportReviewStudentsExcel generates an Excel spreadsheet for the selected students
func (c *StudentReviewController) ExportReviewStudentsExcel(ctx *gin.Context) {
	type ExportRequest struct {
		StudentIDs []uint64                     `json:"student_ids"`
		Filter     models.ReviewAnalyticsFilter `json:"filter"`
	}

	var body ExportRequest
	_ = ctx.ShouldBindJSON(&body)

	targetIDs := body.StudentIDs
	if len(targetIDs) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "No students selected for export. Please select at least one student."})
		return
	}

	excelData, err := c.repo.ExportStudentsExcel(targetIDs)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate Excel document: " + err.Error()})
		return
	}

	ctx.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	ctx.Header("Content-Disposition", "attachment; filename=Student_Placement_Review_Export.xlsx")
	ctx.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excelData)
}





