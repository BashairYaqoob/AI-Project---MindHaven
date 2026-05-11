import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import homeImg from "@/assets/page-home.jpg";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
} from "docx";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

interface RecentEntry {
  text: string | null;
  created_at: string;
}
interface RecentMood {
  mood_level: number | null;
  note: string | null;
  created_at: string;
}
interface Recommendation {
  message: string;
  type: string;
  created_at: string;
}

function DashboardHome() {
  const { user } = useAuth();
  const [name, setName] = useState<string>("");
  const [stats, setStats] = useState({ entries: 0, moods: 0 });
  const [lastEntry, setLastEntry] = useState<RecentEntry | null>(null);
  const [lastMood, setLastMood] = useState<RecentMood | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [showRecs, setShowRecs] = useState(false);
  const [analytics, setAnalytics] = useState<{
    moodAvg: number | null;
    moodTrend: Array<{ date: string; level: number }>;
    sentimentAvg: number | null;
    surveyAvg: number | null;
    surveyCount: number;
  }>({ moodAvg: null, moodTrend: [], sentimentAvg: null, surveyAvg: null, surveyCount: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from("Profiles").select("name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.name ?? ""));
    Promise.all([
      supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("mood_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([j, m]) => setStats({ entries: j.count ?? 0, moods: m.count ?? 0 }));

    supabase.from("journal_entries").select("text, created_at").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setLastEntry(data));
    supabase.from("mood_logs").select("mood_level, note, created_at").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setLastMood(data));
    supabase.from("recommendations").select("message, type, created_at").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setRecs(data ?? []));

    // Analytics aggregates (last 30 days mood trend, all-time averages)
    Promise.all([
      supabase
        .from("mood_logs")
        .select("mood_level, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("journal_entries")
        .select("sentiment_score")
        .eq("user_id", user.id)
        .not("sentiment_score", "is", null),
      supabase
        .from("survey_responses")
        .select("score")
        .eq("user_id", user.id),
    ]).then(([moods, journals, surveys]) => {
      const moodVals = (moods.data ?? []).map((m) => m.mood_level).filter((v): v is number => typeof v === "number");
      const moodAvg = moodVals.length ? moodVals.reduce((a, b) => a + b, 0) / moodVals.length : null;
      // Aggregate by calendar day (average mood per day), oldest -> newest
      const byDay = new Map<string, { sum: number; count: number; ts: number }>();
      (moods.data ?? []).forEach((m) => {
        if (typeof m.mood_level !== "number") return;
        const d = new Date(m.created_at);
        const key = d.toISOString().slice(0, 10);
        const prev = byDay.get(key);
        if (prev) {
          prev.sum += m.mood_level;
          prev.count += 1;
        } else {
          byDay.set(key, { sum: m.mood_level, count: 1, ts: d.getTime() });
        }
      });
      const trend = Array.from(byDay.entries())
        .sort((a, b) => a[1].ts - b[1].ts)
        .map(([key, v]) => ({
          date: new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          level: v.sum / v.count,
        }));
      const senVals = (journals.data ?? []).map((j) => Number(j.sentiment_score)).filter((v) => !Number.isNaN(v));
      const sentimentAvg = senVals.length ? senVals.reduce((a, b) => a + b, 0) / senVals.length : null;
      const surVals = (surveys.data ?? []).map((s) => s.score).filter((v): v is number => typeof v === "number");
      const surveyAvg = surVals.length ? surVals.reduce((a, b) => a + b, 0) / surVals.length : null;
      setAnalytics({ moodAvg, moodTrend: trend, sentimentAvg, surveyAvg, surveyCount: surVals.length });
    });
  }, [user]);

  const downloadReport = () => {
    const moodAvg = analytics.moodAvg;
    const senAvg = analytics.sentimentAvg;

    const moodNarrative =
      moodAvg == null
        ? "You haven't logged a mood yet. Whenever you're ready, a quick check-in can help you notice patterns."
        : moodAvg < 2.5
          ? "Your recent mood has been on the quieter side. There may be lingering tension or low energy that deserves gentle attention."
          : moodAvg < 3.5
            ? "Your recent mood has been fairly balanced — a mix of softer and brighter days."
            : "Your recent mood has been on the lighter side. Whatever you're doing seems to be supporting you.";

    const senNarrative =
      senAvg == null
        ? "You haven't written enough in your journal yet to read a tone."
        : senAvg < -0.2
          ? "Your journaling tone has carried more heaviness lately. Putting words to it is already a kind step."
          : Math.abs(senAvg) <= 0.2
            ? "Your journaling tone is fairly neutral overall — a mix of light and heavy moments, which is normal."
            : "Your journaling tone leans bright and hopeful. It's worth noticing what's been working.";

    const recs: string[] = [];
    if (moodAvg != null && moodAvg < 3) {
      recs.push("Schedule one small restorative activity each day this week — a short walk, a warm drink, a few minutes outside.");
      recs.push("Try a simple breathing pattern (inhale 4s, hold 7s, exhale 8s) once a day.");
    }
    if (senAvg != null && senAvg < -0.1) {
      recs.push("When journaling feels heavy, try writing one sentence about something you're grateful for at the end.");
    }
    if (analytics.surveyCount === 0) {
      recs.push("Take a short reflection survey — it can highlight areas that may need extra care.");
    }
    if (stats.entries < 3) {
      recs.push("Aim for a brief journal entry three times a week. Even a few sentences helps.");
    }
    if (recs.length === 0) {
      recs.push("Keep up your current rhythm — consistency is the strongest signal of self-care.");
      recs.push("Consider sharing a recent reflection with someone you trust.");
    }

    const bullet = (t: string) =>
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun(t)] });
    const para = (t: string) =>
      new Paragraph({ spacing: { after: 160 }, children: [new TextRun(t)] });
    const h1 = (t: string) =>
      new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, bold: true })] });

    const recentMoods = analytics.moodTrend.slice(-10);

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: "Calibri", size: 22 } },
          heading1: {
            run: { font: "Calibri Light", size: 32, color: "2F5496", bold: false },
            paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 },
          },
          heading2: {
            run: { font: "Calibri Light", size: 26, color: "2F5496", bold: false, italics: true },
            paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 },
          },
          title: {
            run: { font: "Calibri Light", size: 56, color: "2F5496", bold: false },
            paragraph: { spacing: { after: 120 }, alignment: AlignmentType.CENTER },
          },
        },
      },
      numbering: {
        config: [
          {
            reference: "bullets",
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: "•",
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: [new TextRun({ text: "MindHaven · Personal Wellness Report", font: "Calibri Light", color: "2F5496", size: 56 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 320 },
              children: [
                new TextRun({
                  text: `Generated ${new Date().toLocaleString()} for ${name || user?.email || ""}`,
                  font: "Calibri Light",
                  color: "2F5496",
                  italics: true,
                  size: 26,
                }),
              ],
            }),
            h1("Overview"),
            para(
              "This is a gentle, plain-language summary of your recent activity in MindHaven. It is not a clinical diagnosis. It is meant to help you notice patterns and decide what kind of support might help."
            ),
            h1("At a glance"),
            bullet(`Journal entries written: ${stats.entries}`),
            bullet(`Mood check-ins logged: ${stats.moods}`),
            bullet(`Self-reflection surveys completed: ${analytics.surveyCount}`),
            bullet(`Average mood (1-5): ${analytics.moodAvg?.toFixed(2) ?? "—"}`),
            bullet(`Average journal sentiment (-1 to +1): ${analytics.sentimentAvg?.toFixed(2) ?? "—"}`),
            bullet(`Average survey score: ${analytics.surveyAvg?.toFixed(2) ?? "—"}`),
            h1("How your mood has been"),
            para(moodNarrative),
            h1("How your journaling has read"),
            para(senNarrative),
            h1("Recommendations"),
            ...recs.map(bullet),
            ...(recentMoods.length
              ? [
                  h1("Recent mood check-ins"),
                  ...recentMoods.map((p) => bullet(`${p.date}: ${p.level} / 5`)),
                ]
              : []),
            h1("A note"),
            para(
              "MindHaven is a self-care companion, not a substitute for professional care. If your difficulties feel persistent or overwhelming, please reach out to a qualified mental-health professional or a local support line."
            ),
          ],
        },
      ],
    });

    Packer.toBlob(doc).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindhaven-report-${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };


  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  const MOODS: Record<number, string> = { 1: "Low", 2: "Quiet", 3: "Balanced", 4: "Light", 5: "Clear" };

  const links: Array<{ to: string; label: string; sub: string; icon: string }> = [
    { to: "/dashboard/journal", label: "Open Journal", sub: "Write your thoughts freely", icon: "✍️" },
    { to: "/dashboard/mood", label: "Log Mood", sub: "Check in with how you feel", icon: "🌤️" },
    { to: "/dashboard/surveys", label: "Reflections", sub: "Gentle self-assessment", icon: "💭" },
  ];

  return (
    <div className="space-y-16">
      <PageHero
        eyebrow={today}
        title={
          <>
            Welcome back{name ? ", " : ""}
            {name && <span className="gradient-text">{name}</span>}
          </>
        }
        subtitle="Take a moment. You're in your space now."
        image={homeImg}
        imageAlt="Eucalyptus branch"
      />

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4 animate-slow">
        <StatCard label="Journal Entries" value={stats.entries} />
        <StatCard label="Mood Logs" value={stats.moods} />
        <StatCard label="Last Mood" value={lastMood ? MOODS[lastMood.mood_level ?? 0] ?? "—" : "—"} />
        <StatCard label="Suggestions" value={recs.length} />
      </section>

      {/* Personal analytics */}
      <section className="glass-card animate-slow">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="smallcaps text-teal/60 mb-1">Your Wellness Snapshot</p>
            <p className="font-display text-2xl text-ink">A gentle look at your patterns</p>
          </div>
          <button
            onClick={downloadReport}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all"
            style={{ background: "var(--gradient-primary)" }}
          >
            Download report
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <MetricBlock label="Avg mood" value={analytics.moodAvg?.toFixed(2) ?? "—"} hint="out of 5" />
          <MetricBlock label="Avg sentiment" value={analytics.sentimentAvg?.toFixed(2) ?? "—"} hint="-1 to +1" />
          <MetricBlock label="Avg survey score" value={analytics.surveyAvg?.toFixed(1) ?? "—"} hint={`${analytics.surveyCount} responses`} />
        </div>

        {analytics.moodTrend.length > 0 && (
          <MoodLineChart points={analytics.moodTrend} />
        )}
      </section>

      {/* Recommendations — expandable */}
      {recs.length > 0 && (
        <section className="animate-slow">
          <button
            onClick={() => setShowRecs(!showRecs)}
            className="glass-card w-full text-left transition-all duration-300 hover:shadow-glow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="smallcaps text-lamp/60 mb-2">Gentle Suggestions</p>
                <p className="font-display text-xl text-ink/80">
                  You have {recs.length} suggestion{recs.length > 1 ? "s" : ""} waiting
                </p>
              </div>
              <span className="text-2xl text-muted-foreground/40 transition-transform duration-300" style={{ transform: showRecs ? "rotate(180deg)" : "rotate(0)" }}>
                ↓
              </span>
            </div>
          </button>
          {showRecs && (
            <div className="mt-4 space-y-3 animate-fade-in">
              {recs.map((rec, i) => (
                <div key={i} className="glass-card">
                  <p className="text-foreground/80" style={{ lineHeight: "1.7" }}>"{rec.message}"</p>
                  <p className="mt-3 text-xs text-muted-foreground/40">
                    {rec.type === "journal-sentiment" ? "From your journal" : "From your mood"} · {new Date(rec.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent activity */}
      {(lastEntry || lastMood) && (
        <section className="grid gap-4 sm:grid-cols-2 animate-slow">
          {lastEntry && (
            <div className="glass-card">
              <p className="smallcaps text-teal/60 mb-3">Latest Journal</p>
              <p className="text-foreground/70" style={{ lineHeight: "1.7" }}>
                {(lastEntry.text ?? "").slice(0, 140)}{(lastEntry.text ?? "").length > 140 ? "…" : ""}
              </p>
              <p className="mt-3 text-xs text-muted-foreground/30">
                {new Date(lastEntry.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            </div>
          )}
          {lastMood && (
            <div className="glass-card">
              <p className="smallcaps text-lamp/60 mb-3">Latest Mood</p>
              <p className="font-display text-2xl text-ink/80">
                {MOODS[lastMood.mood_level ?? 0] ?? "—"}
              </p>
              {lastMood.note && (
                <p className="mt-2 text-sm text-foreground/50">{lastMood.note}</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground/30">
                {new Date(lastMood.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Quick links */}
      <section className="grid gap-4 sm:grid-cols-3 animate-slow">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to as "/dashboard"}
            className="glass-card group transition-all duration-300 hover:shadow-glow"
          >
            <p className="text-3xl mb-4">{l.icon}</p>
            <p className="font-display text-xl text-ink transition-colors duration-300 group-hover:gradient-text">
              {l.label}
            </p>
            <p className="mt-2 text-sm text-muted-foreground/50">{l.sub}</p>
          </Link>
        ))}
      </section>

      {/* Insights preview */}
      <section className="glass-card animate-slow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="smallcaps text-teal/60 mb-1">Insights</p>
            <p className="font-display text-2xl text-ink">Explore helpful articles</p>
          </div>
          <Link to="/insights" className="smallcaps text-lamp/60 transition-colors duration-300 hover:text-lamp">
            View All →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { title: "Managing Stress", desc: "Simple techniques for daily calm" },
            { title: "Benefits of Journaling", desc: "Why writing helps your mind" },
          ].map((item) => (
            <Link key={item.title} to="/insights" className="group rounded-xl p-4 transition-all duration-300" style={{ background: "var(--glass)" }}>
              <p className="font-display text-lg text-ink/80 transition-colors duration-300 group-hover:text-lamp">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground/40">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass-card text-center">
      <p className="font-display text-3xl text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground/50">{label}</p>
    </div>
  );
}

function MetricBlock({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--glass)" }}>
      <p className="smallcaps text-muted-foreground/50 text-[10px] mb-2">{label}</p>
      <p className="font-display text-2xl text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground/40">{hint}</p>
    </div>
  );
}

function MoodLineChart({ points }: { points: Array<{ date: string; level: number }> }) {
  const width = 720;
  const height = 260;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 56;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const yMin = 1;
  const yMax = 5;
  const n = points.length;
  const [hover, setHover] = useState<number | null>(null);
  const xFor = (i: number) =>
    padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yFor = (v: number) =>
    padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.level).toFixed(1)}`)
    .join(" ");
  const areaPath =
    n > 0
      ? `${linePath} L ${xFor(n - 1).toFixed(1)} ${padT + innerH} L ${xFor(0).toFixed(1)} ${padT + innerH} Z`
      : "";

  const yTicks = [1, 2, 3, 4, 5];
  const maxLabels = 8;
  const labelStep = Math.max(1, Math.ceil(n / maxLabels));
  const bandW = n > 0 ? innerW / Math.max(1, n - 1) : innerW;

  return (
    <div>
      <p className="smallcaps text-muted-foreground/50 mb-3">Daily mood trend</p>
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ minWidth: 520, height: 260 }}
          role="img"
          aria-label="Daily mood line chart"
        >
          <defs>
            <linearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Axis lines */}
          <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="currentColor" strokeOpacity={0.25} className="text-muted-foreground" />
          <line x1={padL} y1={padT + innerH} x2={width - padR} y2={padT + innerH} stroke="currentColor" strokeOpacity={0.25} className="text-muted-foreground" />
          {/* Vertical gridlines */}
          {points.map((_, i) =>
            i % labelStep === 0 || i === n - 1 ? (
              <line
                key={`vg-${i}`}
                x1={xFor(i)}
                x2={xFor(i)}
                y1={padT}
                y2={padT + innerH}
                stroke="currentColor"
                strokeOpacity={0.08}
                className="text-muted-foreground"
              />
            ) : null,
          )}
          {yTicks.map((t) => (
            <g key={t} className="text-muted-foreground/30">
              <line
                x1={padL}
                x2={width - padR}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeDasharray="3 4"
              />
              <text
                x={padL - 8}
                y={yFor(t) + 4}
                textAnchor="end"
                fontSize="10"
                fill="currentColor"
                fillOpacity={0.5}
              >
                {t}
              </text>
            </g>
          ))}
          {/* Axis titles */}
          <text
            x={padL + innerW / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
            fillOpacity={0.6}
            className="text-foreground"
          >
            Date
          </text>
          <text
            transform={`translate(14 ${padT + innerH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
            fillOpacity={0.6}
            className="text-foreground"
          >
            Mood (1–5)
          </text>
          <g className="text-primary">
            {areaPath && <path d={areaPath} fill="url(#moodArea)" />}
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={xFor(i)}
                cy={yFor(p.level)}
                r={hover === i ? 6 : 3.5}
                fill="currentColor"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
              </circle>
            ))}
          </g>
          {points.map((p, i) =>
            i % labelStep === 0 || i === n - 1 ? (
              <text
                key={i}
                x={xFor(i)}
                y={padT + innerH + 16}
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                fillOpacity={0.5}
              >
                {p.date}
              </text>
            ) : null,
          )}
          {/* Hover guide line */}
          {hover !== null && (
            <line
              x1={xFor(hover)}
              x2={xFor(hover)}
              y1={padT}
              y2={padT + innerH}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeDasharray="2 3"
              className="text-primary"
            />
          )}
          {/* Larger invisible hit areas for hover on each date */}
          {points.map((_, i) => (
            <circle
              key={`hit-${i}`}
              cx={xFor(i)}
              cy={yFor(points[i].level)}
              r={Math.max(12, bandW / 2)}
              fill="transparent"
              pointerEvents="all"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute rounded-lg px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(xFor(hover) / width) * 100}%`,
              top: `${(yFor(points[hover].level) / height) * 100}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
              background: "var(--card, #fff)",
              border: "1px solid var(--border, rgba(0,0,0,0.1))",
              color: "var(--foreground)",
              whiteSpace: "nowrap",
            }}
          >
            <div className="font-medium">{points[hover].date}</div>
            <div className="text-muted-foreground">Mood: {points[hover].level.toFixed(1)} / 5</div>
          </div>
        )}
      </div>
    </div>
  );
}
