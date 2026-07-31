import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "50")
  const page = parseInt(searchParams.get("page") || "0")
  const relevantParam = searchParams.get("relevant")
  const viewedParam = searchParams.get("viewed")
  const searchParam = searchParams.get("search")
  
  const whereClause: Prisma.PostWhereInput = { userId: session.user.id }
  if (relevantParam === "true") whereClause.relevant = true
  if (relevantParam === "false") whereClause.relevant = false
  if (viewedParam === "true") whereClause.viewed = true
  if (viewedParam === "false") whereClause.viewed = false
  
  if (searchParam) {
    whereClause.OR = [
      { content: { contains: searchParam } },
      { keyword: { contains: searchParam } },
      { group: { name: { contains: searchParam } } }
    ]
  }

  try {
    const skip = page > 0 ? (page - 1) * limit : 0
    
    if (searchParams.has("page")) {
      const [posts, totalCount] = await Promise.all([
        prisma.post.findMany({
          where: whereClause,
          include: { group: true },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: skip,
        }),
        prisma.post.count({ where: whereClause })
      ])
      return NextResponse.json({ posts, totalCount })
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      include: { group: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: skip,
    })
    return NextResponse.json(posts)
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
