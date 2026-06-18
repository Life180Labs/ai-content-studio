"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaces } from "@/hooks/use-projects";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, CheckCircle2, User, Mic, Video, ArrowRight, ArrowLeft, MonitorPlay, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { WebRecorder } from "@/components/assets/web-recorder";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

const STEPS = [
  "Basic Information",
  "Upload Assets",
  "Voice Cloning",
  "Avatar Processing",
  "Review & Save"
];

export function DigitalHumanWizard() {
  const router = useRouter();
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.[0] || null;
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    voice_tone: "",
    accent: "",
    description: "",
  });

  // Files
  const [trainingVideo, setTrainingVideo] = useState<File | null>(null);
  const [consentVideo, setConsentVideo] = useState<File | null>(null);
  const [voiceAudio, setVoiceAudio] = useState<File | null>(null);

  // Generated IDs
  const [voiceCloneId, setVoiceCloneId] = useState<string | null>(null);
  const [avatarCloneId, setAvatarCloneId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Mobile Session State
  const [mobileSessionId] = useState<string>(uuidv4());
  const [pollingConsent, setPollingConsent] = useState(false);
  const [pollingTraining, setPollingTraining] = useState(false);

  // Use a custom polling function with fetch
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pollingConsent || pollingTraining) {
      interval = setInterval(async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000");
          const res = await fetch(`${apiUrl}/api/v1/workspaces/${currentWorkspace?.id}/digital-humans/mobile-session/${mobileSessionId}`);
          if (res.ok) {
            const blob = await res.blob();
            const file = new File([blob], `mobile-recording-${mobileSessionId}.webm`, { type: "video/webm" });
            
            if (pollingConsent) {
              setConsentVideo(file);
              setPollingConsent(false);
              toast.success("Mobile Consent Video received!");
            } else if (pollingTraining) {
              setTrainingVideo(file);
              setPollingTraining(false);
              toast.success("Mobile Training Video received!");
            }
          }
        } catch (e) {
          // Ignore
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [pollingConsent, pollingTraining, currentWorkspace?.id, mobileSessionId]);

  const handleNext = async () => {
    if (!currentWorkspace) return;

    if (currentStep === 0) {
      if (!formData.name || !formData.role || !formData.voice_tone || !formData.accent) {
        toast.error("Please fill in all required fields.");
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!trainingVideo || !consentVideo) {
        toast.error("Please upload the required videos.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!voiceAudio) {
        toast.error("Please upload an audio sample for voice cloning.");
        return;
      }
      await processVoiceClone();
    } else if (currentStep === 3) {
      await processAvatarCloneAndPreview();
    }
  };

  const processVoiceClone = async () => {
    setIsProcessing(true);
    try {
      const fd = new FormData();
      fd.append("name", `${formData.name}'s Voice`);
      fd.append("description", formData.description);
      fd.append("file", voiceAudio as Blob);

      const voiceRes: any = await api.post(`/api/v1/workspaces/${currentWorkspace?.id}/digital-humans/voice-clone`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setVoiceCloneId(voiceRes.id);
      toast.success("Voice cloned successfully!");
      setCurrentStep(3);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Voice cloning failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processAvatarCloneAndPreview = async () => {
    setIsProcessing(true);
    try {
      // 1. Create Avatar Clone
      const fd = new FormData();
      fd.append("name", `${formData.name}'s Avatar`);
      fd.append("training_video", trainingVideo as Blob);
      fd.append("consent_video", consentVideo as Blob);

      const avatarRes: any = await api.post(`/api/v1/workspaces/${currentWorkspace?.id}/digital-humans/avatar-clone`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000 // Can take a bit
      });
      setAvatarCloneId(avatarRes.id);
      toast.success("Avatar cloned successfully!");

      // 2. Generate Preview
      const previewRes = await api.post(`/api/v1/workspaces/${currentWorkspace?.id}/digital-humans/preview`, {
        voice_clone_id: voiceCloneId,
        avatar_clone_id: avatarRes.id
      });
      
      // Assume polling happens here in a real production app. 
      // For this workflow, HeyGen API might be fast enough for draft test mode, 
      // but normally we'd poll `/videos/status`. 
      // We will skip preview_url blocking to reach step 4 and let the user save.
      
      setCurrentStep(4);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Avatar cloning failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      await api.post(`/api/v1/workspaces/${currentWorkspace?.id}/digital-humans`, {
        ...formData,
        voice_clone_id: voiceCloneId,
        avatar_clone_id: avatarCloneId,
        preview_video_url: previewUrl
      });
      toast.success("Digital Human saved!");
      router.push("/assets/digital-humans");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between">
        <div>
          <CardTitle>Step {currentStep + 1}: {STEPS[currentStep]}</CardTitle>
          <CardDescription>Follow the instructions to train your digital human.</CardDescription>
        </div>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-2 w-8 rounded-full ${i <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="p-6 min-h-[400px]">
        {currentStep === 0 && (
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Sandeep" />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="e.g. AI Engineer" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Voice Tone *</Label>
                <Select onValueChange={v => setFormData({...formData, voice_tone: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Tone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Warm">Warm</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Energetic">Energetic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Accent *</Label>
                <Select onValueChange={v => setFormData({...formData, accent: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Accent" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="UK">United Kingdom</SelectItem>
                    <SelectItem value="India">India</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-8 max-w-3xl mx-auto">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">1. Training Video (For Avatar) *</Label>
                <p className="text-sm text-muted-foreground mb-2">Upload a 2-5 minute video of the subject speaking to camera. Must have clear lighting and audio. <strong>Max size: 32MB.</strong></p>
              </div>

              {trainingVideo ? (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-green-500 w-5 h-5" />
                    <span className="font-medium">{trainingVideo.name} ({(trainingVideo.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setTrainingVideo(null)}>Remove</Button>
                </div>
              ) : (
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="upload" onClick={() => setPollingTraining(false)}><Upload className="w-4 h-4 mr-2" /> Upload File</TabsTrigger>
                    <TabsTrigger value="webcam" onClick={() => setPollingTraining(false)}><MonitorPlay className="w-4 h-4 mr-2" /> Record on Laptop</TabsTrigger>
                    <TabsTrigger value="mobile" onClick={() => setPollingTraining(true)}><Smartphone className="w-4 h-4 mr-2" /> Record on Phone</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload">
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="video/mp4,video/quicktime,video/webm" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file && file.size > 32 * 1024 * 1024) {
                            toast.error("File is too large. Maximum size is 32 MB.");
                            e.target.value = "";
                            return;
                          }
                          setTrainingVideo(file || null);
                        }} 
                      />
                      <Video className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
                      <span className="font-medium">Drag & Drop or Click to Upload (Max 32MB)</span>
                    </div>
                  </TabsContent>
                  <TabsContent value="webcam">
                    <WebRecorder 
                      onRecordingComplete={setTrainingVideo} 
                      script="Please speak clearly into the camera for 2-5 minutes."
                    />
                  </TabsContent>
                  <TabsContent value="mobile">
                    <div className="flex flex-col items-center justify-center p-8 bg-muted/20 border border-border rounded-xl text-center">
                      <QRCodeSVG 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/mobile-record?session_id=${mobileSessionId}&workspace_id=${currentWorkspace?.id}&type=training`}
                        size={150}
                        bgColor={"transparent"}
                        fgColor={"currentColor"}
                        className="mb-4 text-foreground"
                      />
                      <h4 className="font-semibold text-lg">Scan to Record</h4>
                      <p className="text-sm text-muted-foreground max-w-sm mb-4">
                        Scan this QR code with your phone's camera. Leave this page open—it will automatically update when you finish recording on your phone.
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm font-medium animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" /> Waiting for mobile video...
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>

            <div className="w-full h-px bg-border my-6" />

            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">2. Consent Video (HeyGen Requirement) *</Label>
                <p className="text-sm text-muted-foreground mb-2">Upload a short video of the subject reading the consent script to authorize AI cloning. <strong>Max size: 32MB.</strong></p>
              </div>
              
              <div className="bg-primary/5 border border-primary/20 rounded-md p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-primary">Required Consent Script</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(`I, ${formData.name || "[Full Name]"}, hereby declare that I authorize HeyGen to use the footage of me to build a HeyGen Avatar and use it in my HeyGen account.`);
                      toast.success("Script copied to clipboard!");
                    }}
                  >
                    Copy Script
                  </Button>
                </div>
                <p className="text-sm italic text-muted-foreground font-medium">
                  "I, {formData.name || "[Full Name]"}, hereby declare that I authorize HeyGen to use the footage of me to build a HeyGen Avatar and use it in my HeyGen account."
                </p>
              </div>

              {consentVideo ? (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-green-500 w-5 h-5" />
                    <span className="font-medium">{consentVideo.name} ({(consentVideo.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setConsentVideo(null)}>Remove</Button>
                </div>
              ) : (
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="upload" onClick={() => setPollingConsent(false)}><Upload className="w-4 h-4 mr-2" /> Upload File</TabsTrigger>
                    <TabsTrigger value="webcam" onClick={() => setPollingConsent(false)}><MonitorPlay className="w-4 h-4 mr-2" /> Record on Laptop</TabsTrigger>
                    <TabsTrigger value="mobile" onClick={() => setPollingConsent(true)}><Smartphone className="w-4 h-4 mr-2" /> Record on Phone</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload">
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="video/mp4,video/quicktime,video/webm" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file && file.size > 32 * 1024 * 1024) {
                            toast.error("File is too large. Maximum size is 32 MB.");
                            e.target.value = "";
                            return;
                          }
                          setConsentVideo(file || null);
                        }} 
                      />
                      <Video className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
                      <span className="font-medium">Drag & Drop or Click to Upload (Max 32MB)</span>
                    </div>
                  </TabsContent>
                  <TabsContent value="webcam">
                    <WebRecorder 
                      onRecordingComplete={setConsentVideo} 
                      script={`I, ${formData.name || "[Full Name]"}, hereby declare that I authorize HeyGen to use the footage of me to build a HeyGen Avatar and use it in my HeyGen account.`}
                    />
                  </TabsContent>
                  <TabsContent value="mobile">
                    <div className="flex flex-col items-center justify-center p-8 bg-muted/20 border border-border rounded-xl text-center">
                      <QRCodeSVG 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/mobile-record?session_id=${mobileSessionId}&workspace_id=${currentWorkspace?.id}&type=consent&name=${encodeURIComponent(formData.name)}`}
                        size={150}
                        bgColor={"transparent"}
                        fgColor={"currentColor"}
                        className="mb-4 text-foreground"
                      />
                      <h4 className="font-semibold text-lg">Scan to Record</h4>
                      <p className="text-sm text-muted-foreground max-w-sm mb-4">
                        Scan this QR code with your phone's camera. Leave this page open—it will automatically update when you finish recording on your phone.
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm font-medium animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" /> Waiting for mobile video...
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6 max-w-xl mx-auto text-center py-8">
            <div className="bg-primary/10 text-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mic className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-semibold">Voice Cloning</h3>
            <p className="text-muted-foreground">
              Upload a clean 1-5 minute audio sample of {formData.name} speaking without background noise.
            </p>
            <div className="border-2 border-dashed border-primary/50 rounded-lg p-8 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer relative">
              <input type="file" accept="audio/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setVoiceAudio(e.target.files?.[0] || null)} />
              <Upload className="h-8 w-8 mx-auto text-primary mb-4" />
              <span className="font-medium text-primary">{voiceAudio ? voiceAudio.name : "Upload Voice Sample (.mp3, .wav)"}</span>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6 max-w-xl mx-auto text-center py-12">
            <div className="bg-primary/10 text-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-semibold">Digital Twin Processing</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              We are now processing your videos and audio to create a lifelike AI digital twin. This may take a few moments.
            </p>
            <div className="p-6 bg-muted/30 rounded-lg mt-8 text-left space-y-4">
               <div className="flex items-center gap-3">
                 <CheckCircle2 className="h-5 w-5 text-primary" />
                 <span>Voice Cloned Successfully</span>
               </div>
               <div className="flex items-center gap-3 text-muted-foreground">
                 <Loader2 className="h-5 w-5 animate-spin" />
                 <span>Analyzing Facial Dynamics...</span>
               </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="max-w-2xl mx-auto py-8">
             <div className="text-center mb-8">
               <div className="bg-green-500/10 text-green-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CheckCircle2 className="h-8 w-8" />
               </div>
               <h3 className="text-2xl font-semibold">Digital Human Ready!</h3>
               <p className="text-muted-foreground">Review your new asset before saving it to the library.</p>
             </div>
             
             <Card>
               <CardContent className="p-6 flex gap-6">
                 <div className="w-1/3 aspect-[3/4] bg-muted rounded-md flex items-center justify-center">
                   <User className="h-12 w-12 text-muted-foreground opacity-30" />
                 </div>
                 <div className="w-2/3 space-y-4">
                   <div>
                     <h4 className="font-semibold text-xl">{formData.name}</h4>
                     <p className="text-muted-foreground">{formData.role}</p>
                   </div>
                   <div className="grid grid-cols-2 gap-4 text-sm">
                     <div>
                       <span className="text-muted-foreground block text-xs">Voice Tone</span>
                       <span className="font-medium">{formData.voice_tone}</span>
                     </div>
                     <div>
                       <span className="text-muted-foreground block text-xs">Accent</span>
                       <span className="font-medium">{formData.accent}</span>
                     </div>
                   </div>
                   <div className="pt-4 mt-4 border-t border-border">
                     <span className="text-muted-foreground block text-xs mb-1">IDs</span>
                     <code className="text-[10px] block text-muted-foreground">Voice: {voiceCloneId}</code>
                     <code className="text-[10px] block text-muted-foreground">Avatar: {avatarCloneId}</code>
                   </div>
                 </div>
               </CardContent>
             </Card>
          </div>
        )}

      </CardContent>

      <CardFooter className="bg-muted/10 border-t border-border/50 p-6 flex justify-between">
        <Button variant="ghost" disabled={currentStep === 0 || isProcessing} onClick={() => setCurrentStep(c => c - 1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        
        {currentStep < 4 ? (
          <Button onClick={handleNext} disabled={isProcessing} className="gap-2">
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            {currentStep === 2 || currentStep === 3 ? "Process" : "Continue"}
            {!isProcessing && <ArrowRight className="h-4 w-4 ml-2" />}
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={isProcessing} className="gap-2 bg-green-600 hover:bg-green-700">
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            Save to Library
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
