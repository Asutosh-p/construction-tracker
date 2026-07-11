import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Plus, Trash2, Save, Settings2, FileText, Pencil as PencilIcon } from 'lucide-react'

interface ItemType { id: string; code: string; name: string; description?: string }

interface WorkflowTemplate {
  id: string; name: string; description?: string; itemTypeId?: string; isDefault: boolean
  steps: WorkflowTemplateStep[]
}
interface WorkflowTemplateStep { id?: string; name: string; sortOrder: number; templateId?: string }

export default function Settings() {
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])

  const [newTypeCode, setNewTypeCode] = useState('')
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeDesc, setNewTypeDesc] = useState('')
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [confirmDeleteType, setConfirmDeleteType] = useState<string | null>(null)
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<string | null>(null)
  const [editTypeCode, setEditTypeCode] = useState('')
  const [editTypeName, setEditTypeName] = useState('')
  const [editTypeDesc, setEditTypeDesc] = useState('')

  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateItemTypeId, setNewTemplateItemTypeId] = useState('')
  const [newTemplateDesc, setNewTemplateDesc] = useState('')
  const [newTemplateSteps, setNewTemplateSteps] = useState<string[]>([''])

  useEffect(() => { fetchItemTypes(); fetchTemplates() }, [])

  async function fetchItemTypes() { const r = await fetch('/api/item-types'); if (r.ok) { const d = await r.json(); setItemTypes(d.items ?? []) } }

  async function fetchTemplates() {
    const [tmplRes, stepsRes] = await Promise.all([fetch('/api/workflow-templates'), fetch('/api/workflow-template-steps')])
    const tmplData = tmplRes.ok ? await tmplRes.json() : { items: [] }
    const stepsData = stepsRes.ok ? await stepsRes.json() : { items: [] }
    const allSteps = stepsData.items ?? []
    setTemplates((tmplData.items ?? []).map((t: WorkflowTemplate) => ({
      ...t,
      steps: allSteps.filter((s: WorkflowTemplateStep) => s.templateId === t.id)
    })))
  }

  async function addItemType() {
    if (!newTypeCode.trim() || !newTypeName.trim()) return
    await fetch('/api/item-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: newTypeCode.trim().toUpperCase(), name: newTypeName.trim(), description: newTypeDesc.trim() || null }) })
    setNewTypeCode(''); setNewTypeName(''); setNewTypeDesc(''); await fetchItemTypes()
  }
  function startEditType(t: ItemType) { setEditingTypeId(t.id); setEditTypeCode(t.code); setEditTypeName(t.name); setEditTypeDesc(t.description || '') }
  function cancelEditType() { setEditingTypeId(null); setEditTypeCode(''); setEditTypeName(''); setEditTypeDesc('') }
  async function saveEditType(id: string) {
    if (!editTypeCode.trim() || !editTypeName.trim()) return
    await fetch(`/api/item-types/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: editTypeCode.trim().toUpperCase(), name: editTypeName.trim(), description: editTypeDesc.trim() || null }) })
    cancelEditType(); await fetchItemTypes()
  }
  async function deleteItemType(id: string) { setConfirmDeleteType(id) }
  async function confirmDeleteItemType() {
    if (!confirmDeleteType) return
    await fetch(`/api/item-types/${confirmDeleteType}`, { method: 'DELETE' })
    setConfirmDeleteType(null); await fetchItemTypes()
  }

  async function addTemplate() {
    if (!newTemplateItemTypeId || !newTemplateName.trim()) return
    const steps = newTemplateSteps.filter(s => s.trim()).map((name, i) => ({ name: name.trim(), sortOrder: i }))
    if (steps.length === 0) return
    const res = await fetch('/api/workflow-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTemplateName.trim(), description: newTemplateDesc.trim() || null, itemTypeId: newTemplateItemTypeId, isDefault: false }) })
    const data = await res.json()
    const templateId = data.data?.id
    if (templateId) {
      for (const step of steps) {
        await fetch('/api/workflow-template-steps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...step, templateId }) })
      }
    }
    setNewTemplateItemTypeId(''); setNewTemplateName(''); setNewTemplateDesc(''); setNewTemplateSteps(['']); await fetchTemplates()
  }
  async function deleteTemplate(id: string) { setConfirmDeleteTemplate(id) }
  async function confirmDeleteTemplateFn() {
    if (!confirmDeleteTemplate) return
    await fetch(`/api/workflow-templates/${confirmDeleteTemplate}`, { method: 'DELETE' })
    setConfirmDeleteTemplate(null); await fetchTemplates()
  }

  return (
    <div className="space-y-6">
      {/* Item Types */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Manage Item Types</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Define item categories like Doors, Curtain wall, Skylight.</p>
          {editingTypeId ? (
            <div className="grid gap-4 md:grid-cols-3 mb-6 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2"><Label>Code</Label><Input placeholder="GF" value={editTypeCode} onChange={(e) => setEditTypeCode(e.target.value)} maxLength={5} /></div>
              <div className="space-y-2"><Label>Name</Label><Input placeholder="Doors" value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Description</Label><Input placeholder="Optional" value={editTypeDesc} onChange={(e) => setEditTypeDesc(e.target.value)} /></div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEditType(editingTypeId)}><Save className="h-3 w-3 mr-1" /> Save</Button>
                <Button size="sm" variant="outline" onClick={cancelEditType}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="space-y-2"><Label>Code</Label><Input placeholder="GF" value={newTypeCode} onChange={(e) => setNewTypeCode(e.target.value)} maxLength={5} /></div>
              <div className="space-y-2"><Label>Name</Label><Input placeholder="Doors" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Description (optional)</Label><Input placeholder="Optional description" value={newTypeDesc} onChange={(e) => setNewTypeDesc(e.target.value)} /></div>
            </div>
          )}
          {!editingTypeId && <Button onClick={addItemType} className="mb-6"><Plus className="h-4 w-4 mr-2" /> Add Item Type</Button>}
          <Separator className="mb-4" />
          <div className="space-y-2">
            {itemTypes.map(type => (
              <div key={type.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-12 justify-center">{type.code}</Badge>
                  <div><p className="font-medium">{type.name}</p>{type.description && <p className="text-sm text-muted-foreground">{type.description}</p>}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEditType(type)}><PencilIcon className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteItemType(type.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {itemTypes.length === 0 && <p className="text-center text-muted-foreground py-4">No item types yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Templates */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Workflow Templates</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Define workflow steps for each item type. These steps will be used when updating items in Quick Entry.
          </p>
          <div className="space-y-4 mb-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Item Type</Label>
                <Select value={newTemplateItemTypeId} onValueChange={setNewTemplateItemTypeId}>
                  <SelectTrigger><SelectValue placeholder="Select item type..." /></SelectTrigger>
                  <SelectContent>
                    {itemTypes.map(it => <SelectItem key={it.id} value={it.id}>{it.code} — {it.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input placeholder="e.g. Door Installation Standard" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input placeholder="Description" value={newTemplateDesc} onChange={(e) => setNewTemplateDesc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Workflow Steps</Label>
              {newTemplateSteps.map((step, index) => (
                <div key={index} className="flex gap-2">
                  <Input placeholder={`Step ${index + 1}`} value={step} onChange={(e) => { const v = [...newTemplateSteps]; v[index] = e.target.value; setNewTemplateSteps(v) }} />
                  {newTemplateSteps.length > 1 && <Button variant="ghost" size="sm" onClick={() => setNewTemplateSteps(newTemplateSteps.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setNewTemplateSteps([...newTemplateSteps, ''])}><Plus className="h-4 w-4 mr-1" /> Add Step</Button>
            </div>
            <Button onClick={addTemplate}><Save className="h-4 w-4 mr-2" /> Save Template</Button>
          </div>
          <Separator className="mb-4" />
          <div className="space-y-4">
            {templates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No workflow templates yet. Create one above to define the installation steps for each item type.</p>
            ) : templates.map(template => (
              <div key={template.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      {template.name}
                      {template.itemTypeId && <Badge variant="outline" className="text-xs">{itemTypes.find(it => it.id === template.itemTypeId)?.code ?? template.itemTypeId}</Badge>}
                    </h3>
                    {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteTemplate(template.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(template.steps ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map((step, index) => (
                    <Badge key={step.id || index} variant="outline">{index + 1}. {step.name}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    <AlertDialog open={!!confirmDeleteType} onOpenChange={() => setConfirmDeleteType(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Item Type?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmDeleteItemType}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!!confirmDeleteTemplate} onOpenChange={() => setConfirmDeleteTemplate(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Workflow Template?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmDeleteTemplateFn}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  )
}
