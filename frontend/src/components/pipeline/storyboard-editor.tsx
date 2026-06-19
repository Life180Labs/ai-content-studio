"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight,
  Image as ImageIcon,
  Camera,
  User,
  FileText,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryboardScene } from "@/hooks/use-pipeline";
import { useSaveStoryboard, useRegenerateScene } from "@/hooks/use-pipeline";
import { toast } from "sonner";

interface StoryboardEditorProps {
  workspaceId: string | null;
  projectId: string;
  initialScenes: StoryboardScene[];
  initialVideoFrameSize: string;
  initialVideoQuality: string;
  onProceed: () => void;
  isGeneratingVoice: boolean;
  runError?: string;
  onRetry?: () => void;
}

export function StoryboardEditor({
  workspaceId,
  projectId,
  initialScenes,
  initialVideoFrameSize,
  initialVideoQuality,
  onProceed,
  isGeneratingVoice,
  runError,
  onRetry,
}: StoryboardEditorProps) {
  const [scenes, setScenes] = useState<StoryboardScene[]>(initialScenes);
  const [videoFrameSize, setVideoFrameSize] = useState(initialVideoFrameSize);
  const [videoQuality, setVideoQuality] = useState(initialVideoQuality);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  // Fingerprint based on scene count + content only (not included/deleted).
  // Polling returns new array refs with identical data — we must not let those
  // overwrite the user's local include/exclude or edit state.
  const scenesFingerprintRef = useRef<string>("");

  useEffect(() => {
    if (initialScenes.length === 0) return;

    const fingerprint = initialScenes
      .map((s) => `${s.scene_index}:${s.voice_text}:${s.visual_prompt}`)
      .join("|");

    if (fingerprint === scenesFingerprintRef.current) return;
    scenesFingerprintRef.current = fingerprint;

    // Merge: apply new server content but keep local included/deleted per scene
    setScenes((prev) => {
      if (prev.length === 0) return initialScenes;
      return initialScenes.map((incoming) => {
        const local = prev.find((s) => s.scene_index === incoming.scene_index);
        return local
          ? { ...incoming, included: local.included, deleted: local.deleted }
          : incoming;
      });
    });
  }, [initialScenes]);

  useEffect(() => {
    if (initialVideoFrameSize) setVideoFrameSize(initialVideoFrameSize);
  }, [initialVideoFrameSize]);

  useEffect(() => {
    if (initialVideoQuality) setVideoQuality(initialVideoQuality);
  }, [initialVideoQuality]);

  const saveStoryboard = useSaveStoryboard(workspaceId, projectId);
  const regenerateScene = useRegenerateScene(workspaceId, projectId);

  if (runError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-destructive/10 text-destructive p-4 rounded-full mb-4">
          <Trash2 className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Generation Failed</h3>
        <p className="text-muted-foreground max-w-md mb-6">{runError}</p>
        {onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (!scenes || scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Generating storyboard scenes...</p>
      </div>
    );
  }

  const activeScenes = scenes.filter((s) => !s.deleted);
  const includedCount = activeScenes.filter((s) => s.included !== false).length;
  const totalCount = activeScenes.length;

  const updateScene = (index: number, field: keyof StoryboardScene, value: any) => {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const toggleInclude = (index: number) => {
    updateScene(index, "included", scenes[index].included === false ? true : false);
  };

  const selectAll = () =>
    setScenes((prev) => prev.map((s) => (s.deleted ? s : { ...s, included: true })));
  const deselectAll = () =>
    setScenes((prev) => prev.map((s) => (s.deleted ? s : { ...s, included: false })));

  const addScene = () => {
    const maxIdx = scenes.length > 0 ? Math.max(...scenes.map((s) => s.scene_index)) + 1 : 1;
    setScenes((prev) => [
      ...prev,
      {
        scene_index: maxIdx,
        voice_text: "",
        visual_prompt: "",
        avatar_action: "",
        camera_direction: "",
        included: true,
        deleted: false,
        scene_id: crypto.randomUUID(),
      },
    ]);
  };

  const deleteScene = (index: number) => updateScene(index, "deleted", true);

  const handleRegenerateScene = async (index: number) => {
    const context = window.prompt("What changes would you like to make to this scene?");
    if (context === null) return;

    setRegeneratingIndex(index);
    try {
      const updatedScene = await regenerateScene.mutateAsync({
        scene_index: scenes[index].scene_index,
        additional_context: context,
        current_scene: scenes[index],
      });
      setScenes((prev) => prev.map((s, i) => (i === index ? updatedScene : s)));
      toast.success(`Scene ${scenes[index].scene_index} regenerated!`);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to regenerate scene");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveStoryboard.mutateAsync({
        scenes,
        video_frame_size: videoFrameSize,
        video_quality: videoQuality,
      });
      toast.success("Storyboard saved!");
      return true;
    } catch (err: any) {
      toast.error(err?.detail || "Failed to save storyboard");
      return false;
    }
  };

  const handleProceed = async () => {
    if (includedCount === 0) {
      toast.error("Include at least one scene before proceeding.");
      return;
    }
    const success = await handleSaveDraft();
    if (success) onProceed();
  };

  const estimateDuration = (text: string) => {
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
    return Math.ceil(words / 2.5);
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Storyboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Toggle scenes on/off to control which ones are rendered by HeyGen.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Format & Quality */}
          <Select value={videoFrameSize} onValueChange={(v) => v && setVideoFrameSize(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">16:9 Landscape</SelectItem>
              <SelectItem value="9:16">9:16 Portrait</SelectItem>
              <SelectItem value="1:1">1:1 Square</SelectItem>
            </SelectContent>
          </Select>
          <Select value={videoQuality} onValueChange={(v) => v && setVideoQuality(v)}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="720p">720p</SelectItem>
              <SelectItem value="1080p">1080p</SelectItem>
              <SelectItem value="4k">4K UHD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selection bar */}
      <div className="flex items-center justify-between bg-muted/40 border border-border rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-full", includedCount > 0 ? "bg-green-500" : "bg-destructive")} />
            <span className="text-sm font-medium">
              {includedCount} of {totalCount} scenes selected for rendering
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={selectAll}>
            <CheckSquare className="h-3.5 w-3.5" />
            Select All
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={deselectAll}>
            <Square className="h-3.5 w-3.5" />
            Deselect All
          </Button>
        </div>
      </div>

      {/* Scene cards */}
      <div className="space-y-4">
        {scenes.map((scene, index) => {
          if (scene.deleted) return null;

          const isIncluded = scene.included !== false;
          const duration = estimateDuration(scene.voice_text);
          const isOverLimit = duration > 8;

          return (
            <Card
              key={scene.scene_id || index}
              className={cn(
                "overflow-hidden border-2 transition-all duration-200",
                isIncluded
                  ? "border-border/50 bg-card"
                  : "border-border/30 bg-muted/20"
              )}
            >
              {/* Scene header bar */}
              <div
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 border-b",
                  isIncluded ? "border-border/50 bg-muted/20" : "border-border/20 bg-muted/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={isIncluded ? "outline" : "secondary"}
                    className={cn("font-mono text-xs", isIncluded ? "border-primary/30 text-primary" : "text-muted-foreground")}
                  >
                    Scene {scene.scene_index}
                  </Badge>
                  <Badge
                    variant={isOverLimit ? "destructive" : "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    ~{duration}s{isOverLimit && " ⚠ over 8s"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {/* Include / Exclude toggle — always visible */}
                  <button
                    onClick={() => toggleInclude(index)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all",
                      isIncluded
                        ? "bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20"
                        : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {isIncluded ? (
                      <><Eye className="h-3.5 w-3.5" /> Include</>
                    ) : (
                      <><EyeOff className="h-3.5 w-3.5" /> Excluded</>
                    )}
                  </button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => handleRegenerateScene(index)}
                    disabled={regeneratingIndex === index}
                  >
                    {regeneratingIndex === index ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Regen</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteScene(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Scene body — dimmed when excluded */}
              <div
                className={cn(
                  "relative flex flex-col md:flex-row transition-opacity duration-200",
                  !isIncluded && "opacity-40 pointer-events-none"
                )}
              >
                {regeneratingIndex === index && (
                  <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-20 flex items-center justify-center rounded-b-xl">
                    <div className="bg-card px-4 py-3 rounded-lg shadow-lg border border-border flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">Regenerating...</span>
                    </div>
                  </div>
                )}

                {/* Left: Visual / Camera */}
                <div className="md:w-5/12 bg-muted/20 p-5 border-r border-border/40 space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" /> Visual Prompt
                    </label>
                    <Textarea
                      value={scene.visual_prompt}
                      onChange={(e) => updateScene(index, "visual_prompt", e.target.value)}
                      className="text-sm min-h-[90px] resize-y bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5" /> Camera Direction
                    </label>
                    <Input
                      value={scene.camera_direction}
                      onChange={(e) => updateScene(index, "camera_direction", e.target.value)}
                      className="bg-background text-sm"
                    />
                  </div>
                </div>

                {/* Right: Script / Avatar Action */}
                <div className="md:w-7/12 p-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-xs text-primary flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Spoken Script
                    </label>
                    <Textarea
                      value={scene.voice_text}
                      onChange={(e) => updateScene(index, "voice_text", e.target.value)}
                      className="text-sm min-h-[90px] resize-y bg-background border-primary/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Avatar Action
                    </label>
                    <Input
                      value={scene.avatar_action}
                      onChange={(e) => updateScene(index, "avatar_action", e.target.value)}
                      className="bg-background text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Excluded overlay label */}
              {!isIncluded && (
                <div className="px-4 py-2 bg-muted/60 border-t border-border/30 flex items-center gap-2">
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    This scene is excluded and will not be rendered. Click <strong>Excluded</strong> above to include it.
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add scene */}
      <div className="flex justify-center pt-2">
        <Button variant="outline" className="gap-2 w-full max-w-xs border-dashed" onClick={addScene}>
          <Plus className="h-4 w-4" />
          Add New Scene
        </Button>
      </div>

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-border mt-4">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={saveStoryboard.isPending}
          className="gap-2 w-full sm:w-auto"
        >
          {saveStoryboard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Draft
        </Button>

        <Button
          onClick={handleProceed}
          size="lg"
          className="gap-2 w-full sm:w-auto sm:min-w-[220px]"
          disabled={isGeneratingVoice || saveStoryboard.isPending || includedCount === 0}
        >
          {isGeneratingVoice || saveStoryboard.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Approve {includedCount} Scene{includedCount !== 1 ? "s" : ""} & Select Voice
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
