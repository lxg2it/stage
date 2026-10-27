import { createViewer, UsdLoadError } from "@huggingface/usd-web-viewer";
import type { LoadInfo, LoadOptions, LoadProgress, TextureMode, Viewer } from "@huggingface/usd-web-viewer";
import { bytes, count } from "./format.js";
import { renderPlaceholder, renderReport } from "./report.js";
import { SHELF } from "./shelf.js";
import type { Asset } from "./shelf.js";

const REPORT = document.querySelector<HTMLElement>("#report");
const VIEWER_HOST = document.querySelector<HTMLElement>("#viewer");
const PROGRESS = document.querySelector<HTMLElement>("#progress");
const PROGRESS_BAR = document.querySelector<HTMLElement>("#progress-bar");
const PROGRESS_TEXT = document.querySelector<HTMLElement>("#progress-text");
const SHELF_HOST = document.querySelector<HTMLElement>("#shelf");
const DROPZONE = document.querySelector<HTMLElement>("#dropzone");
const QUALITY = document.querySelector<HTMLSelectElement>("#quality");
const FILE_INPUT = document.querySelector<HTMLInputElement>("#file-input");
const DIR_INPUT = document.querySelector<HTMLInputElement>("#dir-input");

if (
  !REPORT ||
  !VIEWER_HOST ||
  !PROGRESS ||
  !PROGRESS_BAR ||
  !PROGRESS_TEXT ||
  !SHELF_HOST ||
  !DROPZONE ||
  !QUALITY ||
  !FILE_INPUT ||
  !DIR_INPUT
) {
  throw new Error("stage: the page is missing an element this app needs.");
}

const report: HTMLElement = REPORT;
const viewerHost: HTMLElement = VIEWER_HOST;
const progress: HTMLElement = PROGRESS;
const progressBar: HTMLElement = PROGRESS_BAR;
const progressText: HTMLElement = PROGRESS_TEXT;
const shelfHost: HTMLElement = SHELF_HOST;
const dropzone: HTMLElement = DROPZONE;
const quality: HTMLSelectElement = QUALITY;
const fileInput: HTMLInputElement = FILE_INPUT;
const dirInput: HTMLInputElement = DIR_INPUT;

const USD_EXTENSIONS = [".usd", ".usda", ".usdc", ".usdz"];

/**
 * WebGL is the one dependency this page cannot work around. If it is missing the
 * page still stands up — the shelf, the copy and the report panel are all useful
 * without it — and says so where the report would be, rather than dying blank.
 */
let viewer: Viewer | null = null;
try {
  viewer = createViewer(viewerHost, {
    background: 0x0d0d11,
    onContextLost: () =>
      setReport(
        renderPlaceholder(
          "Context lost",
          "The GPU dropped the stage. It reloads itself when the context comes back.",
        ),
      ),
    // The viewer reloads the last stage with the same options on restore; the
    // report is still accurate, so nothing is re-rendered here.
    onContextRestored: () => undefined,
  });
} catch (error) {
  setReport(
    renderPlaceholder(
      "No WebGL",
      `${error instanceof Error ? error.message : "This browser could not open a WebGL context."} ` +
        "The page can describe a stage but not draw one; hardware acceleration is usually what is switched off.",
    ),
  );
}

function setReport(fragment: DocumentFragment): void {
  report.replaceChildren(fragment);
}

function setProgress(text: string, fraction?: number): void {
  progress.hidden = false;
  progressText.textContent = text;
  progressBar.style.width = `${Math.round((fraction ?? 0) * 100)}%`;
}

function clearProgress(): void {
  progress.hidden = true;
  progressBar.style.width = "0%";
}

/** The loader's progress, said in the words of what it is doing. */
function describe(p: LoadProgress): string {
  switch (p.stage) {
    case "layers":
      return `fetching layers: ${count(p.loaded)} of ${count(p.total)} found, ${bytes(p.bytes)}`;
    case "compose":
      return `composing references: round ${count(p.round)}`;
    case "geometry":
      return `building geometry: ${count(p.loaded)} of ${count(p.total)} meshes`;
    case "textures":
      return `streaming textures: ${count(p.loaded)} of ${count(p.total)}`;
  }
}

function textureMode(): TextureMode {
  const value = quality.value;
  return value === "none" || value === "full" ? value : "preview";
}

const ERROR_TEXT: Readonly<Record<string, string>> = {
  aborted: "Superseded by a newer load.",
  fetch: "A layer could not be fetched. If the file references others, they have to be reachable too. That is what composition means.",
  compose: "The file parsed, but the stage would not compose. A compose error mentioning 'scene too large to load' means it ran out of WebAssembly memory.",
  worker: "This browser has no Web Workers, and the parser runs in one.",
  webgl: "There is no WebGL context to draw into.",
};

/**
 * Every load takes a ticket. A superseded load can still resolve — the viewer
 * aborts the previous one, but its `complete` promise settles either way — and a
 * late write would put the wrong asset's numbers under a newer asset's title.
 */
let loadTicket = 0;

