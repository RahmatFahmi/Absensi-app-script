/**
 * Aplikasi Presensi Sekolah - Code.gs (Core Backend & Helpers)
 * Zona Waktu: Asia/Makassar
 */

// Skema 9 sheet resmi sesuai acuan tunggal AGENTS.md
const SHEET_SCHEMAS = {
  Users: ['id_user', 'username', 'password_hash', 'salt', 'role', 'ref_id', 'wajib_ganti_password', 'aktif'],
  Siswa: ['nis', 'nama', 'id_kelas', 'kartu_kontrol'],
  Guru: ['nip', 'nama'],
  Kelas: ['id_kelas', 'nama_kelas'],
  Mapel: ['id_mapel', 'nama_mapel'],
  Semester: ['id_semester', 'tahun_ajaran', 'semester', 'status'],
  Jadwal: ['id_jadwal', 'id_semester', 'id_kelas', 'id_mapel', 'nip_guru', 'hari', 'jam_mulai', 'jam_selesai'],
  Presensi: ['id_presensi', 'tanggal', 'id_jadwal', 'nis', 'status', 'keterangan', 'diubah_oleh', 'diubah_pada'],
  Izin: ['id_izin', 'nis', 'id_jadwal', 'tanggal', 'jenis', 'alasan', 'link_bukti', 'status', 'diajukan_pada', 'diproses_oleh', 'diproses_pada', 'catatan_guru']
};

/**
 * Entry point Web App
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Aplikasi Presensi Sekolah')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper template include file HTML (internal template, tidak diekspos ke klien)
 */
function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Helper mengambil spreadsheet aktif.
 * Bila script tidak terikat ke spreadsheet (project berdiri sendiri),
 * pakai Script Property SPREADSHEET_ID.
 */
function getSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;

  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) {
    return /^https?:\/\//i.test(id.trim())
      ? SpreadsheetApp.openByUrl(id.trim())
      : SpreadsheetApp.openById(id.trim());
  }

  throw new Error('Script tidak terikat ke spreadsheet. Buka Apps Script lewat menu Ekstensi > Apps Script dari spreadsheet, atau isi Script Property SPREADSHEET_ID dengan ID spreadsheet.');
}

/**
 * Helper baca seluruh data sheet menjadi array objek (batch read)
 * @param {string} sheetName
 * @returns {Array<Object>}
 */
function readSheetAsObjects_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const hasValue = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    if (!hasValue) continue;

    const obj = { _rowNumber: i + 1 };
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        obj[headers[j]] = row[j];
      }
    }
    result.push(obj);
  }
  return result;
}

/**
 * Helper menambah baris ke sheet (batch write)
 * @param {string} sheetName
 * @param {Object|Array} rowData - Objek sesuai header atau array nilai
 */
function appendRow_(sheetName, rowData) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan');

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  let rowValues;
  if (Array.isArray(rowData)) {
    rowValues = rowData;
  } else if (typeof rowData === 'object' && rowData !== null) {
    rowValues = headers.map(h => (rowData[h] !== undefined ? rowData[h] : ''));
  } else {
    throw new Error('Format data tidak valid');
  }

  // Format kolom teks pada baris tujuan dulu agar nilai = + - @ tersimpan sebagai teks.
  const targetRow = sheet.getLastRow() + 1;
  if (sheet.getMaxRows() < targetRow) {
    sheet.insertRowsAfter(sheet.getMaxRows(), targetRow - sheet.getMaxRows());
  }
  applyTextFormats_(sheet, headers, targetRow, 1);
  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  return true;
}

/**
 * Helper mencari baris berdasarkan kunci kolom (batch read)
 * @param {string} sheetName
 * @param {string} keyColumn
 * @param {*} keyValue
 * @returns {Object|null} Objek baris atau null jika tidak ditemukan
 */
function findRowByKey_(sheetName, keyColumn, keyValue) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  const headers = data[0];
  const keyIndex = headers.indexOf(keyColumn);
  if (keyIndex === -1) return null;

  const targetStr = String(keyValue).trim();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]).trim() === targetStr) {
      const obj = { _rowNumber: i + 1 };
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      return obj;
    }
  }
  return null;
}

