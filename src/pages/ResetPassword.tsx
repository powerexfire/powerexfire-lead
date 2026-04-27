import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRecovery = useMemo(() => window.location.hash.includes("type=recovery") || window.location.search.includes("type=recovery"), []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") toast.info("Set a new password to continue.");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated securely.");
    navigate("/");
  };

  return (
    <main className="industrial-shell grid min-h-screen place-items-center px-4 py-10">
      <form onSubmit={handleSubmit} className="grid w-full max-w-md gap-5 rounded-xl border border-border bg-card p-6 shadow-industrial sm:p-8" aria-label="Reset password form">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-fire">
          <Flame className="h-8 w-8" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Secure Recovery</p>
          <h1 className="mt-2 text-3xl font-black text-card-foreground">Reset password</h1>
          {!isRecovery ? <p className="mt-3 text-sm font-semibold text-muted-foreground">Open the recovery link from your email before setting a new password.</p> : null}
        </div>

        <label className="grid gap-2 text-sm font-bold text-card-foreground">
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            className="h-12 rounded-lg border border-input bg-background px-4 text-base font-semibold text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-card-foreground">
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            className="h-12 rounded-lg border border-input bg-background px-4 text-base font-semibold text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
            required
          />
        </label>

        <Button type="submit" variant="fire" size="xl" disabled={isSubmitting || !isRecovery}>
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <LockKeyhole className="h-5 w-5" aria-hidden="true" />}
          Update password
        </Button>
      </form>
    </main>
  );
}