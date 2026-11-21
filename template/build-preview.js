/**
 * build-preview.js
 * 
 * Menggabungkan Index.html + Style.html + Script.html menjadi satu file preview.html mandiri
 * untuk pengujian tampilan lokal di browser tanpa Google Apps Script server.
 */

const fs = require('fs');
const path = require('path');

function buildPreview() {
  // Tentukan direktori template
  const templateDir = fs.existsSync(path.join(__dirname, 'Index.html'))
    ? __dirname
    : path.join(__dirname, 'template');

  const indexPath = path.join(templateDir, 'Index.html');
  const outputPath = path.join(templateDir, 'preview.html');

  if (!fs.existsSync(indexPath)) {
    console.error(`Error: File Index.html tidak ditemukan di ${indexPath}`);
    process.exit(1);
  }

  let indexContent = fs.readFileSync(indexPath, 'utf8');

  // Regex untuk mencocokkan <?!= include('FileName'); ?> atau <?= include('FileName'); ?> atau <? include(...) ?>
  const includePattern = /<\?!?=?\s*include\(\s*['"]([^'"]+)['"]\s*\);?\s*\?>/g;

  let replacedCount = 0;
  const combinedContent = indexContent.replace(includePattern, (match, fileName) => {
    // Normalisasi ekstensi .html
    const targetFile = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
    const targetPath = path.join(templateDir, targetFile);

    if (fs.existsSync(targetPath)) {
      replacedCount++;
      console.log(`[Include] Menggabungkan ${targetFile} (${fs.statSync(targetPath).size} bytes)`);
      return fs.readFileSync(targetPath, 'utf8');
    } else {
      console.warn(`[Peringatan] File include tidak ditemukan: ${targetPath}`);
      return match;
    }
  });

  // Snippet Panel Demo Khusus Pratinjau Lokal (preview.html)
  // PERINGATAN: Panel ini HANYA untuk kebutuhan testing di browser lokal dan TIDAK BOLEH dibawa ke Apps Script / Index.html
  const demoPanelSnippet = `
  <!-- ==========================================================================
       PERINGATAN: PANEL DEMO KHUSUS PRATINJAU LOKAL (preview.html)
       --------------------------------------------------------------------------
       Panel ini HANYA untuk kebutuhan testing tampilan lokal di browser.
       Panel ini TIDAK ADA di Index.html dan TIDAK BOLEH dibawa ke Google Apps Script!
       Di Apps Script, role pengguna ditentukan oleh server dari sheet 'Users'.
       ========================================================================== -->
  <div id="demo-role-floating-wrapper" style="position: fixed; bottom: 20px; left: 20px; z-index: 99999; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <!-- Panel Pop-up Pengganti Role (Awalnya tersembunyi) -->
    <div id="demo-role-popup" style="display: none; width: 310px; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; margin-bottom: 10px; overflow: hidden;">
      <div style="background: #0f172a; color: #ffffff; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 8px; height: 8px; background: #22c55e; border-radius: 50%;"></span>
          <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.3px;">DEMO ROLE SWITCHER</span>
        </div>
        <button type="button" onclick="toggleDemoRolePanel(false)" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 18px; padding: 0 4px; line-height: 1;">&times;</button>
      </div>
      
      <div style="padding: 12px 14px;">
        <div style="font-size: 11px; line-height: 1.4; color: #92400e; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 8px; margin-bottom: 12px;">
          <strong>⚠️ Pratinjau Lokal Saja:</strong> Panel ini hanya ada di <code>preview.html</code> untuk menguji variasi menu tiap role. Jangan dibawa ke Apps Script.
        </div>

        <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          Pilih Tampilan Role:
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <button type="button" class="demo-role-option-btn" data-role="Guru" onclick="switchDemoRole('Guru')" style="display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; cursor: pointer; transition: all 0.15s ease;">
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #1e293b;">👨‍🏫 Guru</div>
              <div style="font-size: 11px; color: #64748b;">Pengajar Mapel & Presensi</div>
            </div>
            <span id="demo-check-Guru" class="demo-role-check" style="color: #2563eb; font-weight: bold; font-size: 14px;">✓</span>
          </button>

          <button type="button" class="demo-role-option-btn" data-role="Admin" onclick="switchDemoRole('Admin')" style="display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; cursor: pointer; transition: all 0.15s ease;">
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #1e293b;">🛡️ Admin</div>
              <div style="font-size: 11px; color: #64748b;">Master Data & Pengelola</div>
            </div>
            <span id="demo-check-Admin" class="demo-role-check" style="display: none; color: #2563eb; font-weight: bold; font-size: 14px;">✓</span>
          </button>

          <button type="button" class="demo-role-option-btn" data-role="Siswa" onclick="switchDemoRole('Siswa')" style="display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; cursor: pointer; transition: all 0.15s ease;">
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #1e293b;">🎓 Siswa</div>
              <div style="font-size: 11px; color: #64748b;">Peserta Didik & Pengajuan Izin</div>
            </div>
            <span id="demo-check-Siswa" class="demo-role-check" style="display: none; color: #2563eb; font-weight: bold; font-size: 14px;">✓</span>
          </button>
        </div>

        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
          <button type="button" onclick="navigateTo('login'); toggleDemoRolePanel(false);" style="background: transparent; border: none; color: #64748b; font-size: 12px; cursor: pointer; padding: 4px 0; text-decoration: underline;">
            Ke Halaman Login
          </button>
          <span style="font-size: 11px; color: #94a3b8;" id="demo-active-badge">Role: GURU</span>
        </div>
      </div>
    </div>

    <!-- Tombol Melayang Utama -->
    <button id="btn-toggle-demo-panel" type="button" onclick="toggleDemoRolePanel()" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; color: #0f172a; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; transition: all 0.2s ease;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m16 11 2 2 4-4" />
      </svg>
      <span>DEMO: ganti tampilan role</span>
      <span id="btn-demo-role-badge" style="background: #d97706; color: #ffffff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 9999px; text-transform: uppercase;">Guru</span>
    </button>
  </div>

  <script>
    // Logika panel demo (khusus preview.html lokal)
    function toggleDemoRolePanel(forceState) {
      const panel = document.getElementById('demo-role-popup');
      if (!panel) return;
      const isVisible = panel.style.display !== 'none';
      panel.style.display = (forceState !== undefined ? forceState : !isVisible) ? 'block' : 'none';
    }

    function switchDemoRole(role) {
      if (typeof setRolePreview === 'function') {
        setRolePreview(role);
      }
      if (typeof demoUsers !== 'undefined' && demoUsers[role]) {
        if (typeof navigateTo === 'function') {
          navigateTo(demoUsers[role].defaultPage);
        }
        if (typeof showToast === 'function') {
          showToast('Tampilan beralih ke role: ' + role, 'info');
        }
      }
      updateDemoPanelUI(role);
    }

    function updateDemoPanelUI(activeRole) {
      const roles = ['Guru', 'Admin', 'Siswa'];
      roles.forEach(r => {
        const check = document.getElementById('demo-check-' + r);
        if (check) check.style.display = (r === activeRole) ? 'inline' : 'none';
        const btn = document.querySelector('.demo-role-option-btn[data-role="' + r + '"]');
        if (btn) {
          if (r === activeRole) {
            btn.style.background = '#eff6ff';
            btn.style.borderColor = '#3b82f6';
          } else {
            btn.style.background = '#ffffff';
            btn.style.borderColor = '#e2e8f0';
          }
        }
      });
      const badge = document.getElementById('btn-demo-role-badge');
      if (badge) badge.textContent = activeRole;
      const activeBadge = document.getElementById('demo-active-badge');
      if (activeBadge) activeBadge.textContent = 'Role: ' + activeRole.toUpperCase();
    }

    // Inisialisasi status demo panel saat halaman siap
    window.addEventListener('DOMContentLoaded', () => {
      const currentRole = (typeof appState !== 'undefined' && appState.currentRole) ? appState.currentRole : 'Guru';
      updateDemoPanelUI(currentRole);
    });
  </script>
`;

  // Sisipkan panel demo sebelum tag penutup </body>
  const finalContent = combinedContent.replace('</body>', `${demoPanelSnippet}\n</body>`);

  fs.writeFileSync(outputPath, finalContent, 'utf8');
  console.log(`\n[Sukses] Berhasil membuat ${outputPath}`);
  console.log(`- Total baris/file include diproses: ${replacedCount}`);
  console.log(`- Ukuran berkas preview.html: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB\n`);
}

buildPreview();
