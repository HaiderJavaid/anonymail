import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('apps/extension/.output');
const extensionPackage = JSON.parse(await readFile('apps/extension/package.json', 'utf8'));
const files = await readdir(output);
const zip = files.find((file) => file.endsWith(`-${extensionPackage.version}-chrome.zip`));

if (!zip) throw new Error(`Chrome ZIP for v${extensionPackage.version} was not produced.`);

const destination = path.resolve('apps/site/public/downloads/anonymail-beta.zip');
await mkdir(path.dirname(destination), { recursive: true });
await copyFile(path.join(output, zip), destination);
console.log(`Copied ${zip} to ${destination}`);
