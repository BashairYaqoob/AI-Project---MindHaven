import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { InlineLoader } from "@/components/PageLoader";
import { PageHero } from "@/components/PageHero";
import journalImg from "@/assets/page-journal.jpg";

export const Route = createFileRoute("/dashboard/journal")({
  component: JournalPage,
});

interface Entry {
  id: string;
  text: string | null;
  emotion: string | null;
  sentiment_label: string | null;
  created_at: string;
}

const EMOTIONS = [
  { value: "joyful", label: "Light" },
  { value: "calm", label: "Quiet" },
  { value: "grateful", label: "Grateful" },
  { value: "anxious", label: "Restless" },
  { value: "sad", label: "Heavy" },
  { value: "angry", label: "Sharp" },
  { value: "tired", label: "Tired" },
  { value: "hopeful", label: "Hopeful" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function JournalPage() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [emotion, setEmotion] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, text, emotion, sentiment_label, created_at")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setEntries(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSubmitting(true);
    setError(null);

    const trimmedText = text.trim();

    // 1. Insert journal entry
    const { data: inserted, error: insertErr } = await supabase
      .from("journal_entries")
      .insert({ user_id: user.id, text: trimmedText, emotion: emotion || null })
      .select("id, sentiment_score")
      .single();

    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return;
    }

    // 2. Call AI analysis (non-blocking for UX — entry is already saved)
    try {
      const aiRes = await supabase.functions.invoke("analyze-journal", {
        body: { text: trimmedText },
      });

      if (aiRes.data && !aiRes.error) {
        const { sentiment, emotion: aiEmotion } = aiRes.data as {
          sentiment: string;
          emotion: string;
        };

        // Update journal entry with AI results
        await supabase
          .from("journal_entries")
          .update({
            sentiment_label: sentiment,
            emotion: aiEmotion,
          })
          .eq("id", inserted.id);

        // Generate recommendation based on AI sentiment
        const recMessages: Record<string, string> = {
          negative: "Your words carry weight today. Consider reaching out to someone you trust, or simply rest.",
          neutral: "You seem to be in a reflective space. That's a good place to be.",
          positive: "Your writing radiates lightness today. Carry this feeling forward.",
        };

        await supabase.from("recommendations").insert({
          user_id: user.id,
          message: recMessages[sentiment] ?? recMessages.neutral,
          type: "journal-sentiment",
        });
      }
    } catch (aiErr) {
      console.error("AI analysis failed (entry still saved):", aiErr);
      // Fallback: use DB sentiment score for recommendation
      const score = inserted?.sentiment_score ?? 0;
      const fallbackMsg = score <= -0.1
        ? "Your words carry weight today. Consider reaching out to someone you trust, or simply rest."
        : score >= 0.1
          ? "Your writing radiates lightness today. Carry this feeling forward."
          : "You seem to be in a reflective space. That's a good place to be.";
      await supabase.from("recommendations").insert({
        user_id: user.id,
        message: fallbackMsg,
        type: "journal-sentiment",
      });
    }

    setText(""); setEmotion("");
    setSuccess(true); setTimeout(() => setSuccess(false), 3000);
    await load();
    setSubmitting(false);
  };

  return (
    <div className="space-y-16">
      <PageHero
        eyebrow="Journal"
        title="Write freely"
        subtitle="Your thoughts remain yours. No one else will see this."
        image={journalImg}
        imageAlt="Open notebook beside soft greenery"
      />

      <form onSubmit={submit} className="glass-card animate-slow">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind today…"
          rows={12}
          required
          maxLength={5000}
          className="w-full resize-none border-0 bg-transparent px-0 py-0 font-display text-lg text-foreground/90 placeholder:text-muted-foreground/30 focus:outline-none focus:ring-0"
          style={{
            minHeight: "16rem",
            caretColor: "var(--lamp)",
            lineHeight: "2",
          }}
        />

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground/40 mr-2">Feeling:</p>
          {EMOTIONS.map((em) => (
            <button
              key={em.value}
              type="button"
              onClick={() => setEmotion(emotion === em.value ? "" : em.value)}
              className={`rounded-full px-4 py-1.5 text-sm transition-all duration-300 ${
                emotion === em.value
                  ? "text-primary-foreground"
                  : "text-muted-foreground/60 hover:text-foreground/80"
              }`}
              style={emotion === em.value ? { background: "var(--gradient-primary)" } : { background: "var(--glass)" }}
            >
              {em.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground/30">{text.length} / 5,000</p>
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="rounded-xl px-6 py-2.5 font-medium text-primary-foreground transition-all duration-300 disabled:opacity-30"
            style={{ background: "var(--gradient-primary)" }}
          >
            {submitting ? "Saving…" : "Save Entry"}
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-destructive/70 animate-fade-in">{error}</p>}
        {success && (
          <p className="mt-4 text-sm text-teal/70 animate-fade-in">
            Saved. Thank you for sharing with yourself.
          </p>
        )}
      </form>

      <div className="rule" />

      <section className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl text-ink">Previous Entries</h2>
          <p className="text-sm text-muted-foreground/40">{entries.length} entries</p>
        </div>

        {loading ? (
          <InlineLoader />
        ) : entries.length === 0 ? (
          <div className="glass-card text-center py-12">
            <p className="font-display text-xl text-muted-foreground/40">
              No entries yet. Start writing when you're ready.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry, i) => (
              <article
                key={entry.id}
                className="glass-card animate-rise"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground/50">{formatDate(entry.created_at)}</p>
                  <p className="text-xs text-muted-foreground/30">{formatTime(entry.created_at)}</p>
                </div>
                <p className="text-foreground/80 whitespace-pre-wrap" style={{ lineHeight: "1.8" }}>
                  {entry.text}
                </p>
                {entry.emotion && (
                  <p className="mt-4 text-sm text-muted-foreground/50 italic">
                    You seem a bit {entry.emotion}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
