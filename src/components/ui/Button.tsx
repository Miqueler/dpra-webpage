import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        "font-display inline-flex items-center justify-center gap-2 px-6 py-3 text-sm uppercase tracking-widest transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-party-red text-party-cream hover:bg-party-red-dark border border-party-red",
        variant === "secondary" &&
          "bg-transparent text-party-cream border border-party-cream hover:bg-party-cream hover:text-party-black",
        variant === "ghost" &&
          "bg-transparent text-party-cream/80 hover:text-party-cream underline underline-offset-4",
        className
      )}
      {...props}
    />
  );
}
