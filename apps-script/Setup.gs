/**
 * Aplikasi Presensi Sekolah - Setup.gs (Setup Awal)
 * Tetap ada di produksi. Hanya boleh dijalankan pemilik script dari editor.
 */

/**
 * Menyiapkan 9 sheet beserta kolom header sesuai AGENTS.md
 */
function setupSheets() {
  requireEditorOwner_();
  const ss = getSpreadsheet_();
  const createdSheets = [];

  for (const sheetName in SHEET_SCHEMAS) {
    let sheet = ss.getSheetByName(sheetName);
    const headers = SHEET_SCHEMAS[sheetName];

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      createdSheets.push(sheetName);
    }

    // Set header jika baris 1 masih kosong
    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Semua kolom teks dipaksa '@' (juga memperbaiki sheet lama)
    applyTextFormats_(sheet, headers);
  }

  // Hapus sheet bawaan (misal 'Sheet1' atau 'Sheet 1') jika ada sheet lain
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      // Abaikan jika sheet bawaan tidak dapat dihapus
    }
  }

  Logger.log('setupSheets selesai. Sheet disiapkan: ' + Object.keys(SHEET_SCHEMAS).join(', '));
  return 'setupSheets berhasil diselesaikan.';
}

/**
 * Seed akun Admin awal ke sheet Users
 * Password dibaca dari Script Properties 'ADMIN_INITIAL_PASSWORD'
 */
function seedAdmin() {
  requireEditorOwner_();
  const props = PropertiesService.getScriptProperties();
  const initialPassword = props.getProperty('ADMIN_INITIAL_PASSWORD');

  if (!initialPassword) {
    throw new Error('Gagal seedAdmin: Property ADMIN_INITIAL_PASSWORD belum diatur di Script Properties!');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existingAdmin = findRowByKey_('Users', 'username', 'admin');
    if (existingAdmin) {
      Logger.log('Akun admin sudah ada di sheet Users (baris ' + existingAdmin._rowNumber + '). Tidak ada perubahan.');
      return 'Akun admin sudah ada sebelumnya.';
    }

    const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    const passwordHash = hashPassword_(initialPassword, salt);

    const adminUser = {
      id_user: generateId_('USR'),
      username: 'admin',
      password_hash: passwordHash,
      salt: salt,
      role: 'Admin',
      ref_id: '',
      wajib_ganti_password: true,
      aktif: true
    };

    appendRow_('Users', adminUser);
    Logger.log('Berhasil seed akun admin awal.');
    return 'Berhasil seed akun admin awal.';
  } finally {
    lock.releaseLock();
  }
}
