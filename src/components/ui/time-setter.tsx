"use client"

import * as React from "react"
import { ChevronUp, ChevronDown, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimeSetterProps {
  value: string // "HH:MM"
  onChange: (value: string) => void
  label?: string
  className?: string
}

export function TimeSetter({ value, onChange, label, className }: TimeSetterProps) {
  const parse = (val: string) => {
    const parts = (val || "00:00").split(":")
    let h = parseInt(parts[0], 10)
    let m = parseInt(parts[1], 10)
    if (isNaN(h) || h < 0 || h > 23) h = 0
    if (isNaN(m) || m < 0 || m > 59) m = 0
    return { h, m }
  }

  const { h, m } = parse(value)

  const update = (newH: number, newM: number) => {
    const validH = (newH + 24) % 24
    const validM = (newM + 60) % 60
    const hStr = validH.toString().padStart(2, "0")
    const mStr = validM.toString().padStart(2, "0")
    onChange(`${hStr}:${mStr}`)
  }

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      update(h + 1, m)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      update(h - 1, m)
    }
  }

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      update(h, m + 15)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      update(h, m - 15)
    }
  }

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2)
    const val = parseInt(raw, 10)
    if (!isNaN(val) && val >= 0 && val <= 23) {
      update(val, m)
    } else if (raw === "") {
      update(0, m)
    }
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2)
    const val = parseInt(raw, 10)
    if (!isNaN(val) && val >= 0 && val <= 59) {
      update(h, val)
    } else if (raw === "") {
      update(h, 0)
    }
  }

  const hStr = h.toString().padStart(2, "0")
  const mStr = m.toString().padStart(2, "0")

  return (
    <div className={cn("space-y-1", className)}>
      {label && <span className="text-[11px] font-semibold text-foreground">{label}</span>}
      <div className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-card/50 border border-border/70 hover:border-border transition-colors w-fit">
        <Clock className="size-3.5 text-emerald-400 shrink-0" />
        
        <div className="flex items-center gap-0.5 font-mono text-xs font-semibold text-foreground">
          {/* Hours Input + Stepper */}
          <div className="flex items-center gap-0.5 group">
            <input
              type="text"
              value={hStr}
              onChange={handleHourChange}
              onKeyDown={handleHourKeyDown}
              className="w-7 text-center bg-background/50 border border-border/40 rounded px-0.5 py-0.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              maxLength={2}
            />
            <div className="flex flex-col -space-y-1">
              <button
                type="button"
                onClick={() => update(h + 1, m)}
                className="text-muted-foreground hover:text-emerald-400 p-0"
                title="Increase Hour"
              >
                <ChevronUp className="size-2.5" />
              </button>
              <button
                type="button"
                onClick={() => update(h - 1, m)}
                className="text-muted-foreground hover:text-emerald-400 p-0"
                title="Decrease Hour"
              >
                <ChevronDown className="size-2.5" />
              </button>
            </div>
          </div>

          <span className="text-emerald-400/80 font-bold px-0.5">:</span>

          {/* Minutes Input + Stepper */}
          <div className="flex items-center gap-0.5 group">
            <input
              type="text"
              value={mStr}
              onChange={handleMinuteChange}
              onKeyDown={handleMinuteKeyDown}
              className="w-7 text-center bg-background/50 border border-border/40 rounded px-0.5 py-0.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              maxLength={2}
            />
            <div className="flex flex-col -space-y-1">
              <button
                type="button"
                onClick={() => update(h, m + 15)}
                className="text-muted-foreground hover:text-emerald-400 p-0"
                title="Increase Minutes (+15m)"
              >
                <ChevronUp className="size-2.5" />
              </button>
              <button
                type="button"
                onClick={() => update(h, m - 15)}
                className="text-muted-foreground hover:text-emerald-400 p-0"
                title="Decrease Minutes (-15m)"
              >
                <ChevronDown className="size-2.5" />
              </button>
            </div>
          </div>
        </div>

        <span className="text-[10px] font-mono text-muted-foreground ml-1">
          {h >= 12 ? "PM" : "AM"}
        </span>
      </div>
    </div>
  )
}
