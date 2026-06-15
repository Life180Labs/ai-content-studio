import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Voice } from "./use-pipeline";

export type Avatar = {
  id: string;
  name: string;
  gender: string;
  preview_image_url: string;
  type: string;
};

export type BrandKit = {
  id: string;
  workspace_id: string;
  name: string;
  colors: Record<string, any>;
  fonts: Record<string, any>;
  logos: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type BrandKitCreatePayload = Omit<BrandKit, "id" | "workspace_id" | "created_at" | "updated_at">;

// --- Hooks ---

export function useWorkspaceVoices(workspaceId: string | null) {
  return useQuery<Voice[]>({
    queryKey: ["workspace-voices", workspaceId],
    queryFn: async () => {
      const res = await api.get(`/workspaces/${workspaceId}/assets/voices`);
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useWorkspaceAvatars(workspaceId: string | null) {
  return useQuery<Avatar[]>({
    queryKey: ["workspace-avatars", workspaceId],
    queryFn: async () => {
      const res = await api.get(`/workspaces/${workspaceId}/assets/avatars`);
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useBrandKits(workspaceId: string | null) {
  return useQuery<BrandKit[]>({
    queryKey: ["brand-kits", workspaceId],
    queryFn: async () => {
      const res = await api.get(`/workspaces/${workspaceId}/assets/brand-kits`);
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateBrandKit(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<BrandKit, unknown, BrandKitCreatePayload>({
    mutationFn: async (data) => {
      const res = await api.post(`/workspaces/${workspaceId}/assets/brand-kits`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-kits", workspaceId] });
    },
  });
}

export function useDeleteBrandKit(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: async (kitId) => {
      await api.delete(`/workspaces/${workspaceId}/assets/brand-kits/${kitId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-kits", workspaceId] });
    },
  });
}
