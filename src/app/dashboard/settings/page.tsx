"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Save, Gauge, Clock, ShieldCheck, Trash2, Zap, Sliders, Lock } from "lucide-react"

type SettingsForm = {
  userId: string
  scanInterval: string
  autoScrollPages: string
  scrollSpeed: string
  interGroupDelaySeconds: string
  activeFrom: string
  activeTo: string
  monitoringMode: string
  maxPostAgeHours: string
  autoDeleteViewedDays: string
  groqApiKey: string
  useGroq: boolean
  groqSystemPrompt: string
}

const HOURS_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hourStr = i.toString().padStart(2, '0')
  return { value: `${hourStr}:00`, label: `${i === 0 ? '12:00 AM (Midnight)' : i === 12 ? '12:00 PM (Noon)' : i < 12 ? `${i}:00 AM` : `${i - 12}:00 PM`}` }
})

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsForm>({
    userId: "",
    scanInterval: "5",
    autoScrollPages: "5",
    scrollSpeed: "medium",
    interGroupDelaySeconds: "3",
    activeFrom: "08:00",
    activeTo: "20:00",
    monitoringMode: "default",
    maxPostAgeHours: "48",
    autoDeleteViewedDays: "30",
    groqApiKey: "",
    useGroq: false,
    groqSystemPrompt: ""
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loginLaunching, setLoginLaunching] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings")
        if (res.ok) {
          const data = await res.json()
          setSettings({
            userId: data.userId || "",
            scanInterval: data.scanInterval?.toString() || "5",
            autoScrollPages: data.autoScrollPages?.toString() || "5",
            scrollSpeed: data.scrollSpeed || "medium",
            interGroupDelaySeconds: data.interGroupDelaySeconds?.toString() || "3",
            activeFrom: data.activeFrom || "08:00",
            activeTo: data.activeTo || "20:00",
            monitoringMode: data.monitoringMode || "default",
            maxPostAgeHours: data.maxPostAgeHours?.toString() || "48",
            autoDeleteViewedDays: data.autoDeleteViewedDays?.toString() || "30",
            groqApiKey: data.groqApiKey ? "********" : "",
            useGroq: data.useGroq ?? false,
            groqSystemPrompt: data.groqSystemPrompt || ""
          })
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const groqApiKey = settings.groqApiKey === "********" ? undefined : settings.groqApiKey

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanInterval: parseInt(settings.scanInterval, 10),
          autoScrollPages: parseInt(settings.autoScrollPages, 10),
          scrollSpeed: settings.scrollSpeed,
          interGroupDelaySeconds: parseInt(settings.interGroupDelaySeconds, 10),
          activeFrom: settings.activeFrom,
          activeTo: settings.activeTo,
          monitoringMode: settings.monitoringMode,
          maxPostAgeHours: parseInt(settings.maxPostAgeHours, 10),
          autoDeleteViewedDays: parseInt(settings.autoDeleteViewedDays, 10),
          groqApiKey,
          useGroq: settings.useGroq,
          groqSystemPrompt: settings.groqSystemPrompt
        })
      })
      if (res.ok) {
        toast.success("Settings saved successfully")
        if (groqApiKey) {
          setSettings({ ...settings, groqApiKey: "********" })
        }
      } else {
        toast.error("Failed to save settings")
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleOpenLogin = async () => {
    setLoginLaunching(true)
    try {
      const res = await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login" })
      })
      if (res.ok) {
        toast.success("Opening Facebook Login Window... Log in if prompted, then close when done.")
      } else {
        toast.error("Failed to launch login window")
      }
    } catch {
      toast.error("Error launching login window")
    } finally {
      setLoginLaunching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Customize background scraper speed, operating schedule, and data retention.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">

        {/* Facebook Authentication Card */}
        <Card className="bg-card/50 backdrop-blur-md border border-emerald-500/20 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="size-5" />
              <CardTitle className="text-lg">Facebook Authentication & Browser Session</CardTitle>
            </div>
            <CardDescription className="text-xs">
              GroupScout runs in invisible headless Chromium. If Facebook asks for login, verify your session here.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-background/50 border border-border/60">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Session Status</p>
                <p className="text-xs text-muted-foreground">Session cookies saved in local <code className="font-mono text-emerald-400">chrome-data</code> profile.</p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleOpenLogin} 
                disabled={loginLaunching}
                className="shrink-0 gap-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-medium"
              >
                <Lock className="size-4" /> {loginLaunching ? "Opening..." : "Log In / Verify Facebook Session"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scraper Speed & Performance Controls */}
        <Card className="bg-card/50 backdrop-blur-md border border-border/60 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <Gauge className="size-5" />
              <CardTitle className="text-lg">Scraper Speed & Performance</CardTitle>
            </div>
            <CardDescription className="text-xs">Configure how fast the Chromium engine scrolls and pauses between Facebook groups.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Scrolling Speed</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={settings.scrollSpeed} onValueChange={(v) => v && setSettings({ ...settings, scrollSpeed: v })}>
                    <SelectTrigger className="bg-background/50 border-border text-sm h-10">
                      <SelectValue placeholder="Select speed" />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 border-border">
                      <SelectItem value="fast">⚡ Fast (Quick scrolls, 150ms pauses)</SelectItem>
                      <SelectItem value="medium">⚡ Medium (Balanced - Recommended)</SelectItem>
                      <SelectItem value="slow">🐢 Stealth / Slow (Human reading pace)</SelectItem>
                      <SelectItem value="human">👤 Human Mimic (Variable micro-pauses)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">Faster scrolling extracts leads quicker; slower scrolling is more stealthy.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Pause Between Groups (Seconds)</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={settings.interGroupDelaySeconds} onValueChange={(v) => v && setSettings({ ...settings, interGroupDelaySeconds: v })}>
                    <SelectTrigger className="bg-background/50 border-border text-sm h-10">
                      <SelectValue placeholder="Select pause" />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 border-border">
                      <SelectItem value="1">1 second (Instant transition)</SelectItem>
                      <SelectItem value="3">3 seconds (Recommended)</SelectItem>
                      <SelectItem value="5">5 seconds (Relaxed)</SelectItem>
                      <SelectItem value="10">10 seconds (Stealth mode)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">Delay timer before navigating from one Facebook group to the next.</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 pt-2 border-t border-border/40">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Scan Interval (Background Cycle)</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={settings.scanInterval} onValueChange={(v) => v && setSettings({ ...settings, scanInterval: v })}>
                    <SelectTrigger className="bg-background/50 border-border text-sm h-10">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 border-border">
                      <SelectItem value="1">Every 1 minute</SelectItem>
                      <SelectItem value="2">Every 2 minutes</SelectItem>
                      <SelectItem value="5">Every 5 minutes (Default)</SelectItem>
                      <SelectItem value="10">Every 10 minutes</SelectItem>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">Frequency of total scan cycles across all active monitored groups.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Auto-Scroll Pages (Feed Depth)</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Input 
                    type="number" 
                    min="1"
                    max="20"
                    value={settings.autoScrollPages} 
                    onChange={(e) => setSettings({ ...settings, autoScrollPages: e.target.value })}
                    className="bg-background/50 border-border text-sm h-10" 
                  />
                )}
                <p className="text-[11px] text-muted-foreground">Number of feed page scrolls per group visit (e.g., 5 pages ≈ 50 posts).</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operating Schedule & Active Hours */}
        <Card className="bg-card/50 backdrop-blur-md border border-border/60 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <Clock className="size-5" />
              <CardTitle className="text-lg">Operating Schedule & Active Hours</CardTitle>
            </div>
            <CardDescription className="text-xs">Set the designated local time window when GroupScout is allowed to scan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Active Start Time (From)</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={settings.activeFrom} onValueChange={(v) => v && setSettings({ ...settings, activeFrom: v })}>
                    <SelectTrigger className="bg-background/50 border-border text-sm h-10">
                      <SelectValue placeholder="Start time" />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 border-border max-h-56">
                      {HOURS_OPTIONS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Active End Time (To)</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={settings.activeTo} onValueChange={(v) => v && setSettings({ ...settings, activeTo: v })}>
                    <SelectTrigger className="bg-background/50 border-border text-sm h-10">
                      <SelectValue placeholder="End time" />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 border-border max-h-56">
                      {HOURS_OPTIONS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Outside active hours, the scanner automatically pauses to preserve system resources.</p>
          </CardContent>
        </Card>

        {/* Data Retention & Post Age Filters */}
        <Card className="bg-card/50 backdrop-blur-md border border-border/60 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <Trash2 className="size-5" />
              <CardTitle className="text-lg">Data Retention & Post Age Limits</CardTitle>
            </div>
            <CardDescription className="text-xs">Prevent old posts from being saved and clean up viewed leads automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Max Post Age Limit (Hours)</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Input 
                    type="number" 
                    min="1"
                    max="720"
                    placeholder="48"
                    value={settings.maxPostAgeHours} 
                    onChange={(e) => setSettings({ ...settings, maxPostAgeHours: e.target.value })}
                    className="bg-background/50 border-border text-sm h-10" 
                  />
                )}
                <p className="text-[11px] text-muted-foreground">Ignore posts published older than this many hours ago (default: 48h).</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Auto-Delete Viewed Posts (Days)</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Input 
                    type="number" 
                    min="1"
                    max="365"
                    placeholder="30"
                    value={settings.autoDeleteViewedDays} 
                    onChange={(e) => setSettings({ ...settings, autoDeleteViewedDays: e.target.value })}
                    className="bg-background/50 border-border text-sm h-10" 
                  />
                )}
                <p className="text-[11px] text-muted-foreground">Automatically prune viewed leads older than this many days (default: 30 days).</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button 
            type="submit" 
            disabled={saving || loading}
            className="gap-2 px-6 h-11 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Save className="size-4" /> {saving ? "Saving Changes..." : "Save Settings"}
          </Button>
        </div>

      </form>
    </div>
  )
}
