import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Building2, ChevronDown, ChevronRight, Plus, Trash2, Pencil, CheckCircle2, Clock, Circle,
  Layers, FolderTree, Settings2, X, DoorOpen
} from 'lucide-react'

interface WorkflowStep { id: string; name: string; status: string; sortOrder: number }
interface ItemType { id: string; code: string; name: string }
interface InstallationItem {
  id: string; code: string; name?: string; status: string; percent: number; isVariation: boolean
  itemType: ItemType; workflowSteps: WorkflowStep[]
}
interface Room { id: string; name: string; items: InstallationItem[] }
interface Floor { id: string; name: string; sortOrder: number; installationItems: InstallationItem[]; rooms: Room[] }
interface Building { id: string; name: string; floors: Floor[] }

function getStatusLabel(s: string) {
  if (s === 'complete') return 'Complete'
  if (s === 'in_progress') return 'In Progress'
  return 'Not Started'
}

function getStatusColor(s: string) {
  if (s === 'complete') return 'bg-green-500'
  if (s === 'in_progress') return 'bg-blue-500'
  return 'bg-gray-300'
}

function getStatusIcon(s: string) {
  if (s === 'complete') return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (s === 'in_progress') return <Clock className="h-4 w-4 text-blue-500" />
  return <Circle className="h-4 w-4 text-gray-400" />
}

function floorStats(items: InstallationItem[]) {
  const total = items.length
  const complete = items.filter(i => i.status === 'complete').length
  const inProgress = items.filter(i => i.status === 'in_progress').length
  const pct = total > 0 ? Math.round(items.reduce((s, i) => s + i.percent, 0) / total) : 0
  return { total, complete, inProgress, pct }
}

function groupItemsByType(items: InstallationItem[]) {
  const groups = new Map<string, { type: ItemType; items: InstallationItem[] }>()
  for (const item of items) {
    const typeId = item.itemType.id
    if (!groups.has(typeId)) groups.set(typeId, { type: item.itemType, items: [] })
    groups.get(typeId)!.items.push(item)
  }
  return Array.from(groups.values())
}

