// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 Shogo Technologies, Inc.
import { useState, useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LayoutDashboard, FolderTree, PenTool, FileSpreadsheet, Settings, Database, Pencil } from 'lucide-react'
import Dashboard from '@/components/Dashboard'
import BuildingNavigator from '@/components/BuildingNavigator'
import QuickEntry from '@/components/QuickEntry'
import Reports from '@/components/Reports'
import SettingsPage from '@/components/Settings'

export default function App() {
  const [seeded, setSeeded] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [projectName, setProjectName] = useState(() => {
    return localStorage.getItem('projectName') || 'PILLERS'
  })
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(projectName)
  const inputRef = useRef<HTMLInputElement>(null)
  const [updaterName, setUpdaterName] = useState(() => {
    return localStorage.getItem('updaterName') || ''
  })
  const [editingUpdater, setEditingUpdater] = useState(false)
  const [draftUpdater, setDraftUpdater] = useState(updaterName)
  const updaterRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
    if (editingUpdater && updaterRef.current) {
      updaterRef.current.focus()
      updaterRef.current.select()
    }
  }, [editingName, editingUpdater])

  useEffect(() => {
    checkSeedStatus()
  }, [])

  function saveProjectName() {
    const trimmed = draftName.trim()
    if (trimmed) {
      setProjectName(trimmed)
      localStorage.setItem('projectName', trimmed)
    } else {
      setDraftName(projectName)
    }
    setEditingName(false)
  }

  function saveUpdaterName() {
    const trimmed = draftUpdater.trim()
    setUpdaterName(trimmed)
    localStorage.setItem('updaterName', trimmed)
    setEditingUpdater(false)
  }

  async function checkSeedStatus() {
    const res = await fetch('/api/building-types')
    if (res.ok) {
      const data = await res.json()
      const types = data.items || data.buildingTypes || data
      setSeeded(Array.isArray(types) && types.length > 0)
    }
  }

  async function seedData() {
    setSeeding(true)
    await fetch('/api/seed', { method: 'POST' })
    setSeeded(true)
    setSeeding(false)
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {editingName ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="text-2xl font-bold bg-transparent border-b-2 border-white/50 outline-none w-full text-white placeholder-white/40"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={saveProjectName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveProjectName()
                    if (e.key === 'Escape') { setDraftName(projectName); setEditingName(false) }
                  }}
                />
              ) : (
                <h1
                  className="text-2xl font-bold cursor-pointer hover:text-white/80 group inline-flex items-center gap-2"
                  onClick={() => { setDraftName(projectName); setEditingName(true) }}
                >
                  {projectName}
                  <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-60 transition-opacity" />
                </h1>
              )}
              <p className="text-sm text-white/60 mt-1.5">
                {updaterName ? (
                  <span className="inline-flex items-center gap-1.5">
                    Updated by: <span className="font-medium text-white/90">{updaterName}</span>
                    <button
                      className="text-white/40 hover:text-white/80 transition-colors ml-1"
                      onClick={() => { setDraftUpdater(updaterName); setEditingUpdater(true) }}
                    >
                      <Pencil className="h-3 w-3 inline" />
                    </button>
                  </span>
                ) : (
                  <button
                    className="hover:text-white/80 transition-colors"
                    onClick={() => { setDraftUpdater(''); setEditingUpdater(true) }}
                  >
                    Click to set your name
                  </button>
                )}
              </p>
              {editingUpdater && (
                <input
                  ref={updaterRef}
                  type="text"
                  className="text-sm border-b border-white/40 outline-none mt-1 w-60 bg-transparent text-white placeholder-white/40"
                  placeholder="Your name"
                  value={draftUpdater}
                  onChange={(e) => setDraftUpdater(e.target.value)}
                  onBlur={saveUpdaterName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveUpdaterName()
                    if (e.key === 'Escape') { setDraftUpdater(updaterName); setEditingUpdater(false) }
                  }}
                />
              )}
            </div>
            {!seeded && (
              <Button onClick={seedData} disabled={seeding} className="bg-white/10 hover:bg-white/20 text-white border border-white/20">
                <Database className="h-4 w-4 mr-2" />
                {seeding ? 'Setting up...' : 'Initialize Sample Data'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-muted/50">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="navigate" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FolderTree className="h-4 w-4" />
              <span className="hidden sm:inline">Navigate</span>
            </TabsTrigger>
            <TabsTrigger value="quick-entry" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <PenTool className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Entry</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>

          <TabsContent value="navigate">
            <BuildingNavigator />
          </TabsContent>

          <TabsContent value="quick-entry">
            <QuickEntry />
          </TabsContent>

          <TabsContent value="reports">
            <Reports />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPage />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
