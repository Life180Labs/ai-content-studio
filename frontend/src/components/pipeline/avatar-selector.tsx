"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, UserSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarSelectorProps {
  onProceed: (payload: { selected_avatar_id: string; use_custom_voice: boolean }) => void;
  isGeneratingVideo: boolean;
}

// Mocked avatar list from HeyGen for UI purposes
const AVATARS = [
  { id: "Anna_public_3_20240108", name: "Anna", style: "Professional", tag: "News" },
  { id: "Tyler-public", name: "Tyler", style: "Casual", tag: "Vlog" },
  { id: "Silvia_public", name: "Silvia", style: "Business", tag: "Presentation" },
  { id: "Wayne_20240711", name: "Wayne", style: "Casual", tag: "Education" },
  { id: "Leah_public", name: "Leah", style: "Formal", tag: "News" },
  { id: "Matt_public", name: "Matt", style: "Business", tag: "Sales" },
];

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function AvatarSelector({ onProceed, isGeneratingVideo }: AvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string>("Anna_public_3_20240108");
  const [useCustomVoice, setUseCustomVoice] = useState<boolean>(true);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AVATARS.map((avatar) => (
          <Card
            key={avatar.id}
            onClick={() => setSelectedAvatar(avatar.id)}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md overflow-hidden",
              selectedAvatar === avatar.id
                ? "ring-2 ring-primary border-primary bg-primary/5"
                : "border-border/50 hover:border-border"
            )}
          >
            <div className="aspect-video bg-muted relative flex items-center justify-center border-b border-border/50">
              <UserSquare className="h-12 w-12 text-muted-foreground/30" />
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
                <Badge variant="secondary" className="text-[10px]">
                  {avatar.tag}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-border mt-4">
        <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg border border-border/50">
          <Switch 
            id="custom-voice" 
            checked={useCustomVoice}
            onCheckedChange={setUseCustomVoice}
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
          onClick={() => onProceed({ selected_avatar_id: selectedAvatar, use_custom_voice: useCustomVoice })}
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
