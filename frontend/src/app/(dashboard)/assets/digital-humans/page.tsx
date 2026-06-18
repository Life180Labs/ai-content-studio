"use client";

import { useEffect, useState } from "react";
import { useWorkspaces } from "@/hooks/use-projects";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Play, User, Mic } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function DigitalHumansPage() {
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.[0] || null;
  const [digitalHumans, setDigitalHumans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchHumans = async () => {
      try {
        const data = await api.get(`/api/v1/workspaces/${currentWorkspace.id}/digital-humans`);
        setDigitalHumans(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch digital humans", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHumans();
  }, [currentWorkspace]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Digital Humans Library</h2>
          <p className="text-sm text-muted-foreground">Manage your reusable AI presenters.</p>
        </div>
        <Link href="/assets/digital-humans/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Digital Human
          </Button>
        </Link>
      </div>

      {digitalHumans.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center min-h-[300px] text-center">
            <div className="bg-primary/10 text-primary p-4 rounded-full mb-4">
              <User className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Digital Humans Yet</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Create your first digital human by cloning a voice and avatar to use across all your projects.
            </p>
            <Link href="/assets/digital-humans/create">
              <Button>Create Digital Human</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {digitalHumans.map((human) => (
            <Card key={human.id} className="overflow-hidden group flex flex-col">
              <div className="aspect-video bg-muted relative group overflow-hidden">
                {human.preview_video_url ? (
                  <video 
                    src={human.preview_video_url} 
                    className="w-full h-full object-cover" 
                    controls
                    preload="none"
                    poster="/placeholder-avatar.png"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full w-full bg-muted">
                    <User className="h-12 w-12 text-muted-foreground opacity-50" />
                  </div>
                )}
              </div>
              <CardContent className="p-5 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-lg line-clamp-1">{human.name}</h3>
                    <p className="text-sm text-muted-foreground">{human.role}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-md font-medium">
                    <Mic className="h-3 w-3" />
                    {human.voice_tone}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-md font-medium">
                    {human.accent}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
