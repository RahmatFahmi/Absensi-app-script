/**
 * Aplikasi Presensi Sekolah - Presensi.gs (Presensi oleh Guru)
 * Zona Waktu: Asia/Makassar
 */

/**
 * Validasi format dan batasan tanggal presensi.
 * Format harus 'yyyy-MM-dd', tanggal kalender valid, dan tidak boleh melewati todayYmd.
 * @param {string} tanggal
 * @param {string} todayYmd
 * @returns {string} tanggal yang sudah dibersihkan
 */
function validateTanggalPresensi_(tanggal, todayYmd) {
  const clean = String(tanggal || '').trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error('Format tanggal tidak valid. Gunakan format yyyy-MM-dd.');
  }

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);

  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || (dt.getUTCMonth() + 1) !== m || dt.getUTCDate() !== d) {
    throw new Error('Tanggal presensi tidak valid.');
  }

  if (todayYmd && clean > todayYmd) {
    throw new Error('Tanggal presensi tidak boleh tanggal masa depan.');
  }

  return clean;
}

/**
 * Validasi kecocokan hari tanggal dengan hari pada jadwal.
 * @param {string} hariTanggal
 * @param {string} hariJadwal
 * @returns {boolean}
 */
function validateHariPresensi_(hariTanggal, hariJadwal) {
  const h1 = String(hariTanggal || '').trim();
  const h2 = String(hariJadwal || '').trim();
  if (h1 !== h2) {
    throw new Error('Hari tanggal presensi (' + h1 + ') tidak sesuai dengan jadwal (' + h2 + ').');
  }
  return true;
}

/**
 * Validasi status presensi dan panjang keterangan.
 * @param {string} status
 * @param {string} [keterangan]
 * @returns {{ status: string, keterangan: string }}
 */
function validateStatusKeteranganPresensi_(status, keterangan) {
  const ALLOWED_STATUS = ['Hadir', 'Izin', 'Sakit', 'Alpa'];
  const st = String(status || '').trim();
  if (!ALLOWED_STATUS.includes(st)) {
    throw new Error('Status presensi tidak valid: ' + st);
  }

  const ket = String(keterangan || '').trim();
  if (ket.length > 200) {
    throw new Error('Keterangan presensi maksimal 200 karakter.');
  }

  return { status: st, keterangan: ket };
}

/**
 * Validasi integritas daftar siswa kelas terhadap yang dikirimkan guru.
 * Tidak boleh ada NIS ganda, tidak boleh ada yang kurang atau berlebih.
 * @param {Array<Object>} submittedRows - [{ nis, status, keterangan }]
 * @param {Array<Object>} classStudentList - [{ nis, nama, ... }]
 * @returns {boolean}
 */
function validateRosterPresensi_(submittedRows, classStudentList) {
  if (!Array.isArray(submittedRows) || !Array.isArray(classStudentList)) {
    throw new Error('Daftar siswa berubah, muat ulang halaman');
  }

  if (submittedRows.length !== classStudentList.length) {
    throw new Error('Daftar siswa berubah, muat ulang halaman');
  }

  const classNisSet = new Set();
  for (let i = 0; i < classStudentList.length; i++) {
    const nis = String(classStudentList[i].nis || '').trim();
    if (nis) classNisSet.add(nis);
  }

  const submittedNisSet = new Set();
  for (let j = 0; j < submittedRows.length; j++) {
    const nis = String(submittedRows[j].nis || '').trim();
    if (!nis || submittedNisSet.has(nis)) {
      throw new Error('Daftar siswa berubah, muat ulang halaman');
    }
    submittedNisSet.add(nis);
    if (!classNisSet.has(nis)) {
      throw new Error('Daftar siswa berubah, muat ulang halaman');
    }
  }

  if (submittedNisSet.size !== classNisSet.size) {
    throw new Error('Daftar siswa berubah, muat ulang halaman');
  }

  return true;
}

