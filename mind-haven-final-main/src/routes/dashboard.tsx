import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/PageLoader";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("Profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.name ?? null));
  }, [user]);

  if (loading || !session) return <PageLoader label="Returning…" minMs={2000} />;

  const navItems: Array<{ to: string; label: string; exact?: boolean }> = [
    { to: "/dashboard", label: "Home", exact: true },
    { to: "/dashboard/journal", label: "Journal" },
    { to: "/dashboard/mood", label: "Mood" },
    { to: "/dashboard/surveys", label: "Reflections" },
    { to: "/dashboard/chatbot", label: "Companion" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass border-b border-glass-border/30 sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-5">
          <Link to="/dashboard" className="font-display text-2xl gradient-text">
            MindHaven
          </Link>
          <div className="flex items-center gap-6">
            <span className="hidden text-sm text-muted-foreground/50 sm:inline">
              {name ? name : user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="smallcaps text-muted-foreground/50 transition-colors duration-300 hover:text-lamp"
            >
              Sign Out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-8 overflow-x-auto px-8 pb-4">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to as "/dashboard"}
              activeOptions={{ exact: item.exact ?? false }}
              className="smallcaps text-muted-foreground/40 transition-all duration-300 hover:text-lamp data-[status=active]:text-lamp data-[status=active]:underline data-[status=active]:underline-offset-8 data-[status=active]:decoration-lamp/30"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-16 animate-fade-in">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
