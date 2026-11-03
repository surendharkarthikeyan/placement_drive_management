import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  UserMinus,
  Lock,
  ArrowRight,
  RefreshCw,
  X
} from 'lucide-react'
import { getDriveStudents, updateDriveStudentsRoster, confirmDriveStudentsRoster } from '../../../services/api'

export default function DriveStudentsRoster({
  driveId,
  eligibility,
  isDriveCompleted = false,
  officerUserId = null,
  isRosterConfirmed = false,
  onDriveUpdated = () => {},
  onNavigateToStages = () => {},
  onOpenFilterModal = () => {},
  onConfigureCriteria = () => {}
}) {
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('included') // default to 'included' to show only drive roster students initially
  const [isConfirmed, setIsConfirmed] = useState(isRosterConfirmed)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmFeedback, setConfirmFeedback] = useState(null)

  useEffect(() => {
    setIsConfirmed(isRosterConfirmed)
  }, [isRosterConfirmed])

  const fetchStudents = async () => {
    if (!driveId) return
    try {
      setIsLoading(true)
      const data = await getDriveStudents(driveId)
      setStudents(data || [])
    } catch (err) {
      console.error('Failed to load drive students:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle batch excluding selected students
  const handleExcludeSelected = async () => {
    if (selectedIds.size === 0 || !driveId) return
    try {
      setIsUpdatingStatus(true)
      const updates = Array.from(selectedIds).map((userId) => ({
        user_id: userId,
        drive_status: 'excluded'
      }))
      await updateDriveStudentsRoster(driveId, updates)
      // Refetch fresh data from database
      const data = await getDriveStudents(driveId)
      setStudents(data || [])
      setSelectedIds(new Set())
    } catch (err) {
      console.error('Failed to exclude students:', err)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Handle confirming the student roster to advance students into Stage 1
  const handleConfirmRoster = async () => {
    if (!driveId) return
    try {
      setIsConfirming(true)
      const res = await confirmDriveStudentsRoster(driveId, officerUserId)
      setIsConfirmed(true)
      setIsConfirmModalOpen(false)
      setConfirmFeedback({
        type: 'success',
        message: res.message || 'Student list confirmed successfully! Candidates have moved to Stage 1.'
      })
      await fetchStudents()
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to confirm student roster:', err)
      setConfirmFeedback({
        type: 'error',
        message: err.message || 'Failed to confirm student list'
      })
    } finally {
      setIsConfirming(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [driveId])

  // Extract short department code (e.g. "Computer Science and Engineering" -> "CSE")
  const getDeptShortCode = (deptName) => {
    if (!deptName) return 'ENGG'
    const lower = deptName.toLowerCase()
    if (lower.includes('computer science')) return 'CSE'
    if (lower.includes('information tech')) return 'IT'
    if (lower.includes('electronics and comm')) return 'ECE'
    if (lower.includes('electrical')) return 'EEE'
    if (lower.includes('mechanical')) return 'MECH'
    if (lower.includes('civil')) return 'CIVIL'
    // Fallback: take initials
    return deptName
      .split(' ')
      .filter((w) => w.length > 2)
      .map((w) => w[0].toUpperCase())
      .join('')
  }

  // Generate roll / reg number format (prefer DB roll_no, otherwise fallback)
  const getRegNumber = (student) => {
    if (student.roll_no && String(student.roll_no).trim()) return student.roll_no
    const yearPrefix = student.batch_name ? student.batch_name.substring(2, 4) : '22'
    const dept = getDeptShortCode(student.department_name)
    const padId = String(student.user_id + 1000).padStart(4, '0')
    return `${yearPrefix}${dept}${padId}`
  }

  // Get initials (e.g. "Aarav Krishnan" -> "AK")
  const getInitials = (name) => {
    if (!name) return 'ST'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Students associated with this drive's roster (all students with an active roster record or initially eligible)
  const rosterStudents = useMemo(() => {
    return students.filter((s) => s.drive_status === 'included' || s.drive_status === 'special_entry' || s.drive_status === 'excluded')
  }, [students])

  // Core metrics strictly based on roster records
  const allCandidatesCount = rosterStudents.length // count of students in the drive student roster (eligible criteria students + special entry + excluded)
  const totalRosterCount = rosterStudents.length
  const includedCount = rosterStudents.filter((s) => s.drive_status === 'included').length
  const specialEntryCount = rosterStudents.filter((s) => s.drive_status === 'special_entry').length
  const excludedCount = rosterStudents.filter((s) => s.drive_status === 'excluded').length

  // Filtered students based on search term and selected status tab
  const filteredStudents = useMemo(() => {
    return rosterStudents.filter((st) => {
      // 1. Status Filter:
      if (statusFilter === 'included') {
        if (st.drive_status !== 'included') return false
      } else if (statusFilter === 'excluded') {
        if (st.drive_status !== 'excluded') return false
      } else if (statusFilter === 'special_entry') {
        if (st.drive_status !== 'special_entry') return false
      }
      // 'all' shows all roster students (included, special_entry, and excluded)

      // 2. Search Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const nameMatch = st.name?.toLowerCase().includes(query)
        const emailMatch = st.email?.toLowerCase().includes(query)
        const deptMatch = st.department_name?.toLowerCase().includes(query)
        const regMatch = getRegNumber(st).toLowerCase().includes(query)
        if (!nameMatch && !emailMatch && !deptMatch && !regMatch) return false
      }

      return true
    })
  }, [rosterStudents, statusFilter, searchTerm])

  // Department-wise distribution among students in roster (grouped by department)
  const deptMap = {}
  rosterStudents.forEach((s) => {
    const code = getDeptShortCode(s.department_name)
    deptMap[code] = (deptMap[code] || 0) + 1
  })

  // Select all toggle for current filtered view
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredStudents.map((s) => s.user_id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const toggleStudent = (userId) => {
    const next = new Set(selectedIds)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    setSelectedIds(next)
  }

  // Generate dynamic eligibility condition tags strictly from what was set in eligibility criteria
  const renderEligibilityFilterTags = () => {
    if (!eligibility) return []
    const tags = []

    // Min CGPA
    if (eligibility.min_cgpa !== null && eligibility.min_cgpa !== undefined && eligibility.min_cgpa !== '') {
      tags.push(`CGPA ≥ ${eligibility.min_cgpa}`)
    }

    // Min 10th mark
    if (eligibility.min_tenth_mark !== null && eligibility.min_tenth_mark !== undefined && eligibility.min_tenth_mark !== '') {
      tags.push(`10th ≥ ${eligibility.min_tenth_mark}%`)
    }

    // Min 12th mark
    if (eligibility.min_twelfth_mark !== null && eligibility.min_twelfth_mark !== undefined && eligibility.min_twelfth_mark !== '') {
      tags.push(`12th ≥ ${eligibility.min_twelfth_mark}%`)
    }

    // Current Arrears
    if (eligibility.max_current_arrears !== null && eligibility.max_current_arrears !== undefined) {
      if (Number(eligibility.max_current_arrears) === 0) {
        tags.push('No Current Arrears')
      } else {
        tags.push(`Max ${eligibility.max_current_arrears} Current Arrear(s)`)
      }
    }

    // History Arrears
    if (eligibility.max_history_arrears !== null && eligibility.max_history_arrears !== undefined) {
      if (Number(eligibility.max_history_arrears) === 0) {
        tags.push('No History Arrears')
      } else {
        tags.push(`Max ${eligibility.max_history_arrears} History Arrear(s)`)
      }
    }

    // Offer cap
    if (eligibility.max_existing_offer_lpa !== null && eligibility.max_existing_offer_lpa !== undefined && eligibility.max_existing_offer_lpa !== '') {
      tags.push(`Offer Cap ≤ ${eligibility.max_existing_offer_lpa} LPA`)
    }

    return tags
  }

  if (isLoading) {
    return (
      <div className="p-12 bg-white border border-[#dbe5f1] rounded-[16px] flex flex-col items-center justify-center gap-3 text-[#64748b]">
        <Loader2 size={26} className="animate-spin text-[#2563eb]" />
        <span className="text-[14.5px] font-[600]">Loading drive student list...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {isDriveCompleted && (
        <div className="flex items-center gap-2.5 p-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] text-[#475569] text-[13px] font-medium shadow-2xs">
          <Lock size={16} className="text-[#64748b] shrink-0" />
          <span>
            This placement drive is marked as completed. Student roster and inclusion statuses are finalized and locked.
          </span>
        </div>
      )}

      {/* 1. Top Bar: "Students Included in this Drive" + Action buttons */}
      <div className="p-[14px_18px] bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-[850] text-[#172554] m-0 leading-tight">
            Students Included in this Drive
          </h2>
          <p className="text-[13px] text-[#64748b] mt-[3px] mb-0 font-medium">
            {includedCount} students currently included {specialEntryCount > 0 && `• ${specialEntryCount} special entry`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!isDriveCompleted && (
            <button
              type="button"
              onClick={onOpenFilterModal}
              className="py-[9px] px-[16px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[9px] text-[13.5px] font-[750] shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              <Plus size={16} strokeWidth={2.8} />
              <span>Filter and Add Students</span>
            </button>
          )}

          {!isDriveCompleted && (
            isConfirmed ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 py-[9px] px-[14px] bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] rounded-[9px] text-[13.5px] font-[750] shadow-2xs">
                  <CheckCircle2 size={16} className="text-[#059669]" />
                  <span>Student List Confirmed</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(true)}
                  disabled={isConfirming}
                  title="Re-sync roster candidates to Stage 1"
                  className="py-[9px] px-[12px] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] text-[#334155] rounded-[9px] text-[13px] font-[700] shadow-2xs transition cursor-pointer flex items-center gap-1.5 active:scale-98"
                >
                  <RefreshCw size={14} className={isConfirming ? "animate-spin text-[#2563eb]" : "text-[#64748b]"} />
                  <span>Sync to Stage 1</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={isConfirming || (includedCount === 0 && specialEntryCount === 0)}
                className="py-[9px] px-[16px] bg-[#059669] hover:bg-[#047857] text-white rounded-[9px] text-[13.5px] font-[750] shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1.5 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} strokeWidth={2.6} />
                )}
                <span>Confirm Student List</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Confirmation Feedback Toast/Banner */}
      {confirmFeedback && (
        <div
          className={`p-3.5 rounded-[12px] border text-[13px] font-medium flex items-center justify-between gap-3 ${
            confirmFeedback.type === 'success'
              ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]'
              : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
          }`}
        >
          <div className="flex items-center gap-2">
            {confirmFeedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-[#059669] shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-[#dc2626] shrink-0" />
            )}
            <span>{confirmFeedback.message}</span>
            {confirmFeedback.type === 'success' && (
              <button
                type="button"
                onClick={onNavigateToStages}
                className="ml-2 font-[750] underline hover:text-[#047857] cursor-pointer inline-flex items-center gap-1"
              >
                <span>View in Stage 1</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setConfirmFeedback(null)}
            className="text-[#64748b] hover:text-[#1e293b] cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 2. Filter / Criteria Tags Row (strictly from what is configured in eligibility criteria) */}
      {renderEligibilityFilterTags().length > 0 && (
        <div className="flex flex-wrap items-center gap-[7px]">
          {renderEligibilityFilterTags().map((tag, idx) => (
            <span
              key={idx}
              className="py-[5px] px-[12px] rounded-full text-[12px] font-[700] text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe] shadow-2xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 3. Summary Cards: All Candidates, Total Included, Excluded, Special Entry, and Department-wise Cards (Scrollable) */}
      <div className="flex items-stretch gap-[14px] overflow-x-auto pb-2 pt-1 scrollbar-thin">
        {/* 1. Total Count */}
        <div className="min-w-[170px] flex-1 shrink-0 p-[18px_20px] text-center bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs">
          <strong className="block text-[28px] font-[850] text-[#172554] leading-none">
            {allCandidatesCount}
          </strong>
          <span className="text-[12.5px] font-[600] text-[#64748b] mt-[8px] block whitespace-nowrap">
            Total count
          </span>
        </div>

        {/* 2. Total Included */}
        <div className="min-w-[170px] flex-1 shrink-0 p-[18px_20px] text-center bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs">
          <strong className="block text-[28px] font-[850] text-[#172554] leading-none">
            {includedCount}
          </strong>
          <span className="text-[12.5px] font-[600] text-[#64748b] mt-[8px] block">
            Total included
          </span>
        </div>

        {/* 3. Excluded Count */}
        <div className="min-w-[170px] flex-1 shrink-0 p-[18px_20px] text-center bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs">
          <strong className="block text-[28px] font-[850] text-[#172554] leading-none">
            {excludedCount}
          </strong>
          <span className="text-[12.5px] font-[600] text-[#64748b] mt-[8px] block">
            Excluded
          </span>
        </div>

        {/* 4. Special Entry */}
        <div className="min-w-[170px] flex-1 shrink-0 p-[18px_20px] text-center bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs">
          <strong className="block text-[28px] font-[850] text-[#172554] leading-none">
            {specialEntryCount}
          </strong>
          <span className="text-[12.5px] font-[600] text-[#64748b] mt-[8px] block">
            Special entry
          </span>
        </div>

        {/* Dynamic Department-Wise Cards */}
        {Object.entries(deptMap).map(([deptCode, count]) => (
          <div
            key={deptCode}
            className="min-w-[170px] flex-1 shrink-0 p-[18px_20px] text-center bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs"
          >
            <strong className="block text-[28px] font-[850] text-[#172554] leading-none">
              {count}
            </strong>
            <span className="text-[12.5px] font-[600] text-[#64748b] mt-[8px] block">
              {deptCode} students
            </span>
          </div>
        ))}
      </div>

      {/* 4. Filter & Search Controls Bar matching user design */}
      <div className="p-[12px_16px] bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search input with search icon */}
        <div className="relative flex-1 min-w-[260px] max-w-[420px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name, email, department..."
            className="w-full pl-9 pr-3 py-[7.5px] bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[9px] text-[13px] text-[#1e293b] placeholder-[#94a3b8] outline-none transition"
          />
        </div>

        {/* Tab Filter Options: All, Included, Excluded, Special Entry + Exclude Button */}
        <div className="flex items-center gap-2">
          {/* Exclude Selected button visible by default (enabled when students are selected and not completed) */}
          {!isDriveCompleted && (
            <button
              type="button"
              onClick={handleExcludeSelected}
              disabled={selectedIds.size === 0 || isUpdatingStatus}
              className={`py-[6px] px-[14px] rounded-[8px] text-[12.5px] font-[750] shadow-2xs transition flex items-center gap-1.5 ${
                selectedIds.size > 0 && !isUpdatingStatus
                  ? 'bg-[#fef2f2] hover:bg-[#fee2e2] text-[#b91c1c] border border-[#fecaca] cursor-pointer hover:shadow-xs active:scale-98'
                  : 'bg-[#f8fafc] text-[#94a3b8] border border-[#e2e8f0] cursor-not-allowed opacity-75'
              }`}
            >
              {isUpdatingStatus ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <UserMinus size={15} strokeWidth={2.4} />
              )}
              <span>Exclude Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 p-1 bg-[#f1f5f9] rounded-[10px] border border-[#e2e8f0]/80">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`py-[5px] px-[12px] rounded-[7px] text-[12.5px] font-[750] transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-[#2563eb] shadow-2xs'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              All ({totalRosterCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('included')}
              className={`py-[5px] px-[12px] rounded-[7px] text-[12.5px] font-[750] transition cursor-pointer ${
                statusFilter === 'included'
                  ? 'bg-white text-[#2563eb] shadow-2xs'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              Included ({includedCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('excluded')}
              className={`py-[5px] px-[12px] rounded-[7px] text-[12.5px] font-[750] transition cursor-pointer ${
                statusFilter === 'excluded'
                  ? 'bg-white text-[#2563eb] shadow-2xs'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              Excluded ({excludedCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('special_entry')}
              className={`py-[5px] px-[12px] rounded-[7px] text-[12.5px] font-[750] transition cursor-pointer ${
                statusFilter === 'special_entry'
                  ? 'bg-white text-[#b45309] shadow-2xs'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              Spl Entry ({specialEntryCount})
            </button>
          </div>
        </div>
      </div>

      {/* 5. Student Table Card matching template design */}
      <div className="bg-white border border-[#dbe5f1] rounded-[14px] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[12px] font-[800] text-[#64748b] uppercase tracking-[0.35px]">
                <th className="py-3 px-4 w-[48px]">
                  <input
                    type="checkbox"
                    disabled={isDriveCompleted}
                    checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                    onChange={handleSelectAll}
                    className={`w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 ${
                      isDriveCompleted ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  />
                </th>
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Department &amp; Batch</th>
                <th className="py-3 px-4">CGPA</th>
                <th className="py-3 px-4">10th / 12th %</th>
                <th className="py-3 px-4">Arrears (Curr / Hist)</th>
                <th className="py-3 px-4 text-center">Eligibility Status</th>
                <th className="py-3 px-4 text-center">Roster Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7]">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748b] text-[14px]">
                    No students match the current filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const isSelected = selectedIds.has(st.user_id)
                  const deptShort = getDeptShortCode(st.department_name)
                  const regNo = getRegNumber(st)
                  const avatarInitials = getInitials(st.name)

                  return (
                    <tr
                      key={st.user_id}
                      className={`hover:bg-[#fbfdff] transition ${
                        isSelected ? 'bg-[#eff6ff]/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          disabled={isDriveCompleted}
                          checked={isSelected}
                          onChange={() => !isDriveCompleted && toggleStudent(st.user_id)}
                          className={`w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 ${
                            isDriveCompleted ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </td>

                      {/* Candidate: Avatar, Name, Reg Number, Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-[34px] h-[34px] rounded-[9px] bg-[#dbeafe] text-[#2563eb] font-[850] text-[12px] flex items-center justify-center shrink-0">
                            {avatarInitials}
                          </div>
                          <div>
                            <div className="text-[14px] font-[800] text-[#1e293b] leading-snug">
                              {st.name}
                            </div>
                            <div className="text-[12px] text-[#94a3b8] font-medium leading-tight mt-0.5">
                              {regNo} {st.email ? `• ${st.email}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department & Batch */}
                      <td className="py-3.5 px-4">
                        <div className="text-[13.5px] font-[700] text-[#334155]">
                          {deptShort}
                        </div>
                        <div className="text-[12px] text-[#64748b] font-medium">
                          {st.batch_name || 'Batch'}
                        </div>
                      </td>

                      {/* CGPA */}
                      <td className="py-3.5 px-4 text-[13.5px] font-[750] text-[#1e293b]">
                        {st.cgpa !== null && st.cgpa !== undefined ? Number(st.cgpa).toFixed(2) : '—'}
                      </td>

                      {/* 10th / 12th % */}
                      <td className="py-3.5 px-4 text-[13px] font-[600] text-[#475569]">
                        {st.tenth_mark !== null && st.tenth_mark !== undefined ? `${st.tenth_mark}%` : '—'} / {st.twelfth_mark !== null && st.twelfth_mark !== undefined ? `${st.twelfth_mark}%` : '—'}
                      </td>

                      {/* Arrears (Curr / Hist) */}
                      <td className="py-3.5 px-4 text-[13px] font-[600] text-[#475569]">
                        {st.current_arrear_count ?? 0} / {st.history_arrear_count ?? 0}
                      </td>

                      {/* Eligibility Status */}
                      <td className="py-3.5 px-4 text-center">
                        {st.is_eligible ? (
                          <span className="inline-flex items-center gap-1 py-[3px] px-[10px] rounded-full text-[11.5px] font-[750] text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0]">
                            Eligible
                          </span>
                        ) : (
                          <span
                            title={st.ineligible_reasons?.join(', ')}
                            className="inline-flex items-center gap-1 py-[3px] px-[10px] rounded-full text-[11.5px] font-[750] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] cursor-help"
                          >
                            Ineligible
                          </span>
                        )}
                      </td>

                      {/* Roster Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {st.drive_status === 'special_entry' ? (
                          <span className="inline-flex items-center gap-1 py-[4px] px-[12px] rounded-full text-[12px] font-[800] text-[#b45309] bg-[#fefce8] border border-[#fde68a]">
                            Special Entry
                          </span>
                        ) : st.is_included_in_drive && st.drive_status !== 'excluded' ? (
                          <span className="inline-block py-[4px] px-[12px] rounded-full text-[12px] font-[750] text-[#2563eb] bg-[#eff6ff] border border-[#bfdbfe]">
                            Included
                          </span>
                        ) : (
                          <span className="inline-block py-[4px] px-[12px] rounded-full text-[12px] font-[700] text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0]">
                            Excluded
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-[16px] shadow-2xl border border-[#cbd5e1] max-w-[480px] w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ecfdf5] text-[#059669] flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 className="text-[17px] font-[800] text-[#0f172a] m-0">
                  {isConfirmed ? 'Sync Student List to Stage 1' : 'Confirm Student List'}
                </h3>
                <p className="text-[13px] text-[#64748b] mt-1 m-0">
                  Advance eligible and special entry candidates into recruitment Stage 1.
                </p>
              </div>
            </div>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] p-3.5 text-[13px] text-[#334155] mb-5 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#64748b]">Total candidates to move:</span>
                <span className="font-[750] text-[#0f172a]">{includedCount + specialEntryCount} students</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Included candidates:</span>
                <span className="font-semibold text-[#0f172a]">{includedCount}</span>
              </div>
              {specialEntryCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Special entry candidates:</span>
                  <span className="font-semibold text-[#0f172a]">{specialEntryCount}</span>
                </div>
              )}
              {excludedCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Excluded candidates:</span>
                  <span className="font-semibold text-[#94a3b8]">{excludedCount} (will not move)</span>
                </div>
              )}
              <div className="border-t border-[#e2e8f0] pt-2 text-[12px] text-[#64748b] leading-relaxed">
                Before confirmation, no students appear in Stage 1. Confirming will initialize their outcome as <span className="font-semibold text-[#0f172a]">Pending</span> in Stage 1.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 text-[13px] font-[700] text-[#475569] hover:bg-[#f1f5f9] rounded-[8px] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleConfirmRoster}
                className="px-5 py-2 text-[13px] font-[750] text-white bg-[#059669] hover:bg-[#047857] rounded-[8px] shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1.5 active:scale-98"
              >
                {isConfirming && <Loader2 size={15} className="animate-spin" />}
                <span>{isConfirmed ? 'Confirm & Sync to Stage 1' : 'Confirm & Move to Stage 1'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
