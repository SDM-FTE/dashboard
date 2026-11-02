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
  'index.html', '404.html', 'admin/index.html', 'admin/bkd.html',
  'assets/css/styles.css', 'assets/css/admin-bkd.css', 'assets/css/admin-jad.css',
  'assets/js/dashboard.js', 'assets/js/admin-bkd.js',
  'assets/js/bkd-import.js', 'assets/js/bkd-xlsx.js',
  'assets/js/admin-session.js', 'assets/js/admin-jad.js',
  'assets/data/dashboard-data.json', 'assets/data/jad-progress.json',
];
// Refuse to republish a retired personnel export.
const master = JSON.parse(await fs.readFile(path.join(root, 'assets/data/dashboard-data.json'), 'utf8'));
if (Object.hasOwn(master, 'fte') || Object.keys(master.meta || {}).some(key => /^fte/i.test(key))) {
  throw new Error('Retired personnel data must be removed before publishing.');
}
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
