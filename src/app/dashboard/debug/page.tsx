"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Terminal, Trash2, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface LogEvent {
  id: string
  type: string
  message: string
  metadata: string | null
  createdAt: string
}

export default function DebugPage() {
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [logTypeFilter, setLogTypeFilter] = useState("ALL")

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/logs?limit=100")
      if (res.ok) {
        setLogs(await res.json())
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = async () => {
    try {
      await fetch("/api/logs", { method: "DELETE" })
      setLogs([])
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchLogs()
    }, 0)
    const interval = setInterval(fetchLogs, 10000)
    return () => {
      window.clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [])

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "ERROR": return "bg-red-500/10 text-red-500 border-red-500/20"
      case "WARN": return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      case "SUCCESS": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      case "STATE_SYNC": return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const filteredLogs = logs.filter(log => {
    if (logTypeFilter !== "ALL" && log.type !== logTypeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!log.message.toLowerCase().includes(q) && !(log.metadata && log.metadata.toLowerCase().includes(q))) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Terminal className="h-6 w-6" /> Debug Terminal
          </h1>
          <p className="text-muted-foreground mt-1">Live event stream from the Playwright background engine.</p>
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={clearLogs} className="gap-2 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
          <Button variant="default" size="sm" onClick={fetchLogs} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search logs..." 
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={logTypeFilter} onValueChange={(v) => v && setLogTypeFilter(v)}>
            <SelectTrigger className="bg-card/60 border-border text-sm h-9 focus:ring-1 focus:ring-emerald-500">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent className="bg-card/95 border-border backdrop-blur-xl shadow-xl">
              <SelectItem value="ALL">All Levels</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
              <SelectItem value="WARN">Warning</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="STATE_SYNC">State Sync</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-black/90 text-green-400 border-border/50 font-mono text-sm overflow-hidden shadow-xl">
        <CardHeader className="border-b border-white/10 bg-black py-3">
          <CardTitle className="text-xs text-white/50 flex gap-2">
            <span className="text-red-500">●</span>
            <span className="text-yellow-500">●</span>
            <span className="text-green-500">●</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[600px] overflow-y-auto custom-scrollbar p-4 space-y-1">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-white/30 py-8">
                {loading ? "Loading logs..." : "No logs found..."}
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 hover:bg-white/5 p-1.5 rounded transition-colors group">
                  <span className="text-white/30 shrink-0 mt-0.5 text-xs">
                    [{new Date(log.createdAt).toLocaleTimeString()}]
                  </span>
                  <Badge className={`text-[10px] uppercase shrink-0 mt-0.5 ${getBadgeColor(log.type)}`}>
                    {log.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <span className="text-white/90 break-words">{log.message}</span>
                    {log.metadata && log.type !== "STATE_SYNC" && (
                      <pre className="mt-1.5 text-[10px] text-white/50 bg-black/50 p-2.5 rounded overflow-x-auto border border-white/5">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(log.metadata), null, 2)
                          } catch {
                            return String(log.metadata)
                          }
                        })()}
                      </pre>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
