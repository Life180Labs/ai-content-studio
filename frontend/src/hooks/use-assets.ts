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

export interface CustomAvatar {
  id: string;
  workspace_id: string;
  heygen_avatar_id: string | null;
  heygen_group_id: string | null;
  name: string;
  avatar_type: "photo" | "digital_twin" | "prompt";
  preview_image_url: string | null;
  status: "ready" | "pending_consent" | "failed";
  created_at: string;
  updated_at: string;
}

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
      return api.get<Voice[]>(`/api/v1/workspaces/${workspaceId}/assets/voices`);
    },
    enabled: !!workspaceId,
  });
}

export function useWorkspaceAvatars(workspaceId: string | null) {
  return useQuery<Avatar[]>({
    queryKey: ["workspace-avatars", workspaceId],
    queryFn: async () => {
      return api.get<Avatar[]>(`/api/v1/workspaces/${workspaceId}/assets/avatars`);
    },
    enabled: !!workspaceId,
  });
}

export function useGetCustomAvatars(workspaceId: string | null) {
  return useQuery<CustomAvatar[]>({
    queryKey: ["custom-avatars", workspaceId],
    queryFn: async () => {
      return api.get<CustomAvatar[]>(`/api/v1/workspaces/${workspaceId}/assets/avatars/custom`);
    },
    enabled: !!workspaceId,
  });
}

export function useCreateCustomAvatar(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<{ avatar: CustomAvatar; consent_url?: string }, unknown, FormData>({
    mutationFn: async (formData: FormData) => {
      return api.post<{ avatar: CustomAvatar; consent_url?: string }>(
        `/api/v1/workspaces/${workspaceId}/assets/avatars/custom`,
        formData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-avatars", workspaceId] });
    },
  });
}

export function useBrandKits(workspaceId: string | null) {
  return useQuery<BrandKit[]>({
    queryKey: ["brand-kits", workspaceId],
    queryFn: async () => {
      return api.get<BrandKit[]>(`/api/v1/workspaces/${workspaceId}/assets/brand-kits`);
    },
    enabled: !!workspaceId,
  });
}

export function useCreateBrandKit(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<BrandKit, unknown, BrandKitCreatePayload>({
    mutationFn: async (data) => {
      return api.post<BrandKit>(`/api/v1/workspaces/${workspaceId}/assets/brand-kits`, data);
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
      await api.delete(`/api/v1/workspaces/${workspaceId}/assets/brand-kits/${kitId}`);
    },
    onSuccess: () => {
    },
  });
}

export function useGetDigitalHumans(workspaceId: string | null) {
  return useQuery<any[]>({
    queryKey: ["digital-humans", workspaceId],
    queryFn: async () => {
      const { data } = await api.get<any[]>(`/api/v1/workspaces/${workspaceId}/digital-humans`);
      return data;
    },
    enabled: !!workspaceId,
  });
}
