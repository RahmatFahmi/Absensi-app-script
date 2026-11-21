# Design System - Aplikasi Presensi Sekolah

## 1. Design Tokens (CSS Variables di Style.html)
- **Colors**:
  - Brand: `--primary: #1e40af`, `--primary-hover: #1d4ed8`, `--primary-subtle: #eff6ff`
  - Neutral: `--surface: #ffffff`, `--surface-alt: #f8fafc`, `--surface-border: #cbd5e1`, `--text-main: #0f172a`, `--text-muted: #475569`, `--text-inverse: #ffffff`
  - Status Presensi:
    - Hadir: `--color-hadir: #15803d`, `--bg-hadir: #dcfce7`
    - Izin: `--color-izin: #0369a1`, `--bg-izin: #e0f2fe`
    - Sakit: `--color-sakit: #b45309`, `--bg-sakit: #fef3c7`
    - Alpa: `--color-alpa: #b91c1c`, `--bg-alpa: #fee2e2`
  - Status Izin:
    - Menunggu bukti: `--color-wait-doc: #6b21a8`, `--bg-wait-doc: #f3e8ff`
    - Menunggu persetujuan: `--color-wait-appr: #854d0e`, `--bg-wait-appr: #fef9c3`
    - Disetujui: `--color-approved: #15803d`, `--bg-approved: #dcfce7`
    - Ditolak: `--color-rejected: #9f1239`, `--bg-rejected: #ffe4e6`
- **Typography**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...`)
  - Sizes: `--font-xs: 0.75rem`, `--font-sm: 0.875rem`, `--font-base: 1rem`, `--font-lg: 1.125rem`, `--font-xl: 1.25rem`, `--font-2xl: 1.5rem`
- **Spacing**: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`
- **Radius**: `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-full: 9999px`
- **Shadow**: `--shadow-sm: 0 1px 2px rgba(0,0,0,0.05)`, `--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.08)`, `--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08)`
- **Accessibility & Touch**: Min touch target `--min-target: 44px`, outline focus ring 2px.

## 2. Komponen Bersama
- **Button**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`, `.btn-success` (min-height 44px)
- **Form Controls**: `.form-control`, `.form-select`, `.form-check`, `.form-label`, `.form-help`
- **Status Selector**: `.status-group`, `.status-option` (target sentuh 44px per opsi presensi)
- **Badges**: `.badge`, `.badge-hadir`, `.badge-izin`, `.badge-sakit`, `.badge-alpa`, `.badge-wait-doc`, `.badge-wait-appr`, `.badge-approved`, `.badge-rejected` (kombinasi warna + teks + ikon SVG)
- **Tabel Responsif**: `.table-container` (scroll horizontal pada layar sempit) + `.table`
- **Kartu**: `.card`, `.card-header`, `.card-body`, `.card-footer`, `.metric-card`
- **Feedback & Overlay**: `.modal`, `.modal-backdrop`, `.toast`, `.empty-state`, `.loading-spinner`

## 3. Konvensi data-page & data-slot
- **data-page (10 Halaman)**:
  `login`, `dashboard-admin`, `dashboard-guru`, `dashboard-siswa`, `master-siswa`, `import-data`, `jadwal-guru`, `form-presensi`, `pengajuan-siswa`, `persetujuan-guru`, `rekap-presensi`
- **data-slot (Hook Dinamis Backend)**:
  - `data-slot="user-name"`, `data-slot="user-role"` (Identitas akun di topbar/sidebar)
  - `data-slot="metric-*"` (Statistik dashboard seperti total siswa, pengajuan tertunda)
  - `data-slot="table-body"` (Baris data tabel siswa, jadwal, izin, rekap)
  - `data-slot="preview-body"` (Pratinjau import data baris valid/error)
  - `data-slot="doc-preview"` (Kontainer pratinjau bukti surat sakit/izin)
  - `data-slot="alert-container"` (Wadah pesan kesalahan login atau aksi)

