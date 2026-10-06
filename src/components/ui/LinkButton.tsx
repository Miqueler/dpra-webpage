import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={clsx(
        "font-display inline-flex items-center justify-center gap-2 px-6 py-3 text-sm uppercase tracking-widest transition-colors",
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
