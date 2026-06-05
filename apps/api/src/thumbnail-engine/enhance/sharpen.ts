import sharp from 'sharp';

export async function sharpenImage(
  inputPath: string,
  outputPath: string,
  sigma = 1.2,
): Promise<string> {
  await sharp(inputPath)
    .sharpen({ sigma })
    .jpeg({ quality: 93 })
    .toFile(outputPath);
  return outputPath;
}
