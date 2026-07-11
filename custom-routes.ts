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

app.post('/sheets/import', async (c) => {
  if (!syncConfig.scriptUrl) return c.json({ ok: false, error: 'No Google Sheet URL configured' }, 400)

  try {
    const res = await fetch(syncConfig.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'import' }),
      redirect: 'follow'
    })
    const text = await res.text()
    let result: any
    try { result = JSON.parse(text) } catch { return c.json({ ok: false, error: 'Invalid response from Google Sheet' }, 502) }

    if (!result.sheets) return c.json({ ok: false, error: 'No sheet data returned' }, 502)

    const imported = { buildings: 0, floors: 0, rooms: 0, items: 0 }

    // Cache for created/found entities
    const buildingCache: Record<string, string> = {}
    const floorCache: Record<string, string> = {}
    const roomCache: Record<string, string> = {}
    const itemTypeCache: Record<string, string> = {}

    async function getOrCreateBuilding(name: string, typeName?: string): Promise<string | null> {
      if (!name) return null
      const cacheKey = name.trim()
      if (buildingCache[cacheKey]) return buildingCache[cacheKey]
      let building = await prisma.building.findFirst({ where: { name: cacheKey } })
      if (!building) {
        let btId = ''
        if (typeName) {
          const bt = await getOrCreateItemType(typeName)
          btId = bt || ''
        }
        building = await prisma.building.create({ data: { name: cacheKey, buildingTypeId: btId } })
        imported.buildings++
      }
      buildingCache[cacheKey] = building.id
      return building.id
    }

    async function getOrCreateFloor(name: string, buildingId: string): Promise<string | null> {
      if (!name || !buildingId) return null
      const cacheKey = `${buildingId}:${name.trim()}`
      if (floorCache[cacheKey]) return floorCache[cacheKey]
      let floor = await prisma.floor.findFirst({ where: { name: name.trim(), buildingId } })
      if (!floor) {
        floor = await prisma.floor.create({ data: { name: name.trim(), buildingId, sortOrder: 0 } })
        imported.floors++
      }
      floorCache[cacheKey] = floor.id
      return floor.id
    }

    async function getOrCreateRoom(name: string, floorId: string): Promise<string | null> {
      if (!name || !floorId) return null
      const cacheKey = `${floorId}:${name.trim()}`
      if (roomCache[cacheKey]) return roomCache[cacheKey]
      let room = await prisma.room.findFirst({ where: { name: name.trim(), floorId } })
      if (!room) {
        room = await prisma.room.create({ data: { name: name.trim(), floorId } })
        imported.rooms++
      }
      roomCache[cacheKey] = room.id
      return room.id
    }

    async function getOrCreateItemType(name: string): Promise<string | null> {
      if (!name) return null
      const cacheKey = name.trim()
      if (itemTypeCache[cacheKey]) return itemTypeCache[cacheKey]
      let type = await prisma.itemType.findFirst({ where: { name: cacheKey } })
      if (!type) {
        type = await prisma.itemType.create({ data: { code: cacheKey.substring(0, 10).toUpperCase(), name: cacheKey } })
      }
      itemTypeCache[cacheKey] = type.id
      return type.id
    }

    // Import from a single "Data" sheet with columns:
    // Building | Floor | Room | Item Code | Item Name | Item Type | Status | Percent | Notes
    if (result.sheets.data) {
      for (const row of result.sheets.data) {
        const buildingName = (row.building || '').trim()
        const floorName = (row.floor || '').trim()
        const roomName = (row.room || '').trim()
        const itemCode = (row.code || '').trim()
        const itemName = (row.name || '').trim()
        const typeName = (row.type || '').trim()

        // Skip empty rows
        if (!buildingName && !itemCode && !itemName) continue

        // Build hierarchy: building -> floor -> room
        let buildingId: string | null = null
        if (buildingName) buildingId = await getOrCreateBuilding(buildingName, typeName || undefined)

        let floorId: string | null = null
        if (floorName && buildingId) floorId = await getOrCreateFloor(floorName, buildingId)

        let roomId: string | null = null
        if (roomName && floorId) roomId = await getOrCreateRoom(roomName, floorId)

        // Create item if we have at least a code or name and a floor
        if ((itemCode || itemName) && floorId) {
          const itemTypeId = typeName ? await getOrCreateItemType(typeName) : ''
          const data = {
            code: itemCode || ('IMP-' + Date.now()),
            name: itemName || '',
            status: (row.status || 'not_started').toLowerCase(),
            percent: typeof row.percent === 'number' ? row.percent : parseInt(row.percent) || 0,
            floorId,
            roomId: roomId || undefined,
            itemTypeId: itemTypeId || undefined,
            notes: (row.notes || '').trim() || undefined,
          }

          // Check for existing item by code
          let existing = null
          if (itemCode) existing = await prisma.installationItem.findFirst({ where: { code: itemCode } })

          if (existing) {
            await prisma.installationItem.update({ where: { id: existing.id }, data })
          } else {
            await prisma.installationItem.create({ data })
          }
          imported.items++
        }
      }
    }

    return c.json({ ok: true, imported })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

export default app
