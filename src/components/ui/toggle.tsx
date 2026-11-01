"use client"

import { cva } from "class-variance-authority"

const toggleVariants = cva(
  "press inline-flex items-center justify-center gap-1 rounded-md text-footnote font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
)

export { toggleVariants }
