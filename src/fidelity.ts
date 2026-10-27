/**
 * The fidelity verdict: how much of a USD file is actually on screen.
 *
 * A viewer can only ever show what it understands. Everything else is silently
 * absent, and absent geometry looks exactly like geometry that was never there.
 * So the warnings the loader raises are classified by what they cost the picture:
 *
 *   incomplete  — something that should be visible is not.
 *   approximate — everything is visible, but not as it was authored.
 *   faithful    — nothing was dropped, substituted or refused.
 */
import type { LoadWarning, WarningCode } from "@huggingface/usd-web-viewer";

export type Fidelity = "faithful" | "approximate" | "incomplete";

/**
 * Codes that mean part of the asset is missing from the render: a layer that did
 * not arrive, a reference that did not resolve, a prim type with no geometry, a
 * mesh left out past a limit, or a stage with nothing drawable in it at all.
 */
const INCOMPLETE: ReadonlySet<WarningCode> = new Set<WarningCode>([
  "layer-missing",
  "layer-unreadable",
  "prim-unsupported",
  "nothing-drawable",
  "composition",
  "triangle-limit",
  "instance-limit",
]);

/**
 * Codes that mean the render is complete but not literal: a material that fell
 * back, or a texture that was refused and shows its authored values instead.
 */
const APPROXIMATE: ReadonlySet<WarningCode> = new Set<WarningCode>([
  "material-fallback",
  "texture-failed",
]);

export interface FidelityEvidence {
  /** What the loader said about the stage. */
  readonly warnings: readonly LoadWarning[];
  /**
   * The loader fetched textures and not one of them reached a surface, read
   * from the scene graph rather than from the load report.
   *
   * This is here because the loader's warnings describe the FILE, and a file
   * whose textures arrived but bound to nothing produces no warning at all. The
   * page would then be entitled to say "faithful" about a model wearing a flat
   * colour — a claim about the picture that only the picture can settle.
   */
  readonly texturesOffSurface?: boolean;
}

export interface Assessment {
  readonly kind: Fidelity;
  /** Why, when the warnings alone do not explain it. */
  readonly reason?: string;
}

export function assess(evidence: FidelityEvidence): Assessment {
  const { warnings } = evidence;
  if (warnings.some((w) => INCOMPLETE.has(w.code))) return { kind: "incomplete" };
  if (warnings.some((w) => APPROXIMATE.has(w.code))) return { kind: "approximate" };
  if (evidence.texturesOffSurface) {
    return {
      kind: "approximate",
      reason:
        "The loader fetched textures and none of them reached a surface. What you see is the material's flat colour.",
    };
  }
  return { kind: "faithful" };
}

export const VERDICT: Readonly<Record<Fidelity, { label: string; claim: string }>> = {
  faithful: {
    label: "Faithful",
    claim: "Everything this file contains is on screen.",
  },
  approximate: {
    label: "Approximate",
    claim: "The geometry is all here. Some of what makes it look right is not.",
  },
  incomplete: {
    label: "Incomplete",
    claim: "Part of this file is missing from what you see.",
  },
};

/** One-line explanation per warning code, for a reader who is not a USD engineer. */
export const WARNING_MEANING: Readonly<Record<WarningCode, string>> = {
  "layer-missing": "A layer the stage references was never fetched, so its parts are absent.",
  "layer-unreadable": "A layer arrived but would not parse. Composition continued without it.",
  "prim-unsupported": "Visible geometry of a type this viewer cannot draw was left out.",
  "nothing-drawable": "No visible mesh had anything to draw.",
  "material-fallback": "A material had no UsdPreviewSurface or supported MDL, so it shows grey.",
  composition: "Composition reported a problem resolving a reference.",
  "texture-failed": "A texture was refused or failed, so its inputs show authored values instead.",
  "triangle-limit": "Meshes past the triangle cap were left out unread.",
  "instance-limit": "Instances past the cap were left out.",
};
