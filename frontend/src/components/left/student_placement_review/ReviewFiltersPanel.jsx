import React, { useState, useEffect, useRef } from 'react'
import {
  Filter,
  RotateCcw,
  GraduationCap,
  Building2,
  Users,
  Briefcase,
  Layers,
  Award,
  IndianRupee,
  XCircle,
  BarChart3,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Info,
  X
} from 'lucide-react'
import { getBatches, getDepartments } from '../../../services/api'
import CustomSelect from '../../common/CustomSelect'
import MultiSelectDropdown from '../../common/MultiSelectDropdown'
import GlassSegmentedControl from '../../common/GlassSegmentedControl'

/**
 * DualRangeSlider
 * Smooth dual-thumb slider allowing independent drag of both Min and Max limits.
 */
function DualRangeSlider({
  min = 0,
  max = 100,
  step = 1,
  minValue = 0,
  maxValue = 100,
  onChangeMin = () => {},
  onChangeMax = () => {}
}) {
  const minPercent = Math.min(Math.max(((minValue - min) / (max - min)) * 100, 0), 100)
  const maxPercent = Math.min(Math.max(((maxValue - min) / (max - min)) * 100, 0), 100)

  return (
    <div className="relative w-full h-7 flex items-center select-none">
      {/* Background Gray Track */}
      <div className="absolute left-0 right-0 h-1.5 bg-[#dbe5f1] rounded-full" />

      {/* Active Blue Highlight Track between Min and Max */}
      <div
        className="absolute h-1.5 bg-[#2563eb] rounded-full pointer-events-none"
        style={{
          left: `${minPercent}%`,
          right: `${100 - maxPercent}%`
        }}
      />

      {/* Min Range Input */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={minValue}
        onChange={(e) => {
          const val = Math.min(Number(e.target.value), maxValue)
          onChangeMin(val)
        }}
        className={`dual-range-input absolute left-0 w-full h-1.5 appearance-none bg-transparent pointer-events-none ${
          minValue > max - 10 ? 'z-30' : 'z-20'
        }`}
      />

      {/* Max Range Input */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={maxValue}
        onChange={(e) => {
          const val = Math.max(Number(e.target.value), minValue)
          onChangeMax(val)
        }}
        className={`dual-range-input absolute left-0 w-full h-1.5 appearance-none bg-transparent pointer-events-none ${
          minValue > max - 10 ? 'z-20' : 'z-30'
        }`}
      />
    </div>
  )
}

/**
 * ReviewFiltersPanel (Left Panel of Student Placement Review)
 * Matches template pixel-for-pixel from student_placement_review_leftpanel.png:
 * - Header: Funnel icon, "Review Filters", Subtitle, "Reset" button with RotateCcw
 * - Academic Batch: GraduationCap icon, dropdown
 * - Department: Building2 icon, dropdown with counts
 * - Student Category:
 *    - Placement Interested (Briefcase) vs NIP (GraduationCap)
 *    - If Placement Interested: shows "Placement Interested In" (All, Software, Core)
 *    - If NIP: shows "NIP Category" (All, Higher Studies, (Business, Startup))
 *    - Note: For NIP, NO additional filters are shown! Only for Placement Interested people.
 * - Additional Filters (collapsible accordion with ChevronUp/Down):
 *    - Student Journey Status (All, Ongoing, Completed)
 *    - Offer Holders (All, One Offer, Multiple Offers)
 *    - Package Range (LPA): dual/single slider + min/max number inputs with "LPA" suffix
 *    - Final Round Failures (All, 1, 2, More)
 *    - Needs Next Opportunity:
 *        High (#fef2f2 / #ef4444 text), Mid (#fffbeb / #b45309 text)
 *        Low (#f0fdf4 / #16a34a text), Needs Improvement & Interest (#fef2f2 / #dc2626 text)
 *    - Active Recruitment Process (All, Yes, No)
 * - Bottom Action Buttons:
 *    - "Apply Filters ({count})" (Blue primary)
 *    - "Clear" with X (White secondary)
 */
export default function ReviewFiltersPanel({
  onFilterChange = () => { },
  totalFilteredCount = 248
}) {
  // Batch & Department data
  const [batches, setBatches] = useState([])
  const [departments, setDepartments] = useState([])

  // Main Filters state
  const [selectedBatch, setSelectedBatch] = useState('2022-2026')
  const [selectedDepartments, setSelectedDepartments] = useState([]) // Multi-select department IDs
  const [studentCategory, setStudentCategory] = useState('placement_interested') // 'placement_interested' | 'nip'

  // Sub-category filters
  const [placementInterestedIn, setPlacementInterestedIn] = useState('all') // 'all' | 'software' | 'core'
  const [nipCategory, setNipCategory] = useState('all') // 'all' | 'higher_studies' | 'business_startup'

  // Additional Filters (Collapsible)
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(true)

  // Additional Filters state (Only visible for Placement Interested)
  const [journeyStatus, setJourneyStatus] = useState('all') // 'all' | 'ongoing' | 'completed'
  const [offerHolders, setOfferHolders] = useState('all') // 'all' | 'one_offer' | 'multiple_offers'
  const [packageMin, setPackageMin] = useState(0)
  const [packageMax, setPackageMax] = useState(100)
  const [finalFailures, setFinalFailures] = useState('all') // 'all' | '1' | '2' | 'more'
  const [opportunityPriority, setOpportunityPriority] = useState(null) // 'high' | 'mid' | 'low' | 'needs_improvement' | null
  const [activeProcess, setActiveProcess] = useState('all') // 'all' | 'yes' | 'no'

  // Fetch batches & departments on mount
  useEffect(() => {
    getBatches()
      .then((data) => {
        if (data && data.length > 0) {
          setBatches(data)
          // Default to first batch or 2022-2026
          const defaultBatch = data.find((b) => b.name === '2022-2026') || data[0]
          if (defaultBatch) setSelectedBatch(defaultBatch.name)
        }
      })
      .catch((err) => console.error('Error fetching batches:', err))

    getDepartments()
      .then((data) => {
        if (data) setDepartments(data)
      })
      .catch((err) => console.error('Error fetching departments:', err))
  }, [])

  // Reset all filters to default
  const handleReset = () => {
    if (batches.length > 0) {
      const defaultBatch = batches.find((b) => b.name === '2022-2026') || batches[0]
      setSelectedBatch(defaultBatch?.name || '2022-2026')
    } else {
      setSelectedBatch('2022-2026')
    }
    setSelectedDepartments([])
    setStudentCategory('placement_interested')
    setPlacementInterestedIn('all')
    setNipCategory('all')
    setJourneyStatus('all')
    setOfferHolders('all')
    setPackageMin(0)
    setPackageMax(100)
    setFinalFailures('all')
    setOpportunityPriority(null)
    setActiveProcess('all')

    onFilterChange({
      batch: selectedBatch,
      department: 'all',
      studentCategory: 'placement_interested',
      placementInterestedIn: 'all',
      nipCategory: 'all',
      journeyStatus: 'all',
      offerHolders: 'all',
      packageMin: 0,
      packageMax: 100,
      finalFailures: 'all',
      opportunityPriority: null,
      activeProcess: 'all'
    })
  }

  // Clear additional filters
  const handleClear = () => {
    setSelectedDepartments([])
    setPlacementInterestedIn('all')
    setNipCategory('all')
    setJourneyStatus('all')
    setOfferHolders('all')
    setPackageMin(0)
    setPackageMax(100)
    setFinalFailures('all')
    setOpportunityPriority(null)
    setActiveProcess('all')
  }

  // Apply filters callback
  const handleApply = () => {
    onFilterChange({
      batch: selectedBatch,
      department: selectedDepartment,
      studentCategory,
      placementInterestedIn: studentCategory === 'placement_interested' ? placementInterestedIn : 'all',
      nipCategory: studentCategory === 'nip' ? nipCategory : 'all',
      journeyStatus: studentCategory === 'placement_interested' ? journeyStatus : 'all',
      offerHolders: studentCategory === 'placement_interested' ? offerHolders : 'all',
      packageMin: studentCategory === 'placement_interested' ? packageMin : 0,
      packageMax: studentCategory === 'placement_interested' ? packageMax : 100,
      finalFailures: studentCategory === 'placement_interested' ? finalFailures : 'all',
      opportunityPriority: studentCategory === 'placement_interested' ? opportunityPriority : null,
      activeProcess: studentCategory === 'placement_interested' ? activeProcess : 'all'
    })
  }

  return (
    <aside
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
      className="w-[390px] shrink-0 bg-[#fbfdff] border-r border-[#dbe5f1] h-full overflow-y-auto hide-scrollbar [&::-webkit-scrollbar]:hidden flex flex-col justify-between select-none shadow-[2px_0_12px_rgba(15,23,42,0.02)]"
    >
      {/* Scrollable Filters Content */}
      <div className="p-[20px] flex flex-col gap-[20px]">
        {/* 1. Header Row */}
        <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2.5">
            <div className="w-[36px] h-[36px] rounded-[10px] bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center text-[#2563eb] shadow-2xs">
              <Filter size={18} strokeWidth={2.4} />
            </div>
            <div>
              <h2 className="text-[17px] font-[850] text-[#172554] m-0 leading-tight">
                Review Filters
              </h2>
              <p className="text-[12px] text-[#64748b] mt-0.5 mb-0 font-medium leading-tight">
                Filter students to analyse placement progress
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-[750] text-[#2563eb] hover:text-[#1d4ed8] bg-[#eff6ff]/60 hover:bg-[#eff6ff] border border-[#dbeafe] rounded-[8px] transition cursor-pointer active:scale-98"
          >
            <RotateCcw size={13} strokeWidth={2.5} />
            <span>Reset</span>
          </button>
        </div>

        {/* 2. Academic Batch */}
        <div>
          <CustomSelect
            label="Academic Batch"
            options={
              batches.length > 0
                ? batches.map((b) => ({ value: b.name, label: b.name }))
                : [{ value: '2022-2026', label: '2022 - 2026' }]
            }
            value={selectedBatch}
            onChange={(val) => setSelectedBatch(val)}
            placeholder="Select batch..."
          />
        </div>

        {/* 3. Department (Multi-Select with Checkboxes matching Placement Drive design) */}
        <div>
          <MultiSelectDropdown
            label="Department"
            icon={Building2}
            itemNoun="department"
            itemNounPlural="departments"
            options={departments.map((d) => ({
              value: d.id,
              label: d.name
            }))}
            selectedValues={selectedDepartments}
            onChange={(vals) => setSelectedDepartments(vals)}
            placeholder={`All Departments (${departments.length > 0 ? departments.length : 3})`}
          />
        </div>

        {/* 4. Student Category Toggle */}
        <div>
          <div className="flex items-center justify-between mb-[7px]">
            <label className="flex items-center gap-2 text-[15px] font-[750] text-[#334155]">
              <Users size={18} className="text-[#2563eb]" />
              <span>Student Category</span>
            </label>
            <span
              title="Students are grouped by Placement Interested vs NIP (Higher Studies / Business / Startup)"
              className="cursor-help text-[#94a3b8] hover:text-[#64748b]"
            >
              <Info size={16} />
            </span>
          </div>

          {/* Segmented Button: Placement Interested vs NIP */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStudentCategory('placement_interested')}
              className={`h-[44px] px-2 rounded-[10px] text-[13.5px] font-[750] transition flex items-center justify-center gap-2 cursor-pointer border ${studentCategory === 'placement_interested'
                ? 'bg-white text-[#2563eb] border-[#2563eb] shadow-xs ring-1 ring-[#2563eb]/20'
                : 'bg-[#f8fafc] hover:bg-white text-[#64748b] border-[#e2e8f0]'
                }`}
            >
              <Briefcase size={16} />
              <span>Placement Interested</span>
            </button>

            <button
              type="button"
              onClick={() => setStudentCategory('nip')}
              className={`h-[44px] px-2 rounded-[10px] text-[13.5px] font-[750] transition flex items-center justify-center gap-2 cursor-pointer border ${studentCategory === 'nip'
                ? 'bg-white text-[#2563eb] border-[#2563eb] shadow-xs ring-1 ring-[#2563eb]/20'
                : 'bg-[#f8fafc] hover:bg-white text-[#64748b] border-[#e2e8f0]'
                }`}
            >
              <GraduationCap size={17} />
              <span>NIP</span>
            </button>
          </div>
        </div>

        {/* 5A. CASE 1: Placement Interested Sub-Options */}
        {studentCategory === 'placement_interested' && (
          <div className="p-[12px_14px] bg-[#f8fafc] border border-[#dbe5f1] rounded-[14px] shadow-2xs animate-in fade-in duration-150">
            <span className="block text-[11px] font-[800] text-[#64748b] uppercase tracking-[0.4px] mb-2">
              Placement Interested In
            </span>
            <GlassSegmentedControl
              options={[
                { id: 'all', label: 'All' },
                { id: 'software', label: 'Software' },
                { id: 'core', label: 'Core' }
              ]}
              value={placementInterestedIn}
              onChange={setPlacementInterestedIn}
              buttonPy="py-[7px]"
              fontSize="text-[12.5px]"
            />
          </div>
        )}

        {/* 5B. CASE 2: NIP Sub-Options (Higher Studies, Business / Startup) */}
        {studentCategory === 'nip' && (
          <div className="p-[12px_14px] bg-[#f8fafc] border border-[#dbe5f1] rounded-[14px] shadow-2xs animate-in fade-in duration-150">
            <span className="block text-[11px] font-[800] text-[#64748b] uppercase tracking-[0.4px] mb-2">
              NIP Category
            </span>
            <GlassSegmentedControl
              options={[
                { id: 'all', label: 'All' },
                { id: 'higher_studies', label: 'Higher Studies' },
                { id: 'business_startup', label: 'Business / Startup' }
              ]}
              value={nipCategory}
              onChange={setNipCategory}
              buttonPy="py-[6px]"
              fontSize="text-[12px]"
            />
          </div>
        )}

        {/* 6. ADDITIONAL FILTERS (ONLY FOR PLACEMENT INTERESTED PEOPLE) */}
        {studentCategory === 'placement_interested' && (
          <div className="pt-1 flex flex-col gap-[14px]">
            {/* Accordion Toggle Header */}
            <button
              type="button"
              onClick={() => setIsAdditionalOpen(!isAdditionalOpen)}
              className="w-full flex items-center justify-between text-[#2563eb] font-[800] text-[13.5px] hover:text-[#1d4ed8] cursor-pointer pt-1"
            >
              <div className="flex items-center gap-1.5">
                <Filter size={15} />
                <span>Additional Filters</span>
              </div>
              {isAdditionalOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isAdditionalOpen && (
              <div className="flex flex-col gap-[15px] pt-1 animate-in fade-in duration-150">
                {/* Offer Holders */}
                <div>
                  <label className="flex items-center gap-1.5 text-[13px] font-[750] text-[#1e293b] mb-2">
                    <Award size={15} className="text-[#2563eb]" />
                    <span>Offer Holders</span>
                  </label>
                  <GlassSegmentedControl
                    options={[
                      { id: 'all', label: 'All' },
                      { id: 'one_offer', label: 'One Offer' },
                      { id: 'multiple_offers', label: 'Multiple Offers' }
                    ]}
                    value={offerHolders}
                    onChange={setOfferHolders}
                    buttonPy="py-[7.5px]"
                    fontSize="text-[12.5px]"
                  />
                </div>

                {/* 6.3 Package Range (LPA) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-[13px] font-[750] text-[#1e293b]">
                      <IndianRupee size={15} className="text-[#2563eb]" />
                      <span>Package Range (LPA)</span>
                    </label>
                    <span className="text-[12px] font-[700] text-[#64748b]">
                      {packageMin} - {packageMax} LPA ({packageMax >= 100 ? '1 Cr' : `${packageMax}L`})
                    </span>
                  </div>

                  {/* Dual-Thumb Range Slider */}
                  <div className="px-1 py-1">
                    <DualRangeSlider
                      min={0}
                      max={100}
                      step={1}
                      minValue={packageMin}
                      maxValue={packageMax}
                      onChangeMin={setPackageMin}
                      onChangeMax={setPackageMax}
                    />
                    <div className="flex justify-between text-[11px] font-semibold text-[#94a3b8] mt-1">
                      <span>0 LPA</span>
                      <span>100 LPA</span>
                    </div>
                  </div>

                  {/* Range Inputs */}
                  <div className="flex items-center gap-2.5 mt-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={packageMin}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (!isNaN(val)) {
                            setPackageMin(Math.max(0, Math.min(val, packageMax)))
                          }
                        }}
                        className="w-full h-[38px] pl-3 pr-9 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-[13px] font-[700] text-[#1e293b] outline-none shadow-2xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-[750] text-[#94a3b8]">
                        LPA
                      </span>
                    </div>

                    <span className="text-[#94a3b8] font-bold text-[15px]">–</span>

                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={packageMax}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (!isNaN(val)) {
                            setPackageMax(Math.min(100, Math.max(val, packageMin)))
                          }
                        }}
                        className="w-full h-[38px] pl-3 pr-9 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-[13px] font-[700] text-[#1e293b] outline-none shadow-2xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-[750] text-[#94a3b8]">
                        LPA
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6.4 Final Round Failures */}
                <div>
                  <label className="flex items-center gap-1.5 text-[13px] font-[750] text-[#1e293b] mb-2">
                    <XCircle size={15} className="text-[#ef4444]" />
                    <span>Final Round Failures</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'all', label: 'All' },
                      { id: '1', label: '1' },
                      { id: '2', label: '2' },
                      { id: 'more', label: 'More' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFinalFailures(opt.id)}
                        className={`py-[7px] rounded-[8px] text-[12.5px] font-[750] text-center transition cursor-pointer border ${finalFailures === opt.id
                          ? 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe] shadow-2xs font-[800]'
                          : 'bg-white text-[#475569] border-[#cbd5e1] hover:border-[#94a3b8]'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6.5 Needs Next Opportunity */}
                <div>
                  <label className="flex items-center gap-1.5 text-[13px] font-[750] text-[#1e293b] mb-2">
                    <BarChart3 size={15} className="text-[#2563eb]" />
                    <span>Needs Next Opportunity</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOpportunityPriority(opportunityPriority === 'high' ? null : 'high')}
                      className={`py-[7.5px] px-2 rounded-[8px] text-[12.5px] font-[800] text-center transition cursor-pointer border ${opportunityPriority === 'high'
                        ? 'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5] shadow-xs ring-1 ring-[#ef4444]/30'
                        : 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca] hover:bg-[#fee2e2]'
                        }`}
                    >
                      High
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpportunityPriority(opportunityPriority === 'mid' ? null : 'mid')}
                      className={`py-[7.5px] px-2 rounded-[8px] text-[12.5px] font-[800] text-center transition cursor-pointer border ${opportunityPriority === 'mid'
                        ? 'bg-[#fef3c7] text-[#92400e] border-[#fcd34d] shadow-xs ring-1 ring-[#f59e0b]/30'
                        : 'bg-[#fffbeb] text-[#b45309] border-[#fde68a] hover:bg-[#fef3c7]'
                        }`}
                    >
                      Mid
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpportunityPriority(opportunityPriority === 'low' ? null : 'low')}
                      className={`py-[7.5px] px-2 rounded-[8px] text-[12.5px] font-[800] text-center transition cursor-pointer border ${opportunityPriority === 'low'
                        ? 'bg-[#dcfce7] text-[#166534] border-[#86efac] shadow-xs ring-1 ring-[#22c55e]/30'
                        : 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0] hover:bg-[#dcfce7]'
                        }`}
                    >
                      Low
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setOpportunityPriority(opportunityPriority === 'needs_improvement' ? null : 'needs_improvement')
                      }
                      className={`py-[7.5px] px-2 rounded-[8px] text-[11.5px] font-[800] text-center transition cursor-pointer border leading-tight ${opportunityPriority === 'needs_improvement'
                        ? 'bg-[#fee2e2] text-[#991b1b] border-[#f87171] shadow-xs ring-1 ring-[#ef4444]/30'
                        : 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca] hover:bg-[#fee2e2]'
                        }`}
                    >
                      Needs Improvement & Interest
                    </button>
                  </div>
                </div>

                {/* 6.6 Active Recruitment Process */}
                <div>
                  <label className="flex items-center gap-1.5 text-[13px] font-[750] text-[#1e293b] mb-2">
                    <FileCheck2 size={15} className="text-[#2563eb]" />
                    <span>Active Recruitment Process</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'yes', label: 'Yes' },
                      { id: 'no', label: 'No' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setActiveProcess(opt.id)}
                        className={`py-[7px] rounded-[8px] text-[12.5px] font-[750] text-center transition cursor-pointer border ${activeProcess === opt.id
                          ? 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe] shadow-2xs font-[800]'
                          : 'bg-white text-[#475569] border-[#cbd5e1] hover:border-[#94a3b8]'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
