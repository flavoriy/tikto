import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-[10px] border border-border bg-white px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/10 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
