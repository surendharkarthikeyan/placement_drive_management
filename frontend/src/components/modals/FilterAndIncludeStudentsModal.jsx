import React, { useState, useEffect } from 'react'
import { X, Search, Check, AlertCircle, Loader2, Sparkles, Filter } from 'lucide-react'
import { getDriveStudents, updateDriveStudentsRoster } from '../../services/api'
import CustomSelect from '../common/CustomSelect'

/**
 * FilterAndIncludeStudentsModal
 * Matches the user reference template:
 * - Top Filter Controls:
 *   - Year / Batch selector (Final Year / Third Year / All Years)
 *   - Department selector (All Eligible Departments / CSE / IT / ECE)
 *   - Minimum CGPA input
 *   - Arrear status selector (No Standing Arrears / Maximum 1 Arrear / Any Arrear Status)
 *   - Minimum 10th % input
 *   - Minimum 12th % input
 *   - Placement Status (All Placement Statuses / Not Placed / Placed / Single Offer)
 *   - Internal Batches selector
 * - Criteria tags row (Final Year, CSE + IT + ECE, CGPA >= 7.5, etc.)
 * - Candidate List Table (regardless of eligibility, all pool candidates are listed):
 *   - Checkbox
 *   - Student (Mini avatar with initials, Name, Reg number)
 *   - Department
 *   - CGPA
 *   - Placement Status
 *   - Eligibility Indicator (Eligible vs Not Eligible)
 * - If user includes a student who does NOT meet eligibility criteria, their status becomes `special_entry`!
 * - If user excludes a student who was previously included, they are removed.
 * - Footer action: "X students selected" count, Cancel, and "Add Selected Students"
 */
