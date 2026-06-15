"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  useAIPreferences,
  useSaveAIPreferences,
  useAvailableProviders,
  type AIPreferenceInput,
  type ProviderKeyInput,
} from "@/hooks/use-ai-preferences";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Key,
  Sparkles,
  Shield,
  Loader2,
  Check,
  X,
  Plus,
  Trash2,
  User,
  Palette,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";

const PROVIDERS = [
  { key: "gemini", label: "Google Gemini", icon: "✦" },
  { key: "openai", label: "OpenAI", icon: "◈" },
  { key: "anthropic", label: "Anthropic", icon: "◉" },
  { key: "heygen", label: "HeyGen", icon: "▶" },
] as const;

const TASK_LABELS: Record<string, string> = {
  content: "Content Generation",
  script: "Script Writing",
  storyboard: "Storyboard",
  voice: "Voice Synthesis",
  avatar: "Avatar Generation",
  video: "Video Rendering",
};

export default function SettingsPage() {
  const { data: prefs, isLoading: prefsLoading } = useAIPreferences();
  const { data: providersData } = useAvailableProviders();
  const saveMutation = useSaveAIPreferences();

  // Form state
  const [defaultProvider, setDefaultProvider] = useState("gemini");
  const [defaultModel, setDefaultModel] = useState("gemini-2.5-flash");
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [fallbackAction, setFallbackAction] = useState("retry");
  const [fallbackProvider, setFallbackProvider] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [retryCount, setRetryCount] = useState(2);
  const [keys, setKeys] = useState<ProviderKeyInput>({});
  const [customModels, setCustomModels] = useState<Record<string, string[]>>({});
  const [newModelInputs, setNewModelInputs] = useState<Record<string, string>>({});
  const [taskOverrides, setTaskOverrides] = useState<Record<string, { provider: string; model: string }>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  // Sync form with loaded prefs
  useEffect(() => {
    if (prefs) {
      setDefaultProvider(prefs.default_provider);
      setDefaultModel(prefs.default_model);
      setFallbackEnabled(prefs.fallback_enabled);
      setFallbackAction(prefs.fallback_action);
      setFallbackProvider(prefs.fallback_provider || "");
      setFallbackModel(prefs.fallback_model || "");
      setRetryCount(prefs.retry_count);
      setCustomModels(prefs.custom_models || {});
      setTaskOverrides(prefs.task_overrides || {});
    }
  }, [prefs]);

  const providers = providersData?.providers || [];

  const getModelsForProvider = (providerName: string): string[] => {
    const p = providers.find((p) => p.name === providerName);
    const base = p?.models || [];
    const custom = customModels[providerName] || [];
    return [...new Set([...base, ...custom])];
  };

  const textProviders = providers.filter((p) => p.supports_text_generation);

  const handleSave = async () => {
    const data: AIPreferenceInput = {
      default_provider: defaultProvider,
      default_model: defaultModel,
      fallback_enabled: fallbackEnabled,
      fallback_action: fallbackAction,
      fallback_provider: fallbackProvider || null,
      fallback_model: fallbackModel || null,
      retry_count: retryCount,
      provider_keys: keys,
      custom_models: customModels,
      task_overrides: taskOverrides,
    };

    try {
      await saveMutation.mutateAsync(data);
      toast.success("AI settings saved!");
      setKeys({});
    } catch (err: any) {
      let errorMessage = "Failed to save settings";
      if (typeof err?.detail === "string") {
        errorMessage = err.detail;
      } else if (Array.isArray(err?.detail) && err.detail.length > 0 && err.detail[0].msg) {
        errorMessage = err.detail[0].msg;
      } else if (err?.error?.message) {
        errorMessage = err.error.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      toast.error(errorMessage);
    }
  };

  const addCustomModel = (provider: string) => {
    const modelName = newModelInputs[provider]?.trim();
    if (!modelName) return;
    setCustomModels((prev) => ({
      ...prev,
      [provider]: [...(prev[provider] || []), modelName],
    }));
    setNewModelInputs((prev) => ({ ...prev, [provider]: "" }));
  };

  const removeCustomModel = (provider: string, model: string) => {
    setCustomModels((prev) => ({
      ...prev,
      [provider]: (prev[provider] || []).filter((m) => m !== model),
    }));
  };

  if (prefsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your AI providers and routing strategy
        </p>
      </div>

      {/* ── Profile Card (placeholder) ───────────────── */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4.5 w-4.5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Profile settings will be available here. Update your name, email, and avatar.
          </p>
        </CardContent>
      </Card>

      {/* ── AI Provider Keys ─────────────────────────── */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4.5 w-4.5" />
            AI Provider Keys
          </CardTitle>
          <CardDescription>
            Add API keys for each provider. Keys are encrypted at rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PROVIDERS.map(({ key, label, icon }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  {label}
                </Label>
                {prefs?.provider_keys_status?.[key as keyof typeof prefs.provider_keys_status] ? (
                  <Badge variant="secondary" className="gap-1 text-xs bg-success/10 text-success">
                    <Check className="h-3 w-3" /> Configured
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground">
                    <X className="h-3 w-3" /> Not set
                  </Badge>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showKey[key] ? "text" : "password"}
                  placeholder={
                    prefs?.provider_keys_status?.[key as keyof typeof prefs.provider_keys_status]
                      ? "••••••••••••••••  (key saved — enter new to replace)"
                      : `Enter your ${label} API key`
                  }
                  value={(keys as Record<string, string | undefined>)[key] || ""}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey[key] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Default Provider & Model ─────────────────── */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4.5 w-4.5" />
            Default AI Routing
          </CardTitle>
          <CardDescription>
            Choose the default provider and model for all generation tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Default Provider</Label>
              <select
                value={defaultProvider}
                onChange={(e) => {
                  setDefaultProvider(e.target.value);
                  const models = getModelsForProvider(e.target.value);
                  if (models.length > 0) setDefaultModel(models[0]);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {textProviders.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Default Model</Label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {getModelsForProvider(defaultProvider).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Custom Models ────────────────────────────── */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4.5 w-4.5" />
            Custom Models
          </CardTitle>
          <CardDescription>
            Add custom or fine-tuned models for each provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PROVIDERS.filter((p) => p.key !== "heygen").map(({ key, label }) => (
            <div key={key} className="space-y-3">
              <Label className="text-sm font-medium">{label}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={`e.g. ft:${key}-custom-v1`}
                  value={newModelInputs[key] || ""}
                  onChange={(e) =>
                    setNewModelInputs((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && addCustomModel(key)}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addCustomModel(key)}
                  disabled={!newModelInputs[key]?.trim()}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {(customModels[key] || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(customModels[key] || []).map((model) => (
                    <Badge
                      key={model}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {model}
                      <button
                        onClick={() => removeCustomModel(key, model)}
                        className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Fallback Configuration ────────────────────── */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4.5 w-4.5" />
            Fallback Strategy
          </CardTitle>
          <CardDescription>
            Configure what happens when the primary provider fails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fallbackEnabled}
                onChange={(e) => setFallbackEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm font-medium">Enable fallback</span>
            </label>
          </div>

          {fallbackEnabled && (
            <div className="space-y-4 pl-6 border-l-2 border-primary/20">
              <div className="space-y-2">
                <Label>Fallback Action</Label>
                <select
                  value={fallbackAction}
                  onChange={(e) => setFallbackAction(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="retry">Retry same provider</option>
                  <option value="switch_model">Switch to fallback provider</option>
                </select>
              </div>

              {fallbackAction === "retry" && (
                <div className="space-y-2">
                  <Label>Retry Count</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={retryCount}
                    onChange={(e) => setRetryCount(parseInt(e.target.value) || 2)}
                    className="w-24"
                  />
                </div>
              )}

              {fallbackAction === "switch_model" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fallback Provider</Label>
                    <select
                      value={fallbackProvider}
                      onChange={(e) => {
                        setFallbackProvider(e.target.value);
                        const models = getModelsForProvider(e.target.value);
                        if (models.length > 0) setFallbackModel(models[0]);
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select provider</option>
                      {textProviders
                        .filter((p) => p.name !== defaultProvider)
                        .map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.display_name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fallback Model</Label>
                    <select
                      value={fallbackModel}
                      onChange={(e) => setFallbackModel(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select model</option>
                      {fallbackProvider &&
                        getModelsForProvider(fallbackProvider).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Appearance (placeholder) ──────────────────── */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4.5 w-4.5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Customize the look and feel of your workspace. Theme, layout, and display preferences.
          </p>
        </CardContent>
      </Card>

      {/* ── Save Button ──────────────────────────────── */}
      <div className="flex justify-end pb-8">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          size="lg"
          className="gap-2 min-w-[160px]"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
