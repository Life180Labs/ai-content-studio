"use client";

import { useState } from "react";
import { useBrandKits, useCreateBrandKit, useDeleteBrandKit } from "@/hooks/use-assets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Palette } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface BrandKitsManagerProps {
  workspaceId: string | null;
}

export function BrandKitsManager({ workspaceId }: BrandKitsManagerProps) {
  const { data: brandKits, isLoading } = useBrandKits(workspaceId);
  const createBrandKit = useCreateBrandKit(workspaceId);
  const deleteBrandKit = useDeleteBrandKit(workspaceId);

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#000000");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      await createBrandKit.mutateAsync({
        name,
        colors: { primary: primaryColor },
        fonts: {},
        logos: {}
      });
      toast.success("Brand kit created successfully");
      setIsOpen(false);
      setName("");
      setPrimaryColor("#000000");
    } catch (err: any) {
      toast.error(err?.detail || "Failed to create brand kit");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this brand kit?")) return;
    try {
      await deleteBrandKit.mutateAsync(id);
      toast.success("Brand kit deleted");
    } catch (err: any) {
      toast.error("Failed to delete brand kit");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading brand kits...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Brand Kit
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Brand Kit</DialogTitle>
              <DialogDescription>
                Set up a new brand kit with your colors, fonts, and logos.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Brand Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-3">
                  <Input 
                    type="color" 
                    value={primaryColor} 
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-12 p-1 h-10"
                  />
                  <Input 
                    value={primaryColor} 
                    onChange={e => setPrimaryColor(e.target.value)}
                    placeholder="#000000"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={createBrandKit.isPending}>
                  {createBrandKit.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Kit
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(!brandKits || brandKits.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed bg-muted/30">
          <Palette className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-semibold text-lg">No Brand Kits</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            Create a brand kit to manage custom colors, fonts, and logos across your videos.
          </p>
          <Button variant="outline" onClick={() => setIsOpen(true)}>Create First Brand Kit</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {brandKits.map((kit) => (
            <Card key={kit.id} className="relative group">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex justify-between items-start">
                  {kit.name}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity -mt-2 -mr-2"
                    onClick={() => handleDelete(kit.id)}
                    disabled={deleteBrandKit.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {kit.logos && Object.keys(kit.logos).length > 0 ? "Includes logos" : "Colors and fonts"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mt-2">
                  {Object.entries(kit.colors || {}).map(([name, hex]) => (
                    <div 
                      key={name}
                      className="h-8 w-8 rounded-full border shadow-sm" 
                      style={{ backgroundColor: hex as string }}
                      title={`${name}: ${hex}`}
                    />
                  ))}
                  {(!kit.colors || Object.keys(kit.colors).length === 0) && (
                    <div className="h-8 w-8 rounded-full border border-dashed flex items-center justify-center bg-muted/50">
                      <Palette className="h-3 w-3 text-muted-foreground opacity-50" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
