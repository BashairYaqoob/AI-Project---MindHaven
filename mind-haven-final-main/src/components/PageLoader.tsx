import { useEffect, useState } from "react";
import atmosphereImg from "@/assets/loader-atmosphere.jpg";

export function PageLoader({
  label = "A moment",
  minMs = 4000,
  onFinish,
}: {
  label?: string;
  minMs?: number;
  onFinish?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), minMs - 800);
    const t2 = setTimeout(() => {
      setVisible(false);
      onFinish?.();
    }, minMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [minMs, onFinish]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "var(--gradient-bg)",
        opacity: fading ? 0 : 1,
        transition: "opacity 800ms ease-out",
      }}
    >
      <img
        src={atmosphereImg}
        alt=""
        width={1920}
        height={1080}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div className="pointer-events-none absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% 40%, oklch(0.72 0.12 280 / 0.08), transparent 70%)",
      }} />
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Breathing ring around a soft sage core */}
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: "oklch(0.72 0.15 155 / 0.18)",
              animation: "breathe 3.2s ease-in-out infinite",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-3 rounded-full"
            style={{
              background: "oklch(0.72 0.15 155 / 0.28)",
              animation: "breathe 3.2s ease-in-out infinite 0.4s",
            }}
          />
          <span
            className="relative h-10 w-10 rounded-full"
            style={{
              background: "var(--gradient-primary, oklch(0.72 0.15 155))",
              boxShadow: "0 0 24px oklch(0.72 0.15 155 / 0.5)",
            }}
          />
        </div>
        <p className="font-display text-3xl text-ink/90 tracking-wide">{label}</p>
        <p className="smallcaps text-muted-foreground/60 gradient-text">MindHaven</p>
        <p className="text-xs text-muted-foreground/40 italic">breathe in… breathe out…</p>
      </div>
    </div>
  );
}

export function InlineLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--lamp)", animation: "breathe 2s ease-in-out infinite" }} />
        <div className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--teal)", animation: "breathe 2s ease-in-out infinite 0.3s" }} />
        <div className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--lamp)", animation: "breathe 2s ease-in-out infinite 0.6s" }} />
      </div>
    </div>
  );
}
