/**
 * Aplikasi Presensi Sekolah - Rekap.gs (T09)
 * Rekap kehadiran (Siswa, Guru, Admin) dan ekspor Excel.
 */

const BATAS_BARIS_EKSPOR_REKAP_ = 5000;
const MIME_XLSX_ = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const STATUS_REKAP_ = ['Hadir', 'Izin', 'Sakit', 'Alpa'];

/**
 * Persentase hadir satu desimal; total 0 tampil "-".
 * @param {number} hadir
 * @param {number} total
 * @returns {string}
 */
function hitungPersenHadir_(hadir, total) {
  if (!total) return '-';
  return ((hadir / total) * 100).toFixed(1);
}

/**
 * Fungsi murni: jumlah Hadir/Izin/Sakit/Alpa pada satu tanggal untuk jadwal tertentu.
 * @param {Array<Object>} presensiRows
 * @param {Set<string>} idJadwalSet - jadwal yang boleh dihitung (semester aktif)
 * @param {string} tanggal - yyyy-MM-dd
 * @returns {{hadir:number, izin:number, sakit:number, alpa:number, total:number, persen:string}}
 */
function hitungStatusPresensi_(presensiRows, idJadwalSet, tanggal) {
  const hasil = { hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0, persen: '-' };
  const target = String(tanggal || '').trim();
  (presensiRows || []).forEach(function (p) {
    if (!p) return;
    if (formatTanggalPresensi_(p.tanggal) !== target) return;
    if (idJadwalSet && !idJadwalSet.has(String(p.id_jadwal || '').trim())) return;
    const status = String(p.status || '').trim().toLowerCase();
    if (['hadir', 'izin', 'sakit', 'alpa'].indexOf(status) === -1) return;
    hasil[status]++;
    hasil.total++;
  });
  hasil.persen = hitungPersenHadir_(hasil.hadir, hasil.total);
  return hasil;
}

/**
 * Fungsi murni: jumlahkan baris hasil agregasiRekap_ menjadi satu ringkasan.
 * @param {Array<Object>} rows
 * @returns {Object}
 */
function ringkasRekap_(rows) {
  const ringkasan = { hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0, persen: '-' };
  (rows || []).forEach(function (r) {
    ringkasan.hadir += r.hadir;
    ringkasan.izin += r.izin;
    ringkasan.sakit += r.sakit;
    ringkasan.alpa += r.alpa;
    ringkasan.total += r.total;
  });
  ringkasan.persen = hitungPersenHadir_(ringkasan.hadir, ringkasan.total);
  return ringkasan;
}

/**
 * Fungsi murni: jumlah pengajuan "Menunggu persetujuan" pada jadwal milik guru.
 */
function hitungPengajuanMenunggu_(izinRows, idJadwalSet) {
  let jumlah = 0;
  (izinRows || []).forEach(function (r) {
    if (String(r.status || '').trim() !== 'Menunggu persetujuan') return;
    if (idJadwalSet && !idJadwalSet.has(String(r.id_jadwal || '').trim())) return;
    jumlah++;
  });
  return jumlah;
}

/**
 * Fungsi murni: pengajuan terbaru milik siswa (null bila tidak ada).
 */
function ambilPengajuanTerakhir_(izinRows, nis) {
  const target = String(nis || '').trim();
  if (!target) return null;
  let terpilih = null;
  let waktuTerpilih = -Infinity;
  (izinRows || []).forEach(function (r) {
    if (String(r.nis || '').trim() !== target) return;
    const waktu = new Date(r.diajukan_pada || 0).getTime() || 0;
    if (waktu < waktuTerpilih) return;
    waktuTerpilih = waktu;
    terpilih = {
      jenis: String(r.jenis || '').trim(),
      tanggal: formatTanggalPresensi_(r.tanggal),
      status: String(r.status || '').trim(),
      alasan: String(r.alasan || '').trim(),
      catatan_guru: String(r.catatan_guru || '').trim()
    };
  });
  return terpilih;
}

/**
 * Bersihkan filter dari klien: teks, tanggal yyyy-MM-dd, rentang tidak terbalik.
 * @param {Object} filter
 * @returns {Object}
 */
