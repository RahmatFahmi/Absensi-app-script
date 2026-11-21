/**
 * Aplikasi Presensi Sekolah - Izin.gs
 * Backend Pengajuan Izin/Sakit Siswa & Pengelolaan Berkas Bukti (T07)
 * Zona Waktu: Asia/Makassar
 */

// Konstanta batas ukuran berkas bukti (2 MB = 2.097.152 bytes)
const MAX_BUKTI_SIZE_BYTES_ = 2 * 1024 * 1024;

/**
 * Helper membersihkan string base64 dari prefix data URI bila ada
 * @param {string} b64
 * @returns {string}
 */
function cleanBase64_(b64) {
  if (!b64 || typeof b64 !== 'string') return '';
  const commaIdx = b64.indexOf(',');
  if (commaIdx !== -1 && commaIdx < 100) {
    return b64.substring(commaIdx + 1).trim();
  }
  return b64.trim();
}

/**
 * Deteksi magic bytes berkas dari array bytes
 * Mendukung signed byte Java (-128..127) dari Utilities.base64Decode maupun unsigned (0..255).
 * @param {Array<number>} bytes
 * @returns {{ type: string, mime: string, ext: string }|null}
 */
function detectMagicBytes_(bytes) {
  if (!bytes || bytes.length < 3) return null;
  const b0 = bytes[0] & 0xFF;
  const b1 = bytes[1] & 0xFF;
  const b2 = bytes[2] & 0xFF;
  const b3 = bytes.length >= 4 ? (bytes[3] & 0xFF) : 0;

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) {
    return { type: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  }
  // JPEG: 0xFF 0xD8 0xFF
  if (b0 === 0xFF && b1 === 0xD8 && b2 === 0xFF) {
    return { type: 'jpeg', mime: 'image/jpeg', ext: 'jpg' };
  }
  // PNG: 0x89 0x50 0x4E 0x47 (137 80 78 71)
  if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47) {
    return { type: 'png', mime: 'image/png', ext: 'png' };
  }
  return null;
}

/**
 * Memvalidasi berkas upload (ukuran maks 2 MB dan magic bytes berkas)
 * @param {Object} berkas - { base64: string, nama?: string, mime?: string }
 * @returns {{ bytes: Array<number>, size: number, type: string, mime: string, ext: string }}
 */
function validateBerkas_(berkas) {
  if (!berkas || typeof berkas !== 'object') {
    throw new Error('Berkas tidak ditemukan.');
  }
  const cleanB64 = cleanBase64_(berkas.base64);
  if (!cleanB64) {
    throw new Error('Konten berkas kosong.');
  }
  // Tolak sebelum decode agar base64 raksasa tidak menghabiskan kuota.
  if (cleanB64.length > Math.ceil(MAX_BUKTI_SIZE_BYTES_ / 3) * 4 + 16) {
    throw new Error('Ukuran berkas melebihi batas maksimal 2 MB.');
  }

  const bytes = Utilities.base64Decode(cleanB64);
  if (bytes.length > MAX_BUKTI_SIZE_BYTES_) {
    throw new Error('Ukuran berkas melebihi batas maksimal 2 MB.');
  }

  const detected = detectMagicBytes_(bytes);
  if (!detected) {
    throw new Error('Format berkas tidak didukung. Hanya file PDF, JPG, dan PNG yang diperbolehkan.');
  }

  return {
    bytes: bytes,
    size: bytes.length,
    type: detected.type,
    mime: detected.mime,
    ext: detected.ext
  };
}

/**
 * Menghasilkan nama file aman di server: {id_izin}_{nis}.{ext}
 * Nama dari client diabaikan sepenuhnya untuk mencegah path traversal.
 * @param {string} idIzin
 * @param {string} nis
 * @param {string} ext
 * @returns {string}
 */
