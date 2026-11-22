"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex h-4 w-7 shrink-0 items-center rounded-sm border p-0.5 transition-colors duration-150 after:absolute after:-inset-x-3 after:-inset-y-2 data-checked:border-primary data-checked:bg-primary/15 data-unchecked:border-hairline data-unchecked:bg-fill data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-2.5 rounded-[1px] transition-transform duration-150 ease-apple data-checked:translate-x-3 data-checked:bg-primary data-unchecked:translate-x-0 data-unchecked:bg-faint"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