/**
 * Membangun baris untuk operasi upsert presensi ke sheet.
 * @param {Array<Object>} existingRows - baris sheet Presensi yang cocok dengan id_jadwal + tanggal
 * @param {Array<Object>} submittedRows - [{ nis, status, keterangan }]
 * @param {Object} meta - { id_jadwal, tanggal, diubah_oleh, diubah_pada }
 * @param {Function} idGeneratorFn - fungsi penghasil id_presensi
 * @returns {{ toUpdate: Array<{ rowNumber: number, rowValues: Array }>, toInsert: Array<Array> }}
 */
function buildUpsertPresensiRows_(existingRows, submittedRows, meta, idGeneratorFn) {
  const existingMap = {};
  if (Array.isArray(existingRows)) {
    for (let i = 0; i < existingRows.length; i++) {
      const row = existingRows[i];
      const nis = String(row.nis || '').trim();
      if (nis) {
        existingMap[nis] = row;
      }
    }
  }

  const toUpdate = [];
  const toInsert = [];

  for (let j = 0; j < submittedRows.length; j++) {
    const item = submittedRows[j];
    const nis = String(item.nis || '').trim();
    const cleanStatusKet = validateStatusKeteranganPresensi_(item.status, item.keterangan);
    const existing = existingMap[nis];

    if (existing) {
      const idPresensi = String(existing.id_presensi || '').trim() || idGeneratorFn('PRS');
      toUpdate.push({
        rowNumber: existing._rowNumber,
        rowValues: [
          idPresensi,
          String(meta.tanggal),
          String(meta.id_jadwal),
          nis,
          cleanStatusKet.status,
          cleanStatusKet.keterangan,
          String(meta.diubah_oleh),
          String(meta.diubah_pada)
        ]
      });
    } else {
      const newId = idGeneratorFn('PRS');
      toInsert.push([
        newId,
        String(meta.tanggal),
        String(meta.id_jadwal),
        nis,
        cleanStatusKet.status,
        cleanStatusKet.keterangan,
        String(meta.diubah_oleh),
        String(meta.diubah_pada)
      ]);
    }
  }

  return { toUpdate, toInsert };
}

/**
 * Helper mendapatkan tanggal hari ini dalam format 'yyyy-MM-dd' pada zona waktu aplikasi.
 * @returns {string}
 */
function getTodayYmd_() {
  return Utilities.formatDate(new Date(), getAppTimeZone_(), 'yyyy-MM-dd');
}

/**
 * Normalisasi sel tanggal presensi menjadi format string 'yyyy-MM-dd'.
 * @param {Date|string|number} val
 * @returns {string}
 */
function formatTanggalPresensi_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, getAppTimeZone_(), 'yyyy-MM-dd');
  }
  const s = String(val || '').trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

/**
 * Helper membaca penanda permohonan dari sheet Izin untuk id_jadwal + tanggal tertentu.
 * Hanya mengembalikan jenis dan status permohonan yang bukan 'Ditolak' (TIDAK menyertakan link_bukti/alasan).
 * @param {string} id_jadwal
 * @param {string} tanggal
 * @returns {Object<string, { jenis: string, status: string }>}
 */
function getIzinMarkers_(id_jadwal, tanggal) {
  const markers = {};
  const targetJadwal = String(id_jadwal || '').trim();
  const targetTanggal = String(tanggal || '').trim();
  if (!targetJadwal || !targetTanggal) return markers;

  const rows = readSheetAsObjects_('Izin');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rJadwal = String(r.id_jadwal || '').trim();
    const rTanggal = formatTanggalPresensi_(r.tanggal);
    const rStatus = String(r.status || '').trim();

    if (rJadwal === targetJadwal && rTanggal === targetTanggal && rStatus !== 'Ditolak') {
      const nis = String(r.nis || '').trim();
      if (nis) {
        markers[nis] = {
          jenis: String(r.jenis || '').trim(),
          status: rStatus
        };
      }
    }
  }
  return markers;
}