function generateSafeFilename_(idIzin, nis, ext) {
  const safeId = String(idIzin || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeNis = String(nis || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeExt = String(ext || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (!safeId || !safeNis || !safeExt) {
    throw new Error('Komponen nama berkas tidak valid.');
  }
  return safeId + '_' + safeNis + '.' + safeExt;
}

/**
 * Helper mengambil waktu sekarang dalam menit hari ini (0..1439) pada zona waktu aplikasi.
 * @returns {number}
 */
function getCurrentTimeMinutes_() {
  const timeStr = Utilities.formatDate(new Date(), getAppTimeZone_(), 'HH:mm');
  return jamKeMenit_(timeStr);
}

/**
 * Helper format menit ke string 'HH:mm'
 * @param {number} totalMinutes
 * @returns {string}
 */
function formatMenitKeJam_(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

/**
 * Memeriksa apakah waktu saat ini berada dalam rentang window 15 menit pertama (inklusif).
 * Window: jam_mulai <= now <= jam_mulai + 15 menit
 * @param {string} jamMulaiStr - Format 'HH:mm'
 * @param {number} nowMinutes - Waktu saat ini dalam menit
 * @returns {boolean}
 */
function isWithinRequestWindow_(jamMulaiStr, nowMinutes) {
  const mulaiMin = jamKeMenit_(jamMulaiStr);
  if (mulaiMin === null || nowMinutes === null || typeof nowMinutes !== 'number') return false;
  return nowMinutes >= mulaiMin && nowMinutes <= (mulaiMin + 15);
}

/**
 * Mengambil atau membuat folder Drive privat untuk bukti izin/sakit.
 * ID folder disimpan di Script Properties 'BUKTI_FOLDER_ID'.
 * Pengaturan sharing folder/file TIDAK PERNAH diubah.
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateBuktiFolder_() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('BUKTI_FOLDER_ID');
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      if (folder && !folder.isTrashed()) {
        return folder;
      }
    } catch (e) {
      Logger.log('Folder bukti lama tidak dapat diakses, membuat folder baru: ' + e.message);
    }
  }

  const newFolder = DriveApp.createFolder('Bukti_Presensi_Sekolah');
  props.setProperty('BUKTI_FOLDER_ID', newFolder.getId());
  return newFolder;
}

/**
 * Mengambil jadwal kelas siswa hari ini di semester aktif.
 * Menandai apakah window 15 menit sedang buka (dihitung di server) dan apakah ada pengajuan aktif.
 * NIS didapatkan dari sesi server.
 *
 * @param {string} token - Token sesi Siswa
 * @returns {Object} { schedules, siswa, tanggal, hari }
 */
function getJadwalSiswaHariIni(token) {
  const session = requireRole_(token, ['Siswa']);
  const nis = String(session.ref_id || '').trim();

  const siswa = findRowByKey_('Siswa', 'nis', nis);
  if (!siswa) {
    throw new Error('Data siswa dengan NIS "' + nis + '" tidak ditemukan.');
  }

  const todayStr = getTodayYmd_();
  const todayHari = hariDariTanggal_(todayStr);
  const semAktif = getSemesterAktif_();

  if (!semAktif) {
    return {
      schedules: [],
      siswa: {
        nis: siswa.nis,
        nama: siswa.nama,
        id_kelas: siswa.id_kelas,
        kartu_kontrol: siswa.kartu_kontrol === 'Ya'
      },
      tanggal: todayStr,
      hari: todayHari,
      message: 'Tidak ada semester aktif saat ini.'
    };
  }

  // Baca seluruh jadwal dan filter untuk kelas siswa di semester aktif & hari ini
  const allJadwal = readSheetAsObjects_('Jadwal');
  const classJadwal = [];
  for (let i = 0; i < allJadwal.length; i++) {
    const j = allJadwal[i];
    if (String(j.id_semester).trim() === String(semAktif.id_semester).trim() &&
        String(j.id_kelas).trim() === String(siswa.id_kelas).trim() &&
        String(j.hari).trim() === todayHari) {
      classJadwal.push(j);
    }
  }

  // Urutkan jadwal berdasarkan jam_mulai
  classJadwal.sort(function (a, b) {
    return (jamKeMenit_(a.jam_mulai) || 0) - (jamKeMenit_(b.jam_mulai) || 0);
  });

  // Baca relasi Mapel dan Guru
  const allMapel = readSheetAsObjects_('Mapel');
  const mapelMap = {};
  for (let m = 0; m < allMapel.length; m++) {
    mapelMap[String(allMapel[m].id_mapel).trim()] = allMapel[m].nama_mapel;
  }

  const allGuru = readSheetAsObjects_('Guru');
  const guruMap = {};
  for (let g = 0; g < allGuru.length; g++) {
    guruMap[String(allGuru[g].nip).trim()] = allGuru[g].nama;
  }

  // Cek pengajuan aktif siswa hari ini dari sheet Izin (status !== 'Ditolak')
  const allIzin = readSheetAsObjects_('Izin');
  const activeReqMap = {};
  for (let iz = 0; iz < allIzin.length; iz++) {
    const r = allIzin[iz];
    if (String(r.nis).trim() === nis &&
        formatTanggalPresensi_(r.tanggal) === todayStr &&
        String(r.status).trim() !== 'Ditolak') {
      activeReqMap[String(r.id_jadwal).trim()] = {
        id_izin: String(r.id_izin || '').trim(),
        jenis: String(r.jenis || '').trim(),
        status: String(r.status || '').trim(),
        alasan: String(r.alasan || '').trim(),
        diajukan_pada: String(r.diajukan_pada || '').trim(),
        catatan_guru: String(r.catatan_guru || '').trim()
      };
    }
  }

  const nowMinutes = getCurrentTimeMinutes_();
  const resultSchedules = [];

  for (let k = 0; k < classJadwal.length; k++) {
    const jRow = classJadwal[k];
    const jId = String(jRow.id_jadwal).trim();
    const isWindowOpen = isWithinRequestWindow_(jRow.jam_mulai, nowMinutes);
    const activeReq = activeReqMap[jId] || null;
    const mulaiMin = jamKeMenit_(jRow.jam_mulai) || 0;
    const batasMenitStr = formatMenitKeJam_(mulaiMin + 15);

    resultSchedules.push({
      id_jadwal: jId,
      nama_mapel: mapelMap[String(jRow.id_mapel).trim()] || jRow.id_mapel,
      nama_guru: guruMap[String(jRow.nip_guru).trim()] || jRow.nip_guru,
      hari: jRow.hari,
      jam_mulai: jRow.jam_mulai,
      jam_selesai: jRow.jam_selesai,
      window_info: 'Batas: ' + jRow.jam_mulai + ' - ' + batasMenitStr,
      is_window_open: isWindowOpen,
      active_request: activeReq,
      can_apply: isWindowOpen && !activeReq
    });
  }

  return {
    schedules: resultSchedules,
    siswa: {
      nis: siswa.nis,
      nama: siswa.nama,
      id_kelas: siswa.id_kelas,
      kartu_kontrol: siswa.kartu_kontrol === 'Ya'
    },
    tanggal: todayStr,
    hari: todayHari
  };
}

/**
 * Siswa mengajukan izin atau sakit untuk suatu jadwal hari ini.
 * Validasi window 15 menit, keanggotaan kelas, semester aktif, dan berkas sesuai aturan.
 *
 * @param {string} token - Token sesi Siswa
 * @param {string} id_jadwal - ID jadwal pelajaran hari ini
 * @param {string} jenis - 'Sakit' | 'Izin'
 * @param {string} alasan - Alasan maksimal 300 karakter
 * @param {Object} [berkas] - { base64: string, nama?: string, mime?: string } opsional
 * @returns {Object} { success: boolean, id_izin: string, status: string, message: string }
 */
function ajukanIzin(token, id_jadwal, jenis, alasan, berkas) {
  const session = requireRole_(token, ['Siswa']);
  const nis = String(session.ref_id || '').trim();

  // Validasi parameter dasar
  const cleanJenis = String(jenis || '').trim();
  if (cleanJenis !== 'Sakit' && cleanJenis !== 'Izin') {
    throw new Error('Jenis pengajuan hanya boleh "Sakit" atau "Izin".');
  }

  const cleanAlasan = String(alasan || '').trim();
  if (!cleanAlasan) {
    throw new Error('Alasan pengajuan wajib diisi.');
  }
  if (cleanAlasan.length > 300) {
    throw new Error('Alasan pengajuan tidak boleh melebihi 300 karakter.');
  }

  const cleanJadwalId = String(id_jadwal || '').trim();
  if (!cleanJadwalId) {
    throw new Error('Jadwal pelajaran wajib dipilih.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const siswa = findRowByKey_('Siswa', 'nis', nis);
    if (!siswa) {
      throw new Error('Data siswa dengan NIS "' + nis + '" tidak ditemukan.');
    }

    const semAktif = getSemesterAktif_();
    if (!semAktif) {
      throw new Error('Tidak ada semester aktif saat ini.');
    }

    const jadwal = findRowByKey_('Jadwal', 'id_jadwal', cleanJadwalId);
    if (!jadwal) {
      throw new Error('Jadwal pelajaran tidak ditemukan.');
    }

    if (String(jadwal.id_semester).trim() !== String(semAktif.id_semester).trim()) {
      throw new Error('Jadwal pelajaran tidak berada dalam semester aktif.');
    }

    if (String(jadwal.id_kelas).trim() !== String(siswa.id_kelas).trim()) {
      throw new Error('Jadwal pelajaran bukan milik kelas Anda.');
    }

    const todayStr = getTodayYmd_();
    const todayHari = hariDariTanggal_(todayStr);
    if (String(jadwal.hari).trim() !== todayHari) {
      throw new Error('Jadwal pelajaran tidak dijadwalkan untuk hari ini (' + todayHari + ').');
    }

    // Validasi window 15 menit waktu server
    const nowMinutes = getCurrentTimeMinutes_();
    if (!isWithinRequestWindow_(jadwal.jam_mulai, nowMinutes)) {
      throw new Error('Batas waktu pengajuan telah berakhir (hanya dapat diajukan dalam 15 menit pertama sejak jam mulai ' + jadwal.jam_mulai + ').');
    }

    // Cek pengajuan aktif sebelumnya untuk jadwal & tanggal ini
    const existingIzinRows = readSheetAsObjects_('Izin');
    for (let i = 0; i < existingIzinRows.length; i++) {
      const r = existingIzinRows[i];
      if (String(r.nis).trim() === nis &&
          String(r.id_jadwal).trim() === cleanJadwalId &&
          formatTanggalPresensi_(r.tanggal) === todayStr &&
          String(r.status).trim() !== 'Ditolak') {
        throw new Error('Pengajuan untuk jadwal dan tanggal ini sudah pernah dikirim.');
      }
    }

    const isKartuKontrol = siswa.kartu_kontrol === 'Ya';
    const hasBerkas = berkas && typeof berkas === 'object' && cleanBase64_(berkas.base64);

    let initialStatus = '';
    let validatedBerkas = null;

    if (cleanJenis === 'Izin') {
      if (!hasBerkas) {
        throw new Error('Pengajuan Izin wajib melampirkan berkas surat orang tua bertanda tangan.');
      }
      validatedBerkas = validateBerkas_(berkas);
      initialStatus = 'Menunggu persetujuan';
    } else if (cleanJenis === 'Sakit') {
      if (hasBerkas) {
        if (!isKartuKontrol) {
          throw new Error('Siswa tanpa kartu kontrol mengunggah surat dokter setelah pengajuan diajukan.');
        }
        validatedBerkas = validateBerkas_(berkas);
        initialStatus = 'Menunggu persetujuan';
      } else {
        initialStatus = 'Menunggu bukti';
      }
    }

    const idIzin = generateId_('IZN');
    let driveFile = null;
    let linkBukti = '';

    try {
      if (validatedBerkas) {
        const safeFilename = generateSafeFilename_(idIzin, nis, validatedBerkas.ext);
        const folder = getOrCreateBuktiFolder_();
        const blob = Utilities.newBlob(validatedBerkas.bytes, validatedBerkas.mime, safeFilename);
        driveFile = folder.createFile(blob);
        linkBukti = driveFile.getUrl();
      }

      const nowIso = Utilities.formatDate(new Date(), getAppTimeZone_(), "yyyy-MM-dd'T'HH:mm:ssXXX");
      const newIzinRow = {
        id_izin: idIzin,
        nis: nis,
        id_jadwal: cleanJadwalId,
        tanggal: todayStr,
        jenis: cleanJenis,
        alasan: cleanAlasan,
        link_bukti: linkBukti,
        status: initialStatus,
        diajukan_pada: nowIso,
        diproses_oleh: '',
        diproses_pada: '',
        catatan_guru: ''
      };

      appendRow_('Izin', newIzinRow);

      return {
        success: true,
        id_izin: idIzin,
        status: initialStatus,
        message: cleanJenis === 'Sakit' && initialStatus === 'Menunggu bukti'
          ? 'Pengajuan Sakit berhasil disimpan. Silakan unggah bukti surat dokter jika sudah tersedia.'
          : 'Pengajuan ' + cleanJenis + ' berhasil dikirim dan menunggu persetujuan guru.'
      };
    } catch (writeErr) {
      if (driveFile) {
        try {
          driveFile.setTrashed(true);
        } catch (eTrash) {
          Logger.log('Gagal mentrash berkas orphan: ' + eTrash.message);
        }
      }
      throw writeErr;
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Siswa mengunggah bukti surat dokter susulan untuk pengajuan Sakit miliknya yang berstatus 'Menunggu bukti'.
 * Setelah berhasil diunggah, status berubah menjadi 'Menunggu persetujuan'.
 *
 * @param {string} token - Token sesi Siswa
 * @param {string} id_izin - ID pengajuan Sakit
 * @param {Object} berkas - { base64: string, nama?: string, mime?: string }
 * @returns {Object} { success: boolean, id_izin: string, status: string, message: string }
 */
function unggahBukti(token, id_izin, berkas) {
  const session = requireRole_(token, ['Siswa']);
  const nis = String(session.ref_id || '').trim();

  const cleanIdIzin = String(id_izin || '').trim();
  if (!cleanIdIzin) {
    throw new Error('ID pengajuan wajib diisi.');
  }

  const validatedBerkas = validateBerkas_(berkas);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName('Izin');
    if (!sheet) {
      throw new Error('Sheet Izin tidak ditemukan.');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('id_izin');
    const nisIdx = headers.indexOf('nis');
    const jenisIdx = headers.indexOf('jenis');
    const statusIdx = headers.indexOf('status');
    const linkIdx = headers.indexOf('link_bukti');

    if (idIdx === -1 || nisIdx === -1 || jenisIdx === -1 || statusIdx === -1 || linkIdx === -1 ||
        statusIdx !== linkIdx + 1) {
      throw new Error('Struktur kolom sheet Izin tidak sesuai skema.');
    }

    let targetRowIndex = -1;
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idIdx]).trim() === cleanIdIzin) {
        if (String(data[r][nisIdx]).trim() !== nis) {
          throw new Error('Anda tidak memiliki akses ke pengajuan ini.');
        }
        if (String(data[r][jenisIdx]).trim() !== 'Sakit') {
          throw new Error('Unggah bukti susulan hanya berlaku untuk pengajuan Sakit.');
        }
        if (String(data[r][statusIdx]).trim() !== 'Menunggu bukti') {
          throw new Error('Pengajuan ini tidak dalam status Menunggu Bukti.');
        }
        targetRowIndex = r + 1; // 1-based row index
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error('Pengajuan dengan ID "' + cleanIdIzin + '" tidak ditemukan.');
    }

    const safeFilename = generateSafeFilename_(cleanIdIzin, nis, validatedBerkas.ext);
    const folder = getOrCreateBuktiFolder_();
    const blob = Utilities.newBlob(validatedBerkas.bytes, validatedBerkas.mime, safeFilename);
    const driveFile = folder.createFile(blob);
    const linkBukti = driveFile.getUrl();

    try {
      // Skema menaruh status tepat setelah link_bukti: satu setValues 1x2.
      sheet.getRange(targetRowIndex, linkIdx + 1, 1, 2)
        .setValues([[linkBukti, 'Menunggu persetujuan']]);

      return {
        success: true,
        id_izin: cleanIdIzin,
        status: 'Menunggu persetujuan',
        message: 'Bukti surat dokter berhasil diunggah. Status kini Menunggu Persetujuan.'
      };
    } catch (updateErr) {
      if (driveFile) {
        try {
          driveFile.setTrashed(true);
        } catch (eTrash) {
          Logger.log('Gagal mentrash berkas orphan: ' + eTrash.message);
        }
      }
      throw updateErr;
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mengambil maksimal 30 pengajuan terakhir milik siswa yang sedang login.
 * Mengembalikan jenis, mapel, tanggal, status, alasan, catatan_guru (TANPA link_bukti).
 *
 * @param {string} token - Token sesi Siswa
 * @returns {Array<Object>}
 */
function getPengajuanSaya(token) {
  const session = requireRole_(token, ['Siswa']);
  const nis = String(session.ref_id || '').trim();

  const allIzin = readSheetAsObjects_('Izin');
  const myIzin = [];
  for (let i = 0; i < allIzin.length; i++) {
    const iz = allIzin[i];
    if (String(iz.nis).trim() === nis) {
      myIzin.push(iz);
    }
  }

  // Urutkan dari yang terbaru; sel tanggal bisa berupa Date atau teks ISO.
  myIzin.sort(function (a, b) {
    const ta = new Date(a.diajukan_pada || 0).getTime() || 0;
    const tb = new Date(b.diajukan_pada || 0).getTime() || 0;
    return tb - ta;
  });

  const sliced = myIzin.slice(0, 30);

  // Baca relasi jadwal dan mapel
  const allJadwal = readSheetAsObjects_('Jadwal');
  const jadwalMap = {};
  for (let j = 0; j < allJadwal.length; j++) {
    jadwalMap[String(allJadwal[j].id_jadwal).trim()] = allJadwal[j];
  }

  const allMapel = readSheetAsObjects_('Mapel');
  const mapelMap = {};
  for (let m = 0; m < allMapel.length; m++) {
    mapelMap[String(allMapel[m].id_mapel).trim()] = allMapel[m].nama_mapel;
  }

  const results = [];
  for (let s = 0; s < sliced.length; s++) {
    const r = sliced[s];
    const jId = String(r.id_jadwal || '').trim();
    const j = jadwalMap[jId] || null;
    const mapelName = j ? (mapelMap[String(j.id_mapel).trim()] || j.id_mapel) : '-';

    results.push({
      id_izin: String(r.id_izin || '').trim(),
      jenis: String(r.jenis || '').trim(),
      nama_mapel: mapelName,
      tanggal: formatTanggalPresensi_(r.tanggal),
      jam_mulai: j ? String(j.jam_mulai || '') : '',
      jam_selesai: j ? String(j.jam_selesai || '') : '',
      status: String(r.status || '').trim(),
      alasan: String(r.alasan || '').trim(),
      catatan_guru: String(r.catatan_guru || '').trim(),
      diajukan_pada: String(r.diajukan_pada || '').trim()
    });
  }

  return results;
}

// Batas unggah bukti susulan: jumlah hari kalender setelah tanggal pengajuan.
const BATAS_UNGGAH_HARI = 3;
const HANDLER_TOLAK_OTOMATIS_ = 'tolakPengajuanKedaluwarsa_';

/**
 * Fungsi murni: 'yyyy-MM-dd' ditambah n hari, atau '' bila format tidak valid.
 * @param {string} ymd
 * @param {number} hari
 * @returns {string}
 */
function ymdPlusHari_(ymd, hari) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(hari)));
  return d.toISOString().slice(0, 10);
}

/**
 * Fungsi murni: true bila tanggal pengajuan sudah melewati batas unggah
 * (batas = tanggal pengajuan + batasHari; hari batas masih boleh).
 * Tanggal tidak valid tidak pernah dianggap lewat.
 * @param {Date|string} tanggalAjuan
 * @param {string} todayYmd
 * @param {number} batasHari
 * @returns {boolean}
 */
function isLewatBatasUnggah_(tanggalAjuan, todayYmd, batasHari) {
  const tanggal = formatTanggalPresensi_(tanggalAjuan);
  const today = String(todayYmd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  const batas = ymdPlusHari_(tanggal, batasHari);
  return !!batas && today > batas;
}

/**
 * Fungsi murni: aksi sinkronisasi Presensi atas keputusan guru.
 * 'set' = tulis Sakit/Izin, 'revert' = kembalikan ke Alpa, 'none' = tidak ada.
 * @param {string} statusLama
 * @param {string} keputusan
 * @returns {'set'|'revert'|'none'}
 */
function aksiPresensiPengajuan_(statusLama, keputusan) {
  const lama = String(statusLama || '').trim();
  const baru = String(keputusan || '').trim();
  if (baru === 'Disetujui') return lama === 'Disetujui' ? 'none' : 'set';
  if (baru === 'Ditolak') return lama === 'Disetujui' ? 'revert' : 'none';
  return 'none';
}

/**
 * Peta id_jadwal milik guru pada semester aktif. Melempar error bila tidak ada
 * semester aktif.
 * @param {string} nip
 * @returns {Object<string, Object>}
 */
function getJadwalMilikGuru_(nip) {
  const semAktif = getSemesterAktif_();
  if (!semAktif) {
    throw new Error('Tidak ada semester aktif saat ini.');
  }
  const map = {};
  const rows = readSheetAsObjects_('Jadwal');
  for (let i = 0; i < rows.length; i++) {
    const j = rows[i];
    if (String(j.id_semester || '').trim() === semAktif.id_semester &&
        String(j.nip_guru || '').trim() === nip) {
      map[String(j.id_jadwal || '').trim()] = j;
    }
  }
  return map;
}

/**
 * Cari baris pengajuan milik guru (jadwal + semester aktif). Dipakai setelah requireRole_.
 * @param {string} nip
 * @param {string} idIzin
 * @returns {{ sheet: Sheet, headers: Array<string>, rowNumber: number, values: Array }}
 */
function findPengajuanMilikGuru_(nip, idIzin) {
  const jadwalMap = getJadwalMilikGuru_(nip);
  const sheet = getSpreadsheet_().getSheetByName('Izin');
  if (!sheet) throw new Error('Sheet Izin tidak ditemukan.');

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id_izin');
  const jadwalIdx = headers.indexOf('id_jadwal');
  if (idIdx === -1 || jadwalIdx === -1) {
    throw new Error('Struktur kolom sheet Izin tidak sesuai skema.');
  }

  const target = String(idIzin || '').trim();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIdx]).trim() !== target) continue;
    if (!jadwalMap[String(data[r][jadwalIdx]).trim()]) {
      throw new Error('Akses ditolak: pengajuan ini bukan untuk jadwal Anda.');
    }
    return { sheet: sheet, headers: headers, rowNumber: r + 1, values: data[r].slice() };
  }
  throw new Error('Pengajuan dengan ID "' + target + '" tidak ditemukan.');
}

/**
 * Tulis status Sakit/Izin (atau Alpa saat revert) ke baris Presensi yang SUDAH ada.
 * Tidak pernah membuat baris baru. Dipanggil di dalam lock.
 * @returns {number} jumlah baris yang diperbarui
 */
function applyStatusPresensiPengajuan_(idJadwal, tanggal, nis, statusBaru, nip, nowIso) {
  const sheet = getSpreadsheet_().getSheetByName('Presensi');
  if (!sheet) return 0;
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;

  const headers = data[0];
  const jIdx = headers.indexOf('id_jadwal');
  const tIdx = headers.indexOf('tanggal');
  const nIdx = headers.indexOf('nis');
  const sIdx = headers.indexOf('status');
  const oIdx = headers.indexOf('diubah_oleh');
  const pIdx = headers.indexOf('diubah_pada');
  if (jIdx === -1 || tIdx === -1 || nIdx === -1 || sIdx === -1) return 0;

  const targetJadwal = String(idJadwal || '').trim();
  const targetTanggal = String(tanggal || '').trim();
  const targetNis = String(nis || '').trim();
  let updated = 0;

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (String(row[jIdx] || '').trim() !== targetJadwal) continue;
    if (formatTanggalPresensi_(row[tIdx]) !== targetTanggal) continue;
    if (String(row[nIdx] || '').trim() !== targetNis) continue;
    row[sIdx] = statusBaru;
    if (oIdx !== -1) row[oIdx] = nip;
    if (pIdx !== -1) row[pIdx] = nowIso;
    sheet.getRange(r + 1, 1, 1, headers.length).setValues([row]);
    updated++;
  }
  return updated;
}

/**
 * Daftar pengajuan untuk jadwal yang diajar guru login (semester aktif).
 * Tidak menyertakan link_bukti; hanya penanda ada_bukti.
 * @param {string} token
 * @returns {Array<Object>}
 */
function getPengajuanGuru(token) {
  const session = requireRole_(token, ['Guru']);
  const nip = String(session.ref_id || '').trim();
  if (!nip) {
    throw new Error('Identitas NIP guru tidak ditemukan pada sesi.');
  }

  const jadwalMap = getJadwalMilikGuru_(nip);

  const mapelMap = {};
  readSheetAsObjects_('Mapel').forEach(function (m) {
    mapelMap[String(m.id_mapel || '').trim()] = String(m.nama_mapel || '').trim();
  });
  const kelasMap = {};
  readSheetAsObjects_('Kelas').forEach(function (k) {
    kelasMap[String(k.id_kelas || '').trim()] = String(k.nama_kelas || '').trim();
  });
  const siswaMap = {};
  readSheetAsObjects_('Siswa').forEach(function (s) {
    siswaMap[String(s.nis || '').trim()] = String(s.nama || '').trim();
  });

  const items = [];
  readSheetAsObjects_('Izin').forEach(function (r) {
    const jadwalId = String(r.id_jadwal || '').trim();
    const j = jadwalMap[jadwalId];
    if (!j) return;
    const nis = String(r.nis || '').trim();
    items.push({
      id_izin: String(r.id_izin || '').trim(),
      nis: nis,
      nama_siswa: siswaMap[nis] || nis,
      id_jadwal: jadwalId,
      nama_kelas: kelasMap[String(j.id_kelas || '').trim()] || String(j.id_kelas || '').trim(),
      nama_mapel: mapelMap[String(j.id_mapel || '').trim()] || String(j.id_mapel || '').trim(),
      jam_mulai: jamText_(j.jam_mulai),
      jam_selesai: jamText_(j.jam_selesai),
      tanggal: formatTanggalPresensi_(r.tanggal),
      jenis: String(r.jenis || '').trim(),
      alasan: String(r.alasan || '').trim(),
      status: String(r.status || '').trim(),
      diajukan_pada: String(r.diajukan_pada || '').trim(),
      diproses_oleh: String(r.diproses_oleh || '').trim(),
      diproses_pada: String(r.diproses_pada || '').trim(),
      catatan_guru: String(r.catatan_guru || '').trim(),
      ada_bukti: !!String(r.link_bukti || '').trim()
    });
  });

  items.sort(function (a, b) {
    return (new Date(b.diajukan_pada || 0).getTime() || 0) -
      (new Date(a.diajukan_pada || 0).getTime() || 0);
  });
  return items;
}

/**
 * Isi berkas bukti sebagai data URL untuk guru pemilik jadwal. link_bukti tidak dikirim.
 * @param {string} token
 * @param {string} id_izin
 * @returns {Object}
 */
function getBuktiPengajuan(token, id_izin) {
  const session = requireRole_(token, ['Guru']);
  const nip = String(session.ref_id || '').trim();
  if (!nip) {
    throw new Error('Identitas NIP guru tidak ditemukan pada sesi.');
  }

  const found = findPengajuanMilikGuru_(nip, id_izin);
  const linkIdx = found.headers.indexOf('link_bukti');
  const link = linkIdx === -1 ? '' : String(found.values[linkIdx] || '').trim();
  if (!link) {
    throw new Error('Bukti belum diunggah untuk pengajuan ini.');
  }

  const match = link.match(/(?:\/d\/|id=)([-\w]{25,})/);
  if (!match) {
    throw new Error('Tautan bukti tidak dikenali.');
  }

  try {
    const file = DriveApp.getFileById(match[1]);
    const blob = file.getBlob();
    const mime = blob.getContentType();
    return {
      success: true,
      id_izin: String(id_izin).trim(),
      nama: file.getName(),
      mime: mime,
      data_url: 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes())
    };
  } catch (e) {
    throw new Error('Gagal membaca berkas bukti dari Drive.');
  }
}

