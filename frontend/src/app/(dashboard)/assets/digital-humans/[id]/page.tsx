"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspaces } from "@/hooks/use-projects";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Mic,
  User,
  Video,
  Upload,
  CheckCircle2,
  RefreshCw,
  Trash2,
} from "lucide-react";

export default function DigitalHumanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.[0] || null;

  const [dh, setDh] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Voice re-generation state
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [regeneratingVoice, setRegeneratingVoice] = useState(false);

  // Avatar re-generation state
  const [trainingVideo, setTrainingVideo] = useState<File | null>(null);
  const [consentVideo, setConsentVideo] = useState<File | null>(null);
  const [regeneratingAvatar, setRegeneratingAvatar] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  const voiceInputRef = useRef<HTMLInputElement>(null);
  const trainingInputRef = useRef<HTMLInputElement>(null);
  const consentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentWorkspace || !id) return;
    const fetchDh = async () => {
      try {
        const data = await api.get(
          `/api/v1/workspaces/${currentWorkspace.id}/digital-humans/${id}`
        );
        setDh(data);
      } catch {
        toast.error("Failed to load digital human.");
      } finally {
        setLoading(false);
      }
    };
    fetchDh();
  }, [currentWorkspace, id]);

  const handleRegenerateVoice = async () => {
    if (!voiceFile || !dh?.voice_clone?.id) return;
    setRegeneratingVoice(true);
    try {
      const fd = new FormData();
      fd.append("name", dh.voice_clone.name);
      fd.append("description", "");
      fd.append("file", voiceFile);
      const updated: any = await api.post(
        `/api/v1/workspaces/${currentWorkspace!.id}/digital-humans/voice-clones/${dh.voice_clone.id}/regenerate`,
        fd
      );
      setDh((prev: any) => ({ ...prev, voice_clone: updated }));
      setVoiceFile(null);
      toast.success("Voice clone updated with new audio sample.");
    } catch (err: any) {
      toast.error(err?.detail || err?.error?.message || "Voice re-generation failed.");
    } finally {
      setRegeneratingVoice(false);
    }
  };

  const handleRegenerateAvatar = async () => {
    if (!trainingVideo || !consentVideo || !dh?.avatar_clone?.id) return;
    setRegeneratingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("name", dh.avatar_clone.name);
      fd.append("training_video", trainingVideo);
      fd.append("consent_video", consentVideo);
      const updated: any = await api.post(
        `/api/v1/workspaces/${currentWorkspace!.id}/digital-humans/avatar-clones/${dh.avatar_clone.id}/regenerate`,
        fd
      );
      setDh((prev: any) => ({ ...prev, avatar_clone: updated }));
      setTrainingVideo(null);
      setConsentVideo(null);
      toast.success("Avatar clone submitted for re-processing.");
    } catch (err: any) {
      toast.error(err?.detail || err?.error?.message || "Avatar re-generation failed.");
    } finally {
      setRegeneratingAvatar(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${dh?.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(
        `/api/v1/workspaces/${currentWorkspace!.id}/digital-humans/${id}`
      );
      toast.success("Digital Human deleted.");
      router.push("/assets/digital-humans");
    } catch (err: any) {
      toast.error(err?.detail || "Failed to delete.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dh) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Digital Human not found.</p>
        <Link href="/assets/digital-humans">
          <Button variant="outline">Back to Library</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background/50"><div className="max-w-4xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/assets/digital-humans">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{dh.name}</h1>
            <p className="text-muted-foreground">{dh.role}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{dh.voice_tone}</Badge>
          <Badge variant="outline">{dh.accent}</Badge>
        </div>
      </div>

      {/* Preview Video */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {dh.preview_video_url ? (
              <video
                src={dh.preview_video_url}
                controls
                className="w-full h-full object-contain"
                preload="metadata"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <User className="h-12 w-12 opacity-30" />
                <span className="text-sm">No preview video yet</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Voice Clone Re-generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" />
            Voice Clone
          </CardTitle>
          <CardDescription>
            Upload a new audio sample to improve the voice clone quality.
            Current HeyGen voice ID:{" "}
            <code className="text-xs bg-muted px-1 rounded">
              {dh.voice_clone?.heygen_voice_id ?? "N/A"}
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer relative"
            onClick={() => voiceInputRef.current?.click()}
          >
            <input
              ref={voiceInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => setVoiceFile(e.target.files?.[0] || null)}
            />
            {voiceFile ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">{voiceFile.name}</span>
              </div>
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Upload a 1–5 min clean audio sample (.mp3, .wav)
                </span>
              </>
            )}
          </div>
          <Button
            disabled={!voiceFile || regeneratingVoice}
            onClick={handleRegenerateVoice}
            className="gap-2"
          >
            {regeneratingVoice ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-generate Voice
          </Button>
        </CardContent>
      </Card>

      {/* Avatar Clone Re-generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4" />
            Avatar Clone
          </CardTitle>
          <CardDescription>
            Upload new training and consent videos to improve the avatar.
            Status:{" "}
            <Badge
              variant={dh.avatar_clone?.status === "ready" ? "default" : "secondary"}
              className="ml-1"
            >
              {dh.avatar_clone?.status ?? "unknown"}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-4 text-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => trainingInputRef.current?.click()}
            >
              <input
                ref={trainingInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 32 * 1024 * 1024) {
                    toast.error("Max 32 MB.");
                    return;
                  }
                  setTrainingVideo(f || null);
                }}
              />
              {trainingVideo ? (
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium truncate">{trainingVideo.name}</span>
                </div>
              ) : (
                <>
                  <Video className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Training video (max 32 MB)</span>
                </>
              )}
            </div>

            <div
              className="border-2 border-dashed border-border rounded-lg p-4 text-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => consentInputRef.current?.click()}
            >
              <input
                ref={consentInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 32 * 1024 * 1024) {
                    toast.error("Max 32 MB.");
                    return;
                  }
                  setConsentVideo(f || null);
                }}
              />
              {consentVideo ? (
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium truncate">{consentVideo.name}</span>
                </div>
              ) : (
                <>
                  <Video className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Consent video (max 32 MB)</span>
                </>
              )}
            </div>
          </div>

          <Button
            disabled={!trainingVideo || !consentVideo || regeneratingAvatar}
            onClick={handleRegenerateAvatar}
            className="gap-2"
          >
            {regeneratingAvatar ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-train Avatar
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={handleDelete}
            className="gap-2"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete Digital Human
          </Button>
        </CardContent>
      </Card>
    </div></div>
  );
}
