const MAX_SOURCE_BYTES = 1 * 1024 * 1024;
const AVATAR_SIZE = 512;
const JPEG_QUALITY = 0.92;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Use a JPG or PNG image.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Image must be 1 MB or smaller.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not process image.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const scale = Math.max(
      AVATAR_SIZE / image.width,
      AVATAR_SIZE / image.height,
    );
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const dx = (AVATAR_SIZE - drawWidth) / 2;
    const dy = (AVATAR_SIZE - drawHeight) / 2;
    context.drawImage(image, dx, dy, drawWidth, drawHeight);

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read image."));
    image.src = src;
  });
}
