/**
 * Tes node (BUKAN Apps Script) untuk fungsi murni T04 di Master.gs:
 * validasi jam, urutan jam, dan deteksi bentrok jadwal.
 * Jalankan: node apps-script/test/t04-pure.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const file = path.join(__dirname, '..', 'Master.gs');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });

let pass = 0;
const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

test('normalisasi jam: 7:05 -> 07:05, 07:00 tetap, 24:00/abc ditolak', () => {
  assert.strictEqual(context.normalizeJam_('7:05'), '07:05');
  assert.strictEqual(context.normalizeJam_('07:00'), '07:00');
  assert.strictEqual(context.normalizeJam_('24:00'), '');
  assert.strictEqual(context.normalizeJam_('abc'), '');
});

test('jamKeMenit_: 07:30 = 450', () => {
  assert.strictEqual(context.jamKeMenit_('07:30'), 450);
});

test('tahun ajaran: 2026/2027 valid, 2026/2028 & 26/27 ditolak', () => {
  assert.strictEqual(context.tahunAjaranValid_('2026/2027'), true);
  assert.strictEqual(context.tahunAjaranValid_('2026/2028'), false);
  assert.strictEqual(context.tahunAjaranValid_('26/27'), false);
});

function jadwal(over) {
  return Object.assign({
    id_jadwal: 'J1',
    id_semester: 'S1',
    id_kelas: 'K1',
    nip_guru: 'G1',
    hari: 'Senin',
    jam_mulai: '07:00',
    jam_selesai: '08:00'
  }, over || {});
}

test('tepat bersambung 07:00-08:00 dan 08:00-09:00 TIDAK bentrok', () => {
  assert.strictEqual(context.jadwalBentrok_(jadwal(), jadwal({ id_jadwal: 'J2', jam_mulai: '08:00', jam_selesai: '09:00' })), false);
  assert.strictEqual(context.findJadwalBentrok_(jadwal(), [jadwal({ id_jadwal: 'J2', jam_mulai: '08:00', jam_selesai: '09:00' })]), null);
});

test('07:30-08:30 bentrok dengan 07:00-08:00 (guru sama)', () => {
  const b = jadwal({ id_jadwal: 'J2', jam_mulai: '07:30', jam_selesai: '08:30' });
  assert.strictEqual(context.jadwalBentrok_(jadwal(), b), true);
  assert.strictEqual(context.findJadwalBentrok_(jadwal(), [b]).id_jadwal, 'J2');
});

test('bentrok kelas: guru beda, kelas sama, jam beririsan', () => {
  assert.strictEqual(context.jadwalBentrok_(jadwal(), jadwal({ id_jadwal: 'J2', nip_guru: 'G2', jam_mulai: '07:30', jam_selesai: '08:30' })), true);
});

test('beda hari TIDAK bentrok', () => {
  assert.strictEqual(context.jadwalBentrok_(jadwal(), jadwal({ id_jadwal: 'J2', hari: 'Selasa' })), false);
});

test('beda semester / beda guru & kelas TIDAK bentrok', () => {
  assert.strictEqual(context.jadwalBentrok_(jadwal(), jadwal({ id_jadwal: 'J2', id_semester: 'S2' })), false);
  assert.strictEqual(context.jadwalBentrok_(jadwal(), jadwal({ id_jadwal: 'J2', nip_guru: 'G2', id_kelas: 'K2' })), false);
});

test('edit diri sendiri tidak bentrok', () => {
  assert.strictEqual(context.jadwalBentrok_(jadwal(), jadwal()), false);
  assert.strictEqual(context.findJadwalBentrok_(jadwal(), [jadwal()]), null);
});

let failed = 0;
cases.forEach(({ name, fn }) => {
  try {
    fn();
    pass++;
    console.log('[OK] ' + name);
  } catch (e) {
    failed++;
    console.log('[GAGAL] ' + name + ' -> ' + e.message);
  }
});

console.log('\nHasil tes node fungsi murni T04: ' + pass + ' lulus, ' + failed + ' gagal');
process.exit(failed === 0 ? 0 : 1);
