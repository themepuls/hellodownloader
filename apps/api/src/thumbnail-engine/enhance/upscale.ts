import sharp from 'sharp';

/** Lanczos upscale pipeline for upload-ready export quality. */
export async function upscale(inputPath: string, outputPath: string, factor = 2): Promise<string> {
  const meta = await sharp(inputPath).metadata();
  const w = (meta.width ?? 1280) * factor;
  const h = (meta.height ?? 720) * factor;

  await sharp(inputPath)
    .resize(w, h, { kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 1 })
    .jpeg({ quality: 95, mozjpeg: true })
    .toFile(outputPath);

  return outputPath;
}
