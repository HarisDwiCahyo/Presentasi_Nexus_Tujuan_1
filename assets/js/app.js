/* ==========================================================================
   App, navigasi halaman, grafik (Chart.js), peta (Leaflet), tabel interaktif.
   Semua angka dibaca dari assets/js/data.js (GRID, SECTOR_TABLE, dst.)
   ========================================================================== */

/* ----------------------------- util ----------------------------- */
const fmtN = n => (n == null ? '–' : Math.round(n).toLocaleString('id-ID'));
const fmt1 = n => (n == null ? '–' : n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const fmt2 = n => (n == null ? '–' : n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
function fmtRp(n) {
  if (n == null) return '–';
  if (n >= 1e9) return 'Rp' + fmt1(n / 1e9) + ' T';      // data dalam ribu rupiah
  if (n >= 1e6) return 'Rp' + fmt1(n / 1e6) + ' M';
  return 'Rp' + fmtN(n);
}
const el = id => document.getElementById(id);
const CHART_FONT = { family: "'Public Sans', sans-serif", size: 11 };
const PALETTE = ['#36415A', '#6B8A6C', '#B7D894', '#D0ECB4', '#8FAE71', '#4F6E52'];

function catOf(score) {
  for (const c of CATEGORIES) if (score >= c.min) return c;
  return CATEGORIES[CATEGORIES.length - 1];
}
/* workbook menulis sebagian kota sebagai "Kota Kota Mojokerto", dirapikan di sini */
const cleanKab = s => s.replace(/^Kota Kota /, 'Kota ');
const shortKab = s => cleanKab(s).replace(/^Kabupaten /, 'Kab. ');

/* ------------------------- navigasi halaman ------------------------- */
let pages = [], cur = 0;

function buildToc() {
  const box = el('tocList');
  let lastGroup = null;
  pages.forEach((p, i) => {
    const group = p.dataset.group || '';
    if (group && group !== lastGroup) {
      const g = document.createElement('div');
      g.className = 'toc-group';
      g.textContent = group;
      box.appendChild(g);
      lastGroup = group;
    }
    const b = document.createElement('button');
    b.className = 'toc-link';
    b.dataset.idx = i;
    b.innerHTML = `<span class="toc-num">${String(i + 1).padStart(2, '0')}</span><span>${p.dataset.title || 'Halaman'}</span>`;
    b.addEventListener('click', () => { goTo(i); bootstrap.Offcanvas.getOrCreateInstance(el('tocPanel')).hide(); });
    box.appendChild(b);
  });
}

function goTo(i) {
  cur = Math.max(0, Math.min(pages.length - 1, i));
  pages.forEach((p, j) => {
    const on = j === cur;
    p.classList.toggle('active', on);
    if (on) p.scrollTop = 0;
  });
  el('pageCounter').textContent = `${cur + 1} / ${pages.length}`;
  el('progressTop').style.width = ((cur + 1) / pages.length * 100) + '%';
  try { history.replaceState(null, '', '#p=' + (cur + 1)); } catch (e) { /* file:// tanpa history */ }
  document.querySelectorAll('.toc-link').forEach(b => b.classList.toggle('active', +b.dataset.idx === cur));
  el('crumb').textContent = pages[cur].dataset.title || '';
  // komponen yang butuh ukuran nyata saat tampil
  if (pages[cur].querySelector('#map') && window._map) setTimeout(() => window._map.invalidateSize(), 60);
}
const nextPage = () => goTo(cur + 1);
const prevPage = () => goTo(cur - 1);

function initNav() {
  pages = Array.from(document.querySelectorAll('.deck-page'));
  buildToc();
  el('btnNext').addEventListener('click', nextPage);
  el('btnPrev').addEventListener('click', prevPage);
  document.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => goTo(+b.dataset.jump)));
  document.addEventListener('keydown', e => {
    const t = (document.activeElement && document.activeElement.tagName) || '';
    if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); nextPage(); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevPage(); }
  });
  let tx = null;
  document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 80) dx < 0 ? nextPage() : prevPage();
    tx = null;
  }, { passive: true });
  const m = /[#&]p=(\d+)/.exec(location.hash || '');
  goTo(m ? Math.max(0, +m[1] - 1) : 0);
  window.addEventListener('hashchange', () => {
    const h = /[#&]p=(\d+)/.exec(location.hash || '');
    if (h) goTo(Math.max(0, +h[1] - 1));
  });
}

/* --------------------------- tabel statis --------------------------- */
function tbl(ids, head, rows, opts = {}) {
  (Array.isArray(ids) ? ids : [ids]).forEach(id => tblOne(id, head, rows, opts));
}
function tblOne(id, head, rows, opts = {}) {
  const t = el(id);
  if (!t) return;
  t.innerHTML =
    '<thead><tr>' + head.map(h => `<th${h.num ? ' class="text-end"' : ''}>${h.t}</th>`).join('') + '</tr></thead>' +
    '<tbody>' + rows.map(r => {
      const cls = r._cls ? ` class="${r._cls}"` : '';
      return `<tr${cls}>` + r.c.map((c, i) => `<td class="${head[i] && head[i].num ? 'text-end mono-num' : ''}">${c}</td>`).join('') + '</tr>';
    }).join('') + '</tbody>';
  if (opts.after) opts.after(t);
}

function renderStaticTables() {
  /* Sumber data primer */
  tbl('tblSources',
    [{ t: 'No' }, { t: 'Elemen data' }, { t: 'Dokumen / sumber' }, { t: 'Bagian yang dipakai' }, { t: 'Tahap' }],
    SOURCES.map(s => ({ c: [s.n, `<strong>${s.elemen}</strong>`, s.dok, `<span class="small-2">${s.bag}</span>`, `<span class="badge badge-soft">${s.tahap}</span>`] })));

  /* Cakupan sektor */
  tbl('tblScope',
    [{ t: 'Sektor sasaran' }, { t: 'KBLI' }, { t: 'Jalur data emisi' }, { t: 'Catatan pemisahan' }],
    [
      { c: ['Makanan', '10', 'BPS', 'Digabung dengan Minuman pada tampilan grid'] },
      { c: ['Minuman', '11', 'BPS', 'Intensitas per tenaga kerja dihitung terpisah'] },
      { c: ['Tekstil', '13', 'BPS', 'Termasuk pakaian jadi pada padanan PDRB'] },
      { c: ['Kimia', '20', 'BPS + EDGAR', 'Dipisahkan dari Pupuk memakai rasio intensitas'] },
      { c: ['Pupuk', '20', 'BPS + EDGAR', 'Tidak terpisah di statistik BPS, dipisah lewat proxy'] },
      { c: ['Besi &amp; Baja', '24', 'BPS', 'Statistik BPS masih agregat logam dasar ferro + non-ferro'] }
    ]);

  /* Unit analisis */
  tbl('tblUnit',
    [{ t: 'Tingkat' }, { t: 'Satuan' }, { t: 'Peran dalam analisis' }],
    [
      { c: ['<strong>Perusahaan</strong>', 'Titik koordinat lintang & bujur', 'Pembawa bobot tenaga kerja, alat penyebaran angka provinsi'] },
      { c: ['<strong>Sel grid</strong>', 'Kotak 0,1° (±11 km)', 'Unit penyimpanan hasil, mengikuti geometri raster EDGAR'] },
      { c: ['<strong>Kabupaten & kota</strong>', 'Batas Administrasi Kabupaten Jawa Timur', 'Unit penyajian akhir dan pengambilan keputusan intervensi'] }
    ]);

  /* Dua jalur data */
  tbl('tblTwoPaths',
    [{ t: '' }, { t: 'Jalur BPS' }, { t: 'Jalur EDGAR' }],
    [
      { c: ['<strong>Sifat data</strong>', 'Statistik perusahaan, agregat provinsi, tanpa dimensi ruang', 'Raster global, sudah berdimensi ruang, tanpa identitas perusahaan'] },
      { c: ['<strong>Sektor pemakai</strong>', 'Makanan, Minuman, Tekstil, Besi & Baja, serta Kimia–Pupuk', 'Kimia dan Pupuk'] },
      { c: ['<strong>Peran utama</strong>', 'Sumber nilai emisi Scope 1 dan Scope 2', 'Geometri sel grid untuk semua sektor + nilai emisi Scope 1 Kimia'] },
      { c: ['<strong>Kelemahan yang ditangani</strong>', 'Tak tahu lokasi → titik perusahaan + proxy tenaga kerja', 'Tak memisahkan Pupuk–Kimia → rasio intensitas emisi'] }
    ]);

  /* Faktor emisi */
  tbl('tblFuelFactors',
    [{ t: 'Bahan bakar (BPS)' }, { t: 'Padanan GHG Protocol' }, { t: 'Satuan' }, { t: 'CO₂', num: 1 }, { t: 'CH₄', num: 1 }, { t: 'N₂O', num: 1 }, { t: 'kg CO₂e / satuan', num: 1 }],
    FUEL_FACTORS.map(f => ({ c: [`<strong>${f.bb}</strong>`, f.padanan, f.sat, fmt2(f.co2), f.ch4.toFixed(5), f.n2o.toExponential(1), `<strong>${fmt2(f.co2e)}</strong>`] })));

  /* Kuantitas bahan bakar */
  const fuelNames = FUEL_FACTORS.map(f => f.bb);
  const unitShort = s => ({ 'Liter': 'L', 'Kg': 'kg', 'M3': 'm³' }[s] || s);
  tbl('tblFuelQty',
    [{ t: 'Sektor' }].concat(FUEL_FACTORS.map(f => ({ t: `${f.bb} (${unitShort(f.sat)})`, num: 1 }))),
    FUEL_QTY.map(r => ({ c: [`<strong>${r.sektor}</strong>`].concat(r.v.map(fmtN)) })));

  /* Emisi per bahan bakar */
  tbl('tblFuelEmis',
    [{ t: 'Sektor' }].concat(fuelNames.map(n => ({ t: n, num: 1 }))).concat([{ t: 'TOTAL', num: 1 }]),
    FUEL_EMIS.map(r => ({ c: [`<strong>${r.sektor}</strong>`].concat(r.v.map(fmtN)).concat([`<strong>${fmtN(r.total)}</strong>`]) }))
      .concat([{ _cls: 'row-top1', c: ['TOTAL 5 SEKTOR'].concat(FUEL_EMIS_TOTAL.map(fmtN)).concat([fmtN(8276936)]) }]));

  /* Scope 2 rinci */
  tbl('tblListrik',
    [{ t: 'Sektor' }, { t: 'Tabel 4.2 (nilai BB)', num: 1 }, { t: 'Tabel 4.3 (BB+listrik+gas)', num: 1 }, { t: 'Listrik bersih (000 Rp)', num: 1 }, { t: 'kWh', num: 1 }, { t: 'GWh', num: 1 }, { t: 'Scope 2 (t CO₂e)', num: 1 }],
    LISTRIK_S2.map(r => ({ c: [`<strong>${r.sektor}</strong>`, fmtN(r.tabel42), fmtN(r.tabel43), fmtN(r.listrik), fmtN(r.kwh), fmt1(r.gwh), `<strong>${fmtN(r.s2)}</strong>`] }))
      .concat([{
        _cls: 'row-top1', c: ['TOTAL 5 SEKTOR', fmtN(LISTRIK_S2.reduce((s, r) => s + r.tabel42, 0)), fmtN(LISTRIK_S2.reduce((s, r) => s + r.tabel43, 0)),
          fmtN(7429827041), fmtN(6663522010), fmt1(6663.5), fmtN(5330818)]
      }]));

  /* Parameter */
  tbl('tblParams',
    [{ t: 'Parameter' }, { t: 'Nilai' }, { t: 'Sumber' }],
    PARAMS.map(p => ({ c: [`<strong>${p.p}</strong>`, p.v, `<span class="small-2">${p.s}</span>`] })));

  /* Proyeksi 2016 -> 2025 */
  const tot = SECTOR_TABLE.reduce((a, s) => ({
    s1_2016: a.s1_2016 + s.s1_2016, s2_2016: a.s2_2016 + s.s2_2016, total_2016: a.total_2016 + s.total_2016,
    s1_2025: a.s1_2025 + s.s1_2025, s2_2025: a.s2_2025 + s.s2_2025, total_2025: a.total_2025 + s.total_2025
  }), { s1_2016: 0, s2_2016: 0, total_2016: 0, s1_2025: 0, s2_2025: 0, total_2025: 0 });
  tbl('tblProjection',
    [{ t: 'Sektor' }, { t: 'KBLI' }, { t: 'S1 2016', num: 1 }, { t: 'S2 2016', num: 1 }, { t: 'Total 2016', num: 1 },
    { t: 'Faktor PDRB', num: 1 }, { t: 'S1 2025', num: 1 }, { t: 'S2 2025', num: 1 }, { t: 'Total 2025', num: 1 }, { t: 'Tumbuh', num: 1 }],
    SECTOR_TABLE.map(s => ({
      c: [`<strong>${s.sektor}</strong>`, s.kbli, fmtN(s.s1_2016), fmtN(s.s2_2016), `<strong>${fmtN(s.total_2016)}</strong>`,
        fmt2(s.faktor), fmtN(s.s1_2025), fmtN(s.s2_2025), `<strong>${fmtN(s.total_2025)}</strong>`,
        '+' + Math.round((s.total_2025 / s.total_2016 - 1) * 100) + '%']
    })).concat([{
      _cls: 'row-top1', c: ['TOTAL 5 SEKTOR', '–', fmtN(tot.s1_2016), fmtN(tot.s2_2016), fmtN(tot.total_2016), '–',
        fmtN(tot.s1_2025), fmtN(tot.s2_2025), fmtN(tot.total_2025), '+' + Math.round((tot.total_2025 / tot.total_2016 - 1) * 100) + '%']
    }]));

  /* Perusahaan per sektor */
  tbl('tblCompany',
    [{ t: 'Sektor' }, { t: 'Jumlah perusahaan', num: 1 }, { t: 'Pangsa', num: 1 }],
    (() => {
      const t = COMPANY_COUNT.reduce((s, r) => s + r.n, 0);
      return COMPANY_COUNT.map(r => ({ c: [`<strong>${r.sektor}</strong>`, fmtN(r.n), fmt1(r.n / t * 100) + '%'] }))
        .concat([{ _cls: 'row-top1', c: ['TOTAL', fmtN(t), '100,0%'] }]);
    })());

  /* Kondisi tenaga kerja */
  tbl('tblTkCondition',
    [{ t: 'Kondisi awal' }, { t: 'Contoh' }, { t: 'Perlakuan' }, { t: 'Label jejak' }],
    [
      { c: ['<strong>Angka pasti</strong>', '250 atau 34', 'Dipakai apa adanya', 'observasi · keyakinan tinggi'] },
      { c: ['<strong>Rentang</strong>', '“20–99 orang”, “≥100 orang”', 'Median donor pada rentang & sektor sama', 'rentang_median · keyakinan sedang'] },
      { c: ['<strong>Kosong</strong>', 'tidak ada data', 'Median kelompok sektor × badan usaha', 'imputasi · keyakinan sedang'] }
    ]);

  /* Median TK */
  tbl('tblTkMedRentang',
    [{ t: 'Sektor' }, { t: 'Median 20–99 (org)', num: 1 }, { t: 'Median ≥100 (org)', num: 1 }],
    TK_MED_RENTANG.map(r => ({ c: [`<strong>${r.sektor}</strong>`, r.r20_99, r.r100] })));
  tbl('tblTkMedBadan',
    [{ t: 'Sektor' }, { t: 'Tbk (org)', num: 1 }, { t: 'PT (org)', num: 1 }, { t: 'CV (org)', num: 1 }, { t: 'UD (org)', num: 1 }, { t: 'Lain (org)', num: 1 }],
    TK_MED_BADAN.map(r => ({ c: [`<strong>${r.sektor}</strong>`, r.tbk, r.pt, r.cv, r.ud, r.lain] })));

  /* Jumlah sel + normalisasi (tampil di dua halaman) */
  tbl(['tblNormMax', 'tblNormMax2'],
    [{ t: 'Sektor' }, { t: 'KBLI' }, { t: 'Jml sel', num: 1 }, { t: 'Maks emisi (t CO₂e)', num: 1 }, { t: 'Maks ekonomi (×10³ Rp)', num: 1 }, { t: 'Maks TK (org)', num: 1 }],
    NORM_MAX.map(r => ({ c: [`<strong>${r.sektor}</strong>`, r.kbli, r.sel, fmtN(r.maksEmisi), fmtN(r.maksEko), fmtN(r.maksTk)] }))
      .concat([{ _cls: 'row-top1', c: ['TOTAL', '–', NORM_MAX.reduce((s, r) => s + r.sel, 0), '–', '–', '–'] }]));

  /* Intensitas per TK */
  tbl('tblTkAlloc',
    [{ t: 'Subsektor' }, { t: 'ΣTK (org)', num: 1 }, { t: 'Scope 1 / TK (t)', num: 1 }, { t: 'Scope 2 / TK (t)', num: 1 }, { t: 'Nilai tambah 2025', num: 1 }],
    TK_ALLOC.map(r => ({ c: [`<strong>${r.sub}</strong>`, fmtN(r.tk), r.s1PerTk == null ? '–' : fmt2(r.s1PerTk), r.s2PerTk == null ? '–' : fmt2(r.s2PerTk), fmtRp(r.nt2025)] }))
      .concat([{ _cls: 'row-top1', c: ['TOTAL', fmtN(TK_ALLOC.reduce((s, r) => s + r.tk, 0)), '–', '–', '–'] }]));

  /* Kategori prioritas + jumlah nyata */
  const counts = {};
  GRID.forEach(g => { const c = catOf(g.score).nama; counts[c] = (counts[c] || 0) + 1; });
  tbl('tblCategories',
    [{ t: 'Ambang skor' }, { t: 'Kategori' }, { t: 'Makna' }, { t: 'Jumlah kotak nyata', num: 1 }, { t: 'Pangsa', num: 1 }],
    CATEGORIES.map((c, i) => ({
      c: [`<span class="dot-cat" style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${c.warna};margin-right:6px"></span>` +
        (i === CATEGORIES.length - 1 ? '&lt; 0,2' : '≥ ' + fmt1(c.min)),
      `<strong>${c.nama}</strong>`, c.makna, fmtN(counts[c.nama] || 0), fmt1((counts[c.nama] || 0) / GRID.length * 100) + '%']
    })));

  /* Asumsi */
  tbl('tblAssumptions',
    [{ t: 'Asumsi' }, { t: 'Tahap' }, { t: 'Arah pengaruh' }, { t: 'Penanganan / catatan' }],
    ASSUMPTIONS.map(a => ({ c: [`<strong>${a.a}</strong>`, `<span class="badge badge-soft">${a.t}</span>`, a.arah, `<span class="small-2">${a.p}</span>`] })));
}

/* ------------------------------ grafik ------------------------------ */
function baseOpts(extra = {}) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { font: CHART_FONT, boxWidth: 12, color: '#36415A' } },
      tooltip: { bodyFont: CHART_FONT, titleFont: CHART_FONT }
    },
    scales: {
      x: { ticks: { font: CHART_FONT, color: '#6F7D66' }, grid: { color: '#EDF2E6' } },
      y: { ticks: { font: CHART_FONT, color: '#6F7D66' }, grid: { color: '#EDF2E6' } }
    }
  }, extra);
}

