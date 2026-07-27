import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('apps/extension/.output');
const files = await readdir(output);
const zip = files.find((file) => file.endsWith('-chrome.zip'));

if (!zip) throw new Error('Chrome ZIP was not produced.');

const destination = path.resolve('apps/site/public/downloads/anonymail-beta.zip');
await mkdir(path.dirname(destination), { recursive: true });
await copyFile(path.join(output, zip), destination);
console.log(`Copied ${zip} to ${destination}`);
