/**
 * Aplikasi Presensi Sekolah - Master.gs (CRUD Data Master & Reset Password)
 * Zona Waktu: Asia/Makassar
 * Menggunakan mesin konfigurasi generik (Ponytail Principle: 1 mesin CRUD, bukan 4 salinan kode)
 */

// Konfigurasi lengkap 4 entitas data master
const ENTITY_CONFIG = {
  Kelas: {
    sheet: 'Kelas',
    key: 'id_kelas',
    fields: ['id_kelas', 'nama_kelas'],
    required: ['id_kelas', 'nama_kelas'],
    unique: ['id_kelas'],
    references: [],
    usedIn: [
      { sheet: 'Siswa', field: 'id_kelas', label: 'Siswa' },
      { sheet: 'Jadwal', field: 'id_kelas', label: 'Jadwal' }
    ],
    hasAccount: false
  },
  Guru: {
    sheet: 'Guru',
    key: 'nip',
    fields: ['nip', 'nama'],
    required: ['nip', 'nama'],
    unique: ['nip'],
    references: [],
    usedIn: [
      { sheet: 'Jadwal', field: 'nip_guru', label: 'Jadwal' }
    ],
    hasAccount: true,
    role: 'Guru'
  },
  Siswa: {
    sheet: 'Siswa',
    key: 'nis',
    fields: ['nis', 'nama', 'id_kelas', 'kartu_kontrol'],
    required: ['nis', 'nama', 'id_kelas'],
    unique: ['nis'],
    references: [
      { field: 'id_kelas', targetSheet: 'Kelas', targetField: 'id_kelas', label: 'Kelas' }
    ],
    usedIn: [
      { sheet: 'Presensi', field: 'nis', label: 'Presensi' },
      { sheet: 'Izin', field: 'nis', label: 'Izin' }
    ],
    hasAccount: true,
    role: 'Siswa'
  },
  Mapel: {
    sheet: 'Mapel',
    key: 'id_mapel',
    fields: ['id_mapel', 'nama_mapel'],
    required: ['id_mapel', 'nama_mapel'],
    unique: ['id_mapel'],
    references: [],
    usedIn: [
      { sheet: 'Jadwal', field: 'id_mapel', label: 'Jadwal' }
    ],
    hasAccount: false
  },
  Semester: {
    sheet: 'Semester',
    key: 'id_semester',
    fields: ['id_semester', 'tahun_ajaran', 'semester', 'status'],
    required: ['id_semester', 'tahun_ajaran', 'semester'],
    unique: ['id_semester'],
    autoId: 'SM',
    references: [],
    usedIn: [
      { sheet: 'Jadwal', field: 'id_semester', label: 'Jadwal' }
    ],
    validate: validateSemesterData_,
    deleteGuard: guardDeleteSemester_,
    hasAccount: false
  },
  Jadwal: {
    sheet: 'Jadwal',
    key: 'id_jadwal',
    fields: ['id_jadwal', 'id_semester', 'id_kelas', 'id_mapel', 'nip_guru', 'hari', 'jam_mulai', 'jam_selesai'],
    required: ['id_jadwal', 'id_semester', 'id_kelas', 'id_mapel', 'nip_guru', 'hari', 'jam_mulai', 'jam_selesai'],
    unique: ['id_jadwal'],
    autoId: 'JDW',
    references: [
      { field: 'id_semester', targetSheet: 'Semester', targetField: 'id_semester', label: 'Semester' },
      { field: 'id_kelas', targetSheet: 'Kelas', targetField: 'id_kelas', label: 'Kelas' },
      { field: 'id_mapel', targetSheet: 'Mapel', targetField: 'id_mapel', label: 'Mapel' },
      { field: 'nip_guru', targetSheet: 'Guru', targetField: 'nip', label: 'Guru' }
    ],
    usedIn: [
      { sheet: 'Presensi', field: 'id_jadwal', label: 'Presensi' },
      { sheet: 'Izin', field: 'id_jadwal', label: 'Izin' }
    ],
    validate: validateJadwalData_,
    hasAccount: false
  }
};

/**
 * Mengambil daftar data entitas master (dilindungi requireRole_ Admin)
 * @param {string} token
 * @param {string} entity - 'Kelas' | 'Guru' | 'Siswa' | 'Mapel'
 * @returns {Object} { success: true, entity, items, extra: { classes: [] } }
 */
