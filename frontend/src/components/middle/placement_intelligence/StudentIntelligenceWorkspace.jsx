import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Download, RotateCcw, ChevronDown, Check, Loader2 } from 'lucide-react'
import { getIntelligenceStudents } from '../../../services/api'

// Sort factors matching the user specifications
const SORT_OPTIONS = [
  { id: 'intervention', label: 'Intervention Priority' },
  { id: 'appeared', label: 'Companies Appeared' },
  { id: 'offers', label: 'Number of Offers' },
  { id: 'finalMisses', label: 'Final Misses' },
  { id: 'package', label: 'Best Package' },
  { id: 'name', label: 'Student Name' }
]

const FOCUS_CONFIG = {
  placed: { label: 'Placed', bg: 'bg-[#ecfdf5]', text: 'text-[#059669]', border: 'border-[#a7f3d0]' },
  not_placed: { label: 'Not Placed', bg: 'bg-[#fef3c7]', text: 'text-[#b45309]', border: 'border-[#fde68a]' },
  high_cgpa: { label: 'High CGPA · Unplaced (≥ 8.5 CGPA)', bg: 'bg-[#dbeafe]', text: 'text-[#1d4ed8]', border: 'border-[#bfdbfe]' },
  final_misses: { label: 'Repeated Final Misses (2+ misses)', bg: 'bg-[#fee2e2]', text: 'text-[#b91c1c]', border: 'border-[#fecaca]' },
  placement_interest: { label: 'Placement Interest (IP)', bg: 'bg-[#ede9fe]', text: 'text-[#6d28d9]', border: 'border-[#ddd6fe]' },
  nip: { label: 'Not Interested in Placement (NIP)', bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', border: 'border-[#cbd5e1]' }
}

const FALLBACK_BATCHES = ['2022-2026', '2023-2027', '2024-2028', '2025-2029']

const FALLBACK_DEPARTMENTS = [
  { id: 1, name: 'Computer Science and Engineering', short_code: 'CSE' },
  { id: 2, name: 'Information Technology', short_code: 'IT' },
  { id: 3, name: 'Electronics and Communication Engineering', short_code: 'ECE' },
  { id: 5, name: 'Artificial Intelligence and Data Science', short_code: 'AI & DS' }
]

// Two-letter initials helper for student avatar
function getInitials(name) {
  if (!name) return 'ST'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function StudentIntelligenceWorkspace({
  selectedStudent = null,
  onSelectStudent = () => {},
  selectedStudentFocus = 'all',
  onSelectStudentFocus = () => {},
  onStudentSignalsLoaded = () => {}
}) {
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [data, setData] = useState(null)

  // Filters State - default to first batch (2022-2026), All Departments, and Intervention Priority sort
  const [selectedBatch, setSelectedBatch] = useState('2022-2026')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedSort, setSelectedSort] = useState('intervention')
  const [activeStudentId, setActiveStudentId] = useState(null)

  const selectedStudentRef = useRef(selectedStudent)
  const onSelectStudentRef = useRef(onSelectStudent)

  useEffect(() => {
    selectedStudentRef.current = selectedStudent
  }, [selectedStudent])

  useEffect(() => {
    onSelectStudentRef.current = onSelectStudent
  }, [onSelectStudent])

  // Synchronize activeStudentId when selectedStudent changes externally
  useEffect(() => {
    if (selectedStudent?.id) {
      setActiveStudentId(selectedStudent.id)
    } else if (!selectedStudent) {
      setActiveStudentId(null)
    }
  }, [selectedStudent])

  // Dropdown Open States
  const [isBatchOpen, setIsBatchOpen] = useState(false)
  const [isDeptOpen, setIsDeptOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)

  const batchRef = useRef(null)
  const deptRef = useRef(null)
  const sortRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (batchRef.current && !batchRef.current.contains(e.target)) setIsBatchOpen(false)
      if (deptRef.current && !deptRef.current.contains(e.target)) setIsDeptOpen(false)
      if (sortRef.current && !sortRef.current.contains(e.target)) setIsSortOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch real students from MySQL DB endpoint
  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const res = await getIntelligenceStudents({
          batch: selectedBatch,
          department: selectedDept,
          sort: selectedSort,
          focus: selectedStudentFocus
        })

        if (res) {
          setData(res)
          if (res.signals && onStudentSignalsLoaded) {
            onStudentSignalsLoaded(res.signals)
          }
          if (res.selected_batch && !selectedBatch) {
            setSelectedBatch(res.selected_batch)
          }

          const studentList = res.students || []
          if (studentList.length > 0) {
            const currentSelected = selectedStudentRef.current
            const stillExists = currentSelected
              ? studentList.find((s) => s.id === currentSelected.id)
              : null
            const targetStudent = stillExists || studentList[0]
            setActiveStudentId(targetStudent.id)
            if (onSelectStudentRef.current) {
              onSelectStudentRef.current(targetStudent)
            }
          } else {
            setActiveStudentId(null)
            if (onSelectStudentRef.current) {
              onSelectStudentRef.current(null)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load student placement intelligence:', err)
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [selectedBatch, selectedDept, selectedSort, selectedStudentFocus, onStudentSignalsLoaded]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const batches = data?.batches && data.batches.length > 0 ? data.batches : FALLBACK_BATCHES
  const departments = data?.departments && data.departments.length > 0 ? data.departments : FALLBACK_DEPARTMENTS
  const students = data?.students || []
  const signals = data?.signals || {
    students_in_view: 0,
    placed: 0,
    not_placed: 0,
    repeated_final_misses: 0,
    multiple_offers: 0
  }

  // Reset Filters handler
  const handleResetFilters = () => {
    const defaultBatch = batches[0] ? String(batches[0]).replace(/^batch\s*/i, '').trim() : '2022-2026'
    setSelectedBatch(defaultBatch)
    setSelectedDept('all')
    setSelectedSort('intervention')
    if (onSelectStudentFocus) {
      onSelectStudentFocus('all')
    }
  }

  // Export table data to CSV
  const handleExport = () => {
    if (!students || students.length === 0) return
    const headers = ['Student Name', 'Roll No', 'Department', 'Invites', 'Appeared', 'Final', 'Final Misses', 'Offers', 'Package (LPA)', 'Outcome']
    const rows = students.map((s) => [
      `"${s.name || ''}"`,
      `"${s.roll_no || ''}"`,
      `"${s.department || ''}"`,
      s.invites,
      s.appeared,
      s.final,
      s.final_misses,
      s.offers,
      s.best_package > 0 ? `₹${s.best_package} LPA` : '-',
      `"${s.outcome || ''}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Student_Placement_Intelligence_${selectedBatch || 'all'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Label resolvers
  const currentSortLabel = SORT_OPTIONS.find((s) => s.id === selectedSort)?.label || 'Intervention Priority'
  const currentDeptLabel = useMemo(() => {
    if (!selectedDept || selectedDept === 'all') return 'All Departments'
    const found = departments.find(
      (d) =>
        String(d.id) === String(selectedDept) ||
        (d.short_code && d.short_code.toLowerCase() === selectedDept.toLowerCase()) ||
        (d.name && d.name.toLowerCase() === selectedDept.toLowerCase())
    )
    if (found) {
      return found.short_code || found.name
    }
    return selectedDept
  }, [selectedDept, departments])

  // Badge renderers
  const renderOutcomeBadge = (outcome) => {
    switch (outcome) {
      case 'Placed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-[750] bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
            Placed
          </span>
        )
      case 'Not Placed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-[750] bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
            Not Placed
          </span>
        )
      case 'Higher Studies':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-[750] bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe]">
            Higher Studies
          </span>
        )
      case 'Entrepreneurship':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-[750] bg-[#ecfeff] text-[#0891b2] border border-[#a5f3fc]">
            Entrepreneurship
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-[750] bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
            {outcome || 'Unknown'}
          </span>
        )
    }
  }

  return (
    <section className="flex-1 min-w-[700px] bg-[#f8fafc] h-full overflow-y-auto hide-scrollbar flex flex-col select-none">
      {/* 1. Header (Title, Subtitle, Actions) */}
      <div className="p-[20px_24px_16px] bg-white border-b border-[#edf2f7] shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-[850] text-[#172554] tracking-tight leading-tight m-0">
              Student Placement Intelligence
            </h1>
            <p className="text-[12px] text-[#64748b] mt-1 font-medium leading-relaxed">
              Understand opportunity exposure, recruitment conversion, placement discipline, eligibility and final outcomes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              className="h-[36px] px-3.5 rounded-[9px] border border-[#dbe5f1] bg-white text-[#475569] text-[12.5px] font-[700] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-98"
            >
              <Download size={13} className="text-[#64748b]" />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="h-[36px] px-4 rounded-[9px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[12.5px] font-[750] transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-98 disabled:opacity-75"
            >
              <RotateCcw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Filter Controls Bar */}
      <div className="px-[24px] py-[14px] bg-white border-b border-[#edf2f7] flex items-center gap-3 flex-wrap shrink-0">
        {/* Batch Dropdown */}
        <div className="relative inline-block" ref={batchRef}>
          <button
            type="button"
            onClick={() => {
              setIsBatchOpen((prev) => !prev)
              setIsDeptOpen(false)
              setIsSortOpen(false)
            }}
            className="h-[36px] px-3 rounded-[9px] border border-[#dbe5f1] bg-white hover:border-[#93c5fd] transition flex items-center gap-2 text-[12.5px] cursor-pointer shadow-2xs"
          >
            <span className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
              Batch
            </span>
            <span className="font-[750] text-[#1e293b]">
              {selectedBatch ? (selectedBatch.startsWith('Batch') ? selectedBatch : `Batch ${selectedBatch}`) : 'Batch 2022-2026'}
            </span>
            <ChevronDown size={14} className="text-[#64748b] ml-0.5" />
          </button>

          {isBatchOpen && (
            <div className="absolute top-[42px] left-0 min-w-[170px] bg-white rounded-[10px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] border border-[#dbe5f1] py-1.5 z-50 animate-in fade-in duration-100">
              {batches.map((b) => {
                const bName = typeof b === 'object' ? b.name : b
                const cleanB = String(bName).replace(/^batch\s*/i, '').trim()
                const isSelected = String(selectedBatch).replace(/^batch\s*/i, '').trim() === cleanB
                return (
                  <button
                    key={cleanB}
                    type="button"
                    onClick={() => {
                      setSelectedBatch(cleanB)
                      setIsBatchOpen(false)
                    }}
                    className={`w-full px-3.5 py-2 text-left text-[12.5px] flex items-center justify-between transition cursor-pointer ${
                      isSelected ? 'bg-[#eff6ff] text-[#2563eb] font-[750]' : 'text-[#334155] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <span>Batch {cleanB}</span>
                    {isSelected && <Check size={14} className="text-[#2563eb]" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Department Dropdown */}
        <div className="relative inline-block" ref={deptRef}>
          <button
            type="button"
            onClick={() => {
              setIsDeptOpen((prev) => !prev)
              setIsBatchOpen(false)
              setIsSortOpen(false)
            }}
            className="h-[36px] px-3 rounded-[9px] border border-[#dbe5f1] bg-white hover:border-[#93c5fd] transition flex items-center gap-2 text-[12.5px] cursor-pointer shadow-2xs"
          >
            <span className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
              Department
            </span>
            <span className="font-[750] text-[#1e293b]">{currentDeptLabel}</span>
            <ChevronDown size={14} className="text-[#64748b] ml-0.5" />
          </button>

          {isDeptOpen && (
            <div className="absolute top-[42px] left-0 min-w-[240px] bg-white rounded-[10px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] border border-[#dbe5f1] py-1.5 z-50 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedDept('all')
                  setIsDeptOpen(false)
                }}
                className={`w-full px-3.5 py-2 text-left text-[12.5px] flex items-center justify-between transition cursor-pointer ${
                  selectedDept === 'all' ? 'bg-[#eff6ff] text-[#2563eb] font-[750]' : 'text-[#334155] hover:bg-[#f8fafc]'
                }`}
              >
                <span>All Departments</span>
                {selectedDept === 'all' && <Check size={14} className="text-[#2563eb]" />}
              </button>
              {departments.map((dept) => {
                const isSelected =
                  String(selectedDept).toLowerCase() === String(dept.short_code || dept.name).toLowerCase() ||
                  String(selectedDept) === String(dept.id)
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setSelectedDept(dept.short_code || dept.name)
                      setIsDeptOpen(false)
                    }}
                    className={`w-full px-3.5 py-2 text-left text-[12.5px] flex items-center justify-between transition cursor-pointer ${
                      isSelected ? 'bg-[#eff6ff] text-[#2563eb] font-[750]' : 'text-[#334155] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <span>{dept.short_code ? `${dept.short_code} - ${dept.name}` : dept.name}</span>
                    {isSelected && <Check size={14} className="text-[#2563eb]" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="relative inline-block" ref={sortRef}>
          <button
            type="button"
            onClick={() => {
              setIsSortOpen((prev) => !prev)
              setIsBatchOpen(false)
              setIsDeptOpen(false)
            }}
            className="h-[36px] px-3 rounded-[9px] border border-[#dbe5f1] bg-white hover:border-[#93c5fd] transition flex items-center gap-2 text-[12.5px] cursor-pointer shadow-2xs"
          >
            <span className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
              Sort
            </span>
            <span className="font-[750] text-[#1e293b]">{currentSortLabel}</span>
            <ChevronDown size={14} className="text-[#64748b] ml-0.5" />
          </button>

          {isSortOpen && (
            <div className="absolute top-[42px] left-0 min-w-[200px] bg-white rounded-[10px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] border border-[#dbe5f1] py-1.5 z-50 animate-in fade-in duration-100">
              {SORT_OPTIONS.map((opt) => {
                const isSelected = selectedSort === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedSort(opt.id)
                      setIsSortOpen(false)
                    }}
                    className={`w-full px-3.5 py-2 text-left text-[12.5px] flex items-center justify-between transition cursor-pointer ${
                      isSelected ? 'bg-[#eff6ff] text-[#2563eb] font-[750]' : 'text-[#334155] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={14} className="text-[#2563eb]" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Active Focus Pill if card selected from left panel */}
        {selectedStudentFocus && selectedStudentFocus !== 'all' && selectedStudentFocus !== 'all_students' && (
          <div className={`h-[34px] px-3 rounded-[8px] border text-[12px] font-[750] flex items-center gap-2 ${
            FOCUS_CONFIG[selectedStudentFocus]?.bg || 'bg-[#eff6ff]'
          } ${FOCUS_CONFIG[selectedStudentFocus]?.text || 'text-[#2563eb]'} ${
            FOCUS_CONFIG[selectedStudentFocus]?.border || 'border-[#bfdbfe]'
          }`}>
            <span>Filter: {FOCUS_CONFIG[selectedStudentFocus]?.label || selectedStudentFocus}</span>
            <button
              type="button"
              onClick={() => onSelectStudentFocus('all')}
              className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10 cursor-pointer font-bold"
              title="Clear category filter"
            >
              ×
            </button>
          </div>
        )}

        {/* Spacer & Reset Filters */}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleResetFilters}
          className="h-[34px] px-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#64748b] hover:text-[#1e293b] hover:bg-[#f8fafc] text-[12px] font-[650] transition cursor-pointer shadow-2xs"
        >
          Reset Filters
        </button>
      </div>

      {/* 3. Signal Summary Count Bar (matching light blue styling of other tabs) */}
      <div className="px-[24px] pt-[14px] pb-[8px]">
        <div className="flex items-center gap-6 px-4 py-2.5 bg-[#eff6ff]/70 border border-[#bfdbfe]/80 rounded-[10px] shadow-2xs flex-wrap text-[12px]">
          <div className="flex items-center gap-2 font-medium text-[#1e293b]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0" />
            <span className="font-[850] text-[#0f172a]">{signals.students_in_view}</span>
            <span className="text-[#475569]">students in view</span>
          </div>

          <div className="flex items-center gap-2 font-medium text-[#1e293b]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] shrink-0" />
            <span className="font-[850] text-[#0f172a]">{signals.placed}</span>
            <span className="text-[#475569]">placed</span>
          </div>

          <div className="flex items-center gap-2 font-medium text-[#1e293b]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d97706] shrink-0" />
            <span className="font-[850] text-[#0f172a]">{signals.not_placed}</span>
            <span className="text-[#475569]">not placed</span>
          </div>

          <div className="flex items-center gap-2 font-medium text-[#1e293b]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] shrink-0" />
            <span className="font-[850] text-[#0f172a]">{signals.repeated_final_misses}</span>
            <span className="text-[#475569]">repeated final misses</span>
          </div>

          <div className="flex items-center gap-2 font-medium text-[#1e293b]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed] shrink-0" />
            <span className="font-[850] text-[#0f172a]">{signals.multiple_offers}</span>
            <span className="text-[#475569]">multiple offers</span>
          </div>
        </div>
      </div>

      {/* 4. Table Section */}
      <div className="px-[24px] py-[12px] flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <h2 className="text-[15px] font-[800] text-[#1e293b] tracking-tight m-0">
              Student Opportunity, Conversion & Outcome
            </h2>
            <p className="text-[12px] text-[#64748b] mt-0.5 font-normal">
              This table is designed for intervention: opportunity exposure, round conversion, placement discipline and final outcome.
            </p>
          </div>
          <span className="text-[12px] font-[700] text-[#64748b] bg-white px-2.5 py-1 rounded-[6px] border border-[#e2e8f0]">
            {students.length} students
          </span>
        </div>

        {/* Table Container Card */}
        <div className="flex-1 bg-white rounded-[12px] border border-[#e2e8f0] shadow-2xs overflow-hidden flex flex-col min-h-[300px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#64748b]">
              <Loader2 className="w-8 h-8 animate-spin text-[#2563eb] mb-2" />
              <span className="text-[13px] font-medium">Loading students data...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#64748b]">
              <span className="text-[14px] font-[700] text-[#1e293b] mb-1">No students found</span>
              <span className="text-[12.5px]">Try adjusting your batch or department filter.</span>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#edf2f7] bg-[#f8fafc] text-[11px] font-[850] text-[#475569] uppercase tracking-[0.5px] select-none sticky top-0 z-10">
                    <th className="py-3 px-4 min-w-[200px]">STUDENT</th>
                    <th className="py-3 px-3">DEPT</th>
                    <th className="py-3 px-3 text-center">INVITES</th>
                    <th className="py-3 px-3 text-center">APPEARED</th>
                    <th className="py-3 px-3 text-center">FINAL</th>
                    <th className="py-3 px-3 text-center">FINAL MISSES</th>
                    <th className="py-3 px-3 text-center">OFFERS</th>
                    <th className="py-3 px-3 text-center">PACKAGE</th>
                    <th className="py-3 px-4 min-w-[130px]">OUTCOME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[12.5px]">
                  {students.map((s) => {
                    const isSelected = activeStudentId === s.id || (selectedStudent && selectedStudent.id === s.id)
                    return (
                      <tr
                        key={s.id}
                        onClick={() => {
                          setActiveStudentId(s.id)
                          onSelectStudent(s)
                        }}
                        className={`transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-[#eff6ff] hover:bg-[#e0e7ff]'
                            : 'hover:bg-[#f8fafc]'
                        }`}
                      >
                        {/* Student Name & Roll No */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] flex items-center justify-center font-[800] text-[11px] shrink-0">
                              {getInitials(s.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-[750] text-[#1e293b] group-hover:text-[#2563eb] transition-colors truncate">
                                {s.name}
                              </div>
                              <div className="text-[11px] font-medium text-[#64748b] tracking-wide mt-0.5">
                                {s.roll_no || `ID: ${s.id}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Dept */}
                        <td className="py-3 px-3 font-[650] text-[#475569]">
                          {s.department || '-'}
                        </td>

                        {/* Invites */}
                        <td className="py-3 px-3 text-center font-[700] text-[#334155]">
                          {s.invites}
                        </td>

                        {/* Appeared */}
                        <td className="py-3 px-3 text-center font-[750] text-[#2563eb]">
                          {s.appeared}
                        </td>

                        {/* Final */}
                        <td className="py-3 px-3 text-center font-[700] text-[#334155]">
                          {s.final}
                        </td>

                        {/* Final Misses */}
                        <td className="py-3 px-3 text-center">
                          {s.final_misses >= 2 ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-[800] bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]">
                              {s.final_misses}
                            </span>
                          ) : (
                            <span className="font-[650] text-[#64748b]">{s.final_misses}</span>
                          )}
                        </td>

                        {/* Offers */}
                        <td className="py-3 px-3 text-center">
                          {s.offers >= 2 ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-[800] bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe]">
                              {s.offers}
                            </span>
                          ) : (
                            <span className={`font-[700] ${s.offers > 0 ? 'text-[#16a34a]' : 'text-[#64748b]'}`}>
                              {s.offers}
                            </span>
                          )}
                        </td>

                        {/* Package */}
                        <td className="py-3 px-3 text-center">
                          {s.best_package > 0 ? (
                            <span className="font-[750] text-[#059669]">
                              ₹{s.best_package} LPA
                            </span>
                          ) : (
                            <span className="text-[#94a3b8] font-medium">-</span>
                          )}
                        </td>

                        {/* Outcome */}
                        <td className="py-3 px-4">
                          {renderOutcomeBadge(s.outcome)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

