import { cn } from "@/lib/utils"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const toneStyles: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-accent/10 text-accent ring-accent/20",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/15 text-warning-foreground ring-warning/30",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        "cyber-flicker inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: "S" | "A" | "B" | "C" }) {
  const tone: Record<string, Tone> = {
    S: "danger",
    A: "warning",
    B: "info",
    C: "neutral",
  }
  return (
    <span
      className={cn(
        "cyber-flicker inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ring-1 ring-inset",
        toneStyles[tone[priority]],
      )}
    >
      {priority}
    </span>
  )
}

export function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex" aria-label={`重要度 ${count}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={i < count ? "text-warning" : "text-border"}
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  )
}