function renderCharts() {
  /* Scope 1 vs Scope 2 2016 per sektor */
  new Chart(el('chartScope2016'), {
    type: 'bar',
    data: {
      labels: SECTOR_TABLE.map(s => s.sektor),
      datasets: [
        { label: 'Scope 1 (bahan bakar)', data: SECTOR_TABLE.map(s => s.s1_2016), backgroundColor: '#36415A' },
        { label: 'Scope 2 (listrik)', data: SECTOR_TABLE.map(s => s.s2_2016), backgroundColor: '#B7D894' }
      ]
    },
    options: baseOpts({ plugins: { legend: { labels: { font: CHART_FONT } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmtN(c.parsed.y) + ' t CO₂e' } } } })
  });

  /* Emisi per jenis bahan bakar (total 5 sektor) */
  new Chart(el('chartFuel'), {
    type: 'bar',
    data: {
      labels: FUEL_FACTORS.map(f => f.bb),
      datasets: [{ label: 'Emisi Scope 1 2016 (t CO₂e)', data: FUEL_EMIS_TOTAL, backgroundColor: '#6B8A6C' }]
    },
    options: baseOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtN(c.parsed.x) + ' t CO₂e' } } }
    })
  });

  /* 2016 vs 2025 per sektor (dipakai di dua halaman) */
  ['chartProjection', 'chartProjection2'].forEach(id => {
    const cv = el(id); if (!cv) return;
    new Chart(cv, {
      type: 'bar',
      data: {
        labels: SECTOR_TABLE.map(s => s.sektor),
        datasets: [
          { label: 'Total 2016', data: SECTOR_TABLE.map(s => s.total_2016), backgroundColor: '#8FAE71' },
          { label: 'Perkiraan 2025', data: SECTOR_TABLE.map(s => s.total_2025), backgroundColor: '#36415A' }
        ]
      },
      options: baseOpts({ plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmtN(c.parsed.y) + ' t CO₂e' } } } })
    });
  });

  /* Jumlah perusahaan per sektor */
  new Chart(el('chartCompany'), {
    type: 'bar',
    data: { labels: COMPANY_COUNT.map(c => c.sektor), datasets: [{ data: COMPANY_COUNT.map(c => c.n), backgroundColor: PALETTE }] },
    options: baseOpts({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtN(c.parsed.y) + ' perusahaan' } } } })
  });

  /* Jumlah sel grid per sektor */
  new Chart(el('chartCells'), {
    type: 'doughnut',
    data: { labels: NORM_MAX.map(n => n.sektor), datasets: [{ data: NORM_MAX.map(n => n.sel), backgroundColor: PALETTE }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: CHART_FONT, boxWidth: 12 } }, tooltip: { callbacks: { label: c => c.label + ': ' + c.parsed + ' kotak' } } }
    }
  });

  /* Distribusi kategori */
  const counts = CATEGORIES.map(c => GRID.filter(g => catOf(g.score).nama === c.nama).length);
  new Chart(el('chartCategory'), {
    type: 'bar',
    data: { labels: CATEGORIES.map(c => c.nama), datasets: [{ data: counts, backgroundColor: CATEGORIES.map(c => c.warna), borderColor: '#DEE8D2', borderWidth: 1 }] },
    options: baseOpts({
      indexAxis: 'y',
      scales: { x: { type: 'logarithmic', ticks: { font: CHART_FONT, color: '#6F7D66' }, grid: { color: '#EDF2E6' } }, y: { ticks: { font: CHART_FONT, color: '#6F7D66' }, grid: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtN(c.parsed.x) + ' kotak (' + fmt1(c.parsed.x / GRID.length * 100) + '%)' } } }
    })
  });

  /* Pangsa emisi 2025 */
  new Chart(el('chartShare'), {
    type: 'doughnut',
    data: { labels: SECTOR_TABLE.map(s => s.sektor), datasets: [{ data: SECTOR_TABLE.map(s => s.total_2025), backgroundColor: PALETTE }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '52%',
      plugins: {
        legend: { position: 'right', labels: { font: CHART_FONT, boxWidth: 12 } },
        tooltip: { callbacks: { label: c => c.label + ': ' + fmtN(c.parsed) + ' t CO₂e' } }
      }
    }
  });

  /* Top 12 kabupaten */
  const kab = kabRollup().sort((a, b) => b.emisi - a.emisi).slice(0, 12);
  new Chart(el('chartKab'), {
    type: 'bar',
    data: {
      labels: kab.map(k => shortKab(k.kab)),
      datasets: [{ label: 'Emisi (t CO₂e)', data: kab.map(k => k.emisi), backgroundColor: '#36415A' }]
    },
    options: baseOpts({ indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtN(c.parsed.x) + ' t CO₂e' } } } })
  });

  /* Histogram sebaran skor seluruh 857 kotak */
  const bins = Array.from({ length: 20 }, () => 0);
  GRID.forEach(g => { bins[Math.min(19, Math.floor(g.score * 20))]++; });
  new Chart(el('chartScoreHist'), {
    type: 'bar',
    data: {
      labels: bins.map((_, i) => fmt2(i / 20)),
      datasets: [{
        data: bins,
        backgroundColor: bins.map((_, i) => catOf((i + 0.5) / 20).warna),
        borderColor: '#DEE8D2', borderWidth: 1
      }]
    },
    options: baseOpts({
      scales: {
        x: { title: { display: true, text: 'Skor prioritas (lebar bin 0,05)', font: CHART_FONT, color: '#36415A' }, ticks: { font: CHART_FONT, color: '#6F7D66', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
        y: { type: 'logarithmic', title: { display: true, text: 'Jumlah kotak (log)', font: CHART_FONT, color: '#36415A' }, ticks: { font: CHART_FONT, color: '#6F7D66' }, grid: { color: '#EDF2E6' } }
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: c => 'Skor ' + c[0].label + '–' + fmt2(+c[0].label.replace(',', '.') + 0.05), label: c => fmtN(c.parsed.y) + ' kotak' } } }
    })
  });
}

