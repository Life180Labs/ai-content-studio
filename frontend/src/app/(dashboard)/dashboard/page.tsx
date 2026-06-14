"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth";
import {
  FolderKanban,
  Video,
  DollarSign,
  Zap,
  TrendingUp,
  CheckCircle2,
  Plus,
  ArrowUpRight,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const metrics = [
  {
    title: "Projects",
    value: "0",
    change: "Start your first project",
    icon: FolderKanban,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Generated Assets",
    value: "0",
    change: "Videos, scripts, voice-overs",
    icon: Video,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "AI Cost",
    value: "$0.00",
    change: "This month",
    icon: DollarSign,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    title: "Token Usage",
    value: "0",
    change: "Tokens consumed",
    icon: Zap,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Completion Rate",
    value: "—",
    change: "Pipeline success",
    icon: TrendingUp,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    title: "Success Rate",
    value: "—",
    change: "AI generation accuracy",
    icon: CheckCircle2,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
];

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.full_name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your content pipeline
          </p>
        </div>
        <Link href="/projects">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card
            key={metric.title}
            className="group hover:shadow-md transition-all animate-standard border-border/50 hover:border-border"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div
                className={`h-9 w-9 rounded-lg ${metric.bgColor} flex items-center justify-center`}
              >
                <metric.icon className={`h-4.5 w-4.5 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity & Insights Row */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Activity */}
        <Card className="lg:col-span-3 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Recent Activity
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Live
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FolderKanban className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">No activity yet</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                Create your first project to see pipeline activity, job status,
                and approval workflows here.
              </p>
              <Link href="/projects">
                <Button variant="outline" className="mt-6 gap-2">
                  <Plus className="h-4 w-4" />
                  Start a Project
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">
              AI Insights
            </CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold">Insights coming soon</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-[220px]">
                AI-powered recommendations for cost optimization and performance
                will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
