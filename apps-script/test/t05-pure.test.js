/**
 * Tes node (BUKAN Apps Script) untuk fungsi murni T05 di Import.gs:
 * parser TSV dan analisis baris import. Master.gs ikut dimuat untuk
 * normalizeJam_/HARI/findJadwalBentrok_/tahunAjaranValid_.
 * Jalankan: node apps-script/test/t05-pure.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const dir = path.join(__dirname, '..');
const context = vm.createContext({ console });
['Code.gs', 'Master.gs', 'Import.gs'].forEach(function (f) {
  const file = path.join(dir, f);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
});

const parseTsv_ = context.parseTsv_;
const analyzeImport_ = context.analyzeImport_;
const normalizeJam_ = context.normalizeJam_;

let pass = 0;
let failed = 0;
const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

function emptyCtx(over) {
  return Object.assign({
    Kelas: [], Mapel: [], Guru: [], Siswa: [], Semester: [], Jadwal: [], Users: []
  }, over || {});
}

const jamCtx = emptyCtx({
  Semester: [{ id_semester: 'SM1', tahun_ajaran: '2026/2027', semester: 'Ganjil', status: 'Aktif' }],
  Kelas: [{ id_kelas: 'K1', nama_kelas: 'X-1' }],
  Mapel: [{ id_mapel: 'M1', nama_mapel: 'Matematika' }],
  Guru: [{ nip: '198205122008011003', nama: 'Budi' }]
});

function jadwalText(mulai, selesai) {
  return 'tahun_ajaran\tsemester\tnama_kelas\tnama_mapel\tnip_guru\thari\tjam_mulai\tjam_selesai\n' +
    '2026/2027\tGanjil\tX-1\tMatematika\t198205122008011003\tSenin\t' + mulai + '\t' + selesai;
}

test('parser: BOM + CRLF + baris kosong di ujung', () => {
  const r = parseTsv_('\uFEFFnama_kelas\r\nXI-1\r\nXI-2\r\n\r\n');
  assert.deepStrictEqual(Array.from(r.headers), ['nama_kelas']);
  assert.strictEqual(r.rows.length, 2);
  assert.deepStrictEqual(Array.from(r.rows[0].cells), ['XI-1']);
  assert.strictEqual(r.rows[1].line, 3);
});

test('parser: sel berkutip dengan newline dan kutip ganda', () => {
  const r = parseTsv_('nip\tnama\n123\t"Budi\nPratama ""BP"""\n');
  assert.deepStrictEqual(Array.from(r.rows[0].cells), ['123', 'Budi\nPratama "BP"']);
});

test('normalisasi jam: 7:00 dan 07.00 menjadi 07:00', () => {
  assert.strictEqual(normalizeJam_('7:00'), '07:00');
  assert.strictEqual(normalizeJam_('07.00'), '07:00');
});

test('analyze: urutan kolom dibalik (nama sebelum nip) diterima', () => {
  const plan = analyzeImport_('Guru', 'nama\tnip\nBudi\t12345', emptyCtx());
  assert.strictEqual(plan.fatal, null);
  assert.strictEqual(plan.rows[0].status, 'ok');
  assert.strictEqual(plan.rows[0].data.nip, '12345');
});

test('analyze: header tidak dikenal / header wajib hilang = fatal', () => {
  const a = analyzeImport_('Kelas', 'nip\tnama\n1\tA', emptyCtx());
  assert.ok(a.fatal && /Header tidak dikenal/.test(a.fatal), a.fatal);
  const b = analyzeImport_('Guru', 'nip\n123', emptyCtx());
  assert.ok(b.fatal && /Header wajib hilang/.test(b.fatal), b.fatal);
});

test('analyze: baris kosong diabaikan, data lain tetap diproses', () => {
  const plan = analyzeImport_('Kelas', 'nama_kelas\n\nXI-1\n\nXI-2\n', emptyCtx());
  assert.strictEqual(plan.rows.length, 2);
  assert.strictEqual(plan.summary.valid, 2);
});

test('analyze: duplikat dalam tempelan ditolak pada baris kedua', () => {
  const plan = analyzeImport_('Kelas', 'nama_kelas\nXI-1\nXI-1', emptyCtx());
  assert.strictEqual(plan.rows[0].status, 'ok');
  assert.strictEqual(plan.rows[1].status, 'error');
  assert.ok(/[Dd]uplikat/.test(plan.rows[1].errors.join(' ')));
});

test('analyze: jam 7:00 dan 07.00 dinormalisasi pada Jadwal', () => {
  const a = analyzeImport_('Jadwal', jadwalText('7:00', '8:00'), jamCtx);
  assert.strictEqual(a.rows[0].status, 'ok', a.rows[0].errors.join(' '));
  assert.strictEqual(a.rows[0].data.jam_mulai, '07:00');
  assert.strictEqual(a.rows[0].data.jam_selesai, '08:00');

  const b = analyzeImport_('Jadwal', jadwalText('07.00', '08.00'), jamCtx);
  assert.strictEqual(b.rows[0].status, 'ok', b.rows[0].errors.join(' '));
  assert.strictEqual(b.rows[0].data.jam_mulai, '07:00');
});

test('analyze: melebihi 500 baris data ditolak', () => {
  let text = 'nama_kelas';
  for (let i = 0; i < 501; i++) text += '\nK' + i;
  const plan = analyzeImport_('Kelas', text, emptyCtx());
  assert.ok(plan.fatal && /500/.test(plan.fatal), plan.fatal);
});

test('analyze: NIP 18 digit dan NIS berawalan nol tidak berubah', () => {
  const nip = '999900001234567890';
  const guru = analyzeImport_('Guru', 'nip\tnama\n' + nip + '\tTEST_Guru', emptyCtx());
  assert.strictEqual(guru.rows[0].data.nip, nip);

  const siswa = analyzeImport_('Siswa', 'nis\tnama\tnama_kelas\tkartu_kontrol\n00123\tTEST_Siswa\tX-1\t', jamCtx);
  assert.strictEqual(siswa.rows[0].status, 'ok', siswa.rows[0].errors.join(' '));
  assert.strictEqual(siswa.rows[0].data.nis, '00123');
  assert.strictEqual(siswa.rows[0].data.kartu_kontrol, 'Tidak');
});

test('analyze: referensi kelas tidak ada = baris error', () => {
  const plan = analyzeImport_('Siswa', 'nis\tnama\tnama_kelas\tkartu_kontrol\n00124\tTEST_S\tTIDAK_ADA\tYa', jamCtx);
  assert.strictEqual(plan.rows[0].status, 'error');
  assert.ok(/tidak ditemukan/.test(plan.rows[0].errors.join(' ')));
});

test('analyze: data yang sudah ada = error "sudah ada"', () => {
  const plan = analyzeImport_('Guru', 'nip\tnama\n198205122008011003\tBudi Lagi', jamCtx);
  assert.strictEqual(plan.rows[0].status, 'error');
  assert.ok(/sudah ada/.test(plan.rows[0].errors.join(' ')));
});

test('analyze: bentrok antar baris dalam tempelan yang sama', () => {
  const text = jadwalText('07:00', '08:00') + '\n2026/2027\tGanjil\tX-1\tMatematika\t198205122008011003\tSenin\t07:30\t08:30';
  const plan = analyzeImport_('Jadwal', text, jamCtx);
  assert.strictEqual(plan.rows[0].status, 'ok');
  assert.strictEqual(plan.rows[1].status, 'error');
  assert.ok(/bentrok/i.test(plan.rows[1].errors.join(' ')));
});

test('parser: teks kosong ditolak', () => {
  assert.throws(function () { parseTsv_('   \n  '); }, /kosong/i);
});

test('parser: kutip di tengah sel tanpa kutip pembuka tidak menelan tab', () => {
  const r = parseTsv_('nip\tnama\n123\tBudi "BP"\n456\tSari');
  assert.deepStrictEqual(Array.from(r.rows[0].cells), ['123', 'Budi "BP"']);
  assert.deepStrictEqual(Array.from(r.rows[1].cells), ['456', 'Sari']);
});

test('analyze: nilai berawalan = + - @ ditolak agar tidak jadi rumus', () => {
  const plan = analyzeImport_('Kelas', 'nama_kelas\n=1+1\n+XI-2\n-XI-3\n@XI-4', emptyCtx());
  assert.strictEqual(plan.summary.valid, 0, JSON.stringify(plan.summary));
  plan.rows.forEach(function (r) {
    assert.strictEqual(r.status, 'error');
    assert.ok(/tidak boleh diawali/i.test(r.errors.join(' ')), r.errors.join(' '));
  });
});

cases.forEach(function (c) {
  try {
    c.fn();
    pass++;
    console.log('[OK] ' + c.name);
  } catch (e) {
    failed++;
    console.log('[GAGAL] ' + c.name + ' -> ' + e.message);
  }
});

console.log('\nHasil tes node fungsi murni T05: ' + pass + ' lulus, ' + failed + ' gagal');
process.exit(failed === 0 ? 0 : 1);
