'use client';

const MAX_BYTES = 500 * 1024;
const MAX_DIMENSION = 1600;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Phone photos are 3–12 MB; over a weak workshop signal that's the
// difference between a 2 s and a 60 s upload. Downscale and re-encode as
// JPEG (readable by every browser and by the AI vision call) until the file
// is under 500 KB. Anything the browser can't decode (PDF, some HEIC) is
// returned untouched rather than blocking the upload.
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const fitsAlready = file.size <= MAX_BYTES && Math.max(bitmap.width, bitmap.height) <= MAX_DIMENSION;
  if (fitsAlready) {
    bitmap.close();
    return file;
  }

  let scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  let result: Blob | null = null;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.7, 0.58]) {
      result = await canvasToBlob(canvas, quality);
      if (result && result.size <= MAX_BYTES) break;
    }
    if (result && result.size <= MAX_BYTES) break;
    scale *= 0.8;
  }
  bitmap.close();

  if (!result || result.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, '') || 'foto';
  return new File([result], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
