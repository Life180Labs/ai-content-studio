"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Video, Square, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface WebRecorderProps {
  onRecordingComplete: (file: File) => void;
  script?: string;
  isMobile?: boolean;
}

export function WebRecorder({ onRecordingComplete, script, isMobile = false }: WebRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [timer, setTimer] = useState(0);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: isMobile ? "user" : "default" },
        audio: true
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Mute preview to avoid feedback loop
      }
      setIsCameraActive(true);
      setRecordedBlob(null);
    } catch (err: any) {
      toast.error("Camera access denied or unavailable.");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startRecording = () => {
    if (!videoRef.current?.srcObject) return;
    
    setRecordedBlob(null);
    const stream = videoRef.current.srcObject as MediaStream;
    
    // Use highly compressed settings to stay under 32MB!
    const options = {
      mimeType: MediaRecorder.isTypeSupported('video/webm; codecs=vp9') ? 'video/webm; codecs=vp9' : 'video/webm',
      videoBitsPerSecond: 1500000 // 1.5 Mbps target
    };
    
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;
    
    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: options.mimeType });
      setRecordedBlob(blob);
      
      // Stop camera right after recording to preview
      stopCamera();
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleUseRecording = () => {
    if (recordedBlob) {
      const file = new File([recordedBlob], `recording-${Date.now()}.webm`, { type: recordedBlob.type });
      onRecordingComplete(file);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="w-full flex flex-col items-center bg-black/5 rounded-xl border border-border overflow-hidden relative">
      {/* Teleprompter Script Overlay */}
      {script && isCameraActive && (
        <div className="absolute top-4 left-4 right-4 z-10 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm text-center font-medium shadow-lg pointer-events-none">
          {script}
        </div>
      )}

      {/* Video Preview */}
      <div className="relative w-full bg-black aspect-video flex items-center justify-center overflow-hidden">
        {!isCameraActive && !recordedBlob && (
          <div className="text-center text-white/50">
            <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Camera is inactive</p>
          </div>
        )}
        
        {recordedBlob ? (
          <video 
            src={URL.createObjectURL(recordedBlob)} 
            controls 
            className="w-full h-full object-cover"
          />
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover ${!isCameraActive && 'hidden'}`} 
          />
        )}

        {isRecording && (
          <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 animate-pulse z-10">
            <div className="w-2 h-2 rounded-full bg-white" />
            {formatTime(timer)}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full p-4 flex items-center justify-between bg-card border-t border-border">
        {recordedBlob ? (
          <>
            <Button variant="outline" onClick={startCamera}>
              <RotateCcw className="w-4 h-4 mr-2" /> Retake
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleUseRecording}>
              Use this Recording
            </Button>
          </>
        ) : (
          <div className="flex w-full items-center justify-center gap-4">
            {!isCameraActive ? (
              <Button variant="default" onClick={startCamera} className="w-full max-w-xs">
                Turn on Camera
              </Button>
            ) : (
              <>
                {!isRecording ? (
                  <Button variant="destructive" onClick={startRecording} className="w-full max-w-xs rounded-full">
                    <div className="w-3 h-3 rounded-full bg-white mr-2" /> Record
                  </Button>
                ) : (
                  <Button variant="outline" onClick={stopRecording} className="w-full max-w-xs border-red-500 text-red-500 hover:bg-red-50">
                    <Square className="w-4 h-4 mr-2" /> Stop Recording
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
