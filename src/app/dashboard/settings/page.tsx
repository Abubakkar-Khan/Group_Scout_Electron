"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Save, Gauge, Clock, ShieldCheck, Trash2, Cpu, Lock, CheckCircle2, AlertCircle } from "lucide-react"

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

  const [sessionAuthenticated, setSessionAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loginLaunching, setLoginLaunching] = useState(false)

  const checkSessionStatus = async () => {
    try {
      const res = await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_session" })
      })
      if (res.ok) {
        const data = await res.json()
        setSessionAuthenticated(data.sessionExists ?? false)
      }
    } catch {
      setSessionAuthenticated(false)
    }
  }

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
            groqSystemPrompt: data.groqSystemPrompt || "You are a lead classifier. Determine if this Facebook post is genuinely looking for the service related to the provided keywords. Respond ONLY with valid JSON: {\"relevant\": true/false}"
          })
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSettings()
    checkSessionStatus()
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
        // Check session again after a delay
        setTimeout(checkSessionStatus, 8000)
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
        <p className="text-muted-foreground mt-1 text-sm">Configure background scanning behavior, operating hours, and data retention.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">

        {/* Facebook Session Status Card */}
        <Card className="bg-card/40 backdrop-blur-md border border-border shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="size-5 text-muted-foreground" />
              <CardTitle className="text-lg">Facebook Session & Authentication</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Playwright maintains your Facebook session profile inside local <code className="font-mono text-foreground">chrome-data</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-background/40 border border-border">
              <div className="flex items-start gap-3">
                {sessionAuthenticated === null ? (
                  <Skeleton className="size-5 rounded-full mt-0.5" />
                ) : sessionAuthenticated ? (
                  <CheckCircle2 className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Session Status:</span>
                    {sessionAuthenticated === null ? (
                      <Skeleton className="h-5 w-24 rounded-full" />
                    ) : sessionAuthenticated ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium px-2 py-0.5">
                        Authenticated & Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[11px] font-medium px-2 py-0.5">
                        Verification Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sessionAuthenticated 
                      ? "Your Facebook login profile is active. Background group scans run automatically." 
                      : "Log into Facebook once in Chrome to allow GroupScout to scan public feeds continuously."}
                  </p>
                </div>
              </div>

              <Button 
                type="button" 
                variant="outline" 
                onClick={handleOpenLogin} 
                disabled={loginLaunching}
                className="shrink-0 gap-2 border-border text-foreground hover:bg-muted text-xs font-medium h-9"
              >
                <Lock className="size-3.5" /> 
                {loginLaunching ? "Opening Window..." : sessionAuthenticated ? "Re-verify / Switch Account" : "Log In to Facebook"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scraper Speed & Performance Controls */}
        <Card className="bg-card/40 backdrop-blur-md border border-border shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-foreground">
              <Gauge className="size-5 text-muted-foreground" />
              <CardTitle className="text-lg">Scraper Speed & Performance</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">Configure scroll speed, pauses between groups, and background cycle frequency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-1">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Scrolling Speed</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={settings.scrollSpeed} onValueChange={(v) => v && setSettings({ ...settings, scrollSpeed: v })}>
                    <SelectTrigger className="bg-background/50 border-border text-sm h-10">
                      <SelectValue placeholder="Select speed" />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 border-border">
                      <SelectItem value="fast">⚡ Fast (Quick scrolls, 150ms delays)</SelectItem>
                      <SelectItem value="medium">⚡ Medium (Balanced - Recommended)</SelectItem>
                      <SelectItem value="slow">🐢 Stealth / Slow (Human reading pace)</SelectItem>
                      <SelectItem value="human">👤 Human Mimic (Variable micro-pauses)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">Faster scrolling extracts leads quicker; slower scrolling is more stealthy.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Pause Between Groups</Label>
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
        <Card className="bg-card/40 backdrop-blur-md border border-border shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="size-5 text-muted-foreground" />
              <CardTitle className="text-lg">Operating Schedule & Active Hours</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">Set the designated local time window when GroupScout is allowed to scan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-1">
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

        {/* Optional Groq AI Classification Card */}
        <Card className="bg-card/40 backdrop-blur-md border border-border shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground">
                <Cpu className="size-5 text-muted-foreground" />
                <CardTitle className="text-lg">Groq AI Filtering (Optional)</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="use-groq" className="text-xs text-muted-foreground cursor-pointer">
                  {settings.useGroq ? "AI Filtering ON" : "AI Filtering OFF (Default)"}
                </Label>
                <Switch
                  id="use-groq"
                  checked={settings.useGroq}
                  onCheckedChange={(checked) => setSettings({ ...settings, useGroq: checked })}
                />
              </div>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              By default, AI filtering is OFF so keyword matches instantly become leads. Enable if you want Groq AI to re-verify post intent.
            </CardDescription>
          </CardHeader>
          {settings.useGroq && (
            <CardContent className="space-y-4 pt-2 border-t border-border/40">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Groq API Key</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Input 
                    type="password"
                    placeholder="gsk_..." 
                    value={settings.groqApiKey} 
                    onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
                    className="bg-background/50 border-border text-sm h-10 font-mono" 
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Custom AI System Prompt</Label>
                {loading ? <Skeleton className="h-20 w-full" /> : (
                  <textarea 
                    rows={3}
                    value={settings.groqSystemPrompt} 
                    onChange={(e) => setSettings({ ...settings, groqSystemPrompt: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/50 p-3 text-xs text-foreground outline-none focus:border-emerald-500 font-mono leading-relaxed" 
                  />
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Data Retention & Post Age Limits */}
        <Card className="bg-card/40 backdrop-blur-md border border-border shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-foreground">
              <Trash2 className="size-5 text-muted-foreground" />
              <CardTitle className="text-lg">Data Retention & Post Age Limits</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">Prevent old posts from being saved and clean up viewed leads automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-1">
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
            className="gap-2 px-6 h-11 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20 transition-all"
          >
            <Save className="size-4" /> {saving ? "Saving Changes..." : "Save Settings"}
          </Button>
        </div>

      </form>
    </div>
  )
}
