import type { PhotoKey } from './photos';

/** Photographic animal materials verified in docs/CATEGORY-TEXTURES.json. */
export const CATEGORY_TEXTURES: Record<string, PhotoKey> = {
  mammals: 'textureFur',
  birds: 'textureFeathers',
  fish: 'textureFishScales',
  reptiles: 'textureReptileScales',
  amphibians: 'textureAmphibianSkin',
  insects: 'textureInsectWing',
};
