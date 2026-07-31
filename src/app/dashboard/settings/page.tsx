"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Save, Key } from "lucide-react"

type SettingsForm = {
  userId: string
  scanInterval: string
  autoScrollPages: string
  activeFrom: string
  activeTo: string
  monitoringMode: string
  groqApiKey: string
  useGroq: boolean
  groqSystemPrompt: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsForm>({
    userId: "",
    scanInterval: "5",
    autoScrollPages: "5",
    activeFrom: "08:00",
    activeTo: "20:00",
    monitoringMode: "default",
    groqApiKey: "",
    useGroq: false,
    groqSystemPrompt: ""
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
            activeFrom: data.activeFrom || "08:00",
            activeTo: data.activeTo || "20:00",
            monitoringMode: data.monitoringMode || "default",
            groqApiKey: data.groqApiKey ? "********" : "", // Mask the actual key
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
    
    // Only send the key if it was modified (not the mask)
    const groqApiKey = settings.groqApiKey === "********" ? undefined : settings.groqApiKey

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          scanInterval: parseInt(settings.scanInterval, 10),
          autoScrollPages: parseInt(settings.autoScrollPages, 10),
          activeFrom: settings.activeFrom,
          activeTo: settings.activeTo,
          monitoringMode: settings.monitoringMode,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your background worker and AI configuration.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">


        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Monitoring</CardTitle>
            <CardDescription>Configure how often the background worker checks for new posts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-start">
                <Label>Scan Interval</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={settings.scanInterval} onValueChange={(v) => v && setSettings({ ...settings, scanInterval: v })}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 minute</SelectItem>
                      <SelectItem value="2">2 minutes</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2 text-start">
                <Label>Auto-Scroll Pages (History depth)</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Input 
                    type="number" 
                    min="0"
                    max="50"
                    value={settings.autoScrollPages} 
                    onChange={(e) => setSettings({ ...settings, autoScrollPages: e.target.value })}
                    className="bg-background/50" 
                  />
                )}
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-start">
                <Label>Active From</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Input 
                    type="time" 
                    value={settings.activeFrom} 
                    onChange={(e) => setSettings({ ...settings, activeFrom: e.target.value })}
                    className="bg-background/50" 
                  />
                )}
              </div>
              <div className="space-y-2 text-start">
                <Label>Active To</Label>
                {loading ? <Skeleton className="h-10 w-full" /> : (
                  <Input 
                    type="time" 
                    value={settings.activeTo} 
                    onChange={(e) => setSettings({ ...settings, activeTo: e.target.value })}
                    className="bg-background/50" 
                  />
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Outside these hours, the worker will pause automatically to conserve resources.</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Facebook Account & Authentication</CardTitle>
            <CardDescription>Connect or verify your Facebook login session for background group scanning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              GroupScout needs your Facebook session to browse groups. Click below to open a browser window and log in once. Your session will be saved locally.
            </p>
            <div className="flex items-center gap-4">
              <Button 
                type="button" 
                variant="outline" 
                className="border-primary/50 text-primary hover:bg-primary/10"
                onClick={async () => {
                  toast.info("Opening Facebook Login Window...");
                  try {
                    await fetch("/api/engine", {
                      method: "POST",
                      body: JSON.stringify({ action: "login" })
                    });
                  } catch (err) {
                    toast.error("Failed to open login window");
                  }
                }}
              >
                Log In / Verify Facebook Session
              </Button>
            </div>
          </CardContent>
        </Card>



        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>AI Configuration</CardTitle>
            <CardDescription>Provide your Groq API key for binary classification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 text-start">
              <Label>Groq API Key</Label>
              {loading ? <Skeleton className="h-10 w-full" /> : (
                <div className="relative">
                  <Key className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="gsk_..." 
                    value={settings.groqApiKey}
                    onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
                    className="bg-background/50 pl-10" 
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Your key is encrypted and stored securely.
              </p>
            </div>
            
            <div className="pt-4 border-t border-border/50 space-y-4">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="use-groq" 
                  checked={settings.useGroq} 
                  onChange={(e) => setSettings({ ...settings, useGroq: e.target.checked })}
                  className="size-4"
                />
                <div>
                  <Label htmlFor="use-groq" className="font-semibold text-base">Use AI Relevance Filtering</Label>
                  <p className="text-sm text-muted-foreground">If disabled, all posts containing keywords will be automatically saved as relevant leads.</p>
                </div>
              </div>
              
              {settings.useGroq && (
                <div className="space-y-2 text-start mt-4">
                  <Label>AI System Prompt</Label>
                  {loading ? <Skeleton className="h-24 w-full" /> : (
                    <textarea 
                      value={settings.groqSystemPrompt}
                      onChange={(e) => setSettings({ ...settings, groqSystemPrompt: e.target.value })}
                      className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background/50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="You are a lead classifier..."
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Customize how Groq evaluates posts. The AI must return JSON with a relevant boolean.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading || saving} className="px-8">
            <Save className="size-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
