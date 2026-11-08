// Carte che hanno già l'illustrazione definitiva (assets/milano/art/<valore>.webp, 640x360).
// Le altre usano ancora le illustrazioni vettoriali di art.js.
export const ART_IMAGES = new Set([2, 3, 5, 6, 8, 9, 11, 15, 18, 24]);
export const artImage = value => (ART_IMAGES.has(value) ? new URL(`../../assets/milano/art/${value}.webp`, import.meta.url).href : null);
