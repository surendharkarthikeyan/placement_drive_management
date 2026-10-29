import React, { useState, useEffect } from 'react'
import TopNavigationBar from './components/layout/TopNavigationBar'
import ModuleNavigationTabs from './components/layout/ModuleNavigationTabs'
import DriveListPanel from './components/left/DriveListPanel'
import CenterWorkspacePanel from './components/middle/CenterWorkspacePanel'
import RightControlPanel from './components/right/RightControlPanel'
import CreateDriveModal from './components/modals/CreateDriveModal'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { getBatches } from './services/api'

export default function App() {
  const [activeModule, setActiveModule] = useState('Placement Drive')
  const [selectedDriveId, setSelectedDriveId] = useState(null)
  const [currentDriveData, setCurrentDriveData] = useState(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Batch filter state (shared across Header and Left Panel)
  const [batches, setBatches] = useState([])
  const [selectedBatch, setSelectedBatch] = useState('all')

  // Load batches from backend
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await getBatches()
        setBatches(data)
      } catch (err) {
        console.error('Failed to load batches:', err)
      }
    }
    fetchBatches()
  }, [])

  // Unsaved changes alert state
  const [isFormDirty, setIsFormDirty] = useState(false)
  const [pendingDriveId, setPendingDriveId] = useState(null)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [saveTrigger, setSaveTrigger] = useState(0)

  const handleDriveCreated = (newDrive) => {
    setRefreshKey((prev) => prev + 1)
    if (newDrive?.id) {
      setSelectedDriveId(newDrive.id)
    }
  }

  const handleStatusUpdated = () => {
    setRefreshKey((prev) => prev + 1)
  }

  // Intercept drive selection if there are unsaved changes
  const handleSelectDriveWithCheck = (newId) => {
    if (newId === selectedDriveId) return

    if (isFormDirty) {
      setPendingDriveId(newId)
      setShowUnsavedModal(true)
    } else {
      setSelectedDriveId(newId)
    }
  }

  // User decides to discard unsaved changes and switch
  const handleDiscardAndSwitch = () => {
    setIsFormDirty(false)
    setShowUnsavedModal(false)
    if (pendingDriveId) {
      setSelectedDriveId(pendingDriveId)
      setPendingDriveId(null)
    }
  }

  // User clicks Save Changes from the alert dialog
  const handleSaveAndSwitch = () => {
    setSaveTrigger((prev) => prev + 1)
    setShowUnsavedModal(false)
    if (pendingDriveId) {
      setTimeout(() => {
        setSelectedDriveId(pendingDriveId)
        setPendingDriveId(null)
      }, 350)
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f5f8fc] text-[#1e293b] font-sans antialiased text-[14px]">
      {/* 1. Top Navigation Bar (74px) */}
      <TopNavigationBar />

      {/* 2. Sub-Navigation Tabs Bar (70px) with Batch Selector Dropdown */}
      <ModuleNavigationTabs
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        batches={batches}
        selectedBatch={selectedBatch}
        onBatchChange={setSelectedBatch}
      />

      {/* 3. Main Workspace Area: Left Panel (335px) + Center Panel (flex-1 minmax) + Right Panel (360px-400px) */}
      <main className="flex-1 flex h-[calc(100vh-144px)] overflow-hidden">
        {/* DB Connected Left Panel */}
        <DriveListPanel
          selectedDriveId={selectedDriveId}
          onSelectDrive={handleSelectDriveWithCheck}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          refreshKey={refreshKey}
          selectedBatch={selectedBatch}
        />

        {/* DB Connected Center Workspace Panel (scrollable middle content) */}
        <CenterWorkspacePanel
          selectedDriveId={selectedDriveId}
          onDriveUpdated={() => setRefreshKey((prev) => prev + 1)}
          onDriveLoaded={(drive) => setCurrentDriveData(drive)}
          onDirtyChange={(dirty) => setIsFormDirty(dirty)}
          saveTrigger={saveTrigger}
          refreshKey={refreshKey}
        />

        {/* DB Connected Right Control Panel */}
        <RightControlPanel
          drive={currentDriveData}
          onStatusUpdated={handleStatusUpdated}
        />
      </main>

      {/* Create Drive Modal */}
      <CreateDriveModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onDriveCreated={handleDriveCreated}
      />

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[16px] shadow-2xl border border-[#dbe5f1] max-w-md w-full p-6 text-[#1e293b]">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-[44px] h-[44px] rounded-full bg-[#fef2f2] border border-[#fecaca] flex items-center justify-center text-[#dc2626] shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-[18px] font-[850] text-[#172554] m-0">
                  Unsaved Changes Detected
                </h3>
                <p className="text-[14px] text-[#64748b] mt-1.5 leading-relaxed">
                  You have modified details for this placement drive. Please save your changes before switching to another company card, or choose to discard them.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="px-4 py-2.5 rounded-[10px] text-[14px] font-[700] text-[#64748b] hover:bg-[#f1f5f9] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDiscardAndSwitch}
                className="px-4 py-2.5 rounded-[10px] text-[14px] font-[700] text-[#dc2626] hover:bg-[#fef2f2] transition cursor-pointer"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={handleSaveAndSwitch}
                className="px-5 py-2.5 rounded-[10px] text-[14px] font-[800] text-white bg-[#2563eb] hover:bg-[#1d4ed8] shadow-sm transition cursor-pointer active:scale-98"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