/* ------------------------------- peta ------------------------------- */
function renderMap() {
  const map = L.map('map', { scrollWheelZoom: true }).setView([-7.6, 112.6], 8);
  window._map = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 13, attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const layers = {};
  Object.keys(SECTOR_COLOR).forEach(s => { layers[s] = L.layerGroup().addTo(map); });

  const maxE = Math.max(...GRID.map(g => g.emisi));
  GRID.forEach(g => {
    const r = 4 + 20 * Math.sqrt(g.emisi / maxE);
    const c = catOf(g.score);
    const m = L.circleMarker([g.lat, g.lon], {
      radius: r, color: SECTOR_COLOR[g.sec] || '#888', weight: 1.2,
      fillColor: SECTOR_COLOR[g.sec] || '#888', fillOpacity: .55
    });
    m.bindPopup(
      `<strong>${g.sec} · Grid ${g.rank}</strong><br>${g.kab}<br>` +
      `<span style="color:#6F7D66">Lat ${g.lat}, Lon ${g.lon}</span><br>` +
      `Emisi: <strong>${fmtN(g.emisi)}</strong> t CO₂e<br>` +
      `&nbsp;&nbsp;S1 ${fmtN(g.s1)} · S2 ${fmtN(g.s2)}<br>` +
      `Nilai tambah: ${fmtRp(g.eko)}<br>Tenaga kerja: ${fmtN(g.tk)} org<br>` +
      `Skor: <strong>${fmt2(g.score)}</strong> (${c.nama})`
    );
    m.addTo(layers[g.sec] || map);
  });

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const d = L.DomUtil.create('div', 'map-legend');
    d.innerHTML = '<strong>Sektor</strong><br>' + Object.keys(SECTOR_COLOR)
      .map(s => `<span class="dot" style="background:${SECTOR_COLOR[s]}"></span>${s}`).join('<br>') +
      '<hr class="my-1"><span class="text-muted-2">Besar bulatan = emisi kotak</span>';
    return d;
  };
  legend.addTo(map);

  L.control.layers(null, layers, { collapsed: false, position: 'topright' }).addTo(map);
}

