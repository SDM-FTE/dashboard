/* Small, local OOXML reader. Values are cached Excel values; formulas are never evaluated. */
(() => {
  'use strict';
  const LIMITS = Object.freeze({ file: 10 * 1024 * 1024, total: 64 * 1024 * 1024, entries: 512, rows: 20000, columns: 100, cellText: 32767 });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const MAIN_NAMESPACES = new Set(['http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'http://purl.oclc.org/ooxml/spreadsheetml/main']);
  const PACKAGE_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const OFFICE_NAMESPACES = ['http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'http://purl.oclc.org/ooxml/officeDocument/relationships'];
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function safePath(name) {
    if (!name || name.startsWith('/') || /[\\:\x00-\x1f\x7f]/.test(name) || name.split('/').some(part => part === '.' || part === '..') || name.includes('//')) {
      throw new Error('Excel memuat jalur berkas yang tidak aman. Simpan ulang sebagai .xlsx.');
    }
    return name;
  }
  function decode(bytes, label) {
    try { return decoder.decode(bytes); }
    catch { throw new Error(`Teks ${label} tidak dapat dibaca. Simpan ulang sebagai Excel .xlsx.`); }
  }
  function asBytes(buffer) {
    if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
    if (ArrayBuffer.isView(buffer)) return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    throw new Error('Isi file Excel tidak tersedia. Pilih kembali berkas .xlsx.');
  }
  function readZipIndex(buffer) {
    const bytes = asBytes(buffer);
    if (bytes.length > LIMITS.file) throw new Error('File terlalu besar. Batas unggah adalah 10 MB.');
    if (bytes.length < 22) throw new Error('Berkas bukan Excel .xlsx atau ZIP tidak lengkap.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
      if (view.getUint32(p, true) === 0x06054b50 && p + 22 + view.getUint16(p + 20, true) === bytes.length) { eocd = p; break; }
    }
    if (eocd < 0) throw new Error('ZIP Excel tidak lengkap. Simpan ulang sebagai .xlsx lalu coba lagi.');
    const count = view.getUint16(eocd + 10, true), size = view.getUint32(eocd + 12, true), start = view.getUint32(eocd + 16, true);
    if (view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true) || view.getUint16(eocd + 8, true) !== count || count === 65535 || size === 0xffffffff || start === 0xffffffff) {
      throw new Error('ZIP multipart atau ZIP64 tidak didukung. Simpan Excel biasa sebagai .xlsx.');
    }
    if (count > LIMITS.entries || start + size > eocd) throw new Error('Struktur ZIP Excel tidak valid atau terlalu besar.');
    const entries = new Map(), regions = [];
    let offset = start, total = 0;
    for (let i = 0; i < count; i++) {
      if (offset + 46 > start + size || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Daftar berkas ZIP tidak valid.');
      const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true), uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true);
      const local = view.getUint32(offset + 42, true), end = offset + 46 + nameLength + extraLength + commentLength;
      if (end > start + size || local + 30 > start || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || local === 0xffffffff) throw new Error('Batas berkas ZIP tidak valid.');
      const name = safePath(decode(bytes.subarray(offset + 46, offset + 46 + nameLength), 'nama berkas Excel'));
      if (entries.has(name)) throw new Error('Excel memuat nama berkas ganda. Simpan ulang berkas .xlsx.');
      if (flags & 0x41) throw new Error('Excel dengan kata sandi tidak didukung. Simpan salinan tanpa kata sandi.');
      if (flags & ~0x080e || (method !== 0 && method !== 8)) throw new Error('Jenis kompresi Excel tidak didukung. Simpan ulang sebagai .xlsx.');
      if (method === 0 && compressedSize !== uncompressedSize) throw new Error('Ukuran isi Excel tidak konsisten.');
      if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method || view.getUint16(local + 6, true) !== flags) throw new Error('Header ZIP Excel tidak konsisten.');
      const localNameLength = view.getUint16(local + 26, true), localExtraLength = view.getUint16(local + 28, true);
      const dataStart = local + 30 + localNameLength + localExtraLength, dataEnd = dataStart + compressedSize;
      if (dataEnd > start || decode(bytes.subarray(local + 30, local + 30 + localNameLength), 'nama berkas Excel') !== name) throw new Error('Isi ZIP Excel tidak konsisten.');
      const crc = view.getUint32(offset + 16, true);
      if (!(flags & 8) && (view.getUint32(local + 14, true) !== crc || view.getUint32(local + 18, true) !== compressedSize || view.getUint32(local + 22, true) !== uncompressedSize)) throw new Error('Header ukuran atau pemeriksaan ZIP tidak konsisten.');
      total += uncompressedSize;
      if (total > LIMITS.total) throw new Error('Isi Excel melebihi 64 MB setelah dibuka. Gunakan file tabel BKD saja.');
      regions.push({ start: local, end: dataEnd });
      entries.set(name, { name, method, size: uncompressedSize, crc, bytes: bytes.subarray(dataStart, dataEnd) });
      offset = end;
    }
    if (offset !== start + size) throw new Error('Ukuran daftar ZIP Excel tidak konsisten.');
    regions.sort((a, b) => a.start - b.start);
    if (regions.some((region, i) => i > 0 && region.start < regions[i - 1].end)) throw new Error('Bagian isi ZIP Excel saling tumpang tindih.');
    return entries;
  }
  async function unzipEntry(entry) {
    let result;
    if (entry.method === 0) result = entry.bytes;
    else {
      let decompressor;
      try { decompressor = new DecompressionStream('deflate-raw'); }
      catch { throw new Error('Browser ini belum mendukung pembacaan Excel. Gunakan Google Chrome atau Microsoft Edge terbaru.'); }
      try {
        const reader = new Blob([entry.bytes]).stream().pipeThrough(decompressor).getReader(), chunks = [];
        let size = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > entry.size || size > LIMITS.total) { await reader.cancel(); throw new Error('Isi Excel melebihi ukuran yang tercatat.'); }
          chunks.push(value);
        }
        result = new Uint8Array(size);
        let p = 0;
        for (const chunk of chunks) { result.set(chunk, p); p += chunk.byteLength; }
      } catch (error) {
        if (error.message.includes('melebihi')) throw error;
        throw new Error('Isi Excel gagal dibaca. Simpan ulang sebagai .xlsx lalu coba lagi.');
      }
    }
    if (result.byteLength !== entry.size || crc32(result) !== entry.crc) throw new Error('Isi Excel rusak atau tidak lengkap. Simpan ulang file tersebut.');
    return result;
  }
  const descendants = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
  const children = (node, name) => Array.from(node.children).filter(child => child.localName === name && child.namespaceURI === node.namespaceURI);
  function parseXml(bytes, name, expectedRoot) {
    const text = decode(bytes, 'XML Excel');
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML dengan DTD atau entitas tidak didukung. Simpan ulang Excel .xlsx.');
    const doc = new DOMParser().parseFromString(text, 'application/xml'), root = doc.documentElement;
    if (descendants(doc, 'parsererror').length || !root || root.localName !== expectedRoot) throw new Error(`Bagian ${name} tidak dapat dibaca sebagai Excel .xlsx.`);
    if (expectedRoot === 'Relationships' ? root.namespaceURI !== PACKAGE_NAMESPACE : !MAIN_NAMESPACES.has(root.namespaceURI)) throw new Error('Jenis XML Excel tidak didukung. Simpan ulang sebagai .xlsx.');
    return root;
  }
  function richText(node) {
    return descendants(node, 't').filter(t => {
      if (!MAIN_NAMESPACES.has(t.namespaceURI)) return false;
      let p = t.parentNode;
      while (p && p !== node) { if (p.localName === 'rPh') return false; p = p.parentNode; }
      return true;
    }).map(t => decodeExcelString(t.textContent)).join('');
  }
  // A single pass preserves a literal escape protected with _x005F_.
  function decodeExcelString(text) {
    return text.replace(/_x([0-9a-f]{4})_/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  }
  function resolveTarget(source, target) {
    if (!target || /[\\:?#\x00-\x1f\x7f]/.test(target)) throw new Error('Referensi lembar Excel tidak didukung.');
    const raw = target.startsWith('/') ? target.slice(1) : source.slice(0, source.lastIndexOf('/') + 1) + target;
    const resolved = [];
    for (const part of raw.split('/')) {
      if (part === '.' || part === '') continue;
      if (part === '..') { if (!resolved.length) throw new Error('Referensi Excel tidak aman.'); resolved.pop(); }
      else resolved.push(part);
    }
    return safePath(resolved.join('/'));
  }
  function requireInternalRelation(relation) {
    if (!relation || (relation.getAttribute('TargetMode') || '').toLowerCase() === 'external') throw new Error('Excel memuat referensi lembar di luar file. Simpan ulang sebagai .xlsx.');
    return relation;
  }
  async function read(buffer) {
    const zip = readZipIndex(buffer);
    async function xml(name, root) {
      if (!zip.has(name)) throw new Error(`Bagian ${name} tidak ditemukan. Gunakan file Excel .xlsx biasa.`);
      return parseXml(await unzipEntry(zip.get(name)), name, root);
    }
    let workbookPath = 'xl/workbook.xml';
    if (zip.has('_rels/.rels')) {
      const packageRels = await xml('_rels/.rels', 'Relationships');
      const office = children(packageRels, 'Relationship').filter(r => (r.getAttribute('Type') || '').endsWith('/officeDocument'));
      if (office.length !== 1) throw new Error('Referensi workbook Excel tidak valid.');
      workbookPath = resolveTarget('', requireInternalRelation(office[0]).getAttribute('Target'));
    }
    const workbook = await xml(workbookPath, 'workbook');
    const directory = workbookPath.slice(0, workbookPath.lastIndexOf('/') + 1), basename = workbookPath.slice(workbookPath.lastIndexOf('/') + 1);
    const rels = await xml(directory + '_rels/' + basename + '.rels', 'Relationships');
    const relations = children(rels, 'Relationship'), relationById = new Map();
    for (const relation of relations) {
      const id = relation.getAttribute('Id');
      if (!id || relationById.has(id)) throw new Error('Referensi workbook Excel ganda atau tidak valid.');
      relationById.set(id, relation);
    }
    let shared = [];
    const sharedRels = relations.filter(r => (r.getAttribute('Type') || '').endsWith('/sharedStrings'));
    if (sharedRels.length > 1) throw new Error('Referensi teks Excel ganda.');
    if (sharedRels.length) {
      const sharedPath = resolveTarget(workbookPath, requireInternalRelation(sharedRels[0]).getAttribute('Target'));
      shared = children(await xml(sharedPath, 'sst'), 'si').map(richText);
    } else if (zip.has(directory + 'sharedStrings.xml')) {
      shared = children(await xml(directory + 'sharedStrings.xml', 'sst'), 'si').map(richText);
    }
    function cellValue(cell, address) {
      const type = cell.getAttribute('t') || 'n', values = children(cell, 'v'), formulas = children(cell, 'f');
      if (type === 'e') throw new Error(`Sel ${address} berisi kesalahan Excel. Perbaiki dahulu lalu simpan ulang.`);
      if (values.length > 1 || formulas.length > 1) throw new Error(`Sel ${address} tidak memiliki format yang valid.`);
      const value = values.length ? values[0].textContent : '';
      if (formulas.length && (!values.length || (type !== 'str' && value === ''))) throw new Error(`Sel ${address} berisi rumus tanpa hasil tersimpan. Buka di Excel, hitung ulang, dan simpan.`);
      let result;
      if (type === 'inlineStr') {
        if (formulas.length) throw new Error(`Sel ${address} memiliki rumus tanpa hasil yang valid.`);
        result = richText(cell);
      } else if (type === 's') {
        const index = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(index) || index >= shared.length) throw new Error(`Teks pada sel ${address} tidak valid.`);
        result = shared[index];
      } else if (type === 'b') {
        if (value !== '0' && value !== '1') throw new Error(`Nilai pada sel ${address} tidak valid.`);
        result = value === '1' ? 'TRUE' : 'FALSE';
      } else if (type === 'str') result = decodeExcelString(value);
      else if (type === 'd') result = value;
      else if (type === 'n') {
        if (value !== '' && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value)))) throw new Error(`Angka pada sel ${address} tidak valid.`);
        result = value;
      } else throw new Error(`Jenis sel ${address} tidak didukung. Simpan sebagai Excel .xlsx biasa.`);
      if (result.length > LIMITS.cellText) throw new Error(`Teks pada sel ${address} terlalu panjang.`);
      return result;
    }
    const sheetContainers = children(workbook, 'sheets');
    if (sheetContainers.length !== 1) throw new Error('Daftar lembar Excel tidak valid.');
    const sheetList = children(sheetContainers[0], 'sheet'), output = [], usedNames = new Set(), usedTargets = new Set();
    if (!sheetList.length) throw new Error('Excel tidak memiliki lembar kerja.');
    let totalRows = 0;
    for (const sheet of sheetList) {
      const name = sheet.getAttribute('name');
      if (!name || usedNames.has(name)) throw new Error('Nama lembar Excel kosong atau ganda.');
      usedNames.add(name);
      const relationId = OFFICE_NAMESPACES.map(ns => sheet.getAttributeNS(ns, 'id')).find(Boolean) || sheet.getAttribute('r:id');
      const relation = requireInternalRelation(relationById.get(relationId));
      if (!(relation.getAttribute('Type') || '').endsWith('/worksheet')) throw new Error(`Lembar ${name} bukan tabel Excel yang didukung.`);
      const target = resolveTarget(workbookPath, relation.getAttribute('Target'));
      if (usedTargets.has(target)) throw new Error('Dua lembar Excel mengarah ke isi yang sama.');
      usedTargets.add(target);
      const worksheet = await xml(target, 'worksheet'), dataContainers = children(worksheet, 'sheetData');
      if (dataContainers.length !== 1) throw new Error(`Isi lembar ${name} tidak valid.`);
      const occupied = new Map(), seenRows = new Set();
      let first = Infinity, last = 0, maxColumn = 0;
      for (const row of children(dataContainers[0], 'row')) {
        const rawRow = row.getAttribute('r') || '', number = Number(rawRow);
        if (!/^\d+$/.test(rawRow) || !Number.isSafeInteger(number) || number < 1 || number > 1048576 || seenRows.has(number)) throw new Error('Nomor baris Excel tidak valid atau ganda.');
        seenRows.add(number);
        const values = [], usedColumns = new Set();
        for (const cell of children(row, 'c')) {
          const address = cell.getAttribute('r') || '', match = /^([A-Z]{1,3})(\d+)$/.exec(address);
          if (!match || Number(match[2]) !== number) throw new Error('Alamat sel Excel tidak valid.');
          let column = 0;
          for (const c of match[1]) column = column * 26 + c.charCodeAt(0) - 64;
          if (column < 1 || column > 16384 || usedColumns.has(column)) throw new Error('Alamat sel Excel di luar batas atau ganda.');
          usedColumns.add(column);
          const value = cellValue(cell, address);
          if (value === '') continue;
          if (column > LIMITS.columns) throw new Error(`Lembar ${name} melebihi batas 100 kolom. Gunakan tabel BKD saja.`);
          values[column - 1] = value;
          maxColumn = Math.max(maxColumn, column);
        }
        if (!values.length) continue;
        occupied.set(number, values);
        first = Math.min(first, number); last = Math.max(last, number);
        if (last - first + 1 > LIMITS.rows) throw new Error(`Lembar ${name} melebihi batas 20.000 baris. Gunakan tabel BKD saja.`);
      }
      if (!occupied.size) { output.push({ name, rows: [] }); continue; }
      totalRows += last - first + 1;
      if (totalRows > LIMITS.rows) throw new Error('Total isi Excel melebihi batas 20.000 baris. Gunakan file tabel BKD saja.');
      const rows = [];
      for (let i = first; i <= last; i++) {
        const source = occupied.get(i) || [], values = Array(maxColumn).fill('');
        for (let col = 0; col < source.length; col++) if (source[col] !== undefined) values[col] = source[col];
        rows.push(values);
      }
      output.push({ name, rows });
    }
    return { sheets: output };
  }
  window.BkdXlsx = Object.freeze({ read });
})();
