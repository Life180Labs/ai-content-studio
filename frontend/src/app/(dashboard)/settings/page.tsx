"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, User, Key, Palette } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and AI routing preferences
        </p>
      </div>

      <div className="space-y-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4.5 w-4.5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Profile settings will be available here. Update your name, email,
              and avatar.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-4.5 w-4.5" />
              AI Provider Keys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure your AI provider API keys and routing strategy. Support
              for Gemini, OpenAI, Anthropic, Groq, DeepSeek, and more.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4.5 w-4.5" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Customize the look and feel of your workspace. Theme, layout, and
              display preferences.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
