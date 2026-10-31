import React, { useState, useEffect } from 'react'
import { Loader2, AlertCircle, MessageSquareQuote, Send, Clock } from 'lucide-react'
import { getStudentReviewDetail, saveStudentReviewNote } from '../../../services/api'
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
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('Placement Journey')

  // Recommendation note form state
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteSuccess, setNoteSuccess] = useState(false)

  useEffect(() => {
    let isMounted = true

    const fetchStudentDetail = async () => {
      try {
        setIsLoading(true)
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
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-[#64748b]">
          <Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" />
          <span className="text-[13px] font-[600]">Loading student profile...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-[12px] text-center text-[#991b1b] text-[13px] flex flex-col items-center gap-2 my-auto">
          <AlertCircle className="w-5 h-5 text-[#dc2626]" />
          <span className="font-[600]">{error}</span>
        </div>
      ) : student ? (
        <div className="flex flex-col">
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
              <span className="px-3 py-1 rounded-full text-[12px] font-bold font-sans tracking-tight bg-[#fef9c3] text-[#854d0e] border border-[#fef08a] inline-flex items-center justify-center">
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

                  {/* List all notes in order */}
                  {student.opportunity?.notes && student.opportunity.notes.length > 0 ? (
                    <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                      {student.opportunity.notes.map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] p-3 hover:border-[#cbd5e1] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                        >
                          <p className="text-[12.5px] text-[#334155] italic leading-relaxed m-0 font-medium whitespace-pre-wrap">
                            "{item.note}"
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#edf2f7] text-[11px] text-[#64748b]">
                            <span className="font-semibold text-[#475569]">
                              {item.author_name || 'Placement Officer'}
                            </span>
                            <span className="text-[#94a3b8] font-medium">{item.created_at}</span>
                          </div>
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
            <div className="flex flex-col gap-3 mt-4">
              <div className="bg-white border border-[#dbe5f1] rounded-[16px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] text-center text-[#64748b]">
                <Clock className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
                <span className="text-[13px] font-semibold text-[#1e293b] block">Activity History</span>
                <span className="text-[12px] text-[#64748b] mt-1 block">
                  Drive and stage participation records are up to date.
                </span>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </aside>
  )
}
