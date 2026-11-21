const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const dir = path.join(__dirname, '..');
const gsFiles = fs.readdirSync(dir).filter(f => f.endsWith('.gs'));

for (const f of gsFiles) {
  const code = fs.readFileSync(path.join(dir, f), 'utf8');
  new vm.Script(code, { filename: f });
  console.log('[OK] Syntax valid:', f);
}

// Periksa semua pemanggilan include_('...') di file HTML
const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
let includeCount = 0;

for (const hf of htmlFiles) {
  const content = fs.readFileSync(path.join(dir, hf), 'utf8');
  const regex = /include_\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const includedName = match[1];
    const targetFile = path.join(dir, includedName + '.html');
    assert.strictEqual(
      fs.existsSync(targetFile),
      true,
      `File ${includedName}.html yang dipanggil di ${hf} harus ada`
    );
    includeCount++;
    console.log(`[OK] include_('${includedName}') di ${hf} -> ${includedName}.html ditemukan`);
  }
}

console.log(`\nVerifikasi selesai: ${gsFiles.length} file .gs dan ${includeCount} include_() lulus tanpa error.`);

