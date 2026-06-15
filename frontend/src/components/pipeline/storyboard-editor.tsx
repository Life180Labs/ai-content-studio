"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Image as ImageIcon, Camera, User, FileText, Loader2, Plus, Trash2, RefreshCw, Save } from "lucide-react";
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
  
  // Keep synced if backend updates
  useEffect(() => {
    if (initialScenes.length > 0) setScenes(initialScenes);
    if (initialVideoFrameSize) setVideoFrameSize(initialVideoFrameSize);
    if (initialVideoQuality) setVideoQuality(initialVideoQuality);
  }, [initialScenes, initialVideoFrameSize, initialVideoQuality]);

  const saveStoryboard = useSaveStoryboard(workspaceId, projectId);
  const regenerateScene = useRegenerateScene(workspaceId, projectId);

  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

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

  const updateScene = (index: number, field: keyof StoryboardScene, value: string) => {
    const newScenes = [...scenes];
    newScenes[index] = { ...newScenes[index], [field]: value };
    setScenes(newScenes);
  };

  const addScene = () => {
    const newIndex = scenes.length > 0 ? Math.max(...scenes.map(s => s.scene_index)) + 1 : 1;
    setScenes([...scenes, {
      scene_index: newIndex,
      voice_text: "",
      visual_prompt: "",
      avatar_action: "",
      camera_direction: ""
    }]);
  };

  const deleteScene = (index: number) => {
    setScenes(scenes.filter((_, i) => i !== index));
  };

  const handleRegenerateScene = async (index: number) => {
    const context = window.prompt("What changes would you like to make to this scene?");
    if (context === null) return; // cancelled
    
    setRegeneratingIndex(index);
    try {
      const updatedScene = await regenerateScene.mutateAsync({
        scene_index: scenes[index].scene_index,
        additional_context: context,
        current_scene: scenes[index]
      });
      
      const newScenes = [...scenes];
      newScenes[index] = updatedScene;
      setScenes(newScenes);
      toast.success(`Scene ${scenes[index].scene_index} regenerated!`);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to regenerate scene");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveStoryboard.mutateAsync({ scenes, video_frame_size: videoFrameSize, video_quality: videoQuality });
      toast.success("Storyboard saved successfully!");
      return true;
    } catch (err: any) {
      toast.error(err?.detail || "Failed to save storyboard");
      return false;
    }
  };

  const handleProceed = async () => {
    const success = await handleSaveDraft();
    if (success) {
      onProceed();
    }
  };

  const estimateDuration = (text: string) => {
    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    return Math.ceil(wordCount / 2.5);
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Storyboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and edit the AI-generated scenes before generating voice and video.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Format:</span>
            <Select value={videoFrameSize} onValueChange={(v) => v && setVideoFrameSize(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Quality:</span>
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
      </div>

      <div className="space-y-4">
        {scenes.map((scene, index) => {
          const duration = estimateDuration(scene.voice_text);
          const isOverLimit = duration > 8;

          return (
            <Card key={index} className="border-border/50 overflow-hidden relative group">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => handleRegenerateScene(index)}
                  disabled={regeneratingIndex === index}
                >
                  {regeneratingIndex === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Regenerate</span>
                </Button>
                <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => deleteScene(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-col md:flex-row relative">
                {regeneratingIndex === index && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
                    <div className="bg-card p-4 rounded-lg shadow-lg border border-border flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="font-medium">Regenerating scene...</span>
                    </div>
                  </div>
                )}

                {/* Left Column: Visual Prompt Representation */}
                <div className="md:w-5/12 bg-muted/30 p-6 border-r border-border/50 flex flex-col justify-start">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="outline" className="w-fit bg-background">
                      Scene {scene.scene_index}
                    </Badge>
                  </div>
                  <div className="space-y-4 text-sm flex-1">
                    <div className="space-y-2">
                      <span className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Visual Prompt
                      </span>
                      <Textarea 
                        value={scene.visual_prompt} 
                        onChange={(e) => updateScene(index, "visual_prompt", e.target.value)}
                        className="text-sm min-h-[100px] resize-y bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <span className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5">
                        <Camera className="h-3.5 w-3.5" />
                        Camera Direction
                      </span>
                      <Input 
                        value={scene.camera_direction} 
                        onChange={(e) => updateScene(index, "camera_direction", e.target.value)}
                        className="bg-background"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Avatar & Voice */}
                <div className="md:w-7/12 p-6 flex flex-col justify-start space-y-4">
                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-primary flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Spoken Script
                      </span>
                      <Badge variant={isOverLimit ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {duration}s {isOverLimit && "(> 8s limit)"}
                      </Badge>
                    </div>
                    <Textarea 
                      value={scene.voice_text} 
                      onChange={(e) => updateScene(index, "voice_text", e.target.value)}
                      className="text-base min-h-[100px] resize-y bg-background border-primary/20"
                    />
                  </div>
                  
                  <div className="flex items-start gap-2 pt-2">
                    <User className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <span className="font-semibold text-xs text-muted-foreground block">
                        Avatar Action
                      </span>
                      <Input 
                        value={scene.avatar_action} 
                        onChange={(e) => updateScene(index, "avatar_action", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center pt-2">
        <Button variant="outline" className="gap-2 w-full max-w-xs border-dashed" onClick={addScene}>
          <Plus className="h-4 w-4" />
          Add New Scene
        </Button>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={saveStoryboard.isPending}
          className="gap-2"
        >
          {saveStoryboard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Draft
        </Button>

        <Button
          onClick={handleProceed}
          size="lg"
          className="gap-2 min-w-[200px]"
          disabled={isGeneratingVoice || saveStoryboard.isPending}
        >
          {isGeneratingVoice || saveStoryboard.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving & Preparing...
            </>
          ) : (
            <>
              Approve & Select Voice
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