function normalisasiFilterRekap_(filter) {
  const f = filter || {};
  function teks(v) {
    return String(v === null || v === undefined ? '' : v).trim();
  }
  function tanggal(v, label) {
    const s = teks(v);
    if (!s) return '';
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z').getTime());
    if (!valid) throw new Error(label + ' tidak valid (format yyyy-MM-dd).');
    return s;
  }

  const hasil = {
    id_semester: teks(f.id_semester),
    id_kelas: teks(f.id_kelas),
    id_mapel: teks(f.id_mapel),
    nip_guru: teks(f.nip_guru),
    nis: teks(f.nis),
    tanggal_dari: tanggal(f.tanggal_dari, 'Tanggal awal'),
    tanggal_sampai: tanggal(f.tanggal_sampai, 'Tanggal akhir'),
    group_by: f.group_by === 'mapel' ? 'mapel' : 'kelas_mapel'
  };
  if (hasil.tanggal_dari && hasil.tanggal_sampai && hasil.tanggal_dari > hasil.tanggal_sampai) {
    throw new Error('Tanggal awal tidak boleh setelah tanggal akhir.');
  }
  return hasil;
}

/**
 * FUNGSI MURNI: agregasi presensi di memori, sekali jalan.
 * Hanya pertemuan yang tercatat di Presensi yang dihitung.
 * @param {Object} data - { presensi, jadwal, siswa, kelas, mapel }
 * @param {Object} filter - hasil normalisasiFilterRekap_ + nip_guru/nis/group_by
 * @returns {Array<Object>}
 */
function agregasiRekap_(data, filter) {
  const f = normalisasiFilterRekap_(filter);
  const sumber = data || {};

  const kelasMap = {};
  (sumber.kelas || []).forEach(function (k) {
    const id = String(k.id_kelas || '').trim();
    kelasMap[id] = String(k.nama_kelas || '').trim() || id;
  });
  const mapelMap = {};
  (sumber.mapel || []).forEach(function (m) {
    const id = String(m.id_mapel || '').trim();
    mapelMap[id] = String(m.nama_mapel || '').trim() || id;
  });

  const jadwalMap = {};
  (sumber.jadwal || []).forEach(function (j) {
    if (f.id_semester && String(j.id_semester || '').trim() !== f.id_semester) return;
    if (f.id_kelas && String(j.id_kelas || '').trim() !== f.id_kelas) return;
    if (f.id_mapel && String(j.id_mapel || '').trim() !== f.id_mapel) return;
    if (f.nip_guru && String(j.nip_guru || '').trim() !== f.nip_guru) return;
    jadwalMap[String(j.id_jadwal || '').trim()] = {
      id_kelas: String(j.id_kelas || '').trim(),
      id_mapel: String(j.id_mapel || '').trim()
    };
  });

  const groups = {};
  (sumber.presensi || []).forEach(function (p) {
    const jadwal = jadwalMap[String(p.id_jadwal || '').trim()];
    if (!jadwal) return;
    if (f.nis && String(p.nis || '').trim() !== f.nis) return;

    const tgl = formatTanggalPresensi_(p.tanggal);
    if (f.tanggal_dari && tgl < f.tanggal_dari) return;
    if (f.tanggal_sampai && tgl > f.tanggal_sampai) return;

    const status = String(p.status || '').trim();
    if (STATUS_REKAP_.indexOf(status) === -1) return;

    const isMapel = f.group_by === 'mapel';
    const key = isMapel ? jadwal.id_mapel : jadwal.id_kelas + '|' + jadwal.id_mapel;
    if (!groups[key]) {
      groups[key] = {
        id_kelas: isMapel ? '' : jadwal.id_kelas,
        id_mapel: jadwal.id_mapel,
        hadir: 0, izin: 0, sakit: 0, alpa: 0
      };
    }
    groups[key][status.toLowerCase()]++;
  });

  return Object.keys(groups).map(function (key) {
    const g = groups[key];
    const total = g.hadir + g.izin + g.sakit + g.alpa;
    return {
      kunci: key,
      id_kelas: g.id_kelas,
      nama_kelas: g.id_kelas ? (kelasMap[g.id_kelas] || g.id_kelas) : '',
      id_mapel: g.id_mapel,
      nama_mapel: mapelMap[g.id_mapel] || g.id_mapel,
      hadir: g.hadir,
      izin: g.izin,
      sakit: g.sakit,
      alpa: g.alpa,
      total: total,
      persen: hitungPersenHadir_(g.hadir, total)
    };
  }).sort(function (a, b) {
    const ka = a.nama_kelas + ' ' + a.nama_mapel;
    const kb = b.nama_kelas + ' ' + b.nama_mapel;
    return ka.localeCompare(kb);
  });
}