/**
 * Fungsi murni: status default siswa pada form presensi.
 * Baris Presensi yang sudah ada selalu menang; pengajuan "Disetujui" menjadi
 * default bila presensi belum diisi (tanpa membuat baris presensi).
 * @param {string} existingStatus
 * @param {{ jenis: string, status: string }|null} izinMarker
 * @returns {string}
 */
function resolveDefaultStatusPresensi_(existingStatus, izinMarker) {
  if (existingStatus) return String(existingStatus);
  if (izinMarker && String(izinMarker.status || '').trim() === 'Disetujui') {
    const jenis = String(izinMarker.jenis || '').trim();
    if (jenis === 'Sakit' || jenis === 'Izin') return jenis;
  }
  return 'Hadir';
}

/**
 * Fungsi murni: tandai tiap jadwal "Sudah diisi"/"Belum diisi" untuk tanggal tertentu.
 * @param {Array<Object>} daftarJadwal
 * @param {Array<Object>} presensiRows
 * @param {string} tanggal - yyyy-MM-dd
 * @returns {Array<Object>}
 */
function tandaiStatusPresensiJadwal_(daftarJadwal, presensiRows, tanggal) {
  const filledJadwalSet = new Set();
  const target = String(tanggal || '').trim();
  (presensiRows || []).forEach(function (row) {
    if (row && formatTanggalPresensi_(row.tanggal) === target) {
      filledJadwalSet.add(String(row.id_jadwal || '').trim());
    }
  });

  return (daftarJadwal || []).map(function (j) {
    const isFilled = filledJadwalSet.has(String(j.id_jadwal || '').trim());
    return Object.assign({}, j, {
      status_presensi: isFilled ? 'Sudah diisi' : 'Belum diisi'
    });
  });
}

/**
 * Mengambil jadwal mengajar guru pada tanggal tertentu di semester aktif.
 * Disertai penanda status pengisian presensi 'Sudah diisi' / 'Belum diisi' dalam 1 kali baca sheet Presensi.
 *
 * @param {string} token - Token sesi Guru
 * @param {string} tanggal - Format 'yyyy-MM-dd'
 * @returns {Object} { tanggal, hari, semester, jadwal: Array }
 */
function getJadwalGuru(token, tanggal) {
  const session = requireRole_(token, ['Guru']);
  const nipGuru = String(session.ref_id || '').trim();
  if (!nipGuru) {
    throw new Error('Identitas NIP guru tidak ditemukan pada sesi.');
  }

  const todayStr = getTodayYmd_();
  const cleanTanggal = validateTanggalPresensi_(tanggal, todayStr);

  const semAktif = getSemesterAktif_();
  if (!semAktif) {
    throw new Error('Tidak ada semester aktif saat ini.');
  }

  // Tentukan hari dari tanggal presensi
  const hariTanggal = hariDariTanggal_(cleanTanggal);
  if (!hariTanggal) {
    throw new Error('Gagal menentukan nama hari dari tanggal ' + cleanTanggal);
  }

  // Ambil daftar jadwal guru untuk hari tersebut
  const daftarJadwal = getJadwalByGuruHari_(nipGuru, hariTanggal);

  // Periksa status pengisian presensi untuk tanggal tersebut dalam 1 kali pembacaan sheet Presensi
  const jadwalDenganStatus = tandaiStatusPresensiJadwal_(
    daftarJadwal,
    readSheetAsObjects_('Presensi'),
    cleanTanggal
  );

  return {
    tanggal: cleanTanggal,
    hari: hariTanggal,
    semester: semAktif,
    jadwal: jadwalDenganStatus
  };
}

