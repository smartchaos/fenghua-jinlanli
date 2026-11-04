import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
copyFileSync(resolve(root, 'app/dist/index.html'), resolve(root, 'model.html'));
mkdirSync(resolve(root, 'app/dist'), { recursive: true });
console.log('model.html synced to repo root');
