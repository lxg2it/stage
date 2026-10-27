/**
 * The report: what the loader measured, rendered as an instrument rather than a
 * dashboard. Everything here is built from `LoadInfo`, which is the loader's own
 * account of the stage — nothing is estimated on top of it.
 */
import type { LoadInfo, LoadWarning, MaterialKind, TextureMode } from "@huggingface/usd-web-viewer";
import { bytes, count, ms, plural, scaleLabel, stageNotes } from "./format.js";
import { assess, VERDICT, WARNING_MEANING } from "./fidelity.js";
import type { SurfaceAudit } from "./surface.js";

export interface ReportInput {
  readonly title: string;
  readonly origin: string;
  readonly info: LoadInfo;
  /** Settles after the render; absent while textures are still streaming. */
  readonly textures?: { loaded: number; failed: number } | undefined;
  /**
   * Counting has not finished. Distinct from `textures` on purpose: a partial
   * count rendered as a final one is a number that will be believed.
   */
  readonly texturesPending?: { loaded: number; total: number } | undefined;
  /** What was asked of the loader, so the report can say what the mode excludes. */
  readonly textureMode?: TextureMode | undefined;
  /**
   * What the scene graph turned out to contain after the loader finished. The
   * only evidence on this page that comes from the drawn object rather than
   * from the account of loading it.
   */
  readonly surface?: SurfaceAudit | undefined;
}

const MATERIAL_LABEL: Readonly<Record<MaterialKind, string>> = {
  preview: "UsdPreviewSurface",
  omnipbr: "OmniPBR",
  "gltf-pbr": "glTF PBR",
  displayColor: "displayColor",
  fallback: "fell back to grey",
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title: string, ...rows: HTMLElement[]): HTMLElement {
  const wrap = el("section", "report-section");
  wrap.append(el("h3", "report-heading", title));
  const list = el("dl", "stats");
  for (const row of rows) list.append(row);
  wrap.append(list);
  return wrap;
}

function stat(label: string, value: string, note?: string): HTMLElement {
  const frag = el("div", "stat");
  frag.append(el("dt", "stat-label", label), el("dd", "stat-value", value));
  if (note) frag.append(el("p", "stat-note", note));
  return frag;
}

function composition(info: LoadInfo): HTMLElement {
  const { stats } = info;
  const rows: HTMLElement[] = [
    stat(
      "layers composed",
      plural(stats.layers, "layer"),
      stats.layers > 1 ? "One file was opened. This is how many it is made of." : undefined,
    ),
    stat("layer bytes", bytes(stats.layerBytes), "USD layers only, before any texture."),
    stat("composition rounds", count(stats.rounds), "Each round resolves references found in the last."),
  ];
  if (stats.missing > 0) {
    rows.push(stat("layers missing", count(stats.missing), "Referenced, never fetched."));
  }
  return section("Composition", ...rows);
}

function scene(info: LoadInfo): HTMLElement {
  return section(
    "Geometry",
    stat("triangles", count(info.triangles)),
    stat("meshes", count(info.meshes)),
    stat("geometries", count(info.geometries)),
    stat("materials", count(info.materials)),
  );
}

function materials(info: LoadInfo): HTMLElement {
  const kinds = info.materialKinds;
  const total = Object.values(kinds).reduce((sum, n) => sum + (n ?? 0), 0);
  const wrap = el("section", "report-section");
  wrap.append(el("h3", "report-heading", "Material kinds"));

  if (total === 0) {
    wrap.append(el("p", "report-empty", "No materials in this stage."));
    return wrap;
  }

  const bar = el("div", "kind-bar");
  const legend = el("ul", "kind-legend");
  for (const [kind, n] of Object.entries(kinds) as [MaterialKind, number][]) {
    if (!n) continue;
    const segment = el("div", `kind-segment kind-${kind}`);
    segment.style.width = `${(n / total) * 100}%`;
    segment.title = `${MATERIAL_LABEL[kind]}: ${count(n)}`;
    bar.append(segment);

    const item = el("li", "kind-item");
    item.append(
      el("span", `kind-swatch kind-${kind}`),
      el("span", "kind-name", MATERIAL_LABEL[kind]),
      el("span", "kind-count", count(n)),
    );
    legend.append(item);
  }
  wrap.append(bar, legend);
  return wrap;
}

/**
 * The surfaces, as found in the returned scene rather than as described by the
 * file. A material is a description of a surface; this section says whether one
 * was ever built that carries it.
 */
function surfaces(audit: SurfaceAudit): HTMLElement {
  const total = count(audit.materials);
  const rows = [
    stat(
      "surfaces",
      count(audit.surfaces),
      "Meshes carrying a material, found by walking the returned scene.",
    ),
    stat("materials", total, "Distinct instances. Two surfaces may share one."),
    stat(
      "base colour map",
      `${count(audit.withBaseColorMap)} of ${total}`,
      audit.withBaseColorMap === audit.materials
        ? "Every material carries its colour texture."
        : "A material without one is drawn in its flat colour.",
    ),
    stat("normal map", `${count(audit.withNormalMap)} of ${total}`, TEXTURE_MODE_NOTE_SHORT),
    stat("roughness / metallic", `${count(audit.withOrmMap)} of ${total}`),
  ];
  if (audit.flat > 0) {
    rows.push(
      stat(
        "flat materials",
        count(audit.flat),
        "No map of any kind. This is the authored factor, which is correct for a painted surface and wrong for a photographic one.",
      ),
    );
  }

  const wrap = section("Surfaces", ...rows);
  if (audit.texturesOffSurface) {
    wrap.append(
      el(
        "p",
        "report-finding",
        "Textures were fetched and none of them reached a surface. The model you are looking at is wearing its flat colour, not its texture.",
      ),
    );
  }
  return wrap;
}

