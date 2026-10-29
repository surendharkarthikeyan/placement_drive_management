import React, { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { updateDriveStatus } from '../../services/api'

/**
 * RightControlPanel (Right Panel)
 * Minimalistic panel reserved for the right side, holding only the Overall Recruitment Status functionality.
 */
export default function RightControlPanel({
  drive = null,
  onStatusUpdated = () => {}
}) {
  const [currentStatus, setCurrentStatus] = useState('draft')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  useEffect(() => {
    if (drive?.overall_status) {
      setCurrentStatus(drive.overall_status)
    }
  }, [drive?.overall_status])

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value
    setCurrentStatus(newStatus)
    if (!drive?.id) return

    try {
      setIsUpdatingStatus(true)
      await updateDriveStatus(drive.id, newStatus)
      onStatusUpdated(newStatus)
    } catch (err) {
      console.error('Failed to update drive status:', err)
      alert('Failed to update status in database.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  return (
    <aside className="w-[360px] xl:w-[400px] h-full overflow-y-auto bg-white border-l border-[#dbe5f1] p-[20px] shrink-0 select-none text-[#1e293b]">
      {/* 1. Header matching exact template screenshot */}
      <div className="mb-[20px]">
        <h2 className="text-[20px] font-[850] text-[#172554] m-0 leading-tight">
          Drive Control
        </h2>
        <p className="text-[13px] text-[#64748b] mt-[5px] mb-0 leading-normal">
          Monitor completion and update the current recruitment status.
        </p>
      </div>

      {/* 2. Overall Recruitment Status Section */}
      <div>
        <div className="flex items-center justify-between mb-[8px]">
          <label className="text-[14px] font-[850] text-[#1e293b]">
            Overall Recruitment Status
          </label>
          {isUpdatingStatus && <Loader2 size={15} className="animate-spin text-[#2563eb]" />}
        </div>

        <select
          value={currentStatus}
          onChange={handleStatusChange}
          disabled={!drive || isUpdatingStatus}
          className="w-full h-[46px] px-[14px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[15px] font-[600] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition cursor-pointer shadow-xs"
        >
          <option value="draft">Draft</option>
          <option value="registration_open">Registration Open</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="awaiting_next_round">Awaiting Next Round Date</option>
          <option value="awaiting_final_result">Awaiting Final Result</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </aside>
  )
}
