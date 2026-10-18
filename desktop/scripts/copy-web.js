// Copies the website files from the repo root into desktop/app so they get packaged.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..');
const dest = path.join(__dirname, '..', 'app');
const files = ['index.html', 'app.js', 'style.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dest, f));
