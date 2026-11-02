import React, { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown, Loader2, Check, Download } from 'lucide-react'
import { getReviewAnalytics, getReviewStudents, exportReviewStudentsExcel } from '../../../services/api'

/**
 * ReviewProgressWorkspace (Center Panel of Student Placement Review)
 * Template width: flex-1, minmax(570px, 1fr)
 * Displays:
 * - Header: Title, subtitle
 * - Five Analytics Cards:
 *   1. Students in Current Review (Dynamic - updates on left-panel filters)
 *   2. Invitation Acceptance Rate (Dynamic - updates on left-panel filters)
 *   3. Students with Offers (Static: 42 - never changes on filter change)
 *   4. Need Next Opportunity (Static: 24 - never changes on filter change)
 *   5. Need Interview Support (Static: 11 - never changes on filter change)
 * - Action Bar: "Select all visible students", Message button, Sort dropdown with 6 techniques:
 *   1. Sort: Opportunity priority
 *   2. Most attempts
 *   3. Most offers
 *   4. Highest package
 *   5. Most failed processes
 *   6. Most invitations
 * - Student Table:
 *   STUDENT | ATTENDANCE | PRIORITY SCORE | OFFERS | BEST PACKAGE
 */

const SORT_OPTIONS = [
  { id: 'opportunity_priority', label: 'Sort: Opportunity priority' },
  { id: 'most_attempts', label: 'Most attempts' },
  { id: 'most_offers', label: 'Most offers' },
  { id: 'highest_package', label: 'Highest package' },
  { id: 'most_failed_processes', label: 'Most failed processes' },
  { id: 'most_invitations', label: 'Most invitations' }
]

