"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { useWorkspaceAvatars, useGetCustomAvatars, useGetDigitalHumans } from "@/hooks/use-assets";
import type { Avatar, CustomAvatar } from "@/hooks/use-assets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
    video_quality: string;
    avatar_motion_enabled: boolean;
  }) => void;
  isGeneratingAssets: boolean;
}

// Map a DB CustomAvatar record to the shared Avatar shape
function dbAvatarToAvatar(db: CustomAvatar): Avatar {
  const lookLabel =
    db.avatar_type === "digital_twin"
      ? "Digital Twin"
      : db.avatar_type === "photo"
      ? "Photo"
      : "AI Prompt";
  return {
    id: db.heygen_avatar_id ?? db.id,
    name: db.name,
    gender: "",
    preview_image_url: db.preview_image_url,
    type: "custom",
    group_id: db.heygen_group_id,
    look_description: lookLabel,
  };
}

// Merge DB custom avatars with HeyGen API avatar_group variants.
// The DB is the source of truth for "what this workspace owns".
// The HeyGen API fills in additional looks/variants under the same group.
function buildCustomAvatars(
  dbAvatars: CustomAvatar[] | undefined,
  apiAvatars: Avatar[] | undefined
): Avatar[] {
  const seen = new Set<string>();
  const result: Avatar[] = [];

  // 1. API custom avatars first (they include all group variants with proper names/previews)
  for (const a of apiAvatars?.filter((x) => x.type === "custom") ?? []) {
    if (a.id && !seen.has(a.id)) {
      seen.add(a.id);
      result.push(a);
    }
  }

  // 2. DB records that weren't covered by the API response
  for (const db of dbAvatars ?? []) {
    if (db.status === "pending_consent" || db.status === "failed") continue;
    const avatarId = db.heygen_avatar_id ?? db.id;
    if (!avatarId || seen.has(avatarId)) continue;
    seen.add(avatarId);
    result.push(dbAvatarToAvatar(db));
  }

  return result;
}