/**
 * Baca 5 sheet sekali, selesaikan semester default, lalu agregasi.
 * @param {Object} scope - { nip_guru?, nis?, group_by }
 * @param {Object} filter
 * @returns {Object} { id_semester, group_by, rows, ringkasan }
 */
function bangunRekap_(scope, filter) {
  const f = normalisasiFilterRekap_(filter);
  if (!f.id_semester) {
    const aktif = getSemesterAktif_();
    if (!aktif) throw new Error('Tidak ada semester aktif. Pilih semester terlebih dahulu.');
    f.id_semester = String(aktif.id_semester || '').trim();
  }

  const data = {
    presensi: readSheetAsObjects_('Presensi'),
    jadwal: readSheetAsObjects_('Jadwal'),
    siswa: readSheetAsObjects_('Siswa'),
    kelas: readSheetAsObjects_('Kelas'),
    mapel: readSheetAsObjects_('Mapel')
  };
  const rows = agregasiRekap_(data, Object.assign({}, f, scope || {}));
  const ringkasan = ringkasRekap_(rows);

  return {
    id_semester: f.id_semester,
    group_by: (scope && scope.group_by) || f.group_by,
    rows: rows,
    ringkasan: ringkasan
  };
}

/**
 * Opsi filter untuk halaman rekap (semua role).
 * @param {string} token
 * @returns {Object}
 */
function getOpsiRekap(token) {
  requireRole_(token, ['Admin', 'Guru', 'Siswa']);

  const semester = readSheetAsObjects_('Semester').map(function (s) {
    return {
      id_semester: String(s.id_semester || '').trim(),
      tahun_ajaran: String(s.tahun_ajaran || '').trim(),
      semester: String(s.semester || '').trim(),
      status: String(s.status || '').trim()
    };
  });
  const kelas = readSheetAsObjects_('Kelas').map(function (k) {
    return { id_kelas: String(k.id_kelas || '').trim(), nama_kelas: String(k.nama_kelas || '').trim() };
  }).sort(function (a, b) { return a.nama_kelas.localeCompare(b.nama_kelas); });
  const mapel = readSheetAsObjects_('Mapel').map(function (m) {
    return { id_mapel: String(m.id_mapel || '').trim(), nama_mapel: String(m.nama_mapel || '').trim() };
  }).sort(function (a, b) { return a.nama_mapel.localeCompare(b.nama_mapel); });

  const aktif = semester.filter(function (s) { return s.status === 'Aktif'; })[0];
  return {
    semester: semester,
    kelas: kelas,
    mapel: mapel,
    id_semester_aktif: aktif ? aktif.id_semester : ''
  };
}

/**
 * Rekap untuk siswa login (NIS dari sesi; filter NIS dari klien diabaikan).
 */
function getRekapSiswa(token, filter) {
  const session = requireRole_(token, ['Siswa']);
  const nis = String(session.ref_id || '').trim();
  if (!nis) throw new Error('Identitas NIS siswa tidak ditemukan pada sesi.');
  return bangunRekap_({ nis: nis, group_by: 'mapel' }, filter);
}

/**
 * Rekap untuk guru login (hanya jadwal dengan nip_guru = sesi).
 */
function getRekapGuru(token, filter) {
  const session = requireRole_(token, ['Guru']);
  const nip = String(session.ref_id || '').trim();
  if (!nip) throw new Error('Identitas NIP guru tidak ditemukan pada sesi.');
  return bangunRekap_({ nip_guru: nip, group_by: 'kelas_mapel' }, filter);
}

