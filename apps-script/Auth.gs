/**
 * Aplikasi Presensi Sekolah - Auth.gs (Autentikasi, Sesi, Role Guard)
 * Zona Waktu: Asia/Makassar
 */

const SESSION_TTL_SECONDS = 21600; // 6 jam (maksimum CacheService Apps Script)
const LOCKOUT_TTL_SECONDS = 300;   // 5 menit penguncian setelah 5x gagal

/**
 * Helper mencari pengguna berdasarkan username (case-insensitive)
 * @param {string} username
 * @returns {Object|null}
 */
function findUserByUsername_(username) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  const headers = data[0];
  const uIdx = headers.indexOf('username');
  if (uIdx === -1) return null;

  const target = String(username).trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][uIdx]).trim().toLowerCase() === target) {
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
 * Autentikasi pengguna
 * @param {string} username
 * @param {string} password
 * @returns {Object} { token, user: { id_user, username, role, ref_id, wajib_ganti_password } }
 */
function login(username, password) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanUsername || !cleanPassword) {
    throw new Error('Username atau password salah');
  }

  const cache = CacheService.getScriptCache();
  const lockKey = 'lockout_' + cleanUsername;
  const failKey = 'fail_count_' + cleanUsername;

  // Cek apakah akun sedang terkunci karena 5x percobaan gagal
  if (cache.get(lockKey)) {
    throw new Error('Terlalu banyak percobaan gagal. Akun dikunci sementara selama 5 menit.');
  }

  function recordLoginFailure() {
    const currentFails = Number(cache.get(failKey) || 0) + 1;
    if (currentFails >= 5) {
      cache.put(lockKey, 'locked', LOCKOUT_TTL_SECONDS);
      cache.remove(failKey);
    } else {
      cache.put(failKey, String(currentFails), LOCKOUT_TTL_SECONDS);
    }
    throw new Error('Username atau password salah');
  }

  // Cari user di sheet Users secara batch
  const user = findUserByUsername_(cleanUsername);
  if (!user) {
    recordLoginFailure();
  }

  // Akun nonaktif ditolak dengan pesan generik
  const isAktif = user.aktif === true || String(user.aktif).toUpperCase() === 'TRUE';
  if (!isAktif) {
    recordLoginFailure();
  }

  // Verifikasi hash password + salt
  const inputHash = hashPassword_(cleanPassword, user.salt);
  if (inputHash !== user.password_hash) {
    recordLoginFailure();
  }

  // Login berhasil: reset counter kegagalan
  cache.remove(failKey);
  cache.remove(lockKey);

  // Buat token sesi acak (gabungan dua UUID untuk entropi tinggi)
  const token = Utilities.getUuid() + Utilities.getUuid();
  const isMustChange = user.wajib_ganti_password === true || String(user.wajib_ganti_password).toUpperCase() === 'TRUE';

  const sessionData = {
    id_user: user.id_user,
    username: user.username,
    role: user.role,
    ref_id: user.ref_id || '',
    wajib_ganti_password: isMustChange
  };

  // Simpan sesi di CacheService (6 jam)
  cache.put(token, JSON.stringify(sessionData), SESSION_TTL_SECONDS);

  // Kembalikan token dan profil publik (TANPA password_hash atau salt)
  return {
    token: token,
    user: sessionData
  };
}

/**
 * Logout pengguna: menghapus kunci token sesi dari cache
 * @param {string} token
 * @returns {Object} { success: true }
 */
function logout(token) {
  if (token) {
    CacheService.getScriptCache().remove(String(token));
  }
  return { success: true };
}

/**
 * Membaca data sesi pengguna aktif berdasarkan token
 * @param {string} token
 * @returns {Object} { id_user, username, role, ref_id, wajib_ganti_password }
 */
function whoAmI(token) {
  if (!token) {
    throw new Error('Sesi tidak valid atau telah berakhir');
  }

  const cache = CacheService.getScriptCache();
  const sessionStr = cache.get(String(token));
  if (!sessionStr) {
    throw new Error('Sesi tidak valid atau telah berakhir');
  }

  try {
    return JSON.parse(sessionStr);
  } catch (e) {
    throw new Error('Data sesi rusak');
  }
}

/**
 * Role guard server-side
 * Membaca role langsung dari sesi di server, bukan dari klien.
 * Menolak pemanggilan jika wajib_ganti_password = true.
 * @param {string} token
 * @param {string|Array<string>} roles
 * @returns {Object} data sesi pengguna
 */
function requireRole_(token, roles) {
  const session = whoAmI(token);

  if (session.wajib_ganti_password) {
    throw new Error('Wajib mengganti password sebelum mengakses fitur aplikasi.');
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  if (!allowedRoles.includes(session.role)) {
    throw new Error('Akses ditolak: role tidak memiliki izin');
  }

  return session;
}

/**
 * Mengganti password pengguna
 * @param {string} token
 * @param {string} lama
 * @param {string} baru
 * @returns {Object} { success: true, message: string }
 */
function changePassword(token, lama, baru) {
  const session = whoAmI(token);
  const cleanLama = String(lama || '');
  const cleanBaru = String(baru || '');

  // Validasi password baru
  if (!cleanBaru || cleanBaru.length < 8) {
    throw new Error('Password baru minimal 8 karakter');
  }

  const disallowed = [session.username, session.ref_id].filter(Boolean).map(s => String(s).toLowerCase());
  if (disallowed.includes(cleanBaru.toLowerCase())) {
    throw new Error('Password baru tidak boleh sama dengan username atau NIS/NIP');
  }

  if (cleanLama === cleanBaru) {
    throw new Error('Password baru tidak boleh sama dengan password lama');
  }

  // Verifikasi password lama dari sheet Users
  const user = findRowByKey_('Users', 'id_user', session.id_user);
  if (!user) {
    throw new Error('Pengguna tidak ditemukan');
  }

  const oldHash = hashPassword_(cleanLama, user.salt);
  if (oldHash !== user.password_hash) {
    throw new Error('Password lama salah');
  }

  // Buat salt dan hash baru
  const newSalt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  const newHash = hashPassword_(cleanBaru, newSalt);

  // Update sheet Users secara batch (satu setValues untuk baris tersebut)
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) throw new Error('Sheet Users tidak ditemukan');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const pIdx = headers.indexOf('password_hash');
  const sIdx = headers.indexOf('salt');
  const wIdx = headers.indexOf('wajib_ganti_password');

  if (pIdx === -1 || sIdx === -1 || wIdx === -1) {
    throw new Error('Struktur kolom sheet Users tidak lengkap');
  }

  const rowNum = user._rowNumber;
  const rowData = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  rowData[pIdx] = newHash;
  rowData[sIdx] = newSalt;
  rowData[wIdx] = false;
  sheet.getRange(rowNum, 1, 1, headers.length).setValues([rowData]);

  // Perbarui status wajib_ganti_password pada sesi di cache
  session.wajib_ganti_password = false;
  CacheService.getScriptCache().put(String(token), JSON.stringify(session), SESSION_TTL_SECONDS);

  return { success: true, message: 'Password berhasil diubah' };
}
