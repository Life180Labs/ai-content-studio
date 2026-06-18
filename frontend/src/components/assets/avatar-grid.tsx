"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User } from "lucide-react";
import { useWorkspaceAvatars, useGetCustomAvatars } from "@/hooks/use-assets";
import { CreateAvatarModal } from "./create-avatar-modal";

interface AvatarGridProps {
  workspaceId: string | null;
}

export function AvatarGrid({ workspaceId }: AvatarGridProps) {
  const { data: avatars, isLoading: isLoadingPublic } = useWorkspaceAvatars(workspaceId);
  const { data: customAvatars, isLoading: isLoadingCustom } = useGetCustomAvatars(workspaceId);

  const isLoading = isLoadingPublic || isLoadingCustom;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading workspace avatars...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Your Avatars</h2>
        <CreateAvatarModal />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {/* Render Custom Avatars */}
        {customAvatars?.map((avatar) => {
          // Find matching avatar from HeyGen's API to get the preview URL if we don't have it locally
          const heygenData = avatars?.find(a => a.id === avatar.heygen_avatar_id);
          const previewUrl = avatar.preview_image_url || heygenData?.preview_image_url;

          return (
          <Card key={avatar.id} className={`overflow-hidden transition-all hover:shadow-md ${avatar.status === "pending_consent" ? "opacity-60" : ""}`}>
            <div className="aspect-[3/4] bg-muted relative">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={avatar.name}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                  <User className="h-12 w-12 opacity-20" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                <Badge className="bg-primary/90 hover:bg-primary shadow-sm">
                  {avatar.avatar_type === "photo" ? "Photo" : avatar.avatar_type === "prompt" ? "AI Prompt" : "Digital Twin"}
                </Badge>
                {avatar.status === "pending_consent" && (
                  <Badge variant="destructive" className="text-[10px] leading-tight shadow-sm">
                    Pending Consent
                  </Badge>
                )}
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold truncate" title={avatar.name}>{avatar.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">Custom</p>
            </CardContent>
          </Card>
        )})}

        {/* Render HeyGen Avatars (filter out ones that are already in custom avatars) */}
        {avatars?.filter(a => !customAvatars?.some(c => c.heygen_avatar_id === a.id)).map((avatar) => (
          <Card key={avatar.id} className="overflow-hidden transition-all hover:shadow-md">
            <div className="aspect-[3/4] bg-muted relative">
              {avatar.preview_image_url ? (
                <img
                  src={avatar.preview_image_url}
                  alt={avatar.name}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                  <User className="h-12 w-12 opacity-20" />
                </div>
              )}
              {avatar.type === "custom" && (
                <Badge className="absolute top-2 right-2 bg-primary/90 hover:bg-primary">
                  Custom
                </Badge>
              )}
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold truncate" title={avatar.name}>{avatar.name}</h3>
              <p className="text-xs text-muted-foreground capitalize mt-1">{avatar.gender}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
