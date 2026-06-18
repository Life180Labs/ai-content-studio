"use client";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play, Check, Volume2, Loader2 } from "lucide-react";
import { Plus, Mic } from "lucide-react";
import { useGetVoices, useCloneVoice } from "@/hooks/use-pipeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface VoiceSelectorProps {
  workspaceId: string | null;
  projectId: string;
  onProceed: (voiceId: string) => void;
  isGeneratingAvatar: boolean;
}

export function VoiceSelector({ workspaceId, projectId, onProceed, isGeneratingAvatar }: VoiceSelectorProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);

  const { data: voices, isLoading } = useGetVoices(workspaceId, projectId);
  const cloneVoice = useCloneVoice(workspaceId, projectId);

  // Set initial voice if none selected
  if (voices && voices.length > 0 && !selectedVoice) {
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
      toast.success("Voice cloned successfully!");
      setIsCloneOpen(false);
      setSelectedVoice(result.id);
      setCloneName("");
      setCloneDesc("");
      setCloneFile(null);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to clone voice.");
    }
  };

  const handlePlay = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Stop any existing speech
    window.speechSynthesis.cancel();
    
    const voiceDef = voices?.find(v => v.id === id);
    if (!voiceDef) return;
    
    if (voiceDef?.preview_url) {
      const audio = new Audio(voiceDef.preview_url);
      audio.onplay = () => setPlayingId(id);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      audio.play();
      return;
    }

    const text = `Hi, I'm ${voiceDef?.name}. This is a preview of my voice.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setPlayingId(id);
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Select Voice</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose the narrator for your video from ElevenLabs
          </p>
        </div>
        
        <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2" disabled={isGeneratingAvatar}>
              <Mic className="h-4 w-4" />
              Clone New Voice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clone Your Voice</DialogTitle>
              <DialogDescription>
                Upload a clean audio sample to create an instant voice clone using ElevenLabs.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCloneSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="voice-name">Voice Name</Label>
                <Input 
                  id="voice-name" 
                  value={cloneName} 
                  onChange={e => setCloneName(e.target.value)} 
                  placeholder="e.g. My Voice Clone" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voice-desc">Description (Optional)</Label>
                <Textarea 
                  id="voice-desc" 
                  value={cloneDesc} 
                  onChange={e => setCloneDesc(e.target.value)} 
                  placeholder="e.g. Energetic podcast host" 
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voice-file">Audio Sample</Label>
                <Input 
                  id="voice-file" 
                  type="file" 
                  accept="audio/*" 
                  onChange={e => setCloneFile(e.target.files?.[0] || null)} 
                  required 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Provide at least 1 minute of clean audio with no background noise. Max 10MB.
                </p>
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={cloneVoice.isPending}>
                  {cloneVoice.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Clone Voice
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Fetching voices from ElevenLabs...</p>
        </div>
      ) : (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {voices?.map((voice) => (
          <Card
            key={voice.id}
            onClick={() => {
              if (!isGeneratingAvatar) setSelectedVoice(voice.id);
            }}
            className={cn(
              "transition-all",
              isGeneratingAvatar ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-md",
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
                    <p className="text-xs text-muted-foreground">{voice.category}</p>
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
                  {Object.entries(voice.labels || {}).slice(0, 3).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="text-[10px] px-1.5">
                      {v as string}
                    </Badge>
                  ))}
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isGeneratingAvatar}
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
      )}

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
