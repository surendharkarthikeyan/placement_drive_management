import React, { useState } from 'react'

export default function RightPanel({ onCompleteDrive = () => {} }) {
  const [status, setStatus] = useState('Awaiting Final Result')

  const statusDescriptions = {
    'Draft': 'Drive information is under preparation. Student list and recruitment stages may still be incomplete.',
    'Registration Open': 'Student registration is open. Eligible students may still be included in the drive.',
    'Scheduled': 'The drive is scheduled. Recruitment activity has not yet started.',
    'In Progress': 'One or more recruitment stages are currently active.',
    'Awaiting Next Round Date': 'The previous stage is complete, but the company has not announced the next round date.',
    'Awaiting Final Result': 'All announced rounds have been completed. The final company result is awaited. No additional round is presently scheduled.',
    'Completed': 'The final result has been entered and student placement records have been updated.',
    'On Hold': 'The company has temporarily placed this drive on hold.',
    'Cancelled': 'This placement drive has been cancelled.'
  }

  const checklist = [
    { text: 'Company and job details completed', done: true },
    { text: 'Student eligibility and drive list confirmed', done: true },
    { text: 'Completed round outcomes entered', done: true },
    { text: 'Final result is still awaited from the company', done: false },
    { text: 'Final selected-student list not confirmed', done: false }
  ]

  const activities = [
    {
      title: 'Technical interview results updated',
      meta: '24 students moved to final stage · Today, 10:20 AM'
    },
    {
      title: 'Technical interview completed',
      meta: 'Updated by Mr. Arun · 23 Sep, 4:40 PM'
    },
    {
      title: 'Coding round outcomes imported',
      meta: '58 cleared, 34 not cleared · 21 Sep'
    },
    {
      title: '148 students included',
      meta: 'Eligibility filter applied · 10 Sep'
    }
  ]

  return (
    <aside className="h-full overflow-y-auto p-[17px] bg-white border-l border-[#dbe5f1] text-[#1e293b]">
      {/* 1. Header description */}
      <div className="mb-[16px]">
        <h2 className="text-[17px] font-[850] text-[#172554] m-0">Drive Control</h2>
        <p className="mt-[5px] mb-[14px] text-[12px] text-[#64748b] leading-[1.5]">
          Monitor completion and update the current recruitment status.
        </p>
      </div>

      {/* 2. Status Picker */}
      <div className="mb-[16px]">
        <div className="mb-[8px] text-[#334155] text-[12px] font-[850]">
          Overall Recruitment Status
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full p-[10px] text-[#334155] border border-[#dbe5f1] rounded-[9px] bg-white text-[13px] font-medium focus:border-[#93c5fd] focus:ring-3 focus:ring-[#dbeafe] outline-none cursor-pointer"
        >
          <option>Draft</option>
          <option>Registration Open</option>
          <option>Scheduled</option>
          <option>In Progress</option>
          <option>Awaiting Next Round Date</option>
          <option>Awaiting Final Result</option>
          <option>Completed</option>
          <option>On Hold</option>
          <option>Cancelled</option>
        </select>
      </div>

      {/* 3. Data Completion Progress Card */}
      <div className="mb-[16px]">
        <div className="p-[13px] border border-[#bfdbfe] rounded-[11px] bg-gradient-to-br from-[#eff6ff] to-[#f5f3ff]">
          <div className="flex items-center justify-between">
            <div>
              <div className="m-0 text-[#334155] text-[12px] font-[850]">Data Completion</div>
              <div className="text-[#64748b] text-[10px] mt-[3px]">Required information captured</div>
            </div>
            <div className="text-[26px] font-[850] text-[#172554]">82%</div>
          </div>

          {/* Progress Bar */}
          <div className="h-[7px] mt-[9px] overflow-hidden rounded-[20px] bg-[#dbe5f1]">
            <div className="h-full rounded-[20px] bg-gradient-to-r from-[#2563eb] to-[#60a5fa] w-[82%]" />
          </div>

          {/* Checklist */}
          <div className="mt-[12px]">
            {checklist.map((item, i) => (
              <div key={i} className="mb-[8px] flex items-start gap-[7px] text-[#475569] text-[11px] leading-[1.4]">
                <span
                  className={`w-[17px] h-[17px] shrink-0 grid place-items-center rounded-full text-[10px] font-[850] ${
                    item.done
                      ? 'text-[#15803d] bg-[#dcfce7]'
                      : 'text-[#b45309] bg-[#fef3c7]'
                  }`}
                >
                  {item.done ? '✓' : '!'}
                </span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Present Process Position */}
      <div className="mb-[16px]">
        <div className="mb-[8px] text-[#334155] text-[12px] font-[850]">
          Present Process Position
        </div>
        <div className="p-[11px] rounded-[9px] text-[11px] leading-[1.5] text-[#92400e] border border-[#fed7aa] bg-[#fff7ed]">
          {statusDescriptions[status] || statusDescriptions['Awaiting Final Result']}
        </div>
      </div>

      {/* 5. Recent Drive Activity */}
      <div className="mb-[16px]">
        <div className="mb-[8px] text-[#334155] text-[12px] font-[850]">
          Recent Drive Activity
        </div>
        <div className="flex flex-col">
          {activities.map((act, i) => (
            <div
              key={i}
              className={`relative ml-[7px] pl-[17px] pb-[15px] border-l-2 ${
                i === activities.length - 1 ? 'border-transparent' : 'border-[#dbeafe]'
              }`}
            >
              <span className="absolute top-0 -left-[7px] w-[12px] h-[12px] border-2 border-white rounded-full bg-[#2563eb] shadow-[0_0_0_1px_#93c5fd]" />
              <div className="text-[12px] font-[800] text-[#1e293b] leading-tight">
                {act.title}
              </div>
              <div className="text-[10px] text-[#94a3b8] mt-[3px]">{act.meta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Action Button Stack */}
      <div className="flex flex-col gap-[7px] pt-[10px] border-t border-[#f1f5f9]">
        <button className="w-full py-[9px] px-[13px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[9px] text-[13px] font-[750] transition cursor-pointer">
          Save Current Data
        </button>
        <button className="w-full py-[9px] px-[13px] bg-white hover:bg-[#f8fafc] text-[#475569] border border-[#dbe5f1] rounded-[9px] text-[13px] font-[750] transition cursor-pointer">
          Notify Placement Team
        </button>
        <button className="w-full py-[9px] px-[13px] bg-white hover:bg-[#f8fafc] text-[#475569] border border-[#dbe5f1] rounded-[9px] text-[13px] font-[750] transition cursor-pointer">
          View Full Audit Log
        </button>
        <button
          onClick={onCompleteDrive}
          className="w-full py-[9px] px-[13px] bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-[9px] text-[13px] font-[750] transition cursor-pointer"
        >
          Complete & Update Database
        </button>
      </div>
    </aside>
  )
}