function AvatarCard({
  avatar,
  isSelected,
  onSelect,
}: {
  avatar: Avatar;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative group cursor-pointer overflow-hidden rounded-xl border-2 transition-all",
        isSelected
          ? "border-primary shadow-md ring-2 ring-primary/20"
          : "border-transparent hover:border-primary/30"
      )}
    >
      <div className="aspect-square relative bg-muted">
        {avatar.preview_image_url ? (
          <img
            src={avatar.preview_image_url}
            alt={avatar.name}
            className="object-cover w-full h-full transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <UserSquare className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />

        {avatar.type === "custom" && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-primary/90 text-primary-foreground border-none text-[10px] shadow-sm px-1.5 py-0.5">
              Custom
            </Badge>
          </div>
        )}

        {isSelected && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
            <Check className="h-3 w-3" />
          </div>
        )}

        <div className="absolute bottom-2 left-2 right-2">
          <p className="font-semibold text-sm text-white leading-none drop-shadow-md truncate">
            {avatar.name}
          </p>
          {avatar.look_description && (
            <p className="text-[10px] text-white/80 mt-0.5 drop-shadow-md truncate">
              {avatar.look_description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function VoiceAvatarSelector({
  workspaceId,
  projectId,
  onProceed,
  isGeneratingAssets,
}: VoiceAvatarSelectorProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);

  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [useCustomVoice, setUseCustomVoice] = useState(true);
  const [videoQuality, setVideoQuality] = useState("production");

  const { data: voices, isLoading: isVoicesLoading } = useGetVoices(workspaceId, projectId);
  const cloneVoice = useCloneVoice(workspaceId, projectId);

  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = workspaceId || workspaces?.[0]?.id || null;

  // DB custom avatars — source of truth for what this workspace owns
  const { data: dbCustomAvatars, isLoading: isDbAvatarsLoading } = useGetCustomAvatars(activeWorkspaceId);
  // HeyGen API avatars — adds group variants + public library
  const { data: heygenAvatars, isLoading: isApiAvatarsLoading } = useWorkspaceAvatars(activeWorkspaceId);
  const { data: digitalHumans } = useGetDigitalHumans(activeWorkspaceId);

  const isAvatarsLoading = isDbAvatarsLoading || isApiAvatarsLoading;

  // Custom avatars: DB records merged with all API group variants (no fallback)
  const customAvatars = buildCustomAvatars(dbCustomAvatars, heygenAvatars);
  // Public library: only what the HeyGen API actually returns
  const publicAvatars = (heygenAvatars ?? []).filter((a) => a.type === "public");

  // Auto-select first voice once loaded
  useEffect(() => {
    if (voices && voices.length > 0 && !selectedVoice) {
      setSelectedVoice(voices[0].id);
    }
  }, [voices, selectedVoice]);

  // Auto-select first custom avatar (prefer custom over public)
  useEffect(() => {
    if (selectedAvatar) return;
    const first = customAvatars[0] ?? publicAvatars[0];
    if (first) setSelectedAvatar(first.id);
  }, [customAvatars, publicAvatars, selectedAvatar]);

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
      if (result?.id) {
        setSelectedVoice(result.id);
        setIsCloneOpen(false);
        setCloneName("");
        setCloneDesc("");
        setCloneFile(null);
        toast.success(`Voice clone "${result.name}" added.`);
      }
    } catch (err: any) {
      toast.error(
        err?.detail || "Voice cloning failed. Requires a HeyGen Enterprise account."
      );
    }
  };

  const handleGenerateAssets = () => {
    if (!selectedVoice) {
      toast.error("Please select a voice first.");
      return;
    }
    // Only custom / Avatar IV avatars support motion prompts (avatar_action).
    const isCustomAvatar = customAvatars.some((a) => a.id === selectedAvatar);
    onProceed({
      selected_voice_id: selectedVoice,
      selected_avatar_id: selectedAvatar,
      use_custom_voice: useCustomVoice,
      video_quality: videoQuality,
      avatar_motion_enabled: isCustomAvatar,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Voice & Avatar Studio</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select a HeyGen voice and avatar to render each scene
          </p>
        </div>

        {/* Quick-fill from a saved Digital Human */}
        {digitalHumans && digitalHumans.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Quick-fill from:</span>
            <select
              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
              defaultValue=""
              onChange={(e) => {
                const dh = digitalHumans.find((d: any) => d.id === e.target.value);
                if (dh?.voice_clone?.heygen_voice_id) setSelectedVoice(dh.voice_clone.heygen_voice_id);
                if (dh?.avatar_clone?.heygen_avatar_id) setSelectedAvatar(dh.avatar_clone.heygen_avatar_id);
                if (dh) toast.success(`Applied "${dh.name}"`);
              }}
            >
              <option value="" disabled>
                Digital Human…
              </option>
              {digitalHumans.map((dh: any) => (
                <option key={dh.id} value={dh.id}>
                  {dh.name} — {dh.role}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Left: Voice ─────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">1. Select Voice</h3>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsCloneOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Clone Voice
              <Badge variant="secondary" className="text-[10px] px-1.5 h-4 ml-1">
                Enterprise
              </Badge>
            </Button>
          </div>

          <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clone a HeyGen Voice</DialogTitle>
                <DialogDescription>
                  Upload an audio sample to create a custom voice clone.
                  <span className="block mt-1 text-amber-500 font-medium">
                    Requires a HeyGen Enterprise account.
                  </span>
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
                  <Label htmlFor="clone-desc">Description (optional)</Label>
                  <Textarea
                    id="clone-desc"
                    placeholder="e.g. Energetic and professional"
                    value={cloneDesc}
                    onChange={(e) => setCloneDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clone-file">Audio Sample (.mp3 or .wav, 1–5 min)</Label>
                  <Input
                    id="clone-file"
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/mp3"
                    onChange={(e) => setCloneFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={cloneVoice.isPending}>
                    {cloneVoice.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Clone & Add Voice
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              {isVoicesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {voices?.map((voice) => (
                    <div
                      key={voice.id}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer",
                        selectedVoice === voice.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                      )}
                      onClick={() => setSelectedVoice(voice.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                            selectedVoice === voice.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Mic className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{voice.name}</p>
                          <div className="flex gap-1.5 mt-0.5">
                            {voice.labels?.gender && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full capitalize">
                                {voice.labels.gender}
                              </span>
                            )}
                            {voice.labels?.language && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                {voice.labels.language}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {voice.preview_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (playingId === voice.id) {
                                setPlayingId(null);
                              } else {
                                setPlayingId(voice.id);
                                const audio = new Audio(voice.preview_url!);
                                audio.onended = () => setPlayingId(null);
                                audio.play().catch(() => setPlayingId(null));
                              }
                            }}
                          >
                            {playingId === voice.id ? (
                              <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full border flex items-center justify-center",
                            selectedVoice === voice.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          )}
                        >
                          {selectedVoice === voice.id && <Check className="h-2.5 w-2.5" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!voices || voices.length === 0) && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No voices available. Add a HeyGen API key in Settings.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Avatar + Settings ─────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold">2. Select Avatar</h3>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 space-y-5">
              {isAvatarsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto space-y-5 pr-1">
                  {/* My Avatars — custom avatars from DB, all HeyGen group variants included */}
                  {customAvatars.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          My Avatars
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                          {customAvatars.length} variant{customAvatars.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {customAvatars.map((avatar) => (
                          <AvatarCard
                            key={avatar.id}
                            avatar={avatar}
                            isSelected={selectedAvatar === avatar.id}
                            onSelect={() => setSelectedAvatar(avatar.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-border rounded-xl">
                      <UserSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No custom avatars yet.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Create one in <strong>Assets → Digital Humans</strong>.
                      </p>
                    </div>
                  )}

                  {/* HeyGen public library — only shown when the API returns results */}
                  {publicAvatars.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        HeyGen Library
                      </span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {publicAvatars.map((avatar) => (
                          <AvatarCard
                            key={avatar.id}
                            avatar={avatar}
                            isSelected={selectedAvatar === avatar.id}
                            onSelect={() => setSelectedAvatar(avatar.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Video settings */}
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">HeyGen Text-to-Speech</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      HeyGen generates speech using the selected voice.
                    </p>
                  </div>
                  <Switch checked={useCustomVoice} onCheckedChange={setUseCustomVoice} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Render Mode</Label>
                  <select
                    value={videoQuality}
                    onChange={(e) => setVideoQuality(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="production">Production (HD)</option>
                    <option value="draft">Draft (fast test)</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Aspect ratio is set in the Storyboard step. Draft renders are faster and watermarked for testing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleGenerateAssets}
              disabled={isGeneratingAssets || !selectedVoice || !selectedAvatar}
              size="lg"
              className="gap-2 w-full sm:w-auto"
            >
              {isGeneratingAssets ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Videos…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate HeyGen Videos
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
