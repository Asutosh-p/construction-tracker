import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Filter, Search, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ItemDetail {
  id: string
  code: string
  name?: string
  status: string
  percent: number
  isVariation: boolean
  floor: { name: string; building: { name: string } }
  itemType: { code: string; name: string }
  workflowSteps: { id: string; name: string; status: string; percent: number }[]
}

export default function Reports() {
  const [items, setItems] = useState<ItemDetail[]>([])
  const [filteredItems, setFilteredItems] = useState<ItemDetail[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterBuilding, setFilterBuilding] = useState<string>('all')
  const [filterFloor, setFilterFloor] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterItemType, setFilterItemType] = useState<string>('all')

  const tableRef = useRef<HTMLTableElement>(null)

  useEffect(() => { fetchItems() }, [])
  useEffect(() => { setFilterFloor('all') }, [filterBuilding])
  useEffect(() => { applyFilters() }, [items, searchTerm, filterBuilding, filterFloor, filterStatus, filterItemType])

  async function fetchItems() {
    const res = await fetch('/api/items/details')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  function applyFilters() {
    let result = [...items]
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(item =>
        item.code.toLowerCase().includes(term) ||
        item.floor.name.toLowerCase().includes(term) ||
        item.floor.building.name.toLowerCase().includes(term) ||
        item.itemType.name.toLowerCase().includes(term)
      )
    }
    if (filterBuilding !== 'all') result = result.filter(item => item.floor.building.name === filterBuilding)
    if (filterFloor !== 'all') result = result.filter(item => item.floor.name === filterFloor)
    if (filterStatus !== 'all') result = result.filter(item => item.status === filterStatus)
    if (filterItemType !== 'all') result = result.filter(item => item.itemType.code === filterItemType)
    setFilteredItems(result)
  }

  function exportToExcel() {
    const ws_data: (string | number)[][] = [
      ['Building', 'Floor', 'Item Code', 'Item Name', 'Item Type', 'Status', 'Progress %', 'Variation', 'Workflow Steps']
    ]
    for (const item of filteredItems) {
      ws_data.push([
        item.floor.building.name,
        item.floor.name,
        item.code,
        item.name || '',
        `${item.itemType.code} — ${item.itemType.name}`,
        item.status === 'complete' ? 'Complete' : item.status === 'in_progress' ? 'In Progress' : 'Not Started',
        item.percent,
        item.isVariation ? 'Yes' : 'No',
        item.workflowSteps.map(s => `${s.name}: ${s.status === 'complete' ? 'Done' : s.status === 'in_progress' ? 'In Progress' : 'Not Started'}`).join('; ')
      ])
    }
    const ws = XLSX.utils.aoa_to_sheet(ws_data)
    ws['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 50 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Progress Report')
    XLSX.writeFile(wb, `progress_report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function getStatusBadge(status: string) {
    if (status === 'complete') return <Badge className="bg-green-500">Complete</Badge>
    if (status === 'in_progress') return <Badge className="bg-blue-500">In Progress</Badge>
    return <Badge variant="secondary">Not Started</Badge>
  }

  const buildings = useMemo(() => [...new Set(items.map(i => i.floor.building.name))], [items])
  const floors = useMemo(() => {
    const filtered = filterBuilding !== 'all' ? items.filter(i => i.floor.building.name === filterBuilding) : items
    return [...new Set(filtered.map(i => i.floor.name))]
  }, [items, filterBuilding])
  const itemTypes = useMemo(() => {
    const seen = new Map<string, { code: string; name: string }>()
    for (const i of items) {
      if (!seen.has(i.itemType.code)) seen.set(i.itemType.code, i.itemType)
    }
    return Array.from(seen.values())
  }, [items])

  const totalItems = filteredItems.length
  const completedItems = filteredItems.filter(i => i.status === 'complete').length
  const inProgressItems = filteredItems.filter(i => i.status === 'in_progress').length
  const notStartedItems = filteredItems.filter(i => i.status === 'not_started').length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalItems}</p><p className="text-sm text-muted-foreground">Total Items</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-green-600">{completedItems}</p><p className="text-sm text-muted-foreground">Completed</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-blue-600">{inProgressItems}</p><p className="text-sm text-muted-foreground">In Progress</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-gray-600">{notStartedItems}</p><p className="text-sm text-muted-foreground">Not Started</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</CardTitle>
            <Button onClick={exportToExcel} variant="outline"><FileSpreadsheet className="h-4 w-4 mr-2" /> Export to Excel</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Building</Label>
              <Select value={filterBuilding} onValueChange={setFilterBuilding}>
                <SelectTrigger><SelectValue placeholder="All buildings" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buildings</SelectItem>
                  {buildings.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Floor</Label>
              <Select value={filterFloor} onValueChange={setFilterFloor}>
                <SelectTrigger><SelectValue placeholder="All floors" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Floors</SelectItem>
                  {floors.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select value={filterItemType} onValueChange={setFilterItemType}>
                <SelectTrigger><SelectValue placeholder="All items" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Item Types</SelectItem>
                  {itemTypes.map(it => <SelectItem key={it.code} value={it.code}>{it.code} — {it.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Results ({filteredItems.length} items)</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No items match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table ref={tableRef}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Building</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Variation</TableHead>
                    <TableHead>Workflow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.floor.building.name}</TableCell>
                      <TableCell>{item.floor.name}</TableCell>
                      <TableCell>{item.code}</TableCell>
                      <TableCell><Badge variant="outline">{item.itemType.code}</Badge></TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={item.percent} className="h-2 w-16" />
                          <span className="text-sm">{item.percent}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.isVariation && <Badge variant="secondary">VO</Badge>}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {item.workflowSteps.slice(0, 3).map(step => (
                            <Badge key={step.id} variant={step.status === 'complete' ? 'default' : 'secondary'} className="text-xs">
                              {step.name.substring(0, 10)}...
                            </Badge>
                          ))}
                          {item.workflowSteps.length > 3 && <Badge variant="outline" className="text-xs">+{item.workflowSteps.length - 3}</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
