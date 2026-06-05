import sharp from 'sharp';

export async function exportWebp(inputPath: string, outputPath: string, quality = 88): Promise<string> {
  await sharp(inputPath).webp({ quality }).toFile(outputPath);
  return outputPath;
}
