import React, { useState } from 'react'

export default function MiddlePanel({
  onOpenStageModal = () => {},
  onOpenStudentModal = () => {}
}) {
  const [activeWorkflowTab, setActiveWorkflowTab] = useState('stages')
  const [selectedStageId, setSelectedStageId] = useState(3)
  const [selectedSubstageIndex, setSelectedSubstageIndex] = useState(0)

  // Pipeline Stages
  const stages = [
    { id: 1, name: 'Application & Shortlist', state: 'Completed', info: '148 included', substages: [] },
    { id: 2, name: 'Online Assessment', state: 'Completed', info: '92 cleared', substages: [] },
    {
      id: 3,
      name: 'Technical Process',
      state: 'Completed',
      info: '2 substages',
      substages: ['Coding Round', 'Technical Interview']
    },
    { id: 4, name: 'HR & Final Discussion', state: 'Awaiting Result', info: '24 students', substages: [] },
    { id: 5, name: 'Final Selection', state: 'Pending', info: 'Result awaited', substages: [] }
  ]

  // Mock Students
  const [students, setStudents] = useState([
    { id: 1, name: 'Aarav Krishnan', reg: '21CSE1042', dept: 'CSE', cgpa: 8.74, offer: 'No Offer', previous: 'Cleared', outcome: 'Cleared', remark: '86 / 100' },
    { id: 2, name: 'Nithya Raman', reg: '21ECE1088', dept: 'ECE', cgpa: 9.12, offer: '12.8 LPA', previous: 'Cleared', outcome: 'Cleared', remark: 'Strong technical' },
    { id: 3, name: 'Kavin Prakash', reg: '21IT1021', dept: 'IT', cgpa: 8.31, offer: 'No Offer', previous: 'Cleared', outcome: 'Pending', remark: 'Result awaited' },
    { id: 4, name: 'Meera S', reg: '21CSE1095', dept: 'CSE', cgpa: 8.92, offer: '14 LPA', previous: 'Cleared', outcome: 'Cleared', remark: 'Recommended' },
    { id: 5, name: 'Divya Narayanan', reg: '21IT1076', dept: 'IT', cgpa: 8.56, offer: '9.5 LPA', previous: 'Cleared', outcome: 'Not Cleared', remark: 'Technical gap' },
    { id: 6, name: 'Harini V', reg: '21ECE1102', dept: 'ECE', cgpa: 8.66, offer: 'No Offer', previous: 'Cleared', outcome: 'Pending', remark: 'Result awaited' },
    { id: 7, name: 'Vishal Raj', reg: '21CSE1124', dept: 'CSE', cgpa: 8.18, offer: 'No Offer', previous: 'Cleared', outcome: 'Cleared', remark: 'Good coding' },
    { id: 8, name: 'Lakshmi P', reg: '21IT1117', dept: 'IT', cgpa: 9.01, offer: 'No Offer', previous: 'Cleared', outcome: 'Absent', remark: 'Medical leave' }
  ])

  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set())
  const [studentSearch, setStudentSearch] = useState('')

  const activeStage = stages.find((s) => s.id === selectedStageId) || stages[2]
  const activeStageIndex = stages.findIndex((s) => s.id === selectedStageId)

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudentIds(new Set(students.map((s) => s.id)))
    } else {
      setSelectedStudentIds(new Set())
    }
  }

  const toggleStudent = (id) => {
    const next = new Set(selectedStudentIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedStudentIds(next)
  }

  const handleOutcomeChange = (id, newOutcome) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, outcome: newOutcome } : s))
    )
  }

  const handleBulkOutcome = (outcome) => {
    if (!selectedStudentIds.size) return
    setStudents((prev) =>
      prev.map((s) =>
        selectedStudentIds.has(s.id)
          ? { ...s, outcome, remark: outcome === 'Pending' ? 'Result awaited' : outcome }
          : s
      )
    )
  }

  const getOutcomeClass = (outcome) => {
    switch (outcome) {
      case 'Cleared':
        return 'text-[#15803d] bg-[#f0fdf4] border-[#bbf7d0]'
      case 'Not Cleared':
        return 'text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]'
      case 'Pending':
        return 'text-[#b45309] bg-[#fffbeb] border-[#fde68a]'
      default:
        return 'text-[#64748b] bg-[#f1f5f9] border-[#e2e8f0]'
    }
  }

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.reg.toLowerCase().includes(studentSearch.toLowerCase())
  )

  return (
    <section className="h-full overflow-y-auto p-[18px] bg-[#f5f8fc] text-[#1e293b]">
      {/* 1. Drive Top Row (Title + Actions) */}
      <div className="flex items-start justify-between gap-[15px]">
        <div>
          <h1 className="text-[21px] font-[800] text-[#172554] m-0">Amazon Placement Drive</h1>
          <p className="text-[12px] text-[#64748b] mt-[5px] mb-0">
            Software Development Engineer · 18.5 LPA · Campus Recruitment
          </p>
        </div>
        <div className="flex items-center gap-[7px]">
          <button className="py-[9px] px-[13px] bg-white hover:bg-[#f8fafc] border border-[#dbe5f1] text-[#475569] rounded-[9px] text-[13px] font-[750] transition cursor-pointer">
            Duplicate
          </button>
          <button className="py-[9px] px-[13px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white border border-[#2563eb] rounded-[9px] text-[13px] font-[750] transition cursor-pointer">
            Save Changes
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="my-[15px] grid grid-cols-5 gap-[8px]">
        {[
          { label: 'Initially eligible', count: 182, border: 'border-t-[#2563eb]' },
          { label: 'Included in drive', count: 148, border: 'border-t-[#7c3aed]' },
          { label: 'Reached final stage', count: 24, border: 'border-t-[#16a34a]' },
          { label: 'Awaiting final result', count: 24, border: 'border-t-[#d97706]' },
          { label: 'Not cleared / absent', count: 124, border: 'border-t-[#dc2626]' }
        ].map((card, i) => (
          <div
            key={i}
            className={`p-[11px] bg-white border border-[#dbe5f1] border-t-[3px] ${card.border} rounded-[10px]`}
          >
            <strong className="block text-[20px] font-[800] text-[#172554] leading-tight">
              {card.count}
            </strong>
            <span className="text-[11px] text-[#64748b] mt-[4px] block leading-[1.3]">
              {card.label}
            </span>
          </div>
        ))}
      </div>

      {/* 3. Workflow Step Navigation */}
      <div className="mb-[14px] flex gap-[4px] border-b border-[#dbe5f1]">
        {[
          { id: 'setup', label: '1. Drive Setup' },
          { id: 'students', label: '2. Student List' },
          { id: 'stages', label: '3. Stages & Outcomes' },
          { id: 'final', label: '4. Final Selection' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveWorkflowTab(tab.id)}
            className={`py-[10px] px-[13px] text-[13px] font-[750] transition border-b-2 cursor-pointer ${
              activeWorkflowTab === tab.id
                ? 'text-[#2563eb] border-b-[#2563eb]'
                : 'text-[#64748b] border-b-transparent hover:text-[#1e293b]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Tab Content: "3. Stages & Outcomes" */}
      {activeWorkflowTab === 'stages' && (
        <div>
          {/* Info Banner */}
          <div className="mb-[12px] p-[11px_12px] flex items-start gap-[9px] text-[12px] leading-[1.5] text-[#1e40af] border border-[#bfdbfe] rounded-[9px] bg-[#eff6ff]">
            <strong className="font-extrabold text-[14px]">ⓘ</strong>
            <span>
              Enter the outcome after every stage. A stage may contain multiple substages when the
              company divides one recruitment stage into separate activities.
            </span>
          </div>

          {/* Recruitment Process Header & Pipeline */}
          <div className="mb-[14px]">
            <div className="mb-[10px] flex items-center justify-between">
              <div>
                <div className="text-[14px] font-[850] text-[#334155]">Recruitment Process</div>
                <div className="text-[11px] text-[#64748b] mt-[3px]">
                  Select a stage to enter student outcomes.
                </div>
              </div>
              <button
                onClick={onOpenStageModal}
                className="py-[7px] px-[9px] text-[#2563eb] border border-[#bfdbfe] bg-[#eff6ff] rounded-[7px] text-[11px] font-[700] hover:bg-[#dbeafe] transition cursor-pointer"
              >
                + Add Stage
              </button>
            </div>

            {/* Pipeline Stage Nodes */}
            <div className="py-[4px] pb-[10px] flex items-center gap-[8px] overflow-x-auto">
              {stages.map((stage, idx) => {
                const isSelected = selectedStageId === stage.id
                return (
                  <button
                    key={stage.id}
                    onClick={() => {
                      setSelectedStageId(stage.id)
                      setSelectedSubstageIndex(0)
                    }}
                    className={`min-w-[145px] min-h-[78px] p-[9px] text-left rounded-[10px] border transition cursor-pointer shrink-0 ${
                      isSelected
                        ? 'border-[#2563eb] bg-[#eff6ff] shadow-[inset_0_0_0_1px_#93c5fd]'
                        : 'border-[#dbe5f1] bg-white hover:border-[#93c5fd]'
                    }`}
                  >
                    <div
                      className={`w-[22px] h-[22px] mb-[6px] grid place-items-center rounded-full text-[10px] font-[850] ${
                        isSelected
                          ? 'bg-[#2563eb] text-white'
                          : 'bg-[#e2e8f0] text-[#64748b]'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="text-[12px] font-[800] text-[#334155] leading-tight">
                      {stage.name}
                    </div>
                    <div className="text-[10px] text-[#64748b] mt-[4px]">
                      {stage.state} · {stage.info}
                    </div>
                  </button>
                )
              })}

              <button
                onClick={onOpenStageModal}
                className="min-w-[105px] min-h-[78px] text-[#2563eb] border border-dashed border-[#93c5fd] rounded-[10px] bg-[#f8fbff] text-[11px] font-[750] flex items-center justify-center cursor-pointer shrink-0"
              >
                + Add Stage
              </button>
            </div>
          </div>

          {/* Stage Detail Editor Box */}
          <div className="border border-[#dbe5f1] rounded-[11px] bg-white overflow-hidden">
            <div className="p-[13px] flex items-start justify-between gap-[10px] border-b border-[#dbe5f1] bg-[#fbfdff]">
              <div>
                <div className="text-[15px] font-[850] text-[#263449]">{activeStage.name}</div>
                <div className="text-[11px] text-[#64748b] mt-[4px]">
                  Stage {activeStageIndex + 1} · {activeStage.state} · {activeStage.info}
                </div>
              </div>
              <div className="flex items-center gap-[6px]">
                <button
                  onClick={onOpenStageModal}
                  className="py-[7px] px-[9px] text-[#475569] border border-[#dbe5f1] bg-white rounded-[7px] text-[11px] font-[700] hover:bg-[#f8fafc] cursor-pointer"
                >
                  Edit Stage
                </button>
                <button
                  onClick={onOpenStageModal}
                  className="py-[7px] px-[9px] text-[#2563eb] border border-[#bfdbfe] bg-[#eff6ff] rounded-[7px] text-[11px] font-[700] hover:bg-[#dbeafe] cursor-pointer"
                >
                  + Substage
                </button>
              </div>
            </div>

            {/* Substage tabs if available */}
            {activeStage.substages && activeStage.substages.length > 0 && (
              <div className="p-[9px_12px] flex gap-[6px] border-b border-[#dbe5f1] bg-[#f8fafc]">
                {activeStage.substages.map((sub, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSubstageIndex(i)}
                    className={`py-[7px] px-[10px] rounded-[7px] text-[11px] font-[750] border cursor-pointer transition ${
                      selectedSubstageIndex === i
                        ? 'text-[#2563eb] border-[#93c5fd] bg-[#eff6ff]'
                        : 'text-[#64748b] border-[#dbe5f1] bg-white hover:text-[#1e293b]'
                    }`}
                  >
                    {i + 1}. {sub}
                  </button>
                ))}
              </div>
            )}

            {/* Students Table Toolbar */}
            <div className="p-[10px_12px] flex items-center justify-between gap-[10px] border-b border-[#dbe5f1]">
              <div className="flex items-center gap-[7px]">
                <input
                  type="checkbox"
                  checked={selectedStudentIds.size === students.length && students.length > 0}
                  onChange={handleSelectAll}
                  className="w-[14px] h-[14px] rounded text-[#2563eb] border-[#dbe5f1] cursor-pointer"
                />
                <span className="text-[11px] text-[#64748b]">
                  {selectedStudentIds.size
                    ? `${selectedStudentIds.size} students selected`
                    : 'Select students'}
                </span>
              </div>

              <div className="flex items-center gap-[7px]">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search student"
                  className="w-[200px] py-[7px] px-[9px] border border-[#dbe5f1] rounded-[8px] text-[11px] text-[#1e293b] focus:outline-none focus:border-[#93c5fd]"
                />
                <button
                  onClick={() => handleBulkOutcome('Cleared')}
                  className="py-[7px] px-[9px] text-[#15803d] border border-[#bbf7d0] bg-[#f0fdf4] text-[11px] font-[700] rounded-[7px] cursor-pointer transition hover:bg-[#dcfce7]"
                >
                  Mark Cleared
                </button>
                <button
                  onClick={() => handleBulkOutcome('Not Cleared')}
                  className="py-[7px] px-[9px] text-[#b91c1c] border border-[#fecaca] bg-[#fff7f7] text-[11px] font-[700] rounded-[7px] cursor-pointer transition hover:bg-[#fee2e2]"
                >
                  Mark Not Cleared
                </button>
                <button
                  onClick={() => handleBulkOutcome('Pending')}
                  className="py-[7px] px-[9px] text-[#475569] border border-[#dbe5f1] bg-white text-[11px] font-[700] rounded-[7px] cursor-pointer transition hover:bg-[#f8fafc]"
                >
                  Mark Pending
                </button>
              </div>
            </div>

            {/* Students Table */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#dbe5f1]">
                  <th className="p-[9px_10px] w-[35px] text-left">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.size === students.length && students.length > 0}
                      onChange={handleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="p-[9px_10px] text-[10px] font-[850] text-[#64748b] tracking-[0.35px] uppercase text-left">
                    Student
                  </th>
                  <th className="p-[9px_10px] text-[10px] font-[850] text-[#64748b] tracking-[0.35px] uppercase text-left">
                    Previous Stage
                  </th>
                  <th className="p-[9px_10px] text-[10px] font-[850] text-[#64748b] tracking-[0.35px] uppercase text-left">
                    Outcome
                  </th>
                  <th className="p-[9px_10px] text-[10px] font-[850] text-[#64748b] tracking-[0.35px] uppercase text-left">
                    Score / Remark
                  </th>
                  <th className="p-[9px_10px] text-[10px] font-[850] text-[#64748b] tracking-[0.35px] uppercase text-left">
                    Updated By
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st) => (
                  <tr key={st.id} className="border-b border-[#edf2f7] hover:bg-[#fbfdff]">
                    <td className="p-[10px]">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(st.id)}
                        onChange={() => toggleStudent(st.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="p-[10px]">
                      <div className="flex items-center gap-[8px]">
                        <div className="w-[30px] h-[30px] rounded-[8px] bg-[#dbeafe] text-[#2563eb] grid place-items-center font-[850] text-[10px] shrink-0">
                          {st.name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div className="text-[12px] font-[800] text-[#27364a]">{st.name}</div>
                          <div className="text-[10px] text-[#94a3b8] mt-[2px]">
                            {st.reg} · {st.dept}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-[10px]">
                      <span className="py-[4px] px-[8px] rounded-[20px] text-[10px] font-[850] text-[#15803d] bg-[#dcfce7]">
                        {st.previous}
                      </span>
                    </td>
                    <td className="p-[10px]">
                      <select
                        value={st.outcome}
                        onChange={(e) => handleOutcomeChange(st.id, e.target.value)}
                        className={`p-[6px_8px] rounded-[7px] text-[11px] font-[700] border focus:outline-none cursor-pointer ${getOutcomeClass(
                          st.outcome
                        )}`}
                      >
                        <option>Cleared</option>
                        <option>Not Cleared</option>
                        <option>Pending</option>
                        <option>Absent</option>
                        <option>Withdrawn</option>
                      </select>
                    </td>
                    <td className="p-[10px]">
                      <input
                        type="text"
                        defaultValue={st.remark}
                        className="w-full max-w-[140px] p-[6px_8px] border border-[#dbe5f1] rounded-[7px] text-[11px] text-[#475569] focus:outline-none focus:border-[#93c5fd]"
                      />
                    </td>
                    <td className="p-[10px] text-[11px] text-[#475569]">
                      <div className="font-medium">Placement Team</div>
                      <div className="text-[10px] text-[#94a3b8]">Today</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Footer */}
            <div className="p-[10px_12px] flex items-center justify-between text-[11px] text-[#64748b] border-t border-[#dbe5f1]">
              <span>Showing sample students from this stage</span>
              <div className="flex items-center gap-[6px]">
                <button className="hover:text-[#1e293b] cursor-pointer">‹ Previous</button>
                <span className="font-[800] text-[#2563eb]">1</span>
                <span>2</span>
                <span>3</span>
                <span>… 8</span>
                <button className="hover:text-[#1e293b] cursor-pointer">Next ›</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Tab Content: "1. Drive Setup" */}
      {activeWorkflowTab === 'setup' && (
        <div className="p-[16px] bg-white border border-[#dbe5f1] rounded-[11px]">
          <div className="text-[15px] font-[850] text-[#334155] mb-[12px]">Company and Drive Information</div>
          <div className="grid grid-cols-3 gap-[12px]">
            <div>
              <label className="text-[11px] font-[800] text-[#475569] block mb-[6px]">Company Name</label>
              <input className="w-full p-[9px_10px] border border-[#dbe5f1] rounded-[8px] text-[13px]" defaultValue="Amazon" />
            </div>
            <div>
              <label className="text-[11px] font-[800] text-[#475569] block mb-[6px]">Job Role</label>
              <input className="w-full p-[9px_10px] border border-[#dbe5f1] rounded-[8px] text-[13px]" defaultValue="Software Development Engineer" />
            </div>
            <div>
              <label className="text-[11px] font-[800] text-[#475569] block mb-[6px]">Package</label>
              <input className="w-full p-[9px_10px] border border-[#dbe5f1] rounded-[8px] text-[13px]" defaultValue="18.5 LPA" />
            </div>
          </div>
        </div>
      )}

      {/* 4. Tab Content: "2. Student List" */}
      {activeWorkflowTab === 'students' && (
        <div className="p-[16px] bg-white border border-[#dbe5f1] rounded-[11px]">
          <div className="flex items-center justify-between mb-[12px]">
            <div className="text-[15px] font-[850] text-[#334155]">Students Included in this Drive</div>
            <button
              onClick={onOpenStudentModal}
              className="py-[9px] px-[13px] bg-[#2563eb] text-white rounded-[9px] text-[12px] font-[750]"
            >
              + Filter and Add Students
            </button>
          </div>
          <p className="text-[12px] text-[#64748b]">148 students currently included.</p>
        </div>
      )}

      {/* 4. Tab Content: "4. Final Selection" */}
      {activeWorkflowTab === 'final' && (
        <div className="p-[16px] bg-white border border-[#dbe5f1] rounded-[11px]">
          <div className="text-[15px] font-[850] text-[#334155] mb-[6px]">Final Selected Students</div>
          <p className="text-[12px] text-[#64748b]">Select students confirmed by the company.</p>
        </div>
      )}
    </section>
  )
}
