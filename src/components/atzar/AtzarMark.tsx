import { clsx } from "clsx";

/**
 * ATZAR mark: an eye set inside a coin/die face. currentColor-based so it can
 * be recolored via text-color utility classes (defaults to atzar gold usage
 * by the caller).
 */
export function AtzarMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={clsx("eye-watch", className)}
      fill="none"
    >
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path
        d="M10 32C10 32 19 20 32 20C45 20 54 32 54 32C54 32 45 44 32 44C19 44 10 32 10 32Z"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle cx="32" cy="32" r="7" fill="currentColor" />
      <circle cx="32" cy="32" r="2.5" className="fill-atzar-black" />
    </svg>
  );
}