/**
 * Helper menghasilkan ID unik
 * @param {string} [prefix]
 * @returns {string}
 */
function generateId_(prefix) {
  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  return prefix ? prefix + '_' + id : id;
}

/**
 * Helper hash password dengan SHA-256 + salt
 * @param {string} password
 * @param {string} salt
 * @returns {string} Hex string hash (64 karakter)
 */
function hashPassword_(password, salt) {
  const rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    (password || '') + (salt || ''),
    Utilities.Charset.UTF_8
  );
  let hashHex = '';
  for (let i = 0; i < rawBytes.length; i++) {
    let byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    let hex = byteVal.toString(16);
    if (hex.length === 1) hex = '0' + hex;
    hashHex += hex;
  }
  return hashHex;
}

/**
 * Fungsi murni: true bila nilai akan dieksekusi SpreadsheetApp sebagai rumus.
 * Format teks '@' tidak menahan ini, jadi nilainya ditolak saat input.
 */
function awalanFormula_(nilai) {
  const teks = String(nilai === null || nilai === undefined ? '' : nilai).trim();
  return /^[=+\-@]/.test(teks);
}

/**
 * Kolom yang BUKAN teks: tanggal, angka, dan boolean. Semua kolom lain
 * dipaksa teks biasa ('@') agar NIP/NIS tidak berubah.
 */
const NON_TEXT_COLUMNS = {
  Users: ['wajib_ganti_password', 'aktif'],
  Presensi: ['tanggal', 'diubah_pada'],
  Izin: ['diajukan_pada', 'diproses_pada']
};

/**
 * Fungsi murni: indeks kolom teks (0-based) untuk sheet + header tertentu.
 * @param {string} sheetName
 * @param {Array<string>} headers
 * @returns {Array<number>}
 */
function getTextColumnIndexes_(sheetName, headers) {
  const excluded = (NON_TEXT_COLUMNS[sheetName] || []).map(function (c) {
    return String(c || '').trim().toLowerCase();
  });
  const result = [];
  for (let i = 0; i < headers.length; i++) {
    const name = String(headers[i] === null || headers[i] === undefined ? '' : headers[i]).trim().toLowerCase();
    if (name && excluded.indexOf(name) === -1) {
      result.push(i);
    }
  }
  return result;
}

/**
 * Terapkan format teks biasa ('@') pada semua kolom teks (lihat NON_TEXT_COLUMNS).
 * @param {Sheet} sheet
 * @param {Array<string>} headers
 * @param {number} [startRow=2] - baris awal
 * @param {number} [numRows] - jumlah baris; default seluruh sheet
 */
function applyTextFormats_(sheet, headers, startRow, numRows) {
  if (!sheet || !headers) return;
  const first = startRow || 2;
  const count = numRows || Math.max(sheet.getMaxRows() - first + 1, 1);
  const indexes = getTextColumnIndexes_(sheet.getName(), headers);
  for (let i = 0; i < indexes.length; i++) {
    sheet.getRange(first, indexes[i] + 1, count, 1).setNumberFormat('@');
  }
}

/**
 * Pengaman fungsi editor: hanya pemilik script (deployer) yang boleh menjalankan.
 * Asumsi appsscript.json: executeAs=USER_DEPLOYING dan access=ANYONE.
 * Pada konfigurasi itu pemanggil web app punya active user kosong/berbeda
 * dari effective user (pemilik), sehingga fungsi setup/uji di Tests.gs ditolak.
 * Catatan: pemilik yang membuka web app-nya sendiri tetap lolos (active=effective).
 */
function requireEditorOwner_() {
  let active = '';
  try {
    active = String(Session.getActiveUser().getEmail() || '');
  } catch (e) {
    active = '';
  }
  const effective = String(Session.getEffectiveUser().getEmail() || '');
  if (!effective || active.toLowerCase() !== effective.toLowerCase()) {
    throw new Error('Fungsi ini hanya boleh dijalankan oleh pemilik script dari editor Apps Script.');
  }
}
