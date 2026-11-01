import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "press group/button inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-fg-dim hover:bg-muted hover:text-foreground",
      },
      size: {
        default: "h-8 gap-1.5 px-3 text-body pointer-coarse:h-11",
        sm: "h-7 gap-1 rounded-md px-2.5 text-footnote pointer-coarse:h-10 [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-8 pointer-coarse:size-11",
        "icon-xs": "size-6 rounded-md pointer-coarse:size-9 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7 rounded-md pointer-coarse:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
