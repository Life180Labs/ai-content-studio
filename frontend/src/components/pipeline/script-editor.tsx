"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Clock,
  FileText,
  Loader2,
  Lock,
  RefreshCcw,
  Eye,
} from "lucide-react";
import type { ScriptSection } from "@/hooks/use-pipeline";
import { cn } from "@/lib/utils";

interface ScriptEditorProps {
  sections: ScriptSection[];
  fullScript: string;
  estimatedDuration: string;
  wordCount: number;
  onRegenerate: (additionalContext: string) => void;
  isRegenerating: boolean;
}

const SECTION_COLORS: Record<string, string> = {
  hook: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  intro: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  body: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  climax: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  cta: "bg-red-500/10 text-red-500 border-red-500/20",
  outro: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

export function ScriptEditor({
  sections,
  fullScript,
  estimatedDuration,
  wordCount,
  onRegenerate,
  isRegenerating,
}: ScriptEditorProps) {
  const [showImprove, setShowImprove] = useState(false);
  const [improvementPrompt, setImprovementPrompt] = useState("");
  const [viewMode, setViewMode] = useState<"sections" | "full">("sections");

  const handleRegenerate = () => {
    onRegenerate(improvementPrompt);
    setImprovementPrompt("");
    setShowImprove(false);
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Video Script</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {estimatedDuration || "—"}
            </span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {wordCount} words
            </span>
            <span className="text-sm text-muted-foreground">
              {sections.length} sections
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("sections")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "sections"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              Sections
            </button>
            <button
              onClick={() => setViewMode("full")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "full"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              Full Script
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImprove(!showImprove)}
            className="gap-1.5"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Improvement prompt */}
      {showImprove && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <Label>Improvement prompt</Label>
            <Textarea
              placeholder="e.g., Make the hook more dramatic, shorten the body..."
              value={improvementPrompt}
              onChange={(e) => setImprovementPrompt(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowImprove(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="gap-1.5"
              >
                {isRegenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" />
                )}
                Regenerate Script
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections View */}
      {viewMode === "sections" ? (
        <div className="space-y-4">
          {sections.map((section, index) => {
            const colorClass =
              SECTION_COLORS[section.section_type] ||
              "bg-muted text-foreground border-border";

            return (
              <Card key={index} className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("text-xs uppercase font-semibold", colorClass)}
                      >
                        {section.section_type}
                      </Badge>
                      {section.duration_estimate && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {section.duration_estimate}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {section.text}
                  </p>
                  {section.visual_notes && (
                    <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Visual Notes
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {section.visual_notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Full Script View */
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {fullScript}
            </pre>
          </CardContent>
        </Card>
      )}


    </div>
  );
}
