import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search
} from 'lucide-react'
import { getDriveStudents } from '../../services/api'

export default function DriveStudentsRoster({
  driveId,
  eligibility,
  onOpenFilterModal = () => {},
  onConfigureCriteria = () => {}
}) {
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('included') // default to 'included' to show only drive roster students initially

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

  // Core counts
  const totalStudentsCount = students.length
  const includedCount = students.filter((s) => s.drive_status === 'included').length
  const specialEntryCount = students.filter((s) => s.drive_status === 'special_entry').length
  const totalIncluded = students.filter((s) => s.is_included_in_drive && s.drive_status !== 'excluded').length
  const excludedCount = students.filter((s) => !s.is_included_in_drive || s.drive_status === 'excluded').length

  // Filtered students based on search term and selected status tab
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      // 1. Status Filter:
      // 'included' shows all students in the drive (both regular eligible included and special entry)
      if (statusFilter === 'included') {
        if (!st.is_included_in_drive || st.drive_status === 'excluded') return false
      } else if (statusFilter === 'excluded') {
        if (st.drive_status !== 'excluded' && st.is_included_in_drive) return false
      } else if (statusFilter === 'special_entry') {
        if (st.drive_status !== 'special_entry') return false
      }
      // 'all' includes everyone (accessible if clicked)

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
  }, [students, statusFilter, searchTerm])

  // Department-wise distribution among included students
  const deptMap = {}
  students.filter((s) => s.is_included_in_drive && s.drive_status !== 'excluded').forEach((s) => {
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
      {/* 1. Top Bar: "Students Included in this Drive" + "+ Filter and Add Students" button */}
      <div className="p-[14px_18px] bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-[850] text-[#172554] m-0 leading-tight">
            Students Included in this Drive
          </h2>
          <p className="text-[13px] text-[#64748b] mt-[3px] mb-0 font-medium">
            {totalIncluded} students currently included
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenFilterModal}
          className="py-[9px] px-[16px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[9px] text-[13.5px] font-[750] shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1.5 active:scale-98"
        >
          <Plus size={16} strokeWidth={2.8} />
          <span>Filter and Add Students</span>
        </button>
      </div>

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
        {/* 1. All Candidates */}
        <div className="min-w-[170px] flex-1 shrink-0 p-[18px_20px] text-center bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs">
          <strong className="block text-[28px] font-[850] text-[#172554] leading-none">
            {totalStudentsCount}
          </strong>
          <span className="text-[12.5px] font-[600] text-[#64748b] mt-[8px] block">
            All candidates
          </span>
        </div>

        {/* 2. Total Included */}
        <div className="min-w-[170px] flex-1 shrink-0 p-[18px_20px] text-center bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs">
          <strong className="block text-[28px] font-[850] text-[#172554] leading-none">
            {totalIncluded}
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

        {/* Tab Filter Options: All, Included, Excluded, Special Entry */}
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
            All ({totalStudentsCount})
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
            Included ({totalIncluded})
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

      {/* 5. Student Table Card matching template design */}
      <div className="bg-white border border-[#dbe5f1] rounded-[14px] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[12px] font-[800] text-[#64748b] uppercase tracking-[0.35px]">
                <th className="py-3 px-4 w-[48px]">
                  <input
                    type="checkbox"
                    checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 cursor-pointer"
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
                          checked={isSelected}
                          onChange={() => toggleStudent(st.user_id)}
                          className="w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 cursor-pointer"
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
    </div>
  )
}
