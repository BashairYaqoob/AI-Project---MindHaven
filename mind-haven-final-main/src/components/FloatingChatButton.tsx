import { Link, useLocation } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * Floating "Companion" button — shown on every authenticated page
 * except the chatbot itself and the auth page.
 */
export function FloatingChatButton() {
  const { session } = useAuth();
  const { pathname } = useLocation();

  if (!session) return null;
  if (
    pathname.startsWith("/dashboard/chatbot") ||
    pathname === "/auth"
  ) {
    return null;
  }

  return (
    <Link
      to="/dashboard/chatbot"
      aria-label="Open MindHaven Companion"
      className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full shadow-glow transition-transform duration-300 hover:scale-110 sm:bottom-8 sm:right-8"
      style={{
        background: "var(--gradient-primary)",
        color: "var(--primary-foreground)",
        boxShadow: "0 10px 30px -10px oklch(0.72 0.15 155 / 0.5)",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: "oklch(0.72 0.15 155 / 0.3)",
          animation: "breathe 2.4s ease-in-out infinite",
        }}
      />
      <MessageCircle className="relative h-6 w-6" />
    </Link>
  );
}