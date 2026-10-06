import { open, realpath } from 'node:fs/promises';
import { relative, isAbsolute, resolve, extname } from 'node:path';
export type ImageValidator = (bytes: Buffer) => boolean;
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
export function isContained(root: string, target: string): boolean {
  const path = relative(root, target);
  return path !== '' && !isAbsolute(path) && path !== '..' && !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`);
}
export async function resolveLocalFile(root: string, path: string): Promise<string> {
  const target = await realpath(resolve(root, path));
  if (!isContained(root, target)) throw new Error('Asset escapes its character directory');
  return target;
}
export async function readBoundedFile(path: string, limit: number): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size <= 0 || stat.size > limit) throw new Error(`File must be nonempty and at most ${limit} bytes`);
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > limit) throw new Error('File exceeds size limit');
    return buffer.subarray(0, length);
  } finally { await handle.close(); }
}
export async function readImage(root: string, asset: string, validateImage: ImageValidator): Promise<{ path: string; dataUrl: string }> {
  const path = await resolveLocalFile(root, asset);
  const bytes = await readBoundedFile(path, MAX_ASSET_BYTES);
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const extension = extname(asset).toLowerCase();
  if (!((extension === '.png' && png) || (['.jpg', '.jpeg'].includes(extension) && jpeg)) || !validateImage(bytes)) throw new Error('Invalid or undecodable PNG/JPEG image');
  return { path, dataUrl: `data:image/${png ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}` };
}
