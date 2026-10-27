import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from "three";
import { auditSurface } from "./surface.js";

/** A material with whichever of the three map inputs a case needs. */
function material(maps: { base?: boolean; normal?: boolean; orm?: boolean }): MeshStandardMaterial {
  const m = new MeshStandardMaterial();
  if (maps.base) m.map = new Texture();
  if (maps.normal) m.normalMap = new Texture();
  if (maps.orm) m.roughnessMap = new Texture();
  return m;
}

function mesh(m: MeshStandardMaterial | MeshStandardMaterial[]): Mesh {
  return new Mesh(new BoxGeometry(1, 1, 1), m);
}

describe("auditSurface", () => {
  it("flags textures that landed on no surface at all", () => {
    const root = new Group();
    root.add(mesh(material({})));
    const audit = auditSurface(root, 2);
    expect(audit.surfaces).toBe(1);
    expect(audit.materials).toBe(1);
    expect(audit.withBaseColorMap).toBe(0);
    expect(audit.flat).toBe(1);
    expect(audit.texturesOffSurface).toBe(true);
  });

  // The control. Without this the flag would pass the test above by always
  // being true, which is the failure mode a one-armed test cannot see.
  it("clears the flag when the map reached the surface", () => {
    const root = new Group();
    root.add(mesh(material({ base: true, orm: true })));
    const audit = auditSurface(root, 2);
    expect(audit.withBaseColorMap).toBe(1);
    expect(audit.withOrmMap).toBe(1);
    expect(audit.flat).toBe(0);
    expect(audit.texturesOffSurface).toBe(false);
  });

  it("counts an ORM map as landing, so an ORM-only asset is not called a contradiction", () => {
    const root = new Group();
    root.add(mesh(material({ orm: true })));
    const audit = auditSurface(root, 1);
    expect(audit.withBaseColorMap).toBe(0);
    expect(audit.texturesOffSurface).toBe(false);
  });

  it("withholds the flag while the texture count is not yet known", () => {
    const root = new Group();
    root.add(mesh(material({})));
    const audit = auditSurface(root, undefined);
    expect(audit.flat).toBe(1);
    expect(audit.texturesOffSurface).toBe(false);
  });

  it("withholds the flag when nothing was streamed to begin with", () => {
    const root = new Group();
    root.add(mesh(material({})));
    expect(auditSurface(root, 0).texturesOffSurface).toBe(false);
  });

  it("counts each material of an array material, and de-duplicates shared instances", () => {
    const shared = material({ base: true });
    const other = material({});
    const root = new Group();
    root.add(mesh([shared, other]));
    root.add(mesh(shared));
    const audit = auditSurface(root, 3);
    expect(audit.surfaces).toBe(2);
    expect(audit.materials).toBe(2);
    expect(audit.withBaseColorMap).toBe(1);
    expect(audit.flat).toBe(1);
  });

  it("walks nested groups", () => {
    const inner = new Group();
    inner.add(mesh(material({ base: true })));
    const root = new Group();
    root.add(inner);
    const audit = auditSurface(root, 1);
    expect(audit.surfaces).toBe(1);
    expect(audit.materials).toBe(1);
    expect(audit.texturesOffSurface).toBe(false);
  });

  it("reports an empty stage as empty rather than as a contradiction", () => {
    const audit = auditSurface(new Group(), 4);
    expect(audit).toMatchObject({ surfaces: 0, materials: 0, flat: 0, texturesOffSurface: false });
  });
});
