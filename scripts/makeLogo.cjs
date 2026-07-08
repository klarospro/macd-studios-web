// Genera assets de logo Atlas recoloreados (teal, fondo transparente) desde el JPG dorado.
// Usa la luminancia como canal alfa → el negro se vuelve transparente y la marca queda monocroma.
const sharp = require("sharp");
const path = require("path");

const SRC = path.resolve(__dirname, "../ATLAS-AI/atlas.logo.jpg.png");
const OUT = path.resolve(__dirname, "../public");

// Recolorea un buffer (gold-on-black) a color plano `hex` con alfa = luminancia.
async function tint(buf, hex, out, { mul = 1.6, off = -22 } = {}) {
  const alpha = await sharp(buf).toColourspace("b-w").linear(mul, off).toBuffer();
  const meta = await sharp(buf).metadata();
  const solid = await sharp({
    create: { width: meta.width, height: meta.height, channels: 3, background: hex },
  }).png().toBuffer();
  await sharp(solid).joinChannel(alpha).png().toFile(out);
  return meta;
}

(async () => {
  // 1) Recorta el borde negro → lockup ajustado.
  const trimmed = await sharp(SRC).trim({ threshold: 18 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  console.log(`Lockup recortado: ${meta.width}x${meta.height}`);

  const TEAL = "#2dd4bf";       // acento de marca
  const TEALSOFT = "#7fe9dd";   // variante clara para el nav

  // 2) Lockup completo (footer) en teal.
  await tint(trimmed, TEAL, path.join(OUT, "atlas-logo.png"));
  await tint(trimmed, TEALSOFT, path.join(OUT, "atlas-logo-soft.png"));

  // 3) Emblema solo (nav): región cuadrada izquierda del lockup.
  const emW = Math.min(Math.round(meta.height * 1.12), meta.width);
  const emblem = await sharp(trimmed)
    .extract({ left: 0, top: 0, width: emW, height: meta.height })
    .trim({ threshold: 18 })
    .png()
    .toBuffer();
  const em = await sharp(emblem).metadata();
  console.log(`Emblema: ${em.width}x${em.height}`);
  await tint(emblem, TEAL, path.join(OUT, "atlas-mark.png"));
  await tint(emblem, TEALSOFT, path.join(OUT, "atlas-mark-soft.png"));

  console.log("✅ Assets generados en /public: atlas-logo.png, atlas-logo-soft.png, atlas-mark.png, atlas-mark-soft.png");
})();
