import React, { useState } from 'react'
import Header from './components/layout/Header'
import SubNav from './components/layout/SubNav'
import LeftPanel from './components/left/LeftPanel'
import MiddlePanel from './components/middle/MiddlePanel'
import RightPanel from './components/right/RightPanel'

export default function App() {
  const [selectedDriveId, setSelectedDriveId] = useState('amazon')

  const handleOpenCreateModal = () => {
    alert('Create New Drive modal triggered')
  }

  const handleOpenStageModal = () => {
    alert('Add Stage modal triggered')
  }

  const handleOpenStudentModal = () => {
    alert('Filter & Add Students modal triggered')
  }

  const handleCompleteDrive = () => {
    alert('Complete Drive confirmation triggered')
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f5f8fc] text-[#1e293b] font-sans antialiased text-[14px]">
      {/* 1. App Top Header (66px) */}
      <Header />

      {/* 2. Sub-Navigation Bar (58px) */}
      <SubNav />

      {/* 3. 3-Column Layout (Matching template 285px / 1fr / 365px exactly) */}
      <main className="flex-1 grid grid-cols-[285px_minmax(620px,1fr)_365px] h-[calc(100vh-124px)] overflow-hidden">
        {/* Left Column: Navigation & Drive Cards */}
        <LeftPanel
          selectedDriveId={selectedDriveId}
          onSelectDrive={setSelectedDriveId}
          onOpenCreateModal={handleOpenCreateModal}
        />

        {/* Middle Column: Drive Setup, Pipeline Stages & Outcomes */}
        <MiddlePanel
          onOpenStageModal={handleOpenStageModal}
          onOpenStudentModal={handleOpenStudentModal}
        />

        {/* Right Column: Status Control, Checklist & Activity Log */}
        <RightPanel onCompleteDrive={handleCompleteDrive} />
      </main>
    </div>
  )
}