export default function FilterAndIncludeStudentsModal({
  isOpen = false,
  onClose = () => {},
  driveId = null,
  eligibility = null,
  onRosterUpdated = () => {}
}) {
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Filter state
  const [yearFilter, setYearFilter] = useState('Final Year')
  const [deptFilter, setDeptFilter] = useState('All Eligible Departments')
  const [minCgpaFilter, setMinCgpaFilter] = useState('')
  const [arrearFilter, setArrearFilter] = useState('No Standing Arrears')
  const [minTenthFilter, setMinTenthFilter] = useState('')
  const [minTwelfthFilter, setMinTwelfthFilter] = useState('')
  const [placementStatusFilter, setPlacementStatusFilter] = useState('All Placement Statuses')
  const [internalBatchFilter, setInternalBatchFilter] = useState('All Internal Batches')
  const [searchQuery, setSearchQuery] = useState('')

  // Selection state: Map of userId -> drive_status ('included' or 'special_entry')
  // If checked: if student.is_eligible -> 'included', else -> 'special_entry'
  const [selectedMap, setSelectedMap] = useState({})

  // Load students for drive
  const loadStudents = async () => {
    if (!driveId) return
    try {
      setIsLoading(true)
      setErrorMessage('')
      const data = await getDriveStudents(driveId)
      setStudents(data || [])

      // Initial selection from DB
      const initialMap = {}
      ;(data || []).forEach((st) => {
        if (st.is_included_in_drive) {
          initialMap[st.user_id] = st.drive_status || (st.is_eligible ? 'included' : 'special_entry')
        }
      })
      setSelectedMap(initialMap)
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
      // Initialize filters from drive eligibility
      if (eligibility) {
        setMinCgpaFilter(eligibility.min_cgpa ? String(eligibility.min_cgpa) : '')
        setMinTenthFilter(eligibility.min_tenth_mark ? String(eligibility.min_tenth_mark) : '')
        setMinTwelfthFilter(eligibility.min_twelfth_mark ? String(eligibility.min_twelfth_mark) : '')
        if (eligibility.max_current_arrears === 0) setArrearFilter('No Standing Arrears')
        else if (eligibility.max_current_arrears === 1) setArrearFilter('Maximum 1 Arrear')
        else setArrearFilter('Any Arrear Status')
      }
    }
  }, [isOpen, driveId])

  if (!isOpen) return null

  // Helper for department short code
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

  const getRegNo = (st) => {
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
    // Dept filter
    if (deptFilter !== 'All Eligible Departments') {
      const code = getDeptShort(st.department_name)
      if (code !== deptFilter) return false
    }

    // CGPA filter
    if (minCgpaFilter && !isNaN(parseFloat(minCgpaFilter))) {
      const targetCgpa = parseFloat(minCgpaFilter)
      if (st.cgpa === null || st.cgpa === undefined || st.cgpa < targetCgpa) return false
    }

    // 10th mark filter
    if (minTenthFilter && !isNaN(parseFloat(minTenthFilter))) {
      const targetTenth = parseFloat(minTenthFilter)
      if (st.tenth_mark === null || st.tenth_mark === undefined || st.tenth_mark < targetTenth) return false
    }

    // 12th mark filter
    if (minTwelfthFilter && !isNaN(parseFloat(minTwelfthFilter))) {
      const targetTwelfth = parseFloat(minTwelfthFilter)
      if (st.twelfth_mark === null || st.twelfth_mark === undefined || st.twelfth_mark < targetTwelfth) return false
    }

    // Arrear filter
    if (arrearFilter === 'No Standing Arrears' && st.current_arrear_count > 0) return false
    if (arrearFilter === 'Maximum 1 Arrear' && st.current_arrear_count > 1) return false

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = st.name && st.name.toLowerCase().includes(q)
      const matchEmail = st.email && st.email.toLowerCase().includes(q)
      const reg = getRegNo(st).toLowerCase()
      if (!matchName && !matchEmail && !reg.includes(q)) return false
    }

    return true
  })

  // Toggle single student inclusion
  const handleToggleStudent = (student) => {
    setSelectedMap((prev) => {
      const next = { ...prev }
      if (next[student.user_id]) {
        // Uncheck / exclude
        delete next[student.user_id]
      } else {
        // If student is eligible according to drive criteria -> 'included'
        // If student is NOT eligible (below CGPA, arrears, etc.) -> 'special_entry'!
        next[student.user_id] = student.is_eligible ? 'included' : 'special_entry'
      }
      return next
    })
  }

  // Toggle all filtered candidates
  const isAllFilteredSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((st) => Boolean(selectedMap[st.user_id]))

  const handleToggleSelectAll = () => {
    setSelectedMap((prev) => {
      const next = { ...prev }
      if (isAllFilteredSelected) {
        filteredCandidates.forEach((st) => {
          delete next[st.user_id]
        })
      } else {
        filteredCandidates.forEach((st) => {
          next[st.user_id] = st.is_eligible ? 'included' : 'special_entry'
        })
      }
      return next
    })
  }

  // Save changes to backend
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setErrorMessage('')

      // Build updates array for all known candidates
      const updates = students.map((st) => {
        const currentChoice = selectedMap[st.user_id]
        if (currentChoice) {
          return {
            user_id: st.user_id,
            drive_status: currentChoice // 'included' or 'special_entry'
          }
        }
        return {
          user_id: st.user_id,
          drive_status: 'excluded'
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

  const selectedCount = Object.keys(selectedMap).length
  const specialCount = Object.values(selectedMap).filter((status) => status === 'special_entry').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[840px] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-[22px_28px_16px] flex items-start justify-between border-b border-[#f1f5f9]">
          <div>
            <h2 className="text-[22px] font-[850] text-[#172554] leading-tight">
              Filter and Include Students
            </h2>
            <p className="text-[14px] text-[#64748b] mt-[4px]">
              Apply company eligibility conditions and select students for this drive.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body with internal scrolling */}
        <div className="p-[22px_28px] overflow-y-auto flex flex-col gap-[16px] flex-1">
          {errorMessage && (
            <div className="p-[10px_14px] bg-[#fef2f2] border border-[#fecaca] rounded-[10px] text-[13.5px] text-[#dc2626] flex items-center gap-2">
              <AlertCircle size={17} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Modal Filter Controls Grid */}
          <div className="grid grid-cols-4 gap-[12px]">
            {/* Year Selector */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="h-[44px] px-[12px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
            >
              <option value="Final Year">Final Year</option>
              <option value="Third Year">Third Year</option>
              <option value="All Years">All Years</option>
            </select>

            {/* Department Selector */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-[44px] px-[12px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
            >
              <option value="All Eligible Departments">All Eligible Departments</option>
              <option value="CSE">CSE</option>
              <option value="IT">IT</option>
              <option value="ECE">ECE</option>
            </select>

            {/* Minimum CGPA */}
            <input
              type="text"
              value={minCgpaFilter}
              onChange={(e) => setMinCgpaFilter(e.target.value)}
              placeholder="Minimum CGPA"
              className="h-[44px] px-[12px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition"
            />

            {/* Arrear Status */}
            <select
              value={arrearFilter}
              onChange={(e) => setArrearFilter(e.target.value)}
              className="h-[44px] px-[12px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
            >
              <option value="No Standing Arrears">No Standing Arrears</option>
              <option value="Maximum 1 Arrear">Maximum 1 Arrear</option>
              <option value="Any Arrear Status">Any Arrear Status</option>
            </select>

            {/* Minimum 10th % */}
            <input
              type="text"
              value={minTenthFilter}
              onChange={(e) => setMinTenthFilter(e.target.value)}
              placeholder="Minimum 10th %"
              className="h-[44px] px-[12px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition"
            />

            {/* Minimum 12th % */}
            <input
              type="text"
              value={minTwelfthFilter}
              onChange={(e) => setMinTwelfthFilter(e.target.value)}
              placeholder="Minimum 12th %"
              className="h-[44px] px-[12px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition"
            />

            {/* Placement Status */}
            <select
              value={placementStatusFilter}
              onChange={(e) => setPlacementStatusFilter(e.target.value)}
              className="h-[44px] px-[12px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
            >
              <option value="All Placement Statuses">All Placement Statuses</option>
              <option value="Not Placed">Not Placed</option>
              <option value="Single Offer">Single Offer</option>
              <option value="Placed">Placed</option>
            </select>

            {/* Internal Batches */}
            <select
              value={internalBatchFilter}
              onChange={(e) => setInternalBatchFilter(e.target.value)}
              className="h-[44px] px-[12px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14px] font-[600] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
            >
              <option value="All Internal Batches">All Internal Batches</option>
              <option value="Batch 1">Batch 1</option>
              <option value="Batch 2">Batch 2</option>
              <option value="Batch 3">Batch 3</option>
            </select>
          </div>

          {/* 2. Filter Tags Row */}
          <div className="flex flex-wrap items-center gap-[6px]">
            <span className="py-[4px] px-[10px] rounded-full text-[12px] font-[700] text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
              Final Year
            </span>
            <span className="py-[4px] px-[10px] rounded-full text-[12px] font-[700] text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
              CSE + IT + ECE
            </span>
            {minCgpaFilter && (
              <span className="py-[4px] px-[10px] rounded-full text-[12px] font-[700] text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
                CGPA ≥ {minCgpaFilter}
              </span>
            )}
            {minTenthFilter && minTwelfthFilter && (
              <span className="py-[4px] px-[10px] rounded-full text-[12px] font-[700] text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
                10th & 12th ≥ {minTenthFilter}%
              </span>
            )}
            <span className="py-[4px] px-[10px] rounded-full text-[12px] font-[700] text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
              {arrearFilter}
            </span>
          </div>

          {/* 3. Candidate List Table */}
          <div className="border border-[#dbe5f1] rounded-[14px] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[340px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#f8fafc] z-10 border-b border-[#e2e8f0]">
                  <tr className="text-[12px] font-[800] text-[#64748b] uppercase tracking-[0.35px]">
                    <th className="py-3 px-4 w-[46px]">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">CGPA</th>
                    <th className="py-3 px-4">Placement Status</th>
                    <th className="py-3 px-4 text-center">Eligibility / Entry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2f7]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#64748b]">
                        <Loader2 size={24} className="animate-spin mx-auto text-[#2563eb]" />
                        <span className="block mt-2 text-[13.5px]">Loading candidates...</span>
                      </td>
                    </tr>
                  ) : filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#64748b] text-[14px]">
                        No candidates match the filter parameters.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((st) => {
                      const isChecked = Boolean(selectedMap[st.user_id])
                      const statusVal = selectedMap[st.user_id]
                      const deptShort = getDeptShort(st.department_name)
                      const regNo = getRegNo(st)
                      const avatarInitials = getInitials(st.name)

                      // Offer / placement status
                      let placementLabel = 'Not Placed'
                      if (st.max_existing_offer) {
                        placementLabel = 'Single Offer'
                      }

                      return (
                        <tr
                          key={st.user_id}
                          onClick={() => handleToggleStudent(st)}
                          className={`hover:bg-[#fbfdff] transition cursor-pointer select-none ${
                            isChecked ? 'bg-[#eff6ff]/35' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleStudent(st)}
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
                                  {regNo}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="py-3 px-4 text-[13px] font-[650] text-[#475569]">
                            {deptShort}
                          </td>

                          {/* CGPA */}
                          <td className="py-3 px-4 text-[13px] font-[750] text-[#334155]">
                            {st.cgpa !== null && st.cgpa !== undefined ? st.cgpa.toFixed(2) : '—'}
                          </td>

                          {/* Placement Status */}
                          <td className="py-3 px-4 text-[13px] font-[600] text-[#475569]">
                            {placementLabel}
                          </td>

                          {/* Eligibility Indicator & Special Entry Tag */}
                          <td className="py-3 px-4 text-center">
                            {isChecked ? (
                              statusVal === 'special_entry' ? (
                                <span className="inline-flex items-center gap-1 py-[3px] px-[10px] rounded-full text-[11.5px] font-[800] text-[#b45309] bg-[#fef3c7] border border-[#fde68a]">
                                  <Sparkles size={12} className="text-[#d97706]" />
                                  Special Entry
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 py-[3px] px-[10px] rounded-full text-[11.5px] font-[800] text-[#15803d] bg-[#dcfce7] border border-[#bbf7d0]">
                                  <Check size={12} strokeWidth={3} />
                                  Included
                                </span>
                              )
                            ) : st.is_eligible ? (
                              <span className="text-[12px] font-[650] text-[#16a34a]">
                                Meets Criteria
                              </span>
                            ) : (
                              <span
                                className="text-[11.5px] font-[600] text-[#94a3b8]"
                                title={st.ineligible_reasons?.join(', ') || 'Does not meet criteria'}
                              >
                                Criteria Gap (Add via Special Entry)
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
        <div className="p-[16px_28px] border-t border-[#f1f5f9] flex items-center justify-between">
          <div className="text-[13.5px] font-[650] text-[#64748b]">
            <span className="text-[#1e293b] font-[800]">{selectedCount}</span> student
            {selectedCount === 1 ? '' : 's'} selected
            {specialCount > 0 && (
              <span className="ml-2 text-[#d97706] font-[750]">
                ({specialCount} special {specialCount === 1 ? 'entry' : 'entries'})
              </span>
            )}
          </div>

          <div className="flex items-center gap-[12px]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-[20px] py-[10px] text-[14.5px] font-[700] text-[#475569] bg-white hover:bg-[#f8fafc] border border-[#dbe5f1] rounded-[10px] transition cursor-pointer active:scale-98"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-[24px] py-[10px] text-[14.5px] font-[750] text-white bg-[#2563eb] hover:bg-[#1d4ed8] rounded-[10px] shadow-sm hover:shadow transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-70"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              <span>{isSubmitting ? 'Saving...' : 'Add Selected Students'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

