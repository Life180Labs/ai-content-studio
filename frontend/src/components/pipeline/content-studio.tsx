"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Plus,
  X,
  Loader2,
  ArrowRight,
  Lightbulb,
  Check,
  RefreshCcw,
  Star,
  FileText,
} from "lucide-react";
import type { CanvasInput, ContentVariation } from "@/hooks/use-pipeline";
import { cn } from "@/lib/utils";

interface ContentStudioProps {
  initialData?: Partial<CanvasInput>;
  variations: ContentVariation[];
  onGenerate: (data: CanvasInput) => void;
  onSuggestKeyPoints: (topic: string, audience: string) => Promise<string[]>;
  onSelect: (index: number) => void;
  onRegenerate: (additionalContext: string) => void;
  onProceed: () => void;
  isGenerating: boolean;
  isSuggesting: boolean;
  isRegenerating: boolean;
  hasContentResult: boolean;
}

const TONES = ["professional", "casual", "humorous", "educational", "inspirational", "dramatic"];
const LENGTHS = ["short", "medium", "long"];
const PLATFORMS = ["youtube", "tiktok", "instagram", "linkedin", "twitter", "generic"];

export function ContentStudio({
  initialData,
  variations,
  onGenerate,
  onSuggestKeyPoints,
  onSelect,
  onRegenerate,
  onProceed,
  isGenerating,
  isSuggesting,
  isRegenerating,
  hasContentResult
}: ContentStudioProps) {
  // Canvas State
  const [topic, setTopic] = useState(initialData?.topic || "");
  const [keyPoints, setKeyPoints] = useState<string[]>(initialData?.key_points || []);
  const [newKeyPoint, setNewKeyPoint] = useState("");
  const [audience, setAudience] = useState(initialData?.target_audience || "");
  const [goal, setGoal] = useState(initialData?.goal || "");
  const [tone, setTone] = useState(initialData?.tone || "professional");
  const [length, setLength] = useState(initialData?.length || "medium");
  const [platform, setPlatform] = useState(initialData?.platform || "youtube");
  const [cta, setCta] = useState(initialData?.call_to_action || "");
  const [brandVoice, setBrandVoice] = useState(initialData?.brand_voice || "");
  const [additionalContext, setAdditionalContext] = useState(initialData?.additional_context || "");

  // Content State
  const [selected, setSelected] = useState<number | null>(null);
  const [improvementPrompt, setImprovementPrompt] = useState("");
  const [showImprove, setShowImprove] = useState(false);

  const addKeyPoint = () => {
    if (newKeyPoint.trim()) {
      setKeyPoints((prev) => [...prev, newKeyPoint.trim()]);
      setNewKeyPoint("");
    }
  };

  const removeKeyPoint = (index: number) => {
    setKeyPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSuggest = async () => {
    if (!topic.trim()) return;
    const suggestions = await onSuggestKeyPoints(topic, audience);
    setKeyPoints((prev) => [...prev, ...suggestions.filter((s) => !prev.includes(s))]);
  };

  const handleSubmit = () => {
    if (!topic.trim()) return;
    onGenerate({
      topic,
      key_points: keyPoints,
      target_audience: audience,
      goal,
      tone,
      length,
      platform,
      call_to_action: cta,
      brand_voice: brandVoice,
      additional_context: additionalContext,
    });
  };

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto p-4 md:p-6">
      {/* Left Pane: Canvas Inputs */}
      <div className="flex flex-col h-full">
        <div className="flex-1 space-y-6">
          <div>
          <h2 className="text-lg font-semibold">Content Brief</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define your video's topic, audience, and goals
          </p>
        </div>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Topic & Key Points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic *</Label>
              <Input
                id="topic"
                placeholder="e.g., How AI is transforming healthcare in 2025"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Key Points */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Key Points</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSuggest}
                  disabled={isSuggesting || !topic.trim()}
                  className="gap-1.5 text-primary h-8"
                >
                  {isSuggesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lightbulb className="h-3.5 w-3.5" />
                  )}
                  AI Suggest
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a key point..."
                  value={newKeyPoint}
                  onChange={(e) => setNewKeyPoint(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyPoint())}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addKeyPoint}
                  disabled={!newKeyPoint.trim()}
                  className="shrink-0 h-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {keyPoints.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {keyPoints.map((point, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="gap-1 pr-1 py-1 text-xs max-w-xs"
                    >
                      <span className="truncate">{point}</span>
                      <button
                        onClick={() => removeKeyPoint(i)}
                        className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parameters */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="audience">Target Audience</Label>
                <Input
                  id="audience"
                  placeholder="e.g., Tech professionals aged 25-45"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal">Goal</Label>
                <Input
                  id="goal"
                  placeholder="e.g., Educate and drive signups"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Tone</Label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Length</Label>
                <select
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {LENGTHS.map((l) => (
                    <option key={l} value={l}>
                      {l === "short" ? "Short (2-3 min)" : l === "medium" ? "Medium (5-7 min)" : "Long (10-15 min)"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta">Call to Action</Label>
              <Input
                id="cta"
                placeholder="e.g., Subscribe and hit the bell icon"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand-voice">Brand Voice</Label>
              <Textarea
                id="brand-voice"
                placeholder="Describe your brand's tone and personality..."
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">Additional Context</Label>
              <Textarea
                id="context"
                placeholder="Any extra instructions or context for the AI..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Generate Button */}
        <div className="flex justify-end pt-4 pb-4 sticky bottom-0 bg-background/80 backdrop-blur-sm z-10 border-t border-transparent">
          <Button
            onClick={handleSubmit}
            disabled={isGenerating || !topic.trim()}
            size="lg"
            className="gap-2 min-w-[200px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Variations...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {hasContentResult ? "Regenerate New Variations" : "Generate Variations"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Right Pane: Generated Content Viewer */}
      <div className="flex flex-col h-full lg:border-l lg:border-border/50 lg:pl-8">
        <div className="flex-1 flex flex-col space-y-6">
          <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Content Variations</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select the best variation to proceed
            </p>
          </div>
          {hasContentResult && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImprove(!showImprove)}
                className="gap-1.5"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Regenerate Selected
              </Button>
            </div>
          )}
        </div>

        {!hasContentResult && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-24 text-center h-[500px] border-2 border-dashed border-border/50 rounded-xl bg-card/30">
            <Sparkles className="h-8 w-8 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Waiting for generation</h3>
            <p className="text-sm text-muted-foreground max-w-[250px] mt-2">
              Fill out the content brief and click generate to see variations here.
            </p>
          </div>
        )}

        {isGenerating && !hasContentResult && (
          <div className="flex flex-col items-center justify-center py-24 text-center h-[500px] border-2 border-dashed border-border/50 rounded-xl bg-card/30">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-medium">Generating Variations...</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This might take a minute depending on your prompt.
            </p>
          </div>
        )}

        {hasContentResult && (
          <>
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

            {/* Variations List */}
            <div className="space-y-4">
              {variations.map((variation, index) => (
                <Card
                  key={index}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selected === index
                      ? "ring-2 ring-primary border-primary bg-primary/5"
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
                    <div className="prose prose-sm dark:prose-invert max-h-[250px] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
                      {variation.content}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
        </div>

        {/* Proceed Button */}
        {hasContentResult && (
          <div className="flex justify-end pt-4 pb-4 sticky bottom-0 bg-background/80 backdrop-blur-sm z-10 border-t border-transparent">
            <Button
              onClick={onProceed}
              disabled={selected === null}
              size="lg"
              className="gap-2 min-w-[200px]"
            >
              Approve & Proceed to Script
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
