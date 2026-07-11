// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 Shogo Technologies, Inc.

import { Hono } from 'hono'
import { prisma } from './src/lib/db'

const app = new Hono()

// Dashboard stats endpoint
app.get('/dashboard/stats', async (c) => {
  const totalBuildings = await prisma.building.count()
  const totalFloors = await prisma.floor.count()
  const totalRooms = await prisma.room.count()
  const totalItems = await prisma.installationItem.count()

  const items = await prisma.installationItem.findMany({
    include: {
      floor: {
        include: {
          building: true
        }
      },
      itemType: true,
    }
  })

  const completedItems = items.filter(i => i.status === 'complete').length
  const inProgressItems = items.filter(i => i.status === 'in_progress').length
  const notStartedItems = items.filter(i => i.status === 'not_started').length

  const overallPercent = totalItems > 0
    ? Math.round(items.reduce((sum, i) => sum + i.percent, 0) / totalItems)
    : 0

  const byBuildingMap = new Map<string, { name: string; total: number; completed: number }>()
  for (const item of items) {
    const buildingName = item.floor.building.name
    const existing = byBuildingMap.get(buildingName) || { name: buildingName, total: 0, completed: 0 }
    existing.total++
    if (item.status === 'complete') existing.completed++
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
    totalRooms,
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

// Batch update workflow steps
app.post('/workflow-steps/batch', async (c) => {
  const body = await c.req.json()
  const { steps } = body as { steps: { id: string; status: string; percent: number; notes?: string }[] }

  if (!Array.isArray(steps)) {
    return c.json({ error: 'steps must be an array' }, 400)
  }

  for (const step of steps) {
    if (step.id) {
      await prisma.workflowStep.update({
        where: { id: step.id },
        data: {
          status: step.status,
          percent: step.percent,
          notes: step.notes
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
let syncConfig = { scriptUrl: '' as string }

app.get('/sheets/config', (c) => {
  return c.json({ scriptUrl: syncConfig.scriptUrl })
})

app.post('/sheets/config', async (c) => {
  const body = await c.req.json()
  syncConfig.scriptUrl = body.scriptUrl || ''
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
  const items = await prisma.installationItem.findMany({ include: { floor: { include: { building: true } }, itemType: true, room: true } })
  const itemTypes = await prisma.itemType.findMany()

  const payload = {
    action: 'export',
    data: {
      buildings: buildings.map(b => ({ id: b.id, name: b.name, type: b.buildingType?.name || '' })),
      floors: floors.map(f => ({ id: f.id, name: f.name, building: f.building?.name || '' })),
      rooms: rooms.map(r => ({ id: r.id, name: r.name, floor: r.floor?.name || '', building: r.floor?.building?.name || '' })),
      items: items.map(i => ({ id: i.id, code: i.code, name: i.name, status: i.status, percent: i.percent, floor: i.floor?.name || '', building: i.floor?.building?.name || '', type: i.itemType?.name || '', room: i.room?.name || '' })),
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


  try {
    const res = await fetch(`${syncConfig.scriptUrl}?action=import`, { method: 'GET', redirect: 'follow' })
    const text = await res.text()
    let parsed: any
    try { parsed = JSON.parse(text) } catch { parsed = { raw: text.substring(0, 300) } }
    return c.json({
      fetchStatus: res.status,
      isJson: !!parsed.sheets,
      buildingCount: parsed.sheets?.buildings?.length ?? 0,
      floorCount: parsed.sheets?.floors?.length ?? 0,
      itemCount: parsed.sheets?.items?.length ?? 0,
      buildings: parsed.sheets?.buildings?.map((b: any) => b.name) || [],
      floors: parsed.sheets?.floors?.map((f: any) => f.name + ' @ ' + f.building) || [],
      items: parsed.sheets?.items?.map((i: any) => i.code + ' @ ' + i.floor) || [],
    })
  } catch (err: any) {
    return c.json({ error: err.message })
  }
})

app.post('/sheets/import', async (c) => {
  if (!syncConfig.scriptUrl) return c.json({ ok: false, error: 'No Google Sheet URL configured' }, 400)

  try {
    // Fetch data from Apps Script
    const importUrl = syncConfig.scriptUrl.includes('script.google.com')
      ? `${syncConfig.scriptUrl}?action=import`
      : syncConfig.scriptUrl
    const res = await fetch(importUrl, { method: 'GET', redirect: 'follow' })
    const text = await res.text()
    let parsed: any
    try { parsed = JSON.parse(text) } catch { return c.json({ ok: false, error: 'Could not read data from sheet' }, 502) }

    // Build flat rows from whatever format the Apps Script returns
    let rows: any[] = []
    if (parsed.sheets?.data) {
      rows = parsed.sheets.data  // New flat format: [{building, floor, room, code, name, type, status, percent}]
    } else if (parsed.sheets?.items) {
      rows = parsed.sheets.items  // Legacy format: items array with building/floor fields
    } else if (Array.isArray(parsed)) {
      rows = parsed  // Direct array
    }

    if (rows.length === 0) return c.json({ ok: true, imported: { buildings: 0, floors: 0, rooms: 0, items: 0 }, message: 'Sheet is empty' })

    const imported = { buildings: 0, floors: 0, rooms: 0, items: 0 }

    // Caches
    const buildingCache: Record<string, string> = {}
    const floorCache: Record<string, string> = {}
    const roomCache: Record<string, string> = {}
    const typeCache: Record<string, string> = {}

    // Pre-load existing data
    for (const b of await prisma.building.findMany()) buildingCache[b.name] = b.id
    for (const f of await prisma.floor.findMany({ include: { building: true } }))
      floorCache[f.building.name + '|' + f.name] = f.id
    for (const r of await prisma.room.findMany({ include: { floor: { include: { building: true } } } }))
      roomCache[r.floor.building.name + '|' + r.floor.name + '|' + r.name] = r.id
    for (const t of await prisma.itemType.findMany()) typeCache[t.name] = t.id

    for (const row of rows) {
      const bName = (row.building || '').trim()
      const fName = (row.floor || '').trim()
      const rName = (row.room || '').trim()
      const code = (row.code || '').trim()
      if (!bName && !code) continue

      // Building
      let bId = buildingCache[bName] || ''
      if (bName && !bId) {
        const b = await prisma.building.create({ data: { name: bName, buildingTypeId: '' } })
        bId = b.id
        buildingCache[bName] = b.id
        imported.buildings++
      }

      // Floor
      let fId = floorCache[bName + '|' + fName] || ''
      if (fName && bId && !fId) {
        const f = await prisma.floor.create({ data: { name: fName, buildingId: bId, sortOrder: 0 } })
        fId = f.id
        floorCache[bName + '|' + fName] = f.id
        imported.floors++
      }

      // Room
      let roomId = ''
      const roomKey = bName + '|' + fName + '|' + rName
      if (rName && fId && !roomCache[roomKey]) {
        const r = await prisma.room.create({ data: { name: rName, floorId: fId } })
        roomId = r.id
        roomCache[roomKey] = r.id
        imported.rooms++
      } else if (roomCache[roomKey]) {
        roomId = roomCache[roomKey]
      }

      // Item Type
      const typeName = (row.type || '').trim()
      let typeId = typeCache[typeName] || ''
      if (typeName && !typeId) {
        const t = await prisma.itemType.create({ data: { code: typeName.substring(0, 10).toUpperCase(), name: typeName } })
        typeId = t.id
        typeCache[typeName] = t.id
      }

      // Item
      if (!code) continue
      const status = row.status || 'not_started'
      const percent = typeof row.percent === 'number' ? row.percent : parseInt(row.percent) || 0
      const itemData = { code, name: (row.name || '').trim(), status, percent, floorId: fId, itemTypeId: typeId, roomId: roomId || undefined }
      const existing = await prisma.installationItem.findFirst({ where: { code } })
      if (existing) {
        await prisma.installationItem.update({ where: { id: existing.id }, data: itemData })
      } else if (fId) {
        await prisma.installationItem.create({ data: itemData })
      }
      imported.items++
    }

    return c.json({ ok: true, imported })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

export default app
