"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { ExternalLink, Activity, Users, Target } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatExternalUrl } from "@/lib/utils"

interface Lead {
  id: string
  groupId: string
  facebookPostId: string
  keyword: string
  content: string
  url: string
  viewed: boolean
  relevant: boolean
  createdAt: string
  group: { name: string, iconUrl?: string | null }
}

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const getCompactTime = (date: string) => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000)
  if (diffInSeconds < 60) return "Just now"
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays}d ago`
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState({ leadsToday: 0, totalLeads: 0, keywordMatchesToday: 0, totalScraped: 0, status: "Offline" })
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<Lead | null>(null)

  const [statsPeriod, setStatsPeriod] = useState<"daily" | "weekly" | "monthly" | "all">("daily")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [leadsRes, statsRes] = await Promise.all([
          fetch("/api/posts?relevant=true&limit=20"),
          fetch(`/api/stats?period=${statsPeriod}`)
        ])
        if (leadsRes.ok) {
          const data = await leadsRes.json()
          setLeads(data.posts || data)
        }
        if (statsRes.ok) setStats(await statsRes.json())
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [statsPeriod])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">Monitor your high-intent Facebook Group leads.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-card/60 p-1 rounded-xl border border-border">
            {(["daily", "weekly", "monthly", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setStatsPeriod(p)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                  statsPeriod === p 
                    ? "bg-emerald-500 text-slate-950 shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "all" ? "All Time" : p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6 bg-card/50 backdrop-blur-sm border border-border/50 px-5 py-2.5 rounded-xl shadow-sm">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Engine Status</span>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {stats.status === "Active" ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-muted"></span>
                  )}
                </span>
                <span className="text-sm font-bold">
                  {stats.status === "Active" ? "Connected" : "Offline / Paused"}
                </span>
              </div>
            </div>
            
            <div className="h-8 w-px bg-border/50"></div>
            
            <Button 
              variant={stats.status === "Active" ? "destructive" : "default"} 
              size="sm"
              onClick={async () => {
                const action = stats.status === "Active" ? "stop" : "start"
                setStats(s => ({ ...s, status: action === "start" ? "Active" : "Offline" }))
                try {
                  await fetch("/api/engine", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action })
                  })
                } catch (e) {
                  console.error("Failed to toggle engine", e)
                }
              }}
            >
              {stats.status === "Active" ? "Stop Engine" : "Start Engine"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts Scanned</CardTitle>
            <Activity className="size-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{stats.totalScraped.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1 capitalize">{statsPeriod === "all" ? "All-time raw posts scanned" : `Raw posts scanned (${statsPeriod})`}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Keyword Matches</CardTitle>
            <Users className="size-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{stats.keywordMatchesToday.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1 capitalize">Keyword matches ({statsPeriod})</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified Leads</CardTitle>
            <Target className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold text-emerald-500">{stats.leadsToday.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Target leads ({statsPeriod === "all" ? "All Time" : statsPeriod}) (Total: {stats.totalLeads})</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50 flex flex-col col-span-full">
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Highest intent posts requiring action</p>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-x-auto">
        <div className="min-w-[800px]">
          <Table className="table-fixed w-full">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[140px] md:w-[200px]">Group</TableHead>
                <TableHead className="w-[80px] md:w-[120px]">Keyword</TableHead>
                <TableHead className="w-auto">Preview</TableHead>
                <TableHead className="w-[80px] md:w-[100px]">Time</TableHead>
                <TableHead className="w-[60px] md:w-[80px]">Status</TableHead>
                <TableHead className="w-[100px] md:w-[140px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No leads found yet. Ensure the engine is running and monitoring groups.
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Avatar className="size-6 rounded-md shrink-0 border border-border/50">
                          <AvatarImage src={lead.group?.iconUrl || undefined} className="object-cover" />
                          <AvatarFallback className="text-[10px] rounded-md">{lead.group?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="truncate" title={lead.group?.name}>{lead.group?.name || "Unknown Group"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs truncate max-w-[120px] block">{lead.keyword}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-0 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="truncate flex-1 text-xs text-muted-foreground" title={lead.content}>
                          {lead.content.length > 60 ? lead.content.substring(0, 60).trim() + "..." : lead.content}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => {
                            setSelectedPost(lead)
                            if (!lead.viewed) {
                              // Mark as viewed in DB
                              fetch(`/api/posts/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ viewed: true }) })
                              setLeads(leads.map(l => l.id === lead.id ? { ...l, viewed: true } : l))
                            }
                          }}
                        >
                          See more
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs font-medium">
                      {getCompactTime(lead.createdAt)}
                    </TableCell>
                    <TableCell>
                      {lead.viewed ? (
                        <Badge variant="outline" className="text-muted-foreground border-border">Viewed</Badge>
                      ) : (
                        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 border-none shadow-sm shadow-emerald-500/20 font-medium">New</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <a 
                        href={formatExternalUrl(lead.url)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5 h-8 px-3 text-xs font-medium" })}
                        onClick={() => {
                          if (!lead.viewed) {
                            fetch(`/api/posts/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ viewed: true }) })
                            setLeads(leads.map(l => l.id === lead.id ? { ...l, viewed: true } : l))
                          }
                        }}
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="size-8 rounded-md border border-border/50">
                <AvatarImage src={selectedPost?.group?.iconUrl || undefined} className="object-cover" />
                <AvatarFallback className="rounded-md">{selectedPost?.group?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <span className="text-base truncate">{selectedPost?.group?.name}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {selectedPost && formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true })}
                  {" - "}
                  Keyword: <span className="font-mono text-emerald-500">{selectedPost?.keyword}</span>
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 mt-4 text-sm leading-relaxed whitespace-pre-wrap">
            {selectedPost?.content}
          </div>
          <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-border/50">
            <Button variant="outline" onClick={() => setSelectedPost(null)}>Close</Button>
            <a 
              href={formatExternalUrl(selectedPost?.url)} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={buttonVariants({ variant: "default", className: "gap-2" })}
            >
              Open on Facebook <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
