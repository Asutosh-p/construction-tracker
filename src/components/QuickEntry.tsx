import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Save, CheckCircle2, Clock, Circle, AlertCircle } from 'lucide-react'

interface Building { id: string; name: string }
interface Floor { id: string; name: string }
interface ItemType { id: string; code: string; name: string }
interface WorkflowStepData {
  id?: string; name: string; sortOrder: number; status: string; percent: number; notes?: string
}
interface InstallationItem {
  id: string; code: string; name?: string; status: string; percent: number; isVariation: boolean
  itemType: { id: string; code: string; name: string }
  workflowSteps: WorkflowStepData[]
}
interface WorkflowTemplateStep { id?: string; name: string; sortOrder: number; templateId?: string; [key: string]: unknown }
interface WorkflowTemplate { id: string; name: string; itemTypeId?: string; steps: WorkflowTemplateStep[] }

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete', label: 'Done' },
]

function statusLabel(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.label ?? s
}

export default function QuickEntry() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [items, setItems] = useState<InstallationItem[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])

  const [selBuildingId, setSelBuildingId] = useState('')
  const [selFloorId, setSelFloorId] = useState('')
  const [selItemTypeId, setSelItemTypeId] = useState('')
  const [selItemId, setSelItemId] = useState('')

  const [currentItem, setCurrentItem] = useState<InstallationItem | null>(null)
  const [steps, setSteps] = useState<WorkflowStepData[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/buildings').then(r => r.ok ? r.json() : { items: [] }).then(d => setBuildings(d.items ?? []))
    fetch('/api/item-types').then(r => r.ok ? r.json() : { items: [] }).then(d => setItemTypes(d.items ?? []))
    fetchTemplates()
  }, [])

  useEffect(() => {
    if (!selBuildingId) { setFloors([]); return }
    fetch(`/api/floors?buildingId=${selBuildingId}`).then(r => r.ok ? r.json() : { items: [] }).then(d => setFloors(d.items ?? []))
  }, [selBuildingId])

  useEffect(() => {
    if (!selFloorId) { setItems([]); return }
    fetch(`/api/items/by-floor?floorId=${selFloorId}`).then(r => r.ok ? r.json() : { items: [] }).then(d => setItems(d.items ?? []))
  }, [selFloorId])

  useEffect(() => { setSelItemId(''); setCurrentItem(null); setSteps([]) }, [selItemTypeId])

  useEffect(() => {
    if (!selItemId) { setCurrentItem(null); setSteps([]); return }
    const item = items.find(i => i.id === selItemId)
    if (item) {
      setCurrentItem(item)
      if (item.workflowSteps && item.workflowSteps.length > 0) {
        setSteps(item.workflowSteps.map(s => ({ ...s })))
      } else {
        const tmpl = templates.find(t => t.itemTypeId === item.itemType?.id)
        if (tmpl && tmpl.steps.length > 0) {
          setSteps(tmpl.steps.map((s, i) => ({
            name: s.name, sortOrder: i, status: 'not_started', percent: 0
          })))
        } else {
          setSteps([])
        }
      }
    }
  }, [selItemId, items, templates])

  async function fetchTemplates() {
    const [tmplRes, stepsRes] = await Promise.all([
      fetch('/api/workflow-templates'),
      fetch('/api/workflow-template-steps')
    ])
    const tmplData = tmplRes.ok ? await tmplRes.json() : { items: [] }
    const stepsData = stepsRes.ok ? await stepsRes.json() : { items: [] }
    const allSteps = stepsData.items ?? []
    setTemplates((tmplData.items ?? []).map((t: WorkflowTemplate) => ({
      ...t,
      steps: allSteps.filter((s: WorkflowTemplateStep) => s.templateId === t.id)
    })))
  }

  function updateStepStatus(index: number, status: string) {
    setSteps(prev => prev.map((step, i) => {
      if (i !== index) return step
      const percent = status === 'complete' ? 100 : status === 'in_progress' ? 50 : 0
      return { ...step, status, percent }
    }))
  }

  function calcPercent() {
    return steps.length === 0 ? 0 : Math.round(steps.reduce((sum, s) => sum + (s.percent || 0), 0) / steps.length)
  }

  function getItemStatus() {
    if (steps.length === 0) return 'not_started'
    if (steps.every(s => s.status === 'complete')) return 'complete'
    if (steps.some(s => s.status === 'in_progress' || s.status === 'complete')) return 'in_progress'
    return 'not_started'
  }

  async function saveProgress() {
    if (!currentItem) return
    setSaving(true)
    try {
      const existingSteps = steps.filter(s => s.id)
      if (existingSteps.length > 0) {
        await fetch('/api/workflow-steps/batch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steps: existingSteps })
        })
      }
      const newSteps = steps.filter(s => !s.id)
      for (const step of newSteps) {
        await fetch('/api/workflow-steps', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: step.name, sortOrder: step.sortOrder, status: step.status, percent: step.percent, itemId: currentItem.id })
        })
      }
      await fetch(`/api/installation-items/${currentItem.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: getItemStatus(), percent: calcPercent() })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      const res = await fetch(`/api/items/detail/${currentItem.id}`)
      if (res.ok) {
        const data = await res.json()
        setCurrentItem(data)
        setSteps(data.workflowSteps?.map((s: WorkflowStepData) => ({ ...s })) ?? [])
      }
      if (selFloorId) {
        const itemsRes = await fetch(`/api/items/by-floor?floorId=${selFloorId}`)
        if (itemsRes.ok) { const d = await itemsRes.json(); setItems(d.items ?? []) }
      }
    } catch { console.error('Failed to save') } finally { setSaving(false) }
  }

  function getStatusColor(s: string) {
    if (s === 'complete') return 'bg-green-500'
    if (s === 'in_progress') return 'bg-blue-500'
    return 'bg-gray-300'
  }

  function getStatusIcon(s: string) {
    if (s === 'complete') return <CheckCircle2 className="h-5 w-5 text-green-500" />
    if (s === 'in_progress') return <Clock className="h-5 w-5 text-blue-500" />
    return <Circle className="h-5 w-5 text-gray-400" />
  }

  const overallPercent = calcPercent()
  const overallStatus = getItemStatus()
  const filteredItems = items.filter(i => !selItemTypeId || selItemTypeId === 'all' || i.itemType?.id === selItemTypeId)
  const buildingName = buildings.find(b => b.id === selBuildingId)?.name
  const floorName = floors.find(f => f.id === selFloorId)?.name

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Select Item to Update
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">1. Building</Label>
              <Select value={selBuildingId} onValueChange={(v) => { setSelBuildingId(v); setSelFloorId(''); setSelItemId(''); setSelItemTypeId(''); setItems([]); setCurrentItem(null); setSteps([]) }}>
                <SelectTrigger><SelectValue placeholder="Select building..." /></SelectTrigger>
                <SelectContent>
                  {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">2. Floor</Label>
              <div className={!selBuildingId ? 'opacity-50 pointer-events-none' : ''}>
                <Select value={selFloorId} onValueChange={(v) => { setSelFloorId(v); setSelItemId(''); setCurrentItem(null); setSteps([]) }}>
                  <SelectTrigger><SelectValue placeholder="Select floor..." /></SelectTrigger>
                  <SelectContent>
                    {floors.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">3. Item Type</Label>
              <div className={!selFloorId ? 'opacity-50 pointer-events-none' : ''}>
                <Select value={selItemTypeId} onValueChange={setSelItemTypeId}>
                  <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {itemTypes.map(it => <SelectItem key={it.id} value={it.id}>{it.code} — {it.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">4. Item</Label>
              <div className={!selFloorId ? 'opacity-50 pointer-events-none' : ''}>
                <Select value={selItemId} onValueChange={setSelItemId}>
                  <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                  <SelectContent>
                    {filteredItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selFloorId && filteredItems.length > 0 && !selItemId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Floor Items Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredItems.map(item => {
                const itemSteps = item.workflowSteps || []
                const complete = itemSteps.filter(s => s.status === 'complete').length
                const total = itemSteps.length
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSelItemId(item.id)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(item.status)}`} />
                      <Badge variant="outline" className="w-12 justify-center text-xs">{item.itemType?.code ?? '—'}</Badge>
                      <span className="font-medium text-sm">{item.code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {total > 0 && <span className="text-xs text-muted-foreground">{complete}/{total} steps</span>}
                      <div className="w-20"><Progress value={item.percent} className="h-1.5" /></div>
                      <span className="text-sm font-medium w-10 text-right">{item.percent}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {currentItem && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline">{currentItem.itemType?.code ?? '—'}</Badge>
                  {currentItem.code}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {buildingName} → {floorName}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold">{overallPercent}%</p>
                  <Progress value={overallPercent} className="h-2 w-32 mt-1" />
                </div>
                <Badge variant={overallStatus === 'complete' ? 'default' : 'secondary'} className="text-sm">
                  {statusLabel(overallStatus)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="mb-2">No workflow steps found for this item type.</p>
                <p className="text-xs">Create a workflow template in Settings → Workflows for {currentItem.itemType?.code ?? 'this type'}.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={step.id || `new-${index}`} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getStatusIcon(step.status)}
                      <span className="font-medium text-sm truncate">{step.name}</span>
                    </div>
                    <Select value={step.status} onValueChange={(v) => updateStepStatus(index, v)}>
                      <SelectTrigger className="h-9 w-36 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-end">
                  <Button onClick={saveProgress} disabled={saving} size="lg">
                    {saving ? 'Saving...' : saved ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Saved!</> : <><Save className="h-4 w-4 mr-2" /> Save Progress</>}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selBuildingId && (
        <Card><CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select a building above to start updating item progress.</p>
        </CardContent></Card>
      )}
    </div>
  )
}
