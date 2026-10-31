import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, Check, AlertCircle, Loader2, Sparkles, UserMinus, UserCheck } from 'lucide-react'
import { getDriveStudents, updateDriveStudentsRoster, getBatches } from '../../../services/api'
import CustomSelect from '../../common/CustomSelect'

/**
 * FilterAndIncludeStudentsModal
 * - Filters:
 *   1. Minimum CGPA
 *   2. Minimum 10th Mark (%)
 *   3. Minimum 12th / Diploma Mark (%)
 *   4. Max Current Standing Arrears
 *   5. Max History Arrears
 *   6. Maximum Existing Offer Cap (LPA)
 *   7. Academic Batch Filter
 * - Live Search Bar: Search by name and roll_no
 * - Action buttons:
 *   - "Exclude Selected": marks selected students as 'excluded'
 *   - "Add / Include Selected": marks selected students as 'special_entry' (or 'included' if eligible)
 */
export default function FilterAndIncludeStudentsModal({
  isOpen = false,
  onClose = () => {},
  driveId = null,
  eligibility = null,
  onRosterUpdated = () => {}
}) {
  const [students, setStudents] = useState([])
  const [batches, setBatches] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Requested Filter fields
  const [minCgpaFilter, setMinCgpaFilter] = useState('')
  const [minTenthFilter, setMinTenthFilter] = useState('')
  const [minTwelfthFilter, setMinTwelfthFilter] = useState('')
  const [maxCurrentArrearsFilter, setMaxCurrentArrearsFilter] = useState('no_restriction')
  const [maxHistoryArrearsFilter, setMaxHistoryArrearsFilter] = useState('no_restriction')
  const [maxExistingOfferFilter, setMaxExistingOfferFilter] = useState('')
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('all')

  // Search input: by student name or roll_no
  const [searchQuery, setSearchQuery] = useState('')

  // Selection state: Map of userId -> drive_status ('included', 'special_entry', or 'excluded')
  const [selectedMap, setSelectedMap] = useState({})
  // Checked row IDs for batch actions
  const [checkedIds, setCheckedIds] = useState(new Set())

  // Load students for drive
  const loadStudents = async () => {
    if (!driveId) return
    try {
      setIsLoading(true)
      setErrorMessage('')
      const data = await getDriveStudents(driveId)
      setStudents(data || [])

      // Current state from DB:
      // Only students who are in the drive roster or eligible get an active status
      const initialMap = {}
      ;(data || []).forEach((st) => {
        if (st.has_roster_record) {
          initialMap[st.user_id] = st.drive_status // 'included', 'special_entry', or 'excluded'
        } else if (st.is_eligible) {
          initialMap[st.user_id] = 'included'
        } else {
          initialMap[st.user_id] = '' // Not in roster
        }
      })
      setSelectedMap(initialMap)
      setCheckedIds(new Set())
    } catch (err) {
      console.error('Failed to load students:', err)
      setErrorMessage('Failed to load student candidates')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadStudents()
      // Load batches list for filter
      getBatches().then((b) => setBatches(b || [])).catch(() => {})
      // Keep criteria inputs clean so all students are visible in the modal list
      setMinCgpaFilter('')
      setMinTenthFilter('')
      setMinTwelfthFilter('')
      setMaxCurrentArrearsFilter('no_restriction')
      setMaxHistoryArrearsFilter('no_restriction')
      setMaxExistingOfferFilter('')
      setSelectedBatchFilter('all')
      setSearchQuery('')
    }
  }, [isOpen, driveId])

  if (!isOpen) return null

  // Helpers
  const getDeptShort = (dept) => {
    if (!dept) return 'ENGG'
    const lower = dept.toLowerCase()
    if (lower.includes('computer science')) return 'CSE'
    if (lower.includes('information tech')) return 'IT'
    if (lower.includes('electronics and comm')) return 'ECE'
    if (lower.includes('electrical')) return 'EEE'
    if (lower.includes('mech')) return 'MECH'
    return dept.substring(0, 3).toUpperCase()
  }

  const getDisplayRollNo = (st) => {
    if (st.roll_no && String(st.roll_no).trim()) return st.roll_no
    const yr = st.batch_name ? st.batch_name.substring(2, 4) : '22'
    const d = getDeptShort(st.department_name)
    const num = String(st.user_id + 1000).padStart(4, '0')
    return `${yr}${d}${num}`
  }

  const getInitials = (name) => {
    if (!name) return 'ST'
    const p = name.trim().split(' ')
    if (p.length === 1) return p[0].substring(0, 2).toUpperCase()
    return (p[0][0] + p[p.length - 1][0]).toUpperCase()
  }

  // Filter logic across candidate pool
  const filteredCandidates = students.filter((st) => {
    // 1. Minimum CGPA
    if (minCgpaFilter && !isNaN(parseFloat(minCgpaFilter))) {
      const targetCgpa = parseFloat(minCgpaFilter)
      if (st.cgpa === null || st.cgpa === undefined || st.cgpa < targetCgpa) return false
    }

    // 2. Minimum 10th %
    if (minTenthFilter && !isNaN(parseFloat(minTenthFilter))) {
      const targetTenth = parseFloat(minTenthFilter)
      if (st.tenth_mark === null || st.tenth_mark === undefined || st.tenth_mark < targetTenth) return false
    }

    // 3. Minimum 12th %
    if (minTwelfthFilter && !isNaN(parseFloat(minTwelfthFilter))) {
      const targetTwelfth = parseFloat(minTwelfthFilter)
      if (st.twelfth_mark === null || st.twelfth_mark === undefined || st.twelfth_mark < targetTwelfth) return false
    }

    // 4. Max Current Standing Arrears
    if (maxCurrentArrearsFilter !== 'no_restriction') {
      const maxArr = parseInt(maxCurrentArrearsFilter, 10)
      if (st.current_arrear_count > maxArr) return false
    }

    // 5. Max History Arrears
    if (maxHistoryArrearsFilter !== 'no_restriction') {
      const maxHist = parseInt(maxHistoryArrearsFilter, 10)
      if (st.history_arrear_count > maxHist) return false
    }

    // 6. Maximum Existing Offer Cap (LPA)
    if (maxExistingOfferFilter && !isNaN(parseFloat(maxExistingOfferFilter))) {
      const maxOffer = parseFloat(maxExistingOfferFilter)
      if (st.max_existing_offer && st.max_existing_offer > maxOffer) return false
    }

    // 7. Academic Batch Filter
    if (selectedBatchFilter !== 'all') {
      const batchStr = String(selectedBatchFilter)
      const stBatchId = st.batch_id ? String(st.batch_id) : ''
      const stBatchName = st.batch_name ? String(st.batch_name) : ''
      if (stBatchId !== batchStr && stBatchName !== batchStr) return false
    }

    // 7. Search query: name and roll_no
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchName = st.name && st.name.toLowerCase().includes(q)
      const roll = getDisplayRollNo(st).toLowerCase()
      const matchRoll = roll.includes(q)
      if (!matchName && !matchRoll) return false
    }

    return true
  })

  // Checkbox row toggles
  const handleToggleCheck = (userId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const isAllChecked =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((st) => checkedIds.has(st.user_id))

  const handleToggleCheckAll = () => {
    if (isAllChecked) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(filteredCandidates.map((st) => st.user_id)))
    }
  }

  // Batch action: Include/Add checked students (as special_entry if not meeting criteria)
  const handleIncludeChecked = () => {
    setSelectedMap((prev) => {
      const next = { ...prev }
      checkedIds.forEach((id) => {
        const student = students.find((s) => s.user_id === id)
        // If student is eligible based on drive criteria, included; otherwise special_entry
        next[id] = student?.is_eligible ? 'included' : 'special_entry'
      })
      return next
    })
  }

  // Batch action: Explicitly add checked students as Special Entry
  const handleSpecialEntryChecked = () => {
    setSelectedMap((prev) => {
      const next = { ...prev }
      checkedIds.forEach((id) => {
        next[id] = 'special_entry'
      })
      return next
    })
  }

  // Batch action: Exclude checked students
  // Case A: Selected student already has a record in placement_drive_students -> update to 'excluded'
  // Case B: Selected student does not have a record in placement_drive_students -> Do nothing to DB, remains '' (not in roster)
  const handleExcludeChecked = () => {
    setSelectedMap((prev) => {
      const next = { ...prev }
      checkedIds.forEach((id) => {
        const student = students.find((s) => s.user_id === id)
        if (student?.has_roster_record || prev[id] === 'included' || prev[id] === 'special_entry') {
          next[id] = 'excluded'
        } else {
          // Never was in roster: remain unassigned (do not insert an excluded student into main roster)
          next[id] = ''
        }
      })
      return next
    })
  }

  // Save changes to backend
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setErrorMessage('')

      // Build updates array: only include candidates that have a defined roster status ('included', 'special_entry', 'excluded')
      const updates = []
      students.forEach((st) => {
        const status = selectedMap[st.user_id]
        if (status === 'included' || status === 'special_entry') {
          updates.push({
            user_id: st.user_id,
            drive_status: status
          })
        } else if (status === 'excluded') {
          // Only send excluded if they already had a roster record or were previously included
          if (st.has_roster_record || st.is_eligible) {
            updates.push({
              user_id: st.user_id,
              drive_status: 'excluded'
            })
          }
        }
      })

      const updated = await updateDriveStudentsRoster(driveId, updates)
      onRosterUpdated(updated)
      onClose()
    } catch (err) {
      console.error('Failed to update student roster:', err)
      setErrorMessage('Failed to save student selection. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalIncludedInMap = Object.values(selectedMap).filter(
    (status) => status === 'included' || status === 'special_entry'
  ).length
  const totalSpecialInMap = Object.values(selectedMap).filter(
    (status) => status === 'special_entry'
  ).length
  const totalExcludedInMap = Object.values(selectedMap).filter(
    (status) => status === 'excluded'
  ).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[900px] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-[20px_26px_16px] flex items-start justify-between border-b border-[#f1f5f9]">
          <div>
            <h2 className="text-[21px] font-[850] text-[#172554] leading-tight">
              Filter and Add Students
            </h2>
            <p className="text-[13.5px] text-[#64748b] mt-[3px]">
              Apply company eligibility criteria, search students by name/roll no, and include or exclude candidates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[34px] h-[34px] flex items-center justify-center rounded-[10px] text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body with internal scrolling */}
        <div className="p-[14px_24px] overflow-y-auto flex flex-col gap-[12px] flex-1">
          {errorMessage && (
            <div className="p-[8px_12px] bg-[#fef2f2] border border-[#fecaca] rounded-[8px] text-[13px] text-[#dc2626] flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Criteria Filters: Compact 4-column layout to save vertical space */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-[14px] gap-y-[10px] bg-[#f8fafc] p-[12px_16px] rounded-[12px] border border-[#e2e8f0]">
            {/* Minimum CGPA */}
            <div>
              <label className="block text-[12px] font-[750] text-[#1e293b] mb-[3px]">
                Minimum CGPA
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={minCgpaFilter}
                onChange={(e) => setMinCgpaFilter(e.target.value)}
                placeholder="e.g. 8"
                className="w-full h-[36px] px-[10px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-[13px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition"
              />
            </div>

            {/* Minimum 10th Mark (%) */}
            <div>
              <label className="block text-[12px] font-[750] text-[#1e293b] mb-[3px]">
                Minimum 10th Mark (%)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={minTenthFilter}
                onChange={(e) => setMinTenthFilter(e.target.value)}
                placeholder="e.g. 70"
                className="w-full h-[36px] px-[10px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-[13px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition"
              />
            </div>

            {/* Minimum 12th / Diploma Mark (%) */}
            <div>
              <label className="block text-[12px] font-[750] text-[#1e293b] mb-[3px]">
                Minimum 12th / Diploma (%)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={minTwelfthFilter}
                onChange={(e) => setMinTwelfthFilter(e.target.value)}
                placeholder="e.g. 65"
                className="w-full h-[36px] px-[10px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-[13px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition"
              />
            </div>

            {/* Max Current Standing Arrears */}
            <div>
              <label className="block text-[12px] font-[750] text-[#1e293b] mb-[3px]">
                Max Current Arrears
              </label>
              <select
                value={maxCurrentArrearsFilter}
                onChange={(e) => setMaxCurrentArrearsFilter(e.target.value)}
                className="w-full h-[36px] px-[10px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-[13px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
              >
                <option value="no_restriction">No restriction</option>
                <option value="0">0 (No Arrears)</option>
                <option value="1">Max 1 Arrear</option>
                <option value="2">Max 2 Arrears</option>
                <option value="3">Max 3 Arrears</option>
              </select>
            </div>

            {/* Max History Arrears */}
            <div>
              <label className="block text-[12px] font-[750] text-[#1e293b] mb-[3px]">
                Max History Arrears
              </label>
              <select
                value={maxHistoryArrearsFilter}
                onChange={(e) => setMaxHistoryArrearsFilter(e.target.value)}
                className="w-full h-[36px] px-[10px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-[13px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
              >
                <option value="no_restriction">No restriction</option>
                <option value="0">0 (No History Arrears)</option>
                <option value="1">Max 1 History Arrear</option>
                <option value="2">Max 2 History Arrears</option>
                <option value="3">Max 3 History Arrears</option>
              </select>
            </div>

            {/* Maximum Existing Offer Cap (LPA) */}
            <div>
              <label className="block text-[12px] font-[750] text-[#1e293b] mb-[3px]">
                Offer Cap (LPA)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={maxExistingOfferFilter}
                onChange={(e) => setMaxExistingOfferFilter(e.target.value)}
                placeholder="e.g. 5"
                className="w-full h-[36px] px-[10px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-[13px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition"
              />
            </div>

            {/* Target Academic Batch Filter */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[12px] font-[750] text-[#1e293b] mb-[3px]">
                Target Academic Batch
              </label>
              <select
                value={selectedBatchFilter}
                onChange={(e) => setSelectedBatchFilter(e.target.value)}
                className="w-full h-[36px] px-[10px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-[13px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
              >
                <option value="all">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.name}>
                    Batch {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Search Bar + Inclusion / Exclusion Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
            {/* Search Input: Name or Roll No */}
            <div className="relative flex-1 min-w-[280px]">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name or roll no..."
                className="w-full pl-9 pr-3 py-[7px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[13.5px] text-[#1e293b] placeholder-[#94a3b8] outline-none transition shadow-2xs"
              />
            </div>

            {/* Action buttons for selected students */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleIncludeChecked}
                disabled={checkedIds.size === 0}
                className="py-[7.5px] px-[14px] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] rounded-[9px] text-[13px] font-[750] transition cursor-pointer flex items-center gap-1.5 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
              >
                <UserCheck size={15} strokeWidth={2.4} />
                <span>Include Selected ({checkedIds.size})</span>
              </button>

              <button
                type="button"
                onClick={handleExcludeChecked}
                disabled={checkedIds.size === 0}
                className="py-[7.5px] px-[14px] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#b91c1c] border border-[#fecaca] rounded-[9px] text-[13px] font-[750] transition cursor-pointer flex items-center gap-1.5 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
              >
                <UserMinus size={15} strokeWidth={2.4} />
                <span>Exclude Selected ({checkedIds.size})</span>
              </button>
            </div>
          </div>

          {/* 3. Candidate List Table */}
          <div className="border border-[#dbe5f1] rounded-[14px] overflow-hidden shadow-2xs flex-1 min-h-[360px]">
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#f8fafc] z-10 border-b border-[#e2e8f0]">
                  <tr className="text-[12px] font-[800] text-[#64748b] uppercase tracking-[0.35px]">
                    <th className="py-3 px-4 w-[46px]">
                      <input
                        type="checkbox"
                        checked={isAllChecked}
                        onChange={handleToggleCheckAll}
                        className="w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">CGPA</th>
                    <th className="py-3 px-4">10th / 12th</th>
                    <th className="py-3 px-4">Arrears</th>
                    <th className="py-3 px-4 text-center">Roster Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2f7]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#64748b]">
                        <Loader2 size={24} className="animate-spin mx-auto text-[#2563eb]" />
                        <span className="block mt-2 text-[13.5px]">Loading candidates...</span>
                      </td>
                    </tr>
                  ) : filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#64748b] text-[14px]">
                        No candidates match the filter parameters.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((st) => {
                      const isChecked = checkedIds.has(st.user_id)
                      const currentStatus = selectedMap[st.user_id] || (st.has_roster_record ? st.drive_status : (st.is_eligible ? 'included' : ''))
                      const deptShort = getDeptShort(st.department_name)
                      const rollNo = getDisplayRollNo(st)
                      const avatarInitials = getInitials(st.name)

                      return (
                        <tr
                          key={st.user_id}
                          onClick={() => handleToggleCheck(st.user_id)}
                          className={`hover:bg-[#fbfdff] transition cursor-pointer select-none ${
                            isChecked ? 'bg-[#eff6ff]/35' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleCheck(st.user_id)}
                              className="w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 cursor-pointer"
                            />
                          </td>

                          {/* Student */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-[32px] h-[32px] rounded-[8px] bg-[#dbeafe] text-[#2563eb] font-[850] text-[11.5px] flex items-center justify-center shrink-0">
                                {avatarInitials}
                              </div>
                              <div>
                                <div className="text-[13.5px] font-[800] text-[#1e293b] leading-tight">
                                  {st.name}
                                </div>
                                <div className="text-[11.5px] text-[#94a3b8] font-medium leading-tight mt-0.5">
                                  {st.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Roll No */}
                          <td className="py-3 px-4 text-[13px] font-[750] text-[#1e293b]">
                            {rollNo}
                          </td>

                          {/* Department */}
                          <td className="py-3 px-4 text-[13px] font-[650] text-[#475569]">
                            {deptShort}
                          </td>

                          {/* CGPA */}
                          <td className="py-3 px-4 text-[13px] font-[750] text-[#334155]">
                            {st.cgpa !== null && st.cgpa !== undefined ? Number(st.cgpa).toFixed(2) : '—'}
                          </td>

                          {/* 10th / 12th */}
                          <td className="py-3 px-4 text-[12.5px] font-[600] text-[#475569]">
                            {st.tenth_mark ?? '—'}% / {st.twelfth_mark ?? '—'}%
                          </td>

                          {/* Arrears */}
                          <td className="py-3 px-4 text-[12.5px] font-[600] text-[#475569]">
                            {st.current_arrear_count ?? 0} / {st.history_arrear_count ?? 0}
                          </td>

                          {/* Roster Status */}
                          <td className="py-3 px-4 text-center">
                            {currentStatus === 'special_entry' ? (
                              <span className="inline-flex items-center gap-1 py-[3px] px-[10px] rounded-full text-[11.5px] font-[800] text-[#b45309] bg-[#fefce8] border border-[#fde68a]">
                                <Sparkles size={11} className="text-[#d97706]" />
                                Special Entry
                              </span>
                            ) : currentStatus === 'included' ? (
                              <span className="inline-block py-[3px] px-[10px] rounded-full text-[11.5px] font-[750] text-[#2563eb] bg-[#eff6ff] border border-[#bfdbfe]">
                                Included
                              </span>
                            ) : currentStatus === 'excluded' ? (
                              <span className="inline-block py-[3px] px-[10px] rounded-full text-[11.5px] font-[650] text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0]">
                                Excluded
                              </span>
                            ) : (
                              <span className="inline-block py-[3px] px-[10px] rounded-full text-[11.5px] font-[600] text-[#94a3b8] bg-[#f8fafc] border border-dashed border-[#cbd5e1]">
                                Not in Roster
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
        </div>

        {/* Modal Footer */}
        <div className="p-[16px_26px] border-t border-[#f1f5f9] flex items-center justify-between">
          <div className="text-[13.5px] font-[650] text-[#64748b] flex items-center gap-3">
            <span>
              <strong className="text-[#1e293b] font-[800]">{totalIncludedInMap}</strong> included
            </span>
            <span>•</span>
            <span className="text-[#d97706]">
              <strong className="font-[800]">{totalSpecialInMap}</strong> special entry
            </span>
            <span>•</span>
            <span>
              <strong className="text-[#64748b] font-[800]">{totalExcludedInMap}</strong> excluded
            </span>
          </div>

          <div className="flex items-center gap-[12px]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-[20px] py-[10px] text-[14px] font-[700] text-[#475569] bg-white hover:bg-[#f8fafc] border border-[#dbe5f1] rounded-[10px] transition cursor-pointer active:scale-98"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-[24px] py-[10px] text-[14px] font-[750] text-white bg-[#2563eb] hover:bg-[#1d4ed8] rounded-[10px] shadow-sm hover:shadow transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-70"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              <span>{isSubmitting ? 'Saving...' : 'Save & Update Roster'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