const TEXTURE_MODE_NOTE_SHORT =
  "Preview mode never asks for these, so zero here is the mode working as described.";

/** What each texture mode deliberately leaves out. The count alone cannot say this. */
const TEXTURE_MODE_NOTE: Readonly<Record<TextureMode, string | undefined>> = {
  none: "Textures were switched off for this load.",
  preview: "Preview mode: normal maps are never requested, so a package with three maps streams two.",
  full: undefined,
};

function timing(
  info: LoadInfo,
  textures: ReportInput["textures"],
  mode?: TextureMode,
  pending?: ReportInput["texturesPending"],
): HTMLElement {
  const { stats } = info;
  const rows = [
    stat("fetch", ms(stats.fetchMs), "Layers pulled over the network."),
    stat("parse + compose", ms(stats.parseMs + stats.composeMs), "WASM, in a worker."),
    stat("wasm start", ms(stats.initMs)),
    stat("total", ms(stats.totalMs)),
    stat("wasm memory", bytes(stats.wasmMemoryBytes), "The stage lives here, not on the GPU alone."),
  ];
  if (textures) {
    rows.push(
      stat(
        "textures",
        `${count(textures.loaded)} loaded`,
        [
          textures.failed > 0 ? `${count(textures.failed)} failed.` : undefined,
          mode ? TEXTURE_MODE_NOTE[mode] : undefined,
        ]
          .filter(Boolean)
          .join(" "),
      ),
    );
  } else if (pending && mode !== "none") {
    rows.push(
      stat(
        "textures",
        `${count(pending.loaded)} of ${count(pending.total)}, still streaming`,
        "The stage drew without them. This count was read while the loader was still counting, so it is not final.",
      ),
    );
  }
  return section("Load", ...rows);
}

function warnings(list: readonly LoadWarning[], audit?: SurfaceAudit): HTMLElement {
  const offSurface = audit?.texturesOffSurface === true;
  const total = list.length + (offSurface ? 1 : 0);
  const wrap = el("section", "report-section");
  wrap.append(el("h3", "report-heading", `What it could not show (${count(total)})`));

  if (total === 0) {
    wrap.append(el("p", "report-empty", "Nothing was dropped, substituted or refused."));
    return wrap;
  }

  const ul = el("ul", "warnings");
  if (offSurface) {
    const li = el("li", "warning warning-surface");
    li.append(el("span", "warning-code", "textures-off-surface"));
    li.append(
      el(
        "p",
        "warning-meaning",
        "The file's textures were fetched, counted, and then bound to no material. This is not a warning the loader raises: it was found by inspecting the scene it returned.",
      ),
    );
    ul.append(li);
  }
  for (const warning of list) {
    const li = el("li", "warning");
    li.append(el("span", "warning-code", warning.code));
    li.append(el("p", "warning-meaning", WARNING_MEANING[warning.code]));
    if (warning.path) li.append(el("p", "warning-path", warning.path));
    li.append(el("p", "warning-message", warning.message));
    ul.append(li);
  }
  wrap.append(ul);
  return wrap;
}

function verdict(info: LoadInfo, audit?: SurfaceAudit): HTMLElement {
  const { kind, reason } = assess({
    warnings: info.warnings,
    texturesOffSurface: audit?.texturesOffSurface === true,
  });
  const { label, claim } = VERDICT[kind];
  const header = el("header", `verdict verdict-${kind}`);
  header.append(el("p", "verdict-label", label), el("p", "verdict-claim", claim));
  if (reason) header.append(el("p", "verdict-reason", reason));
  return header;
}

export function renderReport(input: ReportInput): DocumentFragment {
  const frag = document.createDocumentFragment();

  const head = el("div", "report-head");
  head.append(el("p", "report-origin", input.origin));
  head.append(el("h2", "report-title", input.title));

  frag.append(head, verdict(input.info, input.surface));

  const axis = el("section", "report-section");
  axis.append(el("h3", "report-heading", "Stage"));
  const dl = el("dl", "stats");
  const notes = stageNotes(input.info.upAxis, input.info.metersPerUnit);
  dl.append(
    stat("up axis", input.info.upAxis, notes.axis),
    stat("scale", scaleLabel(input.info.metersPerUnit), notes.scale),
  );
  axis.append(dl);
  frag.append(axis);

  frag.append(composition(input.info), scene(input.info), materials(input.info));
  if (input.surface) frag.append(surfaces(input.surface));
  frag.append(timing(input.info, input.textures, input.textureMode, input.texturesPending));
  frag.append(warnings(input.info.warnings, input.surface));

  return frag;
}

/** Shown before anything is loaded, and after a failure. */
export function renderPlaceholder(title: string, body: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const head = el("div", "report-head");
  head.append(el("h2", "report-title", title));
  frag.append(head, el("p", "report-placeholder", body));
  return frag;
}
