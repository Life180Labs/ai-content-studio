/**
 * TanStack Query hooks for Pipeline API.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────

export interface CanvasInput {
  topic: string;
  key_points: string[];
  target_audience: string;
  goal: string;
  tone: string;
  length: string;
  platform: string;
  call_to_action: string;
  brand_voice: string;
  additional_context: string;
}

export interface ContentVariation {
  content: string;
  quality_score: number;
  word_count: number;
  tone_analysis: string;
}

export interface ContentResult {
  variations: ContentVariation[];
  project_id: string;
  stage: string;
}

export interface ScriptSection {
  section_type: string;
  text: string;
  duration_estimate: string;
  visual_notes: string;
}

export interface ScriptResult {
  sections: ScriptSection[];
  full_script: string;
  estimated_duration: string;
  word_count: number;
  project_id: string;
  stage: string;
}

export interface StoryboardScene {
  scene_index: number;
  voice_text: string;
  visual_prompt: string;
  avatar_action: string;
  camera_direction: string;
}

export interface StoryboardResult {
  scenes: StoryboardScene[];
  video_frame_size: string;
  video_quality: string;
  project_id: string;
  stage: string;
}

export interface PipelineRun {
  id: string;
  stage: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  status: string;
  created_at: string;
}

export type PipelineStatusResponse = {
  project_id: string;
  stage: string;
  content_result?: ContentResult;
  script_result?: ScriptResult;
  storyboard_result?: StoryboardResult;
  voice_result?: any;
  video_result?: any;
  runs: PipelineRun[];
  total_cost_usd: number;
  total_tokens: number;
};

export type AvatarGeneratePayload = {
  selected_avatar_id: string;
  use_custom_voice: boolean;
};

// ── Hooks ──────────────────────────────────────────────────

function pipelineUrl(workspaceId: string | null, projectId: string) {
  return `/api/v1/workspaces/${workspaceId}/projects/${projectId}/pipeline`;
}

export function usePipelineStatus(workspaceId: string | null, projectId: string) {
  return useQuery<PipelineStatusResponse>({
    queryKey: ["pipeline", projectId],
    queryFn: () =>
      api.get(`${pipelineUrl(workspaceId, projectId)}/status`),
    enabled: !!projectId && !!workspaceId,
    refetchInterval: (query) => {
      // Poll every 3 seconds if we're waiting for a background task
      const data = query.state.data;
      if (!data) return false;
      // If we are on storyboard, voice, avatar, we poll
      return 3000;
    },
  });
}

export function useGenerateContent(workspaceId: string | null, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ContentResult, unknown, CanvasInput>({
    mutationFn: (canvas) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/content`, canvas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", projectId] });
    },
  });
}

export function useGenerateScript(workspaceId: string | null, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ScriptResult, unknown, { additional_context?: string }>({
    mutationFn: (data) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/script`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", projectId] });
    },
  });
}

export function useRegenerate(workspaceId: string | null, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ContentResult | ScriptResult,
    unknown,
    { stage: string; additional_context?: string }
  >({
    mutationFn: (data) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/regenerate`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", projectId] });
    },
  });
}

export function useSuggestKeyPoints(
  workspaceId: string | null,
  projectId: string
) {
  return useMutation<
    { key_points: string[] },
    unknown,
    { topic: string; target_audience?: string; count?: number }
  >({
    mutationFn: (data) =>
      api.post(
        `${pipelineUrl(workspaceId, projectId)}/suggest-key-points`,
        data
      ),
  });
}

export function useGenerateStoryboard(workspaceId: string | null, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ task_id: string }, unknown, { script: string }>({
    mutationFn: (data) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/storyboard`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", projectId] });
    },
  });
}

export interface VoiceGeneratePayload {
  selected_voice_id: string;
  storyboard_scenes: StoryboardScene[];
  video_frame_size: string;
  video_quality: string;
}

export function useGenerateVoice(workspaceId: string | null, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ task_id: string }, unknown, VoiceGeneratePayload>({
    mutationFn: (data) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/voice`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", projectId] });
    },
  });
}

export function useSaveStoryboard(workspaceId: string | null, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<StoryboardResult, unknown, { scenes: StoryboardScene[], video_frame_size: string, video_quality: string }>({
    mutationFn: (data) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/storyboard/save`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", projectId] });
    },
  });
}

export function useRegenerateScene(workspaceId: string | null, projectId: string) {
  return useMutation<StoryboardScene, unknown, { scene_index: number, additional_context: string, current_scene: StoryboardScene }>({
    mutationFn: (data) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/storyboard/regenerate-scene`, data),
  });
}

export function useGenerateAvatar(workspaceId: string | null, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ task_id: string }, unknown, AvatarGeneratePayload>({
    mutationFn: (payload) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/avatar`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", projectId] });
    },
  });
}

export function usePollVideoStatus(workspaceId: string | null, projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["video-status", projectId],
    queryFn: async () => {
      const res = await api.get(`${pipelineUrl(workspaceId, projectId)}/videos/status`);
      return res.data;
    },
    enabled: !!workspaceId && !!projectId && enabled,
    refetchInterval: 5000, // Poll every 5 seconds
    retry: false,
  });
}
