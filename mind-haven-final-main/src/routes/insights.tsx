import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import leafImg from "@/assets/insight-leaf.jpg";
import birdImg from "@/assets/insight-bird.jpg";
import handImg from "@/assets/insight-hand.jpg";
import rippleImg from "@/assets/insight-ripple.jpg";

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
});

const ARTICLES = [
  {
    id: "managing-stress",
    image: rippleImg,
    title: "Managing Stress in Everyday Life",
    preview: "Stress doesn't have to control your day. Learn simple, evidence-based techniques to recognize stress triggers and respond with calm intention.",
    category: "Wellness",
    readTime: "4 min read",
    content: `Stress is a natural response, but chronic stress can affect your mental and physical health. Here are practical strategies:\n\n• Practice deep breathing — 4-7-8 technique: inhale for 4 seconds, hold for 7, exhale for 8\n• Break tasks into smaller steps to avoid feeling overwhelmed\n• Set boundaries with work and social obligations\n• Move your body — even a 10-minute walk can reduce cortisol levels\n• Write it out — journaling helps externalize worries\n\nRemember: managing stress is not about eliminating it entirely, but learning to flow with it.`,
  },
  {
    id: "benefits-journaling",
    image: leafImg,
    title: "The Hidden Benefits of Journaling",
    preview: "Writing isn't just for writers. Discover how putting pen to paper can reduce anxiety, improve clarity, and help you understand your emotional patterns.",
    category: "Mental Health",
    readTime: "5 min read",
    content: `Journaling has been shown to reduce symptoms of anxiety and depression. Here's why it works:\n\n• Emotional release — writing creates a safe outlet for feelings you might not express otherwise\n• Pattern recognition — over time, you'll notice recurring themes in your thoughts\n• Problem solving — writing about challenges engages different parts of your brain\n• Gratitude amplification — noting positive moments trains your brain to notice more of them\n• Better sleep — a "brain dump" before bed can quiet racing thoughts\n\nStart small: even 5 minutes a day makes a difference. There's no right or wrong way to journal.`,
  },
  {
    id: "improving-mood",
    image: birdImg,
    title: "Small Steps to Improve Your Daily Mood",
    preview: "Mood isn't fixed — it fluctuates. Explore gentle, accessible ways to nudge your emotional state toward more light throughout the day.",
    category: "Self-Care",
    readTime: "3 min read",
    content: `Your mood responds to small, intentional actions throughout the day:\n\n• Morning sunlight — just 10 minutes of natural light helps regulate your circadian rhythm\n• Hydration — dehydration is linked to increased anxiety and irritability\n• Social connection — even a brief, genuine conversation can lift your spirits\n• Nature exposure — green spaces reduce mental fatigue\n• Creative expression — drawing, cooking, or music engages positive neural pathways\n• Acts of kindness — helping others produces a natural mood boost\n\nTrack your mood daily to discover what activities correlate with feeling better.`,
  },
  {
    id: "positive-habits",
    image: handImg,
    title: "Building Small Positive Habits",
    preview: "Lasting change doesn't require grand gestures. Learn how micro-habits compound over time to create meaningful transformation in your mental health.",
    category: "Growth",
    readTime: "4 min read",
    content: `The key to lasting change is starting impossibly small:\n\n• The 2-minute rule — any new habit should take less than 2 minutes to start\n• Habit stacking — attach new habits to existing ones ("After I pour my coffee, I'll write one sentence in my journal")\n• Environment design — make good habits easy and bad habits hard\n• Don't break the chain — consistency matters more than intensity\n• Celebrate tiny wins — your brain needs positive reinforcement\n\nExamples of micro-habits for mental health:\n• One deep breath before checking your phone\n• Naming one thing you're grateful for while brushing your teeth\n• A 30-second body scan before sleep`,
  },
];

function InsightsPage() {
  const [dbArticles, setDbArticles] = useState<
    Array<{ id: string; title: string; preview: string | null; category: string | null; content: string }>
  >([]);

  useEffect(() => {
    supabase
      .from("insights")
      .select("id, title, preview, category, content")
      .order("created_at", { ascending: false })
      .then(({ data }) => setDbArticles(data ?? []));
  }, []);

  const fallbacks = [rippleImg, leafImg, birdImg, handImg];
  const allArticles = [
    ...dbArticles.map((a, i) => ({
      ...a,
      preview: a.preview ?? "",
      category: a.category ?? "Insight",
      readTime: `${Math.max(2, Math.round((a.content?.length ?? 0) / 900))} min read`,
      image: fallbacks[i % fallbacks.length],
    })),
    ...ARTICLES,
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/20">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-6">
          <Link to="/" className="font-display text-2xl gradient-text">MindHaven</Link>
          <Link to="/auth" className="smallcaps text-muted-foreground/50 transition-colors duration-300 hover:text-lamp">Sign In</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-20">
        <div className="animate-rise text-center mb-20">
          <p className="smallcaps text-lamp/60 mb-4">Knowledge & Guidance</p>
          <h1 className="font-display text-5xl text-ink sm:text-6xl">Insights for Your Mind</h1>
          <p className="mx-auto mt-6 max-w-lg text-muted-foreground/60" style={{ lineHeight: "1.8" }}>
            Evidence-based articles to support your mental health journey. Read, reflect, and grow.
          </p>
        </div>

        <div className="space-y-8 animate-slow">
          {allArticles.map((article) => (
            <article key={article.id} className="glass-card group cursor-pointer transition-all duration-500 hover:shadow-glow">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <img
                  src={article.image}
                  alt=""
                  loading="lazy"
                  width={1280}
                  height={832}
                  className="w-full md:w-48 md:h-32 h-44 rounded-xl object-cover shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="smallcaps text-teal/70">{article.category}</span>
                    <span className="text-xs text-muted-foreground/30">·</span>
                    <span className="text-xs text-muted-foreground/40">{article.readTime}</span>
                  </div>
                  <h2 className="font-display text-2xl text-ink transition-colors duration-300 group-hover:gradient-text sm:text-3xl">
                    {article.title}
                  </h2>
                  <p className="mt-4 text-muted-foreground/60" style={{ lineHeight: "1.7" }}>
                    {article.preview}
                  </p>
                  <details className="mt-6">
                    <summary className="cursor-pointer smallcaps text-lamp/60 transition-colors duration-300 hover:text-lamp">
                      Read more
                    </summary>
                    <div className="mt-6 whitespace-pre-line text-foreground/70" style={{ lineHeight: "1.9" }}>
                      {article.content}
                    </div>
                  </details>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
