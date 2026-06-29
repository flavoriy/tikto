import * as React from "react";

import { cn } from "@/lib/utils/cn";

type BadgeTone = "default" | "success" | "warning" | "danger";

const toneMap: Record<BadgeTone, string> = {
  default: "bg-[var(--panel-muted)] text-foreground",
  success: "bg-[#e4f6ec] text-[#166534]",
  warning: "bg-[#fef3c7] text-[#92400e]",
  danger: "bg-[#fee2e2] text-[#b91c1c]",
};

export function Badge({
  children,
  tone = "default",
  className,
}: React.PropsWithChildren<{ tone?: BadgeTone; className?: string }>) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]", toneMap[tone], className)}>
      {children}
    </span>
  );
}
