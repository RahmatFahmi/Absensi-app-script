/**
 * Aplikasi Presensi Sekolah - Import.gs (T05: Import Data Paste)
 * Fungsi murni (parseTsv_, analyzeImport_) diuji lewat node.
 * Server: previewImport, commitImport (Admin, LockService, batch write), getImportTemplate.
 */

const IMPORT_MAX_ROWS = 500;
const IMPORT_MAX_BYTES = 200 * 1024;

// Header per entitas (urutan kolom boleh berbeda, dicocokkan lewat nama)
const IMPORT_SPECS = {
  Kelas: {
    sheet: 'Kelas',
    headers: ['nama_kelas'],
    sample: ['X-MIPA-1']
  },
  Mapel: {
    sheet: 'Mapel',
    headers: ['nama_mapel'],
    sample: ['Matematika']
  },
  Guru: {
    sheet: 'Guru',
    headers: ['nip', 'nama'],
    sample: ['198205122008011003', 'Budi Pratama, S.Pd']
  },
  Siswa: {
    sheet: 'Siswa',
    headers: ['nis', 'nama', 'nama_kelas', 'kartu_kontrol'],
    sample: ['0012345', 'Ahmad Dahlan', 'X-MIPA-1', 'Tidak']
  },
  Jadwal: {
    sheet: 'Jadwal',
    headers: ['tahun_ajaran', 'semester', 'nama_kelas', 'nama_mapel', 'nip_guru', 'hari', 'jam_mulai', 'jam_selesai'],
    sample: ['2026/2027', 'Ganjil', 'X-MIPA-1', 'Matematika', '198205122008011003', 'Senin', '07:00', '08:00']
  }
};

/**
 * Parser TSV murni: BOM, CRLF, sel berkutip (newline & kutip ganda), baris kosong.
 * @param {string} text
 * @returns {{headers: Array<string>, rows: Array<{line: number, cells: Array<string>}>}}
 */