function listEntity(token, entity) {
  requireRole_(token, ['Admin']);

  const config = ENTITY_CONFIG[entity];
  if (!config) {
    throw new Error('Entitas tidak valid: ' + entity);
  }

  const items = readSheetAsObjects_(config.sheet);

  // Jika entitas memiliki akun (Guru & Siswa), kaitkan status akun dari sheet Users
  if (config.hasAccount) {
    const users = readSheetAsObjects_('Users');
    const userMap = {};
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      if (u.role === config.role && u.ref_id) {
        userMap[String(u.ref_id).trim()] = {
          id_user: u.id_user,
          username: u.username,
          aktif: u.aktif === true || String(u.aktif).toUpperCase() === 'TRUE',
          wajib_ganti_password: u.wajib_ganti_password === true || String(u.wajib_ganti_password).toUpperCase() === 'TRUE'
        };
      }
    }

    for (let j = 0; j < items.length; j++) {
      const itemKey = String(items[j][config.key] || '').trim();
      items[j]._account = userMap[itemKey] || null;
    }
  }

  // Metadata tambahan untuk Siswa (daftar kelas & mapping nama kelas)
  let extra = {};
  if (entity === 'Siswa') {
    const classes = readSheetAsObjects_('Kelas');
    const classMap = {};
    for (let k = 0; k < classes.length; k++) {
      classMap[String(classes[k].id_kelas).trim()] = classes[k].nama_kelas;
    }
    for (let m = 0; m < items.length; m++) {
      const sKelas = String(items[m].id_kelas || '').trim();
      items[m]._nama_kelas = classMap[sKelas] || sKelas;
    }
    extra.classes = classes.map(c => ({
      id_kelas: String(c.id_kelas).trim(),
      nama_kelas: String(c.nama_kelas).trim()
    }));
  }

  return {
    success: true,
    entity: entity,
    items: items,
    extra: extra
  };
}

/**
 * Menyimpan data entitas master (tambah atau edit, dilindungi requireRole_ Admin)
 * @param {string} token
 * @param {string} entity - 'Kelas' | 'Guru' | 'Siswa' | 'Mapel'
 * @param {Object} data - Objek data kolom
 * @param {string} mode - 'add' | 'edit'
 * @returns {Object} { success: true, message: string, data: Object }
 */
