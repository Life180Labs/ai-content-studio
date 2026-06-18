import { DigitalHumanWizard } from "@/components/assets/digital-human-wizard";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CreateDigitalHumanPage() {
  return (
    <div className="flex-1 overflow-auto bg-background/50">
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/assets">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Digital Human</h1>
            <p className="text-muted-foreground mt-1">
              Train a personalized AI presenter by uploading photos, video, and cloning your voice.
            </p>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <DigitalHumanWizard />
        </div>
      </div>
    </div>
  );
}
