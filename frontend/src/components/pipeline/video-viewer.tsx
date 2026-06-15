"use client";

import { usePollVideoStatus } from "@/hooks/use-pipeline";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Video, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryboardScene } from "@/hooks/use-pipeline";

interface VideoViewerProps {
  workspaceId: string | null;
  projectId: string;
  scenes: StoryboardScene[];
}

export function VideoViewer({ workspaceId, projectId, scenes }: VideoViewerProps) {
  // Always poll if on this tab
  const { data: videoStatus, isPending } = usePollVideoStatus(workspaceId, projectId, true);

  // If no initial data and it's still loading the very first time
  if (isPending && !videoStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Connecting to render engine...</h2>
        <p className="text-muted-foreground">Checking video generation status.</p>
      </div>
    );
  }

  const videos = videoStatus?.videos || {};
  
  // Calculate overall progress
  const totalScenes = scenes.length;
  const completedScenes = Object.values(videos).filter((v: any) => v.status === "completed").length;
  const failedScenes = Object.values(videos).filter((v: any) => v.status === "failed").length;
  const inProgress = totalScenes - completedScenes - failedScenes;
  
  const allCompleted = completedScenes === totalScenes && totalScenes > 0;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            {allCompleted ? <CheckCircle2 className="h-6 w-6 text-success" /> : <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            {allCompleted ? "Video Generation Complete" : "Rendering Videos..."}
          </h2>
          <p className="text-muted-foreground mt-1">
            {completedScenes} of {totalScenes} scenes completed. {inProgress > 0 && `(${inProgress} in progress)`}
          </p>
        </div>
        
        {allCompleted && (
          <Button size="lg" className="gap-2">
            <Download className="h-4 w-4" />
            Download Package
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {scenes.map((scene, index) => {
          const vStatus = videos[index.toString()];
          const status = vStatus?.status || "pending";
          const videoUrl = vStatus?.video_url;

          return (
            <Card key={index} className="overflow-hidden border-border/50 bg-muted/10">
              <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">Scene {scene.scene_index}</Badge>
                  {status === "completed" && <Badge variant="default" className="bg-success">Ready</Badge>}
                  {(status === "pending" || status === "processing") && <Badge variant="secondary" className="animate-pulse">Rendering...</Badge>}
                  {status === "failed" && <Badge variant="destructive">Failed</Badge>}
                </div>
              </div>
              
              <div className="aspect-video bg-black/5 flex items-center justify-center relative group">
                {status === "completed" && videoUrl ? (
                  <video 
                    src={videoUrl} 
                    controls 
                    className="w-full h-full object-cover"
                    poster=""
                  />
                ) : status === "failed" ? (
                  <div className="flex flex-col items-center text-destructive">
                    <AlertCircle className="h-10 w-10 mb-2 opacity-50" />
                    <span className="text-sm font-medium">Generation Failed</span>
                    <span className="text-xs opacity-70 px-4 text-center mt-1">{vStatus?.error_message || "Unknown error"}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Video className="h-10 w-10 mb-4 opacity-20" />
                    <Loader2 className="h-6 w-6 animate-spin opacity-50 mb-2" />
                    <span className="text-sm font-medium">Rendering on HeyGen servers...</span>
                  </div>
                )}
              </div>
              
              <CardContent className="p-4 bg-card">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  <span className="font-semibold text-foreground">Script:</span> {scene.voice_text}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
