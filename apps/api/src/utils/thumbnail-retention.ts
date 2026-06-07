import type { PrismaClient } from '@hellodownloader/database';
import * as path from 'path';
import { getThumbnailRetentionCount, removePathRecursive } from './fs-utils';

type PrismaLike = Pick<PrismaClient, 'thumbnail'>;

export type ThumbnailStoredPaths = {
  exportPath: string | null;
  originalPath: string | null;
  resizedPath: string | null;
};

export async function pruneUserThumbnails(
  prisma: PrismaLike,
  storagePath: string,
  userId: string,
  deleteStored?: (row: ThumbnailStoredPaths) => Promise<void>,
): Promise<number> {
  const maxKeep = getThumbnailRetentionCount();
  const rows = await prisma.thumbnail.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (rows.length <= maxKeep) return 0;

  const excess = rows.slice(maxKeep);
  for (const row of excess) {
    const full = await prisma.thumbnail.findUnique({
      where: { id: row.id },
      select: { exportPath: true, originalPath: true, resizedPath: true },
    });
    if (full && deleteStored) {
      await deleteStored(full);
    }
    removePathRecursive(path.join(storagePath, 'thumbnails', userId, row.id));
    await prisma.thumbnail.delete({ where: { id: row.id } });
  }

  return excess.length;
}
