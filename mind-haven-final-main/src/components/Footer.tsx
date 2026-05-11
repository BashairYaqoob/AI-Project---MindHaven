import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/20">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
          <div>
            <p className="font-display text-2xl gradient-text">MindHaven</p>
            <p className="mt-2 text-sm text-muted-foreground/50">Your space for mental wellness</p>
          </div>
          <div className="flex gap-8">
            <Link to="/insights" className="text-sm text-muted-foreground/50 transition-colors duration-300 hover:text-lamp">Insights</Link>
            <Link to="/auth" className="text-sm text-muted-foreground/50 transition-colors duration-300 hover:text-lamp">Sign In</Link>
          </div>
        </div>
        <div className="rule mt-10 mb-6" />
        <p className="text-center text-xs text-muted-foreground/30">
          © {new Date().getFullYear()} MindHaven — Nurturing minds, gently.
        </p>
      </div>
    </footer>
  );
}
