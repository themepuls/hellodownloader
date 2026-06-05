import sharp from 'sharp';

export interface CompressOptions {
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export async function compressImage(
  inputPath: string,
  outputPath: string,
  opts: CompressOptions = {},
): Promise<string> {
  const quality = opts.quality ?? 85;
  const format = opts.format ?? 'jpeg';

  const pipeline = sharp(inputPath);

  if (format === 'png') {
    await pipeline.png({ compressionLevel: 8 }).toFile(outputPath);
  } else if (format === 'webp') {
    await pipeline.webp({ quality }).toFile(outputPath);
  } else {
    await pipeline.jpeg({ quality, mozjpeg: true }).toFile(outputPath);
  }

  return outputPath;
}