/* --------------------- tabel kabupaten (hitung live) --------------------- */
function kabRollup() {
  const m = {};
  GRID.forEach(g => {
    (m[g.kab] = m[g.kab] || { kab: g.kab, emisi: 0, s1: 0, s2: 0, eko: 0, tk: 0, sel: 0 });
    m[g.kab].emisi += g.emisi; m[g.kab].s1 += g.s1; m[g.kab].s2 += g.s2;
    m[g.kab].eko += g.eko; m[g.kab].tk += g.tk; m[g.kab].sel += 1;
  });
  return Object.values(m);
}
/* --------------------- AG Grid: peringkat kabupaten --------------------- */
let kabGrid = null;
function buildKab() {
  const rows = kabRollup();
  const total = rows.reduce((s, r) => s + r.emisi, 0);
  const data = rows.map(r => ({
    kab: cleanKab(r.kab), emisi: r.emisi, pct: r.emisi / total * 100,
    s1: r.s1, s2: r.s2, eko: r.eko, tk: r.tk, sel: r.sel
  }));
  const num = (f) => ({ type: 'rightAligned', valueFormatter: p => f(p.value) });
  kabGrid = agGrid.createGrid(el('gridKab'), {
    rowData: data,
    defaultColDef: { sortable: true, resizable: true, suppressMovable: true },
    columnDefs: [
      { headerName: 'No', valueGetter: p => p.node.rowIndex + 1, width: 54, type: 'rightAligned', sortable: false },
      { headerName: 'Kabupaten / Kota', field: 'kab', flex: 1, minWidth: 150 },
      { headerName: 'Emisi (t CO₂e)', field: 'emisi', sort: 'desc', ...num(fmtN) },
      { headerName: '%', field: 'pct', ...num(v => fmt1(v) + '%') },
      { headerName: 'S1', field: 's1', ...num(fmtN) },
      { headerName: 'S2', field: 's2', ...num(fmtN) },
      { headerName: 'Nilai tambah', field: 'eko', ...num(fmtRp) },
      { headerName: 'Pekerja', field: 'tk', ...num(fmtN) },
      { headerName: 'Sel', field: 'sel', type: 'rightAligned', width: 72 }
    ]
  });
  el('kabMeta').textContent = `${rows.length} kabupaten & kota - total ${fmtN(total)} t CO₂e`;
}

