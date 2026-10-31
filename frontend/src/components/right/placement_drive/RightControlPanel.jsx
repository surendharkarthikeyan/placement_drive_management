import React, { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, Check, AlertCircle } from 'lucide-react'
import { updateDriveStatus, getDriveCompletion, getDriveActivities } from '../../../services/api'

/**
 * RightControlPanel (Right Panel)
 * Monitor completion and update the current recruitment status.
 * Dynamically computes Data Completion using 6 checkpoints with dynamic calculations.
 */
export default function RightControlPanel({
  drive = null,
  refreshKey = 0,
  onStatusUpdated = () => {}
}) {
  const [currentStatus, setCurrentStatus] = useState('draft')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Dynamic Data Completion state
  const [completionData, setCompletionData] = useState(null)
  const [isLoadingCompletion, setIsLoadingCompletion] = useState(false)

  // Recent Drive Activity
  const [activities, setActivities] = useState([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  const [showAllActivities, setShowAllActivities] = useState(false)

  // Status descriptions for Present Process Position
  const statusDescriptions = {
    'draft': 'Drive information is under preparation. Student list and recruitment stages may still be incomplete.',
    'registration_open': 'Student registration is open. Eligible students may still be included in the drive.',
    'scheduled': 'The drive is scheduled. Recruitment activity has not yet started.',
    'in_progress': 'One or more recruitment stages are currently active.',
    'awaiting_next_round': 'The previous stage is complete, but the company has not announced the next round date.',
    'awaiting_final_result': 'All announced rounds have been completed. The final company result is awaited. No additional round is presently scheduled.',
    'completed': 'The final result has been entered and student placement records have been updated.',
    'on_hold': 'The company has temporarily placed this drive on hold.',
    'cancelled': 'This placement drive has been cancelled.'
  }

  // Update current status when drive changes
  useEffect(() => {
    if (drive?.overall_status) {
      setCurrentStatus(drive.overall_status)
    }
  }, [drive?.overall_status])

  // Fetch dynamic completion data and activities whenever drive or refreshKey changes
  useEffect(() => {
    if (!drive?.id) {
      setCompletionData(null)
      setActivities([])
      return
    }

    let isMounted = true

    const loadData = async () => {
      try {
        setIsLoadingCompletion(true)
        const [compData, actData] = await Promise.allSettled([
          getDriveCompletion(drive.id),
          getDriveActivities(drive.id)
        ])

        if (isMounted) {
          if (compData.status === 'fulfilled' && compData.value) {
            setCompletionData(compData.value)
          } else if (drive.data_completion) {
            setCompletionData(drive.data_completion)
          }
          if (actData.status === 'fulfilled' && Array.isArray(actData.value)) {
            setActivities(actData.value)
          }
        }
      } catch (err) {
        console.error('Failed to load drive control data:', err)
      } finally {
        if (isMounted) {
          setIsLoadingCompletion(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [drive?.id, drive?.updated_at, refreshKey])

  const executeStatusUpdate = async (newStatus) => {
    if (!drive?.id) return
    setErrorMsg('')
    try {
      setIsUpdatingStatus(true)
      await updateDriveStatus(drive.id, newStatus)
      setCurrentStatus(newStatus)
      onStatusUpdated(newStatus)
    } catch (err) {
      console.error('Failed to update drive status:', err)
      setErrorMsg(err.response?.data?.error || 'Failed to update status in database.')
    } finally {
      setIsUpdatingStatus(false)
      setShowConfirmModal(false)
      setPendingStatus(null)
    }
  }

  const handleStatusChange = (e) => {
    const newStatus = e.target.value
    if (newStatus === 'completed') {
      setPendingStatus(newStatus)
      setShowConfirmModal(true)
    } else {
      executeStatusUpdate(newStatus)
    }
  }

  const handleConfirmCompletion = () => {
    if (pendingStatus) {
      executeStatusUpdate(pendingStatus)
    }
  }

  const handleCancelCompletion = () => {
    setShowConfirmModal(false)
    setPendingStatus(null)
  }

  // Format activity timestamp
  const formatActivityTime = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const percentage = completionData?.overall_percentage ?? (drive?.data_completion?.overall_percentage ?? 0)
  const checkpoints = completionData?.checkpoints ?? (drive?.data_completion?.checkpoints ?? [])

  return (
    <aside className="w-[360px] xl:w-[400px] h-full overflow-y-auto bg-white border-l border-[#dbe5f1] p-[20px] shrink-0 select-none text-[#1e293b] flex flex-col gap-[20px]">
      {/* 1. Header matching exact template screenshot */}
      <div>
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
          className="w-full h-[46px] px-[14px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[15px] font-[600] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition cursor-pointer shadow-xs disabled:opacity-60"
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

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-[10px] text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 3. Data Completion Card with Dynamic 6 Checkpoints */}
      <div>
        <div className="p-[18px] border border-[#bfdbfe] rounded-[14px] bg-gradient-to-br from-[#eff6ff]/70 to-[#f5f3ff]/70 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="m-0 text-[#1e293b] text-[14.5px] font-[850] leading-tight">
                Data Completion
              </h3>
              <p className="text-[#64748b] text-[11.5px] mt-[4px] mb-0 font-medium">
                Required information captured
              </p>
            </div>
            <div className="text-[30px] font-[900] text-[#172554] tracking-tight flex items-center gap-1.5">
              {isLoadingCompletion && <Loader2 size={18} className="animate-spin text-[#2563eb]" />}
              <span>{percentage}%</span>
            </div>
          </div>

          {/* Dynamic Progress Bar */}
          <div className="h-[8px] mt-[12px] overflow-hidden rounded-full bg-[#dbe5f1]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa] transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            />
          </div>

          {/* 6 Dynamic Checkpoints */}
          <div className="mt-[14px] flex flex-col gap-[9px]">
            {checkpoints.length > 0 ? (
              checkpoints.map((cp) => (
                <div key={cp.index} className="flex items-start gap-2.5 text-[#334155] text-[12px] leading-snug">
                  <span
                    className={`w-[19px] h-[19px] shrink-0 grid place-items-center rounded-full text-[11px] font-[900] mt-0.5 transition-colors ${
                      cp.is_completed
                        ? 'text-[#15803d] bg-[#dcfce7] border border-[#bbf7d0]'
                        : 'text-[#b45309] bg-[#fef3c7] border border-[#fde68a]'
                    }`}
                    title={
                      cp.is_completed
                        ? `Fully completed (${cp.weightage}%)`
                        : `Partially completed / Pending (${cp.earned.toFixed(1)}% of ${cp.weightage}%)`
                    }
                  >
                    {cp.is_completed ? '✓' : '!'}
                  </span>
                  <div className="flex-1 pt-0.5">
                    <span className="font-semibold text-[#1e293b] leading-tight block">
                      {cp.title}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-[12px] text-[#64748b]">
                {isLoadingCompletion ? 'Calculating completion...' : 'No completion data available.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Recent Drive Activity */}
      {activities.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-[10px]">
            <div className="text-[#1e293b] text-[13px] font-[850]">
              Recent Drive Activity
            </div>
            {activities.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllActivities(!showAllActivities)}
                className="text-[11.5px] font-bold text-[#2563eb] hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                {showAllActivities ? 'Show Less' : `View All (${activities.length})`}
              </button>
            )}
          </div>
          <div className="flex flex-col">
            {(showAllActivities ? activities : activities.slice(0, 5)).map((act, i, arr) => (
              <div
                key={act.id || i}
                className={`relative ml-[7px] pl-[18px] pb-[14px] border-l-2 ${
                  i === arr.length - 1 ? 'border-transparent' : 'border-[#dbeafe]'
                }`}
              >
                <span className="absolute top-0 -left-[7px] w-[12px] h-[12px] border-2 border-white rounded-full bg-[#2563eb] shadow-[0_0_0_1px_#93c5fd]" />
                <div className="text-[12.5px] font-[750] text-[#1e293b] leading-tight">
                  {act.activity_description}
                </div>
                <div className="text-[11px] text-[#94a3b8] mt-[3px] font-medium">
                  {act.user?.name ? `${act.user.name} · ` : ''}{formatActivityTime(act.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Marking Drive as Completed */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[500px] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] overflow-hidden p-[28px_32px]">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]">
                <CheckCircle2 size={24} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-[19px] font-bold text-[#172554] m-0 leading-tight">
                  Complete Placement Drive?
                </h3>
                <span className="text-[12.5px] font-medium text-[#64748b]">
                  Recruitment Status Confirmation
                </span>
              </div>
            </div>

            <p className="text-[14.5px] text-[#475569] leading-relaxed mb-6 font-normal">
              Are you sure you want to mark this placement drive as <strong className="text-[#1e293b]">Completed</strong>? This will officially close all stages and confirm the final selection results for this drive.
            </p>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancelCompletion}
                disabled={isUpdatingStatus}
                className="px-5 py-2.5 text-[14px] font-semibold text-[#475569] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-[10px] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCompletion}
                disabled={isUpdatingStatus}
                className="px-6 py-2.5 text-[14px] font-bold text-white bg-[#16a34a] hover:bg-[#15803d] rounded-[10px] shadow-sm transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-70"
              >
                {isUpdatingStatus ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} strokeWidth={2.5} />
                )}
                <span>Confirm & Mark Completed</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
