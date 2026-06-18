"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ArrowRight,
  Play,
  Check,
  Volume2,
  Loader2,
  Plus,
  Mic,
  UserSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetVoices, useCloneVoice } from "@/hooks/use-pipeline";
import { useWorkspaces } from "@/hooks/use-projects";
import { useGetCustomAvatars, useWorkspaceAvatars, useGetDigitalHumans } from "@/hooks/use-assets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface VoiceAvatarSelectorProps {
  workspaceId: string | null;
  projectId: string;
  onProceed: (payload: {
    selected_voice_id: string;
    selected_avatar_id: string;
    use_custom_voice: boolean;
    aspect_ratio: string;
    video_quality: string;
  }) => void;
  isGeneratingAssets: boolean;
}

// Mocked avatar list from HeyGen for UI purposes
const AVATARS = [
  { id: "Anna_public_3_20240108", name: "Anna", style: "Professional", tag: "News", imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80" },
  { id: "Tyler-public", name: "Tyler", style: "Casual", tag: "Vlog", imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80" },
  { id: "Silvia_public", name: "Silvia", style: "Business", tag: "Presentation", imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80" },
  { id: "Wayne_20240711", name: "Wayne", style: "Casual", tag: "Education", imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80" },
  { id: "Leah_public", name: "Leah", style: "Formal", tag: "News", imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80" },
  { id: "Matt_public", name: "Matt", style: "Business", tag: "Sales", imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80" },
];

export function VoiceAvatarSelector({
  workspaceId,
  projectId,
  onProceed,
  isGeneratingAssets,
}: VoiceAvatarSelectorProps) {
  // Voice State
  const [selectedVoice, setSelectedVoice] = useState<string>("Rachel");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);

  // Avatar State
  const [selectedAvatar, setSelectedAvatar] = useState<string>("Anna_public_3_20240108");
  const [useCustomVoice, setUseCustomVoice] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [videoQuality, setVideoQuality] = useState<string>("production");

  const { data: voices, isLoading: isVoicesLoading } = useGetVoices(workspaceId, projectId);
  const cloneVoice = useCloneVoice(workspaceId, projectId);

  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = workspaceId || workspaces?.[0]?.id || null;
  const { data: customAvatars } = useGetCustomAvatars(activeWorkspaceId);
  const { data: heygenAvatars } = useWorkspaceAvatars(activeWorkspaceId);
  const { data: digitalHumans } = useGetDigitalHumans(activeWorkspaceId);

  // Merge custom avatars into the main list, putting them first
  const allAvatars = [
    ...(customAvatars
      ?.filter((a) => a.status !== "pending_consent")
      .map((a) => {
        const heygenData = heygenAvatars?.find((ha) => ha.id === a.heygen_avatar_id);
        return {
          id: a.heygen_avatar_id || a.heygen_group_id || a.id,
          name: a.name,
          style: a.avatar_type === "photo" ? "Photo" : a.avatar_type === "prompt" ? "AI Prompt" : "Digital Twin",
          tag: "Custom",
          imageUrl: a.preview_image_url || heygenData?.preview_image_url || "",
          isCustom: true,
        };
      }) || []),
    ...AVATARS.map((a) => ({ ...a, isCustom: false })),
  ];

  // Set initial voice if none selected
  if (voices && voices.length > 0 && selectedVoice === "Rachel" && !voices.find(v => v.id === "Rachel" || v.name === "Rachel")) {
    setSelectedVoice(voices[0].id);
  }

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneName || !cloneFile) {
      toast.error("Please provide a name and an audio file.");
      return;
    }

    const formData = new FormData();
    formData.append("name", cloneName);
    formData.append("description", cloneDesc);
    formData.append("file", cloneFile);

    try {
      const result = await cloneVoice.mutateAsync(formData);
      if (result && result.voice_id) {
        setSelectedVoice(result.voice_id);
        setIsCloneOpen(false);
        setCloneName("");
        setCloneDesc("");
        setCloneFile(null);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleGenerateAssets = () => {
    onProceed({
      selected_voice_id: selectedVoice,
      selected_avatar_id: selectedAvatar,
      use_custom_voice: useCustomVoice,
      aspect_ratio: aspectRatio,
      video_quality: videoQuality,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Voice & Avatar Studio</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure the audio and visual identity for your video
          </p>
        </div>
        {digitalHumans && digitalHumans.length > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Use Digital Human:</span>
            <select 
              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
              onChange={(e) => {
                const dh = digitalHumans.find(d => d.id === e.target.value);
                if (dh && dh.voice_clone && dh.avatar_clone) {
                  setSelectedVoice(dh.voice_clone.heygen_voice_id);
                  setSelectedAvatar(dh.avatar_clone.heygen_avatar_id);
                  toast.success(`Selected ${dh.name}`);
                }
              }}
            >
              <option value="">Select an asset...</option>
              {digitalHumans.map((dh: any) => (
                <option key={dh.id} value={dh.id}>{dh.name} ({dh.role})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Pane: Voice Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">1. Select Voice</h3>
            <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsCloneOpen(true)}>
                <Plus className="h-4 w-4" /> Clone Voice
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clone a New Voice</DialogTitle>
                  <DialogDescription>
                    Upload an audio sample to create a custom AI voice clone. (Required length: 1-5 minutes).
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCloneSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="clone-name">Voice Name</Label>
                    <Input
                      id="clone-name"
                      placeholder="e.g. Founder's Voice"
                      value={cloneName}
                      onChange={(e) => setCloneName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clone-desc">Description (Optional)</Label>
                    <Textarea
                      id="clone-desc"
                      placeholder="e.g. Energetic and professional"
                      value={cloneDesc}
                      onChange={(e) => setCloneDesc(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clone-file">Audio Sample (.mp3, .wav)</Label>
                    <Input
                      id="clone-file"
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/mp3"
                      onChange={(e) => setCloneFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="pt-2 flex justify-end">
                    <Button type="submit" disabled={cloneVoice.isPending}>
                      {cloneVoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Clone & Add Voice
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 space-y-4">
              {isVoicesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {voices?.map((voice) => (
                    <div
                      key={voice.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer",
                        selectedVoice === voice.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                      )}
                      onClick={() => setSelectedVoice(voice.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center",
                            selectedVoice === voice.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Mic className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{voice.name}</h4>
                            {voice.is_cloned && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                                Cloned
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2 mt-1">
                            {voice.labels?.accent && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {voice.labels.accent}
                              </span>
                            )}
                            {voice.labels?.description && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {voice.labels.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {voice.preview_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (playingId === voice.id) {
                                setPlayingId(null);
                                // Stop logic would go here if we implemented actual audio playback
                              } else {
                                setPlayingId(voice.id);
                                const audio = new Audio(voice.preview_url);
                                audio.onended = () => setPlayingId(null);
                                audio.play().catch(() => setPlayingId(null));
                              }
                            }}
                          >
                            {playingId === voice.id ? (
                              <Volume2 className="h-4 w-4 animate-pulse" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <div
                          className={cn(
                            "h-5 w-5 rounded-full border flex items-center justify-center",
                            selectedVoice === voice.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          )}
                        >
                          {selectedVoice === voice.id && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!voices || voices.length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
                      No voices available. Add an ElevenLabs API key in Settings.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Pane: Avatar Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">2. Select Avatar & Settings</h3>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2">
                {allAvatars.map((avatar) => (
                  <div
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={cn(
                      "relative group cursor-pointer overflow-hidden rounded-xl border-2 transition-all",
                      selectedAvatar === avatar.id
                        ? "border-primary shadow-md"
                        : "border-transparent hover:border-primary/30"
                    )}
                  >
                    <div className="aspect-square relative bg-muted">
                      {avatar.imageUrl ? (
                        <img
                          src={avatar.imageUrl}
                          alt={avatar.name}
                          className="object-cover w-full h-full transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-secondary">
                          <UserSquare className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
                      {avatar.isCustom && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary" className="bg-primary/90 text-primary-foreground border-none text-[10px] shadow-sm">
                            Custom
                          </Badge>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                        <div className="text-white">
                          <p className="font-medium text-sm leading-none drop-shadow-md">{avatar.name}</p>
                          <p className="text-[10px] opacity-80 drop-shadow-md">{avatar.style}</p>
                        </div>
                        {selectedAvatar === avatar.id && (
                          <div className="bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Video Settings */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Use Custom Audio Sync</Label>
                    <p className="text-xs text-muted-foreground">
                      Map the previously selected voice onto this avatar perfectly.
                    </p>
                  </div>
                  <Switch
                    checked={useCustomVoice}
                    onCheckedChange={setUseCustomVoice}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aspect Ratio</Label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="16:9">Landscape (16:9)</option>
                      <option value="9:16">Portrait (9:16)</option>
                      <option value="1:1">Square (1:1)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Video Quality</Label>
                    <select
                      value={videoQuality}
                      onChange={(e) => setVideoQuality(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="production">Production (High)</option>
                      <option value="draft">Draft (Low - Faster)</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proceed Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleGenerateAssets}
              disabled={isGeneratingAssets || !selectedVoice || !selectedAvatar}
              size="lg"
              className="gap-2 w-full sm:w-auto"
            >
              {isGeneratingAssets ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Media...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Final Assets
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
