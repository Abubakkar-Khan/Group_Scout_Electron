"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { ExternalLink, Search, ChevronLeft, ChevronRight, Download, Calendar, Tag, Users, Check, ChevronDown, X } from "lucide-react"
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
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState("ALL") // ALL, today, 24h, 7d, 30d

  const [availableKeywords, setAvailableKeywords] = useState<FilterOption[]>([])
  const [availableGroups, setAvailableGroups] = useState<FilterOption[]>([])

  // Multi-select dropdown open states
  const [kwDropdownOpen, setKwDropdownOpen] = useState(false)
  const [grpDropdownOpen, setGrpDropdownOpen] = useState(false)
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)
  const [kwSearch, setKwSearch] = useState("")
  const [grpSearch, setGrpSearch] = useState("")

  const kwRef = useRef<HTMLDivElement>(null)
  const grpRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)

  const limit = 20

  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (kwRef.current && !kwRef.current.contains(event.target as Node)) {
        setKwDropdownOpen(false)
      }
      if (grpRef.current && !grpRef.current.contains(event.target as Node)) {
        setGrpDropdownOpen(false)
      }
      if (timeRef.current && !timeRef.current.contains(event.target as Node)) {
        setTimeDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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

  const lastLeadIdRef = useRef<string | null>(null)

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true)
      
      let url = `/api/posts?relevant=true&limit=${limit}&page=${page}`
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`
      if (filter === "NEW") url += `&viewed=false`
      if (filter === "VIEWED") url += `&viewed=true`
      if (selectedKeywords.length > 0) url += `&keywords=${encodeURIComponent(selectedKeywords.join(","))}`
      if (selectedGroups.length > 0) url += `&groupIds=${encodeURIComponent(selectedGroups.join(","))}`
      if (timeRange !== "ALL") url += `&timeRange=${encodeURIComponent(timeRange)}`

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const fetchedPosts: Lead[] = data.posts || []
        const newTotal: number = data.totalCount || 0

        if (isSilent && fetchedPosts.length > 0) {
          const latestId = fetchedPosts[0].id
          if (lastLeadIdRef.current && latestId !== lastLeadIdRef.current) {
            toast.success("New lead captured!", {
              description: `Keyword matched: "${fetchedPosts[0].keyword}" in ${fetchedPosts[0].group?.name || "Facebook Group"}`
            })
          }
          lastLeadIdRef.current = latestId
        } else if (fetchedPosts.length > 0) {
          lastLeadIdRef.current = fetchedPosts[0].id
        }

        setLeads(fetchedPosts)
        setTotalCount(newTotal)
      }
    } catch (e) {
      console.error(e)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchData(false)
    }, 300)

    // 5-second silent auto-polling for real-time lead updates without page refresh
    const interval = setInterval(() => {
      fetchData(true)
    }, 5000)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [page, searchQuery, filter, selectedKeywords, selectedGroups, timeRange])

  const toggleKeyword = (kwName: string) => {
    setPage(1)
    if (selectedKeywords.includes(kwName)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== kwName))
    } else {
      setSelectedKeywords([...selectedKeywords, kwName])
    }
  }

  const toggleGroup = (groupId: string) => {
    setPage(1)
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(selectedGroups.filter(g => g !== groupId))
    } else {
      setSelectedGroups([...selectedGroups, groupId])
    }
  }

  const exportCSV = async () => {
    try {
      toast.info("Preparing CSV export...")
      
      // Fetch all matching filtered leads (up to 5000) for active filters and time range
      let url = `/api/posts?relevant=true&limit=5000&page=1`
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`
      if (filter === "NEW") url += `&viewed=false`
      if (filter === "VIEWED") url += `&viewed=true`
      if (selectedKeywords.length > 0) url += `&keywords=${encodeURIComponent(selectedKeywords.join(","))}`
      if (selectedGroups.length > 0) url += `&groupIds=${encodeURIComponent(selectedGroups.join(","))}`
      if (timeRange !== "ALL") url += `&timeRange=${encodeURIComponent(timeRange)}`

      const res = await fetch(url)
      if (!res.ok) {
        toast.error("Failed to fetch leads for export")
        return
      }

      const data = await res.json()
      const allExportLeads: Lead[] = data.posts || []

      if (allExportLeads.length === 0) {
        toast.error("No leads available to export for current filters")
        return
      }

      const headers = ["Group", "Keyword", "Content", "URL", "Status", "Date"]
      const rows = allExportLeads.map(l => [
        `"${(l.group?.name || '').replace(/"/g, '""')}"`,
        `"${(l.keyword || '').replace(/"/g, '""')}"`,
        `"${(l.content || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
        `"${(l.url || '').replace(/"/g, '""')}"`,
        l.viewed ? "Viewed" : "New",
        `"${new Date(l.createdAt).toLocaleString()}"`
      ])

      // \uFEFF is UTF-8 BOM so Excel opens text without character corruption
      const csvString = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n")
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const blobUrl = URL.createObjectURL(blob)
      
      link.setAttribute("href", blobUrl)
      link.setAttribute("download", `groupscout_leads_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)

      toast.success(`Exported ${allExportLeads.length} lead(s) to CSV`)
    } catch (e) {
      console.error("Export CSV error:", e)
      toast.error("An error occurred while generating CSV export")
    }
  }

  const totalPages = Math.ceil(totalCount / limit) || 1

  const filteredKwOptions = availableKeywords.filter(k => k.name.toLowerCase().includes(kwSearch.toLowerCase()))
  const filteredGrpOptions = availableGroups.filter(g => g.name.toLowerCase().includes(grpSearch.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">All Leads</h1>
            <p className="text-muted-foreground text-sm mt-1">Filter, review, and export captured lead opportunities.</p>
          </div>

          <Button 
            onClick={exportCSV} 
            variant="outline" 
            className="gap-2 shrink-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-medium"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
        
        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 w-full pt-2">
          {/* Search bar */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search leads content..." 
              className="h-10 w-full rounded-lg border border-border bg-card/60 pl-9 pr-4 text-sm shadow-sm transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-muted-foreground text-foreground"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
            />
          </div>
          
          {/* Multi-Select Keywords Dropdown */}
          <div className="relative" ref={kwRef}>
            <button
              type="button"
              onClick={() => setKwDropdownOpen(!kwDropdownOpen)}
              className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm shadow-sm flex items-center justify-between hover:border-emerald-500/50 transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden truncate">
                <Tag className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="truncate text-foreground font-medium">
                  {selectedKeywords.length === 0 
                    ? "All Keywords" 
                    : `${selectedKeywords.length} Keyword${selectedKeywords.length > 1 ? "s" : ""}`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                {selectedKeywords.length > 0 && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedKeywords([])
                      setPage(1)
                    }}
                    className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>

            {kwDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-2 max-h-64 flex flex-col gap-1.5 min-w-[200px]">
                <div className="px-2 pt-1 pb-1">
                  <input
                    type="text"
                    placeholder="Search keywords..."
                    value={kwSearch}
                    onChange={(e) => setKwSearch(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="overflow-y-auto flex-1 space-y-0.5 max-h-40 pr-1">
                  <div
                    onClick={() => {
                      setSelectedKeywords([])
                      setPage(1)
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${selectedKeywords.length === 0 ? "bg-emerald-500/15 text-emerald-400 font-medium" : "hover:bg-muted text-foreground"}`}
                  >
                    <span>All Keywords</span>
                    {selectedKeywords.length === 0 && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                  {filteredKwOptions.map((kw) => {
                    const selected = selectedKeywords.includes(kw.name)
                    return (
                      <div
                        key={kw.id}
                        onClick={() => toggleKeyword(kw.name)}
                        className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${selected ? "bg-emerald-500/15 text-emerald-400 font-medium" : "hover:bg-muted text-foreground"}`}
                      >
                        <span className="truncate pr-2">{kw.name}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Multi-Select Groups Dropdown */}
          <div className="relative" ref={grpRef}>
            <button
              type="button"
              onClick={() => setGrpDropdownOpen(!grpDropdownOpen)}
              className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm shadow-sm flex items-center justify-between hover:border-emerald-500/50 transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden truncate">
                <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="truncate text-foreground font-medium">
                  {selectedGroups.length === 0 
                    ? "All Groups" 
                    : `${selectedGroups.length} Group${selectedGroups.length > 1 ? "s" : ""}`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                {selectedGroups.length > 0 && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedGroups([])
                      setPage(1)
                    }}
                    className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>

            {grpDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-2 max-h-64 flex flex-col gap-1.5 min-w-[200px]">
                <div className="px-2 pt-1 pb-1">
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={grpSearch}
                    onChange={(e) => setGrpSearch(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="overflow-y-auto flex-1 space-y-0.5 max-h-40 pr-1">
                  <div
                    onClick={() => {
                      setSelectedGroups([])
                      setPage(1)
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${selectedGroups.length === 0 ? "bg-emerald-500/15 text-emerald-400 font-medium" : "hover:bg-muted text-foreground"}`}
                  >
                    <span>All Groups</span>
                    {selectedGroups.length === 0 && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                  {filteredGrpOptions.map((grp) => {
                    const selected = selectedGroups.includes(grp.id)
                    return (
                      <div
                        key={grp.id}
                        onClick={() => toggleGroup(grp.id)}
                        className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${selected ? "bg-emerald-500/15 text-emerald-400 font-medium" : "hover:bg-muted text-foreground"}`}
                      >
                        <span className="truncate pr-2">{grp.name}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Custom Time Range Dropdown matching Keywords & Groups */}
          <div className="relative" ref={timeRef}>
            <button
              type="button"
              onClick={() => setTimeDropdownOpen(!timeDropdownOpen)}
              className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm shadow-sm flex items-center justify-between hover:border-emerald-500/50 transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden truncate">
                <Calendar className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="truncate text-foreground font-medium">
                  {timeRange === "ALL" ? "All Time" : timeRange === "today" ? "Today" : timeRange === "24h" ? "Last 24 Hours" : timeRange === "7d" ? "Last 7 Days" : "Last 30 Days"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
            </button>

            {timeDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-1.5 flex flex-col gap-0.5 min-w-[180px]">
                {[
                  { id: "ALL", label: "All Time" },
                  { id: "today", label: "Today" },
                  { id: "24h", label: "Last 24 Hours" },
                  { id: "7d", label: "Last 7 Days" },
                  { id: "30d", label: "Last 30 Days" },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setTimeRange(item.id)
                      setPage(1)
                      setTimeDropdownOpen(false)
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${timeRange === item.id ? "bg-emerald-500/15 text-emerald-400 font-medium" : "hover:bg-muted text-foreground"}`}
                  >
                    <span>{item.label}</span>
                    {timeRange === item.id && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Badges Bar */}
        {(selectedKeywords.length > 0 || selectedGroups.length > 0 || filter !== "ALL" || timeRange !== "ALL") && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-muted-foreground">Active Filters:</span>
            {selectedKeywords.map((kw) => (
              <Badge key={kw} variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <Tag className="h-3 w-3" /> {kw}
                <X className="h-3 w-3 cursor-pointer hover:text-emerald-200" onClick={() => toggleKeyword(kw)} />
              </Badge>
            ))}
            {selectedGroups.map((gId) => {
              const grpName = availableGroups.find(g => g.id === gId)?.name || gId
              return (
                <Badge key={gId} variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  <Users className="h-3 w-3" /> {grpName}
                  <X className="h-3 w-3 cursor-pointer hover:text-emerald-200" onClick={() => toggleGroup(gId)} />
                </Badge>
              )
            })}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSelectedKeywords([])
                setSelectedGroups([])
                setTimeRange("ALL")
                setFilter("ALL")
                setSearchQuery("")
                setPage(1)
              }}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset all
            </Button>
          </div>
        )}
      </div>

      {/* Main Leads Table */}
      <Card className="bg-card/40 backdrop-blur-md border-border/60 flex flex-col col-span-full overflow-hidden shadow-xl">
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[850px]">
            <Table className="w-full">
              <TableHeader className="bg-muted/40 border-b border-border/50">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group</TableHead>
                  <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keyword</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview Content</TableHead>
                  <TableHead className="w-[90px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</TableHead>
                  <TableHead className="w-[80px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="w-[110px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i} className="border-border/40">
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-14 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                      No leads found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id} className="group hover:bg-muted/20 border-border/40 transition-colors">
                      <TableCell className="font-medium align-middle">
                        <div className="flex items-center gap-2.5 overflow-hidden max-w-[170px]">
                          <Avatar className="size-6 rounded-md shrink-0 border border-border/60">
                            <AvatarImage src={lead.group?.iconUrl || undefined} className="object-cover" />
                            <AvatarFallback className="text-[10px] rounded-md bg-muted text-muted-foreground font-semibold">
                              {lead.group?.name?.substring(0, 2).toUpperCase() || "FB"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs font-medium text-foreground" title={lead.group?.name}>
                            {lead.group?.name || "Facebook Group"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge variant="outline" className="font-mono text-[11px] truncate max-w-[110px] inline-block bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-medium">
                          {lead.keyword}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs text-muted-foreground max-w-[360px] block" title={lead.content}>
                            {lead.content}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[11px] px-2 opacity-80 group-hover:opacity-100 transition-opacity shrink-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            onClick={() => {
                              setSelectedPost(lead)
                              if (!lead.viewed) {
                                fetch(`/api/posts/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ viewed: true }) })
                                setLeads(leads.map(l => l.id === lead.id ? { ...l, viewed: true } : l))
                              }
                            }}
                          >
                            Preview
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs font-medium align-middle">
                        {getCompactTime(lead.createdAt)}
                      </TableCell>
                      <TableCell className="align-middle">
                        {lead.viewed ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border bg-muted/20">Viewed</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-none shadow-sm shadow-emerald-500/20 font-semibold px-2 py-0.5">
                            New
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <a 
                          href={lead.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5 h-7 px-2.5 text-xs font-medium border-border hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors" })}
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
            <div className="flex items-center justify-between border-t border-border/50 px-4 py-3 sm:px-6 bg-card/20">
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
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
                      className="rounded-l-md rounded-r-none h-8 border-border"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center px-3 text-xs font-semibold border-y border-border bg-card">
                      Page {page} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-l-none rounded-r-md h-8 border-border"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flawless Preview Modal */}
      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col bg-card/95 backdrop-blur-2xl border-border shadow-2xl p-6 rounded-2xl">
          <DialogHeader className="pb-4 border-b border-border/60">
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="size-10 rounded-lg border border-border/60 shrink-0">
                <AvatarImage src={selectedPost?.group?.iconUrl || undefined} className="object-cover" />
                <AvatarFallback className="rounded-lg bg-muted text-emerald-400 font-semibold text-sm">
                  {selectedPost?.group?.name?.substring(0, 2).toUpperCase() || "FB"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="text-base font-semibold text-foreground truncate">{selectedPost?.group?.name || "Facebook Group"}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-normal">
                  <span>{selectedPost && formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true })}</span>
                  <span>•</span>
                  <span>Keyword:</span>
                  <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-1.5 py-0">
                    {selectedPost?.keyword}
                  </Badge>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 px-1 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-sans break-words selection:bg-emerald-500/30">
            {selectedPost?.content}
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground truncate">
              ID: {selectedPost?.facebookPostId || "N/A"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setSelectedPost(null)} className="h-9 px-4 border-border text-xs">
                Close
              </Button>
              <a 
                href={selectedPost?.url || "#"} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={buttonVariants({ variant: "default", className: "gap-2 h-9 px-4 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20" })}
              >
                Open on Facebook <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
