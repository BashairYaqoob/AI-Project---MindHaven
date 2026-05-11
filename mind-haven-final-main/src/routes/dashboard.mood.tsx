import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { InlineLoader } from "@/components/PageLoader";
import { PageHero } from "@/components/PageHero";
import moodImg from "@/assets/page-mood.jpg";

export const Route = createFileRoute("/dashboard/mood")({
  component: MoodPage,
});

interface MoodLog {
  id: string;
  mood_level: number | null;
  note: string | null;
  created_at: string;
}

const MOODS = [
  { level: 1, label: "Low", emoji: "😔" },
  { level: 2, label: "Quiet", emoji: "😐" },
  { level: 3, label: "Balanced", emoji: "🙂" },
  { level: 4, label: "Light", emoji: "😊" },
  { level: 5, label: "Clear", emoji: "✨" },
];

function moodLabel(level: number | null) {
  return MOODS.find((m) => m.level === level)?.label ?? "—";
}
function moodEmoji(level: number | null) {
  return MOODS.find((m) => m.level === level)?.emoji ?? "";
}

function MoodPage() {
  const { user } = useAuth();
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mood_logs")
      .select("id, mood_level, note, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) setError(error.message);
    else setLogs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mood === null || !user) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase
      .from("mood_logs")
      .insert({ user_id: user.id, mood_level: mood, note: note.trim() || null });
    if (error) setError(error.message);
    else {
      let recMessage = "";
      if (mood <= 2) {
        recMessage = "Consider taking a short break or talking to someone you trust.";
      } else if (mood === 3) {
        recMessage = "Try doing something small that makes you feel better.";
      } else {
        recMessage = "You seem to be doing well. Keep maintaining your routine.";
      }
      await supabase.from("recommendations").insert({
        user_id: user.id,
        message: recMessage,
        type: "rule-based",
      });

      setMood(null); setNote("");
      setSuccess(true); setTimeout(() => setSuccess(false), 2800);
      await load();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-16">
      <header className="animate-rise">
        <p className="smallcaps text-teal/60 mb-4">Mood Check-In</p>
        <h1 className="font-display text-5xl text-ink sm:text-6xl leading-[1.1]">
          How are you feeling?
        </h1>
        <p className="mt-4 text-muted-foreground/60" style={{ lineHeight: "1.8" }}>
          There's no wrong answer. Just be honest with yourself.
        </p>
      </header>

      <form onSubmit={submit} className="glass-card animate-slow space-y-8">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {MOODS.map((m) => (
            <button
              key={m.level}
              type="button"
              onClick={() => setMood(m.level)}
              className={`flex flex-col items-center gap-2 rounded-2xl px-6 py-4 transition-all duration-300 ${
                mood === m.level
                  ? "shadow-glow"
                  : "hover:bg-foreground/5"
              }`}
              style={mood === m.level ? { background: "var(--gradient-primary)" } : { background: "var(--glass)" }}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className={`text-sm font-medium ${mood === m.level ? "text-primary-foreground" : "text-muted-foreground/60"}`}>
                {m.label}
              </span>
            </button>
          ))}
        </div>

        <div>
          <p className="text-sm text-muted-foreground/40 mb-3">Add a note (optional)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's shaping your day?"
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-xl border-0 px-4 py-3 text-foreground/85 placeholder:text-muted-foreground/30 focus:outline-none focus:ring-0"
            style={{ background: "var(--glass)", caretColor: "var(--lamp)", lineHeight: "1.8" }}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground/30">{note.length} / 500</p>
          <button
            type="submit"
            disabled={submitting || mood === null}
            className="rounded-xl px-6 py-2.5 font-medium text-primary-foreground transition-all duration-300 disabled:opacity-30"
            style={{ background: "var(--gradient-primary)" }}
          >
            {submitting ? "Saving…" : "Log Mood"}
          </button>
        </div>

        {error && <p className="text-sm text-destructive/70 animate-fade-in">{error}</p>}
        {success && (
          <p className="text-center text-sm text-teal/70 animate-fade-in">
            Mood logged. Take care of yourself.
          </p>
        )}
      </form>

      <div className="rule" />

      <section className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-3xl text-ink">Recent Moods</h2>
          <p className="text-sm text-muted-foreground/40">{logs.length} logged</p>
        </div>

        {loading ? (
          <InlineLoader />
        ) : logs.length === 0 ? (
          <div className="glass-card text-center py-12">
            <p className="font-display text-xl text-muted-foreground/40">
              No mood logs yet. Start when you're ready.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log, i) => (
              <div
                key={log.id}
                className="glass-card flex items-center gap-4 animate-fade-in"
                style={{ animationDelay: `${i * 30}ms`, padding: "1rem 1.5rem" }}
              >
                <span className="text-xl">{moodEmoji(log.mood_level)}</span>
                <p className="font-display text-lg text-ink/80 w-24">{moodLabel(log.mood_level)}</p>
                <p className="flex-1 text-sm text-foreground/50 truncate">
                  {log.note ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground/30 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
