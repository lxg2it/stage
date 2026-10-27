import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import type { LoadWarning, WarningCode } from "@huggingface/usd-web-viewer";
import { classify, VERDICT, WARNING_MEANING } from "./fidelity.js";

function warn(code: WarningCode): LoadWarning {
  return { code, message: `${code} happened` };
}

/**
 * Every code the loader can raise. Kept here rather than imported, because the
 * point of the coverage test below is to fail when the library grows a code this
 * app has not classified — importing the list would make that impossible.
 */
const ALL_CODES: readonly WarningCode[] = [
  "layer-missing",
  "layer-unreadable",
  "prim-unsupported",
  "nothing-drawable",
  "material-fallback",
  "composition",
  "texture-failed",
  "triangle-limit",
  "instance-limit",
];

describe("classify", () => {
  it("calls a clean load faithful", () => {
    expect(classify([])).toBe("faithful");
  });

  it("never calls a warning-free load anything else", () => {
    // The control: if the sets were swapped or mis-keyed, this still passes but
    // the two tests below must fail.
    expect(classify([])).not.toBe("incomplete");
    expect(classify([])).not.toBe("approximate");
  });

  it("treats a missing layer as incomplete, not approximate", () => {
    // A missing layer is absent geometry. Calling it approximate would tell the
    // reader the picture is complete when part of the file is not on screen.
    expect(classify([warn("layer-missing")])).toBe("incomplete");
  });

  it("treats a material fallback as approximate, not incomplete", () => {
    expect(classify([warn("material-fallback")])).toBe("approximate");
  });

  it("lets the worst warning win", () => {
    expect(classify([warn("material-fallback"), warn("layer-missing")])).toBe("incomplete");
  });

  it("ignores order", () => {
    expect(classify([warn("layer-missing"), warn("material-fallback")])).toBe("incomplete");
  });
});

describe("coverage", () => {
  it("classifies every warning code the loader can raise", () => {
    // A code that lands in neither set silently reports "faithful" — the one
    // answer that must never be given by default.
    const unclassified = ALL_CODES.filter(
      (code) => classify([warn(code)]) === "faithful",
    );
    expect(unclassified).toEqual([]);
  });

  it("has plain-language text for every code", () => {
    const missing = ALL_CODES.filter((code) => !WARNING_MEANING[code]);
    expect(missing).toEqual([]);
  });

  it("has a verdict for each fidelity", () => {
    expect(Object.keys(VERDICT).sort()).toEqual(["approximate", "faithful", "incomplete"]);
  });
});

describe("drift", () => {
  /**
   * The test above proves this app classifies every code on ITS OWN list. It
   * cannot notice the library growing a tenth code, because the list is memory.
   * This one reads the union out of the installed type declarations, so an
   * upgrade that adds a code fails here instead of silently reporting
   * "faithful" for a warning nobody classified.
   */
  it("matches the WarningCode union in the installed library", async () => {
    const { readFileSync } = await import("node:fs");
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const pkg = require.resolve("@huggingface/usd-web-viewer/package.json");
    const dts = join(dirname(pkg), "dist/esm/types.d.ts");
    const src = readFileSync(dts, "utf8");
    const m = /export type WarningCode =([^;]+);/.exec(src);
    if (!m) throw new Error(`no WarningCode union found in ${dts}`);
    const body = m[1] ?? "";
    const declared = [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
    expect([...ALL_CODES].sort()).toEqual(declared);
  });
});
