/**
 * Compact decorative banner shown at the top of dashboard pages.
 * Image floats to the right on tablet+, stacks beneath on mobile.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
  imageAlt = "",
  accentColor = "var(--lamp)",
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  image: string;
  imageAlt?: string;
  accentColor?: string;
}) {
  return (
    <header className="animate-rise grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="smallcaps mb-4" style={{ color: `color-mix(in oklab, ${accentColor} 70%, transparent)` }}>
          {eyebrow}
        </p>
        <h1 className="font-display text-4xl text-ink sm:text-5xl md:text-6xl leading-[1.1]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-md text-muted-foreground/60" style={{ lineHeight: "1.8" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="relative mx-auto h-32 w-full max-w-[260px] overflow-hidden rounded-2xl md:h-40 md:w-56"
        style={{ boxShadow: "0 20px 50px -25px oklch(0.72 0.15 155 / 0.4)" }}
      >
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          width={1280}
          height={832}
          className="h-full w-full object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(180deg, transparent 50%, oklch(0 0 0 / 0.15))",
          }}
        />
      </div>
    </header>
  );
}