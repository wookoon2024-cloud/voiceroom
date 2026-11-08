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
export function characterManifest(id: SpriteCharacterV2, extraSocial = false): SpriteManifestV2 {
  if (extraSocial && id === "cute_male_v2") return cuteSocial;
  if (extraSocial && id === "strong_male_v2") return strongSocial;
  return all[id];
}
