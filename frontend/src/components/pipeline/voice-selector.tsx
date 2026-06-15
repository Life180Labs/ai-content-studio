"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play, Check, Volume2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceSelectorProps {
  onProceed: (voiceId: string) => void;
  isGeneratingAvatar: boolean;
}

// Mocked voice list from ElevenLabs for UI purposes
const VOICES = [
  { id: "Rachel", name: "Rachel", gender: "Female", useCase: "Narration", tags: ["Calm", "Professional"] },
  { id: "Drew", name: "Drew", gender: "Male", useCase: "News", tags: ["Authoritative", "Deep"] },
  { id: "Clyde", name: "Clyde", gender: "Male", useCase: "Conversational", tags: ["Friendly", "Upbeat"] },
  { id: "Mimi", name: "Mimi", gender: "Female", useCase: "Animation", tags: ["Childish", "Energetic"] },
  { id: "Fin", name: "Fin", gender: "Male", useCase: "Gaming", tags: ["Intense", "Raspy"] },
  { id: "Bella", name: "Bella", gender: "Female", useCase: "Narration", tags: ["Soft", "Soothing"] },
];

export function VoiceSelector({ onProceed, isGeneratingAvatar }: VoiceSelectorProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>("Rachel");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePlay = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // In a real app, this would play an HTML5 audio element
    setPlayingId(id);
    setTimeout(() => setPlayingId(null), 2000);
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Select Voice</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose the narrator for your video from ElevenLabs
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VOICES.map((voice) => (
          <Card
            key={voice.id}
            onClick={() => setSelectedVoice(voice.id)}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selectedVoice === voice.id
                ? "ring-2 ring-primary border-primary bg-primary/5"
                : "border-border/50 hover:border-border"
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Volume2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{voice.name}</h3>
                    <p className="text-xs text-muted-foreground">{voice.gender} • {voice.useCase}</p>
                  </div>
                </div>
                {selectedVoice === voice.id && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <div className="flex flex-wrap gap-1.5">
                  {voice.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5">
                      {tag}
                    </Badge>
                  ))}
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8 rounded-full", playingId === voice.id && "text-primary")}
                  onClick={(e) => handlePlay(voice.id, e)}
                >
                  <Play className={cn("h-4 w-4", playingId === voice.id && "fill-current")} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={() => onProceed(selectedVoice)}
          size="lg"
          className="gap-2 min-w-[200px]"
          disabled={isGeneratingAvatar}
        >
          {isGeneratingAvatar ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing Avatar...
            </>
          ) : (
            <>
              Approve & Select Avatar
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
