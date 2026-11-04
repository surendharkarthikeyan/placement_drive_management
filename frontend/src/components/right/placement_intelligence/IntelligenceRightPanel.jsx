import React, { useState, useEffect } from 'react'
import { getIntelligenceOverallStats } from '../../../services/api'

/**
 * IntelligenceRightPanel
 *
 * Right Panel (475px) displaying:
 * 1. Placement Outcome Control header
 * 2. Current Batch Placement Outcome card with:
 *    - Total placement interested count
 *    - Placed count
 *    - Placed percentage
 *    - Pipeline specifying the % of placed
 * 3. How to Read the Two Tables guide
 * 4. Placement Outcome Structure breakdown
 */
export default function IntelligenceRightPanel({
  currentView = 'overall',
  selectedBatch = null,
  selectedDepartment = 'All'
}) {
  const [loading, setLoading] = useState(false)
  const [statsData, setStatsData] = useState(null)

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

  // Derive metrics for Placement Outcome based on selected filters
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
    // Specific batch chosen
    totalStudents = targetRow.total || 0
    notEligible = targetRow.not_eligible || 0
    higherStudies = targetRow.higher_studies || 0
    entrepreneurship = targetRow.entrepreneurship || 0
    notPlaced = targetRow.not_placed || 0
    placedCount = targetRow.unique
      ? Object.values(targetRow.unique).reduce((acc, v) => acc + (Number(v) || 0), 0)
      : 0
  } else if (uniqueRows.length > 0) {
    // All batches (or multiple batches for the selected department)
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

  // Calculations
  // Placement interested count = total students excluding higher studies and entrepreneurship
  // (Students with arrears/not-eligible criteria are still placement-seeking students)
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

  return (
    <aside className="w-[475px] min-w-[430px] shrink-0 bg-white border-l border-[#dbe5f1] h-full flex flex-col overflow-hidden">
      {/* 1. Header */}
      <div className="p-[20px_24px_16px] border-b border-[#dbe5f1] shrink-0">
        <h2 className="text-[19px] font-[850] text-[#172554] tracking-tight m-0">
          Placement Outcome Control
        </h2>
        <p className="text-[13px] text-[#64748b] mt-1.5 mb-0 leading-relaxed font-medium">
          Select any numerical outcome in the middle table to identify the exact students contributing to that number.
        </p>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 p-[20px_24px] overflow-y-auto space-y-6 custom-dropdown-scroll">
        {/* Card: Placement Outcome */}
        <div className="p-4.5 rounded-[13px] border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-[#f5f3ff] shadow-2xs flex flex-col gap-3.5">
          {/* Top Label & Score */}
          <div className="flex items-start justify-between gap-4">
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

            <div className="text-[32px] font-[850] text-[#172554] leading-none tracking-tight">
              {placedCount.toLocaleString()}
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

        {/* Section: How to Read the Two Tables */}
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

        {/* Section: Placement Outcome Structure */}
        <div>
          <h3 className="text-[14px] font-[850] text-[#1e293b] mb-2.5 m-0">
            Placement Outcome Structure
          </h3>
          <div className="bg-white border border-[#dbe5f1] rounded-[12px] p-3.5 shadow-2xs divide-y divide-[#f1f5f9]">
            <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
              <span className="text-[#64748b] font-semibold text-[12.5px]">High Compensation</span>
              <span className="text-[#1e293b] font-[800] text-[12.5px] leading-snug">
                Students whose best offer is ₹20 LPA and above.
              </span>
            </div>

            <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
              <span className="text-[#64748b] font-semibold text-[12.5px]">Core Placement</span>
              <span className="text-[#1e293b] font-[800] text-[12.5px] leading-snug">
                Students holding confirmed employment offers.
              </span>
            </div>

            <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
              <span className="text-[#64748b] font-semibold text-[12.5px]">Higher Studies</span>
              <span className="text-[#1e293b] font-[800] text-[12.5px] leading-snug">
                Verified admission or enrolment outcome.
              </span>
            </div>

            <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
              <span className="text-[#64748b] font-semibold text-[12.5px]">Entrepreneurship</span>
              <span className="text-[#1e293b] font-[800] text-[12.5px] leading-snug">
                Verified startup / venture pathway.
              </span>
            </div>

            <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
              <span className="text-[#64748b] font-semibold text-[12.5px]">Not Eligible</span>
              <span className="text-[#1e293b] font-[800] text-[12.5px] leading-snug">
                Students restricted by academic or company criteria.
              </span>
            </div>

            <div className="grid grid-cols-[145px_1fr] gap-3 py-2.5 text-[12.5px] items-center">
              <span className="text-[#64748b] font-semibold text-[12.5px]">Not Placed</span>
              <span className="text-[#1e293b] font-[800] text-[12.5px] leading-snug">
                Placement interested students without a confirmed offer.
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
