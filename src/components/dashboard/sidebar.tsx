"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Tags, Settings, LogOut, PanelLeftClose, PanelLeftOpen, Terminal, Bug, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  mobileOpen?: boolean
  setMobileOpen?: (open: boolean) => void
}

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/leads", icon: Target, label: "All Leads" },
  { href: "/dashboard/groups", icon: Users, label: "Groups" },
  { href: "/dashboard/keywords", icon: Tags, label: "Keywords" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  { href: "/dashboard/debug", icon: Terminal, label: "Debug Mode" },
]

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div
      className={cn(
        "flex flex-col border-r border-border bg-background transition-transform duration-300 h-full",
        "fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 lg:transition-all",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 border-b border-border shrink-0">
        {!collapsed && (
          <Link href="/dashboard" className="font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <img src="/gs.webp" alt="GroupScout" className="size-7 rounded-lg object-contain" />
            <span className="text-base font-bold">GroupScout</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <img src="/gs.webp" alt="GroupScout" className="size-7 rounded-lg object-contain" />
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen?.(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="size-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border flex flex-col gap-2">
        <Button
          variant="ghost"
          className={cn("w-full justify-start", collapsed && "justify-center px-0")}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4 mr-2" />}
          {!collapsed && <span>Collapse</span>}
        </Button>
        <Button
          variant="ghost"
          className={cn("w-full justify-start text-muted-foreground hover:text-destructive", collapsed && "justify-center px-0")}
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" })
            window.location.href = "/login"
          }}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className={cn("size-4", !collapsed && "mr-2")} />
          {!collapsed && <span>Sign out</span>}
        </Button>
      </div>
    </div>
  )
}
