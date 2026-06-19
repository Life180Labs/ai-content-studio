"use client";

import { useState } from "react";
import { useWorkspaces } from "@/hooks/use-projects";
import { useCreateCustomAvatar } from "@/hooks/use-assets";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, UploadCloud, Video, Wand2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export function CreateAvatarModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [avatarType, setAvatarType] = useState<"photo" | "digital_twin" | "prompt">("photo");
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [consentUrl, setConsentUrl] = useState<string | null>(null);

  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id || null;
  const createAvatar = useCreateCustomAvatar(workspaceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    if (avatarType !== "prompt" && !file) return toast.error("File is required");
    if (avatarType === "prompt" && !prompt.trim()) return toast.error("Prompt is required");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("avatar_type", avatarType);
    if (file) formData.append("file", file);
    if (prompt) formData.append("prompt", prompt);

    try {
      const res = await createAvatar.mutateAsync(formData);
      if (res.consent_url) {
        setConsentUrl(res.consent_url);
        toast.success("Digital Twin created! Please provide consent.");
      } else {
        toast.success("Avatar created successfully!");
        handleClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "Failed to create avatar");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setName("");
    setFile(null);
    setPrompt("");
    setConsentUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Avatar
        </Button>
      } />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Custom Avatar</DialogTitle>
        </DialogHeader>

        {consentUrl ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
            <Video className="h-12 w-12 text-primary" />
            <h3 className="text-lg font-medium">Consent Required</h3>
            <p className="text-sm text-muted-foreground">
              HeyGen requires explicit consent to use your video as a Digital Twin. 
              Please click the link below to record your consent.
            </p>
            <Button
              render={<a href={consentUrl} target="_blank" rel="noopener noreferrer" />}
              className="w-full gap-2"
            >
              <LinkIcon className="h-4 w-4" />
              Go to HeyGen Consent Portal
            </Button>
            <Button variant="ghost" onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label>Avatar Name</Label>
              <Input
                placeholder="e.g., Sarah Office Look"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <Tabs value={avatarType} onValueChange={(v) => setAvatarType(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="photo">Photo</TabsTrigger>
                <TabsTrigger value="prompt">Prompt</TabsTrigger>
                <TabsTrigger value="digital_twin">Digital Twin</TabsTrigger>
              </TabsList>
              
              <TabsContent value="photo" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Upload Portrait Photo</Label>
                  <Input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Clear, front-facing headshot for best results.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="prompt" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Avatar Description Prompt</Label>
                  <Textarea 
                    placeholder="Young woman, confident expression, short silver hair, warm brown eyes, wearing a dark blue suit..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                  />
                </div>
              </TabsContent>

              <TabsContent value="digital_twin" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Upload Training Video</Label>
                  <Input 
                    type="file" 
                    accept="video/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload a high-quality video of the person speaking. You will be redirected to provide consent after upload.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAvatar.isPending}>
                {createAvatar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Avatar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