/**
 * Rekap seluruh sekolah (Admin).
 */
function getRekapAdmin(token, filter) {
  requireRole_(token, ['Admin']);
  return bangunRekap_({ group_by: 'kelas_mapel' }, filter);
}

/**
 * Dashboard Admin: jumlah master + presensi hari ini (satu panggilan, satu baca per sheet).
 * @param {string} token
 * @returns {Object}
 */
function getDashboardAdmin(token) {
  requireRole_(token, ['Admin']);

  const semAktif = getSemesterAktif_();
  const siswa = readSheetAsObjects_('Siswa');
  const guru = readSheetAsObjects_('Guru');
  const kelas = readSheetAsObjects_('Kelas');
  const jadwal = readSheetAsObjects_('Jadwal');
  const presensi = readSheetAsObjects_('Presensi');
  const tanggal = getTodayYmd_();

  const idJadwalAktif = new Set();
  if (semAktif) {
    jadwal.forEach(function (j) {
      if (String(j.id_semester || '').trim() === semAktif.id_semester) {
        idJadwalAktif.add(String(j.id_jadwal || '').trim());
      }
    });
  }

  return {
    semester: semAktif,
    tanggal: tanggal,
    total_siswa: siswa.length,
    total_guru: guru.length,
    total_kelas: kelas.length,
    presensi_hari_ini: hitungStatusPresensi_(semAktif ? presensi : [], idJadwalAktif, tanggal)
  };
}

/**
 * Dashboard Guru: jadwal hari ini + pengajuan menunggu persetujuan untuk jadwalnya.
 * @param {string} token
 * @returns {Object}
 */
function getDashboardGuru(token) {
  const session = requireRole_(token, ['Guru']);
  const nip = String(session.ref_id || '').trim();
  if (!nip) throw new Error('Identitas NIP guru tidak ditemukan pada sesi.');

  const semAktif = getSemesterAktif_();
  const tanggal = getTodayYmd_();
  const hari = hariDariTanggal_(tanggal);

  if (!semAktif) {
    return {
      semester: null, tanggal: tanggal, hari: hari,
      jadwal: [], jumlah_belum_diisi: 0, pengajuan_menunggu: 0
    };
  }

  const jadwal = tandaiStatusPresensiJadwal_(
    getJadwalByGuruHari_(nip, hari, semAktif),
    readSheetAsObjects_('Presensi'),
    tanggal
  );
  const idJadwal = new Set();
  jadwal.forEach(function (j) { idJadwal.add(String(j.id_jadwal || '').trim()); });

  return {
    semester: semAktif,
    tanggal: tanggal,
    hari: hari,
    jadwal: jadwal,
    jumlah_belum_diisi: jadwal.filter(function (j) {
      return j.status_presensi === 'Belum diisi';
    }).length,
    pengajuan_menunggu: hitungPengajuanMenunggu_(readSheetAsObjects_('Izin'), idJadwal)
  };
}

/**
 * Dashboard Siswa: % hadir semester aktif (agregasi Rekap.gs) + status pengajuan terakhir.
 * @param {string} token
 * @returns {Object}
 */
function getDashboardSiswa(token) {
  const session = requireRole_(token, ['Siswa']);
  const nis = String(session.ref_id || '').trim();
  if (!nis) throw new Error('Identitas NIS siswa tidak ditemukan pada sesi.');

  const semAktif = getSemesterAktif_();
  const data = {
    presensi: readSheetAsObjects_('Presensi'),
    jadwal: readSheetAsObjects_('Jadwal'),
    siswa: readSheetAsObjects_('Siswa'),
    kelas: readSheetAsObjects_('Kelas'),
    mapel: readSheetAsObjects_('Mapel')
  };

  const siswaRow = data.siswa.filter(function (s) {
    return String(s.nis || '').trim() === nis;
  })[0] || null;
  const kelasMap = {};
  data.kelas.forEach(function (k) {
    kelasMap[String(k.id_kelas || '').trim()] = String(k.nama_kelas || '').trim();
  });

  const rows = semAktif ? agregasiRekap_(data, {
    id_semester: semAktif.id_semester,
    nis: nis,
    group_by: 'mapel'
  }) : [];

  return {
    semester: semAktif,
    siswa: siswaRow ? {
      nis: nis,
      nama: String(siswaRow.nama || '').trim(),
      nama_kelas: kelasMap[String(siswaRow.id_kelas || '').trim()] || String(siswaRow.id_kelas || '').trim()
    } : null,
    ringkasan: ringkasRekap_(rows),
    pengajuan_terakhir: ambilPengajuanTerakhir_(readSheetAsObjects_('Izin'), nis)
  };
}

