/**
 * Regresi bug halaman "Jadwal & Presensi" guru kosong total.
 * Penyebab: renderJadwalCards dideklarasikan di PresensiPage.html DAN PengajuanPage.html.
 * Karena PengajuanPage di-include setelah PresensiPage, versi siswa (yang menulis ke
 * #siswa-jadwal-container) menimpa versi guru dan return diam-diam -> tidak ada kartu,
 * tidak ada empty state, tidak ada error.
 * Tes ini menggabungkan <script> halaman sesuai urutan include_ di Index.html (seperti browser).
 * Jalankan: node apps-script/test/t06-page-render.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const dir = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(dir, 'Index.html'), 'utf8');
const pageFiles = [...indexHtml.matchAll(/include_\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);

function scriptOf(name) {
  const html = fs.readFileSync(path.join(dir, name + '.html'), 'utf8');
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
}

// DOM tiruan minimal: setiap id selalu ada (seperti halaman lengkap di browser).
function makeEl(id) {
  return {
    id: id, innerHTML: '', textContent: '', className: '', value: '', disabled: false,
    style: {}, children: [],
    appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, removeAttribute() {}, addEventListener() {}, remove() {},
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

const elements = {};
const context = vm.createContext({
  console,
  setTimeout,
  document: {
    getElementById(id) { return elements[id] || (elements[id] = makeEl(id)); },
    createElement(tag) { return makeEl(tag); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  },
  window: { scrollTo() {} }
});

const loaded = [];
for (const name of pageFiles) {
  vm.runInContext(scriptOf(name), context, { filename: name + '.html' });
  loaded.push(name);
}

const guruContainer = context.document.getElementById('jadwal-cards-container');
const jadwalContoh = [{
  id_jadwal: 'JDW_1', nama_mapel: 'IPA', nama_kelas: 'IPA 2',
  jam_mulai: '00:00', jam_selesai: '00:10', status_presensi: 'Belum diisi'
}];

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

test('kartu jadwal guru dirender ke #jadwal-cards-container (jam 00:00 tetap tampil)', () => {
  guruContainer.innerHTML = '';
  context.renderJadwalCards({ hari: 'Kamis', tanggal: '2026-11-19', jadwal: jadwalContoh });
  assert.ok(/IPA/.test(guruContainer.innerHTML), 'kartu jadwal guru kosong: #jadwal-cards-container tidak terisi');
  assert.ok(/00:00/.test(guruContainer.innerHTML), 'jam 00:00 hilang dari kartu jadwal');
});

test('empty state tampil saat tidak ada jadwal', () => {
  guruContainer.innerHTML = '';
  context.renderJadwalCards({ hari: 'Kamis', tanggal: '2026-11-19', jadwal: [] });
  assert.ok(/Tidak Ada Jadwal Mengajar/.test(guruContainer.innerHTML), 'empty state tidak dirender');
});

test('tidak ada nama fungsi global yang dideklarasikan di dua halaman berbeda', () => {
  const owners = {};
  for (const name of pageFiles) {
    for (const m of scriptOf(name).matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)) {
      (owners[m[1]] = owners[m[1]] || []).push(name);
    }
  }
  const bentrok = Object.keys(owners).filter(k => owners[k].length > 1);
  assert.deepStrictEqual(bentrok, [], 'fungsi global bentrok antar halaman: ' +
    bentrok.map(k => k + ' (' + owners[k].join(', ') + ')').join('; '));
});

let pass = 0;
cases.forEach(c => {
  try {
    c.fn();
    pass++;
    console.log(`[OK] ${c.name}`);
  } catch (err) {
    console.error(`[FAIL] ${c.name}: ${err.message}`);
    throw err;
  }
});

console.log(`\nHasil tes halaman Jadwal & Presensi: ${pass} lulus, 0 gagal (${loaded.length} file diuji)`);
