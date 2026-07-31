"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { ExternalLink, Search, Filter, ChevronLeft, ChevronRight, Download, Calendar, Tag, Users } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

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

interface FilterOption {
  id: string
  name: string
}

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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<Lead | null>(null)
  
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState("ALL") // ALL, NEW, VIEWED
  const [selectedKeyword, setSelectedKeyword] = useState("ALL")
  const [selectedGroup, setSelectedGroup] = useState("ALL")
  const [timeRange, setTimeRange] = useState("ALL") // ALL, today, 24h, 7d, 30d

  const [availableKeywords, setAvailableKeywords] = useState<FilterOption[]>([])
  const [availableGroups, setAvailableGroups] = useState<FilterOption[]>([])

  const limit = 20

  useEffect(() => {
    // Fetch filter options (keywords and groups)
    const fetchOptions = async () => {
      try {
        const [kwRes, grpRes] = await Promise.all([
          fetch("/api/keywords"),
          fetch("/api/groups")
        ])
        if (kwRes.ok) {
          const kws = await kwRes.json()
          setAvailableKeywords(kws.map((k: any) => ({ id: k.keyword, name: k.keyword })))
        }
        if (grpRes.ok) {
          const grps = await grpRes.json()
          setAvailableGroups(grps.map((g: any) => ({ id: g.id, name: g.name || g.facebookGroupId })))
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchOptions()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        let url = `/api/posts?relevant=true&limit=${limit}&page=${page}`
        if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`
        if (filter === "NEW") url += `&viewed=false`
        if (filter === "VIEWED") url += `&viewed=true`
        if (selectedKeyword !== "ALL") url += `&keyword=${encodeURIComponent(selectedKeyword)}`
        if (selectedGroup !== "ALL") url += `&groupId=${encodeURIComponent(selectedGroup)}`
        if (timeRange !== "ALL") url += `&timeRange=${encodeURIComponent(timeRange)}`

        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setLeads(data.posts || [])
          setTotalCount(data.totalCount || 0)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    
    const timeout = setTimeout(fetchData, 300)
    return () => clearTimeout(timeout)
  }, [page, searchQuery, filter, selectedKeyword, selectedGroup, timeRange])

  const exportCSV = () => {
    if (leads.length === 0) {
      toast.error("No leads available to export")
      return
    }

    const headers = ["Group", "Keyword", "Content", "URL", "Status", "Date"]
    const rows = leads.map(l => [
      `"${(l.group?.name || '').replace(/"/g, '""')}"`,
      `"${l.keyword.replace(/"/g, '""')}"`,
      `"${l.content.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${l.url}"`,
      l.viewed ? "Viewed" : "New",
      `"${new Date(l.createdAt).toLocaleString()}"`
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `groupscout_leads_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Leads exported to CSV")
  }

  const totalPages = Math.ceil(totalCount / limit) || 1

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Leads</h1>
            <p className="text-muted-foreground text-sm mt-1">Filter, review, and export captured lead opportunities.</p>
          </div>

          <Button onClick={exportCSV} variant="outline" className="gap-2 shrink-0 border-primary/50 text-primary hover:bg-primary/10">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
        
        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 w-full">
          {/* Search bar */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search leads content..." 
              className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-4 text-sm shadow-sm transition-all focus:ring-2 focus:ring-primary outline-none placeholder:text-muted-foreground"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
            />
          </div>
          
          {/* Keyword filter */}
          <div>
            <Select
              value={selectedKeyword}
              onValueChange={(val) => {
                if (val) setSelectedKeyword(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 bg-card border-input font-medium shadow-sm w-full">
                <div className="flex items-center gap-2 overflow-hidden truncate">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Keyword" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Keywords</SelectItem>
                {availableKeywords.map(kw => (
                  <SelectItem key={kw.id} value={kw.id}>{kw.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group filter */}
          <div>
            <Select
              value={selectedGroup}
              onValueChange={(val) => {
                if (val) setSelectedGroup(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 bg-card border-input font-medium shadow-sm w-full">
                <div className="flex items-center gap-2 overflow-hidden truncate">
                  <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Group" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Groups</SelectItem>
                {availableGroups.map(grp => (
                  <SelectItem key={grp.id} value={grp.id}>{grp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time range filter */}
          <div>
            <Select
              value={timeRange}
              onValueChange={(val) => {
                if (val) setTimeRange(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 bg-card border-input font-medium shadow-sm w-full">
                <div className="flex items-center gap-2 overflow-hidden truncate">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Time Range" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50 flex flex-col col-span-full overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
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
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No leads match your filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id} className="group hover:bg-muted/20">
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
                          <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 border-none shadow-sm shadow-indigo-500/20 font-medium">New</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <a 
                          href={lead.url} 
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
          
          {/* Pagination Controls */}
          {!loading && leads.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/50 px-4 py-3 sm:px-6">
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to{" "}
                    <span className="font-medium text-foreground">{Math.min(page * limit, totalCount)}</span> of{" "}
                    <span className="font-medium text-foreground">{totalCount}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-l-md rounded-r-none"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center px-4 text-sm font-semibold border-y border-input bg-card">
                      Page {page} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-l-none rounded-r-md"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </nav>
                </div>
              </div>
              
              {/* Mobile pagination */}
              <div className="flex flex-1 justify-between sm:hidden">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center text-sm font-medium">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
              href={selectedPost?.url || "#"} 
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
