"use client";

import { cn } from "@/lib/utils";
import { Check, Lock, Loader2 } from "lucide-react";

const STAGES = [
  { key: "canvas", label: "Canvas", index: 0 },
  { key: "content", label: "Content", index: 1 },
  { key: "script", label: "Script", index: 2 },
  { key: "storyboard", label: "Storyboard", index: 3 },
  { key: "voice", label: "Voice", index: 4 },
  { key: "avatar", label: "Avatar", index: 5 },
  { key: "video", label: "Video", index: 6 },
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
    <div className="border-b border-border">
      <nav className="flex gap-0 overflow-x-auto px-6" aria-label="Pipeline stages">
        {STAGES.map((stage) => {
          const isActive = activeTab === stage.key;
          const isCompleted = stage.index < currentStage;
          const isAccessible = stage.index <= currentStage;
          return (
            <button
              key={stage.key}
              onClick={() => isAccessible && onTabChange(stage.key)}
              disabled={!isAccessible}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-all whitespace-nowrap",
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
                  stage.index + 1
                )}
              </span>
              {stage.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
