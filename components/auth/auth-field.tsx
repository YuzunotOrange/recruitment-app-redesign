import { cn } from "@/lib/utils"

export function AuthField({
  label,
  ja,
  type = "text",
  placeholder,
  autoComplete,
  defaultValue,
  rightSlot,
}: {
  label: string
  ja: string
  type?: string
  placeholder?: string
  autoComplete?: string
  defaultValue?: string
  rightSlot?: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label} <span className="text-xs font-normal text-muted-foreground">{ja}</span>
      </span>
      <div className="relative">
        <input
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
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
