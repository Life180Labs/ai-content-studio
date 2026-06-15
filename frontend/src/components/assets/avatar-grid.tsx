"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User } from "lucide-react";
import { useWorkspaceAvatars } from "@/hooks/use-assets";

interface AvatarGridProps {
  workspaceId: string | null;
}

export function AvatarGrid({ workspaceId }: AvatarGridProps) {
  const { data: avatars, isLoading } = useWorkspaceAvatars(workspaceId);

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {avatars?.map((avatar) => (
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
