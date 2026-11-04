import React, { useState, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import GlassSegmentedControl from '../../common/GlassSegmentedControl'
import { getIntelligenceBatchSummaries, getIntelligenceOutcomeSummary } from '../../../services/api'
import { industriesData, companyStatsData, studentsData } from './intelligenceData'

/**
 * IntelligenceLeftPanel
 * Left Panel (390px) for Placement Intelligence:
 * - 4 Analysis Cards (Overall Statistics, Industries, Company Statistics, Students)
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
  selectedOutcome: externalSelectedOutcome,
  onSelectOutcome: externalOnSelectOutcome,
  selectedIndustry = '__overall__',
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
  const [industryTab, setIndustryTab] = useState('all') // 'all' | 'active' | 'attention'
  const [companyTab, setCompanyTab] = useState('all') // 'all' | 'active' | 'completed'
  const [studentTab, setStudentTab] = useState('all') // 'all' | 'attention' | 'placed'

  const [searchQuery, setSearchQuery] = useState('')
  const [batches, setBatches] = useState([])
  const [outcomeData, setOutcomeData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

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

  // If a batch is chosen, use that batch's student counts! Unless before choosing the batch, use overall count.
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

  // 2. Industries view data
  const filteredIndustries = industriesData.filter((item) => {
    if (industryTab === 'active') {
      if (!['Completed', 'Ongoing', 'Awaiting Result', 'Confirmed'].includes(item.status)) return false
    } else if (industryTab === 'attention') {
      if (!['Not Confirmed', 'Not Visiting', 'Awaiting Result'].includes(item.status)) return false
    }
    if (!q) return true
    return item.name.toLowerCase().includes(q) || item.role.toLowerCase().includes(q) || item.sector.toLowerCase().includes(q)
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

  // Helper badge generator
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

        {/* Search Input Box */}
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
                : currentView === 'industries'
                ? 'Search industry or role...'
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

          {currentView === 'industries' && (
            <GlassSegmentedControl
              options={[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'attention', label: 'Attention' }
              ]}
              value={industryTab}
              onChange={setIndustryTab}
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

        {/* VIEW 2: INDUSTRIES (Recruiter History) */}
        {currentView === 'industries' && (
          <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
            <div className="text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] mb-0.5 px-1">
              Industry View
            </div>

            {/* Overall Card */}
            <button
              type="button"
              onClick={() => onSelectIndustry('__overall__')}
              className={`group relative w-full p-[14px_16px] text-left rounded-[12px] transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                selectedIndustry === '__overall__'
                  ? 'bg-gradient-to-br from-white via-[#f0f6ff] to-[#e6f0fd] border border-[#60a5fa] shadow-[0_4px_16px_rgba(37,99,235,0.10)] ring-1 ring-[#2563eb]/20 translate-x-[2px]'
                  : 'bg-white/95 hover:bg-white border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-[1px]'
              }`}
            >
              {selectedIndustry === '__overall__' && (
                <span className="absolute -left-[1px] top-[12px] bottom-[12px] w-[3.5px] rounded-r-full bg-[#2563eb] shadow-[0_0_8px_#3b82f6]" />
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-[850] text-[#1e293b] group-hover:text-[#2563eb] transition-colors leading-tight">
                    Overall
                  </div>
                  <div className="text-[11.5px] text-[#64748b] mt-1 font-medium">
                    Complete recruiter network
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]/80 shadow-2xs">
                  312
                </span>
              </div>
            </button>

            <div className="text-[11px] font-[850] uppercase tracking-[0.5px] text-[#64748b] mt-2 mb-0.5 px-1">
              Recruiters
            </div>

            {filteredIndustries.map((ind) => {
              const isActive = selectedIndustry === ind.id
              const totalOffers = ind.history?.reduce((acc, h) => acc + (h.offers || 0), 0) || 0
              return (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => onSelectIndustry(ind.id)}
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
                        {ind.name}
                      </div>
                      <div className="text-[11.5px] text-[#64748b] mt-1 font-medium truncate max-w-[200px]">
                        {ind.role}
                      </div>
                    </div>
                    {renderStatusBadge(ind.status)}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#64748b] mt-3 pt-2.5 border-t border-[#e2e8f0]/80 font-medium">
                    <span>{ind.sector}</span>
                    <span>{totalOffers} offers</span>
                  </div>
                </button>
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
