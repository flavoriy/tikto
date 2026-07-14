import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-[10px] border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15",
        className,
      )}
      {...props}
    />
  );
}
