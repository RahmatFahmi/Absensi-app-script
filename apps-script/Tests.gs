/**
 * Aplikasi Presensi Sekolah - Tests.gs (Uji Otomatis)
 * DIHAPUS dari proyek yang dideploy untuk produksi (lihat README & docs/RILIS.md).
 */

/**
 * Fungsi uji otomatis T01 untuk dijalankan di editor Apps Script
 */
function testT01() {
  requireEditorOwner_();
  const ss = getSpreadsheet_();
  const results = [];
  let allPassed = true;

  // 1. Verifikasi 9 sheet dan header
  for (const sheetName in SHEET_SCHEMAS) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      results.push(`[GAGAL] Sheet ${sheetName} tidak ditemukan`);
      allPassed = false;
      continue;
    }
    const expectedHeaders = SHEET_SCHEMAS[sheetName];
    const actualHeaders = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
    const match = expectedHeaders.every((h, idx) => h === actualHeaders[idx]);
    if (!match) {
      results.push(`[GAGAL] Header sheet ${sheetName} tidak cocok. Diharapkan: ${expectedHeaders.join(',')} | Aktual: ${actualHeaders.join(',')}`);
      allPassed = false;
    } else {
      results.push(`[OK] Sheet ${sheetName} dan header valid`);
    }
  }

  // 2. Verifikasi helper hashPassword_
  const testHash = hashPassword_('secret', 'salt123');
  if (typeof testHash === 'string' && testHash.length === 64) {
    results.push('[OK] Helper hashPassword_ menghasilkan SHA-256 valid (64 hex characters)');
  } else {
    results.push('[GAGAL] Helper hashPassword_ tidak menghasilkan format yang diharapkan');
    allPassed = false;
  }

  // 3. Verifikasi helper generateId_
  const testId = generateId_('TEST');
  if (testId.startsWith('TEST_') && testId.length > 5) {
    results.push('[OK] Helper generateId_ berfungsi');
  } else {
    results.push('[GAGAL] Helper generateId_ gagal');
    allPassed = false;
  }

  // 4. Verifikasi akun admin di sheet Users
  const adminRow = findRowByKey_('Users', 'username', 'admin');
  if (adminRow) {
    results.push(`[OK] Akun admin ditemukan di baris ${adminRow._rowNumber} dengan role "${adminRow.role}"`);
  } else {
    results.push('[PERHATIAN] Akun admin belum ditemukan di sheet Users. Jalankan seedAdmin() terlebih dahulu jika belum.');
  }

  // 5. Verifikasi readSheetAsObjects_
  const users = readSheetAsObjects_('Users');
  results.push(`[OK] Helper readSheetAsObjects_ membaca ${users.length} baris dari sheet Users`);

  const summary = `Hasil Uji testT01: ${allPassed ? 'SEMUA UJI DASAR LULUS' : 'ADA KEGAGALAN'}\n` + results.join('\n');
  Logger.log(summary);
  return summary;
}

/**
 * Uji otomatis T02 untuk dijalankan dari editor Apps Script
 */
function testT02() {
  requireEditorOwner_();
  const results = [];
  let allPassed = true;
  const cache = CacheService.getScriptCache();

  // 1. Buat token sesi uji
  const mockTokenAdmin = 'TEST_TOKEN_ADMIN_' + Utilities.getUuid();
  const mockSessionAdmin = {
    id_user: 'USR_TEST_ADMIN',
    username: 'test.admin',
    role: 'Admin',
    ref_id: '',
    wajib_ganti_password: false
  };
  cache.put(mockTokenAdmin, JSON.stringify(mockSessionAdmin), 60);

  // 2. Uji requireRole_ untuk role yang benar (string & array)
  try {
    const verified = requireRole_(mockTokenAdmin, 'Admin');
    const verifiedArr = requireRole_(mockTokenAdmin, ['Admin', 'Guru']);
    if (verified.role === 'Admin' && verifiedArr.role === 'Admin') {
      results.push('[OK] requireRole_ menerima token Admin untuk role Admin (string & array)');
    } else {
      results.push('[GAGAL] requireRole_ mengembalikan role tidak cocok');
      allPassed = false;
    }
  } catch (e) {
    results.push('[GAGAL] requireRole_ gagal untuk role benar: ' + e.message);
    allPassed = false;
  }

  // 3. Uji requireRole_ untuk role yang salah (harus ditolak)
  try {
    requireRole_(mockTokenAdmin, 'Guru');
    results.push('[GAGAL] requireRole_ seharusnya menolak token Admin saat meminta role Guru');
    allPassed = false;
  } catch (e) {
    results.push('[OK] requireRole_ menolak role salah: ' + e.message);
  }

  // 4. Uji requireRole_ saat wajib_ganti_password = true (harus ditolak)
  const mockTokenMustChange = 'TEST_TOKEN_MUST_CHANGE_' + Utilities.getUuid();
  const mockSessionMustChange = {
    id_user: 'USR_TEST_CHANGE',
    username: 'test.user',
    role: 'Guru',
    ref_id: '',
    wajib_ganti_password: true
  };
  cache.put(mockTokenMustChange, JSON.stringify(mockSessionMustChange), 60);
  try {
    requireRole_(mockTokenMustChange, 'Guru');
    results.push('[GAGAL] requireRole_ seharusnya menolak jika wajib_ganti_password = true');
    allPassed = false;
  } catch (e) {
    results.push('[OK] requireRole_ menolak sesi yang wajib_ganti_password: ' + e.message);
  }

  // 5. Uji kunci akun setelah 5x gagal berturut-turut
  const testDummyUser = 'user_test_lockout_' + Utilities.getUuid().slice(0, 6);
  for (let i = 0; i < 5; i++) {
    try {
      login(testDummyUser, 'wrong_pass');
    } catch (e) {
      // Diharapkan gagal
    }
  }
  try {
    login(testDummyUser, 'wrong_pass');
    results.push('[GAGAL] Login ke-6 seharusnya memicu penguncian akun');
    allPassed = false;
  } catch (e) {
    if (e.message.includes('dikunci') || e.message.includes('Terlalu banyak percobaan')) {
      results.push('[OK] Penguncian akun 5x gagal berturut-turut bekerja (pesan lockout aktif)');
    } else {
      results.push('[GAGAL] Pesan lockout tidak sesuai: ' + e.message);
      allPassed = false;
    }
  }

  // Bersihkan cache lockout uji
  cache.remove('fail_count_' + testDummyUser);
  cache.remove('lockout_' + testDummyUser);

  // 6. Uji changePassword menolak password lemah / sama dengan username
  try {
    changePassword(mockTokenAdmin, 'old', '12345'); // < 8 karakter
    results.push('[GAGAL] changePassword seharusnya menolak password < 8 karakter');
    allPassed = false;
  } catch (e) {
    results.push('[OK] changePassword menolak password < 8 karakter: ' + e.message);
  }

  try {
    changePassword(mockTokenAdmin, 'old', 'test.admin'); // sama dengan username
    results.push('[GAGAL] changePassword seharusnya menolak password sama dengan username');
    allPassed = false;
  } catch (e) {
    results.push('[OK] changePassword menolak password sama dengan username: ' + e.message);
  }

  // Bersihkan token uji
  cache.remove(mockTokenAdmin);
  cache.remove(mockTokenMustChange);

  const summary = `Hasil Uji testT02: ${allPassed ? 'SEMUA UJI AUTH & ROLE LULUS' : 'ADA KEGAGALAN'}\n` + results.join('\n');
  Logger.log(summary);
  return summary;
}

/**
 * Uji otomatis T03 untuk dijalankan dari editor Apps Script
 */
