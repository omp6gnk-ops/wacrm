"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

function Switch({
  className,
  checked,
  onCheckedChange,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <label className={cn("relative inline-flex items-center cursor-pointer select-none h-5 w-9 shrink-0", disabled && "opacity-50 cursor-not-allowed")}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        {...props}
      />
      <div 
        className={cn(
          "w-9 h-5 bg-muted rounded-full transition-colors relative border-2 border-transparent",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
          "peer-checked:bg-primary",
          "after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all",
          "peer-checked:after:translate-x-4",
          className
        )}
      />
    </label>
  )
}

export { Switch }
