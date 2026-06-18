"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WebRecorder } from "@/components/assets/web-recorder";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function MobileRecordPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const workspaceId = searchParams.get("workspace_id");
  const type = searchParams.get("type") || "consent";
  const name = searchParams.get("name") || "Full Name";

  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  if (!sessionId || !workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
        <p className="text-gray-400">Please scan the QR code from the AI Content Studio again.</p>
      </div>
    );
  }

  const script = type === "consent" 
    ? `I, ${name}, hereby declare that I authorize HeyGen to use the footage of me to build a HeyGen Avatar and use it in my HeyGen account.`
    : "Please speak clearly into the camera for 2-5 minutes.";

  const handleRecordingComplete = async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000");
      const res = await fetch(`${apiUrl}/api/v1/workspaces/${workspaceId}/digital-humans/mobile-session/${sessionId}`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        throw new Error("Failed to upload recording.");
      }

      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-white pb-safe">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900">
        <h1 className="text-lg font-semibold text-center">
          {type === "consent" ? "Record Consent Video" : "Record Training Video"}
        </h1>
      </div>

      <div className="flex-1 p-4 flex flex-col items-center justify-center">
        {isSuccess ? (
          <div className="text-center animate-in zoom-in duration-300">
            <div className="bg-green-500/20 text-green-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Upload Complete!</h2>
            <p className="text-zinc-400">
              You can now close this tab and return to your computer to continue.
            </p>
          </div>
        ) : isUploading ? (
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Uploading to Studio...</h2>
            <p className="text-zinc-400">Please keep this tab open.</p>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-6">
            {error && (
              <div className="bg-red-500/10 text-red-500 p-4 rounded-lg text-sm text-center border border-red-500/20">
                {error}
              </div>
            )}
            
            <Card className="bg-zinc-900 border-zinc-800 text-white">
              <CardContent className="p-0">
                <WebRecorder 
                  onRecordingComplete={handleRecordingComplete} 
                  script={script}
                  isMobile={true}
                />
              </CardContent>
            </Card>
            
            <div className="text-center space-y-2 px-4">
              <p className="text-sm text-zinc-400">
                <strong>Tip:</strong> Find a quiet, well-lit place. Look directly at the camera.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