function testT03() {
  requireEditorOwner_();
  const results = [];
  let allPassed = true;
  const cache = CacheService.getScriptCache();

  // Siapkan token sesi admin uji
  const mockToken = 'TEST_TOKEN_T03_' + Utilities.getUuid();
  const mockAdminSession = {
    id_user: 'USR_TEST_ADMIN_T03',
    username: 'admin.t03',
    role: 'Admin',
    ref_id: '',
    wajib_ganti_password: false
  };
  cache.put(mockToken, JSON.stringify(mockAdminSession), 120);

  const suffix = Utilities.getUuid().slice(0, 4);
  const testIdKelas = 'KLS_' + suffix;
  const testNip = 'GUR_' + suffix;
  const testNis = 'SIS_' + suffix;
  const testIdMapel = 'MPL_' + suffix;

  try {
    // 1. Uji Tambah Kelas
    const resKls = saveEntity(mockToken, 'Kelas', { id_kelas: testIdKelas, nama_kelas: 'Kelas Uji ' + suffix }, 'add');
    if (resKls.success) {
      results.push('[OK] saveEntity Kelas (add) berhasil');
    } else {
      results.push('[GAGAL] saveEntity Kelas gagal');
      allPassed = false;
    }

    // 2. Uji Duplikasi Kunci Ditolak
    try {
      saveEntity(mockToken, 'Kelas', { id_kelas: testIdKelas, nama_kelas: 'Duplikat' }, 'add');
      results.push('[GAGAL] saveEntity seharusnya menolak id_kelas duplikat');
      allPassed = false;
    } catch (e) {
      results.push('[OK] saveEntity berhasil menolak id_kelas duplikat: ' + e.message);
    }

    // 3. Uji Tambah Guru & Verifikasi Akun Users Otomatis
    const resGuru = saveEntity(mockToken, 'Guru', { nip: testNip, nama: 'Guru Uji ' + suffix }, 'add');
    if (resGuru.success) {
      const userGuru = findRowByKey_('Users', 'ref_id', testNip);
      if (userGuru && userGuru.role === 'Guru' && (userGuru.aktif === true || String(userGuru.aktif) === 'true')) {
        results.push('[OK] saveEntity Guru berhasil & akun otomatis dibuat di Users');
      } else {
        results.push('[GAGAL] Akun Guru tidak ditemukan di Users');
        allPassed = false;
      }
    }

    // 4. Uji Tambah Siswa dengan Relasi Kelas & kartu_kontrol
    const resSiswa = saveEntity(mockToken, 'Siswa', {
      nis: testNis,
      nama: 'Siswa Uji ' + suffix,
      id_kelas: testIdKelas,
      kartu_kontrol: 'Ya'
    }, 'add');
    if (resSiswa.success) {
      const siswaRow = findRowByKey_('Siswa', 'nis', testNis);
      const userSiswa = findRowByKey_('Users', 'ref_id', testNis);
      if (siswaRow && siswaRow.kartu_kontrol === 'Ya' && userSiswa && userSiswa.role === 'Siswa') {
        results.push('[OK] saveEntity Siswa berhasil (kartu_kontrol = Ya) & akun dibuat di Users');
      } else {
        results.push('[GAGAL] Data Siswa atau akun Users tidak cocok');
        allPassed = false;
      }
    }

    // 5. Uji Validasi Foreign Key: Siswa dengan id_kelas fiktif ditolak
    try {
      saveEntity(mockToken, 'Siswa', { nis: 'FIKTIF_' + suffix, nama: 'Fiktif', id_kelas: 'KELAS_TIDAK_ADA' }, 'add');
      results.push('[GAGAL] saveEntity seharusnya menolak id_kelas yang tidak ada');
      allPassed = false;
    } catch (e) {
      results.push('[OK] saveEntity menolak id_kelas tidak terdaftar: ' + e.message);
    }

    // 6. Uji Tambah Mapel
    const resMapel = saveEntity(mockToken, 'Mapel', { id_mapel: testIdMapel, nama_mapel: 'Mapel Uji ' + suffix }, 'add');
    if (resMapel.success) {
      results.push('[OK] saveEntity Mapel berhasil');
    }

    // 7. Uji listEntity keempat master
    const listK = listEntity(mockToken, 'Kelas');
    const listG = listEntity(mockToken, 'Guru');
    const listS = listEntity(mockToken, 'Siswa');
    const listM = listEntity(mockToken, 'Mapel');
    if (listK.items.length > 0 && listG.items.length > 0 && listS.items.length > 0 && listM.items.length > 0) {
      results.push('[OK] listEntity keempat master berhasil membaca data');
    } else {
      results.push('[GAGAL] listEntity gagal membaca salah satu master');
      allPassed = false;
    }

    // 8. Uji resetPassword Siswa
    const resReset = resetPassword(mockToken, testNis);
    if (resReset.success) {
      const uAfterReset = findRowByKey_('Users', 'ref_id', testNis);
      const expectedHash = hashPassword_(testNis, uAfterReset.salt);
      if (uAfterReset.password_hash === expectedHash && (uAfterReset.wajib_ganti_password === true || String(uAfterReset.wajib_ganti_password) === 'true')) {
        results.push('[OK] resetPassword berhasil (hash NIS cocok & wajib_ganti_password = true)');
      } else {
        results.push('[GAGAL] resetPassword gagal memperbarui hash atau flag wajib_ganti_password');
        allPassed = false;
      }
    }

    // 9. Uji Integritas Hapus: Hapus Kelas yang memiliki Siswa harus DITOLAK
    try {
      deleteEntity(mockToken, 'Kelas', testIdKelas);
      results.push('[GAGAL] deleteEntity seharusnya menolak menghapus Kelas yang masih memiliki Siswa');
      allPassed = false;
    } catch (e) {
      results.push('[OK] deleteEntity berhasil melindungi relasi (tolak hapus Kelas dengan Siswa): ' + e.message);
    }

    // 10. Bersihkan data uji: Hapus Siswa, lalu Akun dinonaktifkan
    deleteEntity(mockToken, 'Siswa', testNis);
    const uSiswaDeleted = findRowByKey_('Users', 'ref_id', testNis);
    if (uSiswaDeleted && (uSiswaDeleted.aktif === false || String(uSiswaDeleted.aktif) === 'false')) {
      results.push('[OK] deleteEntity Siswa berhasil & akun di Users dinonaktifkan (aktif = false)');
    } else {
      results.push('[PERHATIAN] Akun pengguna tidak dinonaktifkan saat Siswa dihapus');
    }

    // Hapus sisa data uji
    deleteEntity(mockToken, 'Kelas', testIdKelas);
    deleteEntity(mockToken, 'Guru', testNip);
    deleteEntity(mockToken, 'Mapel', testIdMapel);
    results.push('[OK] Pembersihan data uji selesai');

  } catch (err) {
    results.push('[ERROR FATAL] ' + err.message);
    allPassed = false;
  } finally {
    cache.remove(mockToken);
  }

  const summary = `Hasil Uji testT03: ${allPassed ? 'SEMUA UJI DATA MASTER LULUS' : 'ADA KEGAGALAN'}\n` + results.join('\n');
  Logger.log(summary);
  return summary;
}

/**
 * Uji otomatis T04 untuk dijalankan dari editor Apps Script.
 * Data uji memakai awalan TEST_ dan dibersihkan di akhir.
 */
