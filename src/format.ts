/** Number formatting. Every figure the report shows comes through here. */

const UNITS = ["B", "KB", "MB", "GB"] as const;

/** Bytes as a person reads them. Keeps one decimal above a kilobyte. */
export function bytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}

/** Thousands-separated integer. */
export function count(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-AU");
}

/** A duration, at whatever precision reads cleanly at that scale. */
export function ms(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1) return `${n.toFixed(2)} ms`;
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)} s`;
}

/** Metres per unit, read the way a modeller says it. */
export function scaleLabel(metersPerUnit: number): string {
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) return "unknown scale";
  if (metersPerUnit === 1) return "1 unit = 1 m";
  if (metersPerUnit === 0.01) return "1 unit = 1 cm";
  if (metersPerUnit === 0.001) return "1 unit = 1 mm";
  return `1 unit = ${metersPerUnit} m`;
}

/**
 * What the viewer does to the stage before drawing it, as opposed to what the
 * file says about itself. Both facts mirror the loader's own transform
 * (usd-web-viewer, esm/load.js): a Z-up stage is rotated a quarter turn to reach
 * three.js's Y-up, and the whole stage is scaled by metersPerUnit. Both depart
 * from the authored scene, so the report says so and the reader is not left to
 * assume it is drawn literally.
 */
export function stageNotes(
  upAxis: string,
  metersPerUnit: number,
): { readonly axis: string; readonly scale: string | undefined } {
  return {
    axis: upAxis === "Z" ? "Rotated to Y-up for display." : "Drawn as authored.",
    scale:
      Number.isFinite(metersPerUnit) && metersPerUnit > 0 && metersPerUnit !== 1
        ? "Scaled to metres for display."
        : undefined,
  };
}


/** "1 layer" / "34 layers" — counted nouns, so the number and the word agree. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}
