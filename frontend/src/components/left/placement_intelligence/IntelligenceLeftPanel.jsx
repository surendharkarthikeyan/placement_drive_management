import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Loader2, Users, Filter, Check, X } from 'lucide-react'
import GlassSegmentedControl from '../../common/GlassSegmentedControl'
import { getIntelligenceBatchSummaries, getIntelligenceOutcomeSummary, getDrives } from '../../../services/api'
import { companyStatsData, studentsData } from './intelligenceData'

/**
 * IntelligenceLeftPanel
 * Left Panel (390px) for Placement Intelligence:
 * - 4 Analysis Cards (Overall Statistics, Industries, Company Statistics, Students)
 * - Industries view matches Placement Drive tab's left panel (Search, Status Filter, All/Active/Completed tabs, Grouped Drives)
 * - Dynamic Left Content and Filters tailored to each of the 4 analysis modes
 * - Real DB Batches & Outcome counts for Overall mode
 * - Clean zero-flicker selection with rounded blue indicator bar
 * - Hidden scrollbar pipeline
 */
export default function IntelligenceLeftPanel({
  currentView = 'overall',
  onViewChange = () => {},
  selectedBatch: externalSelectedBatch,
  onSelectBatch: externalOnSelectBatch,
  globalBatch = 'all',
  onGlobalBatchChange = () => {},
  selectedOutcome: externalSelectedOutcome,
  onSelectOutcome: externalOnSelectOutcome,
  selectedIndustry = null,
  onSelectIndustry = () => {},
  selectedCompany = 'All',
  onSelectCompany = () => {},
  selectedStudentFocus = 'all',
  onSelectStudentFocus = () => {}
}) {
  const [internalSelectedBatch, setInternalSelectedBatch] = useState(null)
  const [internalSelectedOutcome, setInternalSelectedOutcome] = useState('notPlaced')

  const selectedBatch = externalSelectedBatch !== undefined ? externalSelectedBatch : internalSelectedBatch
  const onSelectBatch = (batchName) => {
    // If clicking the currently selected batch, unchoose it (toggle to null)
    const nextVal = selectedBatch === batchName ? null : batchName
    setInternalSelectedBatch(nextVal)
    if (externalOnSelectBatch) externalOnSelectBatch(nextVal)
  }

  const selectedOutcome = externalSelectedOutcome !== undefined ? externalSelectedOutcome : internalSelectedOutcome
  const onSelectOutcome = (outcomeId) => {
    setInternalSelectedOutcome(outcomeId)
    if (externalOnSelectOutcome) externalOnSelectOutcome(outcomeId)
  }

  // Segment tabs for each view
  const [overallTab, setOverallTab] = useState('batches') // 'batches' | 'outcomes'
  const [companyTab, setCompanyTab] = useState('all') // 'all' | 'active' | 'completed'
  const [studentTab, setStudentTab] = useState('all') // 'all' | 'attention' | 'placed'

  const [searchQuery, setSearchQuery] = useState('')
  const [batches, setBatches] = useState([])
  const [outcomeData, setOutcomeData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // --- INDUSTRIES STATE & FILTERS (Identical to Placement Drive Tab) ---
  const [industryDrives, setIndustryDrives] = useState([])
  const [isLoadingDrives, setIsLoadingDrives] = useState(false)
  const [industrySearchQuery, setIndustrySearchQuery] = useState('')
  const [industryTab, setIndustryTab] = useState('all') // 'all' | 'active' | 'completed'
  const [selectedStatuses, setSelectedStatuses] = useState(new Set())
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)
  const filterDropdownRef = useRef(null)

  // Glass moving pill ref & state for Filter Tabs in Industries
  const tabNavRef = useRef(null)
  const tabRefs = useRef({})
  const [tabPillStyle, setTabPillStyle] = useState({ left: 0, width: 0, opacity: 0 })

  const updateTabPill = () => {
    const activeEl = tabRefs.current[industryTab]
    const container = tabNavRef.current
    if (activeEl && container) {
      const activeRect = activeEl.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setTabPillStyle({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
        height: activeRect.height,
        top: activeRect.top - containerRect.top,
        opacity: 1
      })
    }
  }

  useEffect(() => {
    if (currentView === 'industries') {
      updateTabPill()
    }
  }, [industryTab, currentView])

  const statusOptions = [
    { value: 'in_progress', label: 'In Progress', dotColor: 'bg-[#2563eb]' },
    { value: 'registration_open', label: 'Registration Open', dotColor: 'bg-[#0284c7]' },
    { value: 'awaiting_final_result', label: 'Awaiting Result', dotColor: 'bg-[#d97706]' },
    { value: 'scheduled', label: 'Scheduled', dotColor: 'bg-[#7c3aed]' },
    { value: 'draft', label: 'Draft', dotColor: 'bg-[#64748b]' },
    { value: 'completed', label: 'Completed', dotColor: 'bg-[#16a34a]' },
    { value: 'awaiting_next_round', label: 'Date Pending', dotColor: 'bg-[#d97706]' },
    { value: 'on_hold', label: 'On Hold', dotColor: 'bg-[#94a3b8]' },
    { value: 'cancelled', label: 'Cancelled', dotColor: 'bg-[#dc2626]' }
  ]

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setIsFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const effectiveBatch = (globalBatch && globalBatch !== 'all')
    ? globalBatch
    : (selectedBatch && selectedBatch !== 'all' ? selectedBatch : 'all')

  const handleBatchSelect = (batchVal) => {
    if (onGlobalBatchChange) onGlobalBatchChange(batchVal)
    if (externalOnSelectBatch) externalOnSelectBatch(batchVal === 'all' ? null : batchVal)
  }

  // Fetch drives whenever in 'industries' view or when effectiveBatch changes
  useEffect(() => {
    if (currentView !== 'industries') return
    let isMounted = true

    const fetchIndustryDrives = async () => {
      try {
        setIsLoadingDrives(true)
        const data = await getDrives({ status: 'all', batch: effectiveBatch })
        if (isMounted) {
          setIndustryDrives(data || [])
          // Zero default selection per user requirement: selectedIndustry remains null initially
        }
      } catch (err) {
        console.error('Failed to load industry drives:', err)
      } finally {
        if (isMounted) setIsLoadingDrives(false)
      }
    }

    fetchIndustryDrives()

    return () => {
      isMounted = false
    }
  }, [currentView, effectiveBatch])

  const toggleStatus = (statusValue) => {
    const next = new Set(selectedStatuses)
    if (next.has(statusValue)) {
      next.delete(statusValue)
    } else {
      next.add(statusValue)
    }
    setSelectedStatuses(next)
  }

  const clearStatusFilters = () => {
    setSelectedStatuses(new Set())
  }

  // Filter industry drives matching DriveListPanel logic
  const filteredIndustryDrives = useMemo(() => {
    return industryDrives.filter((drive) => {
      // 1. Tab Filter (All / Active / Completed)
      if (industryTab === 'active' && (drive.overall_status === 'completed' || drive.overall_status === 'cancelled')) {
        return false
      }
      if (industryTab === 'completed' && drive.overall_status !== 'completed' && drive.overall_status !== 'cancelled') {
        return false
      }

      // 2. Specific Status Checkbox Filter
      if (selectedStatuses.size > 0 && !selectedStatuses.has(drive.overall_status)) {
        return false
      }

      // 3. Search Query Filter
      if (industrySearchQuery.trim()) {
        const q = industrySearchQuery.toLowerCase().trim()
        const company = (drive.company?.company_name || '').toLowerCase()
        const role = (drive.job_role || '').toLowerCase()
        const status = (drive.overall_status || '').toLowerCase()
        return company.includes(q) || role.includes(q) || status.includes(q)
      }

      return true
    })
  }, [industryDrives, industryTab, selectedStatuses, industrySearchQuery])

  const getBadgeDetails = (status) => {
    switch (status) {
      case 'in_progress':
        return {
          label: 'In Progress',
          className: 'text-[#1d4ed8] bg-[#dbeafe]/90 border border-[#bfdbfe]/80 shadow-[0_2px_8px_rgba(37,99,235,0.12)]'
        }
      case 'registration_open':
        return {
          label: 'Registration Open',
          className: 'text-[#0284c7] bg-[#e0f2fe]/90 border border-[#bae6fd]/80 shadow-[0_2px_8px_rgba(2,132,199,0.12)]'
        }
      case 'awaiting_final_result':
        return {
          label: 'Awaiting Result',
          className: 'text-[#b45309] bg-[#fef3c7]/90 border border-[#fde68a]/80 shadow-[0_2px_8px_rgba(217,119,6,0.12)]'
        }
      case 'awaiting_next_round':
        return {
          label: 'Date Pending',
          className: 'text-[#b45309] bg-[#fef3c7]/90 border border-[#fde68a]/80'
        }
      case 'scheduled':
        return {
          label: 'Scheduled',
          className: 'text-[#6d28d9] bg-[#ede9fe]/90 border border-[#ddd6fe]/80 shadow-[0_2px_8px_rgba(109,40,217,0.12)]'
        }
      case 'completed':
        return {
          label: 'Completed',
          className: 'text-[#15803d] bg-[#dcfce7]/90 border border-[#bbf7d0]/80 shadow-[0_2px_8px_rgba(22,163,74,0.12)]'
        }
      case 'on_hold':
        return {
          label: 'On Hold',
          className: 'text-[#64748b] bg-[#f1f5f9] border border-[#cbd5e1]'
        }
      case 'cancelled':
        return {
          label: 'Cancelled',
          className: 'text-[#dc2626] bg-[#fef2f2] border border-[#fecaca]'
        }
      case 'draft':
      default:
        return {
          label: 'Draft',
          className: 'text-[#475569] bg-[#e2e8f0]/90 border border-[#cbd5e1]/80'
        }
    }
  }

  const views = [
    { id: 'overall', title: 'Overall Statistics', sub: 'Batch & outcome view' },
    { id: 'industries', title: 'Industries', sub: 'Recruiter history' },
    { id: 'companies', title: 'Company Statistics', sub: 'Offer performance' },
    { id: 'students', title: 'Students', sub: 'Placement intelligence' }
  ]

  // Load live DB data once on mount
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        setIsLoading(true)
        const [batchSummaries, outcomes] = await Promise.all([
          getIntelligenceBatchSummaries(),
          getIntelligenceOutcomeSummary('')
        ])

        if (isMounted) {
          setBatches(batchSummaries || [])
          setOutcomeData(outcomes || {})
        }
      } catch (err) {
        console.error('Failed to load intelligence left panel data:', err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  // Whenever selectedBatch changes, refresh outcome data for that batch (or overall if null)
  useEffect(() => {
    let isMounted = true

    const fetchOutcome = async () => {
      try {
        const data = await getIntelligenceOutcomeSummary(selectedBatch || '')
        if (isMounted && data) {
          setOutcomeData(data)
        }
      } catch (err) {
        console.error('Failed to update outcome data for batch:', err)
      }
    }

    fetchOutcome()

    return () => {
      isMounted = false
    }
  }, [selectedBatch])

  // Look up if a specific batch is currently selected
  const chosenBatchObj = selectedBatch
    ? batches.find((b) => b.batch_name === selectedBatch || String(b.id) === String(selectedBatch))
    : null

  const outcomeCounts = chosenBatchObj
    ? {
        notPlaced: outcomeData?.not_placed_count ?? chosenBatchObj.not_placed_students,
        notEligible: outcomeData?.not_eligible_count ?? chosenBatchObj.not_eligible_count ?? 0,
        higherStudies: outcomeData?.higher_studies_count ?? chosenBatchObj.higher_studies_count ?? 0,
        entrepreneur: outcomeData?.entrepreneur_count ?? ((chosenBatchObj.startup_count || 0) + (chosenBatchObj.business_count || 0))
      }
    : {
        notPlaced: outcomeData?.not_placed_count ?? batches.reduce((acc, b) => acc + (b.not_placed_students || 0), 0),
        notEligible: outcomeData?.not_eligible_count ?? batches.reduce((acc, b) => acc + (b.not_eligible_count || 0), 0),
        higherStudies: outcomeData?.higher_studies_count ?? batches.reduce((acc, b) => acc + (b.higher_studies_count || 0), 0),
        entrepreneur: outcomeData?.entrepreneur_count ?? batches.reduce((acc, b) => acc + ((b.startup_count || 0) + (b.business_count || 0)), 0)
      }

  const outcomeGroups = [
    {
      id: 'notPlaced',
      title: 'Not Yet Placed',
      sub: chosenBatchObj ? `Opportunity & conversion · Batch ${chosenBatchObj.batch_name}` : 'Opportunity & conversion intervention',
      count: outcomeCounts.notPlaced
    },
    {
      id: 'notEligible',
      title: 'Not Eligible',
      sub: chosenBatchObj ? `Eligibility restrictions · Batch ${chosenBatchObj.batch_name}` : 'Academic eligibility restrictions',
      count: outcomeCounts.notEligible
    },
    {
      id: 'higherStudies',
      title: 'Higher Studies',
      sub: chosenBatchObj ? `Programme & institution · Batch ${chosenBatchObj.batch_name}` : 'Programme, institution & evidence',
      count: outcomeCounts.higherStudies
    },
    {
      id: 'entrepreneur',
      title: 'Entrepreneurship',
      sub: chosenBatchObj ? `Startup & venture status · Batch ${chosenBatchObj.batch_name}` : 'Startup and current venture status',
      count: outcomeCounts.entrepreneur
    }
  ]

  const q = searchQuery.toLowerCase().trim()

  // 1. Overall view data
  const filteredBatches = batches.filter((b) => {
    if (!q) return true
    const name = (b.batch_name || '').toLowerCase()
    return name.includes(q) || `batch ${name}`.includes(q)
  })

  const filteredOutcomes = outcomeGroups.filter((o) => {
    if (!q) return true
    return o.title.toLowerCase().includes(q) || o.sub.toLowerCase().includes(q)
  })

  // 3. Company stats view data
  const companyGroups = [
    { title: 'Completed', status: 'Completed', subtitle: 'Offers released' },
    { title: 'Ongoing', status: 'Ongoing', subtitle: 'Recruitment underway' },
    { title: 'Awaiting Result', status: 'Awaiting Result', subtitle: 'Result still pending' },
    { title: 'Confirmed', status: 'Confirmed', subtitle: 'Future visit confirmed' },
    { title: 'Yet to Confirm', status: 'Not Confirmed', subtitle: 'Recruiter follow-up' },
    { title: 'Missed This Year', status: 'Not Visiting', subtitle: 'Previously active' }
  ]

  const filteredCompanyGroups = companyGroups.filter((cg) => {
    if (companyTab === 'active') {
      if (!['Ongoing', 'Awaiting Result', 'Confirmed'].includes(cg.status)) return false
    } else if (companyTab === 'completed') {
      if (cg.status !== 'Completed') return false
    }
    if (!q) return true
    return cg.title.toLowerCase().includes(q) || cg.subtitle.toLowerCase().includes(q)
  })

  // 4. Student focus view data
  const focusGroups = [
    { id: 'not_placed', title: 'Not Placed', subtitle: 'Still without placement', count: studentsData.filter(s => s.outcome === 'Not Placed').length, badgeColor: 'bg-[#fef3c7] text-[#b45309]' },
    { id: 'final_misses', title: 'Repeated Final Misses', subtitle: '2+ unsuccessful final rounds', count: studentsData.filter(s => s.finalMisses >= 2).length, badgeColor: 'bg-[#fee2e2] text-[#b91c1c]' },
    { id: 'not_honoured', title: 'Invitations Not Honoured', subtitle: 'Assessment or interview skips', count: studentsData.filter(s => s.notHonoured > 0).length, badgeColor: 'bg-[#ede9fe] text-[#6d28d9]' },
    { id: 'high_cgpa', title: 'High CGPA · Unplaced', subtitle: 'CGPA ≥ 8.5 with no offer', count: studentsData.filter(s => s.cgpa >= 8.5 && s.outcome === 'Not Placed').length, badgeColor: 'bg-[#dbeafe] text-[#1d4ed8]' },
    { id: 'all_students', title: 'All Students', subtitle: 'Full student intelligence directory', count: studentsData.length, badgeColor: 'bg-[#f1f5f9] text-[#475569]' }
  ]

  const filteredStudents = focusGroups.filter(fg => {
    if (studentTab === 'attention' && !['not_placed', 'final_misses', 'not_honoured', 'high_cgpa'].includes(fg.id)) return false
    if (studentTab === 'placed' && fg.id !== 'all_students') return false
    if (!q) return true
    return fg.title.toLowerCase().includes(q) || fg.subtitle.toLowerCase().includes(q)
  })

  // Helper badge generator for Company stats
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dcfce7] text-[#15803d]">Completed</span>
      case 'Ongoing':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dbeafe] text-[#1d4ed8]">Ongoing</span>
      case 'Awaiting Result':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef3c7] text-[#b45309]">Awaiting Result</span>
      case 'Confirmed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ede9fe] text-[#6d28d9]">Confirmed</span>
      case 'Not Confirmed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f1f5f9] text-[#475569]">Yet to Confirm</span>
      case 'Not Visiting':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fee2e2] text-[#b91c1c]">Missed</span>
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f1f5f9] text-[#475569]">{status}</span>
    }
  }

  return (
    <aside className="w-[390px] min-w-[390px] shrink-0 bg-[#fbfdff] border-r border-[#dbe5f1] h-full flex flex-col overflow-hidden select-none">
      {/* 1. Top Placement Analysis Header & Grid */}
      <div className="p-4 border-b border-[#edf2f7] flex flex-col gap-3 shrink-0 bg-white">
        <span className="text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b]">
          Placement Analysis
        </span>

        {/* 2x2 Analysis Grid */}
        <div className="grid grid-cols-2 gap-2">
          {views.map((v) => {
            const isActive = currentView === v.id
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onViewChange(v.id)}
                className={`min-h-[64px] p-2.5 text-left rounded-[11px] border transition cursor-pointer flex flex-col justify-center relative ${
                  isActive
                    ? 'border-[#3b82f6] bg-[#eff6ff] text-[#1d4ed8] shadow-[0_1px_3px_rgba(37,99,235,0.08)] ring-1 ring-[#3b82f6]/30'
                    : 'border-[#dbe5f1] bg-white text-[#475569] hover:border-[#93c5fd] hover:bg-[#f8fafc]'
                }`}
              >
                <div className={`text-[12.5px] font-[800] leading-tight ${isActive ? 'text-[#1d4ed8]' : 'text-[#1e293b]'}`}>
                  {v.title}
                </div>
                <div className="text-[10.5px] text-[#64748b] mt-1 leading-tight truncate">
                  {v.sub}
                </div>
              </button>
            )
          })}
        </div>

        {/* --- HEADER CONTROLS: FOR INDUSTRIES VIEW (Placement Drive tab layout) --- */}
        {currentView === 'industries' ? (
          <>
            {/* Search Box with Integrated Filter Button */}
            <div className="relative mt-1 flex items-center gap-2" ref={filterDropdownRef}>
              <div className="relative flex-1 group">
                <span className="absolute left-[12px] top-[11.5px] text-[#94a3b8] group-focus-within:text-[#2563eb] transition-colors pointer-events-none">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  value={industrySearchQuery}
                  onChange={(e) => setIndustrySearchQuery(e.target.value)}
                  placeholder="Search company or role"
                  className="w-full h-[38px] pr-[12px] pl-[34px] bg-white hover:bg-white focus:bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[10px] text-[13px] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition-all shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                />
              </div>

              {/* Filter Trigger Button */}
              {(() => {
                const activeFilterCount = selectedStatuses.size + (effectiveBatch !== 'all' ? 1 : 0)
                return (
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
                    title="Filter by recruitment status & batch"
                    className={`h-[38px] px-2.5 rounded-[10px] border flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                      activeFilterCount > 0
                        ? 'bg-[#eff6ff] text-[#2563eb] border-[#93c5fd] font-bold shadow-xs'
                        : 'bg-white text-[#64748b] hover:text-[#1e293b] border-[#dbe5f1] hover:border-[#cbd5e1]'
                    }`}
                  >
                    <Filter size={15} />
                    {activeFilterCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[#2563eb] text-white text-[10px] font-bold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                )
              })()}

              {/* Status & Batch Filter Dropdown Menu */}
              {isFilterDropdownOpen && (
                <div className="absolute top-[44px] right-0 w-[240px] bg-white/95 backdrop-blur-md rounded-[14px] shadow-[0_12px_36px_rgba(15,23,42,0.18)] border border-[#dbe5f1] p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#f1f5f9]">
                    <span className="text-[11px] font-[850] uppercase tracking-wider text-[#64748b]">
                      Filters
                    </span>
                    {(selectedStatuses.size > 0 || effectiveBatch !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          clearStatusFilters()
                          handleBatchSelect('all')
                        }}
                        className="text-[11px] text-[#2563eb] hover:underline font-semibold cursor-pointer"
                      >
                        Reset All
                      </button>
                    )}
                  </div>

                  {/* Batch Filter Section */}
                  <div className="mb-2">
                    <span className="text-[10px] font-[800] uppercase tracking-wider text-[#94a3b8] px-1">
                      Academic Batch
                    </span>
                    <div className="flex flex-col gap-0.5 mt-1 max-h-[110px] overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => handleBatchSelect('all')}
                        className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between text-left text-[12px] transition cursor-pointer ${
                          effectiveBatch === 'all'
                            ? 'bg-[#eff6ff] text-[#2563eb] font-bold'
                            : 'text-[#334155] hover:bg-[#f8fafc]'
                        }`}
                      >
                        <span>All Batches</span>
                        {effectiveBatch === 'all' && <Check size={14} className="text-[#2563eb]" />}
                      </button>
                      {batches.map((b) => (
                        <button
                          key={b.batch_id || b.batch_name}
                          type="button"
                          onClick={() => handleBatchSelect(b.batch_name)}
                          className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between text-left text-[12px] transition cursor-pointer ${
                            effectiveBatch === b.batch_name
                              ? 'bg-[#eff6ff] text-[#2563eb] font-bold'
                              : 'text-[#334155] hover:bg-[#f8fafc]'
                          }`}
                        >
                          <span>Batch {b.batch_name}</span>
                          {effectiveBatch === b.batch_name && <Check size={14} className="text-[#2563eb]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status Filter Section */}
                  <div className="pt-2 border-t border-[#f1f5f9]">
                    <span className="text-[10px] font-[800] uppercase tracking-wider text-[#94a3b8] px-1">
                      Recruitment Status
                    </span>
                    <div className="flex flex-col gap-0.5 mt-1 max-h-[140px] overflow-y-auto pr-1">
                      {statusOptions.map((opt) => {
                        const isChecked = selectedStatuses.has(opt.value)
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleStatus(opt.value)}
                            className={`w-full px-2 py-1.5 rounded-[7px] flex items-center justify-between text-left text-[12px] transition cursor-pointer ${
                              isChecked
                                ? 'bg-[#eff6ff] text-[#2563eb] font-semibold'
                                : 'text-[#334155] hover:bg-[#f8fafc]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${opt.dotColor}`} />
                              <span>{opt.label}</span>
                            </div>
                            {isChecked && <Check size={14} className="text-[#2563eb]" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filter Tabs (All / Active / Completed) with Animated Sliding Glass Pill */}
            <div
              ref={tabNavRef}
              className="relative mt-1 p-[3px] grid grid-cols-3 gap-[3px] rounded-[10px] bg-[#f1f5f9]/90 border border-[#e2e8f0]/80 backdrop-blur-md overflow-hidden shrink-0"
            >
              <div
                style={{
                  transform: `translate3d(${tabPillStyle.left}px, ${tabPillStyle.top}px, 0)`,
                  width: `${tabPillStyle.width}px`,
                  height: `${tabPillStyle.height}px`,
                  opacity: tabPillStyle.opacity
                }}
                className="absolute top-0 left-0 pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] rounded-[8px] bg-white/95 backdrop-blur-md border border-white shadow-[0_2px_8px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] z-0"
              />

              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'completed', label: 'Completed' }
              ].map((t) => {
                const isActive = industryTab === t.id
                return (
                  <button
                    key={t.id}
                    ref={(el) => (tabRefs.current[t.id] = el)}
                    type="button"
                    onClick={() => setIndustryTab(t.id)}
                    className={`relative z-10 py-[7px] px-[4px] text-[12.5px] font-[750] rounded-[7px] capitalize transition-colors duration-200 cursor-pointer text-center ${
                      isActive ? 'text-[#2563eb]' : 'text-[#64748b] hover:text-[#1e293b]'
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* Active Filter Chips (Batch and/or Statuses) */}
            {(selectedStatuses.size > 0 || effectiveBatch !== 'all') && (
              <div className="mt-1 flex items-center flex-wrap gap-1.5 shrink-0">
                {effectiveBatch !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe]">
                    <span>Batch {effectiveBatch}</span>
                    <X
                      size={11}
                      className="cursor-pointer hover:text-[#dc2626]"
                      onClick={() => handleBatchSelect('all')}
                    />
                  </span>
                )}
                {Array.from(selectedStatuses).map((st) => {
                  const opt = statusOptions.find((o) => o.value === st)
                  return (
                    <span
                      key={st}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe]"
                    >
                      <span>{opt?.label || st}</span>
                      <X
                        size={11}
                        className="cursor-pointer hover:text-[#dc2626]"
                        onClick={() => toggleStatus(st)}
                      />
                    </span>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    clearStatusFilters()
                    handleBatchSelect('all')
                  }}
                  className="text-[10.5px] text-[#64748b] hover:text-[#dc2626] font-medium ml-1 underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Search Input Box for other views */}
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  currentView === 'overall'
                    ? 'Search batch or outcome...'
                    : currentView === 'companies'
                    ? 'Search company...'
                    : 'Search student or register no...'
                }
                className="w-full h-[38px] pl-9 pr-3 bg-white hover:bg-[#f8fafc] focus:bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[10px] text-[13px] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition shadow-2xs font-medium"
              />
            </div>

            {/* Segment Tabs tailored to each view */}
            <div className="mt-1">
              {currentView === 'overall' && (
                <GlassSegmentedControl
                  options={[
                    { id: 'batches', label: 'Batches' },
                    { id: 'outcomes', label: 'Outcome Groups' }
                  ]}
                  value={overallTab}
                  onChange={setOverallTab}
                  buttonPy="py-[7px]"
                  fontSize="text-[13px]"
                />
              )}

              {currentView === 'companies' && (
                <GlassSegmentedControl
                  options={[
                    { id: 'all', label: 'All' },
                    { id: 'active', label: 'Active' },
                    { id: 'completed', label: 'Completed' }
                  ]}
                  value={companyTab}
                  onChange={setCompanyTab}
                  buttonPy="py-[7px]"
                  fontSize="text-[13px]"
                />
              )}

              {currentView === 'students' && (
                <GlassSegmentedControl
                  options={[
                    { id: 'all', label: 'All' },
                    { id: 'attention', label: 'Attention' },
                    { id: 'placed', label: 'Placed' }
                  ]}
                  value={studentTab}
                  onChange={setStudentTab}
                  buttonPy="py-[7px]"
                  fontSize="text-[13px]"
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* 2. Scrollable Content tailored to current view */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 hide-scrollbar [&::-webkit-scrollbar]:hidden">
        {/* VIEW 1: OVERALL STATISTICS */}
        {currentView === 'overall' && (
          isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#94a3b8]">
              <Loader2 className="w-5 h-5 animate-spin text-[#2563eb] mb-2" />
              <span className="text-[12px] font-medium">Loading database statistics...</span>
            </div>
          ) : (
            <>
              {overallTab === 'batches' && (
                <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between px-1 mb-0.5">
                    <div className="text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b]">
                      Graduation Batches
                    </div>
                    {selectedBatch && (
                      <button
                        type="button"
                        onClick={() => onSelectBatch(null)}
                        className="text-[11px] font-semibold text-[#2563eb] hover:text-[#1d4ed8] hover:underline cursor-pointer"
                      >
                        Reset to All
                      </button>
                    )}
                  </div>

                  {filteredBatches.map((b) => {
                    const isActive = selectedBatch === b.batch_name || selectedBatch === String(b.id)
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onSelectBatch(b.batch_name)}
                        className={`group relative w-full p-[14px_16px] text-left rounded-[12px] transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                          isActive
                            ? 'bg-gradient-to-br from-white via-[#f0f6ff] to-[#e6f0fd] border border-[#60a5fa] shadow-[0_4px_16px_rgba(37,99,235,0.10)] ring-1 ring-[#2563eb]/20 translate-x-[2px]'
                            : 'bg-white/95 hover:bg-white border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-[1px]'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute -left-[1px] top-[12px] bottom-[12px] w-[3.5px] rounded-r-full bg-[#2563eb] shadow-[0_0_8px_#3b82f6]" />
                        )}

                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[14px] font-[850] text-[#1e293b] group-hover:text-[#2563eb] transition-colors leading-tight">
                              Batch {b.batch_name}
                            </div>
                            <div className="text-[11.5px] text-[#64748b] mt-1 font-medium">
                              {b.placed_students} placed
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]/80 shadow-2xs">
                            {b.total_students}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#64748b] mt-3 pt-2.5 border-t border-[#e2e8f0]/80 font-medium">
                          <span>{b.not_placed_students} not placed</span>
                          <span>{b.nip_count ?? b.higher_studies_count ?? 0} NIP</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {overallTab === 'outcomes' && (
                <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between px-1 mb-0.5">
                    <div className="text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b]">
                      Outcome Groups {chosenBatchObj ? `· Batch ${chosenBatchObj.batch_name}` : '· Overall'}
                    </div>
                    {chosenBatchObj && (
                      <button
                        type="button"
                        onClick={() => onSelectBatch(null)}
                        className="text-[11px] font-semibold text-[#2563eb] hover:text-[#1d4ed8] hover:underline cursor-pointer"
                      >
                        Show All Batches
                      </button>
                    )}
                  </div>

                  {filteredOutcomes.map((o) => {
                    const isActive = selectedOutcome === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => onSelectOutcome(o.id)}
                        className={`group relative w-full p-[14px_16px] text-left rounded-[12px] transition-all duration-200 cursor-pointer flex flex-col justify-center ${
                          isActive
                            ? 'bg-gradient-to-br from-white via-[#f0f6ff] to-[#e6f0fd] border border-[#60a5fa] shadow-[0_4px_16px_rgba(37,99,235,0.10)] ring-1 ring-[#2563eb]/20 translate-x-[2px]'
                            : 'bg-white/95 hover:bg-white border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-[1px]'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute -left-[1px] top-[10px] bottom-[10px] w-[3.5px] rounded-r-full bg-[#2563eb] shadow-[0_0_8px_#3b82f6]" />
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[13.5px] font-[850] text-[#1e293b] group-hover:text-[#2563eb] transition-colors leading-tight">
                            {o.title}
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]/70">
                            {o.count}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#64748b] mt-1 font-medium leading-snug">
                          {o.sub}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )
        )}

        {/* VIEW 2: INDUSTRIES (Same layout, design & grouped cards as Placement Drive tab) */}
        {currentView === 'industries' && (
          <div className="flex flex-col gap-2 animate-in fade-in duration-150">
            {isLoadingDrives && (
              <div className="py-12 flex flex-col items-center justify-center text-[#94a3b8]">
                <Loader2 className="w-5 h-5 animate-spin text-[#2563eb] mb-2" />
                <span className="text-[12px] font-medium">Loading drives...</span>
              </div>
            )}

            {!isLoadingDrives && filteredIndustryDrives.length === 0 && (
              <div className="text-center py-12 text-[#64748b] text-[12px] bg-white/50 border border-dashed border-[#dbe5f1] rounded-[10px] m-1 p-4">
                No matching drives found.
              </div>
            )}

            {!isLoadingDrives &&
              ['Requires Attention', 'Upcoming', 'Recently Completed'].map((group) => {
                const groupDrives = filteredIndustryDrives.filter(
                  (d) => (d.status_group || 'Requires Attention') === group
                )
                if (!groupDrives.length) return null

                return (
                  <div key={group} className="mb-2">
                    <div className="mb-2 text-[#64748b] text-[10.5px] font-[850] tracking-[0.6px] uppercase px-1 flex items-center justify-between">
                      <span>{group}</span>
                      <span className="text-[10px] font-semibold text-[#94a3b8] bg-[#f1f5f9] px-1.5 py-0.2 rounded-full">
                        {groupDrives.length}
                      </span>
                    </div>

                    {groupDrives.map((drive) => {
                      const isSelected = String(selectedIndustry) === String(drive.id)
                      const companyName = drive.company?.company_name || 'Placement Company'
                      const badge = getBadgeDetails(drive.overall_status)

                      return (
                        <div
                          key={drive.id}
                          onClick={() => onSelectIndustry(String(selectedIndustry) === String(drive.id) ? null : drive.id)}
                          className={`group relative mb-2 p-[12px_14px] rounded-[11px] transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-br from-white via-[#f0f6ff] to-[#e6f0fd] border border-[#60a5fa] shadow-[0_4px_16px_rgba(37,99,235,0.10)] ring-1 ring-[#2563eb]/20 translate-x-[2px]'
                              : 'bg-white/90 hover:bg-white backdrop-blur-xs border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-[1px]'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute -left-[1px] top-[10px] bottom-[10px] w-[3.5px] rounded-r-full bg-[#2563eb] shadow-[0_0_8px_#3b82f6]" />
                          )}

                          <div className="flex items-start justify-between gap-[8px]">
                            <div>
                              <div className="text-[14px] font-[800] text-[#1e293b] group-hover:text-[#2563eb] transition-colors leading-tight flex items-center gap-1.5">
                                <span>{companyName}</span>
                              </div>
                              <div className="text-[11.5px] text-[#64748b] mt-[3px] line-clamp-1 font-medium">
                                {drive.job_role}
                              </div>
                            </div>

                            <span
                              className={`py-[3.5px] px-[8.5px] rounded-[18px] text-[10px] font-[850] whitespace-nowrap shrink-0 backdrop-blur-sm transition-transform group-hover:scale-[1.03] ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>

                          <div className="mt-[9px] pt-[7px] border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
                            <span className="flex items-center gap-1 font-medium">
                              <Users size={12} className="text-[#94a3b8]" />
                              {drive.total_students || 0} students
                            </span>
                            <span className="text-[#94a3b8] font-normal">
                              {drive.subtitle_meta || 'Drive Record'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
          </div>
        )}

        {/* VIEW 3: COMPANY STATISTICS (Offer Performance) */}
        {currentView === 'companies' && (
          <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
            <div className="text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] mb-0.5 px-1">
              Process Position
            </div>

            {/* All Companies Card */}
            <button
              type="button"
              onClick={() => onSelectCompany('All')}
              className={`group relative w-full p-[14px_16px] text-left rounded-[12px] transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                selectedCompany === 'All'
                  ? 'bg-gradient-to-br from-white via-[#f0f6ff] to-[#e6f0fd] border border-[#60a5fa] shadow-[0_4px_16px_rgba(37,99,235,0.10)] ring-1 ring-[#2563eb]/20 translate-x-[2px]'
                  : 'bg-white/95 hover:bg-white border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-[1px]'
              }`}
            >
              {selectedCompany === 'All' && (
                <span className="absolute -left-[1px] top-[12px] bottom-[12px] w-[3.5px] rounded-r-full bg-[#2563eb] shadow-[0_0_8px_#3b82f6]" />
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-[850] text-[#1e293b] group-hover:text-[#2563eb] transition-colors leading-tight">
                    All Companies
                  </div>
                  <div className="text-[11.5px] text-[#64748b] mt-1 font-medium">
                    Complete recruiter list
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]/80 shadow-2xs">
                  {companyStatsData.length}
                </span>
              </div>
            </button>

            {/* Individual Process Status Cards */}
            {filteredCompanyGroups.map((cg) => {
              const count = companyStatsData.filter(x => x.status === cg.status).length
              const isActive = selectedCompany === cg.status
              return (
                <button
                  key={cg.title}
                  type="button"
                  onClick={() => onSelectCompany(cg.status)}
                  className={`group relative w-full p-[14px_16px] text-left rounded-[12px] transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-gradient-to-br from-white via-[#f0f6ff] to-[#e6f0fd] border border-[#60a5fa] shadow-[0_4px_16px_rgba(37,99,235,0.10)] ring-1 ring-[#2563eb]/20 translate-x-[2px]'
                      : 'bg-white/95 hover:bg-white border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-[1px]'
                  }`}
                >
                  {isActive && (
                    <span className="absolute -left-[1px] top-[12px] bottom-[12px] w-[3.5px] rounded-r-full bg-[#2563eb] shadow-[0_0_8px_#3b82f6]" />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-[850] text-[#1e293b] group-hover:text-[#2563eb] transition-colors leading-tight">
                        {cg.title}
                      </div>
                      <div className="text-[11.5px] text-[#64748b] mt-1 font-medium">
                        {cg.subtitle}
                      </div>
                    </div>
                    {renderStatusBadge(cg.status)}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#64748b] mt-3 pt-2.5 border-t border-[#e2e8f0]/80 font-medium">
                    <span>{count} companies</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* VIEW 4: STUDENTS (Placement Intelligence) */}
        {currentView === 'students' && (
          <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
            <div className="text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] mb-0.5 px-1">
              Requires Attention
            </div>

            {filteredStudents.map((fg) => {
              const isActive = selectedStudentFocus === fg.id
              return (
                <button
                  key={fg.id}
                  type="button"
                  onClick={() => onSelectStudentFocus(fg.id)}
                  className={`group relative w-full p-[14px_16px] text-left rounded-[12px] transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-gradient-to-br from-white via-[#f0f6ff] to-[#e6f0fd] border border-[#60a5fa] shadow-[0_4px_16px_rgba(37,99,235,0.10)] ring-1 ring-[#2563eb]/20 translate-x-[2px]'
                      : 'bg-white/95 hover:bg-white border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-[1px]'
                  }`}
                >
                  {isActive && (
                    <span className="absolute -left-[1px] top-[12px] bottom-[12px] w-[3.5px] rounded-r-full bg-[#2563eb] shadow-[0_0_8px_#3b82f6]" />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-[850] text-[#1e293b] group-hover:text-[#2563eb] transition-colors leading-tight">
                        {fg.title}
                      </div>
                      <div className="text-[11.5px] text-[#64748b] mt-1 font-medium">
                        {fg.subtitle}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${fg.badgeColor}`}>
                      {fg.count}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
