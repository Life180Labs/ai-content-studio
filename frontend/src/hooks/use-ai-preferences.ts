/**
 * TanStack Query hooks for AI Preferences.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────

export interface ProviderKeyStatus {
  gemini: boolean;
  openai: boolean;
  anthropic: boolean;
  heygen: boolean;
}

export interface TaskOverride {
  provider: string;
  model: string;
}

export interface AIPreference {
  id: string;
  default_provider: string;
  default_model: string;
  fallback_enabled: boolean;
  fallback_action: string;
  fallback_provider: string | null;
  fallback_model: string | null;
  retry_count: number;
  provider_keys_status: ProviderKeyStatus;
  task_overrides: Record<string, TaskOverride> | null;
  custom_models: Record<string, string[]> | null;
}

export interface ProviderKeyInput {
  gemini?: string;
  openai?: string;
  anthropic?: string;
  heygen?: string;
}

export interface AIPreferenceInput {
  default_provider: string;
  default_model: string;
  fallback_enabled: boolean;
  fallback_action: string;
  fallback_provider?: string | null;
  fallback_model?: string | null;
  retry_count: number;
  provider_keys?: ProviderKeyInput;
  task_overrides?: Record<string, TaskOverride>;
  custom_models?: Record<string, string[]>;
}

export interface AvailableProvider {
  name: string;
  display_name: string;
  models: string[];
  supports_text_generation: boolean;
}

export interface ProvidersListResponse {
  providers: AvailableProvider[];
}

// ── Hooks ──────────────────────────────────────────────────

export function useAIPreferences() {
  return useQuery<AIPreference | null>({
    queryKey: ["ai-preferences"],
    queryFn: () => api.get("/api/v1/ai/preferences"),
  });
}

export function useSaveAIPreferences() {
  const queryClient = useQueryClient();
  return useMutation<AIPreference, unknown, AIPreferenceInput>({
    mutationFn: (data) => api.put("/api/v1/ai/preferences", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    },
  });
}

export function useAvailableProviders() {
  return useQuery<ProvidersListResponse>({
    queryKey: ["ai-providers"],
    queryFn: () => api.get("/api/v1/ai/providers"),
  });
}
