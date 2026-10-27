import { describe, expect, it } from "vitest";
import { bytes, count, ms, plural, scaleLabel, stageNotes } from "./format.js";

describe("bytes", () => {
  it("keeps small counts in bytes", () => {
    expect(bytes(0)).toBe("0 B");
    expect(bytes(1023)).toBe("1023 B");
  });

  it("steps units at 1024, not 1000", () => {
    expect(bytes(1024)).toBe("1.0 KB");
    expect(bytes(1024 * 1024)).toBe("1.0 MB");
    expect(bytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });

  it("drops the decimal at a hundred units and keeps it below", () => {
    expect(bytes(100 * 1024)).toBe("100 KB");
    expect(bytes(150 * 1024)).toBe("150 KB");
    expect(bytes(99 * 1024)).toBe("99.0 KB");
  });

  it("does not invent a figure for nonsense", () => {
    expect(bytes(Number.NaN)).toBe("—");
    expect(bytes(-1)).toBe("—");
  });
});

describe("ms", () => {
  it("shows sub-millisecond work at two decimals", () => {
    expect(ms(0.25)).toBe("0.25 ms");
  });

  it("rolls over to seconds at a thousand", () => {
    expect(ms(999)).toBe("999 ms");
    expect(ms(1000)).toBe("1.00 s");
    expect(ms(123_000)).toBe("123.0 s");
  });
});

describe("scaleLabel", () => {
  it("names the common authoring scales", () => {
    expect(scaleLabel(1)).toBe("1 unit = 1 m");
    expect(scaleLabel(0.01)).toBe("1 unit = 1 cm");
    expect(scaleLabel(0.001)).toBe("1 unit = 1 mm");
  });

  it("passes through anything else rather than rounding it to a common value", () => {
    expect(scaleLabel(0.0254)).toBe("1 unit = 0.0254 m");
  });

  it("says unknown rather than '0' when the stage reports nothing", () => {
    expect(scaleLabel(0)).toBe("unknown scale");
    expect(scaleLabel(Number.NaN)).toBe("unknown scale");
  });
});

describe("plural", () => {
  it("agrees with the number", () => {
    expect(plural(1, "layer")).toBe("1 layer");
    expect(plural(0, "layer")).toBe("0 layers");
    expect(plural(34, "layer")).toBe("34 layers");
  });

  it("takes an irregular plural", () => {
    expect(plural(2, "geometry", "geometries")).toBe("2 geometries");
  });
});

describe("count", () => {
  it("separates thousands", () => {
    expect(count(1234567)).toBe("1,234,567");
  });

  it("does not put a separator inside a small number", () => {
    expect(count(999)).toBe("999");
  });
});

describe("stageNotes", () => {
  it("says a Z-up stage was rotated, because it is", () => {
    expect(stageNotes("Z", 1).axis).toBe("Rotated to Y-up for display.");
  });

  it("says Y-up was drawn as authored", () => {
    expect(stageNotes("Y", 1).axis).toBe("Drawn as authored.");
  });

  it("does not claim a rotation the loader does not perform", () => {
    // The loader only rotates when upAxis === "Z"; anything else is left alone.
    expect(stageNotes("X", 1).axis).toBe("Drawn as authored.");
    expect(stageNotes("", 1).axis).toBe("Drawn as authored.");
  });

  it("notes the scale only when the stage is actually rescaled", () => {
    expect(stageNotes("Y", 1).scale).toBeUndefined();
    expect(stageNotes("Y", 0.01).scale).toBe("Scaled to metres for display.");
    expect(stageNotes("Y", 2.54).scale).toBe("Scaled to metres for display.");
  });

  it("stays silent when the scale is unusable, since the loader falls back to 1", () => {
    expect(stageNotes("Y", Number.NaN).scale).toBeUndefined();
    expect(stageNotes("Y", 0).scale).toBeUndefined();
    expect(stageNotes("Y", -1).scale).toBeUndefined();
  });
});
