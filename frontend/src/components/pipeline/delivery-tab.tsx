"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Film, FileText, FileJson, CheckCircle2, Package } from "lucide-react";
import { usePollVideoStatus } from "@/hooks/use-pipeline";

interface DeliveryTabProps {
  workspaceId: string | null;
  projectId: string;
}

export function DeliveryTab({ workspaceId, projectId }: DeliveryTabProps) {
  const { data: videoStatus } = usePollVideoStatus(workspaceId, projectId, true);
  
  const handleDownloadPackage = () => {
    // Navigate to the endpoint which streams the ZIP file
    if (!workspaceId) return;
    const url = `/api/v1/workspaces/${workspaceId}/projects/${projectId}/pipeline/package`;
    
    // Create an invisible anchor tag to trigger the download
    const a = document.createElement("a");
    a.href = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}${url}` : `http://localhost:8000${url}`;
    
    // In production we would need to pass authorization headers if the endpoint requires it.
    // For now, if the API depends on cookies/session, this standard link will work.
    // If it relies on a Bearer token, we would fetch it via blob.
    
    // Using fetch to pass the authorization header since our API requires auth
    fetch(a.href, {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("nexus_token") || ""}`
      }
    })
    .then(response => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.blob();
    })
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${projectId}_package.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    })
    .catch(console.error);
  };

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      <div className="text-center space-y-4 py-8">
        <div className="mx-auto w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Your Video is Ready!</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          The final video has been merged and all assets are prepared for delivery.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 overflow-hidden border-2 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              Final Output Video
            </CardTitle>
            <CardDescription>
              The concatenated video of all approved scenes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="aspect-video bg-black rounded-lg border flex items-center justify-center overflow-hidden relative group">
              {/* Note: since the merge happens on the backend, we would normally get the merged URL. 
                  For now we can display a placeholder or the first scene if merged URL isn't in state */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white/80 z-10">
                <Film className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium text-lg">Final Merged Video</p>
                <p className="text-sm opacity-70 mt-2">Available in the complete package</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Project Package
              </CardTitle>
              <CardDescription>
                Download all generated project assets
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3 text-sm">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  <span>Final Merged Video (.mp4)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  <span>Individual Scene Videos (.mp4)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Audio Voiceovers (.mp3)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Final Script (.txt)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                  <span>Storyboard Data (.json)</span>
                </div>
              </div>
              
              <div className="pt-6 mt-auto border-t">
                <Button 
                  size="lg" 
                  className="w-full gap-2 text-md" 
                  onClick={handleDownloadPackage}
                >
                  <Download className="h-5 w-5" />
                  Download Package (.zip)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
