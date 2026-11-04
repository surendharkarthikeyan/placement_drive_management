import React, { useState, useEffect } from 'react'
import {
  Info,
  Calendar,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Check,
  ChevronRight,
  ShieldCheck,
  FileCheck,
  Clock
} from 'lucide-react'
import {
  getFinalSelection,
  saveFinalSelection,
  updateStudentOffer,
  uploadReferenceDocument,
  uploadOfferLetter,
  downloadOfferLetterUrl
} from '../../../services/api'

/**
 * FinalSelectionWorkspace (Tab 4: Final Selection)
 *
 * Implements the Final Selection view:
 * - Offered Students with role, package & "Import Offer Letter"
 *   Saves to C:\BIT\placement\placement_drive_management\document_db\student_offer_letters
 *   Named as: rollno_company_code.ext
 * - Official Result Reference with "Import"
 *   Saves to C:\BIT\placement\placement_drive_management\document_db\final_result_info
 * - Data stored in placement_drive & placement_drive_offers
 */
export default function FinalSelectionWorkspace({
  driveId,
  officerUserId = 6,
  onDriveUpdated = () => {},
  onNavigateToTab = () => {}
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Form state
  const [pubDate, setPubDate] = useState('')
  const [resultRef, setResultRef] = useState('')
  const [resultNotes, setResultNotes] = useState('')
  const [overallStatus, setOverallStatus] = useState('draft')
  const [companyCode, setCompanyCode] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [students, setStudents] = useState([])
  const [defaultRole, setDefaultRole] = useState('')
  const [defaultPackage, setDefaultPackage] = useState('')
  const [finalRoundCompleted, setFinalRoundCompleted] = useState(false)
  const [finalRoundName, setFinalRoundName] = useState('')

  // Upload feedback state
  const [uploadFeedback, setUploadFeedback] = useState({})
  const [isUploadingRef, setIsUploadingRef] = useState(false)

  // Track initial/persisted values to display Save button beside "Offered" when edited
  const [initialValues, setInitialValues] = useState({})
  const [savingOfferId, setSavingOfferId] = useState(null)
  const [saveFeedback, setSaveFeedback] = useState({})

  // Fetch final selection data on mount or when driveId changes
  const fetchData = async () => {
    if (!driveId) return
    setLoading(true)
    setErrorMessage('')
    // Clear previous drive state immediately to prevent stale data bleed
    setStudents([])
    setPubDate('')
    setResultRef('')
    setResultNotes('')
    setCompanyCode('')
    setCompanyName('')
    setDefaultRole('')
    setDefaultPackage('')
    setFinalRoundCompleted(false)
    setFinalRoundName('')
    setUploadFeedback({})
    setInitialValues({})
    setSaveFeedback({})

    try {
      const data = await getFinalSelection(driveId)
      if (data) {
        setPubDate(data.result_publication_date || '')
        setResultRef(data.result_reference || '')
        setResultNotes(data.result_notes || '')
        setOverallStatus(data.overall_status || 'draft')
        setCompanyCode(data.company_code || '')
        setCompanyName(data.company_name || '')
        setDefaultRole(data.default_role || '')
        setDefaultPackage(data.default_package_lpa || '')
        setFinalRoundCompleted(Boolean(data.final_round_completed))
        setFinalRoundName(data.final_round_name || '')

        const initial = {}
        const studentList = (data.students || []).map((s) => {
          const role = s.final_role || data.default_role || ''
          const pkg = s.package_lpa !== null && s.package_lpa !== undefined ? s.package_lpa : (data.default_package_lpa || '')
          initial[s.drive_student_id] = {
            final_role: role,
            package_lpa: pkg
          }
          return {
            ...s,
            final_role: role,
            package_lpa: pkg,
            offer_letter_file: s.offer_letter_file || ''
          }
        })
        setStudents(studentList)
        setInitialValues(initial)
      }
    } catch (err) {
      console.error('Failed to load final selection data', err)
      setErrorMessage(err.response?.data?.error || 'Failed to load final selection details.')
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [driveId])

  // Handle student role & package changes
  const handleStudentChange = (driveStudentId, field, value) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.drive_student_id === driveStudentId ? { ...s, [field]: value } : s
      )
    )
  }

  // Save an individual student's edited role and package to database
  const handleSaveStudentOffer = async (student) => {
    const studentId = student.drive_student_id
    setSavingOfferId(studentId)
    setErrorMessage('')
    try {
      const payload = {
        final_role: student.final_role ? student.final_role.trim() : defaultRole,
        package_lpa: student.package_lpa !== '' && student.package_lpa !== null ? parseFloat(student.package_lpa) : null
      }
      await updateStudentOffer(driveId, studentId, payload)

      // Update initial values so isEdited resets to false
      setInitialValues((prev) => ({
        ...prev,
        [studentId]: {
          final_role: student.final_role,
          package_lpa: student.package_lpa
        }
      }))

      // Show temporary "Saved" feedback
      setSaveFeedback((prev) => ({
        ...prev,
        [studentId]: true
      }))
      setTimeout(() => {
        setSaveFeedback((prev) => {
          const next = { ...prev }
          delete next[studentId]
          return next
        })
      }, 3000)

      onDriveUpdated()
    } catch (err) {
      console.error('Failed to update student offer', err)
      setErrorMessage(err.response?.data?.error || 'Failed to update offer details.')
    } finally {
      setSavingOfferId(null)
    }
  }

  // Handle upload of student offer letter
  const handleOfferLetterFileSelect = async (e, student) => {
    const file = e.target.files?.[0]
    if (!file) return

    const studentId = student.drive_student_id
    setUploadFeedback((prev) => ({
      ...prev,
      [studentId]: { status: 'uploading', message: 'Saving document...' }
    }))

    try {
      const resp = await uploadOfferLetter(
        driveId,
        student.drive_student_id,
        student.roll_no,
        companyCode,
        file
      )
      const savedFileName = resp.file_name

      setStudents((prev) =>
        prev.map((s) =>
          s.drive_student_id === studentId ? { ...s, offer_letter_file: savedFileName } : s
        )
      )

      setUploadFeedback((prev) => ({
        ...prev,
        [studentId]: { status: 'success', message: 'Saved' }
      }))

      // Keep the success feedback visible for a few seconds
      setTimeout(() => {
        setUploadFeedback((prev) => {
          const next = { ...prev }
          if (next[studentId]?.status === 'success') {
            delete next[studentId]
          }
          return next
        })
      }, 4000)

      onDriveUpdated()
    } catch (err) {
      console.error('Failed to upload offer letter', err)
      setUploadFeedback((prev) => ({
        ...prev,
        [studentId]: { status: 'error', message: 'Upload failed' }
      }))
    }
  }

  // Handle upload of official reference document
  const handleReferenceDocSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingRef(true)
    try {
      const resp = await uploadReferenceDocument(driveId, file)
      setResultRef(resp.file_name)
      onDriveUpdated()
    } catch (err) {
      console.error('Failed to upload reference document', err)
      setErrorMessage(err.response?.data?.error || 'Failed to upload reference document.')
    } finally {
      setIsUploadingRef(false)
    }
  }

  // Save changes
  const handleSave = async () => {
    setErrorMessage('')
    setSaving(true)

    try {
      const payload = {
        result_publication_date: pubDate ? pubDate : null,
        result_reference: resultRef.trim(),
        result_notes: resultNotes.trim(),
        mark_completed: false,
        officer_user_id: officerUserId,
        offers: students.map((s) => ({
          drive_student_id: s.drive_student_id,
          final_role: s.final_role ? s.final_role : defaultRole,
          package_lpa: s.package_lpa ? parseFloat(s.package_lpa) : null,
          offer_letter_file: s.offer_letter_file || null
        }))
      }

      await saveFinalSelection(driveId, payload)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      // Empty all final result information fields after saving
      setPubDate('')
      setResultRef('')
      setResultNotes('')

      onDriveUpdated()
    } catch (err) {
      console.error('Failed to save final selections', err)
      setErrorMessage(err.response?.data?.error || 'Failed to save final selections.')
    } finally {
      setSaving(false)
    }
  }

  const getInitials = (name) => {
    if (!name) return 'ST'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white border border-[#dbe5f1] rounded-[16px]">
        <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
        <span className="text-[15px] font-medium text-[#64748b]">Loading final selection records...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Top Informative Banner */}
      <div className="flex items-start gap-3 px-5 py-3.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-[12px] text-[#1e40af] text-[14px] leading-relaxed shadow-2xs">
        <Info size={19} className="mt-0.5 shrink-0 text-[#2563eb]" />
        <span>
          Enter the finally selected students only after receiving official confirmation from the company. Completing the drive will update each student&apos;s placement record.
        </span>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-[12px] text-red-700 text-[13.5px]">
          <AlertTriangle size={17} className="shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Offered Students */}
        <div className="bg-white border border-[#dbe5f1] rounded-[16px] p-6 shadow-2xs flex flex-col gap-5">
          <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
            <div>
              <h3 className="text-[17px] font-bold text-[#172554] m-0">Offered Students</h3>
              <p className="text-[13.5px] text-[#64748b] mt-1 mb-0">Select students confirmed by the company.</p>
            </div>
          </div>

          {/* Candidates List */}
          <div className="flex flex-col gap-4 mt-1">
            {!finalRoundCompleted ? (
              <div className="py-12 px-5 text-center bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-[14px] flex flex-col items-center justify-center gap-2.5">
                <div className="w-11 h-11 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#64748b]">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="text-[14.5px] font-bold text-[#1e293b] m-0">Recruitment Process Not Completed</h4>
                  <p className="text-[12.5px] text-[#64748b] mt-1 mb-0 max-w-[420px] leading-relaxed">
                    Cleared students will show in this final selection tab after clicking the "Recruitment Process Completion" button in Stages &amp; Outcomes.
                  </p>
                </div>
                {onNavigateToTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('stages')}
                    className="mt-1 px-4 py-1.5 text-[12.5px] font-bold text-[#2563eb] bg-[#eff6ff] hover:bg-[#dbeafe] border border-[#bfdbfe] rounded-[8px] transition cursor-pointer"
                  >
                    Go to Stages &amp; Outcomes
                  </button>
                )}
              </div>
            ) : students.length === 0 ? (
              <div className="py-12 text-center text-[#94a3b8] text-[13.5px]">
                No students cleared the final recruitment round.
              </div>
            ) : (
              students.map((student) => {
                const initials = getInitials(student.name)
                const fileInfo = uploadFeedback[student.drive_student_id]
                const currentFileName = fileInfo?.status === 'success' ? fileInfo.message : student.offer_letter_file

                const initVal = initialValues[student.drive_student_id]
                const isEdited = Boolean(
                  initVal && (
                    (student.final_role || '').trim() !== (initVal.final_role || '').trim() ||
                    String(student.package_lpa ?? '').trim() !== String(initVal.package_lpa ?? '').trim()
                  )
                )

                return (
                  <div
                    key={student.drive_student_id}
                    className="p-4 rounded-[14px] border border-[#e2e8f0] bg-[#fafcff] hover:border-[#cbd5e1] transition-all flex flex-col gap-3.5"
                  >
                    {/* Student Header: Avatar, Name, Department, Offered Badge & Save Button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#dbeafe] text-[#1d4ed8] font-bold text-[12.5px] flex items-center justify-center shrink-0 tracking-tight shadow-2xs">
                          {initials}
                        </div>
                        <div>
                          <div className="text-[14.5px] font-bold text-[#1e293b] leading-tight">
                            {student.name}
                          </div>
                          <div className="text-[12.5px] text-[#64748b] mt-1">
                            {student.roll_no ? `${student.roll_no} · ` : ''}
                            {student.department_name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[12px] font-semibold tracking-tight flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Offered</span>
                        </span>

                        {/* Show Save button near to the status 'Offered' when role or LPA is edited */}
                        {isEdited && (
                          <button
                            type="button"
                            onClick={() => handleSaveStudentOffer(student)}
                            disabled={savingOfferId === student.drive_student_id}
                            className="px-2.5 py-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] text-[11.5px] font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer disabled:opacity-60"
                            title="Save edited role and package to database"
                          >
                            {savingOfferId === student.drive_student_id ? (
                              <Loader2 size={12} className="animate-spin text-white" />
                            ) : (
                              <Save size={12} className="text-white" />
                            )}
                            <span>Save</span>
                          </button>
                        )}

                        {saveFeedback[student.drive_student_id] && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded-[6px] animate-in fade-in duration-200">
                            <Check size={12} className="text-[#16a34a]" />
                            <span>Saved</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Inputs Row: Final Role & Final Package */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">
                          Final role
                        </label>
                        <input
                          type="text"
                          value={student.final_role || ''}
                          onChange={(e) =>
                            handleStudentChange(student.drive_student_id, 'final_role', e.target.value)
                          }
                          placeholder={defaultRole || 'e.g. Software Engineer'}
                          className="w-full px-3.5 py-2 text-[13.5px] rounded-[9px] border border-[#cbd5e1] bg-white text-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-semibold text-[#475569] mb-1.5">
                          Final package
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={student.package_lpa || ''}
                          onChange={(e) =>
                            handleStudentChange(student.drive_student_id, 'package_lpa', e.target.value)
                          }
                          placeholder={defaultPackage ? `${defaultPackage} LPA` : 'e.g. 8.5'}
                          className="w-full px-3.5 py-2 text-[13.5px] rounded-[9px] border border-[#cbd5e1] bg-white text-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
                        />
                      </div>
                    </div>

                    {/* Import & Download Offer Letter Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#f1f5f9]">
                      <div className="flex items-center gap-2.5">
                        <label
                          className={`py-1.5 px-3 rounded-[8px] text-[12.5px] font-medium transition cursor-pointer flex items-center gap-1.5 active:scale-98 shadow-2xs ${
                            fileInfo?.status === 'uploading'
                              ? 'bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] cursor-wait'
                              : 'bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1]'
                          }`}
                        >
                          {fileInfo?.status === 'uploading' ? (
                            <Loader2 size={14} className="animate-spin text-[#2563eb]" />
                          ) : (
                            <Upload size={14} className="text-[#64748b]" />
                          )}
                          <span>{fileInfo?.status === 'uploading' ? 'Importing...' : 'Import Offer Letter'}</span>
                          <input
                            type="file"
                            disabled={fileInfo?.status === 'uploading'}
                            className="hidden"
                            onChange={(e) => handleOfferLetterFileSelect(e, student)}
                          />
                        </label>

                        {/* Success confirmation badge after transaction completes */}
                        {fileInfo?.status === 'success' && (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1 rounded-[7px] animate-in fade-in duration-200">
                            <CheckCircle2 size={13} className="text-[#16a34a]" />
                            <span>Saved</span>
                          </span>
                        )}

                        {fileInfo?.status === 'error' && (
                          <span className="text-[12px] text-red-500 font-medium ml-1">
                            Upload failed
                          </span>
                        )}
                      </div>

                      {/* Download Offer Letter Button at the right end */}
                      {Boolean(currentFileName) ? (
                        <a
                          href={downloadOfferLetterUrl(driveId, student.drive_student_id)}
                          download
                          className="py-1.5 px-3 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] rounded-[8px] text-[12.5px] font-semibold transition cursor-pointer flex items-center gap-1.5 active:scale-98 shadow-2xs shrink-0"
                          title="Download student offer letter"
                        >
                          <Download size={14} className="text-[#2563eb]" />
                          <span>Download Offer Letter</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="py-1.5 px-3 bg-[#f8fafc] text-[#94a3b8] border border-[#e2e8f0] rounded-[8px] text-[12.5px] font-medium transition cursor-not-allowed flex items-center gap-1.5 shadow-2xs opacity-75 shrink-0"
                          title="Upload/Import offer letter first to enable download"
                        >
                          <Download size={14} className="text-[#94a3b8]" />
                          <span>Download Offer Letter</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Final Result Information */}
        <div className="bg-white border border-[#dbe5f1] rounded-[16px] p-6 shadow-2xs flex flex-col gap-5">
          <div className="pb-2 border-b border-[#f1f5f9]">
            <h3 className="text-[17px] font-bold text-[#172554] m-0">Final Result Information</h3>
          </div>

          <div className="flex flex-col gap-4.5">
            {/* Result Publication Date */}
            <div>
              <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">
                Result Publication Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={pubDate}
                  onChange={(e) => setPubDate(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 text-[14px] rounded-[10px] border border-[#cbd5e1] bg-white text-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
                  placeholder="dd-mm-yyyy"
                />
                <Calendar
                  size={17}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
                />
              </div>
            </div>

            {/* Official Result Reference with Import */}
            <div>
              <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">
                Official Result Reference
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={resultRef}
                  onChange={(e) => setResultRef(e.target.value)}
                  placeholder={`OFFER-REF-2026-${companyCode || 'COMPANYCODE'}-001`}
                  className="flex-1 px-3.5 py-2.5 text-[14px] rounded-[10px] border border-[#cbd5e1] bg-white text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
                />
                <label className="shrink-0 py-2.5 px-4 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] rounded-[10px] text-[13.5px] font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-98">
                  {isUploadingRef ? (
                    <Loader2 size={15} className="animate-spin text-[#2563eb]" />
                  ) : (
                    <Upload size={15} className="text-[#64748b]" />
                  )}
                  <span>{isUploadingRef ? 'Uploading...' : 'Import'}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleReferenceDocSelect}
                  />
                </label>
              </div>
            </div>

            {/* Result Notes */}
            <div>
              <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">
                Result Notes
              </label>
              <textarea
                rows={4}
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                placeholder="Enter company confirmation details"
                className="w-full px-3.5 py-2.5 text-[14px] rounded-[10px] border border-[#cbd5e1] bg-white text-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb] resize-y"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="py-2.5 px-5 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] rounded-[10px] text-[13.5px] font-semibold transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin text-[#2563eb]" />
                ) : saveSuccess ? (
                  <Check size={15} className="text-emerald-600" />
                ) : (
                  <Save size={15} className="text-[#64748b]" />
                )}
                <span>{saveSuccess ? 'Saved' : 'Save Details'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
