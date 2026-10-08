import Image from "next/image";
import { clsx } from "clsx";

/** The Republic's seal. Decorative: it always sits next to the name or slogan. */
export function DpraLogo({
  size,
  className,
}: {
  /** Rendered width and height in pixels, before any class overrides. */
  size: number;
  className?: string;
}) {
  return (
    <Image
      src="/dpra-logo.png"
      alt=""
      width={size}
      height={size}
      className={clsx("select-none", className)}
    />
  );
}