/**
 * Mengambil formulir presensi untuk jadwal dan tanggal tertentu.
 * Mengembalikan daftar siswa kelas (urut nama), status tersimpan (mode edit) atau default Hadir,
 * serta penanda izin dari sheet Izin.
 *
 * @param {string} token - Token sesi Guru
 * @param {string} id_jadwal - ID Jadwal
 * @param {string} tanggal - Format 'yyyy-MM-dd'
 * @returns {Object}
 */
function getFormPresensi(token, id_jadwal, tanggal) {
  const session = requireRole_(token, ['Guru']);
  const nipGuru = String(session.ref_id || '').trim();
  if (!nipGuru) {
    throw new Error('Identitas NIP guru tidak ditemukan pada sesi.');
  }

  const todayStr = getTodayYmd_();
  const cleanTanggal = validateTanggalPresensi_(tanggal, todayStr);

  const semAktif = getSemesterAktif_();
  if (!semAktif) {
    throw new Error('Tidak ada semester aktif saat ini.');
  }

  // 1. Verifikasi jadwal
  const jadwalRow = findRowByKey_('Jadwal', 'id_jadwal', id_jadwal);
  if (!jadwalRow) {
    throw new Error('Jadwal dengan ID ' + id_jadwal + ' tidak ditemukan.');
  }

  if (String(jadwalRow.nip_guru || '').trim() !== nipGuru) {
    throw new Error('Akses ditolak: jadwal ini bukan milik Anda.');
  }

  if (String(jadwalRow.id_semester || '').trim() !== semAktif.id_semester) {
    throw new Error('Akses ditolak: jadwal ini bukan pada semester aktif.');
  }

  const hariTanggal = hariDariTanggal_(cleanTanggal);
  validateHariPresensi_(hariTanggal, jadwalRow.hari);

  // 2. Ambil metadata kelas & mapel
  const kelasRow = findRowByKey_('Kelas', 'id_kelas', jadwalRow.id_kelas);
  const mapelRow = findRowByKey_('Mapel', 'id_mapel', jadwalRow.id_mapel);
  const namaKelas = kelasRow ? String(kelasRow.nama_kelas || '').trim() : String(jadwalRow.id_kelas || '');
  const namaMapel = mapelRow ? String(mapelRow.nama_mapel || '').trim() : String(jadwalRow.id_mapel || '');

  // 3. Ambil daftar siswa kelas (diurutkan berdasarkan nama)
  const allStudents = readSheetAsObjects_('Siswa');
  const classStudents = allStudents
    .filter(function (s) {
      return String(s.id_kelas || '').trim() === String(jadwalRow.id_kelas || '').trim();
    })
    .sort(function (a, b) {
      return String(a.nama || '').localeCompare(String(b.nama || ''));
    });

  if (classStudents.length === 0) {
    throw new Error('Kelas ' + namaKelas + ' belum memiliki daftar siswa.');
  }

  // 4. Baca data presensi yang sudah tersimpan untuk jadwal+tanggal ini
  const allPresensi = readSheetAsObjects_('Presensi');
  const existingMap = {};
  let lastModifiedInfo = null;

  for (let p = 0; p < allPresensi.length; p++) {
    const row = allPresensi[p];
    const rJadwal = String(row.id_jadwal || '').trim();
    const rTanggal = formatTanggalPresensi_(row.tanggal);
    if (rJadwal === String(id_jadwal).trim() && rTanggal === cleanTanggal) {
      const nis = String(row.nis || '').trim();
      existingMap[nis] = {
        status: String(row.status || '').trim(),
        keterangan: String(row.keterangan || '').trim(),
        diubah_oleh: String(row.diubah_oleh || '').trim(),
        diubah_pada: String(row.diubah_pada || '').trim()
      };
      if (!lastModifiedInfo && row.diubah_pada) {
        lastModifiedInfo = {
          diubah_oleh: String(row.diubah_oleh || '').trim(),
          diubah_pada: String(row.diubah_pada || '').trim()
        };
      }
    }
  }

  const isEditMode = Object.keys(existingMap).length > 0;

  // 5. Baca penanda pengajuan sakit/izin
  const izinMarkers = getIzinMarkers_(id_jadwal, cleanTanggal);

  // 6. Susun daftar siswa beserta status
  const students = classStudents.map(function (s) {
    const nis = String(s.nis || '').trim();
    const existing = existingMap[nis];
    return {
      nis: nis,
      nama: String(s.nama || '').trim(),
      status: resolveDefaultStatusPresensi_(existing ? existing.status : '', izinMarkers[nis] || null),
      keterangan: existing ? existing.keterangan : '',
      izin_marker: izinMarkers[nis] || null
    };
  });

  return {
    mode: isEditMode ? 'edit' : 'new',
    id_jadwal: String(id_jadwal).trim(),
    tanggal: cleanTanggal,
    hari: hariTanggal,
    id_kelas: String(jadwalRow.id_kelas).trim(),
    nama_kelas: namaKelas,
    id_mapel: String(jadwalRow.id_mapel).trim(),
    nama_mapel: namaMapel,
    jam_mulai: jamText_(jadwalRow.jam_mulai),
    jam_selesai: jamText_(jadwalRow.jam_selesai),
    last_modified: lastModifiedInfo,
    students: students
  };
}

