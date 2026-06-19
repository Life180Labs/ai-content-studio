"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  Film,
  FileText,
  FileJson,
  CheckCircle2,
  Package,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface DeliveryTabProps {
  workspaceId: string | null;
  projectId: string;
}

export function DeliveryTab({ workspaceId, projectId }: DeliveryTabProps) {
  const base = workspaceId
    ? `/api/v1/workspaces/${workspaceId}/projects/${projectId}/pipeline`
    : null;

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Fetch the merged final video as an authenticated blob for inline playback.
  useEffect(() => {
    if (!base) return;
    let revoked = false;
    let objectUrl: string | null = null;

    setVideoLoading(true);
    setVideoError(false);

    api
      .getBlob(`${base}/video`)
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      })
      .catch(() => {
        if (revoked) return;
        setVideoError(true);
      })
      .finally(() => {
        if (!revoked) setVideoLoading(false);
      });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [base]);

  const handleDownloadMp4 = () => {
    if (!videoUrl) return;
    const link = document.createElement("a");
    link.href = videoUrl;
    link.setAttribute("download", `${projectId}_final.mp4`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadPackage = async () => {
    if (!base) return;
    setDownloadingZip(true);
    try {
      const blob = await api.getBlob(`${base}/package`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${projectId}_package.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download package. Make sure the video has been merged.");
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      <div className="text-center space-y-4 py-8">
        <div className="mx-auto w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Your Video is Ready!</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          The final video has been merged and all assets are prepared for delivery.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 overflow-hidden border-2 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              Final Output Video
            </CardTitle>
            <CardDescription>
              The concatenated video of all approved scenes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="aspect-video bg-black rounded-lg border flex items-center justify-center overflow-hidden relative">
              {videoLoading ? (
                <div className="flex flex-col items-center justify-center text-white/80">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <p className="text-sm">Loading final video…</p>
                </div>
              ) : videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                  preload="metadata"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 text-white/80">
                  <AlertCircle className="h-10 w-10 mb-3 opacity-60" />
                  <p className="font-medium">Final video not available yet</p>
                  <p className="text-sm opacity-70 mt-1">
                    Merge the approved scenes in the Video Review tab first.
                  </p>
                </div>
              )}
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleDownloadMp4}
              disabled={!videoUrl}
            >
              <Download className="h-5 w-5" />
              Download Final Video (.mp4)
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Project Package
              </CardTitle>
              <CardDescription>
                Download all generated project assets
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3 text-sm">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  <span>Final Merged Video (.mp4)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  <span>Individual Scene Videos (.mp4)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Audio Voiceovers (.mp3)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Final Script (.txt)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                  <span>Storyboard Data (.json)</span>
                </div>
              </div>

              <div className="pt-6 mt-auto border-t">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full gap-2 text-md"
                  onClick={handleDownloadPackage}
                  disabled={downloadingZip}
                >
                  {downloadingZip ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  Download Package (.zip)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
