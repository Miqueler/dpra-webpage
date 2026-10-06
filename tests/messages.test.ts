import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { LOCALES, MESSAGES_DIR, flatten, messages } from "./helpers/messages";

const REFERENCE = "en";
const others = LOCALES.filter((locale) => locale !== REFERENCE);

function placeholders(message: string) {
  return [...message.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
}

describe("translations", () => {
  it("has a message folder for exactly the routed locales", () => {
    expect(LOCALES).toEqual([...routing.locales].sort());
  });

  it.each(others)("%s has the same namespace files as en", (locale) => {
    expect(readdirSync(join(MESSAGES_DIR, locale)).sort()).toEqual(
      readdirSync(join(MESSAGES_DIR, REFERENCE)).sort(),
    );
  });

  it.each(others)("%s has exactly the same message keys as en", (locale) => {
    expect(Object.keys(flatten(messages[locale])).sort()).toEqual(
      Object.keys(flatten(messages[REFERENCE])).sort(),
    );
  });

  it.each(LOCALES)("%s has no empty messages", (locale) => {
    const empty = Object.entries(flatten(messages[locale]))
      .filter(([, value]) => value.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it.each(others)("%s uses the same placeholders as en", (locale) => {
    const reference = flatten(messages[REFERENCE]);
    const translated = flatten(messages[locale]);
    const mismatched = Object.keys(reference).filter(
      (key) =>
        translated[key] !== undefined &&
        placeholders(translated[key]).join() !== placeholders(reference[key]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it("registers every namespace file of every locale in the request config", () => {
    const source = readFileSync(join(process.cwd(), "src/i18n/request.ts"), "utf8");
    const missing: string[] = [];
    for (const locale of LOCALES) {
      for (const file of readdirSync(join(MESSAGES_DIR, locale))) {
        const path = `../messages/${locale}/${file}`;
        if (!source.includes(`"${path}"`)) missing.push(path);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("the DPRA name", () => {
  it.each(LOCALES)("is DPRA as the brand in %s", (locale) => {
    expect(flatten(messages[locale])["common.brand"]).toBe("DPRA");
  });

  it.each(LOCALES)("is never written as RPDA in %s", (locale) => {
    const offenders = Object.entries(flatten(messages[locale]))
      .filter(([, value]) => /RPDA/i.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });
});
