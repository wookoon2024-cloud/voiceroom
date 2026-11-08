import floor0 from "@/public/plaza/floor-rest-v6/cute_male_v2/manifest.json";
import floor1 from "@/public/plaza/floor-rest-v6/strong_male_v2/manifest.json";
import floor2 from "@/public/plaza/floor-rest-v6/blond_tan_male/manifest.json";
import floor3 from "@/public/plaza/floor-rest-v6/soft_male/manifest.json";
import floor4 from "@/public/plaza/floor-rest-v6/crossdress_male/manifest.json";
import floor5 from "@/public/plaza/floor-rest-v6/pride_male/manifest.json";
import floor6 from "@/public/plaza/floor-rest-v6/bear_male/manifest.json";
import rest0 from "@/public/plaza/rest-v6/cute_male_v2/manifest.json";
import rest1 from "@/public/plaza/rest-v6/strong_male_v2/manifest.json";
import rest2 from "@/public/plaza/rest-v6/blond_tan_male/manifest.json";
import rest3 from "@/public/plaza/rest-v6/soft_male/manifest.json";
import rest4 from "@/public/plaza/rest-v6/crossdress_male/manifest.json";
import rest5 from "@/public/plaza/rest-v6/pride_male/manifest.json";
import rest6 from "@/public/plaza/rest-v6/bear_male/manifest.json";
import cute from "@/public/plaza/v2/cute_male_v2/manifest.json";
import strong from "@/public/plaza/v2/strong_male_v2/manifest.json";
import cuteSocial from "@/public/plaza/social-v4/cute_male_v2/manifest.json";
import strongSocial from "@/public/plaza/social-v4/strong_male_v2/manifest.json";
import blond from "@/public/plaza/roster-v5/blond_tan_male/manifest.json";
import soft from "@/public/plaza/roster-v5/soft_male/manifest.json";
import crossdress from "@/public/plaza/roster-v5/crossdress_male/manifest.json";
import pride from "@/public/plaza/roster-v5/pride_male/manifest.json";
import bear from "@/public/plaza/roster-v5/bear_male/manifest.json";
import type { SpriteCharacterV2, SpriteManifestV2 } from "./sprite-v2";

const all: Record<SpriteCharacterV2, SpriteManifestV2> = {
  cute_male_v2: cute, strong_male_v2: strong, blond_tan_male: blond,
  soft_male: soft, crossdress_male: crossdress, pride_male: pride, bear_male: bear,
};
const rests: Record<SpriteCharacterV2, SpriteManifestV2> = {cute_male_v2: rest0, strong_male_v2: rest1, blond_tan_male: rest2, soft_male: rest3, crossdress_male: rest4, pride_male: rest5, bear_male: rest6};
const floors: Record<SpriteCharacterV2, SpriteManifestV2> = {cute_male_v2: floor0, strong_male_v2: floor1, blond_tan_male: floor2, soft_male: floor3, crossdress_male: floor4, pride_male: floor5, bear_male: floor6};
export function characterManifest(id: SpriteCharacterV2, extraSocial = false, rest: boolean | "floor" = false): SpriteManifestV2 {
  if (rest === "floor") return floors[id];
  if (rest) return rests[id];
  if (extraSocial && id === "cute_male_v2") return cuteSocial;
  if (extraSocial && id === "strong_male_v2") return strongSocial;
  return all[id];
}
