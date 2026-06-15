import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: string;
  current_stage: number;
  created_at: string;
}

export interface PaginatedProjects {
  data: Project[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.get("/api/v1/workspaces"),
  });
}

export function useProjects(workspaceId: string | null) {
  return useQuery<PaginatedProjects>({
    queryKey: ["projects", workspaceId],
    queryFn: () => api.get(`/api/v1/workspaces/${workspaceId}/projects`),
    enabled: !!workspaceId,
  });
}
