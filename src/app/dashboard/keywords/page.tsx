"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tags, Trash2, Plus, Ban, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface Keyword {
  id: string
  keyword: string
  enabled: boolean
}

export default function KeywordsPage() {
  const [activeTab, setActiveTab] = useState<"positive" | "negative">("positive")
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [negativeKeywords, setNegativeKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyword, setNewKeyword] = useState("")
  const [adding, setAdding] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [posRes, negRes] = await Promise.all([
        fetch("/api/keywords"),
        fetch("/api/keywords/negative")
      ])
      if (posRes.ok) setKeywords(await posRes.ok ? await posRes.json() : [])
      if (negRes.ok) setNegativeKeywords(await negRes.ok ? await negRes.json() : [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyword.trim()) return
    
    setAdding(true)
    const endpoint = activeTab === "positive" ? "/api/keywords" : "/api/keywords/negative"
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ keyword: newKeyword.trim() })
      })
      if (res.ok) {
        const added = await res.json()
        if (activeTab === "positive") {
          setKeywords([added, ...keywords])
        } else {
          setNegativeKeywords([added, ...negativeKeywords])
        }
        setNewKeyword("")
        toast.success(activeTab === "positive" ? "Target keyword added" : "Negative keyword added")
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to add keyword")
      }
    } catch {
      toast.error("Error adding keyword")
    } finally {
      setAdding(false)
    }
  }

  const toggleKeyword = async (id: string, enabled: boolean) => {
    if (activeTab === "positive") {
      setKeywords(keywords.map(k => k.id === id ? { ...k, enabled } : k))
      try {
        await fetch(`/api/keywords/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ enabled })
        })
      } catch {
        toast.error("Failed to update keyword")
        fetchData()
      }
    }
  }

  const removeKeyword = async (id: string) => {
    if (activeTab === "positive") {
      setKeywords(keywords.filter(k => k.id !== id))
      try {
        await fetch(`/api/keywords/${id}`, { method: "DELETE" })
        toast.success("Keyword removed")
      } catch {
        toast.error("Failed to remove keyword")
        fetchData()
      }
    } else {
      setNegativeKeywords(negativeKeywords.filter(k => k.id !== id))
      try {
        await fetch(`/api/keywords/negative?id=${id}`, { method: "DELETE" })
        toast.success("Negative keyword removed")
      } catch {
        toast.error("Failed to remove negative keyword")
        fetchData()
      }
    }
  }

  const currentList = activeTab === "positive" ? keywords : negativeKeywords

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Keywords</h1>
          <p className="text-muted-foreground mt-1">Manage target lead keywords and negative exclude words.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-1 rounded-lg border border-border/50">
          <Button 
            variant={activeTab === "positive" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("positive")}
            className="gap-2"
          >
            <CheckCircle2 className="size-4" /> Target Keywords ({keywords.length})
          </Button>
          <Button 
            variant={activeTab === "negative" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("negative")}
            className="gap-2"
          >
            <Ban className="size-4" /> Exclude (Negative) ({negativeKeywords.length})
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-fit">
          <CardHeader>
            <CardTitle>{activeTab === "positive" ? "Target Keywords" : "Negative / Excluded Keywords"}</CardTitle>
            <CardDescription>
              {activeTab === "positive" 
                ? "Posts must match at least one target keyword to be captured as a lead." 
                : "Posts containing any of these negative words will be ignored (e.g. 'hiring', 'job offer', 'selling')."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border border-border/50 rounded-lg">
                    <Skeleton className="h-5 w-32" />
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-5 w-10 rounded-full" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                ))
              ) : currentList.length === 0 ? (
                <div className="py-12 text-center border rounded-lg border-dashed border-border/50 bg-background/30">
                  {activeTab === "positive" ? (
                    <Tags className="size-8 mx-auto text-muted-foreground mb-3" />
                  ) : (
                    <Ban className="size-8 mx-auto text-muted-foreground mb-3 text-red-400" />
                  )}
                  <h3 className="text-lg font-medium">
                    {activeTab === "positive" ? "No target keywords yet" : "No negative keywords yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeTab === "positive" 
                      ? "Add target keywords to start capturing leads." 
                      : "Add negative keywords to ignore unwanted posts (e.g. hiring, ad, job)."}
                  </p>
                </div>
              ) : (
                currentList.map((kw) => (
                  <div key={kw.id} className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background/30 hover:bg-background/50 transition-colors">
                    <span className="font-medium">{kw.keyword}</span>
                    <div className="flex items-center gap-4">
                      {activeTab === "positive" && (
                        <Switch 
                          checked={kw.enabled} 
                          onCheckedChange={(c) => toggleKeyword(kw.id, c)} 
                        />
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeKeyword(kw.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-fit">
          <CardHeader>
            <CardTitle>{activeTab === "positive" ? "Add Target Keyword" : "Add Exclude Keyword"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addKeyword} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder={activeTab === "positive" ? "e.g. looking for a roofer" : "e.g. hiring, job offer, selling"}
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <Button type="submit" className="w-full" disabled={!newKeyword.trim() || adding}>
                <Plus className="size-4 mr-2" /> 
                {activeTab === "positive" ? "Add Target Keyword" : "Add Exclude Keyword"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
