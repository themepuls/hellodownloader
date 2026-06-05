import { Injectable } from '@nestjs/common';
import * as archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ZipService {
  async createZip(files: string[], outputPath: string): Promise<string> {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(outputPath));
      archive.on('error', reject);

      archive.pipe(output);
      for (const file of files) {
        if (fs.existsSync(file)) {
          archive.file(file, { name: path.basename(file) });
        }
      }
      archive.finalize();
    });
  }
}
