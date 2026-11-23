// Reads the dumped DOM and writes public/skies/<id>.webp and public/skies/thumbs/<id>.webp.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [domPath, outDir] = process.argv.slice(2);
const dom = readFileSync(domPath, 'utf8');
const pattern = /<pre id="([a-z-]+)">([^<]+)<\/pre>/g;
mkdirSync(join(outDir, 'thumbs'), { recursive: true });
let total = 0;
for (const [, id, body] of dom.matchAll(pattern)) {
  const [full, thumb] = body.trim().split('\n');
  for (const [url, path] of [
    [full, join(outDir, `${id}.webp`)],
    [thumb, join(outDir, 'thumbs', `${id}.webp`)],
  ]) {
    if (!url.startsWith('data:image/webp;base64,')) {
      throw new Error(`${id}: not WebP`);
    }
    const bytes = Buffer.from(url.slice('data:image/webp;base64,'.length), 'base64');
    writeFileSync(path, bytes);
    total += bytes.length;
    console.log(path, bytes.length);
  }
}
console.log('total', total);
