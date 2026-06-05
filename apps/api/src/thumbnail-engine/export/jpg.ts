import sharp from 'sharp';

export async function exportJpg(inputPath: string, outputPath: string, quality = 92): Promise<string> {
  await sharp(inputPath).jpeg({ quality, mozjpeg: true }).toFile(outputPath);
  return outputPath;
}