/* ------------------- AG Grid: penjelajah 857 kotak ------------------- */
let expGrid = null, expSec = 'ALL';
function buildExp() {
  const data = GRID.map(r => ({
    sec: r.sec, rank: r.rank, kab: cleanKab(r.kab), lat: r.lat, lon: r.lon,
    s1: r.s1, s2: r.s2, emisi: r.emisi, eko: r.eko, tk: r.tk,
    ne: r.ne, nk: r.nk, nt: r.nt, score: r.score, kat: catOf(r.score).nama
  }));
  const num = (f) => ({ type: 'rightAligned', valueFormatter: p => f(p.value) });
  expGrid = agGrid.createGrid(el('gridExp'), {
    rowData: data,
    defaultColDef: { sortable: true, resizable: true, suppressMovable: true },
    columnDefs: [
      { headerName: 'Sektor', field: 'sec', width: 132 },
      { headerName: 'Rank', field: 'rank', type: 'rightAligned', width: 78 },
      { headerName: 'Kab / Kota', field: 'kab', minWidth: 140, flex: 1 },
      { headerName: 'Lat', field: 'lat', type: 'rightAligned', width: 82 },
      { headerName: 'Lon', field: 'lon', type: 'rightAligned', width: 86 },
      { headerName: 'S1', field: 's1', ...num(fmtN) },
      { headerName: 'S2', field: 's2', ...num(fmtN) },
      { headerName: 'Emisi', field: 'emisi', sort: 'desc', ...num(fmtN) },
      { headerName: 'Nilai tambah', field: 'eko', ...num(fmtRp) },
      { headerName: 'TK', field: 'tk', ...num(fmtN) },
      { headerName: 'ne', field: 'ne', ...num(fmt2) },
      { headerName: 'nk', field: 'nk', ...num(fmt2) },
      { headerName: 'nt', field: 'nt', ...num(fmt2) },
      { headerName: 'Skor', field: 'score', ...num(fmt2) },
      { headerName: 'Kategori', field: 'kat', width: 128 }
    ],
    isExternalFilterPresent: () => expSec !== 'ALL',
    doesExternalFilterPass: node => node.data.sec === expSec,
    onModelUpdated: e => { const n = e.api.getDisplayedRowCount(); el('expMeta').textContent = `${fmtN(n)} dari ${GRID.length} kotak peta`; }
  });
}

