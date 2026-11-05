import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Loader2,
  Search,
  X,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Award,
  AlertTriangle,
  TrendingUp,
  Briefcase,
  ChevronDown,
  Check
} from 'lucide-react'
import {
  getIntelligenceOverallStats,
  getIntelligenceOutcomeStudents,
  getStudentReviewDetail,
  getIntelligenceIndustryRightPanel,
  getIntelligenceIndustryCompanies,
  getBatches
} from '../../../services/api'
import {
  StudentProfileHeader,
  StudentStatCards,
  StudentOffersCard,
  StudentAcademicEligibilityCard,
  StudentPlacementJourneyTimeline
} from '../../common/student'

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
  selectedOutcomeType = 'offers',
  onSelectOutcome = () => {},
  selectedIndustry = null,
  selectedIndustryCell = null,
  onSelectIndustryCell = () => {},
  onClearIndustryCell = () => {},
  selectedIndustryDomain = 'all'
}) {
  const [activeMode, setActiveMode] = useState('overview') // Default view is Overview
  const [loading, setLoading] = useState(false)
  const [statsData, setStatsData] = useState(null)

  // Outcome group students state
  const [outcomeStudents, setOutcomeStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [studentSearchQuery, setStudentSearchQuery] = useState('')

  // Detailed student record state
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null)
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false)

  // Industries view state
  const [industryBatches, setIndustryBatches] = useState([])
  const [selectedIndustryBatch, setSelectedIndustryBatch] = useState('2022-2026')
  const [industryPanelData, setIndustryPanelData] = useState(null)
  const [loadingIndustryPanel, setLoadingIndustryPanel] = useState(false)
  const [topRecruiterTab, setTopRecruiterTab] = useState('salary') // 'salary' | 'count'
  const [industrySectionTab, setIndustrySectionTab] = useState('attention') // 'attention' | 'topRecruiters' | 'activityHistory'
  const [isIndustryBatchOpen, setIsIndustryBatchOpen] = useState(false)
  const industryBatchRef = useRef(null)

  // Companies drilldown state for Industries view (e.g. clicking table cell like '1' in Batch 2027)
  const [industryCompanies, setIndustryCompanies] = useState([])
  const [industryCompaniesData, setIndustryCompaniesData] = useState(null)
  const [loadingIndustryCompanies, setLoadingIndustryCompanies] = useState(false)
  const [companySearchQuery, setCompanySearchQuery] = useState('')

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (industryBatchRef.current && !industryBatchRef.current.contains(e.target)) {
        setIsIndustryBatchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch batches on mount for industry view
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const b = await getBatches()
        if (b && b.length > 0) {
          setIndustryBatches(b)
          const current = b.find((x) => String(x.name).includes('2026')) || b[0]
          setSelectedIndustryBatch(current.name)
        }
      } catch (err) {
        console.error('Failed to fetch batches for industry right panel:', err)
      }
    }
    fetchBatches()
  }, [])

  // Fetch industry right panel data whenever batch or department changes
  useEffect(() => {
    if (currentView !== 'industries') return
    let isMounted = true
    const fetchIndustryData = async () => {
      setLoadingIndustryPanel(true)
      try {
        const data = await getIntelligenceIndustryRightPanel({
          batch: selectedIndustryBatch,
          department: selectedDepartment,
          sector: selectedIndustryDomain
        })
        if (isMounted) {
          setIndustryPanelData(data)
        }
      } catch (err) {
        console.error('Failed to load industry right panel data:', err)
      } finally {
        if (isMounted) {
          setLoadingIndustryPanel(false)
        }
      }
    }
    fetchIndustryData()
    return () => {
      isMounted = false
    }
  }, [currentView, selectedIndustryBatch, selectedDepartment, selectedIndustryDomain])

  // Fetch drilldown companies when a table metric cell is clicked
  useEffect(() => {
    if (currentView !== 'industries' || !selectedIndustryCell) {
      setIndustryCompanies([])
      setIndustryCompaniesData(null)
      setCompanySearchQuery('')
      return
    }
    let isMounted = true
    const fetchCompanies = async () => {
      setLoadingIndustryCompanies(true)
      try {
        const resp = await getIntelligenceIndustryCompanies({
          metric: selectedIndustryCell.metricKey,
          batch: selectedIndustryCell.batch,
          department: selectedDepartment,
          sector: selectedIndustryDomain
        })
        if (isMounted) {
          setIndustryCompaniesData(resp)
          setIndustryCompanies(resp?.companies || [])
        }
      } catch (err) {
        console.error('Failed to load industry companies for metric cell:', err)
      } finally {
        if (isMounted) {
          setLoadingIndustryCompanies(false)
        }
      }
    }
    fetchCompanies()
    return () => {
      isMounted = false
    }
  }, [currentView, selectedIndustryCell, selectedDepartment, selectedIndustryDomain])

  const filteredIndustryCompanies = useMemo(() => {
    if (!companySearchQuery.trim()) return industryCompanies
    const q = companySearchQuery.toLowerCase()
    return industryCompanies.filter(
      (c) =>
        c.company_name?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.company_domain?.toLowerCase().includes(q) ||
        c.job_roles?.toLowerCase().includes(q) ||
        c.drive_status?.toLowerCase().includes(q) ||
        c.collaboration_type?.toLowerCase().includes(q)
    )
  }, [industryCompanies, companySearchQuery])

  const SALARY_BAND_LABELS = {
    gt40: '> ₹40L',
    p30_40: '₹30–40L',
    p20_30: '₹20–30L',
    p10_20: '₹10–20L',
    p6_10: '₹6–10L',
    p4_6: '₹4–6L',
    p3_4: '₹3–4L'
  }
  const isSalaryBand = Boolean(SALARY_BAND_LABELS[selectedOutcome])

  // Map outcome group keys to standard 4 supported groups or salary band
  const effectiveOutcome = isSalaryBand
    ? selectedOutcome
    : (selectedOutcome === 'higherStudies' || selectedOutcome === 'entrepreneur' || selectedOutcome === 'notEligible')
      ? selectedOutcome
      : 'notPlaced'

  // Switch to students mode when an outcome group or salary band is explicitly chosen
  useEffect(() => {
    if (selectedOutcome) {
      setActiveMode('students')
    }
  }, [selectedOutcome, selectedBatch])

  // Fetch overview stats
  useEffect(() => {
    if (currentView !== 'overall') return
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
    if (currentView !== 'overall') return
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
          department: selectedDepartment || 'All',
          type: selectedOutcomeType || 'offers'
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
  }, [effectiveOutcome, selectedBatch, selectedDepartment, selectedOutcomeType])

  // Clear search query and selected student when outcome group, batch, or dept changes
  useEffect(() => {
    setStudentSearchQuery('')
    setSelectedStudentId(null)
    setSelectedStudentDetail(null)
  }, [effectiveOutcome, selectedBatch, selectedDepartment, selectedOutcomeType])

  // Fetch student review detail when a student is selected
  useEffect(() => {
    let isMounted = true
    if (!selectedStudentId) {
      setSelectedStudentDetail(null)
      return
    }

    const fetchDetail = async () => {
      setLoadingStudentDetail(true)
      try {
        const data = await getStudentReviewDetail(selectedStudentId)
        if (isMounted) {
          setSelectedStudentDetail(data)
        }
      } catch (err) {
        console.error('Failed to load student review detail in intelligence panel:', err)
      } finally {
        if (isMounted) {
          setLoadingStudentDetail(false)
        }
      }
    }

    fetchDetail()

    return () => {
      isMounted = false
    }
  }, [selectedStudentId])

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

  if (currentView === 'industries') {
    // When a specific table metric cell (or KPI card) is clicked, drill down to company list
    if (selectedIndustryCell) {
      return (
        <aside className="w-[475px] min-w-[475px] bg-[#fbfdff] border-l border-[#dbe5f1] h-full flex flex-col select-none overflow-hidden">
          {/* Header */}
          <div className="p-[16px_20px] bg-white border-b border-[#edf2f7] shrink-0">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <button
                type="button"
                onClick={onClearIndustryCell}
                className="flex items-center gap-1.5 text-[12px] font-[750] text-[#2563eb] hover:text-[#1d4ed8] cursor-pointer transition active:scale-95"
              >
                <ArrowLeft size={14} />
                <span>Back to Overview</span>
              </button>

              <span className="px-2.5 py-0.5 rounded-[6px] bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] text-[11px] font-[800]">
                Batch {selectedIndustryCell.batch}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-[850] text-[#1e293b] tracking-tight leading-tight m-0">
                {industryCompaniesData?.metric_title || selectedIndustryCell.metricTitle || 'Companies'}
              </h2>

              <button
                type="button"
                onClick={onClearIndustryCell}
                title="Close"
                className="w-7 h-7 rounded-[7px] text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] flex items-center justify-center transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Search filter input */}
            <div className="relative mt-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                value={companySearchQuery}
                onChange={(e) => setCompanySearchQuery(e.target.value)}
                placeholder="Search recruiters by name, domain, or role..."
                className="w-full h-[34px] pl-9 pr-8 bg-[#f8fafc] hover:bg-white focus:bg-white rounded-[8px] border border-[#dbe5f1] focus:border-[#2563eb] text-[12px] text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none transition shadow-2xs"
              />
              {companySearchQuery && (
                <button
                  type="button"
                  onClick={() => setCompanySearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#1e293b] cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Companies List */}
          {loadingIndustryCompanies ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8] py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#2563eb] mb-2" />
              <span className="text-[12.5px] font-semibold text-[#64748b]">
                Loading company records from database...
              </span>
            </div>
          ) : filteredIndustryCompanies.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#94a3b8]">
              <div className="w-12 h-12 rounded-full bg-[#f1f5f9] flex items-center justify-center mb-2.5 text-[#94a3b8]">
                <Building2 size={24} />
              </div>
              <span className="text-[13.5px] font-[800] text-[#475569]">No Recruiters Found</span>
              <span className="text-[11.5px] text-[#94a3b8] mt-1 max-w-[260px] leading-relaxed">
                {companySearchQuery
                  ? `No recruiters match "${companySearchQuery}" for Batch ${selectedIndustryCell.batch}.`
                  : `No recruitment processes recorded under this criteria for Batch ${selectedIndustryCell.batch}.`}
              </span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto hide-scrollbar p-[16px_18px] space-y-2.5">
              {filteredIndustryCompanies.map((c) => (
                <div
                  key={c.company_id}
                  className="p-3.5 bg-white border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-xs rounded-[11px] transition flex flex-col gap-2.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-[9px] bg-[#eff6ff] text-[#2563eb] font-[850] text-[13px] flex items-center justify-center shrink-0 border border-[#dbe5f1]">
                        {c.company_name?.slice(0, 2).toUpperCase() || 'CO'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[13.5px] font-[850] text-[#1e293b] leading-tight truncate m-0">
                          {c.company_name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-[800] uppercase tracking-wider border ${
                              (c.company_domain || '').toUpperCase() === 'CORE'
                                ? 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
                                : (c.company_domain || '').toUpperCase() === 'BOTH'
                                ? 'bg-[#faf5ff] text-[#9333ea] border-[#e9d5ff]'
                                : 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]'
                            }`}
                          >
                            {c.company_domain || 'SOFTWARE'}
                          </span>
                          {c.first_visited_batch && (
                            <span className="text-[10.5px] text-[#64748b] font-medium">
                              (Since {c.first_visited_batch})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.8 rounded-[6px] text-[10.5px] font-[800] whitespace-nowrap shrink-0 border capitalize ${
                        c.drive_status?.toLowerCase().includes('complete')
                          ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                          : c.drive_status === 'Not Started'
                          ? 'bg-[#fff1f2] text-[#e11d48] border-[#fecdd3]'
                          : 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]'
                      }`}
                    >
                      {c.drive_status}
                    </span>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#f1f5f9] text-[11.5px]">
                    <div>
                      <span className="text-[10px] font-[750] uppercase text-[#94a3b8] block">Offers / Placed</span>
                      <span className="font-[850] text-[#1e293b]">
                        {c.students_placed > 0
                          ? `${c.students_placed} Placed`
                          : (c.offers_count > 0 ? `${c.offers_count} Offers` : '—')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-[750] uppercase text-[#94a3b8] block">Package (LPA)</span>
                      <span className="font-[850] text-[#1e293b]">
                        {c.package_lpa > 0 ? `₹${c.package_lpa} LPA` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      )
    }

    const cards = industryPanelData?.cards || {
      total_active_recruiters: 0,
      visited_recruiters: 0,
      ongoing_recruitments: 0,
      completed_recruitments: 0,
      new_recruiters: 0,
      highest_offer_lpa: 0
    }
    const attention = industryPanelData?.attention_recruiters || []
    const topSalary = industryPanelData?.top_recruiters_salary || []
    const topCount = industryPanelData?.top_recruiters_count || []
    const activities = industryPanelData?.recent_activities || []

    return (
      <aside className="w-[475px] min-w-[475px] bg-[#fbfdff] border-l border-[#dbe5f1] h-full flex flex-col select-none overflow-hidden">
        {/* 1. Header with Title & Batch Choosing Dropdown */}
        <div className="p-[16px_20px] bg-white border-b border-[#edf2f7] shrink-0 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-[850] text-[#1e293b] tracking-tight leading-tight m-0">
              Recruiter Analytics
            </h2>
            <p className="text-[11.5px] text-[#64748b] mt-0.5 font-medium">
              Health, highlights & live drive tracking
            </p>
          </div>

          {/* Custom Styled Batch Dropdown */}
          <div className="relative" ref={industryBatchRef}>
            <button
              type="button"
              onClick={() => setIsIndustryBatchOpen((prev) => !prev)}
              className="h-[32px] px-3 bg-[#f8fafc] hover:bg-white border border-[#cbd5e1] hover:border-[#2563eb] rounded-[8px] text-[12px] font-[750] text-[#1e293b] flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-[0.98]"
            >
              <span className="text-[10.5px] font-[800] uppercase tracking-[0.3px] text-[#64748b]">
                Batch
              </span>
              <span className="text-[#1e293b] font-[800]">{selectedIndustryBatch}</span>
              <ChevronDown
                size={13}
                className={`text-[#64748b] transition-transform duration-200 ${
                  isIndustryBatchOpen ? 'rotate-180 text-[#2563eb]' : ''
                }`}
              />
            </button>

            {isIndustryBatchOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-[180px] bg-white border border-[#dbe5f1] rounded-[11px] shadow-[0_10px_28px_rgba(15,23,42,0.12)] p-1.5 flex flex-col gap-0.5 z-50 text-[#1e293b] animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1 text-[10px] font-[800] uppercase tracking-wider text-[#94a3b8] border-b border-[#f1f5f9] mb-0.5">
                  Select Academic Batch
                </div>
                {industryBatches.map((b) => {
                  const isSelected = selectedIndustryBatch === b.name
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedIndustryBatch(b.name)
                        setIsIndustryBatchOpen(false)
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-[7px] text-[12px] font-[700] text-left flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#eff6ff] text-[#2563eb] font-[800]'
                          : 'text-[#475569] hover:bg-[#f8fafc] hover:text-[#1e293b]'
                      }`}
                    >
                      <span>{b.name}</span>
                      {isSelected && <Check size={13} className="text-[#2563eb]" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 2. Scrollable Body */}
        {loadingIndustryPanel ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8]">
            <Loader2 className="w-6 h-6 animate-spin text-[#2563eb] mb-2" />
            <span className="text-[12.5px] font-semibold text-[#64748b]">Loading recruiter metrics...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto hide-scrollbar p-[16px_18px] space-y-4">
            {/* Metric Cards in 2 Rows (3 columns per row) */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              {/* Card 1: Total Recruiters */}
              <div
                onClick={() => onSelectIndustryCell({ metricKey: 'total', metricTitle: 'Total Active Recruiters', batch: selectedIndustryBatch, value: cards.total_active_recruiters })}
                className="p-2.5 bg-white border border-[#e2e8f0] rounded-[10px] shadow-2xs hover:border-[#2563eb] hover:shadow-xs transition flex flex-col justify-between cursor-pointer active:scale-98 group"
                title="Click to view all active recruiters"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-[800] uppercase tracking-[0.2px] text-[#64748b] group-hover:text-[#2563eb] transition truncate">
                    Total
                  </span>
                  <div className="w-5 h-5 rounded-[6px] bg-[#eff6ff] text-[#2563eb] flex items-center justify-center shrink-0">
                    <Building2 size={12} />
                  </div>
                </div>
                <div className="text-[18px] font-[850] text-[#1e293b] mt-1 leading-tight group-hover:text-[#2563eb] transition">
                  {cards.total_active_recruiters}
                </div>
                <div className="text-[9.5px] text-[#64748b] font-medium truncate mt-0.5">
                  In company DB
                </div>
              </div>

              {/* Card 2: Visited Recruiters */}
              <div
                onClick={() => onSelectIndustryCell({ metricKey: 'visited', metricTitle: 'Visited Recruiters', batch: selectedIndustryBatch, value: cards.visited_recruiters })}
                className="p-2.5 bg-white border border-[#e2e8f0] rounded-[10px] shadow-2xs hover:border-[#16a34a] hover:shadow-xs transition flex flex-col justify-between cursor-pointer active:scale-98 group"
                title="Click to view visited recruiters"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-[800] uppercase tracking-[0.2px] text-[#64748b] group-hover:text-[#16a34a] transition truncate">
                    Visited
                  </span>
                  <div className="w-5 h-5 rounded-[6px] bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center shrink-0">
                    <CheckCircle2 size={12} />
                  </div>
                </div>
                <div className="text-[18px] font-[850] text-[#1e293b] mt-1 leading-tight group-hover:text-[#16a34a] transition">
                  {cards.visited_recruiters}
                </div>
                <div className="text-[9.5px] text-[#64748b] font-medium truncate mt-0.5">
                  Drives conducted
                </div>
              </div>

              {/* Card 3: Ongoing recruitments */}
              <div
                onClick={() => onSelectIndustryCell({ metricKey: 'ongoing', metricTitle: 'Ongoing Recruitments', batch: selectedIndustryBatch, value: cards.ongoing_recruitments })}
                className="p-2.5 bg-white border border-[#e2e8f0] rounded-[10px] shadow-2xs hover:border-[#d97706] hover:shadow-xs transition flex flex-col justify-between cursor-pointer active:scale-98 group"
                title="Click to view ongoing recruitments"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-[800] uppercase tracking-[0.2px] text-[#64748b] group-hover:text-[#d97706] transition truncate">
                    Ongoing
                  </span>
                  <div className="w-5 h-5 rounded-[6px] bg-[#fffbeb] text-[#d97706] flex items-center justify-center shrink-0">
                    <Clock size={12} />
                  </div>
                </div>
                <div className="text-[18px] font-[850] text-[#1e293b] mt-1 leading-tight group-hover:text-[#d97706] transition">
                  {cards.ongoing_recruitments}
                </div>
                <div className="text-[9.5px] text-[#64748b] font-medium truncate mt-0.5">
                  Active in drive
                </div>
              </div>

              {/* Card 4: Completed recruitments */}
              <div
                onClick={() => onSelectIndustryCell({ metricKey: 'completed', metricTitle: 'Completed Recruitments', batch: selectedIndustryBatch, value: cards.completed_recruitments })}
                className="p-2.5 bg-white border border-[#e2e8f0] rounded-[10px] shadow-2xs hover:border-[#059669] hover:shadow-xs transition flex flex-col justify-between cursor-pointer active:scale-98 group"
                title="Click to view completed recruitments"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-[800] uppercase tracking-[0.2px] text-[#64748b] group-hover:text-[#059669] transition truncate">
                    Completed
                  </span>
                  <div className="w-5 h-5 rounded-[6px] bg-[#ecfdf5] text-[#059669] flex items-center justify-center shrink-0">
                    <Layers size={12} />
                  </div>
                </div>
                <div className="text-[18px] font-[850] text-[#1e293b] mt-1 leading-tight group-hover:text-[#059669] transition">
                  {cards.completed_recruitments}
                </div>
                <div className="text-[9.5px] text-[#64748b] font-medium truncate mt-0.5">
                  Placements done
                </div>
              </div>

              {/* Card 5: New Recruiters */}
              <div
                onClick={() => onSelectIndustryCell({ metricKey: 'new', metricTitle: 'New Recruiters', batch: selectedIndustryBatch, value: cards.new_recruiters })}
                className="p-2.5 bg-white border border-[#e2e8f0] rounded-[10px] shadow-2xs hover:border-[#9333ea] hover:shadow-xs transition flex flex-col justify-between cursor-pointer active:scale-98 group"
                title="Click to view new recruiters"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-[800] uppercase tracking-[0.2px] text-[#64748b] group-hover:text-[#9333ea] transition truncate">
                    New
                  </span>
                  <div className="w-5 h-5 rounded-[6px] bg-[#faf5ff] text-[#9333ea] flex items-center justify-center shrink-0">
                    <Sparkles size={12} />
                  </div>
                </div>
                <div className="text-[18px] font-[850] text-[#1e293b] mt-1 leading-tight group-hover:text-[#9333ea] transition">
                  {cards.new_recruiters}
                </div>
                <div className="text-[9.5px] text-[#64748b] font-medium truncate mt-0.5">
                  First-time hiring
                </div>
              </div>

              {/* Card 6: Highest Offer */}
              <div
                onClick={() => onSelectIndustryCell({ metricKey: 'highest', metricTitle: 'Highest Offer Recruiter', batch: selectedIndustryBatch, value: cards.highest_offer_lpa })}
                className="p-2.5 bg-white border border-[#e2e8f0] rounded-[10px] shadow-2xs hover:border-[#e11d48] hover:shadow-xs transition flex flex-col justify-between cursor-pointer active:scale-98 group"
                title="Click to view highest offer recruiter"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-[800] uppercase tracking-[0.2px] text-[#64748b] group-hover:text-[#e11d48] transition truncate">
                    Highest
                  </span>
                  <div className="w-5 h-5 rounded-[6px] bg-[#fff1f2] text-[#e11d48] flex items-center justify-center shrink-0">
                    <Award size={12} />
                  </div>
                </div>
                <div className="text-[18px] font-[850] text-[#1e293b] mt-1 leading-tight group-hover:text-[#e11d48] transition">
                  {cards.highest_offer_lpa > 0 ? `₹${cards.highest_offer_lpa}L` : '—'}
                </div>
                <div className="text-[9.5px] text-[#64748b] font-medium truncate mt-0.5">
                  In this batch
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Attention, Top Recruiters, Activity History) */}
            <div className="p-1 rounded-[11px] bg-[#f1f5f9] border border-[#e2e8f0] grid grid-cols-3 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIndustrySectionTab('attention')}
                className={`py-1.5 px-2 rounded-[8px] text-[11px] font-[750] transition cursor-pointer text-center leading-snug flex items-center justify-center gap-1.5 ${
                  industrySectionTab === 'attention'
                    ? 'bg-white text-[#2563eb] shadow-xs'
                    : 'text-[#64748b] hover:text-[#1e293b]'
                }`}
              >
                <span>Attention</span>
                {attention.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    industrySectionTab === 'attention' ? 'bg-[#eff6ff] text-[#2563eb]' : 'bg-[#e2e8f0] text-[#475569]'
                  }`}>
                    {attention.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIndustrySectionTab('topRecruiters')}
                className={`py-1.5 px-2 rounded-[8px] text-[11px] font-[750] transition cursor-pointer text-center leading-snug ${
                  industrySectionTab === 'topRecruiters'
                    ? 'bg-white text-[#2563eb] shadow-xs'
                    : 'text-[#64748b] hover:text-[#1e293b]'
                }`}
              >
                Top Recruiters
              </button>
              <button
                type="button"
                onClick={() => setIndustrySectionTab('activityHistory')}
                className={`py-1.5 px-2 rounded-[8px] text-[11px] font-[750] transition cursor-pointer text-center leading-snug ${
                  industrySectionTab === 'activityHistory'
                    ? 'bg-white text-[#2563eb] shadow-xs'
                    : 'text-[#64748b] hover:text-[#1e293b]'
                }`}
              >
                Activity History
              </button>
            </div>

            {/* TAB CONTENT 1: Recruiters requiring attention */}
            {industrySectionTab === 'attention' && (
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-[#f59e0b]" />
                    <h3 className="text-[13.5px] font-[850] text-[#1e293b] leading-tight m-0">
                      Recruiters Requiring Attention
                    </h3>
                  </div>
                  <p className="text-[11px] text-[#64748b] mt-0.5 font-medium">
                    Participated in previous year but have not started a recruitment drive this academic year.
                  </p>
                </div>

                {attention.length === 0 ? (
                  <div className="p-4 bg-white border border-[#e2e8f0] rounded-[12px] text-center text-[#64748b] text-[12px] font-medium shadow-2xs">
                    <span className="text-[#10b981] font-bold">✓ Good news:</span> All active historical recruiters have drives started for this batch.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attention.map((c) => (
                      <div
                        key={c.company_id}
                        className="p-3 bg-white border border-[#e2e8f0] hover:border-[#cbd5e1] rounded-[10px] shadow-2xs flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-[800] text-[13px] text-[#1e293b]">
                            {c.company_name}
                          </div>
                          <div className="text-[11px] text-[#64748b] mt-0.5 font-medium flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded-[4px] bg-[#f1f5f9] text-[#475569] text-[10px] font-bold">
                              {c.company_domain || c.category}
                            </span>
                            <span>Last year: {c.last_year_placements} placed {c.last_year_package_lpa > 0 ? `(₹${c.last_year_package_lpa} LPA)` : ''}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-[750] px-2 py-1 rounded-[6px] bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3] shrink-0">
                          Not Started
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: Top recruiters */}
            {industrySectionTab === 'topRecruiters' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-[#2563eb]" />
                      <h3 className="text-[13.5px] font-[850] text-[#1e293b] leading-tight m-0">
                        Top Recruiters
                      </h3>
                    </div>
                    <p className="text-[11px] text-[#64748b] mt-0.5 font-medium">
                      Ranked by compensation and placement volume
                    </p>
                  </div>

                  <div className="flex items-center bg-[#f1f5f9] p-0.5 rounded-[7px] border border-[#e2e8f0]">
                    <button
                      type="button"
                      onClick={() => setTopRecruiterTab('salary')}
                      className={`px-2.5 py-1 rounded-[5px] text-[10.5px] font-[750] transition cursor-pointer ${
                        topRecruiterTab === 'salary'
                          ? 'bg-white text-[#2563eb] shadow-2xs'
                          : 'text-[#64748b] hover:text-[#1e293b]'
                      }`}
                    >
                      Salary
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopRecruiterTab('count')}
                      className={`px-2.5 py-1 rounded-[5px] text-[10.5px] font-[750] transition cursor-pointer ${
                        topRecruiterTab === 'count'
                          ? 'bg-white text-[#2563eb] shadow-2xs'
                          : 'text-[#64748b] hover:text-[#1e293b]'
                      }`}
                    >
                      Hires
                    </button>
                  </div>
                </div>

                {/* Top recruiters list */}
                {((topRecruiterTab === 'salary' ? topSalary : topCount).length === 0) ? (
                  <div className="p-4 bg-white border border-[#e2e8f0] rounded-[12px] text-center text-[#94a3b8] text-[12px] font-medium">
                    No recruiter rankings available for this batch yet.
                  </div>
                ) : (
                  <div className="bg-white border border-[#e2e8f0] rounded-[12px] divide-y divide-[#edf2f7] overflow-hidden shadow-2xs">
                    {(topRecruiterTab === 'salary' ? topSalary : topCount).map((r, idx) => (
                      <div
                        key={`${r.company_id}-${idx}`}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-[#f8fafc] transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-[850] shrink-0 ${
                              idx === 0
                                ? 'bg-[#fef3c7] text-[#d97706]'
                                : idx === 1
                                ? 'bg-[#f1f5f9] text-[#64748b]'
                                : idx === 2
                                ? 'bg-[#ffedd5] text-[#c2410c]'
                                : 'text-[#94a3b8]'
                            }`}
                          >
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="font-[800] text-[13px] text-[#1e293b]">
                              {r.company_name}
                            </div>
                            <div className="text-[11px] text-[#64748b] font-medium">
                              {r.job_role || r.company_domain || r.category}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[13px] font-[850] text-[#1e293b]">
                            {topRecruiterTab === 'salary' ? `₹${r.package_lpa} LPA` : `${r.students_count} Hires`}
                          </div>
                          <div className="text-[10.5px] text-[#64748b] font-medium">
                            {topRecruiterTab === 'salary' ? 'Top Package' : 'Students Placed'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: Recent recruitment activity */}
            {industrySectionTab === 'activityHistory' && (
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-[#64748b]" />
                    <h3 className="text-[13.5px] font-[850] text-[#1e293b] leading-tight m-0">
                      Recent Recruitment Activity
                    </h3>
                  </div>
                  <p className="text-[11px] text-[#64748b] mt-0.5 font-medium">
                    Live timeline of drives, rounds & offers for this batch
                  </p>
                </div>

                {activities.length === 0 ? (
                  <div className="p-4 bg-white border border-[#e2e8f0] rounded-[12px] text-center text-[#94a3b8] text-[12px] font-medium">
                    No activity recorded for this batch yet.
                  </div>
                ) : (
                  <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-4 shadow-2xs">
                    <div className="relative pl-5 border-l-2 border-[#e2e8f0] space-y-4">
                      {activities.map((a) => (
                        <div key={a.id} className="relative group">
                          <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-white border-2 border-[#2563eb]" />
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12.5px] font-[800] text-[#1e293b]">
                              {a.company_name}
                            </span>
                            <span className="text-[10px] font-medium text-[#64748b] bg-[#f8fafc] px-2 py-0.5 rounded-full border border-[#e2e8f0]">
                              {a.time_ago}
                            </span>
                          </div>
                          <div className="text-[11.5px] text-[#475569] font-medium mt-0.5">
                            {a.activity_description}
                          </div>
                          {a.job_role && (
                            <div className="text-[10px] text-[#64748b] font-semibold mt-0.5">
                              Role: {a.job_role}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
    )
  }

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
    entrepreneur: 'Entrepreneurship',
    ...SALARY_BAND_LABELS
  }

  const currentOutcomeTitle = outcomeTitleMap[effectiveOutcome] || 'Students'

  const getStatusPillClass = (group) => {
    if (SALARY_BAND_LABELS[group]) {
      return 'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]'
    }
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
              {activeMode === 'students'
                ? (selectedStudentId ? (selectedStudentDetail?.name || 'Student Record') : currentOutcomeTitle)
                : 'Placement Outcome'}
            </h2>
            <p className="text-[12px] text-[#64748b] mt-1 mb-0 leading-relaxed font-medium">
              {selectedStudentId
                ? (selectedStudentDetail
                    ? `${selectedStudentDetail.roll_no ? `${selectedStudentDetail.roll_no} · ` : ''}${selectedStudentDetail.department_code || selectedStudentDetail.department_name || ''} · ${selectedStudentDetail.batch_name || ''}`
                    : 'Loading student record...')
                : (activeMode === 'students'
                    ? `${batchFilterLabel}${deptFilterLabel !== 'All Departments' ? ` · ${deptFilterLabel}` : ''} · Click a student for complete evidence and status.`
                    : `${batchFilterLabel}${deptFilterLabel !== 'All Departments' ? ` · ${deptFilterLabel}` : ''}`)}
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

        {/* Outcome Group Selector Buttons (When in Students Mode and not inspecting a student) */}
        {activeMode === 'students' && !selectedStudentId && (
          isSalaryBand ? (
            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#f1f5f9]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2.5 py-1 rounded-[7px] bg-[#2563eb] text-white text-[12px] font-[850] shadow-2xs shrink-0">
                  {SALARY_BAND_LABELS[effectiveOutcome]}
                </span>
                <span className="text-[12px] font-[750] text-[#1e40af] truncate">
                  {selectedOutcomeType === 'unique' ? 'Highest Confirmed Offer' : 'Offer Volume'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectOutcome('notPlaced', 'unique')}
                className="text-[11.5px] font-[750] text-[#2563eb] hover:text-[#1d4ed8] hover:underline cursor-pointer shrink-0"
              >
                Outcome Groups →
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#f1f5f9]">
              <button
                type="button"
                onClick={() => onSelectOutcome('notPlaced', 'unique')}
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
                onClick={() => onSelectOutcome('notEligible', 'unique')}
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
                onClick={() => onSelectOutcome('higherStudies', 'unique')}
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
                onClick={() => onSelectOutcome('entrepreneur', 'unique')}
                className={`flex-1 py-1.5 px-1 rounded-[7px] text-[11px] font-[800] transition cursor-pointer text-center truncate ${
                  effectiveOutcome === 'entrepreneur'
                    ? 'bg-[#ecfeff] text-[#0e7490] ring-1 ring-[#cffafe] shadow-2xs'
                    : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9]'
                }`}
              >
                Entrepreneurship
              </button>
            </div>
          )
        )}
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 p-[18px_22px] overflow-y-auto space-y-4 custom-dropdown-scroll">
        {activeMode === 'students' ? (
          selectedStudentId ? (
            /* Student Detailed Record View */
            <div className="flex flex-col gap-5">
              {/* Profile Header with Back to Student List */}
              <StudentProfileHeader
                student={selectedStudentDetail}
                onBack={() => setSelectedStudentId(null)}
                backLabel="Back to Student List"
              />

              {loadingStudentDetail && !selectedStudentDetail ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-[#64748b]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
                  <span className="text-[13px] font-semibold">Loading student record...</span>
                </div>
              ) : selectedStudentDetail ? (
                <>
                  {/* Subtle separator */}
                  <div className="w-full h-px bg-[#f1f5f9]" />

                  {/* 1. First 6 cards data: invitations, attended, current process, final misses, offers, not honoured */}
                  <StudentStatCards
                    stats={selectedStudentDetail.stats}
                    variant="intelligence"
                  />

                  {/* 2. Offers received card */}
                  <StudentOffersCard offers={selectedStudentDetail.offers} />

                  {/* 3. Below that academic details card */}
                  <StudentAcademicEligibilityCard student={selectedStudentDetail} />

                  {/* 4. Then placement journey */}
                  <StudentPlacementJourneyTimeline
                    userId={selectedStudentId}
                    title="Placement Journey"
                    limit={5}
                  />
                </>
              ) : (
                <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-[12px] text-center text-[#991b1b] text-[13px]">
                  Failed to load student details.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Top Students Count Card (Reference Style) */}
              <div className="p-4.5 rounded-[13px] border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-[#f5f3ff] shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-[14.5px] font-[850] text-[#172554] leading-tight">
                    Students
                  </div>
                  <div className="text-[11.5px] font-medium text-[#64748b] mt-0.5">
                    {isSalaryBand
                      ? (selectedOutcomeType === 'unique' ? 'Unique students with best offer' : 'Offer recipients in salary band')
                      : 'Institutional count'}
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
                        onClick={() => setSelectedStudentId(s.id)}
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
          )
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
