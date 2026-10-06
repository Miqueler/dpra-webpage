import { clsx } from "clsx";

export function WatchingEye({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 60"
      aria-hidden="true"
      className={clsx("eye-watch text-party-red", className)}
      fill="none"
    >
      <path
        d="M2 30C2 30 22 6 50 6C78 6 98 30 98 30C98 30 78 54 50 54C22 54 2 30 2 30Z"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="50" cy="30" r="14" fill="currentColor" />
      <circle cx="50" cy="30" r="5" className="fill-party-black" />
    </svg>
  );
}
