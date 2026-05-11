import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { InlineLoader } from "@/components/PageLoader";

export const Route = createFileRoute("/dashboard/surveys")({
  component: SurveysPage,
});

interface Survey {
  id: string;
  title: string | null;
  description: string | null;
}
interface Question {
  id: string;
  survey_id: string;
  question_type: string;
  question_text: string;
  options?: Array<{ value: number | string; label: string }> | null;
}

const DEFAULT_SCALE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Rarely" },
  { value: 2, label: "Sometimes" },
  { value: 3, label: "Often" },
  { value: 4, label: "Nearly always" },
];

function SurveysPage() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question[]>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; survery_id: string; score: number | null; created_at: string }>>([]);
  const [result, setResult] = useState<null | { score: number; max: number; level: string; recommendations: string[] }>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: surveysData } = await supabase.from("surveys").select("id, title, description");
      const { data: qData } = await supabase
        .from("survey_questions")
        .select("id, survey_id, question_type, question_text, options");
      const grouped: Record<string, Question[]> = {};
      (qData ?? []).forEach((q) => {
        if (!grouped[q.survey_id]) grouped[q.survey_id] = [];
        grouped[q.survey_id].push(q as Question);
      });
      setSurveys(surveysData ?? []);
      setQuestions(grouped);

      if (user) {
        const { data: resp } = await supabase
          .from("survey_responses")
          .select("id, survery_id, score, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setCompleted(new Set((resp ?? []).map((r: any) => r.survery_id)));
        setHistory((resp ?? []) as any);
      }
      setLoading(false);
    })();
  }, [user]);

  const open = (id: string) => {
    setOpenId(id);
    setAnswers({});
    setMessage(null);
  };

  const submit = async (survey: Survey) => {
    if (!user) return;
    const qs = questions[survey.id] ?? [];
    // Only scale questions are required; text questions are optional.
    const requiredAnswered = qs
      .filter((q) => q.question_type === "scale")
      .every((q) => answers[q.id] !== undefined && answers[q.id] !== "");
    if (!requiredAnswered) {
      setMessage("Please answer all rating questions.");
      return;
    }
    setSubmitting(true);
    const scaleQs = qs.filter((q) => q.question_type === "scale");
    let score: number | null = null;
    let maxScore = 0;
    if (scaleQs.length > 0) {
      let sum = 0;
      for (const q of scaleQs) {
        const opts = Array.isArray(q.options) && q.options.length > 0 ? q.options : DEFAULT_SCALE_OPTIONS;
        const numericVals = opts
          .map((o: any) => Number(o.value))
          .filter((n: number) => !Number.isNaN(n));
        const qMax = numericVals.length > 0 ? Math.max(...numericVals) : 4;
        maxScore += qMax;
        const ans = Number(answers[q.id]);
        if (!Number.isNaN(ans)) sum += ans;
      }
      score = Math.round(sum);
    }

    const payload = qs.map((q) => ({
      question_id: q.id,
      question_text: q.question_text,
      type: q.question_type,
      answer: answers[q.id] ?? null,
    }));

    const { data: inserted, error } = await supabase
      .from("survey_responses")
      .insert({
        user_id: user.id,
        survery_id: survey.id,
        answers: payload,
        score,
      })
      .select("id, survery_id, score, created_at")
      .single();
    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    // Compute level + recommendations
    const ratio = maxScore > 0 ? (score ?? 0) / maxScore : 0;
    let level = "Balanced";
    let recs: string[] = [];
    if (ratio < 0.25) {
      level = "Calm & Steady";
      recs = [
        "Keep nurturing what's working — small daily rituals matter.",
        "Try a gratitude entry in your journal tonight.",
      ];
    } else if (ratio < 0.5) {
      level = "Mild Strain";
      recs = [
        "Take a 10-minute walk outside today.",
        "Try a short breathing exercise (4-7-8) before bed.",
        "Log your mood daily for a week to spot patterns.",
      ];
    } else if (ratio < 0.75) {
      level = "Elevated";
      recs = [
        "Schedule one restorative activity this week (rest, nature, friends).",
        "Open a chat with the MindHaven Companion when you feel stuck.",
        "Consider talking to someone you trust about how you're feeling.",
      ];
    } else {
      level = "High — please be gentle with yourself";
      recs = [
        "Reach out to a licensed mental health professional.",
        "If you're in crisis, contact a local helpline immediately.",
        "Lean on supportive people; you don't have to carry this alone.",
      ];
    }

    // Persist recommendations
    if (recs.length > 0 && inserted) {
      await supabase.from("recommendations").insert(
        recs.map((m) => ({
          user_id: user.id,
          survey_response_id: inserted.id,
          type: level,
          message: m,
        }))
      );
    }

    setResult({ score: score ?? 0, max: maxScore, level, recommendations: recs });
    setCompleted(new Set([...completed, survey.id]));
    if (inserted) setHistory((h) => [inserted as any, ...h]);
    setSubmitting(false);
  };

  const closeResult = () => {
    setResult(null);
    setOpenId(null);
    setAnswers({});
    setMessage(null);
  };
  if (loading) return <InlineLoader />;

  const openSurvey = surveys.find((s) => s.id === openId);

  if (openSurvey) {
    const qs = questions[openSurvey.id] ?? [];
    return (
      <div className="space-y-12 animate-fade-in">
        <header>
          <button
            onClick={() => setOpenId(null)}
            className="text-sm text-muted-foreground/40 transition-colors duration-300 hover:text-lamp mb-6"
          >
            ← Back
          </button>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">{openSurvey.title}</h1>
          {openSurvey.description && (
            <p className="mt-4 text-muted-foreground/50" style={{ lineHeight: "1.8" }}>
              {openSurvey.description}
            </p>
          )}
        </header>

        <div className="space-y-6">
          {qs.map((q, i) => (
            <div key={q.id} className="glass-card animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start gap-4 mb-4">
                <span className="text-sm font-medium text-lamp/60">{String(i + 1).padStart(2, "0")}</span>
                <p className="font-display text-xl text-ink/90" style={{ lineHeight: "1.5" }}>{q.question_text}</p>
              </div>
              {q.question_type === "scale" ? (
                <div className="ml-8 flex flex-wrap gap-3">
                  {(Array.isArray(q.options) && q.options.length > 0
                    ? q.options
                    : DEFAULT_SCALE_OPTIONS
                  ).map((opt: { value: number | string; label: string }) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAnswers({ ...answers, [q.id]: opt.value })}
                      className={`rounded-full px-4 py-2 text-sm transition-all duration-300 ${
                        answers[q.id] === opt.value
                          ? "text-primary-foreground"
                          : "text-muted-foreground/60 hover:text-foreground/80"
                      }`}
                      style={answers[q.id] === opt.value ? { background: "var(--gradient-primary)" } : { background: "var(--glass)" }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  rows={3}
                  placeholder="Share your thoughts… (optional)"
                  className="ml-8 w-[calc(100%-2rem)] resize-none rounded-xl border-0 px-4 py-3 text-foreground/85 placeholder:text-muted-foreground/30 focus:outline-none focus:ring-0"
                  style={{ background: "var(--glass)", caretColor: "var(--lamp)", lineHeight: "1.8" }}
                />
              )}
            </div>
          ))}
        </div>

        {message && (
          <p className="text-center text-sm text-teal/70 animate-fade-in">{message}</p>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => setOpenId(null)}
            className="text-sm text-muted-foreground/40 transition-colors duration-300 hover:text-lamp"
          >
            Cancel
          </button>
          <button
            onClick={() => submit(openSurvey)}
            disabled={submitting}
            className="rounded-xl px-6 py-2.5 font-medium text-primary-foreground transition-all duration-300 disabled:opacity-30"
            style={{ background: "var(--gradient-primary)" }}
          >
            {submitting ? "Saving…" : "Submit"}
          </button>
        </div>
        {result && <ResultModal result={result} onClose={closeResult} />}
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <header className="animate-rise">
        <p className="smallcaps text-lamp/60 mb-4">Self-Reflection</p>
        <h1 className="font-display text-5xl text-ink sm:text-6xl leading-[1.1]">
          Reflections
        </h1>
        <p className="mt-4 text-muted-foreground/60" style={{ lineHeight: "1.8" }}>
          Gentle assessments to help you understand yourself better.
        </p>
      </header>

      <div className="space-y-4 animate-slow">
        {surveys.map((s, i) => {
          const done = completed.has(s.id);
          const count = (questions[s.id] ?? []).length;
          return (
            <button
              key={s.id}
              onClick={() => open(s.id)}
              className="glass-card group block w-full text-left transition-all duration-300 hover:shadow-glow"
            >
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="font-display text-2xl text-ink/80 transition-colors duration-300 group-hover:gradient-text sm:text-3xl">
                    {s.title}
                  </p>
                  {s.description && (
                    <p className="mt-2 text-sm text-muted-foreground/40">{s.description}</p>
                  )}
                </div>
                <span className={`smallcaps whitespace-nowrap ${done ? "text-teal/60" : "text-muted-foreground/30"}`}>
                  {done ? "✓ Done" : `${count} Q's`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {history.length > 0 && (
        <section className="animate-fade-in">
          <h2 className="font-display text-2xl text-ink/80 mb-6">Your reflection history</h2>
          <div className="space-y-3">
            {history.map((h) => {
              const survey = surveys.find((s) => s.id === h.survery_id);
              return (
                <div
                  key={h.id}
                  className="glass-card flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-foreground/80 font-medium">{survey?.title ?? "Reflection"}</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      {new Date(h.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="smallcaps text-lamp/70 text-sm">
                    Score {h.score ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ResultModal({
  result,
  onClose,
}: {
  result: { score: number; max: number; level: string; recommendations: string[] };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "oklch(0 0 0 / 0.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-md space-y-6 animate-rise"
        style={{ background: "var(--background)" }}
      >
        <div className="text-center">
          <p className="smallcaps text-lamp/60 mb-2">Your reflection</p>
          <p className="font-display text-5xl text-ink">
            {result.score}
            <span className="text-2xl text-muted-foreground/40"> / {result.max}</span>
          </p>
          <p className="mt-3 text-teal/80 font-medium">{result.level}</p>
        </div>
        <div className="space-y-3">
          <p className="smallcaps text-muted-foreground/60">Recommendations</p>
          <ul className="space-y-2">
            {result.recommendations.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm text-foreground/80" style={{ lineHeight: "1.7" }}>
                <span className="text-lamp/60">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl px-6 py-3 font-medium text-primary-foreground transition-all duration-300"
          style={{ background: "var(--gradient-primary)" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
