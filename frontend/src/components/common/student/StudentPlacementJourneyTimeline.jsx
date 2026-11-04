import React, { useState, useEffect, useCallback } from 'react'
import { Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { getStudentRecruitmentHistory } from '../../../services/api'

/**
 * Reusable Placement Journey / Recruitment History Timeline.
 * Shows dot ring, centered vertical line, company, role, stage status, and timestamp.
 */
export default function StudentPlacementJourneyTimeline({
  userId,
  title = 'Placement Journey',
  limit = 5,
  initialData = null
}) {
  const [historyData, setHistoryData] = useState(initialData)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [historyPage, setHistoryPage] = useState(1)

  const fetchHistory = useCallback(
    async (pageToLoad = 1) => {
      if (!userId) return
      try {
        setHistoryLoading(true)
        setHistoryError(null)
        const data = await getStudentRecruitmentHistory(userId, pageToLoad, limit)
        setHistoryData(data)
      } catch (err) {
        console.error('Error fetching recruitment history:', err)
        setHistoryError('Failed to load recruitment history')
      } finally {
        setHistoryLoading(false)
      }
    },
    [userId, limit]
  )

  useEffect(() => {
    setHistoryPage(1)
  }, [userId])

  useEffect(() => {
    fetchHistory(historyPage)
  }, [historyPage, fetchHistory])

  return (
    <div className="bg-white border border-[#dbe5f1] rounded-[16px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#3b82f6]" />
          <h4 className="text-[13.5px] font-bold text-[#1e293b] tracking-tight m-0">
            {title}
          </h4>
        </div>
        {historyData && historyData.total_count > 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
            {historyData.total_count} total
          </span>
        )}
      </div>

      {/* Body */}
      {historyLoading && !historyData ? (
        <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
          <Loader2 className="w-5 h-5 animate-spin text-[#3b82f6] mb-2" />
          <span className="text-[12px]">Loading recruitment history...</span>
        </div>
      ) : historyError ? (
        <div className="p-3 text-[12px] bg-red-50 text-red-600 rounded-lg text-center">
          {historyError}
        </div>
      ) : !historyData?.items || historyData.items.length === 0 ? (
        <div className="py-6 text-center text-[#94a3b8]">
          <p className="text-[12.5px] font-medium text-[#64748b]">No recruitment history found</p>
          <p className="text-[11.5px] text-[#94a3b8] mt-1">
            This student has not participated in any placement drives yet.
          </p>
        </div>
      ) : (
        <div>
          <div className="flex flex-col">
            {historyData.items.map((item, idx) => {
              let dotBg = 'bg-[#CC7C2E]' // In Process (Orange)

              if (item.status === 'Offered') {
                dotBg = 'bg-[#4CA154]' // Offered (Green)
              } else if (item.status === 'Failed / Cancelled') {
                dotBg = 'bg-[#CA3A31]' // Failed / Cancelled (Red)
              }

              const isLast = idx === historyData.items.length - 1

              return (
                <div key={item.drive_id || idx} className="relative flex items-stretch gap-3 group">
                  {/* Timeline column with Dot and centered vertical connecting line */}
                  <div className="flex flex-col items-center flex-shrink-0 w-[20px]">
                    <div className="w-[20px] h-[20px] flex items-center justify-center flex-shrink-0">
                      <div className={`w-[11px] h-[11px] rounded-full ring-[3.5px] ring-[#DEE9FC] ${dotBg}`} />
                    </div>

                    {!isLast && <div className="w-[2px] bg-[#DEE9FC] flex-1 my-1" />}
                  </div>

                  {/* Company & Round details */}
                  <div className={`flex-1 min-w-0 ${!isLast ? 'pb-5' : 'pb-1'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-[14px] font-bold text-[#1e293b] truncate leading-tight m-0">
                        {item.company_name}
                      </h5>
                      {item.job_role && (
                        <span className="text-[10.5px] text-[#94a3b8] font-medium truncate max-w-[120px]">
                          {item.job_role}
                        </span>
                      )}
                    </div>

                    <div className="text-[12.5px] text-[#64748b] font-medium leading-relaxed mt-0.5">
                      {item.round_detail_text}
                    </div>

                    {item.date_formatted && (
                      <div className="text-[10.5px] text-[#94a3b8] mt-0.5">
                        {item.date_formatted}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Controls */}
          {historyData && historyData.total_pages > 1 && (
            <div className="mt-5 pt-3.5 border-t border-[#f1f5f9] flex items-center justify-between">
              <span className="text-[11.5px] text-[#64748b] font-medium">
                Page <span className="font-bold text-[#1e293b]">{historyData.current_page}</span> of{' '}
                <span className="font-bold text-[#1e293b]">{historyData.total_pages}</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={historyData.current_page <= 1 || historyLoading}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 text-[11.5px] font-medium rounded-[7px] border border-[#dbe5f1] text-[#475569] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={historyData.current_page >= historyData.total_pages || historyLoading}
                  onClick={() => setHistoryPage((p) => Math.min(historyData.total_pages, p + 1))}
                  className="px-2.5 py-1 text-[11.5px] font-medium rounded-[7px] border border-[#dbe5f1] text-[#475569] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

