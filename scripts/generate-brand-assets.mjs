/**
 * Generates public/og-image.png from lerno.webp (wordmark on light bg),
 * and apple-touch-icon.png + favicon.ico from lerno-cap-dark.webp (cap on dark bg).
 * Run: npm run generate:brand-assets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
/** Marketing OG — dark text wordmark on light surface. */
const wordmarkPath = path.join(publicDir, "lerno.webp");
/** Tab / home-screen icon — white-stroke cap (for dark backgrounds). */
const capPath = path.join(publicDir, "lerno-cap-dark.webp");

const W_OG = 1200;
const H_OG = 630;
// --base-100 from globals.css (#F8FAFC)
const BG_LIGHT = { r: 248, g: 250, b: 252, alpha: 1 };
// --primary-600 (#003159) so the cap reads clearly at 16–-2px
const BG_ICON = { r: 0, g: 49, b: 89, alpha: 1 };

async function main() {
  const maxLogoW = Math.round(W_OG * 0.88);
  const logoBuf = await sharp(wordmarkPath)
    .resize({
      width: maxLogoW,
      height: Math.round(H_OG * 0.55),
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  const lg = await sharp(logoBuf).metadata();
  const lw = lg.width ?? 800;
  const lh = lg.height ?? 280;

  const ogPath = path.join(publicDir, "og-image.png");
  await sharp({
    create: {
      width: W_OG,
      height: H_OG,
      channels: 4,
      background: BG_LIGHT,
    },
  })
    .composite([
      {
        input: logoBuf,
        left: Math.round((W_OG - lw) / 2),
        top: Math.round((H_OG - lh) / 2),
      },
    ])
    .png()
    .toFile(ogPath);
  console.log("Wrote", ogPath);

  const applePath = path.join(publicDir, "apple-touch-icon.png");
  await sharp(capPath)
    .resize(180, 180, {
      fit: "contain",
      background: BG_ICON,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toFile(applePath);
  console.log("Wrote", applePath);

  const sizes = [32, 16];
  const buffers = await Promise.all(
    sizes.map((s) =>
      sharp(capPath)
        .resize(s, s, {
          fit: "contain",
          background: BG_ICON,
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer(),
    ),
  );
  const ico = await pngToIco(buffers);
  const icoPath = path.join(publicDir, "favicon.ico");
  fs.writeFileSync(icoPath, ico);
  console.log("Wrote", icoPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
