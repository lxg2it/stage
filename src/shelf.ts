/**
 * The shelf: a small, deliberately varied sample of NVIDIA's SimReady library,
 * read live from the Hugging Face Hub.
 *
 * Nothing here is bundled with the site — the browser fetches the root layer
 * from the Hub and follows its references from there, which is the whole point:
 * the layer count and byte total in the report are of the files that were
 * actually pulled, not of a copy we made.
 *
 * `pool` is the load cost of the geometry-only pass (every file except the
 * texture sets), measured from the repo tree. It sets the expectation on the
 * card; the report gives the real numbers for whatever was fetched.
 */

const NVIDIA = "https://huggingface.co/datasets/nvidia/simready-assets/resolve/main";
const ROBOTIQ = "https://huggingface.co/datasets/Robotiq-Official/simready-assets/resolve/main";

export interface Asset {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly url: string;
  readonly thumb: string;
  readonly note: string;
}

function nvidia(id: string, name: string, kind: string, note: string): Asset {
  const dir = `${id}/simready_usd`;
  return {
    id,
    name,
    kind,
    note,
    url: `${NVIDIA}/${dir}/sm_${id}_01.usd`,
    thumb: `${NVIDIA}/${dir}/.thumbs/256x256/sm_${id}_01.usd.png`,
  };
}

export const SHELF: readonly Asset[] = [
  nvidia(
    "accessory_eyeglasses_a01",
    "Eyeglasses",
    "accessory",
    "One of the smallest assets in the library, and still a composition.",
  ),
  nvidia(
    "dishware_mug_coffee_a01",
    "Coffee mug",
    "dishware",
    "Three textures, five physics payloads, one mug.",
  ),
  nvidia(
    "bin_waste_a01",
    "Wheelie bin",
    "street furniture",
    "Street furniture that swaps its own physics payload per simulator.",
  ),
  nvidia(
    "chair_office_amf_black_a01",
    "Office chair",
    "furniture",
    "A chair with a mass model and collision shapes authored separately.",
  ),
  nvidia(
    "fireProtection_extinguisher_portable_a01",
    "Fire extinguisher",
    "safety",
    "Small, bright, and every part of it a separate payload.",
  ),
  nvidia(
    "detector_camera_a01",
    "Security camera",
    "sensor",
    "A fixture: the kind of asset that gets instanced a hundred times in a scene.",
  ),
  nvidia(
    "appliance_refrigerator_a01",
    "Refrigerator",
    "appliance",
    "21 MB of geometry, and nearly a gigabyte of texture it will not fetch here.",
  ),
  nvidia(
    "anesthesia_machine_a01",
    "Anaesthesia machine",
    "medical",
    "A hospital-grade asset: the largest composition on this shelf.",
  ),
  {
    id: "Robotiq_2F_85",
    name: "Robotiq 2F-85",
    kind: "robot gripper",
    note: "A different author, a different structure: parts, payloads, configurations.",
    url: `${ROBOTIQ}/Robotiq_2F_85/simready_usd/Robotiq_2F_85.usda`,
    thumb: `${ROBOTIQ}/Robotiq_2F_85/simready_usd/.thumbs/256x256/Robotiq_2F_85.usda.png`,
  },
];