function ItemRow({ item, onEdit, onWorkflow, onDelete, onToggle, expanded }: {
  item: InstallationItem
  onEdit: () => void
  onWorkflow: () => void
  onDelete: () => void
  onToggle: () => void
  expanded: boolean
}) {
  const [editingItem, setEditingItem] = useState(false)
  const [editItemCode, setEditItemCode] = useState('')
  const [editItemName, setEditItemName] = useState('')
  const steps = item.workflowSteps ?? []
  const completed = steps.filter(s => s.status === 'complete').length

  async function saveEditItem() {
    if (!editItemCode.trim()) return
    await fetch(`/api/installation-items/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: editItemCode.trim().toUpperCase(), name: editItemName.trim() || null })
    })
    setEditingItem(false)
    onEdit()
  }

  return (
    <div className="group">
      <div
        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => onToggle()}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`} />
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          {editingItem ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <Input className="h-6 w-24 text-xs" value={editItemCode} onChange={e => setEditItemCode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEditItem(); if (e.key === 'Escape') setEditingItem(false) }} autoFocus />
              <Input className="h-6 w-32 text-xs" value={editItemName} onChange={e => setEditItemName(e.target.value)} placeholder="Name" />
              <Button size="sm" className="h-6 text-xs" onClick={saveEditItem}>Save</Button>
            </div>
          ) : (
            <>
              <span className="font-mono text-sm font-medium">{item.code}</span>
              {item.isVariation && <Badge variant="secondary" className="text-[9px] px-1">VO</Badge>}
              {item.name && <span className="text-xs text-muted-foreground hidden md:inline">{item.name}</span>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {steps.length > 0 && <span className="text-[10px] text-muted-foreground">{completed}/{steps.length}</span>}
          <span className="text-xs font-medium w-8 text-right">{item.percent}%</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" className="h-5 w-5 p-0" onClick={() => { setEditingItem(true); setEditItemCode(item.code); setEditItemName(item.name || ''); onEdit() }}>
              <Pencil className="h-2.5 w-2.5" />
            </Button>
            <Button variant="ghost" className="h-5 w-5 p-0" onClick={onWorkflow}>
              <Settings2 className="h-2.5 w-2.5" />
            </Button>
            <Button variant="ghost" className="h-5 w-5 p-0" onClick={onDelete}>
              <Trash2 className="h-2.5 w-2.5 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="ml-6 mb-2 p-2 rounded bg-muted/20 border-l-2 border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px]">{getStatusLabel(item.status)}</Badge>
            <Progress value={item.percent} className="h-1 flex-1" />
            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onWorkflow}>
              <Settings2 className="h-3 w-3 mr-1" /> Workflow
            </Button>
          </div>
          {steps.length > 0 && (
            <div className="space-y-1">
              {[...steps].sort((a, b) => a.sortOrder - b.sortOrder).map(step => (
                <div key={step.id} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(step.status)}
                    <span>{step.name}</span>
                  </div>
                  <Badge variant={step.status === 'complete' ? 'default' : 'secondary'} className="text-[9px] px-1">
                    {getStatusLabel(step.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BuildingNavigator() {
  const [tree, setTree] = useState<Building[]>([])
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set())
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const [showAddBuilding, setShowAddBuilding] = useState(false)
  const [newBuildingName, setNewBuildingName] = useState('')

  const [showAddFloor, setShowAddFloor] = useState<string | null>(null)
  const [newFloorName, setNewFloorName] = useState('')
  const [newFloorSort, setNewFloorSort] = useState(0)

  const [showAddRoom, setShowAddRoom] = useState<string | null>(null) // floorId
  const [newRoomName, setNewRoomName] = useState('')

  const [showAddItem, setShowAddItem] = useState<string | null>(null) // floorId or roomId
  const [addItemTarget, setAddItemTarget] = useState<{ floorId: string; roomId?: string } | null>(null)
  const [newItemCode, setNewItemCode] = useState('')
  const [newItemTypeId, setNewItemTypeId] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemVariation, setNewItemVariation] = useState(false)

  const [editingBuilding, setEditingBuilding] = useState<string | null>(null)
  const [editBuildingName, setEditBuildingName] = useState('')

  const [editingFloor, setEditingFloor] = useState<string | null>(null)
  const [editFloorName, setEditFloorName] = useState('')

  const [editingRoom, setEditingRoom] = useState<string | null>(null)
  const [editRoomName, setEditRoomName] = useState('')

  const [showWorkflow, setShowWorkflow] = useState<InstallationItem | null>(null)
  const [wfSteps, setWfSteps] = useState<WorkflowStep[]>([])
  const [newStepName, setNewStepName] = useState('')

  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; label: string } | null>(null)

  useEffect(() => { fetchTree(); fetchItemTypes() }, [])

  async function fetchTree() {
    const res = await fetch('/api/tree')
    if (res.ok) setTree(await res.json())
  }

  async function fetchItemTypes() {
    const res = await fetch('/api/item-types')
    if (res.ok) { const d = await res.json(); setItemTypes(d.items ?? []) }
  }

  function toggleBuilding(id: string) {
    setExpandedBuildings(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleFloor(id: string) {
    setExpandedFloors(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleRoom(id: string) {
    setExpandedRooms(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  // --- Building CRUD ---
  async function addBuilding() {
    if (!newBuildingName.trim()) return
    const res = await fetch('/api/buildings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBuildingName.trim(), buildingTypeId: '' })
    })
    if (!res.ok) {
      const typeRes = await fetch('/api/building-types')
      const typeData = typeRes.ok ? await typeRes.json() : { items: [] }
      const types = typeData.items ?? []
      let typeId = types[0]?.id
      if (!typeId) {
        const createType = await fetch('/api/building-types', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'PILLERS', name: 'Pillers Project' })
        })
        const td = await createType.json()
        typeId = td.data?.id ?? td.id
      }
      await fetch('/api/buildings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBuildingName.trim(), buildingTypeId: typeId })
      })
    }
    setNewBuildingName(''); setShowAddBuilding(false); fetchTree()
  }
  async function deleteBuilding(id: string) { await fetch(`/api/buildings/${id}`, { method: 'DELETE' }); setConfirmDelete(null); fetchTree() }
  async function saveEditBuilding(id: string) {
    if (!editBuildingName.trim()) return
    await fetch(`/api/buildings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editBuildingName.trim() }) })
    setEditingBuilding(null); fetchTree()
  }

  // --- Floor CRUD ---
  async function addFloor(buildingId: string) {
    if (!newFloorName.trim()) return
    await fetch('/api/floors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFloorName.trim(), buildingId, sortOrder: newFloorSort }) })
    setNewFloorName(''); setNewFloorSort(0); setShowAddFloor(null); fetchTree()
  }
  async function deleteFloor(id: string) { await fetch(`/api/floors/${id}`, { method: 'DELETE' }); setConfirmDelete(null); fetchTree() }
  async function saveEditFloor(id: string) {
    if (!editFloorName.trim()) return
    await fetch(`/api/floors/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editFloorName.trim() }) })
    setEditingFloor(null); fetchTree()
  }

  // --- Room CRUD ---
  async function addRoom(floorId: string) {
    if (!newRoomName.trim()) return
    await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newRoomName.trim(), floorId }) })
    setNewRoomName(''); setShowAddRoom(null); fetchTree()
  }
  async function deleteRoom(id: string) { await fetch(`/api/rooms/${id}`, { method: 'DELETE' }); setConfirmDelete(null); fetchTree() }
  async function saveEditRoom(id: string) {
    if (!editRoomName.trim()) return
    await fetch(`/api/rooms/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editRoomName.trim() }) })
    setEditingRoom(null); fetchTree()
  }

  // --- Item CRUD ---
  async function addItem(floorId: string, roomId?: string) {
    if (!newItemCode.trim() || !newItemTypeId) return
    await fetch('/api/installation-items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: newItemCode.trim().toUpperCase(), name: newItemName.trim() || null,
        floorId, roomId: roomId || null, itemTypeId: newItemTypeId, isVariation: newItemVariation,
        status: 'not_started', percent: 0
      })
    })
    setNewItemCode(''); setNewItemTypeId(''); setNewItemName(''); setNewItemVariation(false); setShowAddItem(null); setAddItemTarget(null); fetchTree()
  }
  async function deleteItem(id: string) { await fetch(`/api/installation-items/${id}`, { method: 'DELETE' }); setConfirmDelete(null); fetchTree() }

  // --- Workflow ---
  function openWorkflow(item: InstallationItem) {
    setShowWorkflow(item)
    setWfSteps([...(item.workflowSteps ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map(s => ({ ...s })))
    setNewStepName('')
  }
  async function addWorkflowStep() {
    if (!newStepName.trim() || !showWorkflow) return
    const res = await fetch('/api/workflow-steps', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newStepName.trim(), sortOrder: wfSteps.length, status: 'not_started', percent: 0, itemId: showWorkflow.id })
    })
    if (res.ok) { const data = await res.json(); setWfSteps(prev => [...prev, data.data ?? data]) }
    setNewStepName('')
  }
  async function updateWfStepStatus(index: number, status: string) {
    const step = wfSteps[index]
    if (!step.id) return
    await fetch(`/api/workflow-steps/${step.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setWfSteps(prev => prev.map((s, i) => i === index ? { ...s, status } : s))
  }
  async function deleteWfStep(stepId: string) {
    await fetch(`/api/workflow-steps/${stepId}`, { method: 'DELETE' })
    setWfSteps(prev => prev.filter(s => s.id !== stepId))
  }
  async function saveWorkflowProgress() {
    if (!showWorkflow) return
    const completed = wfSteps.filter(s => s.status === 'complete').length
    const percent = wfSteps.length > 0 ? Math.round((completed / wfSteps.length) * 100) : 0
    const status = wfSteps.every(s => s.status === 'complete') ? 'complete'
      : wfSteps.some(s => s.status === 'in_progress' || s.status === 'complete') ? 'in_progress'
      : 'not_started'
    await fetch(`/api/installation-items/${showWorkflow.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, percent })
    })
    setShowWorkflow(null); fetchTree()
  }

  // --- Stats ---
  const allItems = tree.flatMap(b => b.floors).flatMap(f => [...f.installationItems, ...f.rooms.flatMap(r => r.items)])
  const totalItems = allItems.length
  const totalComplete = allItems.filter(i => i.status === 'complete').length
  const overallPct = totalItems > 0 ? Math.round(allItems.reduce((s, i) => s + i.percent, 0) / totalItems) : 0

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{tree.length}</p>
                <p className="text-xs text-muted-foreground">Buildings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{tree.reduce((s, b) => s + b.floors.length, 0)}</p>
                <p className="text-xs text-muted-foreground">Floors</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{tree.reduce((s, b) => s + b.floors.reduce((s2, f) => s2 + f.rooms.length, 0), 0)}</p>
                <p className="text-xs text-muted-foreground">Rooms</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{totalItems}</p>
                <p className="text-xs text-muted-foreground">Items</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{totalComplete}</p>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={overallPct} className="h-2 w-32" />
              <span className="text-sm font-medium">{overallPct}%</span>
              <Button size="sm" onClick={() => setShowAddBuilding(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Building
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tree view */}
      {tree.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderTree className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">No buildings yet. Add your first building to get started.</p>
            <Button onClick={() => setShowAddBuilding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Building
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tree.map(building => {
            const isBExpanded = expandedBuildings.has(building.id)
            const bItems = building.floors.flatMap(f => [...f.installationItems, ...f.rooms.flatMap(r => r.items)])
            const bTotal = bItems.length
            const bComplete = bItems.filter(i => i.status === 'complete').length
            const bPct = bTotal > 0 ? Math.round(bItems.reduce((s, i) => s + i.percent, 0) / bTotal) : 0

            return (
              <Card key={building.id} className="overflow-hidden">
                {/* Building header */}
                <div
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 cursor-pointer hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-colors"
                  onClick={() => toggleBuilding(building.id)}
                >
                  <div className="flex items-center gap-3">
                    {isBExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    <Building2 className="h-5 w-5 text-blue-600" />
                    {editingBuilding === building.id ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <Input className="h-7 w-32 text-sm" value={editBuildingName} onChange={e => setEditBuildingName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditBuilding(building.id); if (e.key === 'Escape') setEditingBuilding(null) }} autoFocus />
                        <Button size="sm" className="h-7" onClick={() => saveEditBuilding(building.id)}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingBuilding(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <span className="font-semibold text-lg">{building.name}</span>
                    )}
                    <Badge variant="secondary">{bTotal} items</Badge>
                    {bTotal > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={bPct} className="h-1.5 w-20" />
                        <span className="text-xs text-muted-foreground">{bPct}%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingBuilding(building.id); setEditBuildingName(building.name) }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setConfirmDelete({ type: 'building', id: building.id, label: building.name })}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowAddFloor(building.id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Floors */}
                {isBExpanded && (
                  <div className="border-t">
                    {building.floors.map(floor => {
                      const isFExpanded = expandedFloors.has(floor.id)
                      const roomItems = floor.rooms.flatMap(r => r.items)
                      const fAllItems = [...floor.installationItems, ...roomItems]
                      const fTotal = fAllItems.length
                      const fPct = fTotal > 0 ? Math.round(fAllItems.reduce((s, i) => s + i.percent, 0) / fTotal) : 0

                      return (
                        <div key={floor.id}>
                          <div
                            className="flex items-center justify-between pl-10 pr-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors border-b"
                            onClick={() => toggleFloor(floor.id)}
                          >
                            <div className="flex items-center gap-3">
                              {isFExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <Layers className="h-4 w-4 text-indigo-500" />
                              {editingFloor === floor.id ? (
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  <Input className="h-7 w-40 text-sm" value={editFloorName} onChange={e => setEditFloorName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveEditFloor(floor.id); if (e.key === 'Escape') setEditingFloor(null) }} autoFocus />
                                  <Button size="sm" className="h-7" onClick={() => saveEditFloor(floor.id)}>Save</Button>
                                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingFloor(null)}><X className="h-3 w-3" /></Button>
                                </div>
                              ) : (
                                <span className="font-medium">{floor.name}</span>
                              )}
                              <Badge variant="outline" className="text-xs">{fTotal} items</Badge>
                              {fTotal > 0 && (
                                <div className="flex items-center gap-2">
                                  <Progress value={fPct} className="h-1 w-16" />
                                  <span className="text-xs text-muted-foreground">{fPct}%</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditingFloor(floor.id); setEditFloorName(floor.name) }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setConfirmDelete({ type: 'floor', id: floor.id, label: `${building.name} → ${floor.name}` })}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowAddRoom(floor.id)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Rooms + loose items under floor */}
                          {isFExpanded && (
                            <div className="pl-16 pr-4 pb-3">
                              {/* Rooms */}
                              {floor.rooms.map(room => {
                                const isRExpanded = expandedRooms.has(room.id)
                                const rStats = floorStats(room.items)

                                return (
                                  <div key={room.id} className="mt-2">
                                    <div
                                      className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/30 cursor-pointer transition-colors"
                                      onClick={() => toggleRoom(room.id)}
                                    >
                                      <div className="flex items-center gap-2">
                                        {isRExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                        <DoorOpen className="h-4 w-4 text-emerald-500" />
                                        {editingRoom === room.id ? (
                                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <Input className="h-7 w-40 text-sm" value={editRoomName} onChange={e => setEditRoomName(e.target.value)}
                                              onKeyDown={e => { if (e.key === 'Enter') saveEditRoom(room.id); if (e.key === 'Escape') setEditingRoom(null) }} autoFocus />
                                            <Button size="sm" className="h-7" onClick={() => saveEditRoom(room.id)}>Save</Button>
                                            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingRoom(null)}><X className="h-3 w-3" /></Button>
                                          </div>
                                        ) : (
                                          <span className="font-medium text-sm">{room.name}</span>
                                        )}
                                        <Badge variant="outline" className="text-[10px]">{rStats.total} items</Badge>
                                        {rStats.total > 0 && (
                                          <div className="flex items-center gap-1">
                                            <Progress value={rStats.pct} className="h-1 w-12" />
                                            <span className="text-[10px] text-muted-foreground">{rStats.pct}%</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setEditingRoom(room.id); setEditRoomName(room.name) }}>
                                          <Pencil className="h-2.5 w-2.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setConfirmDelete({ type: 'room', id: room.id, label: `${building.name} → ${floor.name} → ${room.name}` })}>
                                          <Trash2 className="h-2.5 w-2.5 text-destructive" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setShowAddItem(room.id); setAddItemTarget({ floorId: floor.id, roomId: room.id }) }}>
                                          <Plus className="h-2.5 w-2.5" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Items grouped by type inside room */}
                                    {isRExpanded && (
                                      <div className="pl-8">
                                        {room.items.length === 0 ? (
                                          <p className="text-xs text-muted-foreground py-2 text-center">No items yet.</p>
                                        ) : (
                                          groupItemsByType(room.items).map(group => (
                                            <div key={group.type.id} className="mt-2">
                                              <div className="flex items-center gap-2 mb-1">
                                                <Settings2 className="h-3 w-3 text-amber-500" />
                                                <span className="text-xs font-medium text-muted-foreground">{group.type.name}</span>
                                                <Badge variant="outline" className="text-[9px]">{group.type.code}</Badge>
                                              </div>
                                              <div className="space-y-1 pl-3 border-l-2 border-muted">
                                                {group.items.map(item => (
                                                  <ItemRow
                                                    key={item.id}
                                                    item={item}
                                                    expanded={expandedItem === item.id}
                                                    onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                                    onEdit={fetchTree}
                                                    onWorkflow={() => openWorkflow(item)}
                                                    onDelete={() => setConfirmDelete({ type: 'item', id: item.id, label: item.code })}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}

                              {/* Items not in any room */}
                              {floor.installationItems.length > 0 && (
                                <div className="mt-3">
                                  {floor.rooms.length > 0 && (
                                    <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                                      <span className="text-[10px] uppercase tracking-wider">General</span>
                                    </div>
                                  )}
                                  {groupItemsByType(floor.installationItems).map(group => (
                                    <div key={group.type.id} className="mt-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Settings2 className="h-3 w-3 text-amber-500" />
                                        <span className="text-xs font-medium text-muted-foreground">{group.type.name}</span>
                                        <Badge variant="outline" className="text-[9px]">{group.type.code}</Badge>
                                      </div>
                                      <div className="space-y-1 pl-3 border-l-2 border-muted">
                                        {group.items.map(item => (
                                          <ItemRow
                                            key={item.id}
                                            item={item}
                                            expanded={expandedItem === item.id}
                                            onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                            onEdit={fetchTree}
                                            onWorkflow={() => openWorkflow(item)}
                                            onDelete={() => setConfirmDelete({ type: 'item', id: item.id, label: item.code })}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {floor.rooms.length === 0 && floor.installationItems.length === 0 && (
                                <p className="text-sm text-muted-foreground py-4 text-center">No rooms or items yet. Click + to add a room.</p>
                              )}

                              {/* Add room inline */}
                              {showAddRoom === floor.id && (
                                <div className="mt-2 p-3 border rounded-lg bg-muted/30">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs whitespace-nowrap">Room name:</Label>
                                    <Input className="h-7 flex-1 text-xs" placeholder="Bed1, Wellness, Lobby..." value={newRoomName} onChange={e => setNewRoomName(e.target.value)} autoFocus
                                      onKeyDown={e => { if (e.key === 'Enter') addRoom(floor.id); if (e.key === 'Escape') { setShowAddRoom(null); setNewRoomName('') } }} />
                                    <Button size="sm" className="h-7 text-xs" onClick={() => addRoom(floor.id)}>Add</Button>
                                    <Button size="sm" variant="ghost" className="h-7" onClick={() => { setShowAddRoom(null); setNewRoomName('') }}><X className="h-3 w-3" /></Button>
                                  </div>
                                </div>
                              )}

                              {/* Add item inline */}
                              {showAddItem && addItemTarget?.floorId === floor.id && (
                                <div className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs font-medium">Add Item to {floor.name}{addItemTarget.roomId ? ` → ${floor.rooms.find(r => r.id === addItemTarget.roomId)?.name ?? ''}` : ''}</Label>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setShowAddItem(null); setAddItemTarget(null) }}><X className="h-3 w-3" /></Button>
                                  </div>
                                  <div className="grid gap-2 md:grid-cols-4">
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Code *</Label>
                                      <Input className="h-7 text-xs" placeholder="GFr001" value={newItemCode} onChange={e => setNewItemCode(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Type *</Label>
                                      <Select value={newItemTypeId} onValueChange={setNewItemTypeId}>
                                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Type..." /></SelectTrigger>
                                        <SelectContent>
                                          {itemTypes.map(it => <SelectItem key={it.id} value={it.id}>{it.code} — {it.name}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Description</Label>
                                      <Input className="h-7 text-xs" placeholder="Optional..." value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                                    </div>
                                    <div className="flex items-end gap-2">
                                      <label className="flex items-center gap-1.5 text-xs">
                                        <input type="checkbox" checked={newItemVariation} onChange={e => setNewItemVariation(e.target.checked)} className="rounded" />
                                        VO
                                      </label>
                                      <div className="flex-1" />
                                      <Button size="sm" className="h-7 text-xs" onClick={() => addItem(addItemTarget.floorId, addItemTarget.roomId)}>
                                        <Plus className="h-3 w-3 mr-1" /> Add
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Inline add floor form */}
                    {showAddFloor === building.id && (
                      <div className="pl-10 pr-4 py-3 border-t bg-muted/10">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Floor name:</Label>
                          <Input className="h-7 w-40 text-xs" placeholder="Ground Floor" value={newFloorName} onChange={e => setNewFloorName(e.target.value)} autoFocus />
                          <Label className="text-xs whitespace-nowrap">Order:</Label>
                          <Input className="h-7 w-16 text-xs" type="number" min={0} value={newFloorSort} onChange={e => setNewFloorSort(Number(e.target.value))} />
                          <Button size="sm" className="h-7 text-xs" onClick={() => addFloor(building.id)}>Add</Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowAddFloor(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Add building dialog */}
      <Dialog open={showAddBuilding} onOpenChange={setShowAddBuilding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Building</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Building Name / Number</Label>
              <Input placeholder="e.g. A0, A7" value={newBuildingName} onChange={e => setNewBuildingName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addBuilding() }} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBuilding(false)}>Cancel</Button>
            <Button onClick={addBuilding} disabled={!newBuildingName.trim()}>Add Building</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{confirmDelete?.label}</strong>? This will also remove all nested items. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (!confirmDelete) return
              if (confirmDelete.type === 'building') deleteBuilding(confirmDelete.id)
              else if (confirmDelete.type === 'floor') deleteFloor(confirmDelete.id)
              else if (confirmDelete.type === 'room') deleteRoom(confirmDelete.id)
              else if (confirmDelete.type === 'item') deleteItem(confirmDelete.id)
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow dialog */}
      <Dialog open={!!showWorkflow} onOpenChange={() => setShowWorkflow(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline">{showWorkflow?.itemType?.code}</Badge>
              {showWorkflow?.code} — Workflow
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {wfSteps.map((step, index) => (
              <div key={step.id || index} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(step.status)}
                  <span className="text-sm font-medium">{step.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={step.status} onValueChange={(v) => updateWfStepStatus(index, v)}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteWfStep(step.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input className="h-8 text-sm" placeholder="Add step..." value={newStepName} onChange={e => setNewStepName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addWorkflowStep() }} />
              <Button size="sm" className="h-8" onClick={addWorkflowStep}><Plus className="h-3 w-3 mr-1" /> Add</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkflow(null)}>Cancel</Button>
            <Button onClick={saveWorkflowProgress}>Save Progress</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
