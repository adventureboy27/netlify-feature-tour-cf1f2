// Turn an uploaded image file into a small, square, embeddable photo.
//
// Runs entirely in the browser: decode the file, draw it to an off-screen
// canvas cropped to a centred square, downscale, and export as compressed
// WebP. Nothing here touches the network — same as the rest of the game.

const OUTPUT_SIZE = 96;
const WEBP_QUALITY = 0.85;

export function resizeToDataUrl(file: File, size = OUTPUT_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is not available in this browser.'));
        return;
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/webp', WEBP_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}