function initInteractiveTables() {
  buildKab();
  buildExp();
  const sel = el('expSector');
  const bySec = {};
  GRID.forEach(g => bySec[g.sec] = (bySec[g.sec] || 0) + 1);
  Object.keys(bySec).forEach(s => {
    const o = document.createElement('option'); o.value = s; o.textContent = `${s} (${bySec[s]})`; sel.appendChild(o);
  });
  sel.addEventListener('change', () => { expSec = sel.value; expGrid.onFilterChanged(); });
  el('expSearch').addEventListener('input', e => { expGrid.setGridOption('quickFilterText', e.target.value); });
}

/* ---------------------- slider bobot (ilustrasi) ---------------------- */
function initSlider() {
  const s = el('wEmisi'); if (!s) return;
  const ne = 0.3866, nk = 1.0, nt = 1.0;   // kotak nyata: Kimia, Kab. Sidoarjo (peringkat 1)
  const upd = () => {
    const wE = +s.value / 100, wR = (1 - wE) / 2;
    const score = wE * ne + wR * nk + wR * nt;
    el('wEmisiVal').textContent = Math.round(wE * 100) + '%';
    el('wRestVal').textContent = Math.round(wR * 100) + '%';
    el('scoreVal').textContent = fmt2(score);
    el('scoreBar').style.width = (score * 100) + '%';
    el('scoreCat').textContent = catOf(score).nama;
    el('scoreCat').style.background = catOf(score).warna;
    el('scoreCat').style.color = score >= 0.6 ? '#fff' : '#202734';
  };
  s.addEventListener('input', upd); upd();
}

