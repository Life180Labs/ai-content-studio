"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, UserSquare, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-projects";
import { useGetCustomAvatars, useWorkspaceAvatars } from "@/hooks/use-assets";

interface AvatarSelectorProps {
  onProceed: (payload: { selected_avatar_id: string; use_custom_voice: boolean; aspect_ratio: string; video_quality: string }) => void;
  isGeneratingVideo: boolean;
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

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function AvatarSelector({ onProceed, isGeneratingVideo }: AvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string>("Anna_public_3_20240108");
  const [useCustomVoice, setUseCustomVoice] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [videoQuality, setVideoQuality] = useState<string>("production");

  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id || null;
  const { data: customAvatars } = useGetCustomAvatars(workspaceId);
  const { data: heygenAvatars } = useWorkspaceAvatars(workspaceId);

  // Merge custom avatars into the main list, putting them first
  const allAvatars = [
    ...(customAvatars
      ?.filter((a) => a.status !== "pending_consent")
      .map((a) => {
        const heygenData = heygenAvatars?.find(ha => ha.id === a.heygen_avatar_id);
        return {
          id: a.heygen_avatar_id || a.heygen_group_id || a.id,
          name: a.name,
          style: a.avatar_type === "photo" ? "Photo" : a.avatar_type === "prompt" ? "AI Prompt" : "Digital Twin",
          tag: "Custom",
          imageUrl: a.preview_image_url || heygenData?.preview_image_url || "",
          isCustom: true,
        };
      }) || []),
    ...AVATARS.map(a => ({ ...a, isCustom: false }))
  ];

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Select Avatar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose the visual presenter for your video from HeyGen
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {allAvatars.map((avatar) => (
          <Card
            key={avatar.id}
            onClick={() => {
              if (!isGeneratingVideo) setSelectedAvatar(avatar.id);
            }}
            className={cn(
              "transition-all overflow-hidden",
              isGeneratingVideo ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-md",
              selectedAvatar === avatar.id
                ? "ring-2 ring-primary border-primary bg-primary/5"
                : "border-border/50 hover:border-border"
            )}
          >
            <div className="aspect-video bg-muted relative flex items-center justify-center border-b border-border/50">
              {avatar.imageUrl ? (
                <img src={avatar.imageUrl} alt={avatar.name} className="w-full h-full object-cover" />
              ) : (
                <UserSquare className="h-12 w-12 text-muted-foreground opacity-20" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              {selectedAvatar === avatar.id && (
                <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{avatar.name}</h3>
                  <p className="text-xs text-muted-foreground">{avatar.style}</p>
                </div>
                <Badge variant={avatar.isCustom ? "default" : "secondary"} className="text-[10px] gap-1">
                  {avatar.isCustom && <Sparkles className="h-3 w-3" />}
                  {avatar.tag}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-6 border-t border-border">
        <div>
          <Label className="text-sm font-medium mb-2 block">Frame Size (Aspect Ratio)</Label>
          <select 
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            disabled={isGeneratingVideo}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="16:9">Landscape (16:9) - YouTube / Desktop</option>
            <option value="9:16">Portrait (9:16) - TikTok / Shorts / Reels</option>
            <option value="1:1">Square (1:1) - Instagram</option>
          </select>
        </div>
        
        <div>
          <Label className="text-sm font-medium mb-2 block">Video Quality</Label>
          <select 
            value={videoQuality}
            onChange={(e) => setVideoQuality(e.target.value)}
            disabled={isGeneratingVideo}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="production">Production (High Quality) - Costs Credits</option>
            <option value="draft">Draft (Watermarked) - Free Testing</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-border mt-4">
        <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg border border-border/50">
          <Switch 
            id="custom-voice" 
            checked={useCustomVoice}
            onCheckedChange={setUseCustomVoice}
            disabled={isGeneratingVideo}
          />
          <div className="space-y-0.5">
            <Label htmlFor="custom-voice" className="text-sm font-medium cursor-pointer">
              Use Custom ElevenLabs Voice
            </Label>
            <p className="text-xs text-muted-foreground">
              {useCustomVoice ? "Avatar will perfectly lip-sync to the voice you generated." : "Avatar will use its default built-in AI voice."}
            </p>
          </div>
        </div>

        <Button
          onClick={() => onProceed({ 
            selected_avatar_id: selectedAvatar, 
            use_custom_voice: useCustomVoice,
            aspect_ratio: aspectRatio,
            video_quality: videoQuality
          })}
          size="lg"
          className="gap-2 min-w-[200px]"
          disabled={isGeneratingVideo}
        >
          {isGeneratingVideo ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Rendering Video...
            </>
          ) : (
            <>
              Generate Final Video
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
