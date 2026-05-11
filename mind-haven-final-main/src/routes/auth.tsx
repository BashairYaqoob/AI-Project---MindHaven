import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import atmosphereImg from "@/assets/loader-atmosphere.jpg";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate({ to: "/dashboard" });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              name,
              age: age || null,
              gender: gender || null,
            },
          },
        });
        if (error) throw error;

        if (data.session) {
          setInfo("Your space is ready.");
          setTimeout(() => {
            navigate({ to: "/dashboard" });
          }, 400);
        } else {
          setInfo("Your space is ready. Please verify your email.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = error.message?.toLowerCase() ?? "";
          if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
            setError("We don't recognise this. Please create an account first.");
            setMode("signup");
            return;
          }
          throw error;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full opacity-[0.08] blur-[120px]" style={{ background: "var(--lamp)" }} />
        <div className="absolute right-1/4 bottom-1/4 h-[40vh] w-[40vh] rounded-full opacity-[0.06] blur-[100px]" style={{ background: "var(--teal)" }} />
        <img
          src={atmosphereImg}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-[0.18] mix-blend-soft-light"
          loading="eager"
          width={1920}
          height={1080}
        />
      </div>

      <div className="relative w-full max-w-md animate-rise">
        <div className="glass-card">
          <div className="mb-10 text-center">
            <Link to="/" className="smallcaps gradient-text">MindHaven</Link>
            <h1 className="mt-6 font-display text-4xl text-ink leading-[1.1] sm:text-5xl">
              {mode === "login" ? "Welcome back" : "Begin your journey"}
            </h1>
            <p className="mt-4 text-sm text-muted-foreground/50" style={{ lineHeight: "1.8" }}>
              {mode === "login"
                ? "Your space is waiting for you."
                : "Create a safe, personal space for your mind."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === "signup" && (
              <>
                <Field label="Your name">
                  <input value={name} onChange={(e) => setName(e.target.value)} required className="auth-input" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Age">
                    <input type="number" min={1} max={120} value={age} onChange={(e) => setAge(e.target.value)} required className="auth-input" />
                  </Field>
                  <Field label="Gender">
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className="auth-input" required>
                      <option value="">—</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="non-binary">Non-binary</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </Field>
                </div>
              </>
            )}
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="auth-input" />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="auth-input" />
            </Field>

            {error && <p className="text-sm text-destructive/70 animate-fade-in">{error}</p>}
            {info && <p className="text-sm text-teal/70 animate-fade-in">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl py-3.5 font-medium text-primary-foreground transition-all duration-300 disabled:opacity-40"
              style={{ background: "var(--gradient-primary)" }}
            >
              {loading ? "One moment…" : mode === "login" ? "Sign In" : "Create My Space"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setInfo(null); }}
              className="text-sm text-muted-foreground/50 transition-colors duration-300 hover:text-lamp"
            >
              {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .auth-input {
          display: block;
          width: 100%;
          background: var(--glass);
          border: 1px solid var(--glass-border);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-family: var(--font-sans);
          font-size: 0.95rem;
          color: var(--ink);
          outline: none;
          caret-color: var(--lamp);
          transition: border-color 300ms, box-shadow 300ms;
        }
        .auth-input:focus {
          border-color: var(--lamp);
          box-shadow: 0 0 0 3px oklch(0.72 0.12 280 / 0.1);
        }
        .auth-input::placeholder {
          color: var(--muted-foreground);
          opacity: 0.4;
        }
        select.auth-input {
          appearance: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground/60">{label}</label>
      {children}
    </div>
  );
}
