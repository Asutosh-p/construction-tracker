// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 Shogo Technologies, Inc.

import { Hono } from 'hono'
import { prisma } from './src/lib/db'

const app = new Hono()

// Dashboard stats endpoint — derives status from workflow steps (same logic as QuickEntry & BuildingNavigator)
app.get('/dashboard/stats', async (c) => {
  const totalBuildings = await prisma.building.count()
  const totalFloors = await prisma.floor.count()

  const items = await prisma.installationItem.findMany({
    include: {
      floor: { include: { building: true } },
      itemType: true,
      workflowSteps: true,
    }
  })

  // Derive status from workflow steps — consistent with QuickEntry/BuildingNavigator
  function deriveItemStatus(item: { workflowSteps: { status: string }[]; status: string }) {
    const steps = item.workflowSteps
    if (steps.length === 0) return item.status // fallback to stored status if no steps
    if (steps.every(s => s.status === 'complete')) return 'complete'
    if (steps.some(s => s.status === 'in_progress' || s.status === 'complete')) return 'in_progress'
    return 'not_started'
  }

  function deriveItemPercent(item: { workflowSteps: { percent: number }[]; percent: number }) {
    const steps = item.workflowSteps
    if (steps.length === 0) return item.percent
    return Math.round(steps.reduce((sum, s) => sum + (s.percent || 0), 0) / steps.length)
  }

  const totalItems = items.length
  const completedItems = items.filter(i => deriveItemStatus(i) === 'complete').length
  const inProgressItems = items.filter(i => deriveItemStatus(i) === 'in_progress').length
  const notStartedItems = items.filter(i => deriveItemStatus(i) === 'not_started').length

  const overallPercent = totalItems > 0
    ? Math.round(items.reduce((sum, i) => sum + deriveItemPercent(i), 0) / totalItems)
    : 0

  const byBuildingMap = new Map<string, { name: string; total: number; completed: number }>()
  for (const item of items) {
    const buildingName = item.floor?.building?.name || 'Unknown'
    const existing = byBuildingMap.get(buildingName) || { name: buildingName, total: 0, completed: 0 }
    existing.total++
    if (deriveItemStatus(item) === 'complete') existing.completed++
    byBuildingMap.set(buildingName, existing)
  }

  const byBuilding = Array.from(byBuildingMap.values()).map(b => ({
    ...b,
    percent: b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0
  }))

  const byStatus = [
    { name: 'Completed', value: completedItems, color: '#22c55e' },
    { name: 'In Progress', value: inProgressItems, color: '#3b82f6' },
    { name: 'Not Started', value: notStartedItems, color: '#94a3b8' }
  ]

  return c.json({
    totalBuildings,
    totalFloors,
    totalAreas: 0,
    totalItems,
    completedItems,
    inProgressItems,
    notStartedItems,
    overallPercent,
    byBuilding,
    byStatus
  })
})

