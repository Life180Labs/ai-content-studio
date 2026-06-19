"use client";

import { useState } from "react";
import { usePollVideoStatus } from "@/hooks/use-pipeline";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StoryboardScene } from "@/hooks/use-pipeline";
import { Loader2, Video, CheckCircle2, AlertCircle, RefreshCcw, Film } from "lucide-react";

interface VideoReviewProps {
  workspaceId: string | null;
  projectId: string;
  scenes: StoryboardScene[];
  onMerge: () => void;
  onRegenerateScene: (index: number) => void;
  isMerging: boolean;
  runError?: string;
}

export function VideoReview({
  workspaceId,
  projectId,
  scenes,
  onMerge,
  onRegenerateScene,
  isMerging,
  runError,
}: VideoReviewProps) {
  const { data: videoStatus, isPending } = usePollVideoStatus(workspaceId, projectId, true);
  const [approvedScenes, setApprovedScenes] = useState<Record<number, boolean>>({});

  const toggleApproval = (index: number) => {
    setApprovedScenes((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  if (isPending && !videoStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold mb-2">Connecting to render engine...</h2>
        <p className="text-muted-foreground">Fetching video generation status from HeyGen.</p>
      </div>
    );
  }

  const videos = videoStatus?.videos || {};

  // Only the scenes the user kept in the storyboard are rendered by HeyGen.
  // Excluded/deleted scenes never get a clip, so they must not be counted here.
  const activeScenes = scenes.filter((s) => (s.included ?? true) && !s.deleted);

  // Backend keys each clip by the scene's `scene_index` (not its array position).
  const sceneVideo = (scene: StoryboardScene) => videos[String(scene.scene_index)];

  const totalScenes = activeScenes.length;
  const completedScenesCount = activeScenes.filter(
    (s) => sceneVideo(s)?.status === "completed"
  ).length;
  const allCompleted = totalScenes > 0 && completedScenesCount === totalScenes;

  // A scene is fully approved only once its checkbox is ticked (keyed by scene_index).
  const allApproved = totalScenes > 0 && activeScenes.every((s) => approvedScenes[s.scene_index]);

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            {allCompleted ? <CheckCircle2 className="h-6 w-6 text-success" /> : <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            {allCompleted ? "Video Generation Complete" : "Rendering Videos..."}
          </h2>
          <p className="text-muted-foreground mt-1">
            {completedScenesCount} of {totalScenes} scenes completed.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            size="lg"
            onClick={onMerge}
            disabled={!allCompleted || !allApproved || isMerging}
            className="gap-2"
          >
            {isMerging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Film className="h-4 w-4" />
            )}
            {isMerging ? "Merging Final Video..." : "Merge Final Video"}
          </Button>
        </div>
      </div>

      {runError && (
        <div className="bg-destructive/10 border-l-4 border-destructive text-destructive text-sm px-4 py-3 rounded-md flex items-start gap-3 w-full">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold mb-1">Generation Failed</p>
            <span className="break-all">{runError}</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {activeScenes.map((scene, i) => {
          const sceneKey = scene.scene_index;
          const displayNumber = i + 1;
          const vStatus = sceneVideo(scene);
          const status = vStatus?.status || "pending";
          const isCompleted = status === "completed";
          const isFailed = status === "failed";
          const videoUrl = vStatus?.video_url;

          return (
            <Card key={scene.scene_id || sceneKey} className={`overflow-hidden flex flex-col transition-all ${approvedScenes[sceneKey] ? "ring-2 ring-primary border-primary bg-primary/5" : ""}`}>
              <div className="relative aspect-video bg-muted border-b flex items-center justify-center overflow-hidden">
                {isCompleted && videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                ) : isFailed ? (
                  <div className="text-center p-4">
                    <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm font-medium text-destructive">Failed to render</p>
                    {vStatus?.error_message && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2" title={vStatus.error_message}>
                        {vStatus.error_message}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground font-medium capitalize">{status}</p>
                  </div>
                )}
                
                <div className="absolute top-2 left-2 flex gap-2">
                  <Badge className="bg-background/80 backdrop-blur text-foreground hover:bg-background/90 shadow-sm border-0">
                    Scene {displayNumber}
                  </Badge>
                  {isCompleted && (
                    <Badge className="bg-success/90 hover:bg-success text-success-foreground border-0 shadow-sm">
                      Ready
                    </Badge>
                  )}
                </div>
              </div>

              <CardContent className="flex flex-col flex-1 p-4 space-y-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3" title={scene.voice_text}>
                    "{scene.voice_text}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`approve-${sceneKey}`}
                      checked={approvedScenes[sceneKey] || false}
                      onCheckedChange={() => toggleApproval(sceneKey)}
                      disabled={!isCompleted}
                    />
                    <label
                      htmlFor={`approve-${sceneKey}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Approve Scene
                    </label>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Regenerate this scene"
                    onClick={() => onRegenerateScene(sceneKey)}
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