export default function ReviewProgressWorkspace({
  selectedStudentId,
  onSelectStudent,
  filters = {}
}) {
  // 1. Database Overall Metrics for Cards 3, 4, 5
  const [dbStaticMetrics, setDbStaticMetrics] = useState({
    studentsWithOffers: 0,
    needNextOpportunity: 0,
    needInterviewSupport: 0
  })

  // 2. Students List State
  const [students, setStudents] = useState([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)

  // 3. Sorting & Selection State
  const [sortBy, setSortBy] = useState('opportunity_priority')
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const sortRef = useRef(null)

  // Dynamic Card 1: Students in current review (directly from students listed below)
  const studentsInReviewCount = students.length

  // Dynamic Card 2: Invitation acceptance rate (calculated from students listed below)
  const visibleAcceptanceRate = React.useMemo(() => {
    if (!students || students.length === 0) return 0
    let attended = 0
    let eligible = 0
    students.forEach((s) => {
      attended += (s.companies_attended || 0)
      eligible += (s.companies_eligible || 0)
    })
    if (eligible > 0) {
      return Math.min(100, Math.round((attended / eligible) * 100))
    }
    const avgPct = students.reduce((acc, s) => acc + (s.attendance_pct || 0), 0) / students.length
    return Math.min(100, Math.round(avgPct))
  }, [students])

  // Handle Export Excel
  const handleExportExcel = async () => {
    try {
      setIsExporting(true)
      const targetIds = selectedStudentIds.length > 0 ? selectedStudentIds : students.map((s) => s.id)
      await exportReviewStudentsExcel(targetIds, filters)
    } catch (err) {
      console.error('Failed to export students Excel:', err)
    } finally {
      setIsExporting(false)
    }
  }

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch database metrics (cards 3, 4, 5) from analytics API
  useEffect(() => {
    let isMounted = true

    const fetchAnalytics = async () => {
      try {
        const data = await getReviewAnalytics(filters)
        if (isMounted && data) {
          setDbStaticMetrics({
            studentsWithOffers: data.students_with_offers ?? 0,
            needNextOpportunity: data.need_next_opportunity ?? 0,
            needInterviewSupport: data.need_interview_support ?? 0
          })
        }
      } catch (err) {
        console.error('Error fetching review analytics:', err)
      }
    }

    fetchAnalytics()

    return () => {
      isMounted = false
    }
  }, [filters])

  // Fetch students list when filters or sorting change
  useEffect(() => {
    let isMounted = true

    const fetchStudents = async () => {
      try {
        setIsLoadingStudents(true)
        const data = await getReviewStudents(filters, sortBy)
        if (isMounted) {
          const list = Array.isArray(data) ? data : []
          setStudents(list)
          if (onSelectStudent) {
            if (list.length > 0) {
              const stillPresent = list.some((s) => s.id === selectedStudentId)
              if (!stillPresent) {
                onSelectStudent(list[0].id)
              }
            } else {
              onSelectStudent(null)
            }
          }
        }
      } catch (err) {
        console.error('Error fetching review students list:', err)
      } finally {
        if (isMounted) setIsLoadingStudents(false)
      }
    }

    fetchStudents()

    return () => {
      isMounted = false
    }
  }, [filters, sortBy])

  // Checkbox: toggle select all visible students
  const isAllSelected = students.length > 0 && selectedStudentIds.length === students.length
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedStudentIds([])
    } else {
      setSelectedStudentIds(students.map((s) => s.id))
    }
  }

  // Toggle single student checkbox
  const handleToggleStudent = (studentId, e) => {
    e.stopPropagation()
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    )
  }

  // Current active sort label
  const activeSortLabel =
    SORT_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Sort: Opportunity priority'

  return (
    <section className="flex-1 min-w-[620px] bg-[#f5f8fc] h-full overflow-y-auto p-[20px] flex flex-col">
      {/* 1. Header with Title */}
      <div className="pb-2">
        <h1 className="text-[21px] font-[850] text-[#172554] m-0 leading-tight tracking-tight">
          Student Placement Progress
        </h1>
        <p className="text-[13px] text-[#64748b] mt-1 mb-0 font-medium">
          Review outcomes and identify students who should receive the next opportunity.
        </p>
      </div>

      {/* 2. Five Analytics Cards Grid */}
      <div className="grid grid-cols-5 gap-3.5 mt-4">
        {/* Card 1: Students in Current Review (Dynamic from students listed below) */}
        <div className="bg-white border border-[#e2e8f0] border-t-[3.5px] border-t-[#2563eb] rounded-[14px] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between transition-all">
          <div className="text-[26px] font-[850] text-[#0f172a] leading-none">
            {studentsInReviewCount}
          </div>
          <div className="text-[12px] font-medium text-[#64748b] leading-tight mt-2.5">
            Students in current review
          </div>
        </div>

        {/* Card 2: Invitation Acceptance Rate (Dynamic from students listed below) */}
        <div className="bg-white border border-[#e2e8f0] border-t-[3.5px] border-t-[#16a34a] rounded-[14px] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between transition-all">
          <div className="text-[26px] font-[850] text-[#0f172a] leading-none">
            {visibleAcceptanceRate}%
          </div>
          <div className="text-[12px] font-medium text-[#64748b] leading-tight mt-2.5">
            Invitation acceptance rate
          </div>
        </div>

        {/* Card 3: Students with Offers (Static from DB data) */}
        <div className="bg-white border border-[#e2e8f0] border-t-[3.5px] border-t-[#9333ea] rounded-[14px] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="text-[26px] font-[850] text-[#0f172a] leading-none">
            {dbStaticMetrics.studentsWithOffers}
          </div>
          <div className="text-[12px] font-medium text-[#64748b] leading-tight mt-2.5">
            Students with offers
          </div>
        </div>

        {/* Card 4: Need Next Opportunity (Static from DB data) */}
        <div className="bg-white border border-[#e2e8f0] border-t-[3.5px] border-t-[#ea580c] rounded-[14px] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="text-[26px] font-[850] text-[#0f172a] leading-none">
            {dbStaticMetrics.needNextOpportunity}
          </div>
          <div className="text-[12px] font-medium text-[#64748b] leading-tight mt-2.5">
            Need next opportunity
          </div>
        </div>

        {/* Card 5: Need Interview Support (Static from DB data) */}
        <div className="bg-white border border-[#e2e8f0] border-t-[3.5px] border-t-[#dc2626] rounded-[14px] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div className="text-[26px] font-[850] text-[#0f172a] leading-none">
            {dbStaticMetrics.needInterviewSupport}
          </div>
          <div className="text-[12px] font-medium text-[#64748b] leading-tight mt-2.5">
            Need interview support
          </div>
        </div>
      </div>

      {/* 3. Student Table Card Workspace (incorporating toolbar + table) */}
      <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-[0_1px_3px_rgba(15,23,42,0.03)] overflow-hidden flex flex-col flex-1 mt-5">
        {/* Card Header Toolbar: Select all visible students & Sort Dropdown */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f1f5f9] bg-white">
          {/* Left: Select all visible students */}
          <label className="flex items-center gap-2.5 text-[13px] font-semibold text-[#475569] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded border-[#cbd5e1] text-[#2563eb] focus:ring-[#2563eb] cursor-pointer"
            />
            <span>
              Select all visible students
              {selectedStudentIds.length > 0 && ` (${selectedStudentIds.length} selected)`}
            </span>
          </label>

          {/* Right: Export button & Sort Dropdown */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || students.length === 0}
              className="h-[34px] px-3.5 rounded-[10px] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#2563eb] border border-[#bfdbfe] font-[700] text-[13px] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              title={selectedStudentIds.length > 0 ? `Export ${selectedStudentIds.length} selected student(s) to Excel` : 'Export all visible students to Excel'}
            >
              {isExporting ? <Loader2 size={15} className="animate-spin text-[#2563eb]" /> : <Download size={15} className="text-[#2563eb]" />}
              <span>Export{selectedStudentIds.length > 0 ? ` (${selectedStudentIds.length})` : ''}</span>
            </button>

            <div className="relative" ref={sortRef}>
              <button
                type="button"
                onClick={() => setIsSortDropdownOpen((prev) => !prev)}
                className="min-w-[195px] px-3.5 py-1.5 rounded-[10px] border border-[#dbe5f1] bg-white text-[#1e293b] font-[650] text-[13px] hover:border-[#94a3b8] shadow-2xs transition cursor-pointer flex items-center justify-between gap-2"
              >
                <span className="truncate">{activeSortLabel}</span>
                <ChevronDown
                  size={14}
                  className={`text-[#64748b] transition-transform duration-150 ${
                    isSortDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isSortDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-[220px] bg-white border border-[#dbe5f1] rounded-[12px] shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.id)
                        setIsSortDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3.5 py-2 text-[12.5px] transition flex items-center justify-between cursor-pointer ${
                        sortBy === opt.id
                          ? 'bg-[#eff6ff] text-[#2563eb] font-bold'
                          : 'text-[#334155] font-medium hover:bg-[#f8fafc]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.id && <Check size={14} className="text-[#2563eb]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Column Headers with tuned proportional spacing */}
        <div className="grid grid-cols-[44px_minmax(190px,2fr)_minmax(180px,1.8fr)_minmax(120px,1.1fr)_minmax(95px,0.9fr)_100px_36px] items-center px-4 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9] text-[11px] font-[800] text-[#64748b] tracking-wider uppercase select-none">
          <div className="flex items-center justify-center">
            <span className="sr-only">Select</span>
          </div>
          <div>STUDENT</div>
          <div>ATTENDANCE</div>
          <div>PRIORITY SCORE</div>
          <div>OFFERS</div>
          <div>BEST PACKAGE</div>
          <div></div>
        </div>

        {/* Table Body */}
        {isLoadingStudents ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-[#94a3b8]">
            <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6] mb-2" />
            <span className="text-[13px] font-medium">Loading student list...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-[#94a3b8]">
            <p className="text-[14px] font-semibold text-[#475569]">No students match the current filters</p>
            <p className="text-[12px] text-[#94a3b8] mt-1">Try resetting or adjusting the filters in the left panel.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f1f5f9] overflow-y-auto">
            {students.map((st) => {
              const isSelectedRow = selectedStudentId === st.id
              const isChecked = selectedStudentIds.includes(st.id)

              // Badge styling for Priority Level
              let badgeColor = 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
              if (st.priority_level === 'High') {
                badgeColor = 'bg-[#ecfdf5] text-[#16a34a] border-[#bbf7d0]'
              } else if (st.priority_level === 'Mid') {
                badgeColor = 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
              } else if (st.priority_level === 'Low') {
                badgeColor = 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]'
              }

              return (
                <div
                  key={st.id}
                  onClick={() => onSelectStudent && onSelectStudent(st.id)}
                  className={`grid grid-cols-[44px_minmax(190px,2fr)_minmax(180px,1.8fr)_minmax(120px,1.1fr)_minmax(95px,0.9fr)_100px_36px] items-center px-4 py-3.5 transition-colors cursor-pointer border-l-[4px] ${
                    isSelectedRow
                      ? 'border-l-[#2563eb] bg-[#eff6ff]/40'
                      : 'border-l-transparent hover:bg-[#f8fafc]'
                  }`}
                >
                  {/* 1. Checkbox */}
                  <div
                    className="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleToggleStudent(st.id, e)}
                      className="w-4 h-4 rounded border-[#cbd5e1] text-[#2563eb] focus:ring-[#2563eb] cursor-pointer"
                    />
                  </div>

                  {/* 2. STUDENT info */}
                  <div className="flex items-center gap-3 pr-2 min-w-0">
                    <div className="w-[38px] h-[38px] rounded-[10px] bg-[#eff6ff] border border-[#bfdbfe]/60 flex items-center justify-center text-[#2563eb] font-[800] text-[13px] shrink-0">
                      {st.initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-[800] text-[#0f172a] leading-tight truncate">
                        {st.name}
                      </h4>
                      <p className="text-[12px] text-[#64748b] font-medium mt-0.5 leading-tight truncate">
                        {st.roll_no ? `${st.roll_no} · ` : ''}
                        {st.department_code}
                        {st.cgpa != null ? ` · CGPA ${st.cgpa}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* 3. ATTENDANCE / PARTICIPATION with Placed / Not Placed badge below pipeline */}
                  <div className="pr-4">
                    <div className="flex items-center justify-between text-[12px] font-medium leading-none mb-1">
                      <span className="text-[#475569]">
                        {st.companies_attended}/{st.companies_eligible} attended
                      </span>
                      <span className="font-bold text-[#0f172a]">
                        {Math.round(st.attendance_pct)}%
                      </span>
                    </div>
                    {/* Blue Progress Bar */}
                    <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2563eb] rounded-full transition-all"
                        style={{ width: `${Math.min(st.attendance_pct, 100)}%` }}
                      />
                    </div>

                    {/* Placed / Not Placed Badge below the pipeline */}
                    <div className="mt-1.5">
                      {st.is_placed ? (
                        <span className="inline-block px-2 py-0.5 rounded-[5px] text-[10.5px] font-[750] bg-[#FEF9C3] text-[#854D0E] border border-[#FEF08A]/60">
                          Placed
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-[5px] text-[10.5px] font-[750] bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]/60">
                          Not Placed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4. PRIORITY SCORE */}
                  <div className="pr-2">
                    <div className="text-[14.5px] font-[850] text-[#0f172a] leading-none mb-1">
                      {Math.round(st.priority_score)}/100
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-[6px] text-[10.5px] font-bold border ${badgeColor}`}
                    >
                      {st.priority_level}
                    </span>
                  </div>

                  {/* 5. OFFERS */}
                  <div>
                    <div className="text-[14px] font-[850] text-[#0f172a] leading-none">
                      {st.offers_count}
                    </div>
                    <div className="text-[11.5px] text-[#64748b] font-medium mt-1 leading-tight">
                      {st.unsuccessful_count > 0
                        ? `${st.unsuccessful_count} unsuccessful`
                        : `${st.attempts} rounds`}
                    </div>
                  </div>

                  {/* 6. BEST PACKAGE (Reduced space & highest subtitle) */}
                  <div>
                    <div className="text-[13.5px] font-[800] text-[#0f172a] leading-none">
                      {st.best_package_lpa != null && st.best_package_lpa > 0 ? (
                        `${st.best_package_lpa} LPA`
                      ) : (
                        '—'
                      )}
                    </div>
                    <div className="text-[11px] text-[#94a3b8] font-medium mt-1 leading-tight">
                      highest
                    </div>
                  </div>

                  {/* 7. Chevron Arrow */}
                  <div className="flex items-center justify-center text-[#94a3b8]">
                    <ChevronRight size={16} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
