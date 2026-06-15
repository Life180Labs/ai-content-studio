"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FolderKanban, ArrowRight, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

import { useProjects, useWorkspaces, useDeleteProject } from "@/hooks/use-projects";
import Link from "next/link";

const STAGE_NAMES = ["Canvas", "Content", "Script", "Storyboard", "Voice", "Avatar", "Video"];

export default function ProjectsPage() {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const router = useRouter();

  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id || null;
  const { data: projectsData, isLoading: isProjectsLoading } = useProjects(workspaceId);
  const projects = projectsData?.data || [];
  const deleteProject = useDeleteProject(workspaceId);

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject.mutateAsync(projectToDelete);
      toast.success("Project deleted");
    } catch (err: any) {
      toast.error("Failed to delete project");
    } finally {
      setProjectToDelete(null);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete(id);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsCreating(true);
    try {
      let targetWorkspaceId = workspaceId;
      
      if (!targetWorkspaceId) {
        // Automatically create a default workspace for new users
        const newWorkspace = await api.post<{id: string}>("/api/v1/workspaces", { 
          name: "Personal Workspace",
          slug: "personal-workspace-" + Date.now().toString(36)
        });
        targetWorkspaceId = newWorkspace.id;
      }
      
      const res = await api.post<{id: string}>(`/api/v1/workspaces/${targetWorkspaceId}/projects`, { name: projectName });
      
      toast.success(`Project "${projectName}" created!`);
      setOpen(false);
      setProjectName("");
      router.push(`/projects/${res.id}`);
    } catch (err: any) {
      let errorMessage = "Failed to create project";
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
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your content generation pipelines
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="h-4 w-4" />
            New Project
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create new project</DialogTitle>
              <DialogDescription>
                Start a new AI content generation pipeline
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  placeholder="My Awesome Video"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || !projectName.trim()}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone and will remove all associated pipeline runs and assets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProject.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isProjectsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed border-2 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 rounded-3xl bg-muted flex items-center justify-center mb-6">
              <FolderKanban className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">No projects yet</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Create your first project to start the AI-powered video generation
              pipeline. From idea to finished video in minutes.
            </p>
            <Button
              className="mt-8 gap-2"
              size="lg"
              onClick={() => setOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create your first project
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg leading-tight mt-1 truncate">{project.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 relative z-10"
                    onClick={(e) => handleDeleteClick(e, project.id)}
                    disabled={deleteProject.isPending && projectToDelete === project.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Stage</span>
                      <Badge variant="secondary">
                        {STAGE_NAMES[project.current_stage] || "Video"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm font-medium">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
