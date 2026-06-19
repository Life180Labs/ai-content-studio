"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Mic, ArrowRight } from "lucide-react";
import { useWorkspaces } from "@/hooks/use-projects";
import { api } from "@/lib/api";

// Generate a consistent color from a string
function avatarColor(name: string) {
  const colors = [
    "bg-violet-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface DigitalHumansGridProps {
  workspaceId: string | null;
}

export function DigitalHumansGrid({ workspaceId }: DigitalHumansGridProps) {
  const [digitalHumans, setDigitalHumans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    api
      .get<any[]>(`/api/v1/workspaces/${workspaceId}/digital-humans`)
      .then((data) => setDigitalHumans(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading digital humans…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row — matches VoiceGrid / AvatarGrid pattern */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Your Digital Humans</h2>
        <Link href="/assets/digital-humans/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Digital Human
          </Button>
        </Link>
      </div>

      {digitalHumans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed">
          <div className="bg-primary/10 text-primary p-4 rounded-full mb-4">
            <Mic className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No Digital Humans Yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Create your first AI presenter by cloning a voice and avatar.
          </p>
          <Link href="/assets/digital-humans/create">
            <Button>Create Digital Human</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {digitalHumans.map((human) => (
            <Card key={human.id} className="overflow-hidden transition-all hover:shadow-md">
              {/* Portrait thumbnail — matches AvatarGrid aspect-[3/4] */}
              <div className="aspect-[3/4] bg-muted relative">
                {human.preview_video_url ? (
                  <video
                    src={human.preview_video_url}
                    className="w-full h-full object-cover"
                    preload="none"
                    muted
                    loop
                    onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                    onMouseLeave={(e) => {
                      const v = e.currentTarget as HTMLVideoElement;
                      v.pause();
                      v.currentTime = 0;
                    }}
                  />
                ) : (
                  <div
                    className={`flex items-center justify-center w-full h-full ${avatarColor(human.name)}`}
                  >
                    <span className="text-4xl font-bold text-white select-none">
                      {initials(human.name)}
                    </span>
                  </div>
                )}

                {/* Badges overlay */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  <Badge className="bg-primary/90 hover:bg-primary shadow-sm text-[10px]">
                    <Mic className="h-2.5 w-2.5 mr-1" />
                    {human.voice_tone}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-1">
                  <div className="overflow-hidden">
                    <h3 className="font-semibold truncate text-sm">{human.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{human.role}</p>
                  </div>
                  <Link href={`/assets/digital-humans/${human.id}`} className="shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
                <Badge variant="outline" className="mt-2 text-[10px]">
                  {human.accent}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