function testT04() {
  requireEditorOwner_();
  const results = [];
  let allPassed = true;
  const cache = CacheService.getScriptCache();
  const ss = getSpreadsheet_();

  const mockToken = 'TEST_TOKEN_T04_' + Utilities.getUuid();
  cache.put(mockToken, JSON.stringify({
    id_user: 'USR_TEST_T04', username: 'admin.t04', role: 'Admin', ref_id: '', wajib_ganti_password: false
  }), 120);

  const suffix = Utilities.getUuid().slice(0, 4);
  const testKelas = 'TEST_KLS_' + suffix;
  const testKelas2 = 'TEST_KLS2_' + suffix;
  const testMapel = 'TEST_MPL_' + suffix;
  const testGuru = 'TEST_GUR_' + suffix;
  const testGuru2 = 'TEST_GUR2_' + suffix;
  const tahun1 = '2098/2099';
  const tahun2 = '2099/2100';
  const jadwalIds = [];
  let sem1 = null;
  let sem2 = null;
  const originalAktif = getSemesterAktif_();

  function check(cond, okMsg, failMsg) {
    if (cond) {
      results.push('[OK] ' + okMsg);
    } else {
      results.push('[GAGAL] ' + failMsg);
      allPassed = false;
    }
  }

  try {
    // 1. Dua semester uji, id otomatis
    const r1 = saveSemester(mockToken, { tahun_ajaran: tahun1, semester: 'Ganjil' }, 'add');
    sem1 = r1.data.id_semester;
    const r2 = saveSemester(mockToken, { tahun_ajaran: tahun2, semester: 'Ganjil' }, 'add');
    sem2 = r2.data.id_semester;
    check(!!sem1 && !!sem2 && sem1 !== sem2 && sem1.indexOf('SM_') === 0,
      'Dua semester uji dibuat, id otomatis (' + sem1 + ', ' + sem2 + ')',
      'Gagal membuat semester uji / id tidak otomatis');

    // 2. Validasi format tahun ajaran
    try {
      saveSemester(mockToken, { tahun_ajaran: '2098/2100', semester: 'Ganjil' }, 'add');
      check(false, '', 'saveSemester seharusnya menolak tahun ajaran tidak berurutan');
    } catch (e) {
      check(e.message.indexOf('Tahun ajaran') !== -1, 'saveSemester menolak format tahun ajaran salah: ' + e.message,
        'Pesan validasi tahun ajaran tidak sesuai: ' + e.message);
    }

    // 3. Kombinasi tahun + semester duplikat
    try {
      saveSemester(mockToken, { tahun_ajaran: tahun1, semester: 'Ganjil' }, 'add');
      check(false, '', 'saveSemester seharusnya menolak kombinasi tahun+semester duplikat');
    } catch (e) {
      check(e.message.indexOf('sudah terdaftar') !== -1, 'saveSemester menolak kombinasi semester duplikat',
        'Pesan duplikat semester tidak sesuai: ' + e.message);
    }

    // 4. Aktivasi semester: tepat satu aktif
    setSemesterAktif(mockToken, sem1);
    let aktif = readSheetAsObjects_('Semester').filter(function (s) { return String(s.status).trim() === 'Aktif'; });
    check(aktif.length === 1 && String(aktif[0].id_semester) === sem1,
      'setSemesterAktif(sem1): tepat satu semester aktif',
      'setSemesterAktif(sem1) gagal: jumlah aktif = ' + aktif.length);

    setSemesterAktif(mockToken, sem2);
    aktif = readSheetAsObjects_('Semester').filter(function (s) { return String(s.status).trim() === 'Aktif'; });
    check(aktif.length === 1 && String(aktif[0].id_semester) === sem2,
      'setSemesterAktif(sem2): tepat satu semester aktif (yang lama otomatis nonaktif)',
      'setSemesterAktif(sem2) gagal: jumlah aktif = ' + aktif.length);

    // 5. Semester aktif tidak boleh dihapus
    try {
      deleteSemester(mockToken, sem2);
      check(false, '', 'deleteSemester seharusnya menolak semester aktif');
    } catch (e) {
      check(e.message.indexOf('Semester aktif') !== -1, 'deleteSemester menolak semester aktif: ' + e.message,
        'Pesan tolak hapus semester aktif tidak sesuai: ' + e.message);
    }

    // 6. Data pendukung: 2 kelas, 1 mapel, 2 guru
    saveEntity(mockToken, 'Kelas', { id_kelas: testKelas, nama_kelas: 'TEST_Kelas ' + suffix }, 'add');
    saveEntity(mockToken, 'Kelas', { id_kelas: testKelas2, nama_kelas: 'TEST_Kelas2 ' + suffix }, 'add');
    saveEntity(mockToken, 'Mapel', { id_mapel: testMapel, nama_mapel: 'TEST_Mapel ' + suffix }, 'add');
    saveEntity(mockToken, 'Guru', { nip: testGuru, nama: 'TEST_Guru ' + suffix }, 'add');
    saveEntity(mockToken, 'Guru', { nip: testGuru2, nama: 'TEST_Guru2 ' + suffix }, 'add');

    // 7. Jadwal A: Senin 07:00-08:00
    const jA = saveJadwal(mockToken, {
      id_semester: sem2, id_kelas: testKelas, id_mapel: testMapel,
      nip_guru: testGuru, hari: 'Senin', jam_mulai: '07:00', jam_selesai: '08:00'
    }, 'add');
    jadwalIds.push(jA.data.id_jadwal);
    check(jA.success && jA.data.id_jadwal.indexOf('JDW_') === 0,
      'Jadwal tersimpan dengan id_jadwal otomatis (' + jA.data.id_jadwal + ')',
      'Jadwal gagal disimpan / id tidak otomatis');

    const rowA = findRowByKey_('Jadwal', 'id_jadwal', jA.data.id_jadwal);
    check(typeof rowA.jam_mulai === 'string' && rowA.jam_mulai === '07:00' &&
      typeof rowA.jam_selesai === 'string' && rowA.jam_selesai === '08:00',
      'Jam tersimpan sebagai teks "07:00"/"08:00"',
      'Jam tidak tersimpan sebagai teks: ' + typeof rowA.jam_mulai + ' / ' + rowA.jam_mulai);

    // 8. Bentrok guru: guru sama, kelas beda, 07:30-08:30
    try {
      saveJadwal(mockToken, {
        id_semester: sem2, id_kelas: testKelas2, id_mapel: testMapel,
        nip_guru: testGuru, hari: 'Senin', jam_mulai: '07:30', jam_selesai: '08:30'
      }, 'add');
      check(false, '', 'saveJadwal seharusnya menolak bentrok guru');
    } catch (e) {
      check(e.message.indexOf('bentrok') !== -1 && e.message.indexOf('07:00-08:00') !== -1 &&
        e.message.indexOf('TEST_Guru ' + suffix) !== -1,
        'saveJadwal menolak bentrok guru & menyebut nama + jam: ' + e.message,
        'Pesan bentrok guru tidak lengkap: ' + e.message);
    }

    // 9. Bentrok kelas: kelas sama, guru beda, 07:30-08:30
    try {
      saveJadwal(mockToken, {
        id_semester: sem2, id_kelas: testKelas, id_mapel: testMapel,
        nip_guru: testGuru2, hari: 'Senin', jam_mulai: '07:30', jam_selesai: '08:30'
      }, 'add');
      check(false, '', 'saveJadwal seharusnya menolak bentrok kelas');
    } catch (e) {
      check(e.message.indexOf('bentrok') !== -1 && e.message.indexOf('TEST_Kelas ' + suffix) !== -1,
        'saveJadwal menolak bentrok kelas & menyebut kelas: ' + e.message,
        'Pesan bentrok kelas tidak lengkap: ' + e.message);
    }

    // 10. Tepat bersambung: 08:00-09:00 tidak bentrok
    const jB = saveJadwal(mockToken, {
      id_semester: sem2, id_kelas: testKelas, id_mapel: testMapel,
      nip_guru: testGuru, hari: 'Senin', jam_mulai: '08:00', jam_selesai: '09:00'
    }, 'add');
    jadwalIds.push(jB.data.id_jadwal);
    check(jB.success, 'Jadwal bersambung 08:00-09:00 diterima (tidak dianggap bentrok)',
      'Jadwal bersambung salah ditolak sebagai bentrok');

    // 11. Edit diri sendiri tidak bentrok
    const jEdit = saveJadwal(mockToken, {
      id_jadwal: jA.data.id_jadwal,
      id_semester: sem2, id_kelas: testKelas, id_mapel: testMapel,
      nip_guru: testGuru, hari: 'Senin', jam_mulai: '07:00', jam_selesai: '08:00'
    }, 'edit');
    check(jEdit.success, 'Edit jadwal pada jam yang sama tidak dianggap bentrok dengan dirinya sendiri',
      'Edit jadwal salah ditolak sebagai bentrok');

    // 12. Jadwal boleh dibuat untuk semester belum aktif
    const jC = saveJadwal(mockToken, {
      id_semester: sem1, id_kelas: testKelas, id_mapel: testMapel,
      nip_guru: testGuru, hari: 'Senin', jam_mulai: '07:00', jam_selesai: '08:00'
    }, 'add');
    jadwalIds.push(jC.data.id_jadwal);
    check(jC.success, 'Jadwal untuk semester belum aktif diterima (persiapan)',
      'Jadwal untuk semester belum aktif salah ditolak');

    // 13. Hapus kelas yang sudah punya jadwal ditolak
    try {
      deleteEntity(mockToken, 'Kelas', testKelas);
      check(false, '', 'deleteEntity seharusnya menolak hapus Kelas yang dipakai Jadwal');
    } catch (e) {
      check(e.message.indexOf('Jadwal') !== -1, 'Hapus Kelas yang punya Jadwal ditolak: ' + e.message,
        'Pesan tolak hapus Kelas tidak menyebut Jadwal: ' + e.message);
    }

    // 14. Helper
    const semAktif = getSemesterAktif_();
    check(semAktif && semAktif.id_semester === sem2, 'getSemesterAktif_() mengembalikan semester aktif',
      'getSemesterAktif_() salah');

    const jadwalGuru = getJadwalByGuruHari_(testGuru, 'Senin');
    check(jadwalGuru.length === 2 && jadwalGuru[0].jam_mulai === '07:00' && jadwalGuru[1].jam_mulai === '08:00' &&
      jadwalGuru[0].nama_kelas === 'TEST_Kelas ' + suffix && jadwalGuru[0].nama_mapel === 'TEST_Mapel ' + suffix,
      'getJadwalByGuruHari_() urut jam & sudah digabung nama kelas/mapel',
      'getJadwalByGuruHari_() tidak sesuai: ' + JSON.stringify(jadwalGuru));

    check(hariDariTanggal_(new Date('2026-11-16T10:00:00+08:00')) === 'Senin',
      'hariDariTanggal_() memakai zona waktu aplikasi (16 Nov 2026 = Senin)',
      'hariDariTanggal_() salah: ' + hariDariTanggal_(new Date('2026-11-16T10:00:00+08:00')));

  } catch (err) {
    results.push('[ERROR FATAL] ' + err.message);
    allPassed = false;
  } finally {
    // Bersihkan data uji
    jadwalIds.forEach(function (id) {
      try { deleteJadwal(mockToken, id); } catch (e) { results.push('[PERHATIAN] Gagal hapus jadwal uji ' + id + ': ' + e.message); }
    });

    if (!originalAktif) {
      // Tidak ada semester aktif sebelumnya: matikan status baris uji langsung agar bisa dihapus
      try {
        const s = ss.getSheetByName('Semester');
        const d = s.getDataRange().getValues();
        const h = d[0];
        const idI = h.indexOf('id_semester');
        const stI = h.indexOf('status');
        for (let r = 1; r < d.length; r++) {
          const rid = String(d[r][idI] || '').trim();
          if (rid && (rid === sem1 || rid === sem2)) s.getRange(r + 1, stI + 1).setValue('Tidak aktif');
        }
      } catch (e) {
        results.push('[PERHATIAN] Gagal menonaktifkan semester uji: ' + e.message);
      }
    } else {
      try { setSemesterAktif(mockToken, originalAktif.id_semester); } catch (e) {
        results.push('[PERHATIAN] Gagal memulihkan semester aktif asli: ' + e.message);
      }
    }

    [[testKelas2], [testKelas]].forEach(function (k) {
      try { deleteEntity(mockToken, 'Kelas', k[0]); } catch (e) { /* mungkin masih kosong */ }
    });
    try { deleteEntity(mockToken, 'Mapel', testMapel); } catch (e) { /* abaikan */ }
    try { deleteEntity(mockToken, 'Guru', testGuru2); } catch (e) { /* abaikan */ }
    try { deleteEntity(mockToken, 'Guru', testGuru); } catch (e) { /* abaikan */ }
    if (sem1) { try { deleteSemester(mockToken, sem1); } catch (e) { results.push('[PERHATIAN] Gagal hapus semester uji 1: ' + e.message); } }
    if (sem2) { try { deleteSemester(mockToken, sem2); } catch (e) { results.push('[PERHATIAN] Gagal hapus semester uji 2: ' + e.message); } }

    cache.remove(mockToken);
  }

  const summary = `Hasil Uji testT04: ${allPassed ? 'SEMUA UJI SEMESTER & JADWAL LULUS' : 'ADA KEGAGALAN'}\n` + results.join('\n');
  Logger.log(summary);
  return summary;
}

/**
 * Uji otomatis T05 untuk dijalankan dari editor Apps Script.
 * Data uji berawalan TEST_ (NIP 18 digit & NIS berawalan nol), dibersihkan di akhir.
 */
