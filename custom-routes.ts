// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 Shogo Technologies, Inc.

import { Hono } from 'hono'
import { prisma } from './src/lib/db'

const app = new Hono()

// Dashboard stats endpoint
app.get('/dashboard/stats', async (c) => {
  const totalBuildings = await prisma.building.count()
  const totalFloors = await prisma.floor.count()
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

export default app
