import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    let settings = await prisma.settings.findUnique({
      where: { userId: session.user.id },
    })

    if (!settings) {
      settings = await prisma.settings.create({
        data: { userId: session.user.id },
      })
    }

    return NextResponse.json({
      userId: session.user.id,
      scanInterval: settings.scanInterval,
      autoScrollPages: settings.autoScrollPages,
      scrollSpeed: settings.scrollSpeed ?? "medium",
      interGroupDelaySeconds: settings.interGroupDelaySeconds ?? 3,
      activeFrom: settings.activeFrom,
      activeTo: settings.activeTo,
      monitoringMode: settings.monitoringMode,
      maxPostAgeHours: settings.maxPostAgeHours ?? 48,
      autoDeleteViewedDays: settings.autoDeleteViewedDays ?? 30,
      groqApiKey: !!settings.groqApiKey,
      useGroq: settings.useGroq,
      groqSystemPrompt: settings.groqSystemPrompt,
    })
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { 
      scanInterval, 
      autoScrollPages, 
      scrollSpeed, 
      interGroupDelaySeconds, 
      activeFrom, 
      activeTo, 
      monitoringMode, 
      maxPostAgeHours, 
      autoDeleteViewedDays, 
      groqApiKey, 
      useGroq, 
      groqSystemPrompt 
    } = body

    const settingsData = {
      scanInterval: isNaN(scanInterval) || scanInterval === null ? 5 : scanInterval,
      autoScrollPages: isNaN(autoScrollPages) || autoScrollPages === null ? 5 : autoScrollPages,
      scrollSpeed: scrollSpeed || "medium",
      interGroupDelaySeconds: isNaN(interGroupDelaySeconds) || interGroupDelaySeconds === null ? 3 : interGroupDelaySeconds,
      activeFrom: activeFrom || "08:00",
      activeTo: activeTo || "20:00",
      monitoringMode: monitoringMode || "default",
      maxPostAgeHours: isNaN(maxPostAgeHours) || maxPostAgeHours === null ? 48 : maxPostAgeHours,
      autoDeleteViewedDays: isNaN(autoDeleteViewedDays) || autoDeleteViewedDays === null ? 30 : autoDeleteViewedDays,
    } satisfies Pick<
      Prisma.SettingsUncheckedCreateInput,
      "scanInterval" | "autoScrollPages" | "scrollSpeed" | "interGroupDelaySeconds" | "activeFrom" | "activeTo" | "monitoringMode" | "maxPostAgeHours" | "autoDeleteViewedDays"
    >

    const updateData: Prisma.SettingsUncheckedUpdateInput = { ...settingsData }
    const createData: Prisma.SettingsUncheckedCreateInput = {
      userId: session.user.id,
      ...settingsData,
    }
    
    if (useGroq !== undefined) {
      updateData.useGroq = useGroq
      createData.useGroq = useGroq
    }
    if (groqSystemPrompt) {
      updateData.groqSystemPrompt = groqSystemPrompt
      createData.groqSystemPrompt = groqSystemPrompt
    }

    if (groqApiKey) {
      updateData.groqApiKey = groqApiKey
      createData.groqApiKey = groqApiKey
    }

    const settings = await prisma.settings.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: createData,
    })

    return NextResponse.json({
      scanInterval: settings.scanInterval,
      autoScrollPages: settings.autoScrollPages,
      scrollSpeed: settings.scrollSpeed,
      interGroupDelaySeconds: settings.interGroupDelaySeconds,
      activeFrom: settings.activeFrom,
      activeTo: settings.activeTo,
      monitoringMode: settings.monitoringMode,
      maxPostAgeHours: settings.maxPostAgeHours,
      autoDeleteViewedDays: settings.autoDeleteViewedDays,
      groqApiKey: !!settings.groqApiKey,
      useGroq: settings.useGroq,
      groqSystemPrompt: settings.groqSystemPrompt,
    })
  } catch (error) {
    console.error("Settings PATCH error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
