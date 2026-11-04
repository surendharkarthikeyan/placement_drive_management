import React, { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Edit3,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  Sparkles,
  Search,
  Check,
  ChevronRight,
  ChevronDown,
  UserPlus,
  Play,
  Layers,
  Hourglass,
  Users,
  FileText,
  Lock,
  ArrowRight
} from 'lucide-react'
import {
  getDriveStages,
  createDriveStage,
  updateDriveStage,
  createDriveSubstage,
  getStageResults,
  updateStageResults,
  addSpecialEntryToStage,
  completeDriveStage,
  completeDriveSubstage,
  updateSubstageStatus,
  completeRecruitmentProcess
} from '../../../services/api'
import AddStageModal from '../../modals/placement_drive/AddStageModal'
import SpecialEntryModal from '../../modals/placement_drive/SpecialEntryModal'

const getSubstageBadgeStyle = (status) => {
  switch (status) {
    case 'completed':
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70',
        dot: 'bg-emerald-500',
        label: 'Completed'
      }
    case 'in_progress':
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/70',
        dot: 'bg-blue-500 animate-pulse',
        label: 'In Progress'
      }
    case 'scheduled':
      return {
        bg: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100/70',
        dot: 'bg-sky-500',
        label: 'Scheduled'
      }
    case 'awaiting_result':
      return {
        bg: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70',
        dot: 'bg-purple-500',
        label: 'Awaiting Result'
      }
    case 'pending':
    default:
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70',
        dot: 'bg-amber-500',
        label: 'Pending'
      }
  }
}

