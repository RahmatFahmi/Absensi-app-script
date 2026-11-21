const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs'));
const prodFiles = files.filter(f => f !== 'Tests.gs');

// API platform (JS + Apps Script) yang sah dipanggil tanpa didefinisikan di proyek.
const PLATFORM = new Set([
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math', 'JSON', 'Set', 'Map',
  'RegExp', 'Error', 'isNaN', 'isFinite', 'parseInt', 'parseFloat',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'SpreadsheetApp', 'DriveApp', 'PropertiesService', 'CacheService', 'LockService',
  'Session', 'Logger', 'HtmlService', 'ScriptApp', 'UrlFetchApp', 'Utilities',
  'ContentService', 'MailApp', 'GmailApp'
]);
const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new',
  'throw', 'do', 'else', 'try', 'finally', 'delete', 'void', 'in', 'of', 'case',
  'break', 'continue', 'with', 'yield', 'await', 'async', 'class', 'super', 'this'
]);

// Buang komentar dan string agar kata di dalam teks tidak dianggap pemanggilan.
function stripNonCode(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else if (c === '"' || c === "'") {
      i++;
      while (i < n && src[i] !== c) i += src[i] === '\\' ? 2 : 1;
      i++;
    } else if (c === '`') {
      i++;
      while (i < n && src[i] !== '`') i += src[i] === '\\' ? 2 : 1;
      i++;
      out += ' "" ';
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function topLevelNames(src) {
  const names = new Set();
  const re = /^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm;
  let m;
  while ((m = re.exec(src)) !== null) names.add(m[1] || m[2]);
  return names;
}

// Semua nama yang didefinisikan di file: fungsi (termasuk bersarang), variabel, dan parameter.
function fileLocalNames(src) {
  const names = topLevelNames(src);
  let m;
  const fn = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = fn.exec(src)) !== null) names.add(m[1]);

  const decl = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = decl.exec(src)) !== null) names.add(m[1]);

  const params = [];
  const paramList = /function\s*[A-Za-z_$]*\s*\(([^)]*)\)/g;
  while ((m = paramList.exec(src)) !== null) params.push(m[1]);
  const arrowArgs = /\(([^)]*)\)\s*=>/g;
  while ((m = arrowArgs.exec(src)) !== null) params.push(m[1]);
  const arrowOne = /([A-Za-z_$][\w$]*)\s*=>/g;
  while ((m = arrowOne.exec(src)) !== null) params.push(m[1]);

  for (const list of params) {
    const re = /[A-Za-z_$][\w$]*/g;
    let p;
    while ((p = re.exec(list)) !== null) {
      if (!KEYWORDS.has(p[0])) names.add(p[0]);
    }
  }
  return names;
}

function calledNames(code) {
  const names = new Set();
  const re = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) names.add(m[1]);
  return names;
}

function tokens(code) {
  return new Set(code.match(/[A-Za-z_$][\w$]*/g) || []);
}

// Unit test kecil: pastikan pemeriksa benar-benar menangkap ketergantungan ke Tests.gs.
function checkDependencies(sources) {
  const prod = Object.keys(sources).filter(f => f !== 'Tests.gs');
  const declaredProd = new Set();
  const declaredTests = new Set();
  const codes = {};
  for (const f of Object.keys(sources)) {
    // Aturan Tests.gs hanya untuk nama global level atas, bukan variabel lokal di dalam tes.
    if (f === 'Tests.gs') topLevelNames(sources[f]).forEach(n => declaredTests.add(n));
    else fileLocalNames(sources[f]).forEach(n => declaredProd.add(n));
    codes[f] = stripNonCode(sources[f]);
  }

  const errors = [];
  for (const f of prod) {
    for (const name of calledNames(codes[f])) {
      if (KEYWORDS.has(name) || PLATFORM.has(name) || declaredProd.has(name)) continue;
      if (declaredTests.has(name)) {
        errors.push(`${f} memanggil ${name}() yang hanya didefinisikan di Tests.gs`);
      } else {
        errors.push(`${f} memanggil ${name}() yang tidak terdefinisi`);
      }
    }
    for (const name of tokens(codes[f])) {
      if (declaredTests.has(name) && !declaredProd.has(name)) {
        errors.push(`${f} memakai konstanta/global ${name} yang hanya ada di Tests.gs`);
      }
    }
  }
  return errors;
}

// 1. Mekanisme terbukti bisa gagal bila dependensi hanya ada di Tests.gs.
const fixture = {
  'Prod.gs': 'function pakai() { return bantu_() + TABEL; }',
  'Tests.gs': 'function bantu_() { return 1; }\nconst TABEL = {};'
};
const fixtureErrors = checkDependencies(fixture);
assert.ok(
  fixtureErrors.some(e => e.includes('bantu_')) && fixtureErrors.some(e => e.includes('TABEL')),
  'Pemeriksa harus mendeteksi pemanggilan dan konstanta yang hanya ada di Tests.gs'
);

// 2. File produksi nyata (semua .gs kecuali Tests.gs) harus mandiri.
const sources = {};
for (const f of files) sources[f] = fs.readFileSync(path.join(dir, f), 'utf8');

const errors = checkDependencies(sources);
assert.deepStrictEqual(errors, [], 'Dependensi produksi tidak boleh bergantung pada Tests.gs:\n' + errors.join('\n'));

console.log(`[OK] ${prodFiles.length} file produksi mandiri: semua fungsi/konstanta global terdefinisi tanpa Tests.gs`);
console.log(`[OK] Pemeriksa terbukti gagal saat dependensi hanya ada di Tests.gs (kasus uji sintetis)`);