function testT05() {
  requireEditorOwner_();
  const results = [];
  let allPassed = true;
  const cache = CacheService.getScriptCache();
  const mockToken = 'TEST_TOKEN_T05_' + Utilities.getUuid();
  cache.put(mockToken, JSON.stringify({
    id_user: 'USR_TEST_T05', username: 'admin.t05', role: 'Admin', ref_id: '', wajib_ganti_password: false
  }), 300);

  const suffix = Utilities.getUuid().slice(0, 6);
  const testKelas = 'TEST_Kelas ' + suffix;
  const testMapel = 'TEST_Mapel ' + suffix;
  const nip18 = '9' + String(new Date().getTime()).slice(-17);
  const nisZero = '0' + String(new Date().getTime()).slice(-9);
  const namaGuru = 'TEST_Guru ' + suffix;
  const namaSiswa = 'TEST_Siswa ' + suffix;
  const namaFormula = '=1+1';
  const sem = getSemesterAktif_();

  function check(cond, okMsg, failMsg) {
    if (cond) results.push('[OK] ' + okMsg);
    else { results.push('[GAGAL] ' + failMsg); allPassed = false; }
  }

  try {
    // 1. Template
    const tpl = getImportTemplate(mockToken, 'Jadwal');
    check(tpl.headers.length === 8 && tpl.sample.length === 8,
      'getImportTemplate(Jadwal) mengembalikan 8 header + 1 contoh',
      'getImportTemplate(Jadwal) tidak lengkap');

    // 2. Preview tidak menulis
    const sheetKelas = getSpreadsheet_().getSheetByName('Kelas');
    const beforeRows = sheetKelas.getLastRow();
    const textKelas = 'nama_kelas\n' + testKelas;
    const prev = previewImport(mockToken, 'Kelas', textKelas);
    check(!prev.fatal && prev.summary.valid === 1,
      'previewImport Kelas: 1 baris valid',
      'previewImport Kelas gagal: ' + (prev.fatal || 'tidak valid'));
    check(sheetKelas.getLastRow() === beforeRows,
      'previewImport tidak menulis ke sheet',
      'previewImport menulis ke sheet (seharusnya hanya baca)');

    // 3. Commit Kelas + tempel ulang ditolak
    const c1 = commitImport(mockToken, 'Kelas', textKelas);
    check(c1.saved === 1 && c1.rejected === 0,
      'commitImport Kelas menyimpan 1 baris',
      'commitImport Kelas gagal: ' + JSON.stringify(c1));
    const c2 = commitImport(mockToken, 'Kelas', textKelas);
    const rePrev = previewImport(mockToken, 'Kelas', textKelas);
    check(c2.saved === 0 && c2.rejected === 1 && /sudah ada/.test(rePrev.rows[0].errors.join(' ')),
      'tempel ulang Kelas ditolak "sudah ada"',
      'tempel ulang Kelas tidak ditolak dengan benar');

    // 4. Mapel
    const cm = commitImport(mockToken, 'Mapel', 'nama_mapel\n' + testMapel);
    check(cm.saved === 1, 'commitImport Mapel menyimpan 1 baris', 'commitImport Mapel gagal');

    // 4b. Formula injection: nilai berawalan "=" harus ditolak, bukan disimpan
    const idKelasSebelum = readSheetAsObjects_('Kelas').map(function (k) { return String(k.id_kelas || '').trim(); });
    const cf = commitImport(mockToken, 'Kelas', 'nama_kelas\n' + namaFormula);
    const barisBaru = readSheetAsObjects_('Kelas').filter(function (k) {
      return idKelasSebelum.indexOf(String(k.id_kelas || '').trim()) === -1;
    })[0] || null;
    if (cf.saved === 0 && !barisBaru) {
      results.push('[OK] Nilai berawalan "=" ditolak (tidak jadi rumus)');
    } else {
      results.push('[GAGAL] Formula injection: saved=' + cf.saved +
        ', baris baru=' + JSON.stringify(barisBaru || null));
      allPassed = false;
    }

    // 5. Guru: NIP 18 digit + akun otomatis
    const textGuru = 'nip\tnama\n' + nip18 + '\t' + namaGuru;
    const cg = commitImport(mockToken, 'Guru', textGuru);
    const guruRow = findRowByKey_('Guru', 'nip', nip18);
    const guruUser = findRowByKey_('Users', 'ref_id', nip18);
    check(cg.saved === 1 && !!guruRow && typeof guruRow.nip === 'string' && guruRow.nip === nip18,
      'Guru tersimpan dengan NIP 18 digit persis dan bertipe teks',
      'NIP 18 digit berubah/tidak tersimpan: ' + (guruRow ? typeof guruRow.nip + ' / ' + guruRow.nip : 'baris tidak ditemukan'));
    check(!!guruUser && guruUser.role === 'Guru' && typeof guruUser.username === 'string' &&
      guruUser.username === nip18 && (guruUser.wajib_ganti_password === true || String(guruUser.wajib_ganti_password) === 'true'),
      'Akun Guru dibuat otomatis (username=NIP, wajib_ganti_password=true)',
      'Akun Guru hasil import tidak sesuai');

    // 6. Siswa: NIS berawalan nol + referensi kelas + akun
    const textSiswa = 'nis\tnama\tnama_kelas\tkartu_kontrol\n' + nisZero + '\t' + namaSiswa + '\t' + testKelas + '\tYa';
    const cs = commitImport(mockToken, 'Siswa', textSiswa);
    const siswaRow = findRowByKey_('Siswa', 'nis', nisZero);
    const siswaUser = findRowByKey_('Users', 'ref_id', nisZero);
    check(cs.saved === 1 && !!siswaRow && typeof siswaRow.nis === 'string' && siswaRow.nis === nisZero,
      'Siswa tersimpan dengan NIS berawalan nol persis dan bertipe teks',
      'NIS berawalan nol berubah/tidak tersimpan: ' + (siswaRow ? typeof siswaRow.nis + ' / ' + siswaRow.nis : 'baris tidak ditemukan'));
    check(!!siswaUser && siswaUser.role === 'Siswa',
      'Akun Siswa dibuat otomatis lewat import',
      'Akun Siswa hasil import tidak ditemukan');

    // 7. Referensi kelas tidak ada ditolak
    const badRef = previewImport(mockToken, 'Siswa',
      'nis\tnama\tnama_kelas\tkartu_kontrol\n0' + suffix + '\tTEST_Salah\tTEST_KELAS_TIDAK_ADA\tTidak');
    check(!badRef.fatal && badRef.rows[0] && badRef.rows[0].status === 'error' &&
      /tidak ditemukan/.test(badRef.rows[0].errors.join(' ')),
      'Referensi kelas tidak ada ditolak per baris',
      'Referensi kelas tidak ada tidak ditolak');

    // 8. Jadwal (jika ada semester aktif)
    if (sem) {
      const textJadwal = 'tahun_ajaran\tsemester\tnama_kelas\tnama_mapel\tnip_guru\thari\tjam_mulai\tjam_selesai\n' +
        sem.tahun_ajaran + '\t' + sem.semester + '\t' + testKelas + '\t' + testMapel + '\t' + nip18 + '\tSabtu\t22:00\t22:30';
      const prevJ = previewImport(mockToken, 'Jadwal', textJadwal);
      if (prevJ.rows[0] && prevJ.rows[0].status === 'ok') {
        const cj = commitImport(mockToken, 'Jadwal', textJadwal);
        const rowsJ = readSheetAsObjects_('Jadwal').filter(function (j) {
          return String(j.nip_guru) === nip18 && String(j.hari) === 'Sabtu' && jamText_(j.jam_mulai) === '22:00';
        });
        check(cj.saved === 1 && rowsJ.length === 1,
          'Jadwal import tersimpan dengan referensi nama -> ID',
          'Jadwal import gagal tersimpan');
        const cj2 = previewImport(mockToken, 'Jadwal', textJadwal);
        check(cj2.rows[0].status === 'error' && /sudah ada|identik/.test(cj2.rows[0].errors.join(' ')),
          'Tempel ulang Jadwal identik ditolak',
          'Tempel ulang Jadwal tidak ditolak');
      } else {
        results.push('[PERHATIAN] Jadwal uji tidak bisa divalidasi (kemungkinan bentrok jam uji): ' +
          (prevJ.rows[0] ? prevJ.rows[0].errors.join(' ') : prevJ.fatal));
      }
    } else {
      results.push('[PERHATIAN] Tidak ada semester aktif; uji import Jadwal dilewati. Buat dan aktifkan 1 semester di menu Semester & Jadwal, lalu jalankan ulang testT05.');
    }

  } catch (err) {
    results.push('[ERROR FATAL] ' + err.message);
    allPassed = false;
  } finally {
    // Bersihkan data uji (Kelas/Mapel memakai id hasil generate, bukan nama)
    try {
      readSheetAsObjects_('Jadwal').filter(function (j) {
        return String(j.nip_guru) === nip18;
      }).forEach(function (j) { deleteJadwal(mockToken, j.id_jadwal); });
    } catch (e) { /* abaikan */ }
    try { deleteEntity(mockToken, 'Siswa', nisZero); } catch (e) { /* abaikan */ }
    try {
      const kRow = findRowByKey_('Kelas', 'nama_kelas', testKelas);
      if (kRow) deleteEntity(mockToken, 'Kelas', kRow.id_kelas);
    } catch (e) { /* abaikan */ }
    try {
      const mRow = findRowByKey_('Mapel', 'nama_mapel', testMapel);
      if (mRow) deleteEntity(mockToken, 'Mapel', mRow.id_mapel);
    } catch (e) { /* abaikan */ }
    try { deleteEntity(mockToken, 'Guru', nip18); } catch (e) { /* abaikan */ }
    try {
      // Hapus akun uji (deleteEntity hanya menonaktifkan)
      const uSheet = getSpreadsheet_().getSheetByName('Users');
      if (uSheet) {
        const uData = uSheet.getDataRange().getValues();
        const refIdx = uData[0].indexOf('ref_id');
        if (refIdx !== -1) {
          for (let r = uData.length - 1; r >= 1; r--) {
            const ref = String(uData[r][refIdx]).trim();
            if (ref === nip18 || ref === nisZero) uSheet.deleteRow(r + 1);
          }
        }
      }
    } catch (e) { /* abaikan */ }
    cache.remove(mockToken);
    results.push('[OK] Pembersihan data uji selesai');
  }

  const summary = `Hasil Uji testT05: ${allPassed ? 'SEMUA UJI IMPORT LULUS' : 'ADA KEGAGALAN'}\n` + results.join('\n');
  Logger.log(summary);
  return summary;
}

/**
 * Fungsi uji otomatis T06 untuk dijalankan di editor Apps Script oleh pemilik script.
 */
