import { clsx } from "clsx";
import type { ReactNode } from "react";

export function PosterCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "propaganda-grain relative border border-party-cream/20 bg-party-black-soft p-6 sm:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-8", className)}>
      {eyebrow && (
        <p className="font-display text-party-red mb-2 text-xs uppercase tracking-[0.3em]">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl uppercase tracking-wide text-party-cream sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}
