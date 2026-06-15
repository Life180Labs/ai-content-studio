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

export interface PipelineStatus {
  project_id: string;
  current_stage: number;
  stage_name: string;
  canvas_data: CanvasInput | null;
  content_result: ContentResult | null;
  script_result: ScriptResult | null;
  runs: PipelineRun[];
  total_cost_usd: number;
  total_tokens: number;
}

// ── Hooks ──────────────────────────────────────────────────

function pipelineUrl(workspaceId: string, projectId: string) {
  return `/api/v1/workspaces/${workspaceId}/projects/${projectId}/pipeline`;
}

export function usePipelineStatus(workspaceId: string, projectId: string) {
  return useQuery<PipelineStatus>({
    queryKey: ["pipeline", projectId],
    queryFn: () =>
      api.get(`${pipelineUrl(workspaceId, projectId)}/status`),
    enabled: !!projectId && !!workspaceId,
  });
}

export function useGenerateContent(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ContentResult, unknown, CanvasInput>({
    mutationFn: (canvas) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/content`, canvas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", projectId] });
    },
  });
}

export function useGenerateScript(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<ScriptResult, unknown, { additional_context?: string }>({
    mutationFn: (data) =>
      api.post(`${pipelineUrl(workspaceId, projectId)}/script`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", projectId] });
    },
  });
}

export function useRegenerate(workspaceId: string, projectId: string) {
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
  workspaceId: string,
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
