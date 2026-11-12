import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Download, RotateCcw, ChevronDown, Check, Loader2 } from 'lucide-react'
import { getIntelligenceCompanyStatistics } from '../../../services/api'

// Sort options matching template and user image
const SORT_OPTIONS = [
  { id: 'offers_desc', label: 'Offers · High → Low' },
  { id: 'package_desc', label: 'Package · High → Low' },
  { id: 'growth_desc', label: 'Growth · High → Low' },
  { id: 'decline_desc', label: 'Decline · Highest' },
  { id: 'name_asc', label: 'Company · A → Z' }
]

const SECTOR_OPTIONS = [
  { id: 'all', label: 'All Sectors' },
  { id: 'software', label: 'Software' },
  { id: 'core', label: 'Core' }
]

export default function CompanyStatisticsWorkspace({
  selectedCompany = 'All',
  onSelectCompany = () => {},
  selectedCompanyStatDetail = null,
  onSelectCompanyStatDetail = () => {},
  onCompanyStatisticsDataLoaded = () => {}
}) {
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [data, setData] = useState(null)

  // Filter States
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedSector, setSelectedSector] = useState('all')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedSort, setSelectedSort] = useState('offers_desc')

  // Dropdown Open States
  const [isBatchOpen, setIsBatchOpen] = useState(false)
  const [isSectorOpen, setIsSectorOpen] = useState(false)
  const [isDeptOpen, setIsDeptOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)

  const batchRef = useRef(null)
  const sectorRef = useRef(null)
  const deptRef = useRef(null)
  const sortRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (batchRef.current && !batchRef.current.contains(e.target)) setIsBatchOpen(false)
      if (sectorRef.current && !sectorRef.current.contains(e.target)) setIsSectorOpen(false)
      if (deptRef.current && !deptRef.current.contains(e.target)) setIsDeptOpen(false)
      if (sortRef.current && !sortRef.current.contains(e.target)) setIsSortOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch statistics from real MySQL DB endpoint
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      // If left panel has a status selected (Completed, Cancelled, Ongoing, Awaiting Final Result)
      const statusParam =
        selectedCompany && selectedCompany !== 'All' ? selectedCompany : ''

      const res = await getIntelligenceCompanyStatistics({
        batch: selectedBatch,
        sector: selectedSector,
        department: selectedDept,
        status: statusParam,
        sort: selectedSort
      })

      setData(res)
      if (typeof onCompanyStatisticsDataLoaded === 'function') {
        onCompanyStatisticsDataLoaded(res)
      }

      // Set default batch if none selected yet
      if (!selectedBatch && res?.selected_batch) {
        setSelectedBatch(res.selected_batch)
      }
    } catch (err) {
      console.error('Failed to load company statistics:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [selectedBatch, selectedSector, selectedDept, selectedSort, selectedCompany])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const batches = data?.batches || []
  const departments = data?.departments || []
  const companies = data?.companies || []
  const statusCounts = data?.status_counts || {
    completed: 0,
    cancelled: 0,
    ongoing: 0,
    awaiting_final_result: 0,
    total: 0
  }

  // Handle Reset Filters
  const handleResetFilters = () => {
    const firstBatch = batches.length > 0 ? batches[0] : ''
    setSelectedBatch(firstBatch)
    setSelectedSector('all')
    setSelectedDept('all')
    setSelectedSort('offers_desc')
    if (selectedCompany !== 'All') {
      onSelectCompany('All')
    }
  }

  // Export Table Data to CSV
  const handleExport = () => {
    if (!companies || companies.length === 0) return
    const headers = [
      'Company',
      'Sector',
      'Departments',
      'Status',
      'Present Stage',
      'Offers',
      'Last Year',
      'YoY',
      '3-Year Max',
      'Package (LPA)'
    ]
    const rows = companies.map((c) => [
      `"${c.company}"`,
      `"${c.sector}"`,
      `"${(c.departments || []).join('; ')}"`,
      `"${c.status}"`,
      `"${c.stage}"`,
      c.offers,
      c.last_year,
      c.yoy,
      c.max3,
      c.package
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Company_Placement_Statistics_${selectedBatch || 'Batch'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
            Completed
          </span>
        )
      case 'Cancelled':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3]">
            Cancelled
          </span>
        )
      case 'Ongoing':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
            Ongoing
          </span>
        )
      case 'Awaiting Final Result':
      case 'Awaiting Result':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#faf5ff] text-[#9333ea] border border-[#e9d5ff]">
            Awaiting Result
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
            {status}
          </span>
        )
    }
  }

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.id === selectedSort)?.label || 'Offers · High → Low'
  const currentSectorLabel =
    SECTOR_OPTIONS.find((s) => s.id === selectedSector)?.label || 'All Sectors'
  const currentDeptLabel = useMemo(() => {
    if (!selectedDept || selectedDept === 'all') return 'All Departments'
    const found = departments.find(
      (d) => d.short_code === selectedDept || d.name === selectedDept
    )
    if (found) {
      return found.short_code ? `${found.short_code} · ${found.name}` : found.name
    }
    return selectedDept
  }, [selectedDept, departments])

  return (
    <section className="flex-1 min-w-[700px] bg-[#f8fafc] h-full overflow-y-auto hide-scrollbar flex flex-col select-none">
      {/* 1. Header (Title, Subtitle, Actions) */}
      <div className="p-[20px_24px_16px] bg-white border-b border-[#edf2f7] shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-[850] text-[#172554] tracking-tight leading-tight m-0">
              Company-wise Placement Statistics
            </h1>
            <p className="text-[12px] text-[#64748b] mt-1 font-medium leading-relaxed">
              Rank recruiters by offers, salary package, historical performance and live recruitment status.
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
            onClick={() => setIsBatchOpen((prev) => !prev)}
            className="h-[36px] px-3 rounded-[9px] border border-[#dbe5f1] bg-white hover:border-[#93c5fd] transition flex items-center gap-2 text-[12.5px] cursor-pointer shadow-2xs"
          >
            <span className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
              Batch
            </span>
            <span className="font-[750] text-[#1e293b]">
              {selectedBatch ? `Batch ${selectedBatch}` : 'Select Batch'}
            </span>
            <ChevronDown size={14} className="text-[#64748b] ml-0.5" />
          </button>

          {isBatchOpen && (
            <div className="absolute top-[42px] left-0 min-w-[170px] bg-white rounded-[10px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] border border-[#dbe5f1] py-1.5 z-50 animate-in fade-in duration-100">
              {batches.map((b) => {
                const isSelected = selectedBatch === b
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setSelectedBatch(b)
                      setIsBatchOpen(false)
                    }}
                    className={`w-full px-3.5 py-2 text-left text-[12.5px] flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#eff6ff] text-[#2563eb] font-[750]'
                        : 'text-[#334155] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <span>Batch {b}</span>
                    {isSelected && <Check size={14} className="text-[#2563eb]" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Sector Dropdown */}
        <div className="relative inline-block" ref={sectorRef}>
          <button
            type="button"
            onClick={() => setIsSectorOpen((prev) => !prev)}
            className="h-[36px] px-3 rounded-[9px] border border-[#dbe5f1] bg-white hover:border-[#93c5fd] transition flex items-center gap-2 text-[12.5px] cursor-pointer shadow-2xs"
          >
            <span className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
              Sector
            </span>
            <span className="font-[750] text-[#1e293b]">
              {currentSectorLabel}
            </span>
            <ChevronDown size={14} className="text-[#64748b] ml-0.5" />
          </button>

          {isSectorOpen && (
            <div className="absolute top-[42px] left-0 min-w-[150px] bg-white rounded-[10px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] border border-[#dbe5f1] py-1.5 z-50 animate-in fade-in duration-100">
              {SECTOR_OPTIONS.map((sec) => {
                const isSelected = selectedSector === sec.id
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setSelectedSector(sec.id)
                      setIsSectorOpen(false)
                    }}
                    className={`w-full px-3.5 py-2 text-left text-[12.5px] flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#eff6ff] text-[#2563eb] font-[750]'
                        : 'text-[#334155] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <span>{sec.label}</span>
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
            onClick={() => setIsDeptOpen((prev) => !prev)}
            className="h-[36px] px-3 rounded-[9px] border border-[#dbe5f1] bg-white hover:border-[#93c5fd] transition flex items-center gap-2 text-[12.5px] cursor-pointer shadow-2xs"
          >
            <span className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
              Department
            </span>
            <span className="font-[750] text-[#1e293b] max-w-[200px] truncate">
              {currentDeptLabel}
            </span>
            <ChevronDown size={14} className="text-[#64748b] ml-0.5" />
          </button>

          {isDeptOpen && (
            <div className="absolute top-[42px] left-0 min-w-[260px] max-h-[280px] overflow-y-auto bg-white rounded-[10px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] border border-[#dbe5f1] py-1.5 z-50 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedDept('all')
                  setIsDeptOpen(false)
                }}
                className={`w-full px-3.5 py-2 text-left text-[12.5px] flex items-center justify-between transition cursor-pointer ${
                  selectedDept === 'all'
                    ? 'bg-[#eff6ff] text-[#2563eb] font-[750]'
                    : 'text-[#334155] hover:bg-[#f8fafc]'
                }`}
              >
                <span>All Departments</span>
                {selectedDept === 'all' && <Check size={14} className="text-[#2563eb]" />}
              </button>
              {departments
                .filter((dept) => {
                  const name = typeof dept === 'string' ? dept : dept.name || ''
                  const code = typeof dept === 'string' ? '' : dept.short_code || ''
                  return (
                    name.toLowerCase() !== 'placement' &&
                    code.toLowerCase() !== 'pl'
                  )
                })
                .map((dept) => {
                  const deptShort = typeof dept === 'object' ? dept.short_code || '' : ''
                  const deptName = typeof dept === 'object' ? dept.name : dept
                  const isSelected =
                    selectedDept === deptShort || selectedDept === deptName
                  return (
                    <button
                      key={typeof dept === 'object' ? dept.id : dept}
                      type="button"
                      onClick={() => {
                        setSelectedDept(deptShort || deptName)
                        setIsDeptOpen(false)
                      }}
                      className={`w-full px-3.5 py-2 text-left text-[12.5px] flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#eff6ff] text-[#2563eb] font-[750]'
                          : 'text-[#334155] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        {deptShort && (
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-[#f1f5f9] text-[#475569] font-bold text-[10.5px]">
                            {deptShort}
                          </span>
                        )}
                        <span className="truncate">{deptName}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-[#2563eb] shrink-0" />}
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
            onClick={() => setIsSortOpen((prev) => !prev)}
            className="h-[36px] px-3 rounded-[9px] border border-[#dbe5f1] bg-white hover:border-[#93c5fd] transition flex items-center gap-2 text-[12.5px] cursor-pointer shadow-2xs"
          >
            <span className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
              Sort
            </span>
            <span className="font-[750] text-[#1e293b]">
              {currentSortLabel}
            </span>
            <ChevronDown size={14} className="text-[#64748b] ml-0.5" />
          </button>

          {isSortOpen && (
            <div className="absolute top-[42px] left-0 min-w-[210px] bg-white rounded-[10px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] border border-[#dbe5f1] py-1.5 z-50 animate-in fade-in duration-100">
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
                      isSelected
                        ? 'bg-[#eff6ff] text-[#2563eb] font-[750]'
                        : 'text-[#334155] hover:bg-[#f8fafc]'
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

        <div className="flex-1" />

        {/* Reset Filters Button */}
        <button
          type="button"
          onClick={handleResetFilters}
          className="h-[34px] px-3 rounded-[8px] border border-[#dbe5f1] bg-white text-[#64748b] hover:text-[#1e293b] text-[12px] font-[750] hover:bg-[#f8fafc] transition cursor-pointer flex items-center gap-1 shadow-2xs"
        >
          Reset Filters
        </button>
      </div>

      {/* 3. Status Summary Pill Bar */}
      <div className="mx-[24px] mt-[14px] mb-[12px] p-[10px_16px] bg-[#eff6ff]/70 border border-[#bfdbfe]/70 rounded-[10px] flex items-center gap-6 flex-wrap text-[12px] shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 font-medium text-[#1e293b]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" />
          <span className="font-[850] text-[#0f172a]">{statusCounts.completed}</span> completed
        </div>

        <div className="flex items-center gap-2 font-medium text-[#1e293b]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shrink-0" />
          <span className="font-[850] text-[#0f172a]">{statusCounts.ongoing}</span> ongoing
        </div>

        <div className="flex items-center gap-2 font-medium text-[#1e293b]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] shrink-0" />
          <span className="font-[850] text-[#0f172a]">{statusCounts.awaiting_final_result}</span> awaiting final result
        </div>

        <div className="flex items-center gap-2 font-medium text-[#1e293b]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] shrink-0" />
          <span className="font-[850] text-[#0f172a]">{statusCounts.cancelled}</span> cancelled
        </div>

        {selectedCompany && selectedCompany !== 'All' && (
          <div className="ml-auto flex items-center gap-1.5 text-[11.5px] font-[750] text-[#2563eb]">
            <span>Filtered by left panel:</span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-[#93c5fa] font-bold">
              {selectedCompany}
            </span>
          </div>
        )}
      </div>

      {/* 4. Table Workspace */}
      <div className="flex-1 px-[24px] pb-[24px]">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#94a3b8]">
            <Loader2 className="w-6 h-6 animate-spin text-[#2563eb] mb-2" />
            <span className="text-[13px] font-semibold text-[#64748b]">
              Loading company placement statistics from MySQL...
            </span>
          </div>
        ) : (
          <section className="space-y-3">
            {/* Table Header Section */}
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-[850] text-[#1e293b] leading-tight m-0">
                  Recruiter Performance Ranking
                </h2>
                <p className="text-[11.5px] text-[#64748b] mt-1 font-medium">
                  Completed, ongoing, result-awaiting and cancelled companies remain visible in one operational table.
                </p>
              </div>
              <span className="text-[12px] font-bold text-[#64748b]">
                {companies.length} {companies.length === 1 ? 'company' : 'companies'}
              </span>
            </div>

            {/* Table Card */}
            <div className="bg-white border border-[#dbe5f1] rounded-[12px] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto custom-table-scroll p-1">
                <table className="w-full border-collapse min-w-[1100px] text-[12.5px]">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#dbe5f1]">
                      <th className="px-5 py-3.5 text-left text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[180px]">
                        Company
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[110px]">
                        Sector
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[200px]">
                        Departments
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[120px]">
                        Status
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[180px]">
                        Present Stage
                      </th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[90px]">
                        Offers
                      </th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[90px]">
                        Last Year
                      </th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[90px]">
                        YoY
                      </th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[100px]">
                        3-Year Max
                      </th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[110px]">
                        Package
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2f7]">
                    {companies.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-[13px] text-[#94a3b8] font-medium">
                          No companies match the selected filter criteria.
                        </td>
                      </tr>
                    ) : (
                      companies.map((comp) => {
                        const delta = comp.yoy
                        const isSelected =
                          selectedCompanyStatDetail &&
                          (selectedCompanyStatDetail.company_id === comp.company_id ||
                            selectedCompanyStatDetail.company === comp.company)
                        return (
                          <tr
                            key={comp.company_id || comp.company}
                            onClick={() => onSelectCompanyStatDetail(isSelected ? null : comp)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#eff6ff] ring-1 ring-inset ring-[#3b82f6]/40'
                                : 'hover:bg-[#f8fafc]'
                            }`}
                          >
                            <td className="px-5 py-3.5 font-[850] text-[#1e293b] whitespace-nowrap">
                              {comp.company}
                            </td>
                            <td className="px-4 py-3.5 text-[#475569] font-medium whitespace-nowrap">
                              {comp.sector}
                            </td>
                            <td className="px-4 py-3.5 text-[#475569] font-medium text-[12px]">
                              {(comp.departments || []).join(', ')}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              {renderStatusBadge(comp.status)}
                            </td>
                            <td className="px-4 py-3.5 text-[#334155] font-semibold text-[12px] whitespace-nowrap">
                              {comp.stage}
                            </td>
                            <td className="px-4 py-3.5 text-center font-[850] text-[#1e293b] whitespace-nowrap">
                              {comp.offers}
                            </td>
                            <td className="px-4 py-3.5 text-center text-[#64748b] font-medium whitespace-nowrap">
                              {comp.last_year}
                            </td>
                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                              {comp.last_year === 0 ? (
                                <span className="text-[#94a3b8]">—</span>
                              ) : delta > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                                  +{delta}
                                </span>
                              ) : delta < 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3]">
                                  {delta}
                                </span>
                              ) : (
                                <span className="text-[#64748b] font-semibold">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center text-[#64748b] font-medium whitespace-nowrap">
                              {comp.max3 > 0 ? comp.max3 : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-center font-[800] text-[#1e293b] whitespace-nowrap">
                              {comp.package > 0 ? `₹${comp.package} LPA` : '—'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </section>
  )
}

