"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { CanvasForm } from "@/components/pipeline/canvas-form";
import { ContentViewer } from "@/components/pipeline/content-viewer";
import { ScriptEditor } from "@/components/pipeline/script-editor";
import { StoryboardEditor } from "@/components/pipeline/storyboard-editor";
import { VoiceSelector } from "@/components/pipeline/voice-selector";
import { AvatarSelector } from "@/components/pipeline/avatar-selector";
import {
  usePipelineStatus,
  useGenerateContent,
  useGenerateScript,
  useGenerateStoryboard,
  useGenerateVoice,
  useGenerateAvatar,
  useRegenerate,
  useSuggestKeyPoints,
} from "@/hooks/use-pipeline";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  Zap,
  Clock,
  Loader2,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

import { api } from "@/lib/api";

const STAGE_NAMES = ["canvas", "content", "script", "storyboard", "voice", "avatar", "video"];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user's workspaces
    api.get<Array<{id: string}>>("/api/v1/workspaces").then((workspaces) => {
      if (workspaces && workspaces.length > 0) {
        setWorkspaceId(workspaces[0].id);
      }
    }).catch(console.error);
  }, []);

  const { data: status, isLoading } = usePipelineStatus(workspaceId, projectId);
  
  const generateContent = useGenerateContent(workspaceId, projectId);
  const generateScript = useGenerateScript(workspaceId, projectId);
  const generateStoryboard = useGenerateStoryboard(workspaceId, projectId);
  const generateVoice = useGenerateVoice(workspaceId, projectId);
  const generateAvatar = useGenerateAvatar(workspaceId, projectId);
  const regenerate = useRegenerate(workspaceId, projectId);
  const suggestKeyPoints = useSuggestKeyPoints(workspaceId, projectId);

  const currentStage = status?.current_stage ?? 0;
  const [activeTab, setActiveTab] = useState(STAGE_NAMES[currentStage] || "canvas");

  // Keep tab synced with stage if user hasn't manually clicked another tab recently
  useEffect(() => {
    if (status) {
      setActiveTab(STAGE_NAMES[status.current_stage] || "canvas");
    }
  }, [status?.current_stage]);

  const effectiveTab = activeTab;

  const isGenerating =
    generateContent.isPending ||
    generateScript.isPending ||
    generateStoryboard.isPending ||
    generateVoice.isPending ||
    generateAvatar.isPending ||
    regenerate.isPending;

  // ── Handlers ─────────────────────────────────────────

  const handleGenerateContent = async (canvas: Parameters<typeof generateContent.mutateAsync>[0]) => {
    try {
      await generateContent.mutateAsync(canvas);
      setActiveTab("content");
      toast.success("Content generated!");
    } catch (err: any) {
      toast.error(err?.detail || "Generation failed");
    }
  };

  const handleSuggestKeyPoints = async (topic: string, audience: string) => {
    try {
      const result = await suggestKeyPoints.mutateAsync({ topic, target_audience: audience });
      toast.success("Key points suggested!");
      return result.key_points;
    } catch (err: any) {
      toast.error(err?.detail || "Failed to suggest key points");
      return [];
    }
  };

  const handleGenerateScript = async () => {
    try {
      await generateScript.mutateAsync({});
      setActiveTab("script");
      toast.success("Script generated!");
    } catch (err: any) {
      toast.error(err?.detail || "Script generation failed");
    }
  };

  const handleRegenerateContent = async (additionalContext: string) => {
    try {
      await regenerate.mutateAsync({ stage: "content", additional_context: additionalContext });
      toast.success("Content regenerated!");
    } catch (err: any) {
      toast.error(err?.detail || "Regeneration failed");
    }
  };

  const handleRegenerateScript = async (additionalContext: string) => {
    try {
      await regenerate.mutateAsync({ stage: "script", additional_context: additionalContext });
      toast.success("Script regenerated!");
    } catch (err: any) {
      toast.error(err?.detail || "Regeneration failed");
    }
  };

  const handleGenerateStoryboard = async (script: string) => {
    try {
      await generateStoryboard.mutateAsync({ script });
      setActiveTab("storyboard");
      toast.success("Storyboard generation started...");
    } catch (err: any) {
      toast.error(err?.detail || "Storyboard generation failed");
    }
  };

  const handleGenerateVoice = async (voiceId: string) => {
    try {
      await generateVoice.mutateAsync({ selected_voice_id: voiceId });
      setActiveTab("voice");
      toast.success("Voice generation started...");
    } catch (err: any) {
      toast.error(err?.detail || "Voice generation failed");
    }
  };

  const handleGenerateAvatar = async (avatarId: string) => {
    try {
      await generateAvatar.mutateAsync({ selected_avatar_id: avatarId });
      setActiveTab("avatar");
      toast.success("Video rendering started...");
    } catch (err: any) {
      toast.error(err?.detail || "Avatar generation failed");
    }
  };

  // ── Loading State ────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/projects")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-lg font-semibold">Project Pipeline</h1>
        </div>

        {/* Cost & Token Summary */}
        {status && (status.total_cost_usd > 0 || status.total_tokens > 0) && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              ${status.total_cost_usd.toFixed(4)}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {status.total_tokens.toLocaleString()} tokens
            </span>
          </div>
        )}
      </div>

      {/* Pipeline Tabs */}
      <PipelineTabs
        currentStage={currentStage}
        activeTab={effectiveTab}
        onTabChange={setActiveTab}
        isGenerating={isGenerating}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {effectiveTab === "canvas" && (
          <CanvasForm
            initialData={status?.canvas_data || undefined}
            onGenerate={handleGenerateContent}
            onSuggestKeyPoints={handleSuggestKeyPoints}
            isGenerating={generateContent.isPending}
            isSuggesting={suggestKeyPoints.isPending}
          />
        )}

        {effectiveTab === "content" && status?.content_result && (
          <ContentViewer
            variations={status.content_result.variations}
            onSelect={() => {}}
            onRegenerate={handleRegenerateContent}
            onProceed={handleGenerateScript}
            isRegenerating={regenerate.isPending}
          />
        )}

        {effectiveTab === "content" && !status?.content_result && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Go to Canvas tab to generate content first.
            </p>
          </div>
        )}

        {effectiveTab === "script" && status?.script_result && (
          <div className="max-w-4xl mx-auto p-6">
            <ScriptEditor
              sections={status.script_result.sections}
              fullScript={status.script_result.full_script}
              estimatedDuration={status.script_result.estimated_duration}
              wordCount={status.script_result.word_count}
              onRegenerate={handleRegenerateScript}
              isRegenerating={regenerate.isPending}
            />
            <div className="flex justify-end pt-4">
               <Button 
                onClick={() => handleGenerateStoryboard(status.script_result!.full_script)}
                size="lg" 
                className="gap-2 min-w-[200px]"
                disabled={generateStoryboard.isPending}
               >
                 {generateStoryboard.isPending ? (
                   <><Loader2 className="h-4 w-4 animate-spin"/> Generating...</>
                 ) : (
                   <>Approve & Proceed to Storyboard <ArrowRight className="h-4 w-4" /></>
                 )}
               </Button>
            </div>
          </div>
        )}

        {effectiveTab === "storyboard" && (
          <StoryboardEditor
            scenes={status?.storyboard_result?.scenes || []}
            onProceed={() => setActiveTab("voice")}
            isGeneratingVoice={generateVoice.isPending}
          />
        )}

        {effectiveTab === "voice" && (
          <VoiceSelector
            onProceed={handleGenerateVoice}
            isGeneratingAvatar={generateAvatar.isPending}
          />
        )}

        {effectiveTab === "avatar" && (
          <AvatarSelector
            onProceed={handleGenerateAvatar}
            isGeneratingVideo={generateAvatar.isPending}
          />
        )}

        {effectiveTab === "video" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <h3 className="font-semibold text-xl mb-2">Video Rendered Successfully!</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Your avatar video has been fully rendered using LangGraph background orchestration and HeyGen/ElevenLabs APIs.
            </p>
            <Button size="lg" variant="outline">
              Download Package
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