function testT06() {
  requireEditorOwner_();
  const ss = getSpreadsheet_();
  const results = [];
  let allPassed = true;

  function check(condition, desc, errorMsg) {
    if (condition) {
      results.push('[OK] ' + desc);
    } else {
      results.push('[GAGAL] ' + desc + ' - ' + (errorMsg || ''));
      allPassed = false;
    }
  }

  // Helper pembersih data uji TEST_
  function cleanTestData() {
    const sheetsToClean = ['Presensi', 'Jadwal', 'Semester', 'Siswa', 'Guru', 'Kelas', 'Mapel', 'Users', 'Izin'];
    sheetsToClean.forEach(function (sheetName) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;
      const data = sheet.getDataRange().getValues();
      for (let r = data.length - 1; r >= 1; r--) {
        const isTestRow = data[r].some(function (cell) {
          return String(cell || '').trim().startsWith('TEST_');
        });
        if (isTestRow) {
          sheet.deleteRow(r + 1);
        }
      }
    });
  }

  cleanTestData();

  try {
    const semAktif = getSemesterAktif_();
    if (!semAktif) {
      throw new Error('testT06 memerlukan 1 semester aktif. testT04 membersihkan semester ujinya, jadi buat dan aktifkan 1 semester di menu Semester & Jadwal, lalu jalankan ulang testT06.');
    }

    const testId = 'TEST_' + Utilities.getUuid().replace(/-/g, '').slice(0, 6);
    const idKelas = testId + '_K1';
    const idMapel = testId + '_M1';
    const nipGuruA = testId + '_G1';
    const nipGuruB = testId + '_G2';
    const nisSiswa1 = testId + '_S1';
    const nisSiswa2 = testId + '_S2';
    const idJadwalA = testId + '_J1';

    // 1. Siapkan master data
    const todayStr = getTodayYmd_();
    const testLock = LockService.getScriptLock();
    testLock.waitLock(10000);
    try {
      appendRow_('Kelas', { id_kelas: idKelas, nama_kelas: 'Kelas Uji T06' });
      appendRow_('Mapel', { id_mapel: idMapel, nama_mapel: 'Mapel Uji T06' });
      appendRow_('Guru', { nip: nipGuruA, nama: 'Guru A Uji' });
      appendRow_('Guru', { nip: nipGuruB, nama: 'Guru B Uji' });
      appendRow_('Siswa', { nis: nisSiswa1, nama: 'Siswa 1 Uji', id_kelas: idKelas, kartu_kontrol: 'Tidak' });
      appendRow_('Siswa', { nis: nisSiswa2, nama: 'Siswa 2 Uji', id_kelas: idKelas, kartu_kontrol: 'Tidak' });

      // Jadwal hari ini
      const todayHari = hariDariTanggal_(todayStr);
      appendRow_('Jadwal', {
        id_jadwal: idJadwalA,
        id_semester: semAktif.id_semester,
        id_kelas: idKelas,
        id_mapel: idMapel,
        nip_guru: nipGuruA,
        hari: todayHari,
        jam_mulai: '07:30',
        jam_selesai: '09:00'
      });
    } finally {
      testLock.releaseLock();
    }

    // Buat sesi untuk Guru A
    const tokenGuruA = 'TEST_TOKEN_' + Utilities.getUuid();
    CacheService.getScriptCache().put(tokenGuruA, JSON.stringify({
      id_user: 'USR_' + nipGuruA,
      username: nipGuruA,
      role: 'Guru',
      ref_id: nipGuruA,
      wajib_ganti_password: false
    }), 3600);

    // Buat sesi untuk Guru B
    const tokenGuruB = 'TEST_TOKEN_' + Utilities.getUuid();
    CacheService.getScriptCache().put(tokenGuruB, JSON.stringify({
      id_user: 'USR_' + nipGuruB,
      username: nipGuruB,
      role: 'Guru',
      ref_id: nipGuruB,
      wajib_ganti_password: false
    }), 3600);

    // Test 1: getJadwalGuru mengembalikan jadwal dengan status 'Belum diisi'
    const jadwalRes = getJadwalGuru(tokenGuruA, todayStr);
    const targetJadwal = (jadwalRes.jadwal || []).find(function (j) { return j.id_jadwal === idJadwalA; });
    check(targetJadwal && targetJadwal.status_presensi === 'Belum diisi',
      'getJadwalGuru menampilkan jadwal dengan status "Belum diisi"');

    // Test 2: getFormPresensi mengembalikan daftar siswa dengan default Hadir
    const formRes = getFormPresensi(tokenGuruA, idJadwalA, todayStr);
    check(formRes.mode === 'new' && formRes.students.length === 2 && formRes.students[0].status === 'Hadir',
      'getFormPresensi mode new dan default Hadir');

    // Test 3: savePresensi menyimpan data
    const rowsToSave = [
      { nis: nisSiswa1, status: 'Hadir', keterangan: '' },
      { nis: nisSiswa2, status: 'Sakit', keterangan: 'Demam tinggi' }
    ];
    const saveRes1 = savePresensi(tokenGuruA, idJadwalA, todayStr, rowsToSave);
    check(saveRes1.success && saveRes1.count === 2, 'savePresensi berhasil menyimpan');

    // Cek status getJadwalGuru setelah simpan menjadi 'Sudah diisi'
    const jadwalRes2 = getJadwalGuru(tokenGuruA, todayStr);
    const targetJadwal2 = (jadwalRes2.jadwal || []).find(function (j) { return j.id_jadwal === idJadwalA; });
    check(targetJadwal2 && targetJadwal2.status_presensi === 'Sudah diisi',
      'getJadwalGuru menampilkan status "Sudah diisi" setelah disimpan');

    // Test 4: Simpan kembali (mode edit) tidak menambah baris baru
    const pSheet = ss.getSheetByName('Presensi');
    const countBefore = pSheet.getLastRow();
    const rowsToEdit = [
      { nis: nisSiswa1, status: 'Izin', keterangan: 'Acara keluarga' },
      { nis: nisSiswa2, status: 'Sakit', keterangan: 'Demam tinggi' }
    ];
    const saveRes2 = savePresensi(tokenGuruA, idJadwalA, todayStr, rowsToEdit);
    const countAfter = pSheet.getLastRow();
    check(countBefore === countAfter, 'Simpan ulang (edit) tidak menambah baris baru di sheet Presensi');

    // Test 5: Guru B tidak bisa menyimpan presensi milik Guru A
    let guruBRejected = false;
    try {
      savePresensi(tokenGuruB, idJadwalA, todayStr, rowsToSave);
    } catch (e) {
      guruBRejected = /bukan milik anda/i.test(e.message);
    }
    check(guruBRejected, 'Jadwal milik guru lain ditolak server');

    // Test 6: Tanggal masa depan ditolak server
    let futureRejected = false;
    try {
      savePresensi(tokenGuruA, idJadwalA, '2099-12-31', rowsToSave);
    } catch (e) {
      futureRejected = /masa depan/i.test(e.message);
    }
    check(futureRejected, 'Tanggal masa depan ditolak server');

    // Test 7: Kolom tanggal dan NIS tersimpan sebagai teks
    const presData = readSheetAsObjects_('Presensi');
    const savedRow = presData.find(function (r) {
      return String(r.id_jadwal || '').trim() === idJadwalA && String(r.nis || '').trim() === nisSiswa1;
    });
    check(savedRow && typeof savedRow.tanggal === 'string' && savedRow.tanggal.length === 10,
      'Kolom tanggal tersimpan sebagai teks string yyyy-MM-dd');

  } finally {
    cleanTestData();
  }

  const summary = 'Hasil Uji testT06: ' + (allPassed ? 'SEMUA UJI DASAR LULUS' : 'ADA KEGAGALAN') + '\n' + results.join('\n');
  Logger.log(summary);
  return summary;
}

/**
 * Uji otomatis T07 untuk dijalankan dari editor Apps Script oleh pemilik script.
 * Data uji berawalan TEST_ dan dibersihkan di akhir.
 */
