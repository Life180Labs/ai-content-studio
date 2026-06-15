"use client";

import { useAuthStore } from "@/stores/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceGrid } from "@/components/assets/voice-grid";
import { AvatarGrid } from "@/components/assets/avatar-grid";
import { BrandKitsManager } from "@/components/assets/brand-kits-manager";
import { Image, Mic, Palette } from "lucide-react";

import { useWorkspaces } from "@/hooks/use-projects";

export default function AssetsPage() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id || null;

  return (
    <div className="flex-1 overflow-auto bg-background/50">
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Assets Library</h1>
          <p className="text-muted-foreground">
            Manage your global workspace assets: Voices, Avatars, and Brand Kits.
          </p>
        </div>

        <Tabs defaultValue="voices" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="voices" className="gap-2 px-6">
              <Mic className="h-4 w-4" />
              Voices
            </TabsTrigger>
            <TabsTrigger value="avatars" className="gap-2 px-6">
              <Image className="h-4 w-4" />
              Avatars
            </TabsTrigger>
            <TabsTrigger value="brand-kits" className="gap-2 px-6">
              <Palette className="h-4 w-4" />
              Brand Kits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voices" className="m-0">
            <VoiceGrid workspaceId={workspaceId} />
          </TabsContent>

          <TabsContent value="avatars" className="m-0">
            <AvatarGrid workspaceId={workspaceId} />
          </TabsContent>

          <TabsContent value="brand-kits" className="m-0">
            <BrandKitsManager workspaceId={workspaceId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
