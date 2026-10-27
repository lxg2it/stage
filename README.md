# Stage

A browser viewer for OpenUSD that reports what it could not show.

Every USD viewer shows you *something*. A subtree that failed to compose, a material that
fell back to grey, a payload that never arrived, a mesh the loader refused: all of those
render as a plausible, quietly wrong picture. Stage draws the stage with
[`@huggingface/usd-web-viewer`](https://www.npmjs.com/package/@huggingface/usd-web-viewer)
and puts the loader's own account of the load beside it: prim counts, mesh and triangle
counts, triangle budget warnings, material kinds actually used, layer fetches, timings,
WebAssembly memory, and a fidelity verdict derived from those numbers rather than guessed.

Nothing is uploaded. Parsing and texture decode run in a Web Worker on the machine that
opened the page.

## What is on the shelf

NVIDIA's [SimReady](https://huggingface.co/datasets/nvidia/simready-assets) set on Hugging
Face: 2,576 asset packages, fetched directly from the Hub on demand, cross-origin, no proxy.
SimReady assets are the interesting case for this tool because each one is a small scene
graph stub over a separate geometry payload, with textures, MaterialX, and physics variants
as sibling files. That is a composition tree a browser can partly fail at, which is exactly
what the report is for.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # 28 tests: the fidelity classifier and the formatters
npm run build    # typecheck + production build into dist/
```

The build is a static tree. Serve `dist/` from anywhere; there is no backend.

## Two modes of input

- **Shelf**: click an asset. Layers are fetched from `huggingface.co` over HTTPS.
- **Local**: drop a `.usd`, `.usda`, `.usdc` or `.usdz` file, or open a folder. A USD stage
  is usually a folder, not a file, so the folder picker hands the whole tree to the loader
  as a path-to-blob map and its internal references resolve against each other. Nothing
  leaves the machine in this mode.

## Licence and attribution

The site code is MIT. The assets are not mine and are not covered by that: NVIDIA SimReady
assets are **CC BY 4.0**, as stated in each package's `com.nvidia.simready.packaging.json`
and `.metadata/LICENSE.txt`. Attribution is displayed next to the viewport. If you fork
this to show other assets, keep the attribution for whatever you point it at.

## Deploy

    tools/deploy.sh

Builds, rsyncs `dist/` to `/var/www/sim` on the AU box, then fetches the live index and
every hashed bundle it references. Served by nginx from `/etc/nginx/conf.d/sim.conf`;
`index.html` is `no-cache` because it names the current build's bundles, and everything
under `/assets/` is immutable because the filenames carry their hashes.
