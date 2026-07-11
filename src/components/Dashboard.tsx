import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Building2, Layers, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface DashboardStats {
  totalBuildings: number
  totalFloors: number
  totalItems: number
  completedItems: number
  inProgressItems: number
  notStartedItems: number
  overallPercent: number
  byBuilding: { name: string; total: number; completed: number; percent: number }[]
  byStatus: { name: string; value: number; color: string }[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) setStats(await res.json())
    } catch (err) { console.error('Failed to fetch stats:', err) } finally { setLoading(false) }
  }

  if (loading) return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-20 bg-muted rounded" /></CardContent></Card>)}
    </div>
  )

  if (!stats) return <Card><CardContent className="p-6 text-center text-muted-foreground">No data available. Start by seeding data from the Navigate tab.</CardContent></Card>

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card><CardContent className="p-6"><div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" /></div>
          <div><p className="text-2xl font-bold">{stats.totalBuildings}</p><p className="text-sm text-muted-foreground">Buildings</p></div>
        </div></CardContent></Card>

        <Card><CardContent className="p-6"><div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg"><Layers className="h-6 w-6 text-indigo-600 dark:text-indigo-400" /></div>
          <div><p className="text-2xl font-bold">{stats.totalFloors}</p><p className="text-sm text-muted-foreground">Floors</p></div>
        </div></CardContent></Card>

        <Card><CardContent className="p-6"><div className="flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><CheckCircle2 className="h-6 w-6 text-amber-600 dark:text-amber-400" /></div>
          <div><p className="text-2xl font-bold">{stats.totalItems}</p><p className="text-sm text-muted-foreground">Total Items</p></div>
        </div></CardContent></Card>

        <Card><CardContent className="p-6"><div className="flex items-center gap-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg"><CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" /></div>
          <div><p className="text-2xl font-bold">{stats.overallPercent}%</p><p className="text-sm text-muted-foreground">Overall Progress</p></div>
        </div></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Overall Progress</CardTitle></CardHeader><CardContent>
        <div className="space-y-4">
          <Progress value={stats.overallPercent} className="h-4" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{stats.completedItems} completed</span>
            <span>{stats.inProgressItems} in progress</span>
            <span>{stats.notStartedItems} not started</span>
          </div>
        </div>
      </CardContent></Card>

      <div className="grid gap-4 md:grid-cols-2">
        {stats.byBuilding.length > 0 && (
          <Card><CardHeader><CardTitle>Progress by Building</CardTitle></CardHeader><CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.byBuilding}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#e5e7eb" name="Total" />
                <Bar dataKey="completed" fill="#22c55e" name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        )}

        <Card><CardHeader><CardTitle>Status Distribution</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={stats.byStatus} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                {stats.byStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Quick Status</CardTitle></CardHeader><CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div><p className="text-2xl font-bold text-green-600">{stats.completedItems}</p><p className="text-sm text-muted-foreground">Completed</p></div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Clock className="h-8 w-8 text-blue-600" />
            <div><p className="text-2xl font-bold text-blue-600">{stats.inProgressItems}</p><p className="text-sm text-muted-foreground">In Progress</p></div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
            <AlertCircle className="h-8 w-8 text-gray-600" />
            <div><p className="text-2xl font-bold text-gray-600">{stats.notStartedItems}</p><p className="text-sm text-muted-foreground">Not Started</p></div>
          </div>
        </div>
      </CardContent></Card>
    </div>
  )
}
