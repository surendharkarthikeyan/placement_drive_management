import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Loader2,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Briefcase,
  Calendar,
  Award,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  Check,
  Sparkles,
  TrendingUp,
  Layers,
  GraduationCap,
  XCircle,
  Hourglass
} from 'lucide-react'
import {
  getIntelligenceOverallStats,
  exportIntelligenceExcel,
  getBatches,
  getDepartments,
  getIntelligenceIndustryMatrix,
  getIntelligenceCompanyDrives
} from '../../../services/api'

/**
 * IntelligenceMiddlePanel
 * Center / Workspace Panel for Placement Intelligence:
 * - Header: Title, subtitle, Export, Refresh Data
 * - Top Filters: Batch, Department, Reset Filters
 * - Signal Bar: Total offers, Unique offer holders, Not yet placed, Higher studies, Entrepreneurship
 * - Table 1: Number of Offers by Salary Scale
 * - Table 2: Unique Students by Best Offer
 *
 * Real-time data from MySQL database with instant responsiveness.
 */
export default function IntelligenceMiddlePanel({
  currentView = 'overall',
  selectedBatch: externalBatch = null,
  onSelectBatch = () => {},
  selectedDepartment: externalDepartment = 'All',
  onSelectDepartment = () => {},
  selectedOutcome = 'notPlaced',
  onSelectOutcome = () => {},
  onSelectDetail = () => {},
  selectedIndustry = null,
  onSelectIndustry = () => {},
  selectedIndustryCell = null,
  selectedIndustryDomain = 'all',
  onSelectIndustryDomain = () => {}
}) {
  // Filters State
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('All')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All')

  // DB Data State
  const [batchesList, setBatchesList] = useState([])
  const [departmentsList, setDepartmentsList] = useState([])
  const [matrixData, setMatrixData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Industries View State (Recruiter Network Health from Real DB)
  const [industryDeptFilter, setIndustryDeptFilter] = useState('All')
  const [industryData, setIndustryData] = useState(null)
  const [isIndustryLoading, setIsIndustryLoading] = useState(false)
  const [isIndustryRefreshing, setIsIndustryRefreshing] = useState(false)
  const [isIndustryExporting, setIsIndustryExporting] = useState(false)
  const tableScrollRef = useRef(null)

  // Company Recruitment Drives State (when a company card is selected in left panel)
  const [companyDrivesData, setCompanyDrivesData] = useState(null)
  const [isCompanyDrivesLoading, setIsCompanyDrivesLoading] = useState(false)
  const [isCompanyDrivesRefreshing, setIsCompanyDrivesRefreshing] = useState(false)
  const [companyDrivesBatchFilter, setCompanyDrivesBatchFilter] = useState('All')
  const [companyDrivesRoleFilter, setCompanyDrivesRoleFilter] = useState('All Roles')
  const [companyDrivesDeptFilter, setCompanyDrivesDeptFilter] = useState('All Departments')

  const scrollTable = (direction) => {
    if (tableScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260
      tableScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  // Sync externalBatch from left panel if changed
  useEffect(() => {
    if (externalBatch) {
      setSelectedBatchFilter(externalBatch)
    } else {
      setSelectedBatchFilter('All')
    }
  }, [externalBatch])

  // Sync externalDepartment if changed
  useEffect(() => {
    if (externalDepartment) {
      setSelectedDeptFilter(externalDepartment)
    } else {
      setSelectedDeptFilter('All')
    }
  }, [externalDepartment])

  // Fetch batches & departments for filter dropdowns on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [bData, dData] = await Promise.all([
          getBatches(),
          getDepartments()
        ])
        setBatchesList(bData || [])
        setDepartmentsList(dData || [])
      } catch (err) {
        console.error('Failed to load filter options:', err)
      }
    }
    fetchOptions()
  }, [])

  // Fetch real-time placement stats matrix from database
  const loadStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true)
      else setIsLoading(true)

      const data = await getIntelligenceOverallStats({
        batch: selectedBatchFilter,
        department: selectedDeptFilter
      })
      setMatrixData(data)
    } catch (err) {
      console.error('Failed to load overall placement matrix:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [selectedBatchFilter, selectedDeptFilter])

  useEffect(() => {
    if (currentView === 'overall') {
      loadStats()
    }
  }, [loadStats, currentView])

  // Reset Filters handler
  const handleResetFilters = () => {
    setSelectedBatchFilter('All')
    setSelectedDeptFilter('All')
    onSelectBatch(null)
    onSelectDepartment('All')
  }

  // Batch dropdown change handler
  const handleBatchChange = (val) => {
    setSelectedBatchFilter(val)
    if (val === 'All') {
      onSelectBatch(null)
    } else {
      onSelectBatch(val)
    }
  }

  // Department dropdown change handler
  const handleDeptChange = (val) => {
    setSelectedDeptFilter(val)
    onSelectDepartment(val)
  }

  const [isExporting, setIsExporting] = useState(false)

  // Export handler (Generates real styled Excel spreadsheet with both tables)
  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportIntelligenceExcel(
        selectedBatchFilter !== 'All' ? selectedBatchFilter : '',
        selectedDeptFilter !== 'All' ? selectedDeptFilter : ''
      )
    } catch (err) {
      console.error('Failed to export placement intelligence excel', err)
      alert('Failed to generate Excel export.')
    } finally {
      setIsExporting(false)
    }
  }

  // Load real recruiter network health data from MySQL database
  const loadIndustryData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsIndustryRefreshing(true)
      else setIsIndustryLoading(true)

      const data = await getIntelligenceIndustryMatrix({
        sector: selectedIndustryDomain,
        department: industryDeptFilter
      })
      setIndustryData(data)
    } catch (err) {
      console.error('Failed to load industry matrix from DB:', err)
    } finally {
      if (isRefresh) setIsIndustryRefreshing(false)
      else setIsIndustryLoading(false)
    }
  }, [selectedIndustryDomain, industryDeptFilter])

  useEffect(() => {
    if (currentView === 'industries') {
      loadIndustryData()
    }
  }, [currentView, loadIndustryData])

  // Batches strictly from MySQL DB response (no hardcoded fake years)
  const activeIndustryBatches = useMemo(() => {
    return industryData?.batches || []
  }, [industryData])

  const industryMatrix = useMemo(() => {
    return industryData?.matrix || []
  }, [industryData])

  // Computed signals from real DB (supports both snake_case and camelCase)
  const industrySignals = useMemo(() => {
    const sig = industryData?.signals || {}
    return {
      totalDatabase: sig.total_database ?? sig.totalDatabase ?? 0,
      visitedRecruiters: sig.visited_recruiters ?? sig.visitedRecruiters ?? 0,
      newRecruiters: sig.new_recruiters ?? sig.newRecruiters ?? 0,
      missedRecruiters: sig.missed_recruiters ?? sig.missedRecruiters ?? 0,
      growthRecruiters: sig.growth_recruiters ?? sig.growthRecruiters ?? 0,
      max3Recruiters: sig.max3_recruiters ?? sig.max3Recruiters ?? 0
    }
  }, [industryData])

  const handleExportIndustryMatrix = () => {
    try {
      setIsIndustryExporting(true)
      const headers = ['Industry Metric', ...activeIndustryBatches.map((b) => `Batch ${b}`)]
      const rows = industryMatrix.map((row) => [
        `"${row.title}"`,
        ...activeIndustryBatches.map((b) => row.values?.[b] ?? '—')
      ])
      const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      const encodedUri = encodeURI(csv)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `Industry_Intelligence_Recruiter_Health_${selectedIndustryDomain}_${industryDeptFilter}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setIsIndustryExporting(false)
    }
  }

  const handleRefreshIndustry = () => {
    loadIndustryData(true)
  }

  // Fetch Company Recruitment Drives from DB
  const loadCompanyDrives = useCallback(
    async (
      isRefresh = false,
      batchVal = companyDrivesBatchFilter,
      roleVal = companyDrivesRoleFilter,
      deptVal = companyDrivesDeptFilter
    ) => {
      if (!selectedIndustry) {
        setCompanyDrivesData(null)
        return
      }
      try {
        if (isRefresh) setIsCompanyDrivesRefreshing(true)
        else setIsCompanyDrivesLoading(true)

        const res = await getIntelligenceCompanyDrives({
          companyId: selectedIndustry,
          batch: batchVal,
          role: roleVal,
          department: deptVal
        })
        setCompanyDrivesData(res)
      } catch (err) {
        console.error('Failed to load company recruitment drives:', err)
      } finally {
        setIsCompanyDrivesLoading(false)
        setIsCompanyDrivesRefreshing(false)
      }
    },
    [selectedIndustry, companyDrivesBatchFilter, companyDrivesRoleFilter, companyDrivesDeptFilter]
  )

  // Reset filters and fetch when selectedIndustry changes
  useEffect(() => {
    if (currentView === 'industries' && selectedIndustry) {
      setCompanyDrivesBatchFilter('All')
      setCompanyDrivesRoleFilter('All Roles')
      setCompanyDrivesDeptFilter('All Departments')

      const fetchInitial = async () => {
        try {
          setIsCompanyDrivesLoading(true)
          const res = await getIntelligenceCompanyDrives({
            companyId: selectedIndustry,
            batch: 'All',
            role: 'All Roles',
            department: 'All Departments'
          })
          setCompanyDrivesData(res)
        } catch (err) {
          console.error('Failed to load initial company recruitment drives:', err)
        } finally {
          setIsCompanyDrivesLoading(false)
        }
      }
      fetchInitial()
    } else {
      setCompanyDrivesData(null)
    }
  }, [currentView, selectedIndustry])

  const handleCompanyBatchChange = (val) => {
    setCompanyDrivesBatchFilter(val)
    loadCompanyDrives(false, val, companyDrivesRoleFilter, companyDrivesDeptFilter)
  }

  const handleCompanyRoleChange = (val) => {
    setCompanyDrivesRoleFilter(val)
    loadCompanyDrives(false, companyDrivesBatchFilter, val, companyDrivesDeptFilter)
  }

  const handleCompanyDeptChange = (val) => {
    setCompanyDrivesDeptFilter(val)
    loadCompanyDrives(false, companyDrivesBatchFilter, companyDrivesRoleFilter, val)
  }

  const handleResetCompanyFilters = () => {
    setCompanyDrivesBatchFilter('All')
    setCompanyDrivesRoleFilter('All Roles')
    setCompanyDrivesDeptFilter('All Departments')
    loadCompanyDrives(false, 'All', 'All Roles', 'All Departments')
  }

  const handleExportCompanyDrives = () => {
    if (!companyDrivesData) return
    const compName = companyDrivesData.company?.company_name || 'Company'
    const headers = [
      'Placement Year',
      'Drive Title',
      'Role',
      'Phase',
      'Status',
      'Date',
      'Departments',
      'Package LPA',
      'Registered',
      'Eligible',
      'Assessment',
      'Technical',
      'Interview',
      'Offers'
    ]
    const rows = []
    ;(companyDrivesData.years || []).forEach((y) => {
      ;(y.drives || []).forEach((d) => {
        const getStageCount = (name) => {
          const s = (d.stages || []).find(
            (st) =>
              (st.stage_name || st.label || '').toLowerCase() === name.toLowerCase()
          )
          return s ? (s.count !== undefined ? s.count : s.value) : 0
        }
        rows.push([
          `"${y.year}"`,
          `"${d.title || ''}"`,
          `"${d.job_role || ''}"`,
          `"${d.phase_name || ''}"`,
          `"${d.overall_status || ''}"`,
          `"${d.date || ''}"`,
          `"${(d.departments || []).join(', ')}"`,
          `"${d.package_lpa || ''}"`,
          getStageCount('Registered'),
          getStageCount('Eligible'),
          getStageCount('Assessment'),
          getStageCount('Technical'),
          getStageCount('Interview'),
          getStageCount('Offers')
        ])
      })
    })
    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csv)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${compName}_Recruitment_Drives.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (currentView === 'industries') {
    // If a company is selected, show Company Recruitment Drives View
    if (selectedIndustry) {
      const comp = companyDrivesData?.company || {}
      const filterOptions = companyDrivesData?.filter_options || {
        batches: ['All'],
        roles: ['All Roles'],
        departments: ['All Departments']
      }
      const years = companyDrivesData?.years || []
      const totalDrives = companyDrivesData?.total_drives ?? 0
      const totalOffers = companyDrivesData?.total_offers ?? 0

      // Compute company initials for avatar
      const compName = comp.company_name || 'Company'
      const nameParts = compName.trim().split(/\s+/)
      const initials =
        nameParts.length >= 2
          ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
          : compName.slice(0, 2).toUpperCase()

      // Calculate max package across drives
      let maxPkg = 0
      years.forEach((y) => {
        (y.drives || []).forEach((d) => {
          if (d.package_lpa && d.package_lpa > maxPkg) {
            maxPkg = d.package_lpa
          }
        })
      })

      return (
        <section className="flex-1 min-w-[700px] bg-[#f8fafc] h-full overflow-y-auto select-none flex flex-col hide-scrollbar">
          {/* 1. Header Profile Banner */}
          <div className="p-[20px_24px_16px] bg-white border-b border-[#e2e8f0] shrink-0">
            <button
              type="button"
              onClick={() => onSelectIndustry(null)}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#2563eb] hover:text-[#1d4ed8] mb-3.5 cursor-pointer transition active:scale-98 group px-2 py-1 rounded-md hover:bg-blue-50/60 -ml-2"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Recruiter Network Health</span>
            </button>

            <div className="flex items-start justify-between gap-6 flex-wrap">
              {/* Company Identity */}
              <div className="flex items-center gap-4">
                <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-white flex items-center justify-center font-[900] text-[20px] shadow-sm tracking-wider shrink-0 border border-blue-400/30">
                  {initials}
                </div>

                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-[22px] font-[900] text-[#0f172a] tracking-tight leading-tight m-0">
                      {compName}
                    </h1>

                    {comp.company_domain && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-[800] uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                        {comp.company_domain}
                      </span>
                    )}

                    {comp.category && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-[750] uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        {comp.category}
                      </span>
                    )}

                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-[750] uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Partner
                    </span>
                  </div>

                  {/* Summary metric strip */}
                  <div className="flex items-center gap-4 mt-2 text-[12px] text-[#64748b] font-medium flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400" />
                      <span>{years.length} Academic Years</span>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={13} className="text-slate-400" />
                      <span>{totalDrives} Recruitment Phases</span>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <Award size={13} className="text-emerald-600" />
                      <span>{totalOffers} Confirmed Offers</span>
                    </span>
                    {maxPkg > 0 && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1 text-slate-700 font-semibold">
                          <span>Max Package:</span>
                          <span className="font-extrabold text-blue-700">₹{maxPkg} LPA</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0 self-center">
                <button
                  type="button"
                  onClick={handleExportCompanyDrives}
                  className="h-[36px] px-3.5 rounded-[10px] border border-[#dbe5f1] bg-white text-[#475569] text-[12.5px] font-[700] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-98"
                >
                  <Download size={13} className="text-[#64748b]" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadCompanyDrives(true)}
                  disabled={isCompanyDrivesRefreshing}
                  className="h-[36px] px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[12.5px] font-[750] transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-98 disabled:opacity-75"
                >
                  <RotateCcw size={13} className={isCompanyDrivesRefreshing ? 'animate-spin' : ''} />
                  <span>{isCompanyDrivesRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Top Filter Controls Bar: Batch, Roles, Departments */}
          <div className="px-[24px] py-[12px] bg-white border-b border-[#edf2f7] flex items-center gap-3.5 flex-wrap shrink-0">
            {/* Batch Filter */}
            <div className="flex items-center gap-2 bg-[#f8fafc] px-3 py-1 rounded-[10px] border border-[#e2e8f0]">
              <label className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
                Batch
              </label>
              <select
                value={companyDrivesBatchFilter}
                onChange={(e) => handleCompanyBatchChange(e.target.value)}
                className="h-[28px] bg-transparent text-[12px] font-bold text-[#1e293b] focus:outline-none cursor-pointer pr-1"
              >
                {(filterOptions.batches || ['All']).map((b) => (
                  <option key={b} value={b}>
                    {b === 'All' ? 'All Batches' : `Batch ${b}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2 bg-[#f8fafc] px-3 py-1 rounded-[10px] border border-[#e2e8f0]">
              <label className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
                Role
              </label>
              <select
                value={companyDrivesRoleFilter}
                onChange={(e) => handleCompanyRoleChange(e.target.value)}
                className="h-[28px] bg-transparent text-[12px] font-bold text-[#1e293b] focus:outline-none cursor-pointer max-w-[200px] truncate pr-1"
              >
                {(filterOptions.roles || ['All Roles']).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter (All Departments) */}
            <div className="flex items-center gap-2 bg-[#f8fafc] px-3 py-1 rounded-[10px] border border-[#e2e8f0]">
              <label className="text-[11px] font-[850] uppercase tracking-[0.4px] text-[#64748b]">
                Department
              </label>
              <select
                value={companyDrivesDeptFilter}
                onChange={(e) => handleCompanyDeptChange(e.target.value)}
                className="h-[28px] bg-transparent text-[12px] font-bold text-[#1e293b] focus:outline-none cursor-pointer max-w-[200px] truncate pr-1"
              >
                {(filterOptions.departments || ['All Departments']).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1" />

            {/* Active summary count badge */}
            <span className="text-[11.5px] font-[750] text-[#334155] bg-blue-50/70 text-blue-700 px-3 py-1 rounded-[8px] border border-blue-200/80 shadow-2xs">
              {totalDrives} {totalDrives === 1 ? 'Phase' : 'Phases'} · {totalOffers} {totalOffers === 1 ? 'Offer' : 'Offers'}
            </span>

            {/* Reset Filters Button */}
            <button
              type="button"
              onClick={handleResetCompanyFilters}
              className="h-[30px] px-2.5 rounded-[8px] border border-[#dbe5f1] bg-white text-[#64748b] hover:text-[#1e293b] text-[11px] font-[750] hover:bg-[#f8fafc] transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          </div>

          {/* 3. Main Content: Grouped by Placement Year */}
          <div className="flex-1 px-[24px] py-[22px] space-y-7">
            {isCompanyDrivesLoading ? (
              <div className="py-24 flex flex-col items-center justify-center text-[#94a3b8] bg-white border border-[#e2e8f0] rounded-[16px] shadow-xs">
                <Loader2 className="w-7 h-7 animate-spin text-[#2563eb] mb-2.5" />
                <span className="text-[13.5px] font-bold text-[#475569]">
                  Loading recruitment drives for {compName}...
                </span>
              </div>
            ) : !years || years.length === 0 ? (
              <div className="text-center py-20 bg-white border border-[#e2e8f0] rounded-[16px] p-8 shadow-xs max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3.5 border border-blue-100">
                  <Briefcase size={26} />
                </div>
                <h3 className="text-[16px] font-[850] text-[#0f172a]">No recruitment drives found</h3>
                <p className="text-[13px] text-[#64748b] mt-1.5 leading-relaxed">
                  {companyDrivesDeptFilter !== 'All Departments'
                    ? `No recruitment drives were conducted for ${companyDrivesDeptFilter} by ${compName}.`
                    : 'No recruitment processes matched the selected batch, role, or department filter. Try resetting your filters.'}
                </p>
                <button
                  type="button"
                  onClick={handleResetCompanyFilters}
                  className="mt-4 px-4 py-2 rounded-[9px] bg-[#2563eb] text-white text-[12.5px] font-bold hover:bg-[#1d4ed8] transition cursor-pointer shadow-xs"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              years.map((yearGroup) => (
                <div key={yearGroup.year} className="space-y-3.5">
                  {/* Year Header Banner */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center font-bold text-xs">
                        <Calendar size={14} />
                      </div>
                      <h2 className="text-[17px] font-[900] text-[#0f172a] leading-tight m-0 tracking-tight">
                        Placement Year {yearGroup.year}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 text-[12px] font-bold text-[#64748b]">
                      <span className="bg-white border border-[#e2e8f0] px-2.5 py-1 rounded-[7px] shadow-2xs">
                        {yearGroup.phases_count} recruitment phase{yearGroup.phases_count === 1 ? '' : 's'}
                      </span>
                      <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-[7px] shadow-2xs flex items-center gap-1">
                        <Award size={12} className="text-emerald-600" />
                        <span>{yearGroup.total_offers} offers</span>
                      </span>
                    </div>
                  </div>

                  {/* Drives list for this year */}
                  <div className="space-y-4">
                    {(yearGroup.drives || []).map((drive) => {
                      const pkgStr = drive.package_lpa ? `₹${drive.package_lpa} LPA` : '—'
                      const dateStr = drive.date || '—'

                      // Strict 4 statuses: Completed, Cancelled, Ongoing, Awaiting for final result
                      const rawSt = (drive.overall_status || '').toLowerCase().trim()
                      let statusConfig = {
                        label: 'Ongoing',
                        accent: 'bg-amber-400',
                        badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
                        icon: <Clock size={13} className="text-amber-600" />
                      }

                      if (rawSt === 'completed') {
                        statusConfig = {
                          label: 'Completed',
                          accent: 'bg-emerald-500',
                          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          icon: <CheckCircle2 size={13} className="text-emerald-600" />
                        }
                      } else if (rawSt === 'cancelled' || rawSt === 'canceled') {
                        statusConfig = {
                          label: 'Cancelled',
                          accent: 'bg-rose-500',
                          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
                          icon: <XCircle size={13} className="text-rose-600" />
                        }
                      } else if (rawSt === 'awaiting_final_result' || rawSt === 'awaiting_result' || rawSt.includes('awaiting')) {
                        statusConfig = {
                          label: 'Awaiting for final result',
                          accent: 'bg-purple-500',
                          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
                          icon: <Hourglass size={13} className="text-purple-600" />
                        }
                      }

                      const isCompleted = statusConfig.label === 'Completed'

                      return (
                        <div
                          key={drive.drive_id}
                          className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden group"
                        >
                          {/* Accent status stripe on left edge */}
                          <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${statusConfig.accent}`} />

                          {/* Top Row: Title, Phase Pill, Status, and Salary Package Badge */}
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-[17px] font-[850] text-[#0f172a] leading-tight m-0">
                                  {drive.job_role || drive.title}
                                </h3>

                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200/80">
                                  {drive.phase_name || 'Phase 1'}
                                </span>

                                <span
                                  className={`px-3 py-1 rounded-full text-[11.5px] font-[800] border flex items-center gap-1.5 shadow-2xs ${statusConfig.badgeClass}`}
                                >
                                  {statusConfig.icon}
                                  <span>{statusConfig.label}</span>
                                </span>
                              </div>

                              {/* Subtitle meta: Date & Department Pills */}
                              <div className="flex items-center gap-3 mt-2 text-[12.5px] text-[#64748b] flex-wrap">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Calendar size={13} className="text-slate-400" />
                                  <span>{dateStr}</span>
                                </span>

                                <span className="text-slate-300">•</span>

                                {/* Department Chips */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <GraduationCap size={14} className="text-slate-400" />
                                  {(drive.departments || []).length > 0 ? (
                                    (drive.departments || []).map((dept) => (
                                      <span
                                        key={dept}
                                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200/80 transition"
                                      >
                                        {dept}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 italic text-[11.5px]">All Departments</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Salary Package Pill */}
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-800 font-[900] px-3.5 py-1.5 rounded-xl text-[14px] flex items-center gap-1.5 shadow-2xs">
                              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">CTC</span>
                              <span>{pkgStr}</span>
                            </div>
                          </div>

                          {/* Connected Pipeline Flow */}
                          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto py-1">
                            {(drive.stages || []).map((stage, sIdx) => {
                              const isActive = stage.is_active || stage.active
                              const stageCount = stage.count !== undefined ? stage.count : (stage.value ?? 0)
                              const stageStep = stage.stage_order || stage.step || sIdx + 1
                              const stageLabel = stage.stage_name || stage.label || ''
                              const isFinalOffers = stageLabel.toLowerCase() === 'offers'

                              return (
                                <React.Fragment key={stageStep}>
                                  <div
                                    className={`w-[136px] h-[92px] p-3 rounded-xl border flex flex-col justify-between transition-all duration-150 shadow-2xs hover:shadow-xs shrink-0 ${
                                      isActive
                                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50'
                                        : isFinalOffers && isCompleted
                                        ? 'border-emerald-300 bg-emerald-50/40'
                                        : 'border-slate-200/90 bg-[#fbfdff] hover:bg-white hover:border-slate-300'
                                    }`}
                                  >
                                    {/* Top Row: Step circle and Label */}
                                    <div className="flex items-center justify-between gap-1.5">
                                      <div
                                        className={`w-[20px] h-[20px] rounded-full text-[10px] font-[900] flex items-center justify-center shrink-0 ${
                                          isActive
                                            ? 'bg-blue-600 text-white shadow-2xs'
                                            : isFinalOffers && isCompleted
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-200 text-slate-600'
                                        }`}
                                      >
                                        {stageStep}
                                      </div>

                                      <span className="text-[11.5px] font-[800] text-slate-700 truncate leading-tight flex-1 text-right">
                                        {stageLabel}
                                      </span>
                                    </div>

                                    {/* Value & Footnote */}
                                    <div className="mt-1">
                                      <div
                                        className={`text-[22px] font-[900] leading-none tracking-tight ${
                                          isFinalOffers && isCompleted
                                            ? 'text-emerald-700'
                                            : isActive
                                            ? 'text-blue-700'
                                            : 'text-slate-900'
                                        }`}
                                      >
                                        {stageCount}
                                      </div>
                                      <div className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                                        students
                                      </div>
                                    </div>
                                  </div>

                                  {/* Arrow connector between stages */}
                                  {sIdx < (drive.stages || []).length - 1 && (
                                    <ChevronRight size={16} className="text-slate-300 shrink-0 -mx-0.5" />
                                  )}
                                </React.Fragment>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )
    }

    return (
      <section className="flex-1 min-w-[700px] bg-[#f8fafc] h-full overflow-y-auto select-none flex flex-col hide-scrollbar">
        {/* 1. Header with Title & Action Buttons */}
        <div className="p-[20px] pb-3 bg-white border-b border-[#edf2f7] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[20px] font-[850] text-[#172554] tracking-tight leading-tight m-0">
                Industry Intelligence
              </h1>
              <p className="text-[12px] text-[#64748b] mt-1 font-medium leading-relaxed">
                Recruiter network health, historical participation, offer performance and relationship continuity.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleExportIndustryMatrix}
                disabled={isIndustryExporting}
                className="h-[36px] px-3.5 rounded-[9px] border border-[#dbe5f1] bg-white text-[#475569] text-[12.5px] font-[700] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-98 disabled:opacity-60"
              >
                {isIndustryExporting ? (
                  <Loader2 size={13} className="animate-spin text-[#2563eb]" />
                ) : (
                  <Download size={13} className="text-[#64748b]" />
                )}
                <span>Export</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshIndustry}
                disabled={isIndustryRefreshing}
                className="h-[36px] px-4 rounded-[9px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[12.5px] font-[750] transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-98 disabled:opacity-75"
              >
                <RotateCcw size={13} className={isIndustryRefreshing ? 'animate-spin' : ''} />
                <span>{isIndustryRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Top Filter Controls Bar (Domain & Department from Database) */}
        <div className="px-[20px] py-[12px] bg-white border-b border-[#edf2f7] flex items-center gap-3 flex-wrap shrink-0">
          {/* Domain Filter: all, software, core, both */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-[800] uppercase tracking-[0.4px] text-[#64748b]">
              Domain
            </label>
            <select
              value={selectedIndustryDomain}
              onChange={(e) => onSelectIndustryDomain(e.target.value)}
              className="h-[34px] px-2.5 bg-white border border-[#dbe5f1] hover:border-[#93c5fd] focus:border-[#2563eb] rounded-[8px] text-[12px] font-semibold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
            >
              <option value="all">All Domains</option>
              <option value="software">Software</option>
              <option value="core">Core</option>
            </select>
          </div>

          {/* Department Filter (Referred from Database) */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-[800] uppercase tracking-[0.4px] text-[#64748b]">
              Department
            </label>
            <select
              value={industryDeptFilter}
              onChange={(e) => setIndustryDeptFilter(e.target.value)}
              className="h-[34px] px-2.5 bg-white border border-[#dbe5f1] hover:border-[#93c5fd] focus:border-[#2563eb] rounded-[8px] text-[12px] font-semibold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
            >
              <option value="All">All Departments</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Reset Filters Button */}
          <button
            type="button"
            onClick={() => {
              onSelectIndustryDomain('all')
              setIndustryDeptFilter('All')
            }}
            className="h-[30px] px-2.5 rounded-[7px] border border-[#dbe5f1] bg-white text-[#64748b] hover:text-[#1e293b] text-[11px] font-[750] hover:bg-[#f8fafc] transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            Reset Filters
          </button>
        </div>

        {/* 4. Table Section: Recruiter Network Health */}
        <div className="flex-1 px-[20px] pt-[16px] pb-[28px] space-y-4">
          <section className="space-y-2.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-[850] text-[#1e293b] leading-tight m-0">
                  Recruiter Network Health
                </h2>
                <p className="text-[12px] text-[#64748b] mt-0.5 font-medium">
                  Compare recruiter participation, continuity and offer performance across batches.
                </p>
              </div>

              {/* Horizontal Scroll Controls & Batches Available */}
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] font-[750] text-[#475569] bg-white px-2.5 py-1 rounded-[7px] border border-[#dbe5f1] shadow-2xs">
                  {activeIndustryBatches.length} {activeIndustryBatches.length === 1 ? 'Batch' : 'Batches'} in DB
                </span>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-[8px] border border-[#dbe5f1] shadow-2xs">
                  <button
                    type="button"
                    onClick={() => scrollTable('left')}
                    title="Scroll left to see previous batches"
                    aria-label="Scroll left"
                    className="p-1.5 rounded-[6px] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#2563eb] transition cursor-pointer active:scale-95"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollTable('right')}
                    title="Scroll right to see next batches"
                    aria-label="Scroll right"
                    className="p-1.5 rounded-[6px] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#2563eb] transition cursor-pointer active:scale-95"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Recruiter Network Health Data Table */}
            {isIndustryLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-[#94a3b8] bg-white border border-[#dbe5f1] rounded-[14px]">
                <Loader2 className="w-6 h-6 animate-spin text-[#2563eb] mb-2" />
                <span className="text-[13px] font-semibold text-[#64748b]">
                  Loading recruiter network health from MySQL database...
                </span>
              </div>
            ) : (
              <div className="border border-[#dbe5f1] rounded-[14px] bg-white overflow-hidden shadow-2xs">
                <div ref={tableScrollRef} className="overflow-x-auto scroll-smooth">
                  <table className="w-full text-left border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#edf2f7]">
                        <th className="sticky left-0 bg-[#f8fafc] z-20 px-5 py-3 text-left text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] min-w-[340px] border-r border-[#edf2f7] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.04)]">
                          Industry Metric
                        </th>
                        {activeIndustryBatches.map((batch) => (
                          <th
                            key={batch}
                            className="px-6 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[130px]"
                          >
                            Batch {batch}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f7]">
                      {industryMatrix.map((row) => (
                        <tr key={row.key} className="hover:bg-[#fbfdff] transition-colors group">
                          <td className="sticky left-0 bg-white group-hover:bg-[#fbfdff] z-10 px-5 py-3.5 border-r border-[#edf2f7] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.04)] transition-colors">
                            <div className="metric-name font-[800] text-[#1e293b] text-[13px] group-hover:text-[#2563eb] transition-colors">
                              {row.title}
                            </div>
                            <div className="metric-description text-[11px] text-[#64748b] font-medium mt-0.5 leading-snug">
                              {row.note}
                            </div>
                          </td>
                          {activeIndustryBatches.map((batch) => {
                            const val = row.values?.[batch] ?? '—'
                            const isDash = val === '—'
                            const isSelected = !isDash && selectedIndustryCell?.metricKey === row.key && String(selectedIndustryCell?.batch) === String(batch)
                            return (
                              <td
                                key={batch}
                                onClick={() => {
                                  if (!isDash && onSelectDetail) {
                                    onSelectDetail({
                                      metricKey: row.key,
                                      metricTitle: row.title,
                                      batch,
                                      value: val
                                    })
                                  }
                                }}
                                className={`px-6 py-3.5 text-center whitespace-nowrap text-[13px] font-[750] transition min-w-[130px] ${
                                  isDash
                                    ? 'text-[#94a3b8]'
                                    : isSelected
                                    ? 'bg-[#eff6ff] text-[#2563eb] font-[850] ring-2 ring-inset ring-[#2563eb] cursor-pointer'
                                    : 'text-[#1e293b] cursor-pointer hover:bg-[#eff6ff] hover:text-[#2563eb] hover:underline'
                                }`}
                              >
                                {typeof val === 'number' ? val.toLocaleString() : val}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    )
  }

  const signals = matrixData?.signals || {
    total_offers: 0,
    unique_offer_holders: 0,
    not_yet_placed: 0,
    higher_studies: 0,
    entrepreneurship: 0
  }

  const offersRows = matrixData?.offers_by_salary_scale || []
  const uniqueRows = matrixData?.unique_students_by_offer || []

  return (
    <section className="flex-1 min-w-[700px] bg-[#f8fafc] h-full overflow-y-auto hide-scrollbar flex flex-col select-none">
      {/* 1. Header (Title, Subtitle, Actions) */}
      <div className="p-[18px_20px_12px] bg-white border-b border-[#edf2f7] shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-[850] text-[#172554] tracking-tight leading-tight m-0">
              {currentView === 'overall' && 'Overall Placement Statistics'}
              {currentView === 'industries' && 'Industry Intelligence'}
              {currentView === 'companies' && 'Company-wise Placement Statistics'}
              {currentView === 'students' && 'Student Placement Intelligence'}
            </h1>
            <p className="text-[12px] text-[#64748b] mt-1 font-medium leading-relaxed">
              {currentView === 'overall' && 'Compare offer volume, unique student outcomes and placement alternatives across graduating batches.'}
              {currentView === 'industries' && 'Recruiter network health, historical participation, offer performance and relationship continuity.'}
              {currentView === 'companies' && 'Rank recruiters by offers, salary package, historical performance and live recruitment status.'}
              {currentView === 'students' && 'Understand opportunity exposure, recruitment conversion, placement discipline, eligibility and final outcomes.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="h-[36px] px-3.5 rounded-[9px] border border-[#dbe5f1] bg-white text-[#475569] text-[12.5px] font-[700] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-98 disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 size={13} className="animate-spin text-[#2563eb]" />
              ) : (
                <Download size={13} className="text-[#64748b]" />
              )}
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
            <button
              type="button"
              onClick={() => loadStats(true)}
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
      <div className="px-[20px] py-[12px] bg-white border-b border-[#edf2f7] flex items-center gap-3 flex-wrap shrink-0">
        {/* Batch Filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-[800] uppercase tracking-[0.4px] text-[#64748b]">
            Batch
          </label>
          <select
            value={selectedBatchFilter}
            onChange={(e) => handleBatchChange(e.target.value)}
            className="h-[34px] px-2.5 bg-white border border-[#dbe5f1] hover:border-[#93c5fd] focus:border-[#2563eb] rounded-[8px] text-[12px] font-semibold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
          >
            <option value="All">All</option>
            {batchesList.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-[800] uppercase tracking-[0.4px] text-[#64748b]">
            Department
          </label>
          <select
            value={selectedDeptFilter}
            onChange={(e) => handleDeptChange(e.target.value)}
            className="h-[34px] px-2.5 bg-white border border-[#dbe5f1] hover:border-[#93c5fd] focus:border-[#2563eb] rounded-[8px] text-[12px] font-semibold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition cursor-pointer"
          >
            <option value="All">All Departments</option>
            {departmentsList.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        {/* Reset Filters Button */}
        <button
          type="button"
          onClick={handleResetFilters}
          className="h-[30px] px-2.5 rounded-[7px] border border-[#dbe5f1] bg-white text-[#64748b] hover:text-[#1e293b] text-[11px] font-[750] hover:bg-[#f8fafc] transition cursor-pointer flex items-center gap-1 shadow-2xs"
        >
          Reset Filters
        </button>
      </div>

      {/* 3. Signal Bar (KPI Summary Bar) */}
      <div className="mx-[20px] my-[14px] p-[10px_14px] bg-[#eff6ff] border border-[#bfdbfe]/80 rounded-[10px] flex items-center gap-5 flex-wrap text-[12px] shrink-0 shadow-2xs">
        <div className="flex items-center gap-1.5 font-medium text-[#1e40af]">
          <span className="w-2 h-2 rounded-full bg-[#2563eb] shrink-0" />
          <span className="font-[850] text-[#172554]">{signals.total_offers.toLocaleString()}</span> offers
        </div>

        <div className="flex items-center gap-1.5 font-medium text-[#1e40af]">
          <span className="w-2 h-2 rounded-full bg-[#16a34a] shrink-0" />
          <span className="font-[850] text-[#172554]">{signals.unique_offer_holders.toLocaleString()}</span> unique offer holders
        </div>

        <div className="flex items-center gap-1.5 font-medium text-[#1e40af]">
          <span className="w-2 h-2 rounded-full bg-[#d97706] shrink-0" />
          <span className="font-[850] text-[#172554]">{signals.not_yet_placed.toLocaleString()}</span> not yet placed
        </div>

        <div className="flex items-center gap-1.5 font-medium text-[#1e40af]">
          <span className="w-2 h-2 rounded-full bg-[#7c3aed] shrink-0" />
          <span className="font-[850] text-[#172554]">{signals.higher_studies.toLocaleString()}</span> higher studies
        </div>

        <div className="flex items-center gap-1.5 font-medium text-[#1e40af]">
          <span className="w-2 h-2 rounded-full bg-[#0891b2] shrink-0" />
          <span className="font-[850] text-[#172554]">{signals.entrepreneurship.toLocaleString()}</span> entrepreneurship
        </div>
      </div>

      {/* 4. Scrollable Tables Content */}
      <div className="flex-1 px-[20px] pb-[28px] space-y-5">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#94a3b8]">
            <Loader2 className="w-6 h-6 animate-spin text-[#2563eb] mb-2" />
            <span className="text-[13px] font-semibold text-[#64748b]">
              Loading database statistics from MySQL...
            </span>
          </div>
        ) : (
          <>
            {/* SECTION 1: Number of Offers by Salary Scale */}
            <section className="space-y-2.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[13.5px] font-[850] text-[#1e293b] leading-tight m-0">
                    Number of Offers by Salary Scale
                  </h2>
                  <p className="text-[11px] text-[#64748b] mt-0.5 font-medium">
                    Every confirmed offer is counted. One student may contribute to multiple salary bands when holding multiple offers.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-[0.4px] shrink-0">
                  Offer Volume
                </span>
              </div>

              {/* Table Card */}
              <div className="bg-white border border-[#dbe5f1] rounded-[11px] overflow-hidden shadow-2xs">
                <div className="overflow-x-auto custom-table-scroll p-1">
                  <table className="w-full border-collapse min-w-[1180px] text-[12.5px]">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#dbe5f1]">
                        <th className="px-5 py-3 text-left text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[170px]">
                          Batch
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[140px]">
                          Total Students
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[115px]">
                          &gt; ₹40L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[115px]">
                          ₹30–40L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[115px]">
                          ₹20–30L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[115px]">
                          ₹10–20L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[115px]">
                          ₹6–10L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[115px]">
                          ₹4–6L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[115px]">
                          ₹3–4L
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f7]">
                      {offersRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-[12px] text-[#94a3b8] font-medium">
                            No batches or offers found for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        offersRows.map((row) => (
                          <tr key={row.batch_id || row.batch} className="hover:bg-[#fbfdff] transition-colors">
                            <td className="px-5 py-3 font-[850] text-[#1e293b] whitespace-nowrap">
                              Batch {row.batch}
                            </td>
                            <td className="px-4 py-3 text-center text-[#475569] font-medium whitespace-nowrap">
                              {row.total_students}
                            </td>
                            <td
                              onClick={() => {
                                if (row.offers.gt40 > 0) {
                                  onSelectOutcome('gt40', 'offers')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.offers.gt40 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.offers.gt40}
                            </td>
                            <td
                              onClick={() => {
                                if (row.offers.p30_40 > 0) {
                                  onSelectOutcome('p30_40', 'offers')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.offers.p30_40 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.offers.p30_40}
                            </td>
                            <td
                              onClick={() => {
                                if (row.offers.p20_30 > 0) {
                                  onSelectOutcome('p20_30', 'offers')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.offers.p20_30 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.offers.p20_30}
                            </td>
                            <td
                              onClick={() => {
                                if (row.offers.p10_20 > 0) {
                                  onSelectOutcome('p10_20', 'offers')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.offers.p10_20 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.offers.p10_20}
                            </td>
                            <td
                              onClick={() => {
                                if (row.offers.p6_10 > 0) {
                                  onSelectOutcome('p6_10', 'offers')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.offers.p6_10 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.offers.p6_10}
                            </td>
                            <td
                              onClick={() => {
                                if (row.offers.p4_6 > 0) {
                                  onSelectOutcome('p4_6', 'offers')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.offers.p4_6 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.offers.p4_6}
                            </td>
                            <td
                              onClick={() => {
                                if (row.offers.p3_4 > 0) {
                                  onSelectOutcome('p3_4', 'offers')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.offers.p3_4 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.offers.p3_4}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* SECTION 2: Unique Students by Best Offer */}
            <section className="space-y-2.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[13.5px] font-[850] text-[#1e293b] leading-tight m-0">
                    Unique Students by Best Offer
                  </h2>
                  <p className="text-[11px] text-[#64748b] mt-0.5 font-medium">
                    Every student is counted once under the salary band of the student's highest confirmed offer.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-[0.4px] shrink-0">
                  Student Outcome
                </span>
              </div>

              {/* Table Card */}
              <div className="bg-white border border-[#dbe5f1] rounded-[11px] overflow-hidden shadow-2xs">
                <div className="overflow-x-auto custom-table-scroll p-1">
                  <table className="w-full border-collapse min-w-[1550px] text-[12.5px]">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#dbe5f1]">
                        <th className="px-5 py-3 text-left text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[170px]">
                          Batch
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[100px]">
                          Total
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[105px]">
                          &gt; ₹40L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[110px]">
                          ₹30–40L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[110px]">
                          ₹20–30L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[110px]">
                          ₹10–20L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[110px]">
                          ₹6–10L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[110px]">
                          ₹4–6L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[110px]">
                          ₹3–4L
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[135px]">
                          Not Eligible
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[165px]">
                          Entrepreneurship
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[145px]">
                          Higher Studies
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] whitespace-nowrap min-w-[130px]">
                          Not Placed
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f7]">
                      {uniqueRows.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="py-8 text-center text-[12px] text-[#94a3b8] font-medium">
                            No batches found for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        uniqueRows.map((row) => (
                          <tr key={row.batch_id || row.batch} className="hover:bg-[#fbfdff] transition-colors">
                            <td className="px-5 py-3 font-[850] text-[#1e293b] whitespace-nowrap">
                              Batch {row.batch}
                            </td>
                            <td className="px-4 py-3 text-center text-[#475569] font-medium whitespace-nowrap">
                              {row.total}
                            </td>
                            <td
                              onClick={() => {
                                if (row.unique.gt40 > 0) {
                                  onSelectOutcome('gt40', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.unique.gt40 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.unique.gt40}
                            </td>
                            <td
                              onClick={() => {
                                if (row.unique.p30_40 > 0) {
                                  onSelectOutcome('p30_40', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.unique.p30_40 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.unique.p30_40}
                            </td>
                            <td
                              onClick={() => {
                                if (row.unique.p20_30 > 0) {
                                  onSelectOutcome('p20_30', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.unique.p20_30 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.unique.p20_30}
                            </td>
                            <td
                              onClick={() => {
                                if (row.unique.p10_20 > 0) {
                                  onSelectOutcome('p10_20', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.unique.p10_20 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.unique.p10_20}
                            </td>
                            <td
                              onClick={() => {
                                if (row.unique.p6_10 > 0) {
                                  onSelectOutcome('p6_10', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.unique.p6_10 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.unique.p6_10}
                            </td>
                            <td
                              onClick={() => {
                                if (row.unique.p4_6 > 0) {
                                  onSelectOutcome('p4_6', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.unique.p4_6 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.unique.p4_6}
                            </td>
                            <td
                              onClick={() => {
                                if (row.unique.p3_4 > 0) {
                                  onSelectOutcome('p3_4', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.unique.p3_4 > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.unique.p3_4}
                            </td>
                            <td
                              onClick={() => {
                                onSelectOutcome('notEligible', 'unique')
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.not_eligible > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.not_eligible}
                            </td>
                            <td
                              onClick={() => {
                                if (row.entrepreneurship > 0) {
                                  onSelectOutcome('entrepreneur', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.entrepreneurship > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.entrepreneurship}
                            </td>
                            <td
                              onClick={() => {
                                if (row.higher_studies > 0) {
                                  onSelectOutcome('higherStudies', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.higher_studies > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.higher_studies}
                            </td>
                            <td
                              onClick={() => {
                                if (row.not_placed > 0) {
                                  onSelectOutcome('notPlaced', 'unique')
                                }
                              }}
                              className={`px-4 py-3 text-center whitespace-nowrap ${row.not_placed > 0 ? 'text-[#2563eb] font-[850] cursor-pointer hover:bg-[#eff6ff] hover:underline' : 'text-[#94a3b8]'}`}
                            >
                              {row.not_placed}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  )
}