function saveEntity(token, entity, data, mode) {
  requireRole_(token, ['Admin']);

  const config = ENTITY_CONFIG[entity];
  if (!config) {
    throw new Error('Entitas tidak valid: ' + entity);
  }

  if (mode !== 'add' && mode !== 'edit') {
    throw new Error('Mode penyimpanan tidak valid: harus "add" atau "edit"');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Data tidak valid');
  }

  // Bersihkan data dan trim semua string
  const cleanData = {};
  for (let i = 0; i < config.fields.length; i++) {
    const f = config.fields[i];
    let val = data[f];
    if (typeof val === 'string') {
      val = val.trim();
    } else if (typeof val === 'number') {
      val = String(val).trim();
    }
    cleanData[f] = (val !== undefined && val !== null) ? val : '';
  }

  // Khusus Siswa: kartu_kontrol disimpan "Ya" / "Tidak" (default "Tidak")
  if (entity === 'Siswa') {
    const isKK = cleanData.kartu_kontrol === 'Ya' || cleanData.kartu_kontrol === true || cleanData.kartu_kontrol === 'true';
    cleanData.kartu_kontrol = isKK ? 'Ya' : 'Tidak';
  }

  // ID otomatis untuk entitas yang memakai autoId (Semester, Jadwal)
  if (config.autoId && mode === 'add' && !cleanData[config.key]) {
    cleanData[config.key] = generateId_(config.autoId);
  }

  // Validasi kolom wajib
  for (let j = 0; j < config.required.length; j++) {
    const reqField = config.required[j];
    if (!cleanData[reqField] || String(cleanData[reqField]).trim() === '') {
      throw new Error('Kolom ' + reqField.toUpperCase() + ' wajib diisi');
    }
  }

  // Tolak nilai yang akan dieksekusi sebagai rumus; format '@' tidak menahan.
  for (let j = 0; j < config.fields.length; j++) {
    if (awalanFormula_(cleanData[config.fields[j]])) {
      throw new Error('Kolom ' + config.fields[j].toUpperCase() + ' tidak boleh diawali = + - @');
    }
  }

  // Concurrency Lock untuk mencegah race condition (10 detik)
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(config.sheet);
    if (!sheet) {
      throw new Error('Sheet ' + config.sheet + ' tidak ditemukan');
    }

    // Validasi referensi relasi di dalam lock agar tidak balapan dengan penghapusan master
    for (let k = 0; k < config.references.length; k++) {
      const ref = config.references[k];
      const refVal = cleanData[ref.field];
      if (refVal) {
        const targetRow = findRowByKey_(ref.targetSheet, ref.targetField, refVal);
        if (!targetRow) {
          throw new Error(ref.label + ' dengan kode "' + refVal + '" tidak ditemukan di data master');
        }
      }
    }

    const sheetData = sheet.getDataRange().getValues();
    const headers = sheetData[0];
    const keyIndex = headers.indexOf(config.key);
    if (keyIndex === -1) {
      throw new Error('Kolom kunci ' + config.key + ' tidak ditemukan pada header sheet ' + config.sheet);
    }

    const primaryKeyVal = String(cleanData[config.key]).trim();
    const primaryKeyLower = primaryKeyVal.toLowerCase();

    if (mode === 'add') {
      // 1. Cek duplikasi nilai unik di sheet entitas
      for (let u = 0; u < config.unique.length; u++) {
        const uCol = config.unique[u];
        const uIdx = headers.indexOf(uCol);
        if (uIdx !== -1) {
          const valToCheck = String(cleanData[uCol]).trim().toLowerCase();
          for (let r = 1; r < sheetData.length; r++) {
            if (String(sheetData[r][uIdx]).trim().toLowerCase() === valToCheck) {
              throw new Error(uCol.toUpperCase() + ' "' + cleanData[uCol] + '" sudah terdaftar');
            }
          }
        }
      }

      // 2. Tulis baris baru ke sheet entitas
      if (config.validate) config.validate(cleanData, sheetData, headers, -1);
      appendRow_(config.sheet, cleanData);

      // 3. Jika entitas memiliki akun (Guru & Siswa), otomatis buat akun di Users
      if (config.hasAccount) {
        const existingUser = findUserByUsername_(primaryKeyLower);
        if (existingUser) {
          // Jika akun sudah ada tapi nonaktif, aktifkan kembali dan reset password
          const uSheet = ss.getSheetByName('Users');
          const uHeaders = uSheet.getRange(1, 1, 1, uSheet.getLastColumn()).getValues()[0];
          const pIdx = uHeaders.indexOf('password_hash');
          const sIdx = uHeaders.indexOf('salt');
          const wIdx = uHeaders.indexOf('wajib_ganti_password');
          const aIdx = uHeaders.indexOf('aktif');
          const roleIdx = uHeaders.indexOf('role');
          const refIdx = uHeaders.indexOf('ref_id');

          const newSalt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
          const newHash = hashPassword_(primaryKeyVal, newSalt);
          const uRowNum = existingUser._rowNumber;
          const uRowVals = uSheet.getRange(uRowNum, 1, 1, uHeaders.length).getValues()[0];

          if (pIdx !== -1) uRowVals[pIdx] = newHash;
          if (sIdx !== -1) uRowVals[sIdx] = newSalt;
          if (wIdx !== -1) uRowVals[wIdx] = true;
          if (aIdx !== -1) uRowVals[aIdx] = true;
          if (roleIdx !== -1) uRowVals[roleIdx] = config.role;
          if (refIdx !== -1) uRowVals[refIdx] = primaryKeyVal;

          applyTextFormats_(uSheet, uHeaders, uRowNum, 1);
          uSheet.getRange(uRowNum, 1, 1, uHeaders.length).setValues([uRowVals]);
        } else {
          // Buat akun baru di Users (username & password awal = NIS/NIP)
          const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
          const passwordHash = hashPassword_(primaryKeyVal, salt);
          const newUser = {
            id_user: generateId_('USR'),
            username: primaryKeyVal,
            password_hash: passwordHash,
            salt: salt,
            role: config.role,
            ref_id: primaryKeyVal,
            wajib_ganti_password: true,
            aktif: true
          };
          appendRow_('Users', newUser);
        }
      }

      return {
        success: true,
        message: 'Data ' + entity + ' berhasil ditambahkan',
        data: cleanData
      };

    } else {
      // Mode EDIT
      let targetRowNum = -1;
      for (let r = 1; r < sheetData.length; r++) {
        if (String(sheetData[r][keyIndex]).trim().toLowerCase() === primaryKeyLower) {
          targetRowNum = r + 1;
          break;
        }
      }

      if (targetRowNum === -1) {
        throw new Error('Data ' + entity + ' dengan ' + config.key + ' "' + primaryKeyVal + '" tidak ditemukan');
      }

      // Cek keunikan kolom lain (selain baris yang diedit)
      for (let u2 = 0; u2 < config.unique.length; u2++) {
        const uCol2 = config.unique[u2];
        if (uCol2 === config.key) continue; // Kunci utama tidak berubah
        const uIdx2 = headers.indexOf(uCol2);
        if (uIdx2 !== -1) {
          const valToCheck2 = String(cleanData[uCol2]).trim().toLowerCase();
          for (let r2 = 1; r2 < sheetData.length; r2++) {
            if ((r2 + 1) !== targetRowNum && String(sheetData[r2][uIdx2]).trim().toLowerCase() === valToCheck2) {
              throw new Error(uCol2.toUpperCase() + ' "' + cleanData[uCol2] + '" sudah digunakan oleh data lain');
            }
          }
        }
      }

      // Perbarui baris pada sheet entitas secara batch
      if (config.validate) config.validate(cleanData, sheetData, headers, targetRowNum);
      const currentRowVals = sheetData[targetRowNum - 1];
      const updatedRowVals = [...currentRowVals];
      for (let c = 0; c < headers.length; c++) {
        const headerName = headers[c];
        if (cleanData[headerName] !== undefined) {
          updatedRowVals[c] = cleanData[headerName];
        }
      }
      applyTextFormats_(sheet, headers, targetRowNum, 1);
      sheet.getRange(targetRowNum, 1, 1, headers.length).setValues([updatedRowVals]);

      // Jika ada perubahan status aktif akun pengguna dari form edit
      if (config.hasAccount && data.aktif !== undefined) {
        const isAktif = data.aktif === true || String(data.aktif).toUpperCase() === 'TRUE';
        const userRow = findRowByKey_('Users', 'ref_id', primaryKeyVal);
        if (userRow) {
          const uSheet = ss.getSheetByName('Users');
          const uHeaders = uSheet.getRange(1, 1, 1, uSheet.getLastColumn()).getValues()[0];
          const aIdx = uHeaders.indexOf('aktif');
          if (aIdx !== -1) {
            uSheet.getRange(userRow._rowNumber, aIdx + 1).setValue(isAktif);
          }
        }
      }

      return {
        success: true,
        message: 'Data ' + entity + ' berhasil diperbarui',
        data: cleanData
      };
    }

  } finally {
    lock.releaseLock();
  }
}

