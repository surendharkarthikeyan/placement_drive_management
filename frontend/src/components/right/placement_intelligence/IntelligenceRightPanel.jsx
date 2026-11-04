import React, { useState, useEffect, useMemo } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { getIntelligenceOverallStats, getIntelligenceOutcomeStudents } from '../../../services/api'

/**
 * IntelligenceRightPanel
 *
 * Right Panel (475px) displaying:
 * 1. Outcome Group Students List (Not Yet Placed, Higher Studies, Entrepreneurship)
 *    matching reference design with Institutional count card and student cards
 * 2. Placement Outcome Overview mode with Pipeline % and Breakdown
 * 3. Dynamic real-time DB filtering by Batch, Department, and Outcome Group
 */
export default function IntelligenceRightPanel({
  currentView = 'overall',
  selectedBatch = null,
  selectedDepartment = 'All',
  selectedOutcome = null,
  onSelectOutcome = () => {}
}) {
  const [activeMode, setActiveMode] = useState('overview') // Default view is Overview
  const [loading, setLoading] = useState(false)
  const [statsData, setStatsData] = useState(null)

  // Outcome group students state
  const [outcomeStudents, setOutcomeStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [studentSearchQuery, setStudentSearchQuery] = useState('')

  // Map outcome group keys to standard 4 supported groups
  const effectiveOutcome = (selectedOutcome === 'higherStudies' || selectedOutcome === 'entrepreneur' || selectedOutcome === 'notEligible')
    ? selectedOutcome
    : (selectedOutcome === 'notPlaced' ? 'notPlaced' : 'notPlaced')

  // Switch to students mode when an outcome group is explicitly chosen from outside
  useEffect(() => {
    if (selectedOutcome) {
      setActiveMode('students')
    }
  }, [selectedOutcome])

  // Fetch overview stats
  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const resp = await getIntelligenceOverallStats({
          batch: selectedBatch || '',
          department: selectedDepartment || 'All'
        })
        if (isMounted && resp) {
          const data = resp.data || resp
          setStatsData(data)
        }
      } catch (err) {
        console.error('Failed to load right panel intelligence stats', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchData()
    return () => {
      isMounted = false
    }
  }, [selectedBatch, selectedDepartment])

  // Fetch outcome group students list from database
  useEffect(() => {
    let isMounted = true
    const fetchStudents = async () => {
      // For notEligible, no logic for now
      if (effectiveOutcome === 'notEligible') {
        setOutcomeStudents([])
        return
      }

      setLoadingStudents(true)
      try {
        const students = await getIntelligenceOutcomeStudents({
          outcome: effectiveOutcome,
          batch: selectedBatch || '',
          department: selectedDepartment || 'All'
        })
        if (isMounted) {
          setOutcomeStudents(students || [])
        }
      } catch (err) {
        console.error('Failed to load outcome students:', err)
      } finally {
        if (isMounted) setLoadingStudents(false)
      }
    }
    fetchStudents()
    return () => {
      isMounted = false
    }
  }, [effectiveOutcome, selectedBatch, selectedDepartment])

  // Clear search query when outcome group changes
  useEffect(() => {
    setStudentSearchQuery('')
  }, [effectiveOutcome])

  // Filter students based on search query (name, roll no, department, status)
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return outcomeStudents
    const q = studentSearchQuery.toLowerCase().trim()
    return outcomeStudents.filter((s) => {
      const name = (s.name || '').toLowerCase()
      const roll = (s.roll_no || '').toLowerCase()
      const dept = (s.department_code || s.department_name || '').toLowerCase()
      const status = (s.status || '').toLowerCase()
      return name.includes(q) || roll.includes(q) || dept.includes(q) || status.includes(q)
    })
  }, [outcomeStudents, studentSearchQuery])

  // Derive metrics for Placement Outcome overview card
  const uniqueRows = statsData?.unique_students_by_offer || []
  const cleanSelected = (selectedBatch && selectedBatch !== 'All' && selectedBatch !== 'all')
    ? String(selectedBatch).replace(/[\u2013\u2014]/g, '-').replace(/^Batch\s*/i, '').trim().toLowerCase()
    : ''

  const targetRow = cleanSelected
    ? uniqueRows.find((r) => {
        const rowBatch = String(r.batch).replace(/[\u2013\u2014]/g, '-').replace(/^Batch\s*/i, '').trim().toLowerCase()
        return rowBatch === cleanSelected || rowBatch.includes(cleanSelected) || cleanSelected.includes(rowBatch)
      }) || null
    : null

  let totalStudents = 0
  let notEligible = 0
  let higherStudies = 0
  let entrepreneurship = 0
  let notPlaced = 0
  let placedCount = 0

  if (targetRow) {
    totalStudents = targetRow.total || 0
    notEligible = targetRow.not_eligible || 0
    higherStudies = targetRow.higher_studies || 0
    entrepreneurship = targetRow.entrepreneurship || 0
    notPlaced = targetRow.not_placed || 0
    placedCount = targetRow.unique
      ? Object.values(targetRow.unique).reduce((acc, v) => acc + (Number(v) || 0), 0)
      : 0
  } else if (uniqueRows.length > 0) {
    for (const r of uniqueRows) {
      totalStudents += r.total || 0
      notEligible += r.not_eligible || 0
      higherStudies += r.higher_studies || 0
      entrepreneurship += r.entrepreneurship || 0
      notPlaced += r.not_placed || 0
      if (r.unique) {
        placedCount += Object.values(r.unique).reduce((acc, v) => acc + (Number(v) || 0), 0)
      }
    }
  }

  const nonPlacementTracks = higherStudies + entrepreneurship
  let interestedCount = Math.max(0, totalStudents - nonPlacementTracks)
  if (interestedCount === 0 && (placedCount > 0 || notPlaced > 0)) {
    interestedCount = placedCount + notPlaced
  }

  const placedPercentage = interestedCount > 0 ? Math.round((placedCount / interestedCount) * 100) : 0

  // Filter display labels
  const batchFilterLabel = (selectedBatch && selectedBatch !== 'All' && selectedBatch !== 'all')
    ? (targetRow?.batch ? `Batch ${targetRow.batch}` : `Batch ${String(selectedBatch).replace(/^Batch\s*/i, '')}`)
    : 'All Batches'

  const deptFilterLabel = (selectedDepartment && selectedDepartment !== 'All' && selectedDepartment !== 'All Departments')
    ? selectedDepartment
    : 'All Departments'

  // Outcome group titles & pill styling
  const outcomeTitleMap = {
    notPlaced: 'Not Yet Placed',
    notEligible: 'Not Eligible',
    higherStudies: 'Higher Studies',
    entrepreneur: 'Entrepreneurship'
  }

  const currentOutcomeTitle = outcomeTitleMap[effectiveOutcome] || 'Not Yet Placed'

  const getStatusPillClass = (group) => {
    switch (group) {
      case 'notEligible':
        return 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]'
      case 'higherStudies':
        return 'bg-[#f3e8ff] text-[#7e22ce] border border-[#e9d5ff]'
      case 'entrepreneur':
        return 'bg-[#ecfeff] text-[#0e7490] border border-[#cffafe]'
      case 'notPlaced':
      default:
        return 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]'
    }
  }

  const getInitials = (name) => {
    if (!name) return 'ST'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <aside className="w-[475px] min-w-[430px] shrink-0 bg-white border-l border-[#dbe5f1] h-full flex flex-col overflow-hidden">
      {/* 1. Header with Mode Toggle & Outcome Tabs */}
      <div className="p-[18px_22px_14px] border-b border-[#dbe5f1] shrink-0 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-[850] text-[#172554] tracking-tight m-0 leading-tight">
              {activeMode === 'students' ? currentOutcomeTitle : 'Placement Outcome'}
            </h2>
            <p className="text-[12px] text-[#64748b] mt-1 mb-0 leading-relaxed font-medium">
              {batchFilterLabel}
              {deptFilterLabel !== 'All Departments' ? ` · ${deptFilterLabel}` : ''}
              {activeMode === 'students' ? ' · Click a student for complete evidence and status.' : ''}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#f1f5f9] p-0.5 rounded-[8px] border border-[#e2e8f0] shrink-0">
            <button
              type="button"
              onClick={() => setActiveMode('overview')}
              className={`px-2.5 py-1 rounded-[6px] text-[11px] font-[800] transition cursor-pointer ${
                activeMode === 'overview'
                  ? 'bg-white text-[#2563eb] shadow-2xs'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('students')}
              className={`px-2.5 py-1 rounded-[6px] text-[11px] font-[800] transition cursor-pointer ${
                activeMode === 'students'
                  ? 'bg-white text-[#2563eb] shadow-2xs'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              Students
            </button>
          </div>
        </div>

        {/* Outcome Group Selector Buttons (When in Students Mode) */}
        {activeMode === 'students' && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#f1f5f9]">
            <button
              type="button"
              onClick={() => onSelectOutcome('notPlaced')}
              className={`flex-1 py-1.5 px-1 rounded-[7px] text-[11px] font-[800] transition cursor-pointer text-center truncate ${
                effectiveOutcome === 'notPlaced'
                  ? 'bg-[#fef3c7] text-[#92400e] ring-1 ring-[#fde68a] shadow-2xs'
                  : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9]'
              }`}
            >
              Not Yet Placed
            </button>
            <button
              type="button"
              onClick={() => onSelectOutcome('notEligible')}
              className={`flex-1 py-1.5 px-1 rounded-[7px] text-[11px] font-[800] transition cursor-pointer text-center truncate ${
                effectiveOutcome === 'notEligible'
                  ? 'bg-[#fee2e2] text-[#991b1b] ring-1 ring-[#fecaca] shadow-2xs'
                  : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9]'
              }`}
            >
              Not Eligible
            </button>
            <button
              type="button"
              onClick={() => onSelectOutcome('higherStudies')}
              className={`flex-1 py-1.5 px-1 rounded-[7px] text-[11px] font-[800] transition cursor-pointer text-center truncate ${
                effectiveOutcome === 'higherStudies'
                  ? 'bg-[#f3e8ff] text-[#7e22ce] ring-1 ring-[#e9d5ff] shadow-2xs'
                  : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9]'
              }`}
            >
              Higher Studies
            </button>
            <button
              type="button"
              onClick={() => onSelectOutcome('entrepreneur')}
              className={`flex-1 py-1.5 px-1 rounded-[7px] text-[11px] font-[800] transition cursor-pointer text-center truncate ${
                effectiveOutcome === 'entrepreneur'
                  ? 'bg-[#ecfeff] text-[#0e7490] ring-1 ring-[#cffafe] shadow-2xs'
                  : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9]'
              }`}
            >
              Entrepreneurship
            </button>
          </div>
        )}
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 p-[18px_22px] overflow-y-auto space-y-4 custom-dropdown-scroll">
        {activeMode === 'students' ? (
          <>
            {/* Top Students Count Card (Reference Style) */}
            <div className="p-4.5 rounded-[13px] border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-[#f5f3ff] shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-[14.5px] font-[850] text-[#172554] leading-tight">
                  Students
                </div>
                <div className="text-[11.5px] font-medium text-[#64748b] mt-0.5">
                  Institutional count
                </div>
              </div>

              <div className="text-[34px] font-[900] text-[#172554] leading-none tracking-tight">
                {loadingStudents ? '...' : outcomeStudents.length}
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative group">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] group-focus-within:text-[#2563eb] transition-colors pointer-events-none">
                <Search size={15} />
              </span>
              <input
                type="text"
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                placeholder="Search student or roll number..."
                className="w-full h-[40px] pl-[38px] pr-[32px] bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[13px] font-medium text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition-all shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
              />
              {studentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setStudentSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] transition cursor-pointer p-0.5 rounded-full hover:bg-[#f1f5f9]"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Students List Cards */}
            <div className="space-y-2.5">
              {loadingStudents ? (
                <div className="py-14 text-center text-[12px] text-[#64748b] font-medium flex flex-col items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#2563eb] mb-2" />
                  Loading students from database...
                </div>
              ) : outcomeStudents.length === 0 ? (
                <div className="py-10 text-center text-[12px] text-[#94a3b8] font-medium bg-[#f8fafc] rounded-[12px] border border-dashed border-[#cbd5e1] p-6">
                  No students found in {currentOutcomeTitle} for the selected filters.
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-10 text-center text-[12px] text-[#94a3b8] font-medium bg-[#f8fafc] rounded-[12px] border border-dashed border-[#cbd5e1] p-6">
                  No students match &ldquo;{studentSearchQuery}&rdquo;
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const initials = getInitials(s.name)
                  return (
                    <div
                      key={s.id}
                      className="bg-white border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-xs rounded-[12px] p-3.5 flex items-center justify-between gap-3 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rounded Avatar Initials */}
                        <div className="w-[42px] h-[42px] rounded-[10px] bg-[#eff6ff] border border-[#bfdbfe] text-[#2563eb] font-[850] text-[13px] flex items-center justify-center shrink-0 group-hover:bg-[#2563eb] group-hover:text-white transition-colors">
                          {initials}
                        </div>

                        {/* Name & Roll/Dept */}
                        <div className="min-w-0">
                          <div className="text-[14px] font-[800] text-[#1e293b] leading-tight truncate group-hover:text-[#2563eb] transition-colors">
                            {s.name}
                          </div>
                          <div className="text-[11.5px] font-semibold text-[#64748b] mt-1 truncate">
                            {s.roll_no} {s.department_code ? `· ${s.department_code}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Status Pill */}
                      <span className={`px-3 py-1 rounded-full text-[11px] font-[800] shrink-0 whitespace-nowrap shadow-2xs ${getStatusPillClass(effectiveOutcome)}`}>
                        {s.status}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </>
        ) : (
          /* Overview Mode */
          <div className="space-y-6">
            <div className="p-4.5 rounded-[13px] border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-[#f5f3ff] shadow-2xs flex flex-col gap-3.5">
              {/* Top Label & Active Filters */}
              <div>
                <div className="text-[14px] font-[850] text-[#172554] tracking-tight leading-tight">
                  Placement Outcome
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[#dbeafe] text-[#1e40af] text-[11px] font-[800] border border-[#bfdbfe]">
                    {batchFilterLabel}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-white text-[#475569] text-[11px] font-[750] border border-[#dbe5f1]">
                    {deptFilterLabel}
                  </span>
                </div>
              </div>

              {/* Pipeline (% of Placed) */}
              <div className="mt-1">
                <div className="flex items-center justify-between text-[11.5px] font-bold text-[#475569] mb-1.5">
                  <span>Pipeline (% of placed)</span>
                  <span className="text-[#2563eb] font-[850] text-[13px]">{placedPercentage}% Placed</span>
                </div>
                <div className="h-[9px] bg-[#dbe5f1] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa] transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, placedPercentage))}%` }}
                  />
                </div>
              </div>

              {/* Breakdown Pills: Interested, Placed, Percentage */}
              <div className="grid grid-cols-3 gap-2 pt-3 mt-1 border-t border-[#bfdbfe]/60 text-center">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase font-[800] text-[#64748b] tracking-wider">
                    Interested
                  </span>
                  <span className="text-[16px] font-[850] text-[#172554] mt-0.5">
                    {interestedCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col border-x border-[#bfdbfe]/60">
                  <span className="text-[11px] uppercase font-[800] text-[#64748b] tracking-wider">
                    Placed
                  </span>
                  <span className="text-[16px] font-[850] text-[#16a34a] mt-0.5">
                    {placedCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase font-[800] text-[#64748b] tracking-wider">
                    Placed %
                  </span>
                  <span className="text-[16px] font-[850] text-[#2563eb] mt-0.5">
                    {placedPercentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* How to Read the Two Tables */}
            <div>
              <h3 className="text-[14px] font-[850] text-[#1e293b] mb-2.5 m-0">
                How to Read the Two Tables
              </h3>
              <div className="p-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-[11px] text-[12.5px] leading-relaxed text-[#1e40af] shadow-2xs">
                <p className="m-0 mb-2.5">
                  <strong className="font-[850] text-[#172554]">Offer Volume</strong> answers how much opportunity recruiters generated.
                </p>
                <p className="m-0">
                  <strong className="font-[850] text-[#172554]">Unique Students</strong> answers how many different students actually possess each level of outcome.
                </p>
              </div>
            </div>

            {/* Placement Outcome Structure */}
            <div>
              <h3 className="text-[14px] font-[850] text-[#1e293b] mb-2.5 m-0">
                Placement Outcome Structure
              </h3>
              <div className="bg-white border border-[#dbe5f1] rounded-[12px] p-3.5 shadow-2xs divide-y divide-[#f1f5f9]">
                <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
                  <span className="text-[#64748b] font-semibold">High Compensation</span>
                  <span className="text-[#1e293b] font-[800]">Students whose best offer is ₹20 LPA and above.</span>
                </div>
                <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
                  <span className="text-[#64748b] font-semibold">Core Placement</span>
                  <span className="text-[#1e293b] font-[800]">Students holding confirmed employment offers.</span>
                </div>
                <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
                  <span className="text-[#64748b] font-semibold">Higher Studies</span>
                  <span className="text-[#1e293b] font-[800]">Verified admission or enrolment outcome.</span>
                </div>
                <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
                  <span className="text-[#64748b] font-semibold">Entrepreneurship</span>
                  <span className="text-[#1e293b] font-[800]">Verified startup / venture pathway.</span>
                </div>
                <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
                  <span className="text-[#64748b] font-semibold">Not Placed</span>
                  <span className="text-[#1e293b] font-[800]">Placement interested students without a confirmed offer.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
