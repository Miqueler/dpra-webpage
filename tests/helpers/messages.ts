import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const MESSAGES_DIR = join(process.cwd(), "src/messages");

export const LOCALES = readdirSync(MESSAGES_DIR).sort();

export type MessageTree = { [key: string]: string | string[] | MessageTree };

function load(locale: string): MessageTree {
  const namespaces: MessageTree = {};
  for (const file of readdirSync(join(MESSAGES_DIR, locale)).sort()) {
    namespaces[file.replace(/\.json$/, "")] = JSON.parse(
      readFileSync(join(MESSAGES_DIR, locale, file), "utf8"),
    );
  }
  return namespaces;
}

/** Every locale's messages, read straight from src/messages. */
export const messages: Record<string, MessageTree> = Object.fromEntries(
  LOCALES.map((locale) => [locale, load(locale)]),
);

/** Flattens a message tree into `a.b.c` → string entries. */
export function flatten(tree: unknown, prefix = ""): Record<string, string> {
  if (typeof tree === "string") return { [prefix]: tree };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree as object)) {
    Object.assign(out, flatten(value, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

/** Looks up one message by dotted path, e.g. `text("en", "auth.profile.coins")`. */
export function text(locale: string, path: string): string {
  const value = flatten(messages[locale])[path];
  if (value === undefined) throw new Error(`No message ${locale}:${path}`);
  return value;
}
