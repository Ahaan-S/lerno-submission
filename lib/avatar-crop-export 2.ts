import type { Area } from "react-easy-crop";

export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      image.crossOrigin = "anonymous";
    }
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => reject(e));
    image.src = url;
  });
}

/** Renders `pixelCrop` from `imageSrc` into a JPEG blob (square crop from react-easy-crop pixels). */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  quality = 0.92
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  canvas.width = Math.max(1, Math.round(pixelCrop.width));
  canvas.height = Math.max(1, Math.round(pixelCrop.height));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export image"));
      },
      "image/jpeg",
      quality
    );
  });
}
