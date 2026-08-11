import * as React from "react"

import { cn } from "@/lib/utils"

function Button({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      data-slot="button"
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-background text-sm font-medium whitespace-nowrap shadow-xs transition-all outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

export { Button }
