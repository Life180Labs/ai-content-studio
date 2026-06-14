"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, RotateCcw } from "lucide-react";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, resendOtp } = useAuthStore();
  const emailParam = searchParams.get("email") || "";
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailParam) {
      toast.error("Email address is missing");
      return;
    }

    setIsLoading(true);
    try {
      await verifyEmail(emailParam, otp);
      toast.success("Email verified! You can now sign in.");
      router.push("/login");
    } catch (err: any) {
      const message =
        err?.error?.message || "Invalid verification code. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!emailParam) return;
    setIsResending(true);
    try {
      await resendOtp(emailParam);
      toast.success("A new verification code has been sent");
    } catch {
      toast.error("Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">
          Verify your email
        </h2>
        <p className="text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{emailParam}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            type="text"
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            maxLength={6}
            className="h-11 text-center text-2xl tracking-[0.5em] font-mono"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium"
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify email"
          )}
        </Button>
      </form>

      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResend}
          disabled={isResending}
          className="text-muted-foreground hover:text-foreground"
        >
          {isResending ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-3 w-3" />
          )}
          Resend code
        </Button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}
