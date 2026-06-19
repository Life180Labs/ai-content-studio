"use client";

import { useWorkspaces } from "@/hooks/use-projects";
import { DigitalHumansGrid } from "@/components/assets/digital-humans-grid";

export default function DigitalHumansPage() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id || null;

  return (
    <div className="flex-1 overflow-auto bg-background/50">
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        <DigitalHumansGrid workspaceId={workspaceId} />
      </div>
    </div>
  );
}
