"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Video, Square, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";

export default function MobileRecordPage() {
  const searchParams = useSearchParams();

  const sessionId = searchParams.get("session_id") || "";
  const workspaceId = searchParams.get("workspace_id") || "";
  const recordType = searchParams.get("type") || "training";
  const name = searchParams.get("name") || "Subject";

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [recording, setRecording] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!sessionId || !workspaceId) {
      setError("Missing session_id or workspace_id. Invalid QR code.");
      return;
    }

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch (err) {
        setError("Camera access denied. Please allow camera permissions and reload.");
      }
    };

    initCamera();

    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [sessionId, workspaceId]);

  const startRecording = () => {
    if (!mediaStreamRef.current) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType: "video/webm" });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      if (blob.size > 0) setHasVideo(true);
      else toast.error("Recording is empty.");
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const resetRecording = () => {
    chunksRef.current = [];
    setHasVideo(false);
  };

  const uploadVideo = async () => {
    if (chunksRef.current.length === 0) {
      toast.error("No video recorded.");
      return;
    }

    setUploading(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const fd = new FormData();
      fd.append("file", blob, `${recordType}-${sessionId}.webm`);

      const protocol = window.location.protocol;
      const host = window.location.host;
      const uploadUrl = `${protocol}//${host}/api/v1/workspaces/${workspaceId}/digital-humans/mobile-session/${sessionId}`;

      const res = await fetch(uploadUrl, { method: "POST", body: fd });

      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      toast.success("Video uploaded! Close this tab and check your form.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      toast.error(msg);
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  if (error?.includes("Missing")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-destructive font-medium">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl">Record {recordType === "training" ? "Training" : "Consent"} Video</CardTitle>
          <CardDescription>
            {recordType === "training"
              ? "Speak clearly for 2–5 minutes."
              : `"I, ${name}, hereby authorize HeyGen to use this footage."`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {cameraReady ? (
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {recording && (
                <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium animate-pulse">
                  REC
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            {!hasVideo ? (
              recording ? (
                <Button onClick={stopRecording} variant="destructive" className="gap-2 flex-1">
                  <Square className="h-4 w-4" /> Stop
                </Button>
              ) : (
                <Button onClick={startRecording} disabled={!cameraReady} className="gap-2 flex-1">
                  <Video className="h-4 w-4" /> Start
                </Button>
              )
            ) : (
              <>
                <Button onClick={resetRecording} variant="outline" className="gap-2 flex-1">
                  <RotateCcw className="h-4 w-4" /> Retake
                </Button>
                <Button onClick={uploadVideo} disabled={uploading} className="gap-2 flex-1 bg-green-600 hover:bg-green-700">
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!uploading && <Upload className="h-4 w-4" />} Upload
                </Button>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Close this tab after uploading. Video appears in your form automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