function parseTsv_(text) {
  const raw = String(text === null || text === undefined ? '' : text);
  if (raw.length > IMPORT_MAX_BYTES) {
    throw new Error('Teks terlalu besar: maksimal 200 KB per import');
  }
  const src = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  if (!src.trim()) {
    throw new Error('Teks kosong. Tempel data beserta baris header.');
  }

  const rows = [];
  let cells = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  function pushCell() {
    cells.push(cell.trim());
    cell = '';
  }

  function pushRow() {
    pushCell();
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (cells.length) rows.push({ line: rowLine, cells: cells });
    cells = [];
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (src.charAt(i + 1) === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (ch === '\r' && src.charAt(i + 1) === '\n') {
        // biarkan \n yang menangani baris baru di dalam sel
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') {
      inQuotes = true;
      continue;
    }
    if (ch === '\t') {
      pushCell();
      continue;
    }
    if (ch === '\r') continue;
    if (ch === '\n') {
      pushRow();
      line++;
      rowLine = line;
      continue;
    }
    cell += ch;
  }
  if (cell !== '' || cells.length) pushRow();

  if (!rows.length) {
    throw new Error('Tidak ada baris data. Baris pertama harus berisi header.');
  }
  if (rows.length - 1 > IMPORT_MAX_ROWS) {
    throw new Error('Maksimal ' + IMPORT_MAX_ROWS + ' baris data per import (ditemukan ' + (rows.length - 1) + ')');
  }
  return { headers: rows[0].cells, rows: rows.slice(1) };
}

function importLower_(nilai) {
  return String(nilai === null || nilai === undefined ? '' : nilai).trim().toLowerCase();
}

function filterByImportField_(list, field, value) {
  const target = importLower_(value);
  return (list || []).filter(function (item) {
    return importLower_(item[field]) === target;
  });
}

function namaById_(list, idField, nameField, id) {
  const found = (list || []).filter(function (item) {
    return String(item[idField]).trim() === String(id).trim();
  })[0];
  return found ? String(found[nameField]) : String(id);
}

/**
 * Pastikan grid sheet cukup baris sebelum getRange/setValues (hindari error
 * "range invalid" saat import besar melewati batas baris sheet).
 */
function ensureSheetRows_(sheet, lastRowNeeded) {
  if (sheet.getMaxRows() < lastRowNeeded) {
    sheet.insertRowsAfter(sheet.getMaxRows(), lastRowNeeded - sheet.getMaxRows());
  }
}

/**
 * Analisis murni (tanpa menulis/membaca sheet): validasi tiap baris import.
 * @param {string} entity
 * @param {string} text
 * @param {Object} ctx - data sheet yang sudah dibaca (Kelas, Mapel, Guru, Siswa, Semester, Jadwal, Users)
 * @returns {Object} { entity, headers, rows, summary, fatal }
 */
function analyzeImport_(entity, text, ctx) {
  const result = {
    entity: entity,
    headers: [],
    rows: [],
    summary: { total: 0, valid: 0, invalid: 0 },
    fatal: null
  };

  const spec = IMPORT_SPECS[entity];
  if (!spec) {
    result.fatal = 'Jenis data import tidak valid: ' + entity;
    return result;
  }

  let parsed;
  try {
    parsed = parseTsv_(text);
  } catch (e) {
    result.fatal = e.message;
    return result;
  }

  const expected = spec.headers;
  const actualRaw = parsed.headers.map(function (h) { return String(h).trim(); });
  const actualLower = [];
  for (let i = 0; i < actualRaw.length; i++) {
    const name = actualRaw[i].toLowerCase();
    if (!name) {
      result.fatal = 'Header kolom ke-' + (i + 1) + ' kosong. Header wajib ada di baris pertama.';
      return result;
    }
    if (actualLower.indexOf(name) !== -1) {
      result.fatal = 'Header duplikat: "' + actualRaw[i] + '"';
      return result;
    }
    if (expected.map(function (h) { return h.toLowerCase(); }).indexOf(name) === -1) {
      result.fatal = 'Header tidak dikenal: "' + actualRaw[i] + '"';
      return result;
    }
    actualLower.push(name);
  }
  const missing = expected.filter(function (h) {
    return actualLower.indexOf(h.toLowerCase()) === -1;
  });
  if (missing.length) {
    result.fatal = 'Header wajib hilang: ' + missing.join(', ');
    return result;
  }
  result.headers = expected;

  const c = ctx || {};
  const existing = {
    Kelas: c.Kelas || [],
    Mapel: c.Mapel || [],
    Guru: c.Guru || [],
    Siswa: c.Siswa || [],
    Semester: c.Semester || [],
    Jadwal: c.Jadwal || [],
    Users: c.Users || []
  };

  const positions = {};
  expected.forEach(function (h) {
    positions[h] = actualRaw.map(function (x) { return x.toLowerCase(); }).indexOf(h.toLowerCase());
  });

  const seen = {};
  const acceptedJadwal = [];

  parsed.rows.forEach(function (rawRow) {
    const errors = [];
    const v = {};
    expected.forEach(function (h) {
      const cell = rawRow.cells[positions[h]];
      v[h] = cell === undefined || cell === null ? '' : String(cell).trim();
    });
    if (rawRow.cells.length > actualRaw.length) {
      errors.push('Jumlah kolom melebihi jumlah header (' + rawRow.cells.length + ' > ' + actualRaw.length + ')');
    }

    // Tolak nilai yang akan dieksekusi sebagai rumus; format '@' tidak menahan.
    expected.forEach(function (h) {
      if (awalanFormula_(v[h])) {
        errors.push('Kolom ' + h.toUpperCase() + ' tidak boleh diawali = + - @');
      }
    });

    const data = {};

    if (entity === 'Kelas') {
      const nama = v.nama_kelas;
      if (!nama) {
        errors.push('Kolom NAMA_KELAS wajib diisi');
      } else {
        const key = 'kelas:' + nama.toLowerCase();
        if (seen[key]) {
          errors.push('Duplikat dalam tempelan dengan baris ' + seen[key]);
        } else if (filterByImportField_(existing.Kelas, 'nama_kelas', nama).length) {
          errors.push('Kelas "' + nama + '" sudah ada');
        } else {
          seen[key] = rawRow.line;
        }
        data.nama_kelas = nama;
      }

    } else if (entity === 'Mapel') {
      const nama = v.nama_mapel;
      if (!nama) {
        errors.push('Kolom NAMA_MAPEL wajib diisi');
      } else {
        const key = 'mapel:' + nama.toLowerCase();
        if (seen[key]) {
          errors.push('Duplikat dalam tempelan dengan baris ' + seen[key]);
        } else if (filterByImportField_(existing.Mapel, 'nama_mapel', nama).length) {
          errors.push('Mapel "' + nama + '" sudah ada');
        } else {
          seen[key] = rawRow.line;
        }
        data.nama_mapel = nama;
      }

    } else if (entity === 'Guru') {
      const nip = v.nip;
      const nama = v.nama;
      if (!nip) errors.push('Kolom NIP wajib diisi');
      if (!nama) errors.push('Kolom NAMA wajib diisi');
      if (nip) {
        const key = 'nip:' + nip.toLowerCase();
        if (seen[key]) {
          errors.push('Duplikat dalam tempelan dengan baris ' + seen[key]);
        } else if (filterByImportField_(existing.Guru, 'nip', nip).length) {
          errors.push('Guru dengan NIP "' + nip + '" sudah ada');
        } else if (filterByImportField_(existing.Users, 'username', nip).length) {
          errors.push('Username "' + nip + '" sudah dipakai akun pengguna lain');
        } else {
          seen[key] = rawRow.line;
        }
      }
      data.nip = nip;
      data.nama = nama;

    } else if (entity === 'Siswa') {
      const nis = v.nis;
      const nama = v.nama;
      let idKelas = '';
      if (!nis) errors.push('Kolom NIS wajib diisi');
      if (!nama) errors.push('Kolom NAMA wajib diisi');
      if (nis) {
        const key = 'nis:' + nis.toLowerCase();
        if (seen[key]) {
          errors.push('Duplikat dalam tempelan dengan baris ' + seen[key]);
        } else if (filterByImportField_(existing.Siswa, 'nis', nis).length) {
          errors.push('Siswa dengan NIS "' + nis + '" sudah ada');
        } else if (filterByImportField_(existing.Users, 'username', nis).length) {
          errors.push('Username "' + nis + '" sudah dipakai akun pengguna lain');
        } else {
          seen[key] = rawRow.line;
        }
      }
      if (!v.nama_kelas) {
        errors.push('Kolom NAMA_KELAS wajib diisi');
      } else {
        const kelasMatch = filterByImportField_(existing.Kelas, 'nama_kelas', v.nama_kelas);
        if (!kelasMatch.length) errors.push('Kelas "' + v.nama_kelas + '" tidak ditemukan');
        else if (kelasMatch.length > 1) errors.push('Kelas "' + v.nama_kelas + '" ambigu (' + kelasMatch.length + ' data)');
        else idKelas = kelasMatch[0].id_kelas;
      }
      let kartu = v.kartu_kontrol;
      if (!kartu) kartu = 'Tidak';
      else if (kartu.toLowerCase() === 'ya') kartu = 'Ya';
      else if (kartu.toLowerCase() === 'tidak') kartu = 'Tidak';
      else errors.push('KARTU_KONTROL harus "Ya" atau "Tidak"');
      data.nis = nis;
      data.nama = nama;
      data.id_kelas = idKelas;
      data.kartu_kontrol = kartu;

    } else if (entity === 'Jadwal') {
      const tahun = v.tahun_ajaran;
      let semester = v.semester;
      const kelasNama = v.nama_kelas;
      const mapelNama = v.nama_mapel;
      const nipGuru = v.nip_guru;
      let hari = '';

      if (!tahunAjaranValid_(tahun)) errors.push('Tahun ajaran harus format "2026/2027"');
      if (!/^(ganjil|genap)$/i.test(semester)) {
        errors.push('Semester harus "Ganjil" atau "Genap"');
      } else {
        semester = semester.charAt(0).toUpperCase() + semester.slice(1).toLowerCase();
      }
      const hariRaw = String(v.hari || '').trim();
      if (!hariRaw) {
        errors.push('Kolom HARI wajib diisi');
      } else {
        const ix = HARI.map(function (h) { return h.toLowerCase(); }).indexOf(hariRaw.toLowerCase());
        if (ix === -1) errors.push('Hari harus salah satu dari: ' + HARI.join(', '));
        else hari = HARI[ix];
      }

      const mulai = normalizeJam_(v.jam_mulai);
      const selesai = normalizeJam_(v.jam_selesai);
      if (!mulai) errors.push('Format JAM_MULAI tidak valid (HH:mm)');
      if (!selesai) errors.push('Format JAM_SELESAI tidak valid (HH:mm)');
      if (mulai && selesai && jamKeMenit_(selesai) <= jamKeMenit_(mulai)) {
        errors.push('Jam selesai harus lebih besar dari jam mulai');
      }

      const semMatch = (tahun && semester) ? existing.Semester.filter(function (s) {
        return String(s.tahun_ajaran).trim() === tahun && importLower_(s.semester) === semester.toLowerCase();
      }) : [];
      if (!semMatch.length) errors.push('Semester ' + tahun + ' ' + semester + ' tidak ditemukan');
      else if (semMatch.length > 1) errors.push('Semester ' + tahun + ' ' + semester + ' ambigu (' + semMatch.length + ' data)');

      const kelasMatch = filterByImportField_(existing.Kelas, 'nama_kelas', kelasNama);
      if (!kelasNama) errors.push('Kolom NAMA_KELAS wajib diisi');
      else if (!kelasMatch.length) errors.push('Kelas "' + kelasNama + '" tidak ditemukan');
      else if (kelasMatch.length > 1) errors.push('Kelas "' + kelasNama + '" ambigu (' + kelasMatch.length + ' data)');

      const mapelMatch = filterByImportField_(existing.Mapel, 'nama_mapel', mapelNama);
      if (!mapelNama) errors.push('Kolom NAMA_MAPEL wajib diisi');
      else if (!mapelMatch.length) errors.push('Mapel "' + mapelNama + '" tidak ditemukan');
      else if (mapelMatch.length > 1) errors.push('Mapel "' + mapelNama + '" ambigu (' + mapelMatch.length + ' data)');

      const guruMatch = filterByImportField_(existing.Guru, 'nip', nipGuru);
      if (!nipGuru) errors.push('Kolom NIP_GURU wajib diisi');
      else if (!guruMatch.length) errors.push('Guru dengan NIP "' + nipGuru + '" tidak ditemukan');

      if (!errors.length && semMatch.length === 1 && kelasMatch.length === 1 &&
        mapelMatch.length === 1 && guruMatch.length === 1 && hari && mulai && selesai) {
        const candidate = {
          id_jadwal: '',
          id_semester: semMatch[0].id_semester,
          id_kelas: kelasMatch[0].id_kelas,
          nip_guru: guruMatch[0].nip,
          hari: hari,
          jam_mulai: mulai,
          jam_selesai: selesai
        };
        const rowsToCheck = existing.Jadwal.concat(acceptedJadwal);
        const identik = rowsToCheck.filter(function (j) {
          return String(j.id_semester) === String(candidate.id_semester) &&
            String(j.id_kelas) === String(candidate.id_kelas) &&
            String(j.id_mapel) === String(mapelMatch[0].id_mapel) &&
            String(j.nip_guru) === String(candidate.nip_guru) &&
            String(j.hari) === candidate.hari &&
            j.jam_mulai === mulai && j.jam_selesai === selesai;
        })[0];

        if (identik) {
          errors.push(identik._line ? 'Duplikat dalam tempelan dengan baris ' + identik._line : 'Jadwal identik sudah ada');
        } else {
          const bentrok = findJadwalBentrok_(candidate, rowsToCheck);
          if (bentrok) {
            errors.push('Jadwal bentrok dengan ' + namaById_(existing.Guru, 'nip', 'nama', bentrok.nip_guru) +
              ' di kelas ' + namaById_(existing.Kelas, 'id_kelas', 'nama_kelas', bentrok.id_kelas) +
              ' hari ' + bentrok.hari + ' jam ' + bentrok.jam_mulai + '-' + bentrok.jam_selesai);
          } else {
            acceptedJadwal.push(Object.assign({ _line: rawRow.line, id_mapel: mapelMatch[0].id_mapel }, candidate));
          }
        }

        data.id_semester = candidate.id_semester;
        data.id_kelas = candidate.id_kelas;
        data.id_mapel = mapelMatch[0].id_mapel;
        data.nip_guru = candidate.nip_guru;
        data.hari = hari;
        data.jam_mulai = mulai;
        data.jam_selesai = selesai;
      }
    }

    const status = errors.length ? 'error' : 'ok';
    result.rows.push({
      line: rawRow.line,
      status: status,
      errors: errors,
      values: v,
      data: data
    });
    result.summary.total++;
    if (status === 'ok') result.summary.valid++;
    else result.summary.invalid++;
  });

  return result;
}

/**
 * Membaca seluruh data yang dibutuhkan analisis (satu kali baca per sheet).
 */
function buildImportContext_() {
  function read(name) {
    return readSheetAsObjects_(name);
  }
  return {
    Kelas: read('Kelas').map(function (k) {
      return { id_kelas: String(k.id_kelas || '').trim(), nama_kelas: String(k.nama_kelas || '').trim() };
    }),
    Mapel: read('Mapel').map(function (m) {
      return { id_mapel: String(m.id_mapel || '').trim(), nama_mapel: String(m.nama_mapel || '').trim() };
    }),
    Guru: read('Guru').map(function (g) {
      return { nip: String(g.nip || '').trim(), nama: String(g.nama || '').trim() };
    }),
    Siswa: read('Siswa').map(function (s) {
      return { nis: String(s.nis || '').trim(), nama: String(s.nama || '').trim(), id_kelas: String(s.id_kelas || '').trim() };
    }),
    Semester: read('Semester').map(function (s) {
      return {
        id_semester: String(s.id_semester || '').trim(),
        tahun_ajaran: String(s.tahun_ajaran || '').trim(),
        semester: String(s.semester || '').trim(),
        status: String(s.status || '').trim()
      };
    }),
    Jadwal: read('Jadwal').map(function (j) {
      return {
        id_jadwal: String(j.id_jadwal || '').trim(),
        id_semester: String(j.id_semester || '').trim(),
        id_kelas: String(j.id_kelas || '').trim(),
        id_mapel: String(j.id_mapel || '').trim(),
        nip_guru: String(j.nip_guru || '').trim(),
        hari: String(j.hari || '').trim(),
        jam_mulai: jamText_(j.jam_mulai),
        jam_selesai: jamText_(j.jam_selesai)
      };
    }),
    Users: read('Users').map(function (u) {
      return {
        username: String(u.username || '').trim(),
        ref_id: String(u.ref_id || '').trim(),
        role: String(u.role || '').trim()
      };
    })
  };
}

/**
 * Pratinjau import (Admin): parse + validasi, TIDAK menulis apa pun.
 */
function previewImport(token, entity, text) {
  requireRole_(token, ['Admin']);
  const plan = analyzeImport_(entity, text, buildImportContext_());
  return {
    success: true,
    entity: entity,
    fatal: plan.fatal,
    headers: plan.headers,
    rows: plan.rows,
    summary: plan.summary
  };
}

/**
 * Template header + satu contoh baris (tidak menyentuh sheet).
 */
function getImportTemplate(token, entity) {
  requireRole_(token, ['Admin']);
  const spec = IMPORT_SPECS[entity];
  if (!spec) throw new Error('Jenis data import tidak valid: ' + entity);
  return { success: true, entity: entity, headers: spec.headers, sample: spec.sample };
}

/**
 * Simpan import (Admin): parse + validasi ulang dari teks mentah di bawah lock,
 * hanya baris valid yang ditulis dalam satu setValues batch (plus akun batch).
 */
function commitImport(token, entity, text) {
  requireRole_(token, ['Admin']);

  const spec = IMPORT_SPECS[entity];
  if (!spec) throw new Error('Jenis data import tidak valid: ' + entity);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const plan = analyzeImport_(entity, text, buildImportContext_());
    if (plan.fatal) throw new Error(plan.fatal);

    const valid = plan.rows.filter(function (r) { return r.status === 'ok'; });
    const rejected = plan.rows.length - valid.length;
    if (!valid.length) {
      return {
        success: true,
        entity: entity,
        saved: 0,
        rejected: rejected,
        message: 'Tidak ada baris valid untuk disimpan (' + rejected + ' baris ditolak).'
      };
    }

    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(spec.sheet);
    if (!sheet) throw new Error('Sheet ' + spec.sheet + ' tidak ditemukan');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const startRow = sheet.getLastRow() + 1;

    const values = valid.map(function (r) {
      const data = Object.assign({}, r.data);
      if (entity === 'Kelas') data.id_kelas = generateId_('KLS');
      else if (entity === 'Mapel') data.id_mapel = generateId_('MPL');
      else if (entity === 'Jadwal') data.id_jadwal = generateId_('JDW');
      return headers.map(function (h) {
        return data[h] !== undefined ? data[h] : '';
      });
    });

    // Akun Guru/Siswa disiapkan lebih dulu (hash bisa gagal) sebelum ada tulisan.
    let usersBatch = null;
    if (entity === 'Guru' || entity === 'Siswa') {
      const usersSheet = ss.getSheetByName('Users');
      if (!usersSheet) throw new Error('Sheet Users tidak ditemukan');
      const uHeaders = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
      const uStartRow = usersSheet.getLastRow() + 1;
      const userRows = valid.map(function (r) {
        const refId = entity === 'Guru' ? r.data.nip : r.data.nis;
        const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
        return {
          id_user: generateId_('USR'),
          username: refId,
          password_hash: hashPassword_(refId, salt),
          salt: salt,
          role: entity,
          ref_id: refId,
          wajib_ganti_password: true,
          aktif: true
        };
      }).map(function (u) {
        return uHeaders.map(function (h) {
          return u[h] !== undefined ? u[h] : '';
        });
      });
      usersBatch = { sheet: usersSheet, headers: uHeaders, startRow: uStartRow, rows: userRows };
    }

    // Format teks WAJIB dipasang pada rentang tujuan sebelum menulis,
    // agar semua kolom teks (NIP/NIS/nama/jam) tidak diubah Sheets saat baris ditambahkan.
    ensureSheetRows_(sheet, startRow + values.length - 1);
    applyTextFormats_(sheet, headers, startRow, values.length);
    sheet.getRange(startRow, 1, values.length, headers.length).setValues(values);

    if (usersBatch) {
      ensureSheetRows_(usersBatch.sheet, usersBatch.startRow + usersBatch.rows.length - 1);
      applyTextFormats_(usersBatch.sheet, usersBatch.headers, usersBatch.startRow, usersBatch.rows.length);
      usersBatch.sheet.getRange(usersBatch.startRow, 1, usersBatch.rows.length, usersBatch.headers.length)
        .setValues(usersBatch.rows);
    }

    return {
      success: true,
      entity: entity,
      saved: values.length,
      rejected: rejected,
      message: 'Import ' + entity + ' selesai: ' + values.length + ' baris disimpan, ' + rejected + ' baris ditolak.'
    };
  } finally {
    lock.releaseLock();
  }
}
