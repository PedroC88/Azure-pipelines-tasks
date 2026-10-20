// Usage: node bump-version.js <extensionDir> <releasedVersion>
// Bumps the minor version (x.y.z -> x.(y+1).0) of an extension after it was released.
// Skips when the repo already holds a version newer than the released one.
const fs = require('fs');
const path = require('path');

const [dir, released] = process.argv.slice(2);
if (!dir || !/^\d+\.\d+\.\d+$/.test(released || '')) {
  console.error('Usage: node bump-version.js <extensionDir> <releasedVersion>');
  process.exit(1);
}

const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const write = (f, c) => fs.writeFileSync(path.join(dir, f), c);
const parse = v => v.split('.').map(Number);
const isNewer = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
};

const current = JSON.parse(read('vss-extension.json')).version;
if (isNewer(current, released)) {
  console.log(`Repo version ${current} is already newer than released ${released} - nothing to bump.`);
  process.exit(0);
}

const [major, minor] = parse(released);
const next = `${major}.${minor + 1}.0`;

write('vss-extension.json', read('vss-extension.json').replace(/("version":\s*")[^"]+(")/, `$1${next}$2`));

write('task.json', read('task.json')
  .replace(/("Major":\s*)\d+/, `$1${major}`)
  .replace(/("Minor":\s*)\d+/, `$1${minor + 1}`)
  .replace(/("Patch":\s*)\d+/, '$10'));

// package.json and the root entries of package-lock.json always track the extension version
write('package.json', read('package.json').replace(/("version":\s*")[^"]+(")/, `$1${next}$2`));
if (fs.existsSync(path.join(dir, 'package-lock.json'))) {
  let n = 0;
  write('package-lock.json', read('package-lock.json').replace(/("version":\s*")[^"]+(")/g, (m, a, b) => (n++ < 2 ? `${a}${next}${b}` : m)));
}

console.log(`Bumped ${dir} from ${released} to ${next}`);