/**
 * Nama file ekspor dibuat server dan dibersihkan dari karakter berbahaya.
 * @param {Array<string>} bagian
 * @param {string} tanggalYmd
 * @returns {string}
 */
function namaFileRekap_(bagian, tanggalYmd) {
  const bersih = (bagian || []).map(function (b) {
    return String(b === null || b === undefined ? '' : b)
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }).filter(Boolean).join('_');
  const tgl = String(tanggalYmd || '').replace(/[^0-9]/g, '') || 'tanpa_tanggal';
  const nama = ('Rekap_Presensi_' + (bersih || 'Semua') + '_' + tgl).slice(0, 120);
  return nama + '.xlsx';
}

/**
 * Cegah formula injection: teks berawalan = + - @ diberi kutip depan.
 * @param {*} nilai
 * @returns {*}
 */
function sanitasiSelExcel_(nilai) {
  if (typeof nilai !== 'string') return nilai;
  return /^[=+\-@]/.test(nilai) ? "'" + nilai : nilai;
}

/**
 * Ekspor rekap ke .xlsx lewat spreadsheet sementara (selalu dihapus).
 * Guru hanya mengekspor jadwal miliknya.
 * @param {string} token
 * @param {Object} filter
 * @returns {Object} { filename, mime, base64 }
 */
function exportRekapExcel(token, filter) {
  const session = requireRole_(token, ['Guru', 'Admin']);
  const isGuru = session.role === 'Guru';
  const scope = { group_by: 'kelas_mapel' };
  if (isGuru) {
    const nip = String(session.ref_id || '').trim();
    if (!nip) throw new Error('Identitas NIP guru tidak ditemukan pada sesi.');
    scope.nip_guru = nip;
  }

  const hasil = bangunRekap_(scope, filter);
  if (hasil.rows.length === 0) throw new Error('Tidak ada data rekap untuk diekspor.');
  if (hasil.rows.length > BATAS_BARIS_EKSPOR_REKAP_) {
    throw new Error('Data rekap melebihi batas ' + BATAS_BARIS_EKSPOR_REKAP_ + ' baris. Persempit filter.');
  }

  const header = ['Kelas', 'Mata Pelajaran', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Total', '% Hadir'];
  const values = [header];
  hasil.rows.forEach(function (r) {
    values.push([
      sanitasiSelExcel_(r.nama_kelas),
      sanitasiSelExcel_(r.nama_mapel),
      r.hadir, r.izin, r.sakit, r.alpa, r.total, r.persen
    ]);
  });

  const nama = namaFileRekap_([session.role, hasil.id_semester], getTodayYmd_());
  const temp = SpreadsheetApp.create(nama.replace(/\.xlsx$/, ''));
  try {
    const sheet = temp.getActiveSheet();
    sheet.getRange(1, 1, values.length, header.length).setValues(values);
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');

    const url = 'https://docs.google.com/spreadsheets/d/' + temp.getId() + '/export?format=xlsx';
    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      throw new Error('Gagal mengekspor Excel (HTTP ' + res.getResponseCode() + ').');
    }
    const bytes = res.getBlob().getBytes();
    return {
      filename: nama,
      mime: MIME_XLSX_,
      base64: Utilities.base64Encode(bytes)
    };
  } finally {
    DriveApp.getFileById(temp.getId()).setTrashed(true);
  }
}