/**
 * Setujui/tolak pengajuan milik guru login. Presensi (bila sudah ada) ikut disinkronkan.
 * @param {string} token
 * @param {string} id_izin
 * @param {'Disetujui'|'Ditolak'} keputusan
 * @param {string} [catatan]
 * @returns {Object}
 */
function prosesPengajuan(token, id_izin, keputusan, catatan) {
  const session = requireRole_(token, ['Guru']);
  const nip = String(session.ref_id || '').trim();
  if (!nip) {
    throw new Error('Identitas NIP guru tidak ditemukan pada sesi.');
  }

  const cleanKeputusan = String(keputusan || '').trim();
  if (cleanKeputusan !== 'Disetujui' && cleanKeputusan !== 'Ditolak') {
    throw new Error('Keputusan hanya boleh "Disetujui" atau "Ditolak".');
  }
  const cleanCatatan = String(catatan || '').trim();
  if (cleanCatatan.length > 300) {
    throw new Error('Catatan guru maksimal 300 karakter.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const found = findPengajuanMilikGuru_(nip, id_izin);
    const headers = found.headers;
    const row = found.values;
    const idx = {};
    ['id_jadwal', 'tanggal', 'nis', 'jenis', 'status', 'diproses_oleh', 'diproses_pada', 'catatan_guru']
      .forEach(function (k) { idx[k] = headers.indexOf(k); });

    if (idx.status === -1 || idx.diproses_oleh === -1 || idx.diproses_pada === -1 || idx.catatan_guru === -1) {
      throw new Error('Struktur kolom sheet Izin tidak sesuai skema.');
    }

    const nowIso = Utilities.formatDate(new Date(), getAppTimeZone_(), "yyyy-MM-dd'T'HH:mm:ssXXX");
    const aksi = aksiPresensiPengajuan_(row[idx.status], cleanKeputusan);

    // Presensi dulu agar keputusan tidak tercatat bila sinkronisasi gagal.
    if (aksi !== 'none') {
      const statusBaru = aksi === 'revert' ? 'Alpa' : String(row[idx.jenis] || '').trim();
      applyStatusPresensiPengajuan_(
        String(row[idx.id_jadwal] || '').trim(),
        formatTanggalPresensi_(row[idx.tanggal]),
        String(row[idx.nis] || '').trim(),
        statusBaru,
        nip,
        nowIso
      );
    }

    row[idx.status] = cleanKeputusan;
    row[idx.diproses_oleh] = nip;
    row[idx.diproses_pada] = nowIso;
    row[idx.catatan_guru] = cleanCatatan;
    found.sheet.getRange(found.rowNumber, 1, 1, headers.length).setValues([row]);

    return {
      success: true,
      status: cleanKeputusan,
      message: cleanKeputusan === 'Disetujui' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handler time-driven (bukan requireRole_): tolak otomatis pengajuan Sakit
 * berstatus "Menunggu bukti" yang melewati BATAS_UNGGAH_HARI.
 * @param {string[]=} idIzinDiizinkan Bila diberikan, hanya id_izin ini yang diproses (untuk test).
 * @returns {{ updated: number }}
 */
function tolakPengajuanKedaluwarsa_(idIzinDiizinkan) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSpreadsheet_().getSheetByName('Izin');
    if (!sheet) return { updated: 0 };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { updated: 0 };

    const headers = data[0];
    const idx = {};
    ['id_izin', 'tanggal', 'jenis', 'status', 'diproses_oleh', 'diproses_pada', 'catatan_guru']
      .forEach(function (k) { idx[k] = headers.indexOf(k); });
    if (idx.id_izin === -1 || idx.tanggal === -1 || idx.jenis === -1 || idx.status === -1 ||
        idx.diproses_oleh === -1 || idx.diproses_pada === -1 || idx.catatan_guru === -1) {
      throw new Error('Struktur kolom sheet Izin tidak sesuai skema.');
    }

    const allowed = Array.isArray(idIzinDiizinkan)
      ? new Set(idIzinDiizinkan.map(String))
      : null;

    const todayStr = getTodayYmd_();
    const nowIso = Utilities.formatDate(new Date(), getAppTimeZone_(), "yyyy-MM-dd'T'HH:mm:ssXXX");
    const updates = [];

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (allowed && !allowed.has(String(row[idx.id_izin]))) continue;
      if (String(row[idx.jenis] || '').trim() !== 'Sakit') continue;
      if (String(row[idx.status] || '').trim() !== 'Menunggu bukti') continue;
      if (!isLewatBatasUnggah_(row[idx.tanggal], todayStr, BATAS_UNGGAH_HARI)) continue;

      row[idx.status] = 'Ditolak';
      row[idx.diproses_oleh] = 'SISTEM';
      row[idx.diproses_pada] = nowIso;
      row[idx.catatan_guru] = 'Ditolak otomatis: bukti tidak diunggah';
      updates.push({ rowNumber: r + 1, values: row });
    }

    if (updates.length > 0) {
      const minRow = Math.min.apply(null, updates.map(function (u) { return u.rowNumber; }));
      const maxRow = Math.max.apply(null, updates.map(function (u) { return u.rowNumber; }));
      if (maxRow - minRow + 1 === updates.length) {
        sheet.getRange(minRow, 1, updates.length, headers.length)
          .setValues(updates.map(function (u) { return u.values; }));
      } else {
        for (let u = 0; u < updates.length; u++) {
          sheet.getRange(updates[u].rowNumber, 1, 1, headers.length)
            .setValues([updates[u].values]);
        }
      }
    }

    Logger.log('tolakPengajuanKedaluwarsa_: ' + updates.length + ' pengajuan ditolak otomatis.');
    return { updated: updates.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Pasang trigger harian penolakan otomatis. Idempoten: trigger lama dengan
 * handler yang sama dihapus lebih dulu. Jalankan sekali dari editor sebagai pemilik.
 * @returns {string}
 */
function installTriggers_() {
  requireEditorOwner_();

  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === HANDLER_TOLAK_OTOMATIS_) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }

  ScriptApp.newTrigger(HANDLER_TOLAK_OTOMATIS_)
    .timeBased()
    .atHour(1)
    .everyDays(1)
    .create();

  const message = 'Trigger harian penolakan otomatis dipasang (trigger lama dihapus: ' + removed + ').';
  Logger.log(message);
  return message;
}
