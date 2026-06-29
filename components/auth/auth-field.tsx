"use client"

import { cn } from "@/lib/utils"
import { secondaryText, text, useLanguagePreference } from "@/lib/language"

export function AuthField({
  label,
  ja,
  name,
  type = "text",
  placeholder,
  autoComplete,
  defaultValue,
  required,
  rightSlot,
}: {
  label: string
  ja: string
  name?: string
  type?: string
  placeholder?: string
  autoComplete?: string
  defaultValue?: string
  required?: boolean
  rightSlot?: React.ReactNode
}) {
  const language = useLanguagePreference()
  const labelCopy = { en: label, ja }
  const secondary = secondaryText(language, labelCopy)

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {text(language, labelCopy)}{" "}
        {secondary && <span className="text-xs font-normal text-muted-foreground">{secondary}</span>}
      </span>
      <div className="relative">
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          required={required}
          className={cn(
            "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/40",
            rightSlot && "pr-10",
          )}
        />
        {rightSlot}
      </div>
    </label>
  )
}