/* ------------------------- ringkasan angka ------------------------- */
function fillKeyNumbers() {
  const totalGridEmisi = GRID.reduce((s, g) => s + g.emisi, 0);
  const kab = kabRollup().sort((a, b) => b.emisi - a.emisi);
  const counts = {}; GRID.forEach(g => { const c = catOf(g.score).nama; counts[c] = (counts[c] || 0) + 1; });
  const set = (ids, v) => ids.forEach(id => { const e = el(id); if (e) e.textContent = v; });
  const topName = kab[0].kab.replace('Kabupaten ', 'Kab. ').replace('Kota Kota ', 'Kota ');
  set(['kpiGrid', 'kpiGrid2'], fmtN(GRID.length));
  set(['kpiGridEmisi', 'kpiGridEmisi2'], fmtN(totalGridEmisi));
  set(['kpiKabTop', 'kpiKabTop2'], topName);
  set(['kpiKabTopPct'], fmt1(kab[0].emisi / totalGridEmisi * 100) + '%');
  set(['kpiKabCount', 'kpiKabCount2'], fmtN(kab.length));
  set(['kpiPrior', 'kpiPrior2', 'kpiPrior3'], fmtN((counts['Sangat Prioritas'] || 0) + (counts['Prioritas'] || 0)));
  set(['kpiCompany', 'kpiCompany2', 'kpiCompany3'], fmtN(COMPANY_COUNT.reduce((s, c) => s + c.n, 0)));
  set(['kpiTk', 'kpiTk2'], fmtN(TK_ALLOC.reduce((s, t) => s + t.tk, 0)));
}

/* ------------------------------- boot ------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  renderStaticTables();
  fillKeyNumbers();
  initInteractiveTables();
  initSlider();
  renderCharts();
  renderMap();
  initNav();
});
