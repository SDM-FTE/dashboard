import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Publish an explicit set of public files. Server code, templates and secrets
// must never enter the directory that Netlify serves as static content.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publish = path.join(root, 'dist');
if (path.dirname(publish) !== root || path.basename(publish) !== 'dist') {
  throw new Error('Unexpected publish directory');
}
const files = [
  'index.html', '404.html', 'admin/index.html', 'admin/bkd.html', 'antrian-jad/index.html',
  'assets/images/fte-official.png', 'assets/css/branding.css',
  'assets/css/styles.css', 'assets/css/admin-bkd.css', 'assets/css/admin-jad.css',
  'assets/css/jad-queue.css', 'assets/css/admin-queue.css',
  'assets/js/dashboard.js', 'assets/js/admin-bkd.js',
  'assets/js/bkd-import.js', 'assets/js/bkd-xlsx.js',
  'assets/js/admin-session.js', 'assets/js/admin-jad.js',
  'assets/js/jad-queue.js', 'assets/js/admin-queue.js',
  'assets/data/dashboard-data.json', 'assets/data/jad-progress.json',
];
const sources = await Promise.all(files.map(async file => {
  const source = path.join(root, file);
  if (!(await fs.lstat(source)).isFile()) throw new Error('Expected regular public file: ' + file);
  return {file, bytes: await fs.readFile(source)};
}));
await fs.rm(publish, {recursive: true, force: true});
for (const {file, bytes} of sources) {
  const destination = path.join(publish, file);
  await fs.mkdir(path.dirname(destination), {recursive: true});
  await fs.writeFile(destination, bytes);
}
console.log('Public dashboard built. Admin tools require server verification.');