/**
 * Menghapus data entitas master (dilindungi requireRole_ Admin & cek integritas relasi)
 * @param {string} token
 * @param {string} entity - 'Kelas' | 'Guru' | 'Siswa' | 'Mapel'
 * @param {string|number} key - Nilai primary key
 * @returns {Object} { success: true, message: string }
 */
function deleteEntity(token, entity, key) {
  requireRole_(token, ['Admin']);

  const config = ENTITY_CONFIG[entity];
  if (!config) {
    throw new Error('Entitas tidak valid: ' + entity);
  }

  const cleanKey = String(key !== undefined && key !== null ? key : '').trim();
  if (!cleanKey) {
    throw new Error('Kunci data ' + entity + ' wajib diisi');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();
    const searchTarget = cleanKey.toLowerCase();

    // 1. Cek apakah entitas masih digunakan di sheet lain (Integritas Relasi)
    for (let i = 0; i < config.usedIn.length; i++) {
      const check = config.usedIn[i];
      const targetSheet = ss.getSheetByName(check.sheet);
      if (targetSheet) {
        const tData = targetSheet.getDataRange().getValues();
        if (tData.length > 1) {
          const tHeaders = tData[0];
          const fIdx = tHeaders.indexOf(check.field);
          if (fIdx !== -1) {
            let count = 0;
            for (let r = 1; r < tData.length; r++) {
              if (String(tData[r][fIdx]).trim().toLowerCase() === searchTarget) {
                count++;
              }
            }
            if (count > 0) {
              throw new Error(
                'Tidak dapat menghapus ' + entity + ' "' + cleanKey + '" karena masih digunakan pada data ' +
                check.label + ' (' + count + ' data terhubung).'
              );
            }
          }
        }
      }
    }

    // 2. Cari baris di sheet entitas
    const sheet = ss.getSheetByName(config.sheet);
    if (!sheet) {
      throw new Error('Sheet ' + config.sheet + ' tidak ditemukan');
    }

    const sheetData = sheet.getDataRange().getValues();
    if (sheetData.length <= 1) {
      throw new Error('Data ' + entity + ' kosong');
    }

    const headers = sheetData[0];
    const keyIdx = headers.indexOf(config.key);
    if (keyIdx === -1) {
      throw new Error('Kolom kunci ' + config.key + ' tidak ditemukan');
    }

    let targetRowNum = -1;
    for (let r2 = 1; r2 < sheetData.length; r2++) {
      if (String(sheetData[r2][keyIdx]).trim().toLowerCase() === searchTarget) {
        targetRowNum = r2 + 1;
        break;
      }
    }

    if (targetRowNum === -1) {
      throw new Error('Data ' + entity + ' dengan ' + config.key + ' "' + cleanKey + '" tidak ditemukan');
    }

    // Aturan hapus khusus entitas (mis. Semester aktif tidak boleh dihapus)
    if (config.deleteGuard) {
      const rowObj = {};
      for (let rh = 0; rh < headers.length; rh++) rowObj[headers[rh]] = sheetData[targetRowNum - 1][rh];
      config.deleteGuard(rowObj, cleanKey);
    }

    // 3. Hapus baris dari sheet entitas
    sheet.deleteRow(targetRowNum);

    // 4. Jika entitas memiliki akun (Guru & Siswa), nonaktifkan akun di sheet Users
    if (config.hasAccount) {
      const uSheet = ss.getSheetByName('Users');
      if (uSheet) {
        const uData = uSheet.getDataRange().getValues();
        if (uData.length > 1) {
          const uHeaders = uData[0];
          const refIdx = uHeaders.indexOf('ref_id');
          const roleIdx = uHeaders.indexOf('role');
          const aIdx = uHeaders.indexOf('aktif');

          if (refIdx !== -1 && aIdx !== -1) {
            for (let ur = 1; ur < uData.length; ur++) {
              const rowRef = String(uData[ur][refIdx]).trim().toLowerCase();
              const rowRole = roleIdx !== -1 ? String(uData[ur][roleIdx]).trim() : '';
              if (rowRef === searchTarget && (!rowRole || rowRole === config.role)) {
                uSheet.getRange(ur + 1, aIdx + 1).setValue(false);
              }
            }
          }
        }
      }
    }

    return {
      success: true,
      message: 'Data ' + entity + ' "' + cleanKey + '" berhasil dihapus'
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Reset password akun ke NIS/NIP awal (dilindungi requireRole_ Admin)
 * Password di-hash ulang dengan salt baru, wajib_ganti_password disetel ke TRUE
 * @param {string} token
 * @param {string} ref_id - NIS atau NIP pengguna
 * @returns {Object} { success: true, message: string }
 */
function resetPassword(token, ref_id) {
  requireRole_(token, ['Admin']);

  const cleanRef = String(ref_id !== undefined && ref_id !== null ? ref_id : '').trim();
  if (!cleanRef) {
    throw new Error('NIS/NIP pengguna wajib diisi');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName('Users');
    if (!sheet) {
      throw new Error('Sheet Users tidak ditemukan');
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error('Sheet Users masih kosong');
    }

    const headers = data[0];
    const rIdx = headers.indexOf('ref_id');
    const uIdx = headers.indexOf('username');
    const pIdx = headers.indexOf('password_hash');
    const sIdx = headers.indexOf('salt');
    const wIdx = headers.indexOf('wajib_ganti_password');

    if (pIdx === -1 || sIdx === -1 || wIdx === -1) {
      throw new Error('Struktur kolom sheet Users tidak lengkap');
    }

    let targetRowNum = -1;
    const searchTarget = cleanRef.toLowerCase();
    for (let r = 1; r < data.length; r++) {
      const rowRef = rIdx !== -1 ? String(data[r][rIdx]).trim().toLowerCase() : '';
      const rowUser = uIdx !== -1 ? String(data[r][uIdx]).trim().toLowerCase() : '';
      if (rowRef === searchTarget || rowUser === searchTarget) {
        targetRowNum = r + 1;
        break;
      }
    }

    if (targetRowNum === -1) {
      throw new Error('Pengguna dengan NIS/NIP "' + cleanRef + '" tidak ditemukan di sheet Users');
    }

    // Hash ulang dengan salt baru (password = NIS/NIP)
    const newSalt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    const newHash = hashPassword_(cleanRef, newSalt);

    const rowData = sheet.getRange(targetRowNum, 1, 1, headers.length).getValues()[0];
    rowData[pIdx] = newHash;
    rowData[sIdx] = newSalt;
    rowData[wIdx] = true;

    sheet.getRange(targetRowNum, 1, 1, headers.length).setValues([rowData]);

    return {
      success: true,
      message: 'Password akun ' + cleanRef + ' berhasil direset ke nilai awal (NIS/NIP) dan wajib ganti password.'
    };

  } finally {
    lock.releaseLock();
  }
}

// ====================================================================
// T04: SEMESTER & JADWAL
// ====================================================================

// Hari yang boleh dipakai pada Jadwal (konstanta tunggal)
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Normalisasi jam ke teks "HH:mm" (dua digit). Mengembalikan '' jika tidak valid.
 * @param {*} nilai
 * @returns {string}
 */
function normalizeJam_(nilai) {
  const s = String(nilai === null || nilai === undefined ? '' : nilai).trim();
  const m = s.match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return '';
  const jam = Number(m[1]);
  const menit = Number(m[2]);
  if (jam > 23 || menit > 59) return '';
  return (jam < 10 ? '0' + jam : String(jam)) + ':' + m[2];
}

/**
 * @param {string} jam - teks "HH:mm"
 * @returns {number} menit sejak 00:00, atau -1 jika tidak valid
 */
function jamKeMenit_(jam) {
  const n = normalizeJam_(jam);
  if (!n) return -1;
  const p = n.split(':');
  return Number(p[0]) * 60 + Number(p[1]);
}

/**
 * Validasi tahun ajaran "2026/2027" (dua tahun berurutan). Fungsi murni.
 * @param {string} tahun
 * @returns {boolean}
 */
function tahunAjaranValid_(tahun) {
  const m = String(tahun || '').trim().match(/^(\d{4})\/(\d{4})$/);
  return !!m && Number(m[2]) === Number(m[1]) + 1;
}

/**
 * Dua jadwal bentrok jika semester + hari sama, jam beririsan, dan guru atau kelas sama.
 * Fungsi murni: jam harus sudah "HH:mm"; baris dengan id_jadwal sama diabaikan.
 * @returns {boolean}
 */
function jadwalBentrok_(a, b) {
  if (!a || !b) return false;
  if (a.id_jadwal && String(a.id_jadwal) === String(b.id_jadwal)) return false;
  if (String(a.id_semester) !== String(b.id_semester)) return false;
  if (String(a.hari) !== String(b.hari)) return false;
  const sameGuru = String(a.nip_guru) === String(b.nip_guru);
  const sameKelas = String(a.id_kelas) === String(b.id_kelas);
  if (!sameGuru && !sameKelas) return false;
  return String(a.jam_mulai) < String(b.jam_selesai) && String(b.jam_mulai) < String(a.jam_selesai);
}

/**
 * @returns {Object|null} baris pertama yang bentrok
 */
function findJadwalBentrok_(candidate, rows) {
  for (let i = 0; i < rows.length; i++) {
    if (jadwalBentrok_(candidate, rows[i])) return rows[i];
  }
  return null;
}

/**
 * Zona waktu aplikasi (appsscript.json), fallback Asia/Makassar.
 */
function getAppTimeZone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Makassar';
  } catch (e) {
    return 'Asia/Makassar';
  }
}

/**
 * Konversi nilai sel jam (bisa Date dari data lama) menjadi teks "HH:mm".
 */
function jamText_(nilai) {
  if (nilai instanceof Date) {
    return Utilities.formatDate(nilai, getAppTimeZone_(), 'HH:mm');
  }
  return normalizeJam_(nilai);
}

/**
 * Validasi khusus Semester: format tahun ajaran, nilai semester, kombinasi unik,
 * dan status hanya boleh diubah lewat setSemesterAktif().
 */
function validateSemesterData_(cleanData, sheetData, headers, selfRowNum) {
  const tahun = String(cleanData.tahun_ajaran || '').trim();
  const sem = String(cleanData.semester || '').trim();

  if (!tahunAjaranValid_(tahun)) {
    throw new Error('Tahun ajaran harus format "2026/2027" dengan dua tahun berurutan');
  }
  if (sem !== 'Ganjil' && sem !== 'Genap') {
    throw new Error('Semester harus "Ganjil" atau "Genap"');
  }
  cleanData.tahun_ajaran = tahun;
  cleanData.semester = sem;

  // Status dipertahankan saat edit; tambah data selalu "Tidak aktif" (aktivasi lewat setSemesterAktif)
  const stIdx = headers.indexOf('status');
  if (selfRowNum > 0 && stIdx !== -1) {
    cleanData.status = String(sheetData[selfRowNum - 1][stIdx] || '').trim() || 'Tidak aktif';
  } else {
    cleanData.status = 'Tidak aktif';
  }

  // Kombinasi tahun_ajaran + semester harus unik
  const tahunIdx = headers.indexOf('tahun_ajaran');
  const semIdx = headers.indexOf('semester');
  for (let r = 1; r < sheetData.length; r++) {
    if (r + 1 === selfRowNum) continue;
    if (String(sheetData[r][tahunIdx]).trim() === tahun && String(sheetData[r][semIdx]).trim() === sem) {
      throw new Error('Semester ' + tahun + ' ' + sem + ' sudah terdaftar');
    }
  }
}

/**
 * Semester aktif tidak boleh dihapus. Jadwal terkait sudah ditolak oleh usedIn.
 */
function guardDeleteSemester_(rowObj, key) {
  if (String(rowObj.status || '').trim() === 'Aktif') {
    throw new Error('Semester aktif tidak boleh dihapus. Aktifkan semester lain terlebih dahulu.');
  }
}

/**
 * Validasi khusus Jadwal: hari, format/urutan jam, dan bentrok guru/kelas.
 */
function validateJadwalData_(cleanData, sheetData, headers, selfRowNum) {
  const hari = String(cleanData.hari || '').trim();
  if (HARI.indexOf(hari) === -1) {
    throw new Error('Hari harus salah satu dari: ' + HARI.join(', '));
  }

  const mulai = normalizeJam_(cleanData.jam_mulai);
  const selesai = normalizeJam_(cleanData.jam_selesai);
  if (!mulai || !selesai) {
    throw new Error('Format jam harus HH:mm (contoh 07:30)');
  }
  if (jamKeMenit_(selesai) <= jamKeMenit_(mulai)) {
    throw new Error('Jam selesai harus lebih besar dari jam mulai');
  }
  cleanData.hari = hari;
  cleanData.jam_mulai = mulai;
  cleanData.jam_selesai = selesai;

  const rows = readSheetAsObjects_('Jadwal').map(function (r) {
    return {
      id_jadwal: String(r.id_jadwal || ''),
      id_semester: String(r.id_semester || ''),
      id_kelas: String(r.id_kelas || ''),
      nip_guru: String(r.nip_guru || ''),
      hari: String(r.hari || ''),
      jam_mulai: jamText_(r.jam_mulai),
      jam_selesai: jamText_(r.jam_selesai)
    };
  });

  const bentrok = findJadwalBentrok_({
    id_jadwal: String(cleanData.id_jadwal || ''),
    id_semester: String(cleanData.id_semester || ''),
    id_kelas: String(cleanData.id_kelas || ''),
    nip_guru: String(cleanData.nip_guru || ''),
    hari: hari,
    jam_mulai: mulai,
    jam_selesai: selesai
  }, rows);

  if (bentrok) {
    const guru = findRowByKey_('Guru', 'nip', bentrok.nip_guru);
    const kelas = findRowByKey_('Kelas', 'id_kelas', bentrok.id_kelas);
    const namaGuru = guru ? String(guru.nama) : bentrok.nip_guru;
    const namaKelas = kelas ? String(kelas.nama_kelas) : bentrok.id_kelas;
    throw new Error(
      'Jadwal bentrok: ' + namaGuru + ' di kelas ' + namaKelas +
      ' pada hari ' + bentrok.hari + ' jam ' + bentrok.jam_mulai + '-' + bentrok.jam_selesai
    );
  }
}

/**
 * FUNGSI MURNI: pilih baris semester berstatus Aktif dari daftar, atau null.
 * @param {Array<Object>} list
 * @returns {Object|null}
 */
function pilihSemesterAktif_(list) {
  for (let i = 0; i < (list || []).length; i++) {
    if (String(list[i].status || '').trim() === 'Aktif') {
      return {
        id_semester: String(list[i].id_semester || '').trim(),
        tahun_ajaran: String(list[i].tahun_ajaran || '').trim(),
        semester: String(list[i].semester || '').trim(),
        status: 'Aktif'
      };
    }
  }
  return null;
}

/**
 * HELPER INTERNAL (tidak diekspos ke klien): semester aktif atau null.
 * @returns {Object|null}
 */
function getSemesterAktif_() {
  return pilihSemesterAktif_(readSheetAsObjects_('Semester'));
}

/**
 * HELPER INTERNAL (tidak diekspos ke klien): jadwal semester aktif milik guru
 * pada hari tertentu, urut jam_mulai, sudah digabung nama kelas & mapel.
 * @param {string} nip
 * @param {string} hari
 * @param {Object} [semesterAktif] - hasil pilihSemesterAktif_ yang sudah dibaca pemanggil
 */
function getJadwalByGuruHari_(nip, hari, semesterAktif) {
  const sem = semesterAktif || getSemesterAktif_();
  if (!sem) return [];

  const kelasMap = {};
  readSheetAsObjects_('Kelas').forEach(function (k) {
    kelasMap[String(k.id_kelas || '').trim()] = String(k.nama_kelas || '').trim();
  });
  const mapelMap = {};
  readSheetAsObjects_('Mapel').forEach(function (m) {
    mapelMap[String(m.id_mapel || '').trim()] = String(m.nama_mapel || '').trim();
  });

  const targetNip = String(nip || '').trim();
  const targetHari = String(hari || '').trim();

  return readSheetAsObjects_('Jadwal')
    .filter(function (j) {
      return String(j.id_semester || '').trim() === sem.id_semester &&
        String(j.nip_guru || '').trim() === targetNip &&
        String(j.hari || '').trim() === targetHari;
    })
    .map(function (j) {
      return {
        id_jadwal: String(j.id_jadwal || '').trim(),
        id_semester: sem.id_semester,
        id_kelas: String(j.id_kelas || '').trim(),
        nama_kelas: kelasMap[String(j.id_kelas || '').trim()] || String(j.id_kelas || '').trim(),
        id_mapel: String(j.id_mapel || '').trim(),
        nama_mapel: mapelMap[String(j.id_mapel || '').trim()] || String(j.id_mapel || '').trim(),
        nip_guru: targetNip,
        hari: targetHari,
        jam_mulai: jamText_(j.jam_mulai),
        jam_selesai: jamText_(j.jam_selesai)
      };
    })
    .sort(function (a, b) {
      return a.jam_mulai.localeCompare(b.jam_mulai);
    });
}

/**
 * HELPER INTERNAL (tidak diekspos ke klien): nama hari Indonesia dari tanggal,
 * memakai zona waktu aplikasi.
 * @param {Date|string|number} date
 * @returns {string} 'Senin'..'Minggu' atau '' jika tidak valid
 */
function hariDariTanggal_(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const nama = Utilities.formatDate(d, getAppTimeZone_(), 'EEEE');
  const peta = {
    Sunday: 'Minggu', Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu',
    Thursday: 'Kamis', Friday: 'Jumat', Saturday: 'Sabtu'
  };
  return peta[nama] || '';
}

/**
 * Daftar semester (Admin).
 */
function listSemester(token) {
  requireRole_(token, ['Admin']);
  const items = readSheetAsObjects_('Semester').map(function (s) {
    return {
      id_semester: String(s.id_semester || '').trim(),
      tahun_ajaran: String(s.tahun_ajaran || '').trim(),
      semester: String(s.semester || '').trim(),
      status: String(s.status || '').trim()
    };
  });
  return { success: true, entity: 'Semester', items: items };
}

/**
 * Tambah/edit semester (Admin). Memakai mesin saveEntity generik.
 */
function saveSemester(token, data, mode) {
  requireRole_(token, ['Admin']);
  return saveEntity(token, 'Semester', data, mode);
}

/**
 * Hapus semester (Admin). Ditolak jika aktif atau sudah dipakai Jadwal.
 */
function deleteSemester(token, id) {
  requireRole_(token, ['Admin']);
  return deleteEntity(token, 'Semester', id);
}

/**
 * Mengaktifkan satu semester: setelah selesai tepat satu baris berstatus "Aktif".
 * Atomik memakai LockService + satu kali setValues.
 */
function setSemesterAktif(token, id) {
  requireRole_(token, ['Admin']);

  const cleanId = String(id || '').trim();
  if (!cleanId) throw new Error('ID semester wajib diisi');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName('Semester');
    if (!sheet) throw new Error('Sheet Semester tidak ditemukan');

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) throw new Error('Belum ada data Semester');

    const headers = data[0];
    const idIdx = headers.indexOf('id_semester');
    const stIdx = headers.indexOf('status');
    if (idIdx === -1 || stIdx === -1) {
      throw new Error('Struktur kolom sheet Semester tidak lengkap');
    }

    let target = null;
    const statuses = [];
    for (let r = 1; r < data.length; r++) {
      const rowId = String(data[r][idIdx] || '').trim();
      if (!rowId) {
        statuses.push([data[r][stIdx]]);
        continue;
      }
      if (rowId === cleanId) target = data[r];
      statuses.push([rowId === cleanId ? 'Aktif' : 'Tidak aktif']);
    }

    if (!target) throw new Error('Semester dengan id "' + cleanId + '" tidak ditemukan');

    sheet.getRange(2, stIdx + 1, statuses.length, 1).setValues(statuses);

    return {
      success: true,
      message: 'Semester ' + String(target[headers.indexOf('tahun_ajaran')]) + ' ' +
        String(target[headers.indexOf('semester')]) + ' berhasil diaktifkan'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Daftar jadwal (Admin) dengan filter semester (default aktif), kelas, guru.
 * Nama kelas, mapel, dan guru digabung agar tidak hanya menampilkan ID.
 */
function listJadwal(token, filter) {
  requireRole_(token, ['Admin']);
  const f = filter || {};

  const semesters = readSheetAsObjects_('Semester').map(function (s) {
    return {
      id_semester: String(s.id_semester || '').trim(),
      tahun_ajaran: String(s.tahun_ajaran || '').trim(),
      semester: String(s.semester || '').trim(),
      status: String(s.status || '').trim()
    };
  });
  const kelasList = readSheetAsObjects_('Kelas').map(function (k) {
    return { id_kelas: String(k.id_kelas || '').trim(), nama_kelas: String(k.nama_kelas || '').trim() };
  });
  const mapelList = readSheetAsObjects_('Mapel').map(function (m) {
    return { id_mapel: String(m.id_mapel || '').trim(), nama_mapel: String(m.nama_mapel || '').trim() };
  });
  const guruList = readSheetAsObjects_('Guru').map(function (g) {
    return { nip: String(g.nip || '').trim(), nama: String(g.nama || '').trim() };
  });

  const kelasMap = {};
  kelasList.forEach(function (k) { kelasMap[k.id_kelas] = k.nama_kelas; });
  const mapelMap = {};
  mapelList.forEach(function (m) { mapelMap[m.id_mapel] = m.nama_mapel; });
  const guruMap = {};
  guruList.forEach(function (g) { guruMap[g.nip] = g.nama; });

  let semesterAktif = '';
  semesters.forEach(function (s) {
    if (s.status === 'Aktif') semesterAktif = s.id_semester;
  });

  const semId = String(f.id_semester || semesterAktif || '').trim();
  const kelasId = String(f.id_kelas || '').trim();
  const nip = String(f.nip_guru || '').trim();

  const items = readSheetAsObjects_('Jadwal')
    .filter(function (j) {
      const js = String(j.id_semester || '').trim();
      if (semId && js !== semId) return false;
      if (kelasId && String(j.id_kelas || '').trim() !== kelasId) return false;
      if (nip && String(j.nip_guru || '').trim() !== nip) return false;
      return true;
    })
    .map(function (j) {
      const idKelas = String(j.id_kelas || '').trim();
      const idMapel = String(j.id_mapel || '').trim();
      const nipGuru = String(j.nip_guru || '').trim();
      return {
        id_jadwal: String(j.id_jadwal || '').trim(),
        id_semester: String(j.id_semester || '').trim(),
        id_kelas: idKelas,
        nama_kelas: kelasMap[idKelas] || idKelas,
        id_mapel: idMapel,
        nama_mapel: mapelMap[idMapel] || idMapel,
        nip_guru: nipGuru,
        nama_guru: guruMap[nipGuru] || nipGuru,
        hari: String(j.hari || '').trim(),
        jam_mulai: jamText_(j.jam_mulai),
        jam_selesai: jamText_(j.jam_selesai)
      };
    })
    .sort(function (a, b) {
      const ha = HARI.indexOf(a.hari);
      const hb = HARI.indexOf(b.hari);
      if (ha !== hb) return ha - hb;
      return a.jam_mulai.localeCompare(b.jam_mulai);
    });

  return {
    success: true,
    entity: 'Jadwal',
    items: items,
    extra: {
      semesters: semesters,
      kelas: kelasList,
      mapel: mapelList,
      guru: guruList,
      hari: HARI,
      semesterAktif: semesterAktif
    }
  };
}

/**
 * Tambah/edit jadwal (Admin).
 */
function saveJadwal(token, data, mode) {
  requireRole_(token, ['Admin']);
  return saveEntity(token, 'Jadwal', data, mode);
}

/**
 * Hapus jadwal (Admin). Ditolak jika sudah punya Presensi/Izin.
 */
function deleteJadwal(token, id) {
  requireRole_(token, ['Admin']);
  return deleteEntity(token, 'Jadwal', id);
}
