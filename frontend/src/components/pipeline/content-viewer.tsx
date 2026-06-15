"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Check,
  Loader2,
  RefreshCcw,
  Star,
  FileText,
} from "lucide-react";
import type { ContentVariation } from "@/hooks/use-pipeline";
import { cn } from "@/lib/utils";

interface ContentViewerProps {
  variations: ContentVariation[];
  onSelect: (index: number) => void;
  onRegenerate: (additionalContext: string) => void;
  onProceed: () => void;
  isRegenerating: boolean;
}

export function ContentViewer({
  variations,
  onSelect,
  onRegenerate,
  onProceed,
  isRegenerating,
}: ContentViewerProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [improvementPrompt, setImprovementPrompt] = useState("");
  const [showImprove, setShowImprove] = useState(false);

  const handleSelect = (index: number) => {
    setSelected(index);
    onSelect(index);
  };

  const handleRegenerate = () => {
    onRegenerate(improvementPrompt);
    setImprovementPrompt("");
    setShowImprove(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success bg-success/10";
    if (score >= 60) return "text-warning bg-warning/10";
    return "text-destructive bg-destructive/10";
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Content Variations</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compare and select the best variation for your video
          </p>
        </div>
        <div className="flex gap-2">
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
            <Label>Additional context / improvement prompt</Label>
            <Textarea
              placeholder="e.g., Make it more conversational, add more statistics..."
              value={improvementPrompt}
              onChange={(e) => setImprovementPrompt(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImprove(false)}
              >
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
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variations Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {variations.map((variation, index) => (
          <Card
            key={index}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selected === index
                ? "ring-2 ring-primary border-primary"
                : "border-border/50 hover:border-border"
            )}
            onClick={() => handleSelect(index)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Variation {index + 1}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn("gap-1 text-xs", getScoreColor(variation.quality_score))}
                  >
                    <Star className="h-3 w-3" />
                    {variation.quality_score.toFixed(0)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {variation.word_count} words
                  </Badge>
                  {selected === index && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-h-[400px] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
                {variation.content}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Proceed Button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={onProceed}
          disabled={selected === null}
          size="lg"
          className="gap-2 min-w-[200px]"
        >
          Proceed to Script
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
