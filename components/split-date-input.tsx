"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type SplitDateInputProps = {
  value: string
  onChange: (value: string) => void
  required?: boolean
  ariaLabel: string
  className?: string
}

export function SplitDateInput({ value, onChange, required = false, ariaLabel, className }: SplitDateInputProps) {
  const [year, setYear] = useState("")
  const [month, setMonth] = useState("")
  const [day, setDay] = useState("")
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) {
      if (!value) {
        setYear("")
        setMonth("")
        setDay("")
      }
      return
    }

    setYear(match[1])
    setMonth(match[2])
    setDay(match[3])
  }, [value])

  function update(nextYear: string, nextMonth: string, nextDay: string) {
    if (!nextYear && !nextMonth && !nextDay) {
      onChange("")
      return
    }

    if (nextYear.length === 4 && nextMonth.length === 2 && nextDay.length === 2) {
      onChange(`${nextYear}-${nextMonth}-${nextDay}`)
    }
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
      aria-label={ariaLabel}
    >
      <input
        value={year}
        onChange={(event) => {
          const nextYear = event.target.value.replace(/\D/g, "").slice(0, 4)
          setYear(nextYear)
          update(nextYear, month, day)
          if (nextYear.length === 4) monthRef.current?.focus()
        }}
        required={required}
        inputMode="numeric"
        maxLength={4}
        placeholder="YYYY"
        className="w-[4.25rem] bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <span className="text-muted-foreground">/</span>
      <input
        ref={monthRef}
        value={month}
        onChange={(event) => {
          const nextMonth = event.target.value.replace(/\D/g, "").slice(0, 2)
          setMonth(nextMonth)
          update(year, nextMonth, day)
          if (nextMonth.length === 2) dayRef.current?.focus()
        }}
        required={required}
        inputMode="numeric"
        maxLength={2}
        placeholder="MM"
        className="w-[2.5rem] bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <span className="text-muted-foreground">/</span>
      <input
        ref={dayRef}
        value={day}
        onChange={(event) => {
          const nextDay = event.target.value.replace(/\D/g, "").slice(0, 2)
          setDay(nextDay)
          update(year, month, nextDay)
        }}
        required={required}
        inputMode="numeric"
        maxLength={2}
        placeholder="DD"
        className="w-[2.5rem] bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
