"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Image as ImageIcon, Camera, User, FileText, Loader2 } from "lucide-react";
import type { StoryboardScene } from "@/hooks/use-pipeline";

interface StoryboardEditorProps {
  scenes: StoryboardScene[];
  onProceed: () => void;
  isGeneratingVoice: boolean;
}

export function StoryboardEditor({
  scenes,
  onProceed,
  isGeneratingVoice,
}: StoryboardEditorProps) {
  if (!scenes || scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Generating storyboard scenes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Storyboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review the AI-generated scenes before generating voice and video.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {scenes.map((scene, index) => (
          <Card key={index} className="border-border/50 overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Left Column: Visual Prompt Representation */}
              <div className="md:w-1/3 bg-muted/30 p-6 border-r border-border/50 flex flex-col justify-center">
                <Badge variant="outline" className="w-fit mb-3 bg-background">
                  Scene {scene.scene_index}
                </Badge>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Visual Prompt
                    </span>
                    <p className="leading-relaxed">{scene.visual_prompt}</p>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <span className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Camera className="h-3.5 w-3.5" />
                      Camera Direction
                    </span>
                    <p className="text-muted-foreground">{scene.camera_direction}</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Avatar & Voice */}
              <div className="md:w-2/3 p-6 flex flex-col justify-center space-y-4">
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                  <span className="font-semibold text-xs text-primary flex items-center gap-1.5 mb-2">
                    <FileText className="h-3.5 w-3.5" />
                    Spoken Script
                  </span>
                  <p className="text-base leading-relaxed">"{scene.voice_text}"</p>
                </div>
                
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-xs text-muted-foreground block mb-0.5">
                      Avatar Action
                    </span>
                    <p className="text-sm">{scene.avatar_action}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={onProceed}
          size="lg"
          className="gap-2 min-w-[200px]"
          disabled={isGeneratingVoice}
        >
          {isGeneratingVoice ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing Voice...
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