/** Loads a stage, keeping the report and the progress line in step with it. */
async function show(
  title: string,
  origin: string,
  url: string,
  files?: ReadonlyMap<string, Blob>,
): Promise<void> {
  if (!viewer) {
    setReport(renderPlaceholder(title, "No WebGL, so there is nothing to draw into."));
    return;
  }
  const ticket = ++loadTicket;
  setProgress("starting the worker", 0);
  setReport(renderPlaceholder(title, "Composing…"));

  const options: LoadOptions = {
    textures: textureMode(),
    maxTextureSize: 1024,
    onProgress: (p) => setProgress(describe(p), p.fraction),
  };
  if (files) options.files = files;

  try {
    const result = await viewer.load(url, options);
    if (ticket !== loadTicket) return;
    const info: LoadInfo = result.info;
    const mode = options.textures;
    setReport(renderReport({ title, origin, info, textureMode: mode }));

    // The geometry is on screen before the textures are. Saying so is the point:
    // a grey object and an untextured one are indistinguishable without a label.
    const streaming = options.textures !== "none";
    if (streaming) setProgress("streaming textures", 0.9);
    else clearProgress();

    result.complete
      .then(({ textures, failed }) => {
        if (ticket !== loadTicket) return;
        clearProgress();
        setReport(
          renderReport({ title, origin, info, textureMode: mode, textures: { loaded: textures, failed } }),
        );
      })
      .catch(() => {
        if (ticket !== loadTicket) return;
        clearProgress();
        setReport(renderReport({ title, origin, info, textureMode: mode }));
      });
  } catch (error) {
    if (ticket !== loadTicket) return;
    clearProgress();
    const code = error instanceof UsdLoadError ? error.code : "unknown";
    if (code === "aborted") return;
    setReport(
      renderPlaceholder(
        title,
        `${ERROR_TEXT[code] ?? "The load failed."}${error instanceof Error ? ` (${error.message})` : ""}`,
      ),
    );
  }
}

function assetCard(asset: Asset): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "asset";
  button.title = asset.note;

  const img = document.createElement("img");
  img.src = asset.thumb;
  img.alt = "";
  img.loading = "lazy";
  img.width = 128;
  img.height = 128;

  const name = document.createElement("span");
  name.className = "asset-name";
  name.textContent = asset.name;

  const kind = document.createElement("span");
  kind.className = "asset-kind";
  kind.textContent = asset.kind;

  button.append(img, name, kind);
  button.addEventListener("click", () => {
    for (const other of shelfHost.querySelectorAll(".asset")) other.classList.remove("active");
    button.classList.add("active");
    void show(asset.name, `nvidia simready · ${asset.kind}`, asset.url);
  });
  return button;
}

for (const asset of SHELF) shelfHost.append(assetCard(asset));

/* ---- files from the machine -------------------------------------------------
 * Nothing leaves the page: the file (or folder) is handed to the loader as a Map
 * of path to Blob, and its references resolve against each other rather than
 * against the network.
 */

function isUsd(path: string): boolean {
  const lower = path.toLowerCase();
  return USD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * The root layer is the USD file nearest the top of the dropped tree. Payloads
 * and configurations sit deeper by construction, so depth alone finds the file
 * the author meant you to open.
 */
function findRoot(paths: readonly string[]): string | undefined {
  const candidates = paths.filter(isUsd);
  if (candidates.length === 0) return undefined;
  const depth = (path: string) => path.split("/").length;
  return [...candidates].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b))[0];
}

async function walkEntry(entry: FileSystemEntry, path: string, out: Map<string, File>): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    out.set(path, file);
    return;
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length === 0) break;
    for (const child of batch) await walkEntry(child, `${path}/${child.name}`, out);
  }
}

async function fromDataTransfer(transfer: DataTransfer): Promise<Map<string, File>> {
  const out = new Map<string, File>();
  const entries: FileSystemEntry[] = [];
  for (const item of transfer.items) {
    const entry = item.webkitGetAsEntry();
    if (entry) entries.push(entry);
  }
  if (entries.length === 0) {
    for (const file of transfer.files) out.set(file.name, file);
    return out;
  }
  for (const entry of entries) await walkEntry(entry, entry.name, out);
  return out;
}

function fromFileList(list: FileList, rooted: boolean): Map<string, File> {
  const out = new Map<string, File>();
  for (const file of list) {
    const path = rooted && file.webkitRelativePath ? file.webkitRelativePath : file.name;
    out.set(path, file);
  }
  return out;
}

async function openFiles(files: Map<string, File>): Promise<void> {
  const root = findRoot([...files.keys()]);
  if (!root) {
    setReport(renderPlaceholder("Not a USD file", "Stage reads .usd, .usda, .usdc and .usdz."));
    return;
  }
  const name = root.split("/").pop() ?? root;
  const origin = files.size > 1 ? `${count(files.size)} local files` : "from this machine";
  await show(name, origin, root, files);
}

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("hot");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("hot"));
dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("hot");
  if (!event.dataTransfer) return;
  void fromDataTransfer(event.dataTransfer).then(openFiles);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files?.length) void openFiles(fromFileList(fileInput.files, false));
  fileInput.value = "";
});
dirInput.addEventListener("change", () => {
  if (dirInput.files?.length) void openFiles(fromFileList(dirInput.files, true));
  dirInput.value = "";
});
document.querySelector("#open-file")?.addEventListener("click", () => fileInput.click());
document.querySelector("#open-dir")?.addEventListener("click", () => dirInput.click());

/* -------------------------------------------------------------------------- */

/* The report panel scrolls, and on a platform with overlay scrollbars there is no
 * visible cue that it does. Fade the last line until the reader reaches the end. */
function syncReportFold(): void {
  const more = report.scrollHeight - report.clientHeight - report.scrollTop > 8;
  report.classList.toggle("overflowing", more);
}
report.addEventListener("scroll", syncReportFold, { passive: true });
new ResizeObserver(syncReportFold).observe(report);
const observer = new MutationObserver(syncReportFold);
observer.observe(report, { childList: true, subtree: true });
syncReportFold();

window.addEventListener("resize", () => viewer?.requestRender());

// Only if the viewer came up. Without WebGL the report already carries the reason,
// and this line would replace it with a cheerful lie about being ready.
if (viewer) {
  setReport(
    renderPlaceholder(
      "Nothing on stage",
      "Pick an asset from the shelf, drop a USD file on the viewport, or open a folder. A USD stage is usually a folder, not a file.",
    ),
  );
}
