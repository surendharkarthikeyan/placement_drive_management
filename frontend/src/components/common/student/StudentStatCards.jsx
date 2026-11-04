import React from 'react'

/**
 * Reusable 6 KPI Stat Cards Grid.
 * Supports:
 * - variant='intelligence' (INVITATIONS, ATTENDED, CURRENT PROCESS, FINAL MISSES, OFFERS, NOT HONOURED)
 * - variant='review' (Invitations, Attended, Processes, Final Misses, Offers, Recruitment rounds cleared)
 * - custom items array
 */
export default function StudentStatCards({
  stats = {},
  variant = 'intelligence',
  items = null
}) {
  const cardList = items || (variant === 'intelligence'
    ? [
        { label: 'INVITATIONS', value: stats.invitations ?? 0 },
        { label: 'ATTENDED', value: stats.accepted ?? 0 },
        { label: 'CURRENT PROCESS', value: stats.processes ?? 0 },
        { label: 'FINAL MISSES', value: stats.final_misses ?? 0 },
        { label: 'OFFERS', value: stats.offers ?? 0 },
        { label: 'NOT HONOURED', value: 0 }
      ]
    : [
        { label: 'Invitations', value: stats.invitations ?? 0 },
        { label: 'Attended', value: stats.accepted ?? 0 },
        { label: 'Processes', value: stats.processes ?? 0 },
        { label: 'Final Misses', value: stats.final_misses ?? 0 },
        { label: 'Offers', value: stats.offers ?? 0 },
        {
          label: 'Recruitment rounds cleared',
          value: stats.rounds_text || `${stats.rounds_cleared ?? 0} of ${stats.total_rounds ?? 0}`
        }
      ])

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cardList.map((item, idx) => (
        <div
          key={idx}
          className="bg-white border border-[#dbe5f1] rounded-[14px] py-[15px] px-2 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col items-center justify-center hover:border-[#bfdbfe] transition-all"
        >
          <strong className="block text-[22px] font-black text-[#172554] leading-none mb-1.5">
            {item.value}
          </strong>
          <span className="block text-[11px] font-semibold text-[#64748b] leading-tight">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
