import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/12 text-primary dark:bg-primary/15",
        secondary: "border-border bg-secondary text-secondary-foreground",
        success:
          "border-emerald-400/20 bg-emerald-400/12 text-emerald-600 dark:text-emerald-300",
        warning:
          "border-amber-400/20 bg-amber-400/12 text-amber-700 dark:text-amber-300",
        danger:
          "border-red-400/20 bg-red-400/12 text-red-600 dark:text-red-300",
        info: "border-blue-400/20 bg-blue-400/12 text-blue-600 dark:text-blue-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}
