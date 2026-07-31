"use client"

import { useEffect, useState } from "react"
import { Bell, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"

export function Header({ setMobileOpen }: { setMobileOpen?: (open: boolean) => void }) {
  const [user, setUser] = useState<{name: string, email: string} | null>(null)
  const [unreadCount, setUnreadCount] = useState<number>(0)

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/posts?viewed=false&relevant=true&limit=1")
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.totalCount || 0)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
      })
      .catch(() => {})

    fetchUnreadCount()

    // Poll unread count every 15 seconds for live in-app notifications
    const interval = setInterval(fetchUnreadCount, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="flex h-14 items-center justify-between lg:justify-end border-b border-border bg-background/50 backdrop-blur-xl px-4 sm:px-6 gap-4">
      <div className="flex lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen?.(true)} className="text-muted-foreground hover:text-foreground">
          <Menu className="size-5" />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/dashboard/leads?filter=NEW">
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground" title={`${unreadCount} New Leads`}>
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </Link>
        
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
          </div>
          <Avatar className="size-8 border border-border">
            <AvatarFallback>{user?.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