function testT07() {
  requireEditorOwner_();
  const ss = getSpreadsheet_();
  const results = [];
  let allPassed = true;

  function check(condition, desc, errorMsg) {
    if (condition) {
      results.push('[OK] ' + desc);
    } else {
      results.push('[GAGAL] ' + desc + ' - ' + (errorMsg || ''));
      allPassed = false;
    }
  }

  const createdFileIds = [];

  // Helper pembersih data uji
  function cleanTestData() {
    const sheetsToClean = ['Izin', 'Presensi', 'Jadwal', 'Semester', 'Siswa', 'Guru', 'Kelas', 'Mapel', 'Users'];
    sheetsToClean.forEach(function (sheetName) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;
      const data = sheet.getDataRange().getValues();
      for (let r = data.length - 1; r >= 1; r--) {
        const isTestRow = data[r].some(function (cell) {
          return String(cell || '').trim().startsWith('TEST_');
        });
        if (isTestRow) {
          sheet.deleteRow(r + 1);
        }
      }
    });

    for (let f = 0; f < createdFileIds.length; f++) {
      try {
        DriveApp.getFileById(createdFileIds[f]).setTrashed(true);
      } catch (e) {}
    }
  }

  cleanTestData();

  try {
    const semAktif = getSemesterAktif_();
    if (!semAktif) {
      throw new Error('testT07 memerlukan 1 semester aktif. Buat dan aktifkan 1 semester di menu Semester & Jadwal, lalu jalankan ulang testT07.');
    }

    const testId = 'TEST_' + Utilities.getUuid().replace(/-/g, '').slice(0, 6);
    const idKelasA = testId + '_KA';
    const idKelasB = testId + '_KB';
    const idMapel = testId + '_M1';
    const nipGuru = testId + '_G1';
    const nisSiswaReguler = testId + '_SR';
    const nisSiswaKK = testId + '_SKK';
    const nisSiswaKelasLain = testId + '_SL';

    const nowMinutes = getCurrentTimeMinutes_();
    const openMulai = formatMenitKeJam_(Math.max(0, nowMinutes - 5));
    const openSelesai = formatMenitKeJam_(Math.min(1439, nowMinutes + 85));
    // Hindari jadwal "tutup" yang justru terbuka saat dites dini hari.
    const closedStartMin = nowMinutes >= 20 ? nowMinutes - 20 : nowMinutes + 20;
    const closedMulai = formatMenitKeJam_(closedStartMin);
    const closedSelesai = formatMenitKeJam_(Math.min(1439, closedStartMin + 60));

    const idJadwalOpen = testId + '_JO';
    const idJadwalClosed = testId + '_JC';

    const todayStr = getTodayYmd_();
    const todayHari = hariDariTanggal_(todayStr);

    // Siapkan master data uji di dalam lock
    const testLock = LockService.getScriptLock();
    testLock.waitLock(10000);
    try {
      appendRow_('Kelas', { id_kelas: idKelasA, nama_kelas: 'Kelas Uji T07 A' });
      appendRow_('Kelas', { id_kelas: idKelasB, nama_kelas: 'Kelas Uji T07 B' });
      appendRow_('Mapel', { id_mapel: idMapel, nama_mapel: 'Mapel Uji T07' });
      appendRow_('Guru', { nip: nipGuru, nama: 'Guru Uji T07' });
      appendRow_('Siswa', { nis: nisSiswaReguler, nama: 'Siswa Reguler Uji', id_kelas: idKelasA, kartu_kontrol: 'Tidak' });
      appendRow_('Siswa', { nis: nisSiswaKK, nama: 'Siswa Kartu Kontrol Uji', id_kelas: idKelasA, kartu_kontrol: 'Ya' });
      appendRow_('Siswa', { nis: nisSiswaKelasLain, nama: 'Siswa Kelas Lain Uji', id_kelas: idKelasB, kartu_kontrol: 'Tidak' });

      // Jadwal window buka (hari ini)
      appendRow_('Jadwal', {
        id_jadwal: idJadwalOpen,
        id_semester: semAktif.id_semester,
        id_kelas: idKelasA,
        id_mapel: idMapel,
        nip_guru: nipGuru,
        hari: todayHari,
        jam_mulai: openMulai,
        jam_selesai: openSelesai
      });

      // Jadwal window tutup (hari ini)
      appendRow_('Jadwal', {
        id_jadwal: idJadwalClosed,
        id_semester: semAktif.id_semester,
        id_kelas: idKelasA,
        id_mapel: idMapel,
        nip_guru: nipGuru,
        hari: todayHari,
        jam_mulai: closedMulai,
        jam_selesai: closedSelesai
      });
    } finally {
      testLock.releaseLock();
    }

    // Buat sesi siswa uji di CacheService
    const tokenReguler = 'TEST_TOKEN_' + Utilities.getUuid();
    CacheService.getScriptCache().put(tokenReguler, JSON.stringify({
      id_user: 'USR_' + nisSiswaReguler,
      username: nisSiswaReguler,
      role: 'Siswa',
      ref_id: nisSiswaReguler,
      wajib_ganti_password: false
    }), 3600);

    const tokenKK = 'TEST_TOKEN_' + Utilities.getUuid();
    CacheService.getScriptCache().put(tokenKK, JSON.stringify({
      id_user: 'USR_' + nisSiswaKK,
      username: nisSiswaKK,
      role: 'Siswa',
      ref_id: nisSiswaKK,
      wajib_ganti_password: false
    }), 3600);

    const tokenLain = 'TEST_TOKEN_' + Utilities.getUuid();
    CacheService.getScriptCache().put(tokenLain, JSON.stringify({
      id_user: 'USR_' + nisSiswaKelasLain,
      username: nisSiswaKelasLain,
      role: 'Siswa',
      ref_id: nisSiswaKelasLain,
      wajib_ganti_password: false
    }), 3600);

    // Dummy berkas PDF valid (%PDF)
    const validPdfB64 = Utilities.base64Encode([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
    const berkasPdfValid = {
      nama: 'surat_dokter.pdf',
      mime: 'application/pdf',
      base64: validPdfB64
    };

    // 1. Uji getJadwalSiswaHariIni menandai window dengan benar
    const jadwalListRes = getJadwalSiswaHariIni(tokenReguler);
    check(jadwalListRes && jadwalListRes.schedules.length === 2, 'getJadwalSiswaHariIni mengembalikan 2 jadwal kelas siswa');
    const itemOpen = jadwalListRes.schedules.find(function (x) { return x.id_jadwal === idJadwalOpen; });
    const itemClosed = jadwalListRes.schedules.find(function (x) { return x.id_jadwal === idJadwalClosed; });
    check(itemOpen && itemOpen.is_window_open === true, 'Jadwal yang dalam rentang 15 menit ditandai is_window_open = true');
    check(itemClosed && itemClosed.is_window_open === false, 'Jadwal di luar 15 menit ditandai is_window_open = false');

    // 2. Uji Izin tanpa berkas ditolak
    let errIzinNoFile = false;
    try {
      ajukanIzin(tokenReguler, idJadwalOpen, 'Izin', 'Ada urusan keluarga penting', null);
    } catch (e) {
      errIzinNoFile = e.message.indexOf('wajib melampirkan berkas') !== -1;
    }
    check(errIzinNoFile, 'Pengajuan Izin tanpa berkas ditolak server');

    // 3. Uji jadwal kelas lain ditolak
    let errOtherClass = false;
    try {
      ajukanIzin(tokenLain, idJadwalOpen, 'Sakit', 'Sakit kepala', null);
    } catch (e) {
      errOtherClass = e.message.indexOf('bukan milik kelas Anda') !== -1;
    }
    check(errOtherClass, 'Pengajuan untuk jadwal milik kelas lain ditolak');

    // 4. Uji jadwal yang window-nya sudah lewat ditolak
    let errWindowClosed = false;
    try {
      ajukanIzin(tokenReguler, idJadwalClosed, 'Sakit', 'Demam tinggi', null);
    } catch (e) {
      errWindowClosed = e.message.indexOf('Batas waktu pengajuan telah berakhir') !== -1;
    }
    check(errWindowClosed, 'Pengajuan di luar window 15 menit ditolak server');

    // 5. Uji Sakit oleh siswa reguler tanpa berkas -> status 'Menunggu bukti'
    const resSakitReguler = ajukanIzin(tokenReguler, idJadwalOpen, 'Sakit', 'Demam pusing', null);
    check(resSakitReguler && resSakitReguler.status === 'Menunggu bukti', 'Sakit oleh siswa reguler menghasilkan status Menunggu bukti');

    // 6. Uji pengajuan ganda ditolak
    let errDuplicate = false;
    try {
      ajukanIzin(tokenReguler, idJadwalOpen, 'Sakit', 'Coba ajukan lagi', null);
    } catch (e) {
      errDuplicate = e.message.indexOf('sudah pernah dikirim') !== -1;
    }
    check(errDuplicate, 'Pengajuan ganda untuk jadwal & tanggal yang sama ditolak');

    // 7. Uji unggah bukti susulan mengubah status menjadi 'Menunggu persetujuan' dan file tersimpan
    const resUnggah = unggahBukti(tokenReguler, resSakitReguler.id_izin, berkasPdfValid);
    check(resUnggah && resUnggah.status === 'Menunggu persetujuan', 'unggahBukti mengubah status menjadi Menunggu persetujuan');

    // Verifikasi baris di sheet Izin dan berkas di Drive
    const izinRow = findRowByKey_('Izin', 'id_izin', resSakitReguler.id_izin);
    check(izinRow && izinRow.status === 'Menunggu persetujuan', 'Sheet Izin diperbarui menjadi Menunggu persetujuan');
    check(izinRow && String(izinRow.link_bukti || '').startsWith('http'), 'link_bukti tercatat dengan URL Google Drive');

    // Ambil ID berkas dari link_bukti untuk cleanup
    if (izinRow && izinRow.link_bukti) {
      const matchId = String(izinRow.link_bukti).match(/[-\w]{25,}/);
      if (matchId) createdFileIds.push(matchId[0]);
    }

    // 8. Uji integrasi helper T06 getIzinMarkers_
    const markers = getIzinMarkers_(idJadwalOpen, todayStr);
    check(markers && markers[nisSiswaReguler] && markers[nisSiswaReguler].status === 'Menunggu persetujuan',
      'getIzinMarkers_ (T06) berhasil mendeteksi permohonan siswa');

    // 9. Uji getPengajuanSaya mengembalikan data tanpa link_bukti
    const myHistory = getPengajuanSaya(tokenReguler);
    check(myHistory && myHistory.length > 0, 'getPengajuanSaya mengembalikan daftar riwayat pengajuan');
    const myItem = myHistory.find(function (x) { return x.id_izin === resSakitReguler.id_izin; });
    check(myItem && myItem.link_bukti === undefined, 'getPengajuanSaya TIDAK menyertakan properti link_bukti');

  } finally {
    cleanTestData();
  }

  const summary = 'Hasil Uji testT07: ' + (allPassed ? 'SEMUA UJI DASAR LULUS' : 'ADA KEGAGALAN') + '\n' + results.join('\n');
  Logger.log(summary);
  return summary;
}

/**
 * Uji otomatis T08 untuk dijalankan dari editor Apps Script oleh pemilik script.
 * Catatan: tolakPengajuanKedaluwarsa_ dibatasi ke id_izin uji (TEST_) agar data
 * nyata tidak ikut ditolak.
 */
function testT08() {
  requireEditorOwner_();
  const ss = getSpreadsheet_();
  const results = [];
  let allPassed = true;

  function check(condition, desc, errorMsg) {
    if (condition) {
      results.push('[OK] ' + desc);
    } else {
      results.push('[GAGAL] ' + desc + ' - ' + (errorMsg || ''));
      allPassed = false;
    }
  }

  const createdFileIds = [];

  function cleanTestData() {
    ['Izin', 'Presensi', 'Jadwal', 'Semester', 'Siswa', 'Guru', 'Kelas', 'Mapel', 'Users'].forEach(function (sheetName) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;
      const data = sheet.getDataRange().getValues();
      for (let r = data.length - 1; r >= 1; r--) {
        const isTestRow = data[r].some(function (cell) {
          return String(cell || '').trim().startsWith('TEST_');
        });
        if (isTestRow) sheet.deleteRow(r + 1);
      }
    });
    for (let f = 0; f < createdFileIds.length; f++) {
      try { DriveApp.getFileById(createdFileIds[f]).setTrashed(true); } catch (e) {}
    }
  }

  cleanTestData();

  try {
    const semAktif = getSemesterAktif_();
    if (!semAktif) {
      throw new Error('testT08 memerlukan 1 semester aktif. Buat dan aktifkan 1 semester di menu Semester & Jadwal, lalu jalankan ulang testT08.');
    }

    const testId = 'TEST_' + Utilities.getUuid().replace(/-/g, '').slice(0, 6);
    const idKelas = testId + '_K1';
    const idMapel = testId + '_M1';
    const nipA = testId + '_G1';
    const nipB = testId + '_G2';
    const nis1 = testId + '_S1';
    const nis2 = testId + '_S2';
    const nis3 = testId + '_S3';
    const idJadwalA = testId + '_JA';
    const idJadwalB = testId + '_JB';
    const izn1 = testId + '_I1';
    const izn2 = testId + '_I2';
    const izn3 = testId + '_I3';
    const izn4 = testId + '_I4';
    const izn5 = testId + '_I5';

    const todayStr = getTodayYmd_();
    const todayHari = hariDariTanggal_(todayStr);
    const nowIso = Utilities.formatDate(new Date(), getAppTimeZone_(), "yyyy-MM-dd'T'HH:mm:ssXXX");
    const validPdfB64 = Utilities.base64Encode([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);

    let linkBukti = '';
    const testLock = LockService.getScriptLock();
    testLock.waitLock(15000);
    try {
      appendRow_('Kelas', { id_kelas: idKelas, nama_kelas: 'Kelas Uji T08' });
      appendRow_('Mapel', { id_mapel: idMapel, nama_mapel: 'Mapel Uji T08' });
      appendRow_('Guru', { nip: nipA, nama: 'Guru A Uji T08' });
      appendRow_('Guru', { nip: nipB, nama: 'Guru B Uji T08' });
      appendRow_('Siswa', { nis: nis1, nama: 'Siswa 1 Uji T08', id_kelas: idKelas, kartu_kontrol: 'Tidak' });
      appendRow_('Siswa', { nis: nis2, nama: 'Siswa 2 Uji T08', id_kelas: idKelas, kartu_kontrol: 'Tidak' });
      appendRow_('Siswa', { nis: nis3, nama: 'Siswa 3 Uji T08', id_kelas: idKelas, kartu_kontrol: 'Tidak' });

      [idJadwalA, idJadwalB].forEach(function (idJadwal, i) {
        appendRow_('Jadwal', {
          id_jadwal: idJadwal,
          id_semester: semAktif.id_semester,
          id_kelas: idKelas,
          id_mapel: idMapel,
          nip_guru: i === 0 ? nipA : nipB,
          hari: todayHari,
          jam_mulai: '07:30',
          jam_selesai: '09:00'
        });
      });

      const folder = getOrCreateBuktiFolder_();
      const file = folder.createFile(Utilities.newBlob(
        Utilities.base64Decode(validPdfB64), 'application/pdf', testId + '_bukti.pdf'
      ));
      createdFileIds.push(file.getId());
      linkBukti = file.getUrl();

      appendRow_('Izin', {
        id_izin: izn1, nis: nis1, id_jadwal: idJadwalA, tanggal: todayStr, jenis: 'Sakit',
        alasan: 'Demam tinggi', link_bukti: linkBukti, status: 'Menunggu persetujuan',
        diajukan_pada: nowIso, diproses_oleh: '', diproses_pada: '', catatan_guru: ''
      });
      appendRow_('Izin', {
        id_izin: izn2, nis: nis1, id_jadwal: idJadwalB, tanggal: todayStr, jenis: 'Izin',
        alasan: 'Acara keluarga', link_bukti: '', status: 'Menunggu persetujuan',
        diajukan_pada: nowIso, diproses_oleh: '', diproses_pada: '', catatan_guru: ''
      });
      appendRow_('Izin', {
        id_izin: izn3, nis: nis2, id_jadwal: idJadwalA, tanggal: todayStr, jenis: 'Izin',
        alasan: 'Kontrol dokter', link_bukti: '', status: 'Menunggu persetujuan',
        diajukan_pada: nowIso, diproses_oleh: '', diproses_pada: '', catatan_guru: ''
      });
      appendRow_('Izin', {
        id_izin: izn4, nis: nis1, id_jadwal: idJadwalA,
        tanggal: ymdPlusHari_(todayStr, -(BATAS_UNGGAH_HARI + 1)), jenis: 'Sakit',
        alasan: 'Demam', link_bukti: '', status: 'Menunggu bukti',
        diajukan_pada: nowIso, diproses_oleh: '', diproses_pada: '', catatan_guru: ''
      });
      appendRow_('Izin', {
        id_izin: izn5, nis: nis3, id_jadwal: idJadwalA, tanggal: todayStr, jenis: 'Sakit',
        alasan: 'Pusing', link_bukti: '', status: 'Menunggu bukti',
        diajukan_pada: nowIso, diproses_oleh: '', diproses_pada: '', catatan_guru: ''
      });

      // Presensi yang sudah diisi sebelum pengajuan disetujui (izn1).
      appendRow_('Presensi', {
        id_presensi: testId + '_P1', tanggal: todayStr, id_jadwal: idJadwalA, nis: nis1,
        status: 'Hadir', keterangan: '', diubah_oleh: nipA, diubah_pada: nowIso
      });
    } finally {
      testLock.releaseLock();
    }

    const tokenA = 'TEST_TOKEN_' + Utilities.getUuid();
    CacheService.getScriptCache().put(tokenA, JSON.stringify({
      id_user: 'USR_' + nipA, username: nipA, role: 'Guru', ref_id: nipA, wajib_ganti_password: false
    }), 3600);
    const tokenB = 'TEST_TOKEN_' + Utilities.getUuid();
    CacheService.getScriptCache().put(tokenB, JSON.stringify({
      id_user: 'USR_' + nipB, username: nipB, role: 'Guru', ref_id: nipB, wajib_ganti_password: false
    }), 3600);

    // 1. Daftar hanya untuk jadwal milik guru login
    const listA = getPengajuanGuru(tokenA);
    check(listA.some(function (x) { return x.id_izin === izn1; }), 'Guru melihat pengajuan pada jadwalnya');
    check(!listA.some(function (x) { return x.id_izin === izn2; }), 'Guru tidak melihat pengajuan jadwal guru lain');
    const item1 = listA.find(function (x) { return x.id_izin === izn1; });
    check(item1 && item1.link_bukti === undefined, 'getPengajuanGuru TIDAK menyertakan link_bukti');
    check(item1 && item1.ada_bukti === true, 'getPengajuanGuru menandai ada_bukti = true');

    // 2. Pratinjau bukti hanya untuk guru pemilik jadwal
    let errBuktiLain = false;
    try { getBuktiPengajuan(tokenB, izn1); } catch (e) {
      errBuktiLain = e.message.indexOf('bukan untuk jadwal Anda') !== -1;
    }
    check(errBuktiLain, 'Guru lain ditolak saat meminta pratinjau bukti');
    const bukti = getBuktiPengajuan(tokenA, izn1);
    check(bukti && String(bukti.data_url || '').indexOf('data:application/pdf;base64,') === 0,
      'getBuktiPengajuan mengirim isi berkas sebagai data URL');

    // 3. Guru lain tidak dapat memproses
    let errProsesLain = false;
    try { prosesPengajuan(tokenB, izn1, 'Disetujui', ''); } catch (e) {
      errProsesLain = e.message.indexOf('bukan untuk jadwal Anda') !== -1;
    }
    check(errProsesLain, 'Guru lain tidak dapat memproses pengajuan bukan miliknya');

    // 4. Setuju mengubah Presensi yang sudah ada + kolom proses terisi
    const resSetuju = prosesPengajuan(tokenA, izn1, 'Disetujui', '');
    const izin1Row = findRowByKey_('Izin', 'id_izin', izn1);
    check(resSetuju.success && izin1Row && izin1Row.status === 'Disetujui', 'prosesPengajuan menyetujui pengajuan');
    check(izin1Row && izin1Row.diproses_oleh === nipA && !!izin1Row.diproses_pada, 'diproses_oleh & diproses_pada terisi');
    const presensiNis1 = readSheetAsObjects_('Presensi').find(function (r) {
      return String(r.id_jadwal).trim() === idJadwalA && String(r.nis).trim() === nis1;
    });
    check(presensiNis1 && presensiNis1.status === 'Sakit', 'Presensi yang sudah ada berubah menjadi Sakit');

    // 5. Setuju tanpa baris Presensi: tidak membuat baris, form memakai default Disetujui
    const pSheet = ss.getSheetByName('Presensi');
    const presensiCountBefore = pSheet.getLastRow();
    prosesPengajuan(tokenA, izn3, 'Disetujui', '');
    check(pSheet.getLastRow() === presensiCountBefore, 'Setuju tidak membuat baris Presensi baru');
    const form = getFormPresensi(tokenA, idJadwalA, todayStr);
    const siswa2 = form.students.find(function (s) { return s.nis === nis2; });
    check(siswa2 && siswa2.status === 'Izin', 'getFormPresensi memakai pengajuan Disetujui sebagai default');

    // 6. Disetujui -> Ditolak mengembalikan Presensi ke Alpa
    prosesPengajuan(tokenA, izn1, 'Ditolak', 'Bukti tidak sesuai');
    const presensiNis1b = readSheetAsObjects_('Presensi').find(function (r) {
      return String(r.id_jadwal).trim() === idJadwalA && String(r.nis).trim() === nis1;
    });
    check(presensiNis1b && presensiNis1b.status === 'Alpa', 'Ditolak setelah Disetujui mengembalikan status ke Alpa');
    check(findRowByKey_('Izin', 'id_izin', izn1).catatan_guru === 'Bukti tidak sesuai', 'Catatan penolakan tersimpan');

    // 7. Penolakan otomatis hanya untuk Sakit "Menunggu bukti" yang lewat batas
    tolakPengajuanKedaluwarsa_([izn4, izn5]);
    const izin4Row = findRowByKey_('Izin', 'id_izin', izn4);
    const izin5Row = findRowByKey_('Izin', 'id_izin', izn5);
    check(izin4Row && izin4Row.status === 'Ditolak', 'Pengajuan Sakit lewat batas ditolak otomatis');
    check(izin4Row && izin4Row.diproses_oleh === 'SISTEM' &&
      izin4Row.catatan_guru === 'Ditolak otomatis: bukti tidak diunggah',
      'Penolakan otomatis mengisi SISTEM dan catatan baku');
    check(izin5Row && izin5Row.status === 'Menunggu bukti', 'Pengajuan Sakit dalam batas tidak ikut ditolak');

  } finally {
    cleanTestData();
  }

  const summary = 'Hasil Uji testT08: ' + (allPassed ? 'SEMUA UJI DASAR LULUS' : 'ADA KEGAGALAN') + '\n' + results.join('\n');
  Logger.log(summary);
  return summary;
}

/**
 * Uji otomatis T09 dari editor Apps Script. Tanpa menulis sheet.
 */
function testT09() {
  requireEditorOwner_();
  const results = [];
  let allPassed = true;

  function check(condition, desc, errorMsg) {
    if (condition) {
      results.push('[OK] ' + desc);
    } else {
      results.push('[GAGAL] ' + desc + ' - ' + (errorMsg || ''));
      allPassed = false;
    }
  }

  check(hitungPersenHadir_(3, 4) === '75.0', 'Persen hadir 3/4 = 75.0');
  check(hitungPersenHadir_(0, 0) === '-', 'Total 0 menampilkan "-"');

  const data = {
    jadwal: [
      { id_jadwal: 'T09_J1', id_semester: 'S1', id_kelas: 'K1', id_mapel: 'M1', nip_guru: 'G1' },
      { id_jadwal: 'T09_J2', id_semester: 'S1', id_kelas: 'K1', id_mapel: 'M2', nip_guru: 'G2' }
    ],
    siswa: [{ nis: '1', nama: 'A', id_kelas: 'K1' }],
    kelas: [{ id_kelas: 'K1', nama_kelas: 'Kelas Uji' }],
    mapel: [{ id_mapel: 'M1', nama_mapel: 'Mapel A' }, { id_mapel: 'M2', nama_mapel: 'Mapel B' }],
    presensi: [
      { tanggal: '2026-11-10', id_jadwal: 'T09_J1', nis: '1', status: 'Hadir' },
      { tanggal: '2026-11-10', id_jadwal: 'T09_J1', nis: '1', status: 'Alpa' },
      { tanggal: '2026-11-11', id_jadwal: 'T09_J2', nis: '1', status: 'Izin' }
    ]
  };
  const rows = agregasiRekap_(data, { id_semester: 'S1', group_by: 'kelas_mapel' });
  check(rows.length === 2 && rows[0].hadir === 1 && rows[0].alpa === 1 && rows[0].persen === '50.0',
    'Agregasi H/I/S/A dan persen benar');

  const harian = agregasiRekap_(data, {
    id_semester: 'S1', group_by: 'kelas_mapel',
    tanggal_dari: '2026-11-10', tanggal_sampai: '2026-11-10'
  });
  check(harian.length === 1 && harian[0].total === 2, 'Filter tanggal inklusif benar');

  const guru = agregasiRekap_(data, { id_semester: 'S1', group_by: 'kelas_mapel', nip_guru: 'G2' });
  check(guru.length === 1 && guru[0].nama_mapel === 'Mapel B', 'Isolasi guru hanya jadwal miliknya');

  const nama = namaFileRekap_(['../uji', 'Ganjil'], '2026-11-18');
  check(/^Rekap_Presensi_[A-Za-z0-9._-]+\.xlsx$/.test(nama), 'Nama file ekspor aman', nama);

  const tokenAdmin = 'TEST_T09_ADMIN_' + Utilities.getUuid();
  CacheService.getScriptCache().put(tokenAdmin, JSON.stringify({
    id_user: 'USR_T09', username: 'uji', role: 'Admin', ref_id: '', wajib_ganti_password: false
  }), 600);
  let ditolak = false;
  try { getRekapSiswa(tokenAdmin, {}); } catch (e) {
    ditolak = e.message.indexOf('Akses ditolak') !== -1;
  }
  check(ditolak, 'Role guard server menolak Admin pada getRekapSiswa');
  CacheService.getScriptCache().remove(tokenAdmin);

  const summary = 'Hasil Uji testT09: ' + (allPassed ? 'SEMUA UJI DASAR LULUS' : 'ADA KEGAGALAN') + '\n' + results.join('\n');
  Logger.log(summary);
  return summary;
}

/**
 * Uji otomatis T10 dari editor Apps Script. Hanya membaca sheet (tanpa menulis).
 */
function testT10() {
  requireEditorOwner_();
  const results = [];
  let allPassed = true;

  function check(condition, desc, errorMsg) {
    if (condition) {
      results.push('[OK] ' + desc);
    } else {
      results.push('[GAGAL] ' + desc + ' - ' + (errorMsg || ''));
      allPassed = false;
    }
  }

  const harian = hitungStatusPresensi_([
    { tanggal: '2026-11-18', id_jadwal: 'T10_J1', status: 'Hadir' },
    { tanggal: '2026-11-18', id_jadwal: 'T10_J1', status: 'Izin' },
    { tanggal: '2026-11-18', id_jadwal: 'T10_J1', status: 'Alpa' },
    { tanggal: '2026-11-18', id_jadwal: 'T10_J2', status: 'Sakit' }
  ], new Set(['T10_J1']), '2026-11-18');
  check(harian.total === 3 && harian.hadir === 1 && harian.izin === 1 && harian.alpa === 1 && harian.persen === '33.3',
    'Hitung per status menghormati tanggal dan jadwal semester aktif');

  const kosong = hitungStatusPresensi_([], new Set(), '2026-11-18');
  check(kosong.total === 0 && kosong.persen === '-', 'Kasus kosong menghasilkan nol dan persen "-"');

  const ringkas = ringkasRekap_([
    { hadir: 3, izin: 1, sakit: 0, alpa: 1, total: 5 },
    { hadir: 1, izin: 0, sakit: 1, alpa: 0, total: 2 }
  ]);
  check(ringkas.hadir === 4 && ringkas.total === 7 && ringkas.persen === '57.1', 'Ringkasan rekap menjumlah dan menghitung persen');
  check(ringkasRekap_([]).persen === '-', 'Ringkasan rekap kosong menampilkan "-"');

  check(hitungPengajuanMenunggu_([
    { id_jadwal: 'T10_J1', status: 'Menunggu persetujuan' },
    { id_jadwal: 'T10_J1', status: 'Menunggu bukti' },
    { id_jadwal: 'T10_J2', status: 'Menunggu persetujuan' }
  ], new Set(['T10_J1'])) === 1, 'Hitung pengajuan menunggu hanya jadwal guru dan status tepat');
  check(ambilPengajuanTerakhir_([], 'T10_SISWA') === null, 'Pengajuan terakhir tanpa data mengembalikan null');

  const cache = CacheService.getScriptCache();
  function buatToken(suffix, role, refId) {
    const token = 'TEST_T10_' + suffix + '_' + Utilities.getUuid();
    cache.put(token, JSON.stringify({
      id_user: 'USR_T10_' + suffix, username: suffix, role: role,
      ref_id: refId, wajib_ganti_password: false
    }), 600);
    return token;
  }
  const tokenAdmin = buatToken('ADMIN', 'Admin', '');
  const tokenGuru = buatToken('GURU', 'Guru', 'TEST_T10_GURU');
  const tokenSiswa = buatToken('SISWA', 'Siswa', 'TEST_T10_SISWA');

  try {
    const admin = getDashboardAdmin(tokenAdmin);
    check(typeof admin.total_siswa === 'number' && typeof admin.total_guru === 'number' &&
      typeof admin.total_kelas === 'number' && admin.presensi_hari_ini && admin.presensi_hari_ini.total >= 0,
      'getDashboardAdmin mengembalikan jumlah master dan presensi hari ini');

    const guru = getDashboardGuru(tokenGuru);
    check(Array.isArray(guru.jadwal) && typeof guru.pengajuan_menunggu === 'number' &&
      typeof guru.jumlah_belum_diisi === 'number',
      'getDashboardGuru mengembalikan jadwal hari ini dan pengajuan menunggu');

    const siswa = getDashboardSiswa(tokenSiswa);
    check(siswa.ringkasan && typeof siswa.ringkasan.total === 'number' &&
      (siswa.pengajuan_terakhir === null || typeof siswa.pengajuan_terakhir === 'object'),
      'getDashboardSiswa mengembalikan ringkasan hadir dan pengajuan terakhir');

    let ditolak = false;
    try { getDashboardAdmin(tokenGuru); } catch (e) {
      ditolak = e.message.indexOf('Akses ditolak') !== -1;
    }
    check(ditolak, 'Role guard server menolak Guru pada getDashboardAdmin');
  } finally {
    cache.remove(tokenAdmin);
    cache.remove(tokenGuru);
    cache.remove(tokenSiswa);
  }

  const summary = 'Hasil Uji testT10: ' + (allPassed ? 'SEMUA UJI DASAR LULUS' : 'ADA KEGAGALAN') + '\n' + results.join('\n');
  Logger.log(summary);
  return summary;
}
