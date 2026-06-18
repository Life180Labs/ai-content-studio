"use client";

import { cn } from "@/lib/utils";
import { Check, Lock, Loader2 } from "lucide-react";

const STAGES = [
  { key: "content-studio", label: "Content Studio", minAccessible: 0, minCompleted: 2 },
  { key: "script", label: "Script", minAccessible: 2, minCompleted: 3 },
  { key: "storyboard", label: "Storyboard", minAccessible: 3, minCompleted: 5 },
  { key: "voice-avatar", label: "Voice & Avatar", minAccessible: 3, minCompleted: 6 },
  { key: "video-review", label: "Video Review", minAccessible: 6, minCompleted: 7 },
  { key: "delivery", label: "Delivery", minAccessible: 7, minCompleted: 8 },
];

interface PipelineTabsProps {
  currentStage: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isGenerating?: boolean;
}

export function PipelineTabs({
  currentStage,
  activeTab,
  onTabChange,
  isGenerating,
}: PipelineTabsProps) {
  return (
    <div className="border-b border-border w-full">
      <nav 
        className="flex gap-0 overflow-x-auto px-2 sm:px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']" 
        aria-label="Pipeline stages"
      >
        {STAGES.map((stage, i) => {
          const isActive = activeTab === stage.key;
          const isCompleted = currentStage >= stage.minCompleted;
          // The user specifically requested unrestricted tab navigation for completed projects to review inputs.
          // Therefore, if ANY later stage is accessible, all earlier stages are accessible.
          const isAccessible = currentStage >= stage.minAccessible;
          return (
            <button
              key={stage.key}
              onClick={() => isAccessible && onTabChange(stage.key)}
              disabled={!isAccessible}
              className={cn(
                "relative flex items-center gap-2 px-3 sm:px-4 py-3.5 text-sm font-medium transition-all whitespace-nowrap shrink-0",
                "border-b-2 -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : isCompleted
                  ? "border-transparent text-foreground/80 hover:text-foreground hover:border-border"
                  : "border-transparent text-muted-foreground",
                (!isAccessible) && "opacity-40 cursor-not-allowed"
              )}
            >
              {/* Step indicator */}
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                    ? "bg-success/20 text-success"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isGenerating && isActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                  ) : (
                    i + 1
                  )}
              </span>
              <span className="hidden sm:inline">{stage.label}</span>
              <span className="sm:hidden">{isActive || isCompleted ? stage.label : ""}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