// Items with full details for reports
app.get('/items/details', async (c) => {
  const items = await prisma.installationItem.findMany({
    include: {
      floor: {
        include: {
          building: true
        }
      },
      itemType: true,
      workflowSteps: {
        orderBy: { sortOrder: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const shaped = items.map(item => ({
    id: item.id,
    code: item.code,
    name: item.name,
    status: item.status,
    percent: item.percent,
    isVariation: item.isVariation,
    floor: {
      name: item.floor.name,
      building: { name: item.floor.building.name }
    },
    itemType: { code: item.itemType.code, name: item.itemType.name },
    workflowSteps: item.workflowSteps.map(s => ({ id: s.id, name: s.name, status: s.status, percent: s.percent }))
  }))

  return c.json(shaped)
})

// Tree data for navigator (includes rooms)
app.get('/tree', async (c) => {
  const buildings = await prisma.building.findMany({
    include: {
      floors: {
        orderBy: { sortOrder: 'asc' },
        include: {
          rooms: {
            orderBy: { name: 'asc' },
            include: {
              items: {
                include: {
                  itemType: true,
                  workflowSteps: { orderBy: { sortOrder: 'asc' } }
                },
                orderBy: { code: 'asc' }
              }
            }
          },
          installationItems: {
            where: { roomId: null },
            include: {
              itemType: true,
              workflowSteps: { orderBy: { sortOrder: 'asc' } }
            },
            orderBy: { code: 'asc' }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  })

  return c.json(buildings)
})

// Seed PILLERS project data
app.post('/seed', async (c) => {
  // Check if already seeded
  const existingBuildings = await prisma.building.count()
  if (existingBuildings > 0) {
    return c.json({ success: true, message: 'Already seeded' })
  }

  const itemTypes = [
    { code: 'GF', name: 'Doors' },
    { code: 'FCo', name: 'Curtain wall' },
    { code: 'SK', name: 'Skylight' },
  ]

  const createdTypes: Record<string, string> = {}
  for (const it of itemTypes) {
    const type = await prisma.itemType.upsert({
      where: { code: it.code },
      update: { name: it.name },
      create: it
    })
    createdTypes[it.code] = type.id
  }

  const buildings = [
    {
      name: 'A0',
      floors: [
        { name: 'GF', sortOrder: 0, categories: { GF: ['GFr001', 'GFr002'], FCo: ['FCo001', 'FCo002', 'FCo003'], SK: ['SK001', 'SK002', 'SK003'] } },
        { name: '1st Floor', sortOrder: 1, categories: { GF: ['GFr001', 'GFr002'], FCo: ['FCo001', 'FCo002', 'FCo003'], SK: ['SK001', 'SK002', 'SK003'] } },
        { name: '2nd Floor', sortOrder: 2, categories: { GF: ['GFr001', 'GFr002'], FCo: ['FCo001', 'FCo002', 'FCo003'], SK: ['SK001', 'SK002', 'SK003'] } },
      ]
    },
    {
      name: 'A7',
      floors: [
        { name: 'GF', sortOrder: 0, categories: { GF: ['GFr001', 'GFr002'], FCo: ['FCo001', 'FCo002', 'FCo003'], SK: ['SK001', 'SK002', 'SK003'] } },
        { name: '2nd', sortOrder: 1, categories: { GF: ['GFr001', 'GFr002'], FCo: ['FCo001', 'FCo002', 'FCo003'], SK: ['SK001', 'SK002', 'SK003'] } },
      ]
    }
  ]

  for (const b of buildings) {
    const building = await prisma.building.create({
      data: { name: b.name, buildingTypeId: (await prisma.buildingType.findFirst({ where: { code: 'PILLERS' } }))?.id ?? (await prisma.buildingType.create({ data: { code: 'PILLERS', name: 'Pillers Project', bedrooms: 0 } })).id }
    })

    for (const f of b.floors) {
      const floor = await prisma.floor.create({
        data: { name: f.name, buildingId: building.id, sortOrder: f.sortOrder }
      })

      for (const [typeCode, codes] of Object.entries(f.categories)) {
        for (const code of codes) {
          await prisma.installationItem.create({
            data: {
              code,
              floorId: floor.id,
              itemTypeId: createdTypes[typeCode],
              status: 'not_started',
              percent: 0,
            }
          })
        }
      }
    }
  }

  return c.json({ success: true, message: 'PILLERS project seeded' })
})

// Items with relations for Quick Entry (by floor)
app.get('/items/by-floor', async (c) => {
  const floorId = c.req.query('floorId')
  if (!floorId) return c.json({ items: [] })

  const items = await prisma.installationItem.findMany({
    where: { floorId },
    include: {
      itemType: true,
      workflowSteps: { orderBy: { sortOrder: 'asc' } }
    },
    orderBy: { code: 'asc' }
  })

  return c.json({ items })
})

// Single item with relations
app.get('/items/detail/:id', async (c) => {
  const id = c.req.param('id')
  const item = await prisma.installationItem.findUnique({
    where: { id },
    include: {
      itemType: true,
      workflowSteps: { orderBy: { sortOrder: 'asc' } }
    }
  })

  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json(item)
})

// Batch update workflow steps — auto-sets dateCompleted when status becomes 'complete'
app.post('/workflow-steps/batch', async (c) => {
  const body = await c.req.json()
  const { steps } = body as { steps: { id: string; status: string; percent: number; notes?: string }[] }

  if (!Array.isArray(steps)) {
    return c.json({ error: 'steps must be an array' }, 400)
  }

  for (const step of steps) {
    if (step.id) {
      // Fetch current step to check if status is changing to complete
      const current = await prisma.workflowStep.findUnique({ where: { id: step.id } })
      const wasComplete = current?.status === 'complete'
      const isComplete = step.status === 'complete'

      await prisma.workflowStep.update({
        where: { id: step.id },
        data: {
          status: step.status,
          percent: step.percent,
          notes: step.notes,
          // Auto-set dateCompleted when transitioning to complete
          ...(isComplete && !wasComplete ? { dateCompleted: new Date() } : {}),
          // Clear dateCompleted if moving away from complete
          ...(!isComplete && wasComplete ? { dateCompleted: null } : {}),
        }
      })
    }
  }

  return c.json({ success: true })
})

// Delete a workflow step
app.delete('/workflow-steps/:id', async (c) => {
  const id = c.req.param('id')
  await prisma.workflowStep.delete({ where: { id } })
  return c.json({ success: true })
})

// ===== Google Sheets Sync =====
import { readFileSync, writeFileSync, existsSync } from 'fs'

const CONFIG_FILE = '.shogo/sheets-config.json'
function loadSyncConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    }
  } catch {}
  return { scriptUrl: process.env.GOOGLE_SHEETS_URL || '' }
}
function saveSyncConfig(cfg: { scriptUrl: string }) {
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2))
  } catch {}
}

let syncConfig = loadSyncConfig()

app.get('/sheets/config', (c) => {
  return c.json({ scriptUrl: syncConfig.scriptUrl })
})

app.post('/sheets/config', async (c) => {
  const body = await c.req.json()
  syncConfig.scriptUrl = body.scriptUrl || ''
  saveSyncConfig(syncConfig)
  return c.json({ success: true, scriptUrl: syncConfig.scriptUrl })
})

app.get('/sheets/test', async (c) => {
  if (!syncConfig.scriptUrl) return c.json({ ok: false, error: 'No Google Sheet URL configured' }, 400)
  try {
    const res = await fetch(syncConfig.scriptUrl, { method: 'GET', redirect: 'follow' })
    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text }
    return c.json({ ok: true, status: res.status, data })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

app.post('/sheets/export', async (c) => {
  if (!syncConfig.scriptUrl) return c.json({ ok: false, error: 'No Google Sheet URL configured' }, 400)

  const buildings = await prisma.building.findMany({ include: { buildingType: true } })
  const floors = await prisma.floor.findMany({ include: { building: true } })
  const rooms = await prisma.room.findMany({ include: { floor: { include: { building: true } } } })
  const items = await prisma.installationItem.findMany({ include: { floor: { include: { building: true } }, itemType: true, workflowSteps: true } })
  const itemTypes = await prisma.itemType.findMany()

  // Derive status/percent from workflow steps — same logic as dashboard
  function deriveStatus(item: { workflowSteps: { status: string }[]; status: string }) {
    const steps = item.workflowSteps
    if (steps.length === 0) return item.status
    if (steps.every(s => s.status === 'complete')) return 'complete'
    if (steps.some(s => s.status === 'in_progress' || s.status === 'complete')) return 'in_progress'
    return 'not_started'
  }
  function derivePercent(item: { workflowSteps: { percent: number }[]; percent: number }) {
    const steps = item.workflowSteps
    if (steps.length === 0) return item.percent
    return Math.round(steps.reduce((sum, s) => sum + (s.percent || 0), 0) / steps.length)
  }

  const payload = {
    action: 'export',
    data: {
      buildings: buildings.map(b => ({ id: b.id, name: b.name, type: b.buildingType?.name || '' })),
      floors: floors.map(f => ({ id: f.id, name: f.name, building: f.building?.name || '' })),
      rooms: rooms.map(r => ({ id: r.id, name: r.name, floor: r.floor?.name || '', building: r.floor?.building?.name || '' })),
      items: items.map(i => {
        // Find last completed workflow step date as "updated date"
        const completedSteps = i.workflowSteps.filter((s: any) => s.dateCompleted)
        const lastUpdated = completedSteps.length > 0
          ? completedSteps.reduce((latest: Date, s: any) => {
              const d = new Date(s.dateCompleted)
              return d > latest ? d : latest
            }, new Date(0))
          : null
        // Format workflow steps as "Step1:Status:Date, Step2:Status:Date"
        const workflowDetails = i.workflowSteps.map((s: any) => {
          const dateStr = s.dateCompleted ? new Date(s.dateCompleted).toISOString().split('T')[0] : ''
          return `${s.name}:${s.status}${dateStr ? ':' + dateStr : ''}`
        }).join(' | ')

        return {
          id: i.id, code: i.code, name: i.name, status: deriveStatus(i), percent: derivePercent(i),
          floor: i.floor?.name || '', building: i.floor?.building?.name || '', type: i.itemType?.name || '',
          entryDate: i.entryDate ? new Date(i.entryDate).toISOString().split('T')[0] : (i.createdAt ? new Date(i.createdAt).toISOString().split('T')[0] : ''),
          updatedDate: lastUpdated ? lastUpdated.toISOString().split('T')[0] : '',
          workflowDetails,
        }
      }),
      itemTypes: itemTypes.map(t => ({ id: t.id, code: t.code, name: t.name, description: t.description || '' })),
    }
  }

  try {
    const res = await fetch(syncConfig.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    })
    const text = await res.text()
    let result: unknown
    try { result = JSON.parse(text) } catch { result = text }
    return c.json({ ok: true, data: result })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

app.post('/sheets/import', async (c) => {
  if (!syncConfig.scriptUrl) return c.json({ ok: false, error: 'No Google Sheet URL configured' }, 400)

  try {
    // Read data from Apps Script (use ?action=export which returns sheet data)
    const importUrl = syncConfig.scriptUrl.includes('script.google.com')
      ? `${syncConfig.scriptUrl}?action=export`
      : syncConfig.scriptUrl
    const res = await fetch(importUrl, { method: 'GET', redirect: 'follow' })
    const text = await res.text()
    let result: any
    try { result = JSON.parse(text) } catch { return c.json({ ok: false, error: 'Could not read data from sheet. Response: ' + text.substring(0, 200) }, 502) }

    // Handle both formats: {sheets: {buildings, floors, items}} or {sheets: {data: [...]}}
    let rows: any[] = []
    if (result.sheets?.data) {
      rows = result.sheets.data
    } else if (result.sheets?.items) {
      rows = result.sheets.items
    }
    const hasSheetArrays = !!(result.sheets?.buildings || result.sheets?.floors || result.sheets?.rooms || result.sheets?.items)
    if (rows.length === 0 && !hasSheetArrays) return c.json({ ok: false, error: 'No data found in sheet. Make sure your Apps Script has data.' }, 404)

    const imported = { buildings: 0, floors: 0, rooms: 0, items: 0 }

    // Cache maps to avoid repeated DB lookups
    const buildingMap = new Map<string, string>() // name -> id
    const floorMap = new Map<string, string>()   // "building|floor" -> id
    const roomMap = new Map<string, string>()    // "building|floor|room" -> id

    // Pre-load existing buildings
    const existingBuildings = await prisma.building.findMany()
    for (const b of existingBuildings) buildingMap.set(b.name, b.id)

    // Pre-load existing floors (BEFORE importing new ones to avoid duplicates)
    const existingFloors = await prisma.floor.findMany({ include: { building: true } })
    for (const f of existingFloors) {
      const key = `${f.building.name}|${f.name}`
      if (!floorMap.has(key)) floorMap.set(key, f.id)
    }

    // Pre-load existing rooms (BEFORE importing new ones to avoid duplicates)
    const existingRooms = await prisma.room.findMany({ include: { floor: { include: { building: true } } } })
    for (const r of existingRooms) {
      const key = `${r.floor.building.name}|${r.floor.name}|${r.name}`
      if (!roomMap.has(key)) roomMap.set(key, r.id)
    }

    // 1. Import Buildings
    if (result.sheets.buildings) {
      for (const row of result.sheets.buildings) {
        if (!row.name) continue
        let bt = null
        if (row.type) {
          bt = await prisma.buildingType.findFirst({ where: { name: row.type } })
          if (!bt) bt = await prisma.buildingType.create({ data: { code: row.type.substring(0, 10).toUpperCase(), name: row.type } })
        }
        if (buildingMap.has(row.name)) {
          await prisma.building.update({ where: { id: buildingMap.get(row.name)! }, data: { name: row.name } })
        } else {
          const created = await prisma.building.create({ data: { name: row.name, buildingTypeId: bt?.id || '' } })
          buildingMap.set(row.name, created.id)
        }
        imported.buildings++
      }
    }

    // 2. Import Floors
    if (result.sheets.floors) {
      for (const row of result.sheets.floors) {
        if (!row.name || !row.building) continue
        const bId = buildingMap.get(row.building)
        if (!bId) continue
        const key = `${row.building}|${row.name}`
        if (floorMap.has(key)) continue
        const created = await prisma.floor.create({
          data: { name: row.name, buildingId: bId, sortOrder: row.sortOrder || 0 }
        })
        floorMap.set(key, created.id)
        imported.floors++
      }
    }

    // 3. Import Rooms (if present)
    if (result.sheets.rooms) {
      for (const row of result.sheets.rooms) {
        if (!row.name || !row.floor) continue
        const fId = floorMap.get(`${row.building || ''}|${row.floor}`)
        if (!fId) continue
        const key = `${row.building || ''}|${row.floor}|${row.name}`
        if (roomMap.has(key)) continue
        const created = await prisma.room.create({
          data: { name: row.name, floorId: fId }
        })
        roomMap.set(key, created.id)
        imported.rooms++
      }
    }

    // 4. Import Items
    // Match by code+floorId combination (same code on different floors = different items)
    const itemRows = rows.length > 0 ? rows : (result.sheets.items || [])
    const skipped: { code: string; reason: string }[] = []

    if (itemRows.length > 0) {
      // Batch-load all existing items for faster lookup
      const allExisting = await prisma.installationItem.findMany()
      const existingByCodeFloor = new Map<string, string>() // "code|floorId" -> id
      for (const e of allExisting) {
        existingByCodeFloor.set(`${e.code}|${e.floorId || ''}`, e.id)
      }

      for (const row of itemRows) {
        if (!row.code && !row.name) continue

        let floorId = ''
        // Try to find floor by name (with building context)
        if (row.floor && row.building) {
          floorId = floorMap.get(`${row.building}|${row.floor}`) || ''
        }
        // Fallback: just floor name (case-insensitive)
        if (!floorId && row.floor) {
          const lowerFloor = row.floor.toLowerCase().trim()
          for (const [key, id] of floorMap.entries()) {
            const parts = key.split('|')
            const floorPart = parts[parts.length - 1] || ''
            if (floorPart.toLowerCase().trim() === lowerFloor) { floorId = id; break }
          }
        }

        let itemType = null
        if (row.type) {
          const typeName = row.type.trim()
          itemType = await prisma.itemType.findFirst({ where: { name: typeName } })
          if (!itemType) itemType = await prisma.itemType.create({ data: { code: typeName.substring(0, 10).toUpperCase(), name: typeName } })
        }

        let roomId: string | undefined = undefined
        if (row.room && floorId) {
          for (const [key, id] of roomMap.entries()) {
            if (key.includes(`|${row.room}`) && key.startsWith(`${row.building || ''}|${row.floor || ''}`)) {
              roomId = id
              break
            }
          }
        }

        // Match by code+floorId (not just code alone — same code on different floors = separate items)
        const compositeKey = `${row.code}|${floorId || ''}`
        const existingId = existingByCodeFloor.get(compositeKey)

        let entryDate: Date | undefined = undefined
        if (row.entryDate) {
          const d = new Date(row.entryDate)
          if (!isNaN(d.getTime())) entryDate = d
        }

        const data = {
          code: row.code,
          name: row.name || '',
          status: row.status || 'not_started',
          percent: typeof row.percent === 'number' ? row.percent : 0,
          floorId: floorId || undefined,
          itemTypeId: itemType?.id || '',
          roomId: roomId || undefined,
          ...(entryDate ? { entryDate } : {}),
        }

        try {
          if (existingId) {
            await prisma.installationItem.update({ where: { id: existingId }, data })
          } else {
            await prisma.installationItem.create({ data })
            existingByCodeFloor.set(compositeKey, 'new')
          }
          imported.items++
        } catch (err: any) {
          skipped.push({ code: row.code, reason: err.message || 'Unknown error' })
        }
      }
    }

    return c.json({ ok: true, imported, skipped: skipped.length > 0 ? skipped : undefined })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

export default app
