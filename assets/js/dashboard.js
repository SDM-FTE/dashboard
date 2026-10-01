(() => {
  'use strict';

  const PAGE_SIZE = 12;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = (value, digits = 2) => {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(number) : esc(value);
  };
  const shortText = (value, fallback = '—') => value === null || value === undefined || value === '' ? fallback : String(value);
  const badgeClass = (value) => {
    const v = String(value ?? '').toUpperCase();
    if (v === 'M' || v === 'LENGKAP') return 'good';
    if (v === 'TM') return 'bad';
    if (v.includes('BELUM')) return 'warn';
    return 'neutral';
  };
  const badge = (value, label) => `<span class="badge ${badgeClass(value)}">${esc(label ?? shortText(value))}</span>`;
  const normalized = (value) => String(value ?? '').toLocaleLowerCase('id-ID').trim();
  const oneDayMs = 86400000;
  function jakartaToday() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  }
  function isoDay(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  function dateFromIso(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  }
  function formatJakartaDate(date) {
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }
  function addClampedMonths(start, months) {
    const absoluteMonth = start.getUTCMonth() + months;
    const year = start.getUTCFullYear() + Math.floor(absoluteMonth / 12);
    const month = absoluteMonth % 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)));
  }
  function durationFromIso(value, today = jakartaToday()) {
    const start = dateFromIso(value);
    if (!start) return '—';
    if (start > today) return 'Belum dimulai';
    let months = (today.getUTCFullYear() - start.getUTCFullYear()) * 12 + today.getUTCMonth() - start.getUTCMonth();
    if (addClampedMonths(start, months) > today) months -= 1;
    const anchor = addClampedMonths(start, months);
    const days = Math.floor((today.getTime() - anchor.getTime()) / oneDayMs);
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return `${years} tahun, ${remainingMonths} bulan, ${days} hari`;
  }
  const fteJfaLabel = (value) => String(value ?? '').includes('#VALUE!') ? 'Perlu diperiksa' : shortText(value);

  let data;
  let jadProgress = {};
  let activeJadNo = null;
  const JAD_STAGES = ['Pengecekan ajuan', 'Pengesahan', 'Penugasan asesor', 'Penilaian', 'Verifikasi SK', 'Selesai'];
  const pages = { jad: 1, bkd: 1, fte: 1 };
  let activeProgramIndex = null;
  let bkdPrograms = [];
  let renderBkdProgramTable = () => {};

  function setView(name, updateHash = true) {
    const view = ['home', 'jad', 'jad-detail', 'jad-progress', 'bkd', 'bkd-prodi', 'fte'].includes(name) ? name : 'home';
    $('#homeView').hidden = view !== 'home';
    $('#jadView').hidden = view !== 'jad';
    $('#jadDetailView').hidden = view !== 'jad-detail';
    $('#jadProgressView').hidden = view !== 'jad-progress';
    $('#bkdView').hidden = view !== 'bkd';
    $('#bkdProgramView').hidden = view !== 'bkd-prodi';
    $('#fteView').hidden = view !== 'fte';
    if (updateHash) {
      const hash = view === 'bkd-prodi'
        ? (activeProgramIndex === null ? '#bkd-detail' : `#bkd-prodi/${activeProgramIndex}`)
        : view === 'jad-progress' && activeJadNo !== null ? `#jad-progress/${activeJadNo}` : `#${view}`;
      if (window.location.hash !== hash) window.location.hash = hash;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openBkdProgram(index, updateHash = true) {
    activeProgramIndex = Number(index);
    const program = bkdPrograms[activeProgramIndex];
    if (!program) return;
    $('#bkdProgramHeading').textContent = program;
    $('#bkdProgramTitle').textContent = program;
    $('#bkdProgramDescription').textContent = 'Daftar dosen dan kesimpulan BKD pada program studi ini.';
    $('#bkdProgramSearch').value = '';
    $('#bkdProgramConclusionFilter').value = '';
    pages.bkd = 1;
    renderBkdProgramTable();
    setView('bkd-prodi', updateHash);
  }

  function openJadProgress(no, updateHash = true) {
    const record = (data?.jad || []).find((row) => String(row.no) === String(no));
    if (!record) { setView('jad-detail', updateHash); return; }
    activeJadNo = String(record.no);
    renderJadProgress(record);
    setView('jad-progress', updateHash);
  }

  function renderJadProgress(record) {
    const saved = jadProgress[String(record.no)] || {};
    const rawStage = Number(saved.stage);
    const stage = saved.stage !== null && saved.stage !== undefined && saved.stage !== '' && Number.isInteger(rawStage) && rawStage >= 0 && rawStage < JAD_STAGES.length ? rawStage : null;
    const currentRank = record.currentRank ? `${record.currentRank}${record.rankDate ? ` · ${record.rankDate}` : ''}` : null;
    $('#jadProgressHeading').textContent = record.name;
    $('#jadProgressPublication').className = `badge ${badgeClass(record.publication)}`;
    $('#jadProgressPublication').textContent = shortText(record.publication, 'Status publikasi belum tersedia');
    $('#jadProgressApplicant').innerHTML = [
      ['Jenjang ijazah', record.degree], ['JFA saat ini', currentRank], ['Usulan JFA', record.proposedRank],
      ['AKK baru', record.totalAkBaru], ['AKK lama + baru', record.totalAkLamaBaru], ['Rumpun ilmu', record.scienceCluster],
    ].map(([label, value]) => `<div class="progress-applicant-item"><span>${esc(label)}</span><strong>${value === null || value === undefined || value === '' ? '—' : (typeof value === 'number' ? fmt(value) : esc(value))}</strong></div>`).join('');
    $('#jadProgressStageLabel').textContent = stage === null ? 'Tahapan proses belum diperbarui.' : stage === JAD_STAGES.length - 1 ? 'Ajuan telah selesai.' : `Tahap berjalan: ${JAD_STAGES[stage]}.`;
    $('#jadProgressTimeline').innerHTML = JAD_STAGES.map((label, index) => {
      const state = stage === null ? 'pending' : stage === JAD_STAGES.length - 1 || index < stage ? 'done' : index === stage ? 'current' : 'pending';
      const marker = state === 'done' ? '✓' : state === 'current' ? '•' : '';
      return `<li class="progress-step ${state}" ${state === 'current' ? 'aria-current="step"' : ''}><span class="progress-step-marker" aria-hidden="true">${marker}</span><span class="progress-step-label">${esc(label)}</span></li>`;
    }).join('');
    const requirements = [
      ['paperPdf', 'Paper terbit (PDF)', 'Naskah paper terbit tersedia dalam format PDF.'],
      ['similarity', 'Hasil similarity', 'Dokumen atau hasil pemeriksaan similarity telah tersedia.'],
      ['correspondence', 'Korespondensi syarat utama', 'Bukti korespondensi untuk pemenuhan syarat utama telah tersedia.'],
    ];
    const checks = saved.requirements || {};
    $('#jadProgressRequirements').innerHTML = requirements.map(([key, label, note]) => {
      const status = checks[key];
      const checked = status === true;
      const reviewed = status === true || status === false;
      const stateLabel = !reviewed ? 'Belum diperiksa' : checked ? 'Lengkap' : 'Belum lengkap';
      return `<label class="jad-checklist-item"><input type="checkbox" disabled ${checked ? 'checked' : ''} ${reviewed ? '' : 'data-unknown'} aria-label="${esc(label)}: ${stateLabel.toLocaleLowerCase('id-ID')}"><span class="jad-checklist-copy"><strong>${esc(label)}</strong><small>${esc(note)}</small></span><span class="jad-checklist-state ${checked ? 'complete' : reviewed ? '' : 'unknown'}">${stateLabel}</span></label>`;
    }).join('');
    $('#jadProgressRequirements').querySelectorAll('[data-unknown]').forEach((checkbox) => { checkbox.indeterminate = true; });
    const skp = (record.skpByYear || []).map((value, i) => [String(2023 + i), value]);
    const groups = [
      ['Profil dan kepakaran', [['Jenjang ijazah', record.degree], ['Rumpun ilmu', record.scienceCluster]]],
      ['Angka kredit', [['AK pendidikan', record.akEducation], ['AK pengajaran', record.akTeaching], ['AK penelitian', record.akResearch], ['AK pengabdian', record.akCommunity], ['AK penunjang', record.akSupport], ['AK penyetaraan', record.akPenyetaraan], ['AK SKP dan prestasi', record.akSkpPrestasi], ['Total AKK baru', record.totalAkBaru], ['Pencapaian AKK lama + baru', record.totalAkLamaBaru]]],
      ['Proporsi penelitian', [['AK penelitian tercatat', record.akResearch]]],
      ['IKD dan SKP', [...skp.map(([year, value]) => [`SKP ${year}`, value]), ['Rekomendasi PAK', record.pakRecommendation], ['Catatan PAK', record.pakNote], ['Rekomendasi Senat', record.senateRecommendation], ['Catatan Senat', record.senateNote]]],
      ['Syarat BKD', []], ['Syarat khusus', []], ['Dokumen rekomendasi', [['Rekomendasi PAK', record.pakRecommendation], ['Rekomendasi Senat', record.senateRecommendation]]],
    ];
    $('#jadProgressSections').innerHTML = groups.map(([title, items]) => {
      const visible = items.filter(([, value]) => value !== null && value !== undefined && value !== '');
      const body = visible.length ? `<div class="detail-grid">${visible.map(([label, value]) => detailItem(label, typeof value === 'number' ? fmt(value) : value)).join('')}</div>` : '<p class="progress-empty-note">Data bagian ini tidak tersedia pada workbook yang digunakan.</p>';
      return `<details class="progress-accordion"><summary>${esc(title)}<span aria-hidden="true">⌄</span></summary><div class="progress-accordion-body">${body}</div></details>`;
    }).join('');
  }

  function routeFromHash() {
    const route = window.location.hash.slice(1) || 'home';
    const jadProgressMatch = route.match(/^jad-progress\/(\d+)$/);
    if (jadProgressMatch) {
      if (data) openJadProgress(jadProgressMatch[1], false);
      else setView('jad-progress', false);
      return;
    }
    const programMatch = route.match(/^bkd-prodi\/(\d+)$/);
    if (programMatch) {
      if (data) openBkdProgram(programMatch[1], false);
      else setView('bkd-prodi', false);
      return;
    }
    if (route === 'bkd-detail') {
      setView('bkd', false);
      return;
    }
    setView(route, false);
  }

  function optionsFor(select, values, firstLabel) {
    const unique = [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'id'));
    select.innerHTML = `<option value="">${esc(firstLabel)}</option>` + unique.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
  }

  function detailItem(label, value) {
    const text = value === null || value === undefined || value === '' ? '—' : value;
    return `<div class="detail-item"><span>${esc(label)}</span><strong>${esc(text)}</strong></div>`;
  }

  function detailSection(title, items) {
    const populated = items.filter((item) => item[1] !== null && item[1] !== undefined && item[1] !== '');
    if (!populated.length) return '';
    return `<section class="detail-section"><h3>${esc(title)}</h3><div class="detail-grid">${populated.map(([label, value]) => detailItem(label, value)).join('')}</div></section>`;
  }

  function showDetails(kind, record) {
    const dialog = $('#detailDialog');
    if (kind === 'jad') {
      $('#dialogEyebrow').textContent = 'DETAIL MONITORING JAD';
      $('#dialogTitle').textContent = record.name;
      const rank = `${shortText(record.currentRank)}${record.rankDate ? ` · ${record.rankDate}` : ''}`;
      const annual = (record.skpByYear || []).map((value, i) => [String(2023 + i), fmt(value)]);
      $('#dialogContent').innerHTML =
        detailSection('Informasi usulan', [
          ['No.', record.no], ['Ijazah terakhir', record.degree], ['Kelengkapan publikasi', record.publication],
          ['JFA saat ini', rank], ['Angka kredit lama', fmt(record.oldAk)], ['Usulan JFA', record.proposedRank],
          ['Rumpun ilmu', record.scienceCluster],
        ]) +
        detailSection('Rincian angka kredit', [
          ['AK pendidikan', fmt(record.akEducation)], ['AK pengajaran', fmt(record.akTeaching)],
          ['AK penelitian', fmt(record.akResearch)], ['AK pengabdian', fmt(record.akCommunity)],
          ['AK penunjang', fmt(record.akSupport)], ['AK penyetaraan', fmt(record.akPenyetaraan)],
          ['AK SKP & prestasi', fmt(record.akSkpPrestasi)], ['Total AKK baru', fmt(record.totalAkBaru)],
          ['Pencapaian AKK lama + baru', fmt(record.totalAkLamaBaru)],
        ]) + detailSection('SKP penelitian per tahun', annual) +
        detailSection('Sosiometri HEI', (record.hei || []).map((value, index) => [["H", "E", "I", "Total HEI"][index], value]));
      if (record.pakRecommendation || record.pakNote || record.senateRecommendation || record.senateNote) {
        $('#dialogContent').insertAdjacentHTML('beforeend', detailSection('Catatan rapat', [
          ['Rekomendasi PAK', record.pakRecommendation], ['Catatan PAK', record.pakNote],
          ['Rekomendasi Senat', record.senateRecommendation], ['Catatan Senat', record.senateNote],
        ]));
      }
    } else if (kind === 'fte') {
      const today = jakartaToday();
      $('#dialogEyebrow').textContent = 'DETAIL DATA FTE';
      $('#dialogTitle').textContent = record.name;
      $('#dialogContent').innerHTML =
        detailSection('Jabatan dan penugasan', [
          ['Lokasi kerja', record.location], ['Status pegawai', record.employmentStatus],
          ['JFA saat ini', fteJfaLabel(record.jfa)], ['Angka JFA', fmt(record.jfaPoints)],
          ['Usulan kenaikan JFA', record.nextJfa], ['Bidang keahlian', record.field],
          ['Kelompok keahlian', record.expertiseGroup], ['CoE', record.coe],
        ]) + detailSection('Pendidikan', [
          ['Pendidikan terakhir', record.education], ['Program studi S1', record.s1Program],
          ['Program studi S2', record.s2Program], ['Program studi S3', record.s3Program],
        ]) + detailSection('Masa dan umur per ' + formatJakartaDate(today), [
          ['Masa TMT JFA', durationFromIso(record.tmtJfaDate, today)],
          ['Masa kerja', durationFromIso(record.joinDate, today)],
          ['Masa kerja SK', durationFromIso(record.skStartDate, today)],
          ['Umur', durationFromIso(record.birthDate, today)],
        ]);
    } else {
      $('#dialogEyebrow').textContent = 'DETAIL MONITORING BKD';
      $('#dialogTitle').textContent = record.name;
      const activityLabels = ['A/B', 'Lebih A/B', 'C', 'Lebih C', 'D', 'Lebih D', 'E', 'Lebih E'];
      $('#dialogContent').innerHTML =
        detailSection('Identitas dan status', [
          ['No.', record.no], ['Program studi', record.program], ['Status dosen', record.status],
          ['Jabatan fungsional', record.position], ['BKD semester', record.semesterBkd],
          ['Kewajiban dosen', record.obligation], ['Kesimpulan', record.conclusion === 'M' ? 'Memenuhi (M)' : record.conclusion === 'TM' ? 'Tidak memenuhi (TM)' : record.conclusion],
        ]) + detailSection('Rincian kinerja', [
          ...activityLabels.map((label, index) => [label, fmt((record.activity || [])[index])]),
          ['Σ Kinerja', fmt(record.totalPerformance)], ['Σ Beban lebih', fmt(record.excessLoad)],
        ]);
    }
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  function initJad() {
    const records = data.jad || [];
    const counts = new Map();
    records.forEach((row) => counts.set(shortText(row.publication, 'Tidak ada status'), (counts.get(shortText(row.publication, 'Tidak ada status')) || 0) + 1));
    const complete = counts.get('LENGKAP') || 0;
    const incomplete = records.length - complete;
    $('#jadTotal').textContent = fmt(records.length, 0);
    $('#jadComplete').textContent = fmt(complete, 0);
    $('#jadIncomplete').textContent = fmt(incomplete, 0);
    $('#jadPublicationChart').innerHTML = [...counts.entries()].map(([label, count]) => {
      const width = records.length ? Math.round(count / records.length * 100) : 0;
      const cls = label === 'LENGKAP' ? '' : label.includes('BELUM') ? 'warn' : 'neutral';
      return `<button type="button" class="bar-item chart-filter-button" data-jad-chart-filter="${esc(label)}" aria-label="Buka ${esc(fmt(count, 0))} dosen dengan status ${esc(label)}"><span class="bar-meta"><span>${esc(label)}</span><strong>${fmt(count, 0)} dosen</strong></span><span class="bar-track"><span class="bar-fill ${cls}" style="width:${width}%"></span></span></button>`;
    }).join('');
    optionsFor($('#jadPublicationFilter'), records.map((row) => row.publication), 'Semua status publikasi');
    $('#jadPublicationFilter').insertAdjacentHTML('beforeend', '<option value="__incomplete__">Perlu dilengkapi</option>');
    if (counts.has('Tidak ada status')) $('#jadPublicationFilter').insertAdjacentHTML('beforeend', '<option value="__missing__">Tidak ada status</option>');
    optionsFor($('#jadRankFilter'), records.map((row) => row.proposedRank), 'Semua usulan JFA');

    const render = () => {
      const query = normalized($('#jadSearch').value);
      const publication = $('#jadPublicationFilter').value;
      const rank = $('#jadRankFilter').value;
      const filtered = records.filter((row) => {
        const haystack = normalized([row.name, row.currentRank, row.proposedRank, row.degree].join(' '));
        const publicationMatches = !publication || (publication === '__incomplete__' ? row.publication !== 'LENGKAP' : publication === '__missing__' ? !row.publication : row.publication === publication);
        return (!query || haystack.includes(query)) && publicationMatches && (!rank || row.proposedRank === rank);
      });
      const pagesTotal = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      pages.jad = Math.min(pages.jad, pagesTotal);
      const start = (pages.jad - 1) * PAGE_SIZE;
      $('#jadResultCount').textContent = `${fmt(filtered.length, 0)} hasil`;
      $('#jadPageLabel').textContent = `Baris ${filtered.length ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, filtered.length)} dari ${fmt(filtered.length, 0)}`;
      $('#jadPrev').disabled = pages.jad <= 1;
      $('#jadNext').disabled = pages.jad >= pagesTotal;
      const shown = filtered.slice(start, start + PAGE_SIZE);
      $('#jadTableBody').innerHTML = shown.length ? shown.map((row) => `<tr class="clickable-row" data-jad-detail="${esc(row.no)}">
        <td class="name-cell">${esc(row.name)}<span class="sub-cell">${esc(shortText(row.degree, 'Ijazah tidak dicantumkan'))}</span></td>
        <td>${badge(row.publication)}</td>
        <td>${esc(shortText(row.currentRank))}</td>
        <td>${esc(shortText(row.proposedRank))}</td>
        <td class="numeric">${fmt(row.totalAkBaru)}</td>
        <td class="numeric">${fmt(row.totalAkLamaBaru)}</td>
        <td><button type="button" class="row-action" aria-label="Lihat detail ${esc(row.name)}">›</button></td>
      </tr>`).join('') : '<tr><td colspan="7" class="empty-row">Tidak ada data yang cocok dengan filter.</td></tr>';
      $('#jadTableBody').querySelectorAll('[data-jad-detail]').forEach((rowElement) => rowElement.addEventListener('click', () => {
        const record = records.find((row) => String(row.no) === rowElement.dataset.jadDetail);
        if (record) openJadProgress(record.no);
      }));
    };
    function clearQuickSelection() {
      document.querySelectorAll('[data-jad-quick-filter]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
    }
    $('#jadSearch').addEventListener('input', () => { clearQuickSelection(); pages.jad = 1; render(); });
    ['jadPublicationFilter', 'jadRankFilter'].forEach((id) => $(`#${id}`).addEventListener('change', () => { clearQuickSelection(); pages.jad = 1; render(); }));
    document.querySelectorAll('[data-jad-quick-filter]').forEach((button) => button.addEventListener('click', () => {
      const mode = button.dataset.jadQuickFilter;
      $('#jadSearch').value = '';
      $('#jadRankFilter').value = '';
      $('#jadPublicationFilter').value = mode === 'complete' ? 'LENGKAP' : mode === 'incomplete' ? '__incomplete__' : '';
      document.querySelectorAll('[data-jad-quick-filter]').forEach((card) => card.setAttribute('aria-pressed', String(card === button)));
      pages.jad = 1;
      render();
      setView('jad-detail');
    }));
    $('#jadPrev').addEventListener('click', () => { pages.jad -= 1; render(); });
    $('#jadNext').addEventListener('click', () => { pages.jad += 1; render(); });
    render();
    $('#jadPublicationChart').querySelectorAll('[data-jad-chart-filter]').forEach((button) => button.addEventListener('click', () => {
      $('#jadSearch').value = '';
      $('#jadRankFilter').value = '';
      $('#jadPublicationFilter').value = button.dataset.jadChartFilter === 'Tidak ada status' ? '__missing__' : button.dataset.jadChartFilter;
      pages.jad = 1;
      clearQuickSelection();
      render();
      setView('jad-detail');
    }));
  }

  function initBkd() {
    const records = data.bkd || [];
    bkdPrograms = data.focusPrograms || data.meta.bkdProgramNames || [];
    const met = records.filter((row) => row.conclusion === 'M').length;
    const unmet = records.filter((row) => row.conclusion === 'TM').length;
    const complianceRate = records.length ? met / records.length * 100 : 0;
    $('#bkdTotal').textContent = fmt(records.length, 0);
    $('#bkdMet').textContent = fmt(met, 0);
    $('#bkdMetFoot').textContent = `${fmt(complianceRate, 1)}% dari data yang dipilih`;
    $('#bkdUnmet').textContent = fmt(unmet, 0);
    $('#bkdUnmetFoot').textContent = `${fmt(records.length ? unmet / records.length * 100 : 0, 1)}% dari data yang dipilih`;
    $('#bkdPrograms').textContent = fmt(bkdPrograms.length, 0);

    const byProgram = bkdPrograms.map((program, index) => {
      const group = records.filter((row) => row.program === program);
      return { program, index, total: group.length, met: group.filter((row) => row.conclusion === 'M').length, unmet: group.filter((row) => row.conclusion === 'TM').length };
    });
    $('#bkdProgramChart').innerHTML = byProgram.map((group) => {
      const goodWidth = group.total ? group.met / group.total * 100 : 0;
      const badWidth = group.total ? group.unmet / group.total * 100 : 0;
      return `<button type="button" class="program-row program-open-button" data-open-program="${group.index}" data-met="${group.met}" data-unmet="${group.unmet}" aria-label="Buka daftar ${esc(group.program)}, ${fmt(group.total, 0)} dosen"><span class="program-name">${esc(group.program)}</span><span class="stack-track" aria-hidden="true"><span class="stack-met" style="width:${goodWidth}%"></span><span class="stack-unmet" style="width:${badWidth}%"></span></span><span class="program-numbers">${fmt(group.total, 0)} dosen</span></button>`;
    }).join('');
    $('#bkdProgramChart').querySelectorAll('[data-open-program]').forEach((button) => button.addEventListener('click', () => openBkdProgram(button.dataset.openProgram)));

    const applyChartFilter = (mode) => {
      document.querySelectorAll('[data-bkd-quick-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.bkdQuickFilter === mode)));
      const conclusionMode = mode === 'M' || mode === 'TM' ? mode : 'all';
      $('#bkdProgramChart').querySelectorAll('[data-open-program]').forEach((row) => {
        row.hidden = conclusionMode === 'M' ? Number(row.dataset.met) === 0 : conclusionMode === 'TM' ? Number(row.dataset.unmet) === 0 : false;
      });
    };
    document.querySelectorAll('[data-bkd-quick-filter]').forEach((button) => button.addEventListener('click', () => {
      applyChartFilter(button.dataset.bkdQuickFilter);
    }));

    renderBkdProgramTable = () => {
      const program = bkdPrograms[activeProgramIndex];
      const query = normalized($('#bkdProgramSearch').value);
      const conclusion = $('#bkdProgramConclusionFilter').value;
      const filtered = records.filter((row) => row.program === program &&
        (!query || normalized([row.name, row.position, row.status, row.obligation].join(' ')).includes(query)) &&
        (!conclusion || row.conclusion === conclusion));
      const pagesTotal = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      pages.bkd = Math.min(pages.bkd, pagesTotal);
      const start = (pages.bkd - 1) * PAGE_SIZE;
      $('#bkdProgramResultCount').textContent = `${fmt(filtered.length, 0)} dosen`;
      $('#bkdProgramPageLabel').textContent = `Baris ${filtered.length ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, filtered.length)} dari ${fmt(filtered.length, 0)}`;
      $('#bkdProgramPrev').disabled = pages.bkd <= 1;
      $('#bkdProgramNext').disabled = pages.bkd >= pagesTotal;
      const shown = filtered.slice(start, start + PAGE_SIZE);
      $('#bkdProgramTableBody').innerHTML = shown.length ? shown.map((row) => `<tr class="clickable-row" data-bkd-detail="${esc(row.no)}">
        <td class="name-cell">${esc(row.name)}</td>
        <td>${esc(shortText(row.status))}</td>
        <td>${esc(shortText(row.position))}</td>
        <td>${esc(shortText(row.semesterBkd))}</td>
        <td class="obligation-cell" title="${esc(shortText(row.obligation))}">${esc(shortText(row.obligation))}</td>
        <td>${badge(row.conclusion, row.conclusion === 'M' ? 'Memenuhi' : row.conclusion === 'TM' ? 'Tidak memenuhi' : shortText(row.conclusion))}</td>
        <td class="numeric">${fmt(row.totalPerformance)}</td>
        <td class="numeric">${fmt(row.excessLoad)}</td>
        <td><button type="button" class="row-action" aria-label="Lihat detail ${esc(row.name)}">›</button></td>
      </tr>`).join('') : '<tr><td colspan="9" class="empty-row">Tidak ada data yang cocok dengan filter.</td></tr>';
      $('#bkdProgramTableBody').querySelectorAll('[data-bkd-detail]').forEach((rowElement) => rowElement.addEventListener('click', () => {
        const record = filtered.find((row) => String(row.no) === rowElement.dataset.bkdDetail);
        if (record) showDetails('bkd', record);
      }));
    };
    $('#bkdProgramSearch').addEventListener('input', () => { pages.bkd = 1; renderBkdProgramTable(); });
    $('#bkdProgramConclusionFilter').addEventListener('change', () => { pages.bkd = 1; renderBkdProgramTable(); });
    $('#bkdProgramPrev').addEventListener('click', () => { pages.bkd -= 1; renderBkdProgramTable(); });
    $('#bkdProgramNext').addEventListener('click', () => { pages.bkd += 1; renderBkdProgramTable(); });
    renderBkdProgramTable();
  }

  function initFte() {
    const records = data.fte || [];
    const locations = [...new Set(records.map((row) => row.location).filter(Boolean))];
    const programs = locations.filter((location) => normalized(location).startsWith('prodi '));
    $('#fteTotal').textContent = fmt(records.length, 0);
    $('#fteLecturers').textContent = fmt(records.filter((row) => normalized(row.employmentStatus).startsWith('dosen')).length, 0);
    $('#ftePrograms').textContent = fmt(programs.length, 0);
    $('#fteJfaReview').textContent = fmt(records.filter((row) => !row.jfa || String(row.jfa).includes('#VALUE!')).length, 0);
    optionsFor($('#fteLocationFilter'), locations, 'Semua prodi/unit');
    optionsFor($('#fteRankFilter'), records.map((row) => fteJfaLabel(row.jfa)), 'Semua JFA');
    optionsFor($('#fteStatusFilter'), records.map((row) => row.employmentStatus), 'Semua status pegawai');
    let displayedDay = '';

    const render = () => {
      const today = jakartaToday();
      displayedDay = isoDay(today);
      $('#fteAsOfLabel').textContent = `Perhitungan mengikuti tanggal ${formatJakartaDate(today)} (WIB).`;
      const query = normalized($('#fteSearch').value);
      const location = $('#fteLocationFilter').value;
      const rank = $('#fteRankFilter').value;
      const status = $('#fteStatusFilter').value;
      const filtered = records.filter((row) => {
        const haystack = normalized([row.name, row.location, row.jfa, row.nextJfa, row.field, row.education, row.s1Program, row.s2Program, row.s3Program, row.expertiseGroup, row.employmentStatus].join(' '));
        return (!query || haystack.includes(query)) && (!location || row.location === location) && (!rank || fteJfaLabel(row.jfa) === rank) && (!status || row.employmentStatus === status);
      });
      const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      pages.fte = Math.min(pages.fte, pageCount);
      const start = (pages.fte - 1) * PAGE_SIZE;
      $('#fteResultCount').textContent = `${fmt(filtered.length, 0)} pegawai`;
      $('#ftePageLabel').textContent = `Baris ${filtered.length ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, filtered.length)} dari ${fmt(filtered.length, 0)}`;
      $('#ftePrev').disabled = pages.fte <= 1;
      $('#fteNext').disabled = pages.fte >= pageCount;
      const shown = filtered.slice(start, start + PAGE_SIZE);
      $('#fteTableBody').innerHTML = shown.length ? shown.map((row) => `<tr class="clickable-row" data-fte-detail="${esc(row.id)}">
        <td class="name-cell">${esc(row.name)}<span class="sub-cell">${esc(shortText(row.education, 'Pendidikan tidak dicantumkan'))}</span></td>
        <td>${esc(shortText(row.location))}</td>
        <td>${esc(fteJfaLabel(row.jfa))}</td>
        <td class="numeric">${fmt(row.jfaPoints)}</td>
        <td>${esc(durationFromIso(row.tmtJfaDate, today))}</td>
        <td>${esc(durationFromIso(row.joinDate, today))}</td>
        <td>${esc(durationFromIso(row.skStartDate, today))}</td>
        <td>${esc(durationFromIso(row.birthDate, today))}</td>
        <td><button type="button" class="row-action" aria-label="Lihat detail ${esc(row.name)}">›</button></td>
      </tr>`).join('') : '<tr><td colspan="9" class="empty-row">Tidak ada data yang cocok dengan filter.</td></tr>';
      $('#fteTableBody').querySelectorAll('[data-fte-detail]').forEach((rowElement) => rowElement.addEventListener('click', () => {
        const record = records.find((row) => String(row.id) === rowElement.dataset.fteDetail);
        if (record) showDetails('fte', record);
      }));
    };
    $('#fteSearch').addEventListener('input', () => { pages.fte = 1; render(); });
    ['fteLocationFilter', 'fteRankFilter', 'fteStatusFilter'].forEach((id) => $(`#${id}`).addEventListener('change', () => { pages.fte = 1; render(); }));
    $('#ftePrev').addEventListener('click', () => { pages.fte -= 1; render(); });
    $('#fteNext').addEventListener('click', () => { pages.fte += 1; render(); });
    render();
    const refreshIfDayChanged = () => { if (isoDay(jakartaToday()) !== displayedDay) render(); };
    window.setInterval(refreshIfDayChanged, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfDayChanged(); });
  }

  async function init() {
    document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
    window.addEventListener('hashchange', routeFromHash);
    $('#dialogClose').addEventListener('click', () => $('#detailDialog').close());
    $('#detailDialog').addEventListener('click', (event) => { if (event.target === $('#detailDialog')) $('#detailDialog').close(); });
    try {
      const [response, progressResponse] = await Promise.all([
        fetch('assets/data/dashboard-data.json'),
        fetch('assets/data/jad-progress.json'),
      ]);
      if (!response.ok) throw new Error('Dashboard data is unavailable');
      data = await response.json();
      jadProgress = progressResponse.ok ? await progressResponse.json() : {};
      initJad();
      initBkd();
      initFte();
      $('#sourceLabel').textContent = 'Sumber: workbook JAD, SISTER BKD, dan DATA FTE 2026';
      routeFromHash();
    } catch (error) {
      $('#loadError').hidden = false;
      console.error(error);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

