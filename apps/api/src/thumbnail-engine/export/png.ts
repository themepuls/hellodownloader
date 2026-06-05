import sharp from 'sharp';

export async function exportPng(inputPath: string, outputPath: string): Promise<string> {
  await sharp(inputPath).png({ compressionLevel: 8 }).toFile(outputPath);
  return outputPath;
}
