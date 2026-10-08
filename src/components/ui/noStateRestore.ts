import type { ButtonHTMLAttributes } from "react";

/**
 * Spread onto a <button> whose `disabled` depends on data from the server.
 *
 * Firefox remembers whether a button was enabled or disabled before a reload
 * and puts that back, which can disagree with what the server just rendered
 * and makes React report a hydration mismatch. `autocomplete="off"` switches
 * that off. React's types do not list the attribute for buttons, hence the
 * cast.
 */
export const noStateRestore = {
  autoComplete: "off",
} as ButtonHTMLAttributes<HTMLButtonElement>;