const OUTCOME_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'not_cleared', label: 'Not Cleared' },
  { value: 'absent', label: 'Absent' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

export default function DriveStagesAndOutcomes({
  driveId,
  officerUserId = 6,
  isDriveCompleted = false,
  overallStatus = 'draft',
  isRosterConfirmed = false,
  onDriveUpdated = () => { },
  onNavigateToRoster = () => { },
  onNavigateToFinalSelection = () => { },
}) {
  const [stages, setStages] = useState([])
  const [isLoadingStages, setIsLoadingStages] = useState(true)
  const [selectedStageId, setSelectedStageId] = useState(null)
  const [selectedSubstageId, setSelectedSubstageId] = useState(null)

  // Results for the currently active stage/substage
  const [results, setResults] = useState([])
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const [selectedResultIds, setSelectedResultIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [isAddStageOpen, setIsAddStageOpen] = useState(false)
  const [isEditStageOpen, setIsEditStageOpen] = useState(false)
  const [isSpecialEntryOpen, setIsSpecialEntryOpen] = useState(false)
  const [isConfirmCompleteOpen, setIsConfirmCompleteOpen] = useState(false)
  const [isConfirmCompleteSubstageOpen, setIsConfirmCompleteSubstageOpen] = useState(false)
  const [isConfirmRecruitmentCompleteOpen, setIsConfirmRecruitmentCompleteOpen] = useState(false)
  const [isCompletingRecruitment, setIsCompletingRecruitment] = useState(false)
  const [substageToComplete, setSubstageToComplete] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  // 1. Fetch Stages
  const fetchStages = async (preserveSelected = true, isSilent = false) => {
    if (!driveId) return
    try {
      if (!isSilent) setIsLoadingStages(true)
      const data = await getDriveStages(driveId)
      setStages(data || [])

      if (data && data.length > 0) {
        if (!preserveSelected || !selectedStageId) {
          setSelectedStageId(data[0].id)
          if (data[0].substages && data[0].substages.length > 0) {
            setSelectedSubstageId(data[0].substages[0].id)
          } else {
            setSelectedSubstageId(null)
          }
        }
      } else {
        setSelectedStageId(null)
        setSelectedSubstageId(null)
      }
    } catch (err) {
      console.error('Failed to load stages:', err)
    } finally {
      if (!isSilent) setIsLoadingStages(false)
    }
  }

  // 2. Fetch Results for selected stage/substage
  const fetchResults = async () => {
    if (!driveId || !selectedStageId) return
    try {
      setIsLoadingResults(true)
      const data = await getStageResults(driveId, selectedStageId, selectedSubstageId)
      setResults(data || [])
      setSelectedResultIds(new Set())
    } catch (err) {
      console.error('Failed to load stage results:', err)
    } finally {
      setIsLoadingResults(false)
    }
  }

  useEffect(() => {
    fetchStages(false)
  }, [driveId])

  useEffect(() => {
    if (selectedStageId) {
      fetchResults()
    }
  }, [selectedStageId, selectedSubstageId])

  const currentStage = useMemo(() => {
    return stages.find((s) => s.id === selectedStageId) || null
  }, [stages, selectedStageId])

  const currentSubstage = useMemo(() => {
    if (!currentStage?.substages) return null
    return currentStage.substages.find((sub) => sub.id === selectedSubstageId) || null
  }, [currentStage, selectedSubstageId])

  // Handle stage selection
  const handleSelectStage = (stage) => {
    setSelectedStageId(stage.id)
    if (stage.substages && stage.substages.length > 0) {
      setSelectedSubstageId(stage.substages[0].id)
    } else {
      setSelectedSubstageId(null)
    }
  }

  // Handle add stage submit
  const handleCreateStage = async (formData) => {
    try {
      setIsSubmitting(true)
      await createDriveStage(driveId, formData)
      setIsAddStageOpen(false)
      await fetchStages(true)
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to create stage:', err)
      alert(err.response?.data?.error || 'Failed to create stage')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle edit stage submit
  const handleUpdateStage = async (formData) => {
    if (!selectedStageId) return
    try {
      setIsSubmitting(true)
      await updateDriveStage(driveId, selectedStageId, formData)
      setIsEditStageOpen(false)
      await fetchStages(true)
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to update stage:', err)
      alert(err.response?.data?.error || 'Failed to update stage')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle add substage
  const handleAddSubstage = async () => {
    const subName = window.prompt('Enter substage name (e.g. Coding Round):')
    if (!subName || !subName.trim()) return
    try {
      setIsSubmitting(true)
      await createDriveSubstage(driveId, selectedStageId, {
        substage_name: subName.trim(),
        status: 'pending',
      })
      await fetchStages(true)
    } catch (err) {
      console.error('Failed to add substage:', err)
      alert(err.response?.data?.error || 'Failed to add substage')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bulk outcome updates
  const handleBulkOutcome = async (outcome) => {
    if (selectedResultIds.size === 0 || !selectedStageId) return
    try {
      const updates = Array.from(selectedResultIds).map((resId) => ({
        result_id: resId,
        outcome: outcome,
      }))
      await updateStageResults(driveId, selectedStageId, updates, officerUserId)
      await fetchResults()
      await fetchStages(true, true)
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to bulk update outcome:', err)
      alert('Failed to update outcomes')
    }
  }

  // Single outcome change
  const handleOutcomeChange = async (resultId, newOutcome) => {
    try {
      await updateStageResults(
        driveId,
        selectedStageId,
        [{ result_id: resultId, outcome: newOutcome }],
        officerUserId
      )
      // Update local state smoothly
      setResults((prev) =>
        prev.map((r) => (r.result_id === resultId ? { ...r, outcome: newOutcome } : r))
      )
      await fetchStages(true, true)
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to update student outcome:', err)
    }
  }

  // Single score change
  const handleScoreBlur = async (resultId, scoreVal) => {
    const num = scoreVal === '' ? null : parseFloat(scoreVal)
    try {
      await updateStageResults(
        driveId,
        selectedStageId,
        [{ result_id: resultId, score: num }],
        officerUserId
      )
    } catch (err) {
      console.error('Failed to update score:', err)
    }
  }

  // Single remarks change
  const handleRemarksBlur = async (resultId, remarksVal) => {
    try {
      await updateStageResults(
        driveId,
        selectedStageId,
        [{ result_id: resultId, remarks: remarksVal }],
        officerUserId
      )
    } catch (err) {
      console.error('Failed to update remarks:', err)
    }
  }

  // Special Entry confirmed
  const handleSpecialEntryConfirm = async (userIds) => {
    try {
      setIsSubmitting(true)
      await addSpecialEntryToStage(
        driveId,
        selectedStageId,
        userIds,
        selectedSubstageId,
        officerUserId
      )
      setIsSpecialEntryOpen(false)
      await fetchResults()
      await fetchStages(true)
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to add special entry:', err)
      alert('Failed to add special entry')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determine next stage
  const nextStage = useMemo(() => {
    if (!currentStage) return null
    return stages.find((s) => s.sequence_no === currentStage.sequence_no + 1) || null
  }, [stages, currentStage])

  // Live counts for active view:
  // The main Stage header card shows the whole participants and total cleared who entered this round, independent of substage selection.
  const stageParticipantsCount = useMemo(() => {
    return currentStage?.participants_count ?? 0
  }, [currentStage])

  const stageClearedCount = useMemo(() => {
    return currentStage?.cleared_count ?? 0
  }, [currentStage])

  // Count how many students in the current stage are marked cleared
  const clearedCountInCurrentStage = useMemo(() => {
    return stageClearedCount
  }, [stageClearedCount])

  // Check if current stage has substages and whether all substages are completed
  const hasSubstages = Boolean(currentStage?.substages && currentStage.substages.length > 0)
  const allSubstagesCompleted = useMemo(() => {
    if (!hasSubstages) return true
    return currentStage.substages.every((sub) => sub.substage_status === 'completed')
  }, [hasSubstages, currentStage])

  // Check if there are newly cleared students that haven't been synced to the next stage yet
  // If nextStage already has at least as many participants as current stage's cleared students, they are synced
  const hasUnsyncedStudents = useMemo(() => {
    if (!currentStage || currentStage.stage_status !== 'completed') return true
    if (!nextStage) return false // No next stage to sync to
    // If current stage has 0 cleared students, nothing to sync
    if (clearedCountInCurrentStage === 0) return false
    // If next stage participants_count is less than cleared count in current stage, we have unsynced students
    const nextParticipants = nextStage.participants_count ?? 0
    return clearedCountInCurrentStage > nextParticipants
  }, [currentStage, nextStage, clearedCountInCurrentStage])

  const isRecruitmentCompleted =
    isDriveCompleted ||
    overallStatus === 'awaiting_final_result' ||
    overallStatus === 'completed'

  // Completed or locked stage status
  const isStageLocked =
    isRecruitmentCompleted ||
    currentStage?.stage_status === 'completed' ||
    isDriveCompleted

  // Open complete confirmation modal
  const handleOpenCompleteModal = () => {
    if (!selectedStageId || isStageLocked) return
    if (hasSubstages && !allSubstagesCompleted) {
      alert('Cannot mark this stage as completed until all of its substages have been completed.')
      return
    }
    setIsConfirmCompleteOpen(true)
  }

  // Direct status change for a substage from dropdown badge
  const handleSubstageStatusChange = async (e, sub, newStatus) => {
    e.stopPropagation()
    try {
      await updateSubstageStatus(driveId, selectedStageId, sub.id, newStatus)
      await fetchStages(true, true)
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to change substage status:', err)
      alert(err.response?.data?.error || 'Failed to change substage status')
    }
  }

  // Mark Substage as completed - open confirmation modal
  const handleOpenCompleteSubstageModal = (e, sub = null) => {
    if (e && e.stopPropagation) e.stopPropagation()
    const targetSub = sub || currentSubstage
    if (!targetSub) return
    setSubstageToComplete(targetSub)
    setIsConfirmCompleteSubstageOpen(true)
  }

  // Confirm substage completion from modal
  const handleConfirmCompleteSubstage = async () => {
    if (!substageToComplete || !selectedStageId) return

    try {
      setIsCompleting(true)
      await completeDriveSubstage(driveId, selectedStageId, substageToComplete.id, officerUserId)
      setIsConfirmCompleteSubstageOpen(false)
      setSubstageToComplete(null)
      await fetchStages(true, true)
      await fetchResults()
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to complete substage:', err)
      alert(err.response?.data?.error || 'Failed to complete substage')
    } finally {
      setIsCompleting(false)
    }
  }

  // Handle Recruitment Process Completion
  const handleConfirmCompleteRecruitment = async () => {
    setIsCompletingRecruitment(true)
    try {
      await completeRecruitmentProcess(driveId, officerUserId)
      setIsConfirmRecruitmentCompleteOpen(false)
      onDriveUpdated()
      // Immediately navigate to the Final Selection tab
      onNavigateToFinalSelection()
    } catch (err) {
      console.error('Failed to complete recruitment process', err)
      alert(err.response?.data?.error || 'Failed to complete recruitment process.')
    } finally {
      setIsCompletingRecruitment(false)
    }
  }

  const handleConfirmCompleteStage = async () => {
    if (!selectedStageId) return
    try {
      setIsCompleting(true)
      await completeDriveStage(driveId, selectedStageId, officerUserId)
      setIsConfirmCompleteOpen(false)
      await fetchStages(true)
      await fetchResults()
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to complete stage:', err)
      alert(err.response?.data?.error || 'Failed to complete stage')
    } finally {
      setIsCompleting(false)
    }
  }

  // Checkbox handling
  const handleToggleCheck = (resultId) => {
    setSelectedResultIds((prev) => {
      const next = new Set(prev)
      if (next.has(resultId)) next.delete(resultId)
      else next.add(resultId)
      return next
    })
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedResultIds(new Set(filteredResults.map((r) => r.result_id)))
    } else {
      setSelectedResultIds(new Set())
    }
  }

  // Filter results by search query
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return results
    const q = searchQuery.toLowerCase().trim()
    return results.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.roll_no && r.roll_no.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q))
    )
  }, [results, searchQuery])

  const isAllChecked =
    filteredResults.length > 0 &&
    filteredResults.every((r) => selectedResultIds.has(r.result_id))

  const getInitials = (name) => {
    if (!name) return 'ST'
    const p = name.trim().split(' ')
    if (p.length === 1) return p[0].substring(0, 2).toUpperCase()
    return (p[0][0] + p[p.length - 1][0]).toUpperCase()
  }

  // Format stage status label
  const formatStatus = (st) => {
    if (!st || st === 'pending' || st === 'pending_date_not_announced') return 'Pending'
    if (st === 'scheduled') return 'Scheduled'
    if (st === 'in_progress') return 'In Progress'
    if (st === 'awaiting_result') return 'Awaiting Result'
    if (st === 'completed') return 'Completed'
    return st
  }

  return (
    <div className="flex flex-col gap-5">
      {isRecruitmentCompleted && (
        <div className="flex items-center gap-2.5 p-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] text-[#475569] text-[13px] font-medium shadow-2xs">
          <Lock size={16} className="text-[#64748b] shrink-0" />
          <span>
            Recruitment process is marked as completed. All stages and student outcomes are finalized and locked.
          </span>
        </div>
      )}

      {/* 2. Recruitment Process Title & Add Stage Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold text-[#172554] m-0 tracking-tight leading-tight">
            Recruitment Process
          </h2>
          <p className="text-[13px] text-[#64748b] mt-0.5 mb-0 font-normal">
            Select a stage to enter student outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isDriveCompleted ? (
            <div className="py-[7.5px] px-[14px] bg-[#ecfdf5] text-[#16a34a] border border-[#bbf7d0] rounded-[9px] text-[13px] font-semibold flex items-center gap-1.5 shadow-2xs select-none">
              <CheckCircle2 size={15} strokeWidth={2.3} />
              <span>Drive Completed</span>
            </div>
          ) : isRecruitmentCompleted ? (
            <div className="py-[7.5px] px-[14px] bg-[#ecfdf5] text-[#16a34a] border border-[#bbf7d0] rounded-[9px] text-[13px] font-semibold flex items-center gap-1.5 shadow-2xs select-none">
              <CheckCircle2 size={15} strokeWidth={2.3} />
              <span>Recruitment Process Completed</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmRecruitmentCompleteOpen(true)}
              className="py-[7.5px] px-[14px] bg-[#16a34a] hover:bg-[#15803d] text-white rounded-[9px] text-[13px] font-semibold shadow-xs hover:shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-98"
              title="Complete all recruitment stages and move cleared candidates to Final Selection"
            >
              <CheckCircle2 size={15} strokeWidth={2.3} />
              <span>Recruitment Process Completion</span>
            </button>
          )}

          {!isRecruitmentCompleted && !isDriveCompleted && (
            <button
              type="button"
              onClick={() => setIsAddStageOpen(true)}
              className="py-[7.5px] px-[15px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[9px] text-[13px] font-semibold shadow-xs hover:shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Add Stage</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Horizontal Interactive Stage Cards Pipeline */}
      <div className="relative py-2">
        <div className="flex items-center gap-0 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin">
          {isLoadingStages ? (
            <div className="w-full py-8 text-center text-[#64748b] flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin text-[#2563eb]" />
              <span className="text-[13px]">Loading recruitment stages...</span>
            </div>
          ) : stages.length === 0 ? (
            <div className="w-full py-8 p-6 bg-white border border-[#dbe5f1] rounded-[14px] text-center text-[#64748b] shadow-2xs">
              <p className="text-[14px] font-semibold text-[#1e293b] m-0">No recruitment stages configured yet.</p>
              <p className="text-[12.5px] text-[#64748b] mt-1 mb-3">
                Configure recruitment stages like Online Assessment, Technical Interview, etc.
              </p>
              <button
                type="button"
                onClick={() => setIsAddStageOpen(true)}
                className="py-2 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[8px] text-[13px] font-semibold shadow-xs transition cursor-pointer"
              >
                Add First Stage
              </button>
            </div>
          ) : (
            stages.map((stage, idx) => {
              const isSelected = stage.id === selectedStageId
              const isCompleted = stage.stage_status === 'completed'
              const isInProgress = stage.stage_status === 'in_progress'
              const isAwaiting = stage.stage_status === 'awaiting_result'

              // Date / timestamp string formatted cleanly (e.g., "31 Oct" or "31 Oct 2026")
              const dateStr = stage.scheduled_date
                ? new Date(stage.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                : ''

              // Subtitle summary text matching the exact requested mockup
              let subtitle = ''
              if (isCompleted) {
                subtitle = dateStr ? `Completed · ${dateStr}` : 'Completed'
              } else if (isAwaiting) {
                subtitle = dateStr ? `Awaiting Result · ${dateStr}` : 'Awaiting Result'
              } else if (isInProgress) {
                subtitle = dateStr ? `In Progress · ${dateStr}` : 'In Progress'
              } else {
                subtitle = dateStr ? `Pending · ${dateStr}` : 'Pending'
              }

              return (
                <React.Fragment key={stage.id}>
                  {/* Clean straight connecting line */}
                  {idx > 0 && (
                    <div className="flex items-center shrink-0 w-[24px]">
                      <div className="w-full h-[2px] bg-[#dbe5f1]" />
                    </div>
                  )}

                  {/* Clean Minimal Stage Card exactly matching reference */}
                  <div
                    onClick={() => handleSelectStage(stage)}
                    className={`group relative min-w-[170px] max-w-[195px] shrink-0 p-[12px_14px] rounded-[12px] transition-all duration-150 cursor-pointer select-none text-left flex flex-col justify-between bg-white border ${isSelected
                      ? 'border-[#2563eb] shadow-[0_2px_8px_rgba(37,99,235,0.12)] ring-1 ring-[#2563eb]'
                      : 'border-[#dbe5f1] hover:border-[#cbd5e1]'
                      }`}
                  >
                    <div>
                      {/* Top Row: Simple Circular Stage Number Badge */}
                      <div className="mb-2">
                        <div
                          className={`w-[24px] h-[24px] rounded-full flex items-center justify-center text-[11px] font-bold ${isSelected
                            ? 'bg-[#2563eb] text-white'
                            : 'bg-[#e2e8f0] text-[#64748b]'
                            }`}
                        >
                          {stage.sequence_no}
                        </div>
                      </div>

                      {/* Stage Name */}
                      <h4 className="text-[13px] font-bold text-[#1e293b] capitalize leading-snug tracking-tight m-0 mb-1">
                        {stage.stage_name}
                      </h4>

                      {/* Status / Subtitle info */}
                      <p className="text-[11.5px] text-[#64748b] m-0 font-normal leading-tight">
                        {subtitle}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              )
            })
          )}

          {/* "+ Add Stage" Dashed Interactive Card */}
          {stages.length > 0 && !isRecruitmentCompleted && !isDriveCompleted && (
            <>
              <div className="flex items-center shrink-0 w-[20px]">
                <div className="w-full h-[1.5px] bg-[#dbe5f1]" />
              </div>
              <button
                type="button"
                onClick={() => setIsAddStageOpen(true)}
                className="group min-w-[120px] shrink-0 p-[12px_14px] rounded-[12px] border border-dashed border-[#cbd5e1] hover:border-[#2563eb] bg-transparent hover:bg-[#eff6ff]/30 transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 text-[#2563eb] self-stretch"
              >
                <Plus size={15} strokeWidth={2.4} />
                <span className="text-[12px] font-semibold">Add Stage</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4. Selected Stage Workspace */}
      {currentStage && (
        <div className="bg-white border border-[#dbe5f1] rounded-[16px] p-5 shadow-2xs space-y-4">
          {/* Header row: Stage title, status, metadata items & action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#f1f5f9]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[18px] font-bold text-[#0f172a] m-0 capitalize tracking-tight">
                  {currentStage.stage_name}
                </h3>
                <span
                  className={`text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full border ${currentStage.stage_status === 'completed'
                    ? 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]'
                    : currentStage.stage_status === 'in_progress'
                      ? 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]'
                      : currentStage.stage_status === 'scheduled'
                        ? 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
                        : currentStage.stage_status === 'awaiting_result'
                          ? 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
                          : 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]'
                    }`}
                >
                  Stage {currentStage.sequence_no} • {formatStatus(currentStage.stage_status)}
                </span>
              </div>

              {/* Informative Stage Metadata Row: Scheduled Date, Participants, Cleared, Internal Notes */}
              <div className="flex flex-wrap items-center gap-6 mt-3.5 pt-1 text-[13px]">
                {/* Scheduled Date */}
                <div className="flex items-center gap-2.5 text-[#475569]">
                  <div className="w-8 h-8 rounded-[9px] bg-[#eff6ff] text-[#2563eb] flex items-center justify-center shrink-0 border border-[#dbeafe]">
                    <Calendar size={15} />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#94a3b8] font-medium leading-none mb-1">Scheduled Date</div>
                    <div className="font-semibold text-[#1e293b] leading-tight text-[13px]">
                      {currentStage.scheduled_date
                        ? new Date(currentStage.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Not Announced'}
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div className="flex items-center gap-2.5 text-[#475569]">
                  <div className="w-8 h-8 rounded-[9px] bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0] flex items-center justify-center shrink-0">
                    <Users size={15} />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#94a3b8] font-medium leading-none mb-1">Participants</div>
                    <div className="font-semibold text-[#1e293b] leading-tight text-[13px]">
                      {stageParticipantsCount} students
                    </div>
                  </div>
                </div>

                {/* Cleared */}
                <div className="flex items-center gap-2.5 text-[#475569]">
                  <div className="w-8 h-8 rounded-[9px] bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0] flex items-center justify-center shrink-0">
                    <CheckCircle2 size={15} />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#94a3b8] font-medium leading-none mb-1">Cleared</div>
                    <div className="font-semibold text-[#1e293b] leading-tight text-[13px]">
                      {stageClearedCount} students
                    </div>
                  </div>
                </div>

                {/* Internal Notes */}
                {currentStage.internal_notes && (
                  <div className="flex items-center gap-2.5 text-[#475569]">
                    <div className="w-8 h-8 rounded-[9px] bg-[#faf5ff] text-[#9333ea] border border-[#f3e8ff] flex items-center justify-center shrink-0">
                      <FileText size={15} />
                    </div>
                    <div>
                      <div className="text-[11px] text-[#94a3b8] font-medium leading-none mb-1">Internal Notes</div>
                      <div className="font-semibold text-[#1e293b] leading-tight text-[13px] truncate max-w-[320px]" title={currentStage.internal_notes}>
                        {currentStage.internal_notes}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start pt-0.5">
              {!isStageLocked && (
                <button
                  type="button"
                  onClick={() => setIsEditStageOpen(true)}
                  className="py-[7.5px] px-[14px] bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] rounded-[9px] text-[13px] font-medium transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Edit3 size={14} />
                  <span>Edit Stage</span>
                </button>
              )}

              {currentStage.stage_status !== 'completed' ? (
                <button
                  type="button"
                  onClick={handleOpenCompleteModal}
                  disabled={isCompleting || (hasSubstages && !allSubstagesCompleted)}
                  className={`py-[7.5px] px-[16px] rounded-[9px] text-[13px] font-semibold shadow-xs transition flex items-center gap-1.5 active:scale-98 ${hasSubstages && !allSubstagesCompleted
                    ? 'bg-[#f1f5f9] text-[#94a3b8] border border-[#e2e8f0] cursor-not-allowed opacity-75'
                    : 'bg-[#16a34a] hover:bg-[#15803d] text-white cursor-pointer shadow-xs'
                    }`}
                  title={
                    hasSubstages && !allSubstagesCompleted
                      ? 'Complete all substages before marking this stage as completed'
                      : 'Mark stage as completed and finalize student outcomes'
                  }
                >
                  {isCompleting ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} strokeWidth={2.4} />}
                  <span>Mark as Completed</span>
                </button>
              ) : (
                <div className="py-[7.5px] px-[16px] rounded-[9px] text-[13px] font-semibold bg-[#ecfdf5] text-[#16a34a] border border-[#bbf7d0] flex items-center gap-1.5 shadow-2xs select-none">
                  <CheckCircle2 size={15} strokeWidth={2.4} />
                  <span>Stage Completed</span>
                </div>
              )}
            </div>
          </div>

          {/* Substage Cards matching reference image */}
          {currentStage.substages && currentStage.substages.length > 0 && (
            <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-[14px] space-y-3.5 my-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[14px] font-bold text-[#0f172a] m-0">
                    Substages ({currentStage.substages.length})
                  </h4>
                  <p className="text-[12.5px] text-[#64748b] m-0 mt-0.5">
                    Manage outcomes for each substage
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {currentSubstage && (
                    currentSubstage.substage_status === 'completed' ? (
                      <div
                        className="py-1.5 px-3 bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0] rounded-[8px] text-[12.5px] font-semibold flex items-center gap-1.5 shadow-2xs select-none"
                        title={`"${currentSubstage.substage_name}" has been marked as completed`}
                      >
                        <CheckCircle2 size={14} strokeWidth={2.4} className="text-[#16a34a]" />
                        <span>Marked as Completed</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleOpenCompleteSubstageModal(e, currentSubstage)}
                        disabled={isCompleting}
                        className="py-1.5 px-3 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-[8px] text-[12.5px] font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-98 disabled:opacity-70"
                        title={`Mark "${currentSubstage.substage_name}" as completed`}
                      >
                        {isCompleting ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} strokeWidth={2.4} />}
                        <span>Mark Substage as Completed</span>
                      </button>
                    )
                  )}
                  {!isStageLocked && (
                    <button
                      type="button"
                      onClick={() => setIsEditStageOpen(true)}
                      className="py-1.5 px-3 bg-white hover:bg-[#f1f5f9] text-[#2563eb] border border-[#bfdbfe] rounded-[8px] text-[12.5px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Plus size={14} />
                      <span>Add Substage</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Substage horizontal cards */}
              <div className="flex flex-wrap items-center gap-3">
                {currentStage.substages.map((sub) => {
                  const isSubSelected = sub.id === selectedSubstageId
                  const isSubCompleted = sub.substage_status === 'completed'
                  const isSubInProgress = sub.substage_status === 'in_progress'

                  return (
                    <div
                      key={sub.id}
                      onClick={() => setSelectedSubstageId(sub.id)}
                      className={`py-3 px-4 rounded-[12px] border transition-all cursor-pointer inline-flex items-center gap-3.5 ${isSubSelected
                        ? 'bg-white border-[#2563eb] shadow-sm ring-2 ring-[#2563eb]/20'
                        : 'bg-white border-[#e2e8f0] hover:border-[#cbd5e1]'
                        }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${isSubSelected
                          ? 'bg-[#2563eb] text-white'
                          : 'bg-[#f1f5f9] text-[#64748b]'
                          }`}
                      >
                        {sub.sequence_no}
                      </div>

                      <div className="flex flex-col justify-center gap-1.5">
                        {/* Top line: Substage Name placed with a balanced, clear space next to Status Badge */}
                        <div className="flex items-center gap-8">
                          <span className="text-[13.5px] font-bold text-[#0f172a] leading-tight whitespace-nowrap">
                            {sub.substage_name}
                          </span>

                          {(() => {
                            const badgeStyle = getSubstageBadgeStyle(sub.substage_status)
                            return (
                              <div className="relative inline-flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                                <div
                                  className={`inline-flex items-center gap-1.5 pl-2.5 pr-4 py-0.5 rounded-full text-[11px] font-semibold tracking-tight border shadow-2xs transition-colors cursor-pointer ${badgeStyle.bg}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot} shrink-0`} />
                                  <span>{badgeStyle.label}</span>
                                  <ChevronDown size={11} className="absolute right-1.5 opacity-60 pointer-events-none" />
                                </div>
                                <select
                                  value={sub.substage_status || 'pending'}
                                  onChange={(e) => handleSubstageStatusChange(e, sub, e.target.value)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-[11px]"
                                  title="Click to change substage status"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="scheduled">Scheduled</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="awaiting_result">Awaiting Result</option>
                                  <option value="completed">Completed</option>
                                </select>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Bottom line: participants & cleared counts */}
                        <div className="flex items-center gap-2 text-[12px] text-[#64748b] font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Users size={12.5} className="text-[#64748b] shrink-0" />
                            <span>{sub.participants_count > 0 ? `${sub.participants_count} Participants` : '- Participants'}</span>
                          </span>
                          <span className="text-[#cbd5e1]">•</span>
                          <span className="inline-flex items-center gap-1 text-[#16a34a]">
                            <CheckCircle2 size={12.5} className="text-[#16a34a] shrink-0" />
                            <span>{sub.cleared_count > 0 ? `${sub.cleared_count} Cleared` : '- Cleared'}</span>
                          </span>

                          {sub.scheduled_date && (
                            <>
                              <span className="text-[#cbd5e1]">•</span>
                              <span className="text-[11px] text-[#94a3b8] font-medium">
                                {new Date(sub.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Lock notice when stage is completed */}
          {isStageLocked && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] text-[13px] text-[#475569] font-medium shadow-2xs">
              <Lock size={15} className="text-[#64748b] shrink-0" />
              <span>
                This stage is marked as completed. All student outcomes and scores are finalized and locked.
              </span>
            </div>
          )}

          {/* Controls Bar: Search Box, Bulk Actions, Special Entry */}
          <div className="flex flex-wrap items-center justify-between gap-3.5 pt-3 border-t border-[#f1f5f9]">
            {/* Expanded Search Bar */}
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative w-full max-w-[480px]">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student by name, roll no, department..."
                  className="w-full pl-10 pr-4 py-[8.5px] bg-[#f8fafc] focus:bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[13.5px] text-[#1e293b] outline-none transition focus:ring-3 focus:ring-[#2563eb]/15 shadow-2xs placeholder:text-[#94a3b8]"
                />
              </div>
            </div>

            {/* Action buttons: Mark Cleared, Mark Not Cleared, Mark Pending + Special Entry */}
            {!isStageLocked && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleBulkOutcome('cleared')}
                  disabled={selectedResultIds.size === 0}
                  className="py-[7.5px] px-[14px] bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#16a34a] border border-[#bbf7d0] rounded-[9px] text-[13px] font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Mark Cleared
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkOutcome('not_cleared')}
                  disabled={selectedResultIds.size === 0}
                  className="py-[7.5px] px-[14px] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] border border-[#fecaca] rounded-[9px] text-[13px] font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Mark Not Cleared
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkOutcome('pending')}
                  disabled={selectedResultIds.size === 0}
                  className="py-[7.5px] px-[14px] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1] rounded-[9px] text-[13px] font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Mark Pending
                </button>

                <button
                  type="button"
                  onClick={() => setIsSpecialEntryOpen(true)}
                  className="py-[7.5px] px-[16px] bg-[#fffbeb] hover:bg-[#fef3c7] text-[#b45309] border border-[#fde68a] rounded-[9px] text-[13px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ml-1"
                >
                  <Sparkles size={15} className="text-[#d97706]" />
                  <span>Special Entry</span>
                </button>
              </div>
            )}
          </div>

          {/* Student Results Table */}
          <div className="border border-[#e2e8f0] rounded-[12px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <tr className="text-[11.5px] font-[800] text-[#64748b] uppercase tracking-[0.4px]">
                    <th className="py-3 px-3.5 w-[38px]">
                      <input
                        type="checkbox"
                        disabled={isStageLocked}
                        checked={isAllChecked}
                        onChange={handleSelectAll}
                        className={`w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 ${
                          isStageLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      />
                    </th>
                    <th className="py-3 px-3.5">STUDENT</th>
                    <th className="py-3 px-3.5">PREVIOUS STAGE</th>
                    <th className="py-3 px-3.5">OUTCOME</th>
                    <th className="py-3 px-3.5">SCORE / REMARK</th>
                    <th className="py-3 px-3.5">UPDATED BY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2f7]">
                  {isLoadingResults && results.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#64748b]">
                        <Loader2 size={24} className="animate-spin mx-auto text-[#2563eb]" />
                        <span className="block mt-2 text-[13px]">Loading stage results...</span>
                      </td>
                    </tr>
                  ) : filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#64748b] text-[13.5px]">
                        {isLoadingResults ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Loader2 size={24} className="animate-spin text-[#2563eb]" />
                            <span>Loading stage results...</span>
                          </div>
                        ) : currentStage?.sequence_no === 1 && !isRosterConfirmed ? (
                          <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto py-3">
                            <div className="w-10 h-10 rounded-full bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center text-[#64748b]">
                              <Users size={20} />
                            </div>
                            <div className="font-[750] text-[#1e293b] text-[15px]">
                              No students in Stage 1 yet
                            </div>
                            <p className="text-[13px] text-[#64748b] m-0">
                              Please confirm the student list in <span className="font-semibold text-[#0f172a]">"2. Student List"</span> tab to move included and special entry candidates into Stage 1.
                            </p>
                            {!isDriveCompleted && (
                              <button
                                type="button"
                                onClick={onNavigateToRoster}
                                className="mt-1 px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[8px] text-[13px] font-[750] transition cursor-pointer flex items-center gap-1.5"
                              >
                                <span>Go to Student List</span>
                                <ArrowRight size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          'No participating students found for this stage.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((r) => {
                      const isChecked = selectedResultIds.has(r.result_id)
                      const avatarInitials = getInitials(r.name)

                      return (
                        <tr
                          key={r.result_id}
                          className={`hover:bg-[#fbfdff] transition ${isChecked ? 'bg-[#eff6ff]/35' : ''
                            }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-3.5">
                            <input
                              type="checkbox"
                              disabled={isStageLocked}
                              checked={isChecked}
                              onChange={() => !isStageLocked && handleToggleCheck(r.result_id)}
                              className={`w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 ${
                                isStageLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                              }`}
                            />
                          </td>

                          {/* Student */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-[32px] h-[32px] rounded-[8px] bg-[#dbeafe] text-[#2563eb] font-[850] text-[11.5px] flex items-center justify-center shrink-0">
                                {avatarInitials}
                              </div>
                              <div>
                                <div className="text-[13.5px] font-[800] text-[#1e293b] leading-tight">
                                  {r.name}
                                </div>
                                <div className="text-[11.5px] text-[#94a3b8] font-medium leading-tight mt-0.5">
                                  {r.roll_no ? `${r.roll_no} • ` : ''}
                                  {r.department_name || ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Previous Stage */}
                          <td className="py-3 px-3.5">
                            {r.previous_stage_status === 'spl_entry' ? (
                              <span className="inline-flex items-center gap-1 py-[3px] px-[9px] rounded-full text-[11.5px] font-[800] text-[#b45309] bg-[#fefce8] border border-[#fde68a]">
                                <Sparkles size={11} className="text-[#d97706]" />
                                Spl Entry
                              </span>
                            ) : (
                              <span className="inline-block py-[3px] px-[9px] rounded-full text-[11.5px] font-[750] text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0]">
                                Cleared
                              </span>
                            )}
                          </td>

                          {/* Outcome dropdown */}
                          <td className="py-3 px-3.5">
                            {isStageLocked ? (
                              <span
                                className={`inline-block py-1 px-3 rounded-[8px] text-[12px] font-[750] border select-none ${
                                  r.outcome === 'cleared'
                                    ? 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]'
                                    : r.outcome === 'not_cleared'
                                      ? 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
                                      : r.outcome === 'absent' || r.outcome === 'withdrawn'
                                        ? 'bg-[#f8fafc] text-[#64748b] border-[#cbd5e1]'
                                        : 'bg-[#fefce8] text-[#ca8a04] border-[#fef08a]'
                                }`}
                              >
                                {r.outcome === 'cleared'
                                  ? 'Cleared'
                                  : r.outcome === 'not_cleared'
                                    ? 'Not Cleared'
                                    : r.outcome === 'absent'
                                      ? 'Absent'
                                      : r.outcome === 'withdrawn'
                                        ? 'Withdrawn'
                                        : 'Pending'}
                              </span>
                            ) : (
                              <select
                                value={r.outcome}
                                onChange={(e) => handleOutcomeChange(r.result_id, e.target.value)}
                                className={`h-[34px] px-2.5 rounded-[8px] text-[12.5px] font-[750] border outline-none cursor-pointer ${
                                  r.outcome === 'cleared'
                                    ? 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]'
                                    : r.outcome === 'not_cleared'
                                      ? 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
                                      : r.outcome === 'absent' || r.outcome === 'withdrawn'
                                        ? 'bg-[#f8fafc] text-[#64748b] border-[#cbd5e1]'
                                        : 'bg-[#fefce8] text-[#ca8a04] border-[#fef08a]'
                                }`}
                              >
                                {OUTCOME_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          {/* Score / Remark */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="1"
                                placeholder="Score"
                                disabled={isStageLocked}
                                defaultValue={r.score !== null ? r.score : ''}
                                onBlur={(e) => !isStageLocked && handleScoreBlur(r.result_id, e.target.value)}
                                className={`w-[70px] h-[32px] px-2 border rounded-[7px] text-[12.5px] font-[600] outline-none transition ${
                                  isStageLocked
                                    ? 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] cursor-not-allowed shadow-inner'
                                    : 'bg-white border-[#cbd5e1] focus:border-[#2563eb] text-[#1e293b]'
                                }`}
                              />
                              <input
                                type="text"
                                placeholder="Remarks..."
                                disabled={isStageLocked}
                                defaultValue={r.remarks || ''}
                                onBlur={(e) => !isStageLocked && handleRemarksBlur(r.result_id, e.target.value)}
                                className={`flex-1 min-w-[140px] h-[32px] px-2.5 border rounded-[7px] text-[12.5px] outline-none transition ${
                                  isStageLocked
                                    ? 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] cursor-not-allowed shadow-inner'
                                    : 'bg-white border-[#cbd5e1] focus:border-[#2563eb] text-[#1e293b]'
                                }`}
                              />
                            </div>
                          </td>

                          {/* Updated By */}
                          <td className="py-3 px-3.5">
                            <div className="text-[12.5px] font-[750] text-[#1e293b]">
                              Placement Team
                            </div>
                            <div className="text-[11.5px] text-[#64748b] font-medium mt-0.5">
                              {r.updated_at || 'Today'}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Stage Modal */}
      <AddStageModal
        isOpen={isAddStageOpen}
        onClose={() => setIsAddStageOpen(false)}
        onSubmit={handleCreateStage}
        isSubmitting={isSubmitting}
      />

      {/* Edit Stage Modal */}
      <AddStageModal
        isOpen={isEditStageOpen}
        onClose={() => setIsEditStageOpen(false)}
        onSubmit={handleUpdateStage}
        isSubmitting={isSubmitting}
        initialData={currentStage}
      />

      {/* Special Entry Modal */}
      <SpecialEntryModal
        isOpen={isSpecialEntryOpen}
        onClose={() => setIsSpecialEntryOpen(false)}
        driveId={driveId}
        stageName={currentStage?.stage_name || ''}
        existingUserIds={new Set(results.map((r) => r.user_id))}
        onConfirm={handleSpecialEntryConfirm}
        isSubmitting={isSubmitting}
      />

      {/* Confirmation Modal for Stage Completion */}
      {isConfirmCompleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[580px] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] overflow-hidden p-[28px_32px]">
            <div className="flex items-center gap-3.5 mb-4">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border ${currentStage?.stage_status === 'completed'
                ? 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]'
                : 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]'
                }`}>
                {currentStage?.stage_status === 'completed' ? (
                  <CheckCircle2 size={22} strokeWidth={2.4} />
                ) : (
                  <Check size={22} strokeWidth={3} />
                )}
              </div>
              <div>
                <h3 className="text-[19px] font-bold text-[#172554] m-0 leading-tight">
                  {currentStage?.stage_status === 'completed'
                    ? (!nextStage ? 'Sync Cleared to Final Selection' : 'Update & Sync Next Stage')
                    : (!nextStage ? `Complete Final Stage: ${currentStage?.stage_name}` : `Complete Stage: ${currentStage?.stage_name}`)}
                </h3>
                <span className="text-[12.5px] font-medium text-[#64748b]">
                  Recruitment Progression
                </span>
              </div>
            </div>

            <p className="text-[14.5px] text-[#475569] leading-relaxed mb-7 font-normal">
              {currentStage?.stage_status === 'completed' ? (
                !nextStage ? (
                  <>
                    Sync newly <span className="font-bold text-[#16a34a]">Cleared</span> students in <strong className="text-[#1e293b]">"{currentStage?.stage_name}"</strong> to the <strong>4. Final Selection</strong> tab?
                  </>
                ) : (
                  <>
                    Sync newly <span className="font-bold text-[#16a34a]">Cleared</span> students in <strong className="text-[#1e293b]">"{currentStage?.stage_name}"</strong> to the next stage? Any students who have newly cleared will automatically progress to the next round with their status initialized to Pending.
                  </>
                )
              ) : !nextStage ? (
                <>
                  Are you sure you want to mark the final stage <strong className="text-[#1e293b]">"{currentStage?.stage_name}"</strong> as completed? All students marked as <span className="font-bold text-[#16a34a]">Cleared</span> will automatically move to the <strong>4. Final Selection</strong> tab, and any remaining students with <strong>Pending</strong> outcome will be set to <span className="font-bold text-[#dc2626]">Not Cleared</span>.
                </>
              ) : (
                <>
                  Are you sure you want to mark <strong className="text-[#1e293b]">"{currentStage?.stage_name}"</strong> as completed? All students marked as <span className="font-bold text-[#16a34a]">Cleared</span> will automatically progress to the next recruitment stage, and any remaining students with <strong>Pending</strong> outcome will be set to <span className="font-bold text-[#dc2626]">Not Cleared</span>.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmCompleteOpen(false)}
                disabled={isCompleting}
                className="px-5 py-2.5 text-[14px] font-semibold text-[#475569] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-[10px] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteStage}
                disabled={isCompleting}
                className={`px-6 py-2.5 text-[14px] font-bold text-white rounded-[10px] shadow-sm transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-70 ${currentStage?.stage_status === 'completed'
                  ? 'bg-[#2563eb] hover:bg-[#1d4ed8]'
                  : 'bg-[#16a34a] hover:bg-[#15803d]'
                  }`}
              >
                {isCompleting && <Loader2 size={16} className="animate-spin" />}
                <span>
                  {currentStage?.stage_status === 'completed'
                    ? (!nextStage ? 'Confirm & Sync Final' : 'Confirm & Sync')
                    : (!nextStage ? 'Confirm & Complete Final Stage' : 'Confirm & Complete Stage')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Substage Completion */}
      {isConfirmCompleteSubstageOpen && substageToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[540px] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] overflow-hidden p-[28px_32px]">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]">
                <Check size={22} strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-[19px] font-bold text-[#172554] m-0 leading-tight">
                  Complete Substage: {substageToComplete.substage_name}
                </h3>
                <span className="text-[12.5px] font-medium text-[#64748b]">
                  {currentStage?.stage_name} • Substage {substageToComplete.sequence_no}
                </span>
              </div>
            </div>

            <p className="text-[14.5px] text-[#475569] leading-relaxed mb-7 font-normal">
              Are you sure you want to mark <strong className="text-[#1e293b]">"{substageToComplete.substage_name}"</strong> as completed? Students marked as <span className="font-bold text-[#16a34a]">Cleared</span> will automatically progress to the next substage, and any remaining students with <strong>Pending</strong> outcome will be set to <span className="font-bold text-[#dc2626]">Not Cleared</span>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmCompleteSubstageOpen(false)
                  setSubstageToComplete(null)
                }}
                disabled={isCompleting}
                className="px-5 py-2.5 text-[14px] font-semibold text-[#475569] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-[10px] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteSubstage}
                disabled={isCompleting}
                className="px-6 py-2.5 text-[14px] font-bold text-white bg-[#16a34a] hover:bg-[#15803d] rounded-[10px] shadow-sm transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-70"
              >
                {isCompleting && <Loader2 size={16} className="animate-spin" />}
                <span>Confirm & Complete Substage</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for Overall Recruitment Process Completion */}
      {isConfirmRecruitmentCompleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[560px] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] overflow-hidden p-[28px_32px]">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]">
                <CheckCircle2 size={24} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-[19px] font-bold text-[#172554] m-0 leading-tight">
                  Recruitment Process Completion
                </h3>
                <span className="text-[12.5px] font-medium text-[#64748b]">
                  Progress Cleared Candidates to Final Selection
                </span>
              </div>
            </div>

            <p className="text-[14.5px] text-[#475569] leading-relaxed mb-6 font-normal">
              Are you sure you want to complete the recruitment process? All candidates in the final round with <span className="font-bold text-[#16a34a]">Cleared</span> status will be moved to the <strong className="text-[#1e293b]">Final Selection</strong> tab for company offer confirmation.
            </p>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmRecruitmentCompleteOpen(false)}
                disabled={isCompletingRecruitment}
                className="px-5 py-2.5 text-[14px] font-semibold text-[#475569] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-[10px] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteRecruitment}
                disabled={isCompletingRecruitment}
                className="px-6 py-2.5 text-[14px] font-bold text-white bg-[#16a34a] hover:bg-[#15803d] rounded-[10px] shadow-sm transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-70"
              >
                {isCompletingRecruitment && <Loader2 size={16} className="animate-spin" />}
                <span>Confirm & Proceed to Final Selection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

