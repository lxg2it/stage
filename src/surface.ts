/**
 * What the returned scene is actually made of.
 *
 * The loader's report describes the FILE: how many materials it composed, which
 * kinds they were, how many textures it fetched. None of that says whether any
 * of it reached a surface — and a surface with no map looks exactly like a file
 * that had no texture to give it.
 *
 * So the scene graph the loader hands back is inspected directly. This is the
 * only place on the page where the claim comes from the thing being drawn
 * rather than from the account of loading it.
 */
import type { Material, Object3D } from "three";

export interface SurfaceAudit {
  /** Meshes that carry at least one material. */
  readonly surfaces: number;
  /** Distinct material instances across every surface. */
  readonly materials: number;
  readonly withBaseColorMap: number;
  readonly withNormalMap: number;
  /** Roughness or metalness: in a SimReady asset these are the same packed map. */
  readonly withOrmMap: number;
  /** Materials carrying no maps at all: a flat factor, whatever the file asked for. */
  readonly flat: number;
  /**
   * The loader streamed textures and not one of them landed on a surface.
   *
   * Only ever true when the count is known AND positive. An unknown count is
   * not evidence of absence, and this flag is a claim about absence.
   */
  readonly texturesOffSurface: boolean;
}

/** A material's map input, read without assuming which material class it is. */
function mapOf(material: Material, key: string): boolean {
  return Boolean((material as unknown as Record<string, unknown>)[key]);
}

interface MeshLike {
  readonly isMesh?: boolean;
  readonly material?: Material | Material[];
}

/** Every material on a mesh, once the array form of `material` is flattened. */
function materialsOf(mesh: MeshLike): Material[] {
  const material = mesh.material;
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
}

/**
 * @param root the group the loader returned for this stage
 * @param texturesStreamed how many textures settled, or `undefined` if that is
 *   not yet known — the flag is withheld rather than guessed
 */
export function auditSurface(root: Object3D, texturesStreamed: number | undefined): SurfaceAudit {
  let surfaces = 0;
  const seen = new Set<Material>();

  root.traverse((object) => {
    const mesh = object as unknown as MeshLike;
    if (!mesh.isMesh) return;
    const materials = materialsOf(mesh);
    // Three gives every mesh a material, so an empty list means a caller
    // cleared it by hand. There is nothing to audit on such a mesh and
    // nothing to report: it is not a state the viewer produces.
    if (materials.length === 0) return;
    surfaces += 1;
    for (const material of materials) seen.add(material);
  });

  let withBaseColorMap = 0;
  let withNormalMap = 0;
  let withOrmMap = 0;
  let flat = 0;

  for (const material of seen) {
    const base = mapOf(material, "map");
    const normal = mapOf(material, "normalMap");
    const orm = mapOf(material, "roughnessMap") || mapOf(material, "metalnessMap");
    if (base) withBaseColorMap += 1;
    if (normal) withNormalMap += 1;
    if (orm) withOrmMap += 1;
    if (!base && !normal && !orm) flat += 1;
  }

  const streamed = texturesStreamed ?? 0;
  // Deliberately the strict form: NOT ONE map on any surface. A file can
  // stream textures and legitimately use none of them as a base colour (an
  // ORM-only asset is a real shape), so "no base colour map" alone is not a
  // contradiction and stating it as one would be the page crying wolf. What
  // cannot be explained is textures arriving and landing nowhere at all.
  const mapsLanded = withBaseColorMap + withNormalMap + withOrmMap > 0;
  return {
    surfaces,
    materials: seen.size,
    withBaseColorMap,
    withNormalMap,
    withOrmMap,
    flat,
    texturesOffSurface: streamed > 0 && seen.size > 0 && !mapsLanded,
  };
}
