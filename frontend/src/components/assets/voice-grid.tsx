"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Volume2, Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceVoices } from "@/hooks/use-assets";
import { useCloneVoice } from "@/hooks/use-pipeline"; // We can reuse this since it just hits the same underlying API or we can make a new one. Wait, the endpoint is different.
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
import { api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface VoiceGridProps {
  workspaceId: string | null;
}

export function VoiceGrid({ workspaceId }: VoiceGridProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);

  const { data: voices, isLoading } = useWorkspaceVoices(workspaceId);
  const queryClient = useQueryClient();

  // Create a mutation for workspace cloning (reuses the new route)
  const cloneVoice = useMutation<{ id: string; name: string }, unknown, FormData>({
    mutationFn: async (formData) => {
      return api.post<{ id: string; name: string }>(`/workspaces/${workspaceId}/assets/voices/clone`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-voices", workspaceId] });
    },
  });

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
      await cloneVoice.mutateAsync(formData);
      toast.success("Voice cloned successfully!");
      setIsCloneOpen(false);
      setCloneName("");
      setCloneDesc("");
      setCloneFile(null);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to clone voice.");
    }
  };

  const handlePlay = (id: string, url: string | null, name: string) => {
    window.speechSynthesis.cancel();
    
    if (url) {
      const audio = new Audio(url);
      audio.onplay = () => setPlayingId(id);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      audio.play();
      return;
    }

    const text = `Hi, I'm ${name}. This is a preview of my voice.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setPlayingId(id);
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    window.speechSynthesis.speak(utterance);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading workspace voices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
          <DialogTrigger render={
            <Button className="gap-2">
              <Mic className="h-4 w-4" />
              Clone Voice
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clone Your Voice</DialogTitle>
              <DialogDescription>
                Upload a clean audio sample to create an instant voice clone.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCloneSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Voice Name</Label>
                <Input 
                  value={cloneName} 
                  onChange={e => setCloneName(e.target.value)} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea 
                  value={cloneDesc} 
                  onChange={e => setCloneDesc(e.target.value)} 
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label>Audio Sample</Label>
                <Input 
                  type="file" 
                  accept="audio/*" 
                  onChange={e => setCloneFile(e.target.files?.[0] || null)} 
                  required 
                />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {voices?.map((voice) => (
          <Card key={voice.id} className="transition-all hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Volume2 className="h-5 w-5 text-primary" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-semibold truncate">{voice.name}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{voice.category}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <div className="flex flex-wrap gap-1.5 overflow-hidden h-5">
                  {Object.entries(voice.labels || {}).slice(0, 2).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="text-[10px] px-1.5 truncate max-w-[80px]">
                      {v as string}
                    </Badge>
                  ))}
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8 rounded-full shrink-0", playingId === voice.id && "text-primary")}
                  onClick={() => handlePlay(voice.id, voice.preview_url, voice.name)}
                >
                  <Play className={cn("h-4 w-4", playingId === voice.id && "fill-current")} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
