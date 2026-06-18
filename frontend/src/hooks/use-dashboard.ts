import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type RecentProject = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DashboardStats = {
  total_projects: number;
  generated_assets: number;
  total_cost_usd: number;
  total_tokens: number;
  success_rate: number;
  recent_projects: RecentProject[];
};

export function useDashboardStats(workspaceId: string | null) {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", workspaceId],
    queryFn: async () => {
      return api.get<DashboardStats>(`/api/v1/workspaces/${workspaceId}/dashboard-stats`);
    },
    enabled: !!workspaceId,
  });
}
