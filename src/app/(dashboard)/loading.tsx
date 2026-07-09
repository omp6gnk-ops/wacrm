"use client";

import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center animate-in fade-in-50 duration-200">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* Modern premium pulsing loader */}
        <div className="relative flex h-10 w-10 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="absolute inset-0 h-10 w-10 animate-ping rounded-full bg-primary/20 opacity-75" />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading content...
        </p>
      </div>
    </div>
  );
}
