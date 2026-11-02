import React, { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  AlertCircle,
  MessageSquareQuote,
  Send,
  Clock,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react'
import {
  getStudentReviewDetail,
  getStudentRecruitmentHistory,
  getStudentCompanyProcesses,
  saveStudentReviewNote,
  updateStudentReviewNote,
  deleteStudentReviewNote
} from '../../../services/api'
import GlassSegmentedControl from '../../common/GlassSegmentedControl'

/**
 * ReviewStudentDetailPanel (Right Panel of Student Placement Review)
 * Template width: ~360px-400px
 * Displays student profile header, status badges (Placed/Not Placed, Core/Software/NIP),
 * segment navigation tabs, and tab views:
 * - Placement Journey: 6 stat cards, Offers Received, Academic Eligibility.
 * - Opportunity Priority: Two-Metric Opportunity Score Card (Score, Priority level, Reasons, Recommendation note from DB) + Algorithm Breakdown.
 * - Activity History: Timeline view.
 */
export default function ReviewStudentDetailPanel({ studentId = 'default' }) {
  const [student, setStudent] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('Placement Journey')

  // Recommendation note form state
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteSuccess, setNoteSuccess] = useState(false)

  // Recommendation note edit & delete state
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [isUpdatingNote, setIsUpdatingNote] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState(null)
  const [deleteConfirmNoteId, setDeleteConfirmNoteId] = useState(null)

  // Recruitment History (Activity History tab) state
  const [historyData, setHistoryData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [historyPage, setHistoryPage] = useState(1)

  const fetchHistory = useCallback(async (pageToLoad = 1) => {
    try {
      setHistoryLoading(true)
      setHistoryError(null)
      const targetUserId = student?.user_id || studentId || 'default'
      const data = await getStudentRecruitmentHistory(targetUserId, pageToLoad, 5)
      setHistoryData(data)
    } catch (err) {
      console.error('Error fetching recruitment history:', err)
      setHistoryError('Failed to load recruitment history')
    } finally {
      setHistoryLoading(false)
    }
  }, [student?.user_id, studentId])

  useEffect(() => {
    if (activeTab === 'Activity History') {
      fetchHistory(historyPage)
    }
  }, [activeTab, historyPage, fetchHistory])

  // Reset history page when student changes
  useEffect(() => {
    setHistoryPage(1)
  }, [studentId])

  // Company-wise Recruitment Processes state
  const [processes, setProcesses] = useState([])
  const [processesLoading, setProcessesLoading] = useState(false)
  const [processesError, setProcessesError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchProcesses = useCallback(async (query = '') => {
    try {
      setProcessesLoading(true)
      setProcessesError(null)
      const targetUserId = student?.user_id || studentId || 'default'
      const data = await getStudentCompanyProcesses(targetUserId, query)
      setProcesses(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching company recruitment processes:', err)
      setProcessesError('Failed to load company recruitment processes')
    } finally {
      setProcessesLoading(false)
    }
  }, [student?.user_id, studentId])

  useEffect(() => {
    if (activeTab === 'Activity History') {
      fetchProcesses(searchQuery)
    }
  }, [activeTab, searchQuery, fetchProcesses])

  // Reset search when student changes
  useEffect(() => {
    setSearchQuery('')
  }, [studentId])

  useEffect(() => {
    let isMounted = true

    const fetchStudentDetail = async () => {
      try {
        if (!student) {
          setIsLoading(true)
        } else {
          setIsUpdating(true)
        }
        setError(null)
        const data = await getStudentReviewDetail(studentId || 'default')
        if (isMounted) {
          setStudent(data)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load student review detail:', err)
          setError(err.response?.data?.error || 'Failed to load student details')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
          setIsUpdating(false)
        }
      }
    }

    fetchStudentDetail()

    return () => {
      isMounted = false
    }
  }, [studentId])

  // Get initials for avatar (e.g., "Rahul Dev" -> "RD", "Arun Kumar" -> "AK")
  const getInitials = (name) => {
    if (!name) return 'ST'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Format CGPA to 2 decimal places if present
  const formatCGPA = (cgpa) => {
    if (cgpa === null || cgpa === undefined) return 'N/A'
    const num = Number(cgpa)
    return isNaN(num) ? 'N/A' : num.toFixed(2)
  }

  // Save recommendation note to database table placement_review_notes
  const handleSaveNote = async () => {
    if (!noteInput.trim()) return
    try {
      setIsSavingNote(true)
      await saveStudentReviewNote(student.user_id, noteInput.trim())
      const updated = await getStudentReviewDetail(student.user_id)
      setStudent(updated)
      setNoteInput('')
      setShowNoteEditor(false)
      setNoteSuccess(true)
      setTimeout(() => setNoteSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save review note:', err)
    } finally {
      setIsSavingNote(false)
    }
  }

  // Update existing recommendation note
  const handleUpdateNote = async (noteId) => {
    if (!editingNoteText.trim()) return
    try {
      setIsUpdatingNote(true)
      await updateStudentReviewNote(noteId, editingNoteText.trim())
      const updated = await getStudentReviewDetail(student.user_id)
      setStudent(updated)
      setEditingNoteId(null)
      setEditingNoteText('')
    } catch (err) {
      console.error('Failed to update review note:', err)
    } finally {
      setIsUpdatingNote(false)
    }
  }

  // Delete recommendation note
  const handleDeleteNote = async (noteId) => {
    try {
      setDeletingNoteId(noteId)
      await deleteStudentReviewNote(noteId)
      const updated = await getStudentReviewDetail(student.user_id)
      setStudent(updated)
    } catch (err) {
      console.error('Failed to delete review note:', err)
    } finally {
      setDeletingNoteId(null)
      setDeleteConfirmNoteId(null)
    }
  }

  // Priority status badge styling matching reference design:
  // High: text #CA3A31, bg #FCF2F2, border #F6CCCB
  // Mid: text #A85923, bg #FEFBED, border #F9E796
  // Low: text #4CA16D, bg #F2FDF5, border #C7F5D3
  // Needs Improvement & Interest: text #CA3A31, bg #FCF2F2, border #F6CCCB
  const getStatusBadgeStyle = (level) => {
    const l = (level || '').toLowerCase().trim()
    if (l.startsWith('high')) {
      return 'bg-[#FCF2F2] border-[#F6CCCB] text-[#CA3A31]'
    }
    if (l.startsWith('mid')) {
      return 'bg-[#FEFBED] border-[#F9E796] text-[#A85923]'
    }
    if (l.startsWith('low')) {
      return 'bg-[#F2FDF5] border-[#C7F5D3] text-[#4CA16D]'
    }
    // Default / Needs Improvement & Interest
    return 'bg-[#FCF2F2] border-[#F6CCCB] text-[#CA3A31]'
  }

  const formatStatusLabel = (level) => {
    if (!level) return 'Needs Improvement & Interest'
    const l = level.toLowerCase().trim()
    if (l.startsWith('high')) return 'High'
    if (l.startsWith('mid')) return 'Mid'
    if (l.startsWith('low')) return 'Low'
    if (l.includes('needs')) return 'Needs Improvement & Interest'
    return level
  }

  return (
    <aside className="w-[450px] xl:w-[490px] h-full overflow-y-auto bg-white border-l border-[#dbe5f1] p-[22px] shrink-0 select-none text-[#1e293b] flex flex-col">
      {isLoading && !student ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-[#64748b]">
          <Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" />
          <span className="text-[13px] font-[600]">Loading student profile...</span>
        </div>
      ) : error && !student ? (
        <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-[12px] text-center text-[#991b1b] text-[13px] flex flex-col items-center gap-2 my-auto">
          <AlertCircle className="w-5 h-5 text-[#dc2626]" />
          <span className="font-[600]">{error}</span>
        </div>
      ) : student ? (
        <div className={`flex flex-col transition-opacity duration-200 ${isUpdating ? 'opacity-70 pointer-events-none' : 'opacity-100'}`}>
          {/* 1. Profile Header Row */}
          <div className="flex items-center gap-3.5">
            {/* Avatar with royal blue/indigo gradient */}
            <div className="w-[50px] h-[50px] rounded-[14px] bg-gradient-to-tr from-[#2563eb] via-[#3b82f6] to-[#6366f1] flex items-center justify-center text-white text-[17px] font-extrabold shadow-sm tracking-wide shrink-0">
              {getInitials(student.name)}
            </div>

            {/* Name and Meta Subtitle */}
            <div className="min-w-0 flex-1">
              <h2 className="text-[19px] font-extrabold text-[#0f172a] tracking-tight leading-tight truncate m-0">
                {student.name}
              </h2>
              <p className="text-[12.5px] font-semibold text-[#64748b] mt-0.5 mb-0 truncate leading-snug">
                {student.roll_no ? `${student.roll_no} · ` : ''}
                {student.department_code || student.department_name || 'ENG'} · CGPA {formatCGPA(student.cgpa)}
              </p>
            </div>
          </div>

          {/* 2. Status Badges Row (Immediate priority omitted per user requirement) */}
          <div className="flex items-center gap-2 mt-3">
            {/* Placed / Not Placed Badge */}
            {student.is_placed ? (
              <span className="px-3 py-1 rounded-full text-[12px] font-bold font-sans tracking-tight bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] inline-flex items-center justify-center">
                Placed
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-[12px] font-bold font-sans tracking-tight bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1] inline-flex items-center justify-center">
                Not Placed
              </span>
            )}

            {/* Core / Software / NIP Category Badge */}
            {student.category_badge && (
              <span
                className={`px-3 py-1 rounded-full text-[12px] font-bold font-sans tracking-tight border inline-flex items-center justify-center ${
                  student.category_badge === 'NIP'
                    ? 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]'
                    : 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]'
                }`}
              >
                {student.category_badge}
              </span>
            )}
          </div>

          {/* Subtle separator */}
          <div className="w-full h-px bg-[#f1f5f9] my-4" />

          {/* 3. Navigation Segmented Tabs with glassmorphism effect */}
          <GlassSegmentedControl
            options={[
              { id: 'Placement Journey', label: 'Placement Journey' },
              { id: 'Opportunity Priority', label: 'Opportunity Priority' },
              { id: 'Activity History', label: 'Activity History' }
            ]}
            value={activeTab}
            onChange={setActiveTab}
            buttonPy="py-[7px]"
            fontSize="text-[12.5px]"
          />

          {/* Tab Content 1: Placement Journey */}
          {activeTab === 'Placement Journey' && (
            <>
              {/* Six Metric Stat Cards Grid */}
              <div className="grid grid-cols-3 gap-2.5 mt-4">
                {/* Card 1: Invitations */}
                <div className="bg-white border border-[#dbe5f1] rounded-[14px] py-[15px] px-2 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center hover:border-[#bfdbfe] transition-all">
                  <strong className="block text-[22px] font-black text-[#172554] leading-none mb-1.5">
                    {student.stats?.invitations ?? 0}
                  </strong>
                  <span className="block text-[11.5px] font-semibold text-[#64748b] leading-tight">
                    Invitations
                  </span>
                </div>

                {/* Card 2: Attended */}
                <div className="bg-white border border-[#dbe5f1] rounded-[14px] py-[15px] px-2 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center hover:border-[#bfdbfe] transition-all">
                  <strong className="block text-[22px] font-black text-[#172554] leading-none mb-1.5">
                    {student.stats?.accepted ?? 0}
                  </strong>
                  <span className="block text-[11.5px] font-semibold text-[#64748b] leading-tight">
                    Attended
                  </span>
                </div>

                {/* Card 3: Processes */}
                <div className="bg-white border border-[#dbe5f1] rounded-[14px] py-[15px] px-2 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center hover:border-[#bfdbfe] transition-all">
                  <strong className="block text-[22px] font-black text-[#172554] leading-none mb-1.5">
                    {student.stats?.processes ?? 0}
                  </strong>
                  <span className="block text-[11.5px] font-semibold text-[#64748b] leading-tight">
                    Processes
                  </span>
                </div>

                {/* Card 4: Final Misses */}
                <div className="bg-white border border-[#dbe5f1] rounded-[14px] py-[15px] px-2 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center hover:border-[#bfdbfe] transition-all">
                  <strong className="block text-[22px] font-black text-[#172554] leading-none mb-1.5">
                    {student.stats?.final_misses ?? 0}
                  </strong>
                  <span className="block text-[11.5px] font-semibold text-[#64748b] leading-tight">
                    Final Misses
                  </span>
                </div>

                {/* Card 5: Offers */}
                <div className="bg-white border border-[#dbe5f1] rounded-[14px] py-[15px] px-2 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center hover:border-[#bfdbfe] transition-all">
                  <strong className="block text-[22px] font-black text-[#172554] leading-none mb-1.5">
                    {student.stats?.offers ?? 0}
                  </strong>
                  <span className="block text-[11.5px] font-semibold text-[#64748b] leading-tight">
                    Offers
                  </span>
                </div>

                {/* Card 6: Recruitment rounds cleared */}
                <div className="bg-white border border-[#dbe5f1] rounded-[14px] py-[15px] px-2 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center hover:border-[#bfdbfe] transition-all">
                  <strong className="block text-[20px] font-black text-[#172554] leading-none mb-1.5">
                    {student.stats?.rounds_text || `${student.stats?.rounds_cleared ?? 0} of ${student.stats?.total_rounds ?? 0}`}
                  </strong>
                  <span className="block text-[11px] font-semibold text-[#64748b] leading-tight">
                    Recruitment rounds cleared
                  </span>
                </div>
              </div>

              {/* Offers Received Section */}
              <div className="mt-6 flex flex-col gap-2.5">
                <h3 className="text-[14px] font-bold text-[#172554] tracking-tight m-0">
                  Offers Received
                </h3>

                {student.offers && student.offers.length > 0 ? (
                  student.offers.map((offer, idx) => (
                    <div
                      key={offer.offer_id || idx}
                      className="bg-white border border-[#dbe5f1] rounded-[16px] p-[12px_16px] flex items-center justify-between shadow-[0_1px_3px_rgba(15,23,42,0.03)] hover:border-[#cbd5e1] transition-all"
                    >
                      {/* Left: Rupee Icon & Offer Details */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-[42px] h-[42px] rounded-[12px] bg-[#eff6ff] flex items-center justify-center text-[#2563eb] text-[16px] font-bold shrink-0">
                          ₹
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[15px] font-bold text-[#172554] leading-snug truncate">
                            {offer.company_name}
                          </span>
                          <span className="text-[13px] font-medium text-[#64748b] leading-tight mt-0.5">
                            {offer.package_lpa != null ? `₹${offer.package_lpa} LPA` : (offer.role || 'Offer Secured')}
                          </span>
                        </div>
                      </div>

                      {/* Right: Accepted Pill Badge */}
                      <span className="px-3.5 py-1 rounded-full text-[12px] font-bold bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]/60 inline-flex items-center shrink-0">
                        {offer.status || 'Accepted'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#fbfdff] border border-dashed border-[#cbd5e1] rounded-[16px] py-4 px-4 flex items-center justify-center text-center text-[#94a3b8] text-[13px] font-semibold">
                    No offers
                  </div>
                )}
              </div>

              {/* Academic Eligibility Section */}
              <div className="mt-6 flex flex-col gap-2.5">
                <h3 className="text-[14px] font-bold text-[#172554] tracking-tight m-0">
                  Academic Eligibility
                </h3>

                <div className="bg-white border border-[#dbe5f1] rounded-[16px] px-5 py-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col">
                  {/* Row 1: Batch */}
                  <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
                    <span className="text-[13.5px] font-medium text-[#475569]">Batch</span>
                    <span className="text-[14px] font-bold text-[#172554]">
                      {student.batch_name || '2022-2026'}
                    </span>
                  </div>

                  {/* Row 2: CGPA */}
                  <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
                    <span className="text-[13.5px] font-medium text-[#475569]">CGPA</span>
                    <span className="text-[14px] font-bold text-[#172554]">
                      {student.cgpa != null ? Number(student.cgpa).toFixed(2) : '8.50'}
                    </span>
                  </div>

                  {/* Row 3: 10th */}
                  <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
                    <span className="text-[13.5px] font-medium text-[#475569]">10th</span>
                    <span className="text-[14px] font-bold text-[#172554]">
                      {student.tenth_mark != null ? `${Number(student.tenth_mark).toFixed(1)}%` : '92.5%'}
                    </span>
                  </div>

                  {/* Row 4: 12th */}
                  <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
                    <span className="text-[13.5px] font-medium text-[#475569]">12th</span>
                    <span className="text-[14px] font-bold text-[#172554]">
                      {student.twelfth_mark != null ? `${Number(student.twelfth_mark).toFixed(1)}%` : '88.0%'}
                    </span>
                  </div>

                  {/* Row 5: Arrears */}
                  <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
                    <span className="text-[13.5px] font-medium text-[#475569]">Arrears</span>
                    <span className="text-[14px] font-bold text-[#172554]">
                      {student.current_arrears ?? 0}
                    </span>
                  </div>

                  {/* Row 6: History of Arrears */}
                  <div className="flex items-center justify-between py-3">
                    <span className="text-[13.5px] font-medium text-[#475569]">History of Arrears</span>
                    <span className="text-[14px] font-bold text-[#172554]">
                      {student.history_of_arrears ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tab Content 2: Opportunity Priority */}
          {activeTab === 'Opportunity Priority' && (
            <div className="flex flex-col gap-5 mt-4">
              {/* Reference-Styled Opportunity Priority Score Card */}
              <div className="bg-white border border-[#bfdbfe] rounded-[20px] p-5 shadow-[0_2px_10px_rgba(37,99,235,0.06)] flex flex-col">
                <span className="text-[15.5px] font-extrabold text-[#2563eb] tracking-tight block">
                  Opportunity Priority Score
                </span>

                <div className="text-[38px] font-black text-[#0f172a] tracking-tight leading-none mt-1 mb-2">
                  {Math.round(student.opportunity?.score ?? 0)}/100
                </div>

                {/* Priority Status Badge in exact reference colors */}
                <div className="mb-4">
                  <span
                    className={`inline-flex items-center justify-center px-4 py-1.5 rounded-[10px] text-[13.5px] font-bold font-sans border tracking-tight shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${getStatusBadgeStyle(
                      student.opportunity?.priority_level
                    )}`}
                  >
                    {formatStatusLabel(student.opportunity?.priority_level)}
                  </span>
                </div>

                {/* Bulleted Reasons List */}
                <ul className="space-y-2 text-[13px] text-[#475569] leading-relaxed list-disc list-inside m-0 p-0">
                  {student.opportunity?.reasons && student.opportunity.reasons.length > 0 ? (
                    student.opportunity.reasons.map((reason, idx) => (
                      <li key={idx} className="leading-snug">
                        <span className="text-[#334155]">{reason}</span>
                      </li>
                    ))
                  ) : (
                    <li className="leading-snug">
                      <span className="text-[#334155]">Regular placement cycle evaluation in progress.</span>
                    </li>
                  )}
                </ul>

                {/* All Recommendation Notes from DB placement_review_notes */}
                <div className="mt-5 pt-4 border-t border-[#e2e8f0]">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[12px] font-bold text-[#1e293b] flex items-center gap-1.5">
                      <MessageSquareQuote className="w-3.5 h-3.5 text-[#2563eb]" />
                      Placement Recommendation Notes
                      {student.opportunity?.notes && student.opportunity.notes.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]">
                          {student.opportunity.notes.length}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNoteEditor(!showNoteEditor)}
                      className="text-[11.5px] font-semibold text-[#2563eb] hover:underline cursor-pointer"
                    >
                      {showNoteEditor ? 'Close' : '+ Add Note'}
                    </button>
                  </div>

                  {showNoteEditor && (
                    <div className="mb-3 flex flex-col gap-2 p-3 bg-[#f8fafc] border border-[#bfdbfe] rounded-[12px]">
                      <span className="text-[11.5px] font-bold text-[#1e293b]">Add New Recommendation Note</span>
                      <textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Enter placement officer recommendation note..."
                        className="w-full text-[12.5px] p-2.5 bg-white border border-[#cbd5e1] rounded-[10px] focus:outline-none focus:border-[#2563eb] resize-none h-20 text-[#1e293b]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowNoteEditor(false)}
                          className="px-2.5 py-1 text-[11.5px] font-semibold text-[#64748b] hover:bg-[#e2e8f0] rounded-[8px] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSavingNote || !noteInput.trim()}
                          onClick={handleSaveNote}
                          className="px-3 py-1 bg-[#2563eb] text-white text-[11.5px] font-semibold rounded-[8px] hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          {isSavingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Save Note
                        </button>
                      </div>
                    </div>
                  )}

                  {noteSuccess && (
                    <div className="mb-2 text-[11px] font-semibold text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1 rounded-[8px]">
                      ✓ Note saved successfully to database!
                    </div>
                  )}

                  {/* List all notes in order with edit & delete icon options */}
                  {student.opportunity?.notes && student.opportunity.notes.length > 0 ? (
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {student.opportunity.notes.map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] p-3 hover:border-[#cbd5e1] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                        >
                          {editingNoteId === item.id ? (
                            <div className="flex flex-col gap-2">
                              <span className="text-[11px] font-bold text-[#1e293b]">Edit Recommendation Note</span>
                              <textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="w-full text-[12.5px] p-2 bg-white border border-[#2563eb] rounded-[8px] focus:outline-none resize-none h-18 text-[#1e293b]"
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteId(null)
                                    setEditingNoteText('')
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-[#64748b] hover:bg-[#e2e8f0] rounded-[6px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isUpdatingNote || !editingNoteText.trim()}
                                  onClick={() => handleUpdateNote(item.id)}
                                  className="px-3 py-1 bg-[#2563eb] text-white text-[11px] font-semibold rounded-[6px] hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                >
                                  {isUpdatingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[12.5px] text-[#334155] italic leading-relaxed m-0 font-medium whitespace-pre-wrap flex-1">
                                  "{item.note}"
                                </p>

                                {/* Edit & Delete Action Icons */}
                                <div className="flex items-center gap-1 shrink-0 -mt-0.5">
                                  {deleteConfirmNoteId === item.id ? (
                                    <div className="flex items-center gap-1 bg-[#fef2f2] border border-[#fecaca] px-2 py-0.5 rounded-[6px] text-[11px] text-[#991b1b] shadow-xs">
                                      <span>Delete?</span>
                                      <button
                                        type="button"
                                        disabled={deletingNoteId === item.id}
                                        onClick={() => handleDeleteNote(item.id)}
                                        className="p-0.5 text-[#dc2626] hover:bg-[#fee2e2] rounded cursor-pointer"
                                        title="Confirm delete"
                                      >
                                        {deletingNoteId === item.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Check className="w-3 h-3" />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirmNoteId(null)}
                                        className="p-0.5 text-[#64748b] hover:bg-[#fee2e2] rounded cursor-pointer"
                                        title="Cancel"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingNoteId(item.id)
                                          setEditingNoteText(item.note)
                                          setDeleteConfirmNoteId(null)
                                        }}
                                        title="Edit note"
                                        className="p-1.5 rounded-[6px] text-[#94a3b8] hover:text-[#2563eb] hover:bg-[#eff6ff] transition-all cursor-pointer"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirmNoteId(item.id)}
                                        title="Delete note"
                                        className="p-1.5 rounded-[6px] text-[#94a3b8] hover:text-[#dc2626] hover:bg-[#fef2f2] transition-all cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#edf2f7] text-[11px] text-[#64748b]">
                                <span className="font-semibold text-[#475569]">
                                  {item.author_name || 'Placement Officer'}
                                </span>
                                <span className="text-[#94a3b8] font-medium">{item.created_at}</span>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : !showNoteEditor ? (
                    <div className="bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-[12px] p-3 text-center text-[#94a3b8] text-[12px] font-medium">
                      No recommendation note recorded in database yet
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Two-Metric Performance Algorithm Breakdown Table */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13.5px] font-bold text-[#172554] tracking-tight m-0">
                    Two-Metric Score Algorithm
                  </h3>
                  <span className="text-[11px] font-semibold text-[#2563eb] bg-[#eff6ff] px-2.5 py-0.5 rounded-full border border-[#bfdbfe]">
                    50% Att. + 50% Rounds
                  </span>
                </div>

                <div className="bg-white border border-[#dbe5f1] rounded-[16px] px-5 py-1 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col text-[13px]">
                  {/* Row 1: Eligible companies */}
                  <div className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9]">
                    <span className="font-medium text-[#475569]">Eligible companies</span>
                    <span className="font-bold text-[#172554]">{student.opportunity?.eligible_companies ?? 0}</span>
                  </div>

                  {/* Row 2: Companies attended */}
                  <div className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9]">
                    <span className="font-medium text-[#475569]">Companies attended</span>
                    <span className="font-bold text-[#172554]">{student.opportunity?.companies_attended ?? 0}</span>
                  </div>

                  {/* Row 3: Attendance percentage */}
                  <div className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9]">
                    <span className="font-medium text-[#475569]">Attendance %</span>
                    <span className="font-bold text-[#2563eb]">
                      {student.opportunity?.eligible_companies > 0 
                        ? `${Math.round(student.opportunity.attendance_percentage)}%` 
                        : 'Insufficient data'}
                    </span>
                  </div>

                  {/* Row 4: Total rounds attended */}
                  <div className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9]">
                    <span className="font-medium text-[#475569]">Total rounds attended</span>
                    <span className="font-bold text-[#172554]">{student.opportunity?.total_rounds_attended ?? 0}</span>
                  </div>

                  {/* Row 5: Rounds cleared */}
                  <div className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9]">
                    <span className="font-medium text-[#475569]">Rounds cleared</span>
                    <span className="font-bold text-[#172554]">{student.opportunity?.rounds_cleared ?? 0}</span>
                  </div>

                  {/* Row 6: Rounds cleared percentage */}
                  <div className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9]">
                    <span className="font-medium text-[#475569]">Rounds cleared %</span>
                    <span className="font-bold text-[#2563eb]">
                      {student.opportunity?.total_rounds_attended > 0
                        ? `${Math.round(student.opportunity.rounds_cleared_pct)}%`
                        : 'Insufficient data'}
                    </span>
                  </div>

                  {/* Row 7: Pending rounds (if any) */}
                  {student.opportunity?.pending_rounds > 0 && (
                    <div className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9]">
                      <span className="font-medium text-[#d97706]">Pending rounds</span>
                      <span className="font-bold text-[#d97706]">{student.opportunity.pending_rounds}</span>
                    </div>
                  )}

                  {/* Row 8: Opportunity score */}
                  <div className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9] bg-[#f8fafc] -mx-5 px-5">
                    <span className="font-bold text-[#0f172a]">Calculated Opportunity Score</span>
                    <span className="font-black text-[#1d4ed8] text-[15.5px]">
                      {Math.round(student.opportunity?.score ?? 0)} / 100
                    </span>
                  </div>

                  {/* Row 9: Category */}
                  <div className="flex items-center justify-between py-2.5 bg-[#f8fafc] -mx-5 px-5 rounded-b-[16px]">
                    <span className="font-bold text-[#0f172a]">Classification Category</span>
                    <span
                      className={`px-3 py-1 rounded-[8px] text-[12px] font-bold font-sans border tracking-tight ${getStatusBadgeStyle(
                        student.opportunity?.priority_level
                      )}`}
                    >
                      {formatStatusLabel(student.opportunity?.priority_level)}
                    </span>
                  </div>
                </div>

                {/* Threshold classification footnote */}
                <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-[12px] p-3 text-[11.5px] text-[#0369a1] leading-relaxed">
                  <span className="font-bold block mb-2 text-[#0369a1]">
                    Thresholds & Weaker-Metric Classification:
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold font-sans border bg-[#FCF2F2] border-[#F6CCCB] text-[#CA3A31] min-w-[52px] text-center shrink-0">
                        High
                      </span>
                      <span>Attendance &gt; 90% and Rounds cleared &gt; 60%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold font-sans border bg-[#FEFBED] border-[#F9E796] text-[#A85923] min-w-[52px] text-center shrink-0">
                        Mid
                      </span>
                      <span>Attendance &gt; 75% and Rounds cleared &gt; 40%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold font-sans border bg-[#F2FDF5] border-[#C7F5D3] text-[#4CA16D] min-w-[52px] text-center shrink-0">
                        Low
                      </span>
                      <span>Attendance &gt; 50% and Rounds cleared &gt; 25%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-bold font-sans border bg-[#FCF2F2] border-[#F6CCCB] text-[#CA3A31] text-center shrink-0">
                        Needs Improvement & Interest
                      </span>
                      <span>&le; 50% attendance or &le; 25% rounds cleared</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-[#0284c7] italic border-t border-[#bae6fd]/60 pt-1.5">
                    * The weaker of the two metric categories determines the final student category.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Activity History */}
          {activeTab === 'Activity History' && (
            <div className="flex flex-col gap-4 mt-4">
              {/* 1. Timeline: Recent Company Recruitment History (On Top) */}
              <div className="bg-white border border-[#dbe5f1] rounded-[16px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#f1f5f9]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#3b82f6]" />
                    <h4 className="text-[13.5px] font-bold text-[#1e293b] tracking-tight">
                      Recent Company Recruitment History
                    </h4>
                  </div>
                  {historyData && historyData.total_count > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                      {historyData.total_count} total
                    </span>
                  )}
                </div>

                {/* Body */}
                {historyLoading && !historyData ? (
                  <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#3b82f6] mb-2" />
                    <span className="text-[12px]">Loading recruitment history...</span>
                  </div>
                ) : historyError ? (
                  <div className="p-3 text-[12px] bg-red-50 text-red-600 rounded-lg text-center">
                    {historyError}
                  </div>
                ) : historyData?.items?.length === 0 ? (
                  <div className="py-6 text-center text-[#94a3b8]">
                    <p className="text-[12.5px] font-medium text-[#64748b]">No recruitment history found</p>
                    <p className="text-[11.5px] text-[#94a3b8] mt-1">This student has not participated in any placement drives yet.</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col">
                    {historyData?.items?.map((item, idx) => {
                      let dotBg = 'bg-[#CC7C2E]' // In Process (Orange)

                      if (item.status === 'Offered') {
                        dotBg = 'bg-[#4CA154]' // Offered (Green)
                      } else if (item.status === 'Failed / Cancelled') {
                        dotBg = 'bg-[#CA3A31]' // Failed / Cancelled (Red)
                      }

                      const isLast = idx === (historyData.items.length - 1)

                      return (
                        <div key={item.drive_id || idx} className="relative flex items-stretch gap-3 group">
                          {/* Timeline column with Dot and perfectly centered vertical connecting line */}
                          <div className="flex flex-col items-center flex-shrink-0 w-[20px]">
                            {/* Dot with halo ring */}
                            <div className="w-[20px] h-[20px] flex items-center justify-center flex-shrink-0">
                              <div className={`w-[11px] h-[11px] rounded-full ring-[3.5px] ring-[#DEE9FC] ${dotBg}`} />
                            </div>

                            {/* Connecting Line to next item - perfectly centered under the dot */}
                            {!isLast && (
                              <div className="w-[2px] bg-[#DEE9FC] flex-1 my-1" />
                            )}
                          </div>

                          {/* Company & Round details */}
                          <div className={`flex-1 min-w-0 ${!isLast ? 'pb-5' : 'pb-1'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-[14px] font-bold text-[#1e293b] truncate leading-tight">
                                {item.company_name}
                              </h5>
                              {item.job_role && (
                                <span className="text-[10.5px] text-[#94a3b8] font-medium truncate max-w-[120px]">
                                  {item.job_role}
                                </span>
                              )}
                            </div>

                            <div className="text-[12.5px] text-[#64748b] font-medium leading-relaxed mt-0.5">
                              {item.round_detail_text}
                            </div>

                            {item.date_formatted && (
                              <div className="text-[10.5px] text-[#94a3b8] mt-0.5">
                                {item.date_formatted}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                    {/* Pagination Controls */}
                    {historyData && historyData.total_pages > 1 && (
                      <div className="mt-6 pt-3.5 border-t border-[#f1f5f9] flex items-center justify-between">
                        <span className="text-[11.5px] text-[#64748b] font-medium">
                          Page <span className="font-bold text-[#1e293b]">{historyData.current_page}</span> of{' '}
                          <span className="font-bold text-[#1e293b]">{historyData.total_pages}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={historyData.current_page <= 1 || historyLoading}
                            onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 text-[11.5px] font-medium rounded-[7px] border border-[#dbe5f1] text-[#475569] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Prev
                          </button>
                          <button
                            type="button"
                            disabled={historyData.current_page >= historyData.total_pages || historyLoading}
                            onClick={() => setHistoryPage((p) => Math.min(historyData.total_pages, p + 1))}
                            className="px-2.5 py-1 text-[11.5px] font-medium rounded-[7px] border border-[#dbe5f1] text-[#475569] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                          >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Search Bar for Attended Companies (Down) */}
              <div className="relative mt-1">
                <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search attended companies or roles..."
                  className="w-full pl-9 pr-3.5 py-2 text-[12.5px] bg-white border border-[#dbe5f1] rounded-[10px] focus:outline-none focus:border-[#3b82f6] text-[#1e293b] placeholder-[#94a3b8] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors"
                />
              </div>

              {/* 3. Company-wise Recruitment Processes Section (Down) */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[14.5px] font-bold text-[#1e293b] tracking-tight">
                    Company-wise recruitment processes
                  </h4>
                  {processes && processes.length > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                      {processes.length} attended
                    </span>
                  )}
                </div>

                {processesLoading && processes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8] bg-white border border-[#e2e8f0] rounded-[16px]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#3b82f6] mb-2" />
                    <span className="text-[12px]">Loading recruitment processes...</span>
                  </div>
                ) : processesError ? (
                  <div className="p-3 text-[12px] bg-red-50 text-red-600 rounded-[12px] text-center border border-red-100">
                    {processesError}
                  </div>
                ) : processes.length === 0 ? (
                  <div className="py-8 text-center text-[#94a3b8] bg-white border border-[#e2e8f0] rounded-[16px] p-5">
                    <p className="text-[13px] font-medium text-[#64748b]">No attended companies found</p>
                    <p className="text-[11.5px] text-[#94a3b8] mt-1">
                      {searchQuery
                        ? `No results matching "${searchQuery}"`
                        : 'This student has not attended any recruitment processes yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {processes.map((proc, pIdx) => (
                      <div
                        key={proc.drive_id || pIdx}
                        className="bg-white border border-[#e2e8f0] rounded-[16px] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col gap-3 transition-shadow hover:shadow-[0_2px_6px_rgba(15,23,42,0.06)]"
                      >
                        {/* Card Header: Company, Role · Package, and Overall Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[16px] font-bold text-[#0f172a] leading-tight truncate">
                              {proc.company_name}
                            </h4>
                            <p className="text-[13px] text-[#64748b] font-medium mt-0.5 truncate">
                              {proc.job_role}
                              {proc.package_lpa != null && proc.package_lpa > 0 && ` · ${proc.package_lpa} LPA`}
                            </p>
                          </div>

                          {/* Overall Status: Offered (Green), Ongoing (Orange), or Failed (Red) */}
                          <span
                            className={`text-[13px] font-bold shrink-0 ${
                              proc.overall_status === 'Offered'
                                ? 'text-[#2e7d32]'
                                : proc.overall_status === 'Ongoing' || proc.overall_status === 'In Process'
                                ? 'text-[#d97706]'
                                : 'text-[#b91c1c]'
                            }`}
                          >
                            {proc.status_text}
                          </span>
                        </div>

                        {/* Card Body: All recruitment stages attended in sequence */}
                        {proc.rounds && proc.rounds.length > 0 && (
                          <div className="border-t border-[#f1f5f9] pt-2.5 flex flex-col gap-2">
                            {proc.rounds.map((round, rIdx) => (
                              <div key={rIdx} className="flex items-center gap-2.5">
                                {/* Visual Indicator: Green check or Red cross */}
                                {round.is_cleared ? (
                                  <div className="w-[22px] h-[22px] rounded-full bg-[#EBF8EE] flex items-center justify-center shrink-0">
                                    <Check className="w-3.5 h-3.5 text-[#2E7D32] stroke-[2.5]" />
                                  </div>
                                ) : (
                                  <div className="w-[22px] h-[22px] rounded-full bg-[#FCE8E6] flex items-center justify-center shrink-0">
                                    <X className="w-3.5 h-3.5 text-[#EA4335] stroke-[2.5]" />
                                  </div>
                                )}

                                {/* Round Name */}
                                <span className="text-[13px] text-[#334155] font-normal">
                                  Round {round.round_index}: {round.round_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </aside>
  )
}
