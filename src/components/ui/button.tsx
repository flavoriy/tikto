import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-medium disabled:cursor-not-allowed disabled:opacity-55",
  {
    variants: {
      variant: {
        primary:
          "bg-accent px-4 py-2.5 text-white shadow-[0_6px_16px_rgba(22,163,74,0.20)] hover:bg-[var(--accent-strong)] active:opacity-80",
        secondary:
          "border border-border bg-white px-4 py-2.5 text-foreground hover:bg-[var(--panel-muted)] active:opacity-80",
        ghost:
          "px-3 py-2.5 text-muted hover:bg-[var(--panel-muted)] hover:text-foreground active:opacity-80",
        danger:
          "bg-danger px-4 py-2.5 text-white hover:bg-[#b91c1c] active:opacity-80",
      },
      size: {
        default: "",
        sm: "rounded-[8px] px-3 py-2 text-xs",
        lg: "rounded-[12px] px-5 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
