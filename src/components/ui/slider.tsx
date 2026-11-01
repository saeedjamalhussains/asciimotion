"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Slider as SliderPrimitive } from "radix-ui"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  "aria-valuetext": ariaValueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex h-4 w-full touch-none items-center select-none pointer-coarse:h-8 data-disabled:opacity-40",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1 w-full grow overflow-hidden rounded-full bg-input"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full bg-tint select-none"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          // The thumb is the element with the slider role, so its name belongs here.
          aria-label={ariaLabel}
          aria-valuetext={ariaValueText}
          className="relative block size-4 shrink-0 rounded-full bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.3),0_1px_4px_rgb(0_0_0/0.5)] transition-transform duration-100 ease-out select-none after:absolute after:-inset-2 active:scale-110 pointer-coarse:size-6 disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
