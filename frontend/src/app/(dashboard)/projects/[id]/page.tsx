"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { ContentStudio } from "@/components/pipeline/content-studio";
import { ScriptEditor } from "@/components/pipeline/script-editor";
import { StoryboardEditor } from "@/components/pipeline/storyboard-editor";
import { VoiceAvatarSelector } from "@/components/pipeline/voice-avatar-selector";
import { VideoReview } from "@/components/pipeline/video-review";
import { DeliveryTab } from "@/components/pipeline/delivery-tab";
import {
  usePipelineStatus,
  useGenerateContent,
  useGenerateScript,
  useGenerateStoryboard,
  useGenerateAssets,
  useMergeVideos,
  useRegenerate,
  useSuggestKeyPoints,
  useRegenerateScriptSection,
} from "@/hooks/use-pipeline";
import type { ScriptSection } from "@/hooks/use-pipeline";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  Zap,
  Loader2,
  ArrowRight,
  FileText,
} from "lucide-react";

import { api } from "@/lib/api";

const STAGE_NAMES = [
  "content-studio", // 0
  "content-studio", // 1
  "script",         // 2
  "storyboard",     // 3
  "voice-avatar",   // 4 (unused usually but mapped here)
  "voice-avatar",   // 5
  "video-review",   // 6
  "delivery",       // 7
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);
  const [localSections, setLocalSections] = useState<ScriptSection[] | null>(null);
  const [regeneratingSectionIndex, setRegeneratingSectionIndex] = useState<number | null>(null);

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
  const generateAssets = useGenerateAssets(workspaceId, projectId);
  const mergeVideos = useMergeVideos(workspaceId, projectId);
  const regenerate = useRegenerate(workspaceId, projectId);
  const suggestKeyPoints = useSuggestKeyPoints(workspaceId, projectId);
  const regenerateScriptSection = useRegenerateScriptSection(workspaceId, projectId);

  const currentStage = status?.current_stage ?? 0;
  const [activeTab, setActiveTab] = useState(STAGE_NAMES[currentStage] || "content-studio");

  // Keep tab synced with stage
  useEffect(() => {
    if (status) {
      setActiveTab(STAGE_NAMES[status.current_stage] || "content-studio");
    }
  }, [status?.current_stage]);

  // Sync local section edits when a new script result arrives from the server
  const scriptSections = status?.script_result?.sections;
  useEffect(() => {
    if (scriptSections) {
      setLocalSections(scriptSections);
    }
  }, [scriptSections]);

  const effectiveTab = activeTab;

  const isGenerating =
    generateContent.isPending ||
    generateScript.isPending ||
    generateStoryboard.isPending ||
    generateAssets.isPending ||
    mergeVideos.isPending ||
    regenerate.isPending;

  // ── Handlers ─────────────────────────────────────────

  const handleGenerateContent = async (canvas: Parameters<typeof generateContent.mutateAsync>[0]) => {
    try {
      await generateContent.mutateAsync(canvas);
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
      await generateScript.mutateAsync({ selected_variation_index: selectedVariationIndex });
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
      await regenerate.mutateAsync({
        stage: "script",
        additional_context: additionalContext,
        selected_variation_index: selectedVariationIndex,
      });
      toast.success("Script regenerated!");
    } catch (err: any) {
      toast.error(err?.detail || "Regeneration failed");
    }
  };

  const handleRegenerateSection = async (index: number, context: string) => {
    if (!localSections) return;
    setRegeneratingSectionIndex(index);
    try {
      const updated = await regenerateScriptSection.mutateAsync({
        section_index: index,
        current_section: localSections[index],
        additional_context: context,
      });
      setLocalSections((prev) =>
        prev ? prev.map((s, i) => (i === index ? updated : s)) : prev
      );
      toast.success("Section regenerated!");
    } catch (err: any) {
      toast.error(err?.detail || "Section regeneration failed");
    } finally {
      setRegeneratingSectionIndex(null);
    }
  };

  const handleGenerateStoryboard = async () => {
    const activeScript = localSections
      ? localSections.map((s) => `[${s.section_type.toUpperCase()}]\n${s.text}`).join("\n\n")
      : status?.script_result?.full_script || "";
    try {
      await generateStoryboard.mutateAsync({ script: activeScript });
      setActiveTab("storyboard");
      toast.success("Storyboard generation started...");
    } catch (err: any) {
      toast.error(err?.detail || "Storyboard generation failed");
    }
  };

  const handleGenerateAssets = async (payload: { selected_voice_id: string; selected_avatar_id: string; use_custom_voice: boolean; aspect_ratio: string; video_quality: string }) => {
    try {
      const storyboardResult = status?.storyboard_result;
      if (!storyboardResult) {
        throw new Error("Storyboard data missing. Please save the storyboard first.");
      }

      await generateAssets.mutateAsync({ 
        ...payload,
        storyboard_scenes: storyboardResult.scenes,
        video_frame_size: storyboardResult.video_frame_size || "16:9",
        video_quality: storyboardResult.video_quality || "1080p"
      });
      setActiveTab("video-review");
      toast.success("Asset generation started...");
    } catch (err: any) {
      toast.error(err?.detail || err.message || "Asset generation failed");
    }
  };

  const handleMergeVideos = async () => {
    try {
      await mergeVideos.mutateAsync();
      setActiveTab("delivery");
      toast.success("Video merge started!");
    } catch (err: any) {
      toast.error(err?.detail || "Video merge failed");
    }
  };

  const handleRegenerateScene = async (index: number) => {
    try {
      // Create a modified scenes array where ONLY the selected scene is unapproved
      const storyboardResult = status?.storyboard_result;
      if (!storyboardResult) return;
      
      const modifiedScenes = storyboardResult.scenes.map((scene, i) => ({
        ...scene,
        is_approved: i !== index // unapprove the target scene to regenerate it
      }));
      
      // We need voice_id and avatar_id from previous generation
      // But we can just direct user to voice-avatar tab
      toast.info("Navigating to Voice & Avatar tab. Please re-generate assets.");
      setActiveTab("voice-avatar");
    } catch (err) {
      toast.error("Failed to prepare scene for regeneration.");
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
        {effectiveTab === "content-studio" && (
          <ContentStudio
            initialData={status?.canvas_data || undefined}
            variations={status?.content_result?.variations || []}
            onGenerate={handleGenerateContent}
            onSuggestKeyPoints={handleSuggestKeyPoints}
            onSelect={(index) => setSelectedVariationIndex(index)}
            onRegenerate={handleRegenerateContent}
            onProceed={handleGenerateScript}
            isGenerating={generateContent.isPending}
            isSuggesting={suggestKeyPoints.isPending}
            isRegenerating={regenerate.isPending}
            hasContentResult={!!status?.content_result}
          />
        )}

        {effectiveTab === "script" && (
          <div className="max-w-4xl mx-auto p-6">
            {status?.script_result ? (
              <>
                <ScriptEditor
                  sections={localSections || status.script_result.sections}
                  fullScript={status.script_result.full_script}
                  estimatedDuration={status.script_result.estimated_duration}
                  wordCount={status.script_result.word_count}
                  onRegenerate={handleRegenerateScript}
                  isRegenerating={regenerate.isPending}
                  onSectionsChange={setLocalSections}
                  onRegenerateSection={handleRegenerateSection}
                  isRegeneratingSection={regeneratingSectionIndex}
                />
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleGenerateStoryboard}
                    size="lg"
                    className="gap-2 min-w-[200px]"
                    disabled={generateStoryboard.isPending}
                  >
                    {generateStoryboard.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                    ) : (
                      <>Approve & Proceed to Storyboard <ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                {generateScript.isPending ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Generating script...</p>
                  </>
                ) : (
                  <>
                    <FileText className="h-8 w-8 text-muted-foreground/40 mb-4" />
                    <p className="text-muted-foreground">
                      Select a content variation and click &ldquo;Approve &amp; Proceed to Script&rdquo; to generate your script.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {effectiveTab === "storyboard" && (
          <StoryboardEditor
            workspaceId={workspaceId}
            projectId={projectId}
            initialScenes={status?.storyboard_result?.scenes || []}
            initialVideoFrameSize={status?.storyboard_result?.video_frame_size || "16:9"}
            initialVideoQuality={status?.storyboard_result?.video_quality || "1080p"}
            onProceed={() => setActiveTab("voice-avatar")}
            isGeneratingVoice={false}
            runError={status?.runs?.find(r => r.stage === "storyboard" && r.status === "error")?.error_message ?? undefined}
            onRetry={handleGenerateStoryboard}
          />
        )}

        {effectiveTab === "voice-avatar" && (
          <VoiceAvatarSelector
            workspaceId={workspaceId}
            projectId={projectId}
            onProceed={handleGenerateAssets}
            isGeneratingAssets={generateAssets.isPending}
          />
        )}

        {effectiveTab === "video-review" && (
          <VideoReview
            workspaceId={workspaceId}
            projectId={projectId}
            scenes={status?.storyboard_result?.scenes || []}
            onMerge={handleMergeVideos}
            onRegenerateScene={handleRegenerateScene}
            isMerging={mergeVideos.isPending}
            runError={status?.runs?.find(r => r.stage === "video" && r.status === "error")?.error_message ?? undefined}
          />
        )}

        {effectiveTab === "delivery" && (
          <DeliveryTab
            workspaceId={workspaceId}
            projectId={projectId}
          />
        )}
      </div>
    </div>
  );
}
