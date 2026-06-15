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
} from "lucide-react";
import type { CanvasInput } from "@/hooks/use-pipeline";

interface CanvasFormProps {
  initialData?: Partial<CanvasInput>;
  onGenerate: (data: CanvasInput) => void;
  onSuggestKeyPoints: (topic: string, audience: string) => Promise<string[]>;
  isGenerating: boolean;
  isSuggesting: boolean;
}

const TONES = ["professional", "casual", "humorous", "educational", "inspirational", "dramatic"];
const LENGTHS = ["short", "medium", "long"];
const PLATFORMS = ["youtube", "tiktok", "instagram", "linkedin", "twitter", "generic"];

export function CanvasForm({
  initialData,
  onGenerate,
  onSuggestKeyPoints,
  isGenerating,
  isSuggesting,
}: CanvasFormProps) {
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

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* Topic */}
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

      {/* Generate Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || !topic.trim()}
          size="lg"
          className="gap-2 min-w-[200px]"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Content...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Content
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
