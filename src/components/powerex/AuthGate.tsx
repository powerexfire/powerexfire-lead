import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Flame, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type AuthGateProps = {
  children: (session: Session) => ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsChecking(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      toast.error("Enter a valid business email.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    const result = mode === "signIn"
      ? await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      : await supabase.auth.signUp({ email: cleanEmail, password });
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    toast.success(mode === "signIn" ? "Signed in securely." : "Account created. Check your email if confirmation is required.");
  };

  if (isChecking) {
    return (
      <div className="industrial-shell grid min-h-screen place-items-center p-6">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 font-bold text-card-foreground shadow-industrial">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          Securing workspace...
        </div>
      </div>
    );
  }

  if (session) {
    return <>{children(session)}</>;
  }

  return (
    <main className="industrial-shell grid min-h-screen place-items-center px-4 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-industrial md:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-hero-industrial p-8 text-secondary-foreground sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-fire">
            <Flame className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-8 text-4xl font-black leading-tight tracking-normal">Powerex Fire Lead Command</h1>
          <p className="mt-4 text-base font-medium leading-7 text-secondary-foreground/82">
            Protected access for lead generation, Google Sheets sync, and fire safety prospect operations.
          </p>
          <div className="mt-8 grid gap-3 text-sm font-bold">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Authenticated workflow calls</span>
            <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-primary" /> Server-side sheet credentials</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 p-6 sm:p-10" aria-label="Powerex Fire sign in form">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Secure Access</p>
            <h2 className="mt-2 text-3xl font-black text-card-foreground">{mode === "signIn" ? "Sign in" : "Create account"}</h2>
          </div>

          <label className="grid gap-2 text-sm font-bold text-card-foreground">
            Email
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-base font-semibold text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          </label>

          <label className="grid gap-2 text-sm font-bold text-card-foreground">
            Password
            <input
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              className="h-12 rounded-lg border border-input bg-background px-4 text-base font-semibold text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
              required
            />
          </label>

          <Button type="submit" variant="fire" size="xl" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <LockKeyhole className="h-5 w-5" aria-hidden="true" />}
            {mode === "signIn" ? "Sign in" : "Create secure account"}
          </Button>

          <Button type="button" variant="ghost" onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}> 
            {mode === "signIn" ? "Need access? Create an account" : "Already have access? Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