/**
 * Menyimpan data presensi kelas (insert baru atau update data sebelumnya).
 * Mencegah data ganda dengan upsert per (id_jadwal, tanggal, nis).
 * Seluruh proses read-check-write berada di dalam LockService.
 *
 * @param {string} token - Token sesi Guru
 * @param {string} id_jadwal - ID Jadwal
 * @param {string} tanggal - Format 'yyyy-MM-dd'
 * @param {Array<Object>} rows - [{ nis, status, keterangan }]
 * @returns {Object} { success: true, message: string, count: number, mode: string }
 */
function savePresensi(token, id_jadwal, tanggal, rows) {
  const session = requireRole_(token, ['Guru']);
  const nipGuru = String(session.ref_id || '').trim();
  if (!nipGuru) {
    throw new Error('Identitas NIP guru tidak ditemukan pada sesi.');
  }

  const todayStr = getTodayYmd_();
  const cleanTanggal = validateTanggalPresensi_(tanggal, todayStr);

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Data presensi siswa tidak boleh kosong.');
  }

  // Lock untuk seluruh sequence read-check-write
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const semAktif = getSemesterAktif_();
    if (!semAktif) {
      throw new Error('Tidak ada semester aktif saat ini.');
    }

    // 1. Verifikasi jadwal dan kepemilikan guru
    const jadwalRow = findRowByKey_('Jadwal', 'id_jadwal', id_jadwal);
    if (!jadwalRow) {
      throw new Error('Jadwal dengan ID ' + id_jadwal + ' tidak ditemukan.');
    }

    if (String(jadwalRow.nip_guru || '').trim() !== nipGuru) {
      throw new Error('Akses ditolak: jadwal ini bukan milik Anda.');
    }

    if (String(jadwalRow.id_semester || '').trim() !== semAktif.id_semester) {
      throw new Error('Akses ditolak: jadwal ini bukan pada semester aktif.');
    }

    const hariTanggal = hariDariTanggal_(cleanTanggal);
    validateHariPresensi_(hariTanggal, jadwalRow.hari);

    // 2. Ambil daftar siswa kelas untuk verifikasi roster
    const allStudents = readSheetAsObjects_('Siswa');
    const classStudents = allStudents.filter(function (s) {
      return String(s.id_kelas || '').trim() === String(jadwalRow.id_kelas || '').trim();
    });

    // Validasi ketat integritas roster siswa
    validateRosterPresensi_(rows, classStudents);

    // 3. Baca baris presensi yang sudah ada untuk jadwal + tanggal ini
    const ss = getSpreadsheet_();
    const pSheet = ss.getSheetByName('Presensi');
    if (!pSheet) {
      throw new Error('Sheet Presensi tidak ditemukan.');
    }

    const pData = pSheet.getDataRange().getValues();
    const pHeaders = pData[0];
    const jIdx = pHeaders.indexOf('id_jadwal');
    const tIdx = pHeaders.indexOf('tanggal');
    const nIdx = pHeaders.indexOf('nis');

    const existingRows = [];
    for (let r = 1; r < pData.length; r++) {
      const rJadwal = String(pData[r][jIdx] || '').trim();
      const rTgl = formatTanggalPresensi_(pData[r][tIdx]);
      if (rJadwal === String(id_jadwal).trim() && rTgl === cleanTanggal) {
        const rowObj = { _rowNumber: r + 1 };
        for (let c = 0; c < pHeaders.length; c++) {
          rowObj[pHeaders[c]] = pData[r][c];
        }
        existingRows.push(rowObj);
      }
    }

    // 4. Bangun baris upsert
    const timestampNow = Utilities.formatDate(new Date(), getAppTimeZone_(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const meta = {
      id_jadwal: String(id_jadwal).trim(),
      tanggal: cleanTanggal,
      diubah_oleh: nipGuru,
      diubah_pada: timestampNow
    };

    const upsertPlan = buildUpsertPresensiRows_(existingRows, rows, meta, generateId_);

    // 5. Tulis pembaruan (update) baris yang sudah ada secara batch
    if (upsertPlan.toUpdate.length > 0) {
      const minRow = Math.min.apply(null, upsertPlan.toUpdate.map(function (u) { return u.rowNumber; }));
      const maxRow = Math.max.apply(null, upsertPlan.toUpdate.map(function (u) { return u.rowNumber; }));
      if (maxRow - minRow + 1 === upsertPlan.toUpdate.length) {
        // Optimasi: baris terurut kontigu ditulis dalam 1 panggilan setValues batch
        const updateMatrix = upsertPlan.toUpdate.map(function (u) { return u.rowValues; });
        pSheet.getRange(minRow, 1, updateMatrix.length, pHeaders.length).setValues(updateMatrix);
      } else {
        for (let u = 0; u < upsertPlan.toUpdate.length; u++) {
          const upd = upsertPlan.toUpdate[u];
          pSheet.getRange(upd.rowNumber, 1, 1, pHeaders.length).setValues([upd.rowValues]);
        }
      }
    }

    // 6. Tulis penambahan (insert) baris baru dalam SATU setValues batch
    if (upsertPlan.toInsert.length > 0) {
      const startRow = pSheet.getLastRow() + 1;
      ensureSheetRows_(pSheet, startRow + upsertPlan.toInsert.length - 1);
      pSheet.getRange(startRow, 1, upsertPlan.toInsert.length, pHeaders.length)
        .setValues(upsertPlan.toInsert);
    }

    // Pastikan kolom tanggal, id_jadwal, dan nis tersimpan sebagai teks biasa
    const tglCol = pHeaders.indexOf('tanggal') + 1;
    const jdwCol = pHeaders.indexOf('id_jadwal') + 1;
    const nisCol = pHeaders.indexOf('nis') + 1;
    const totalRows = Math.max(pSheet.getLastRow() - 1, 1);
    if (tglCol > 0) pSheet.getRange(2, tglCol, totalRows, 1).setNumberFormat('@');
    if (jdwCol > 0) pSheet.getRange(2, jdwCol, totalRows, 1).setNumberFormat('@');
    if (nisCol > 0) pSheet.getRange(2, nisCol, totalRows, 1).setNumberFormat('@');

    const modeName = upsertPlan.toUpdate.length > 0 ? 'diperbarui' : 'disimpan';
    return {
      success: true,
      message: 'Presensi ' + rows.length + ' siswa berhasil ' + modeName + '.',
      count: rows.length,
      mode: upsertPlan.toUpdate.length > 0 ? 'edit' : 'new'
    };

  } finally {
    lock.releaseLock();
  }
}
