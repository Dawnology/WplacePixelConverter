/**
 * Minimal ZIP creator (store/no compression) for in-browser use.
 * PNGs are already compressed, so STORE is fine and fast.
 *
 * Usage: const blob = await zipFiles([{name, data:ArrayBuffer, date?:Date}]);
 */

function makeCRC32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCRC32Table();

function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) {
    c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dateToDos(dt) {
  const year = dt.getFullYear();
  const mon = dt.getMonth() + 1;
  const day = dt.getDate();
  const hrs = dt.getHours();
  const min = dt.getMinutes();
  const sec = Math.floor(dt.getSeconds() / 2); // 2-second granularity
  const dosTime = (hrs << 11) | (min << 5) | sec;
  const dosDate = ((year - 1980) << 9) | (mon << 5) | day;
  return { dosTime, dosDate };
}

/**
 * @param {{name:string,data:ArrayBuffer|Uint8Array,date?:Date}[]} files
 * @returns {Promise<Blob>} application/zip blob
 */
async function zipFiles(files) {
  const encoder = new TextEncoder();
  const localParts = []; // BlobParts before Central Directory
  const centralParts = [];
  let offset = 0; // running byte offset of local headers + data
  const records = [];

  for (const f of files) {
    const nameBytes = encoder.encode(f.name.replace(/\\\\/g, "/"));
    const dataU8 =
      f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
    const crc = crc32(dataU8);
    const size = dataU8.length >>> 0;
    const when = f.date || new Date();
    const { dosTime, dosDate } = dateToDos(when);

    // Local file header (30 bytes) + file name
    const lh = new ArrayBuffer(30);
    const dv = new DataView(lh);
    dv.setUint32(0, 0x04034b50, true); // signature
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // method: store
    dv.setUint16(10, dosTime, true);
    dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true); // compressed size
    dv.setUint32(22, size, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra len

    localParts.push(lh, nameBytes, dataU8);
    const localSize = 30 + nameBytes.length + size;

    records.push({
      nameBytes,
      crc,
      size,
      dosTime,
      dosDate,
      offset,
    });
    offset += localSize;
  }

  const centralStart = offset;
  // Central directory for each file
  for (const r of records) {
    const ch = new ArrayBuffer(46);
    const dv = new DataView(ch);
    dv.setUint32(0, 0x02014b50, true); // signature
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0, true); // flags
    dv.setUint16(10, 0, true); // method: store
    dv.setUint16(12, r.dosTime, true);
    dv.setUint16(14, r.dosDate, true);
    dv.setUint32(16, r.crc, true);
    dv.setUint32(20, r.size, true); // compressed size
    dv.setUint32(24, r.size, true); // uncompressed size
    dv.setUint16(28, r.nameBytes.length, true);
    dv.setUint16(30, 0, true); // extra len
    dv.setUint16(32, 0, true); // comment len
    dv.setUint16(34, 0, true); // disk number start
    dv.setUint16(36, 0, true); // internal attrs
    dv.setUint32(38, 0, true); // external attrs
    dv.setUint32(42, r.offset, true); // relative offset
    centralParts.push(ch, r.nameBytes);
    offset += 46 + r.nameBytes.length;
  }
  const centralSize = offset - centralStart;

  // End of central directory (22 bytes)
  const eocd = new ArrayBuffer(22);
  const dv = new DataView(eocd);
  dv.setUint32(0, 0x06054b50, true); // signature
  dv.setUint16(4, 0, true); // disk number
  dv.setUint16(6, 0, true); // disk start
  dv.setUint16(8, records.length, true);
  dv.setUint16(10, records.length, true);
  dv.setUint32(12, centralSize, true);
  dv.setUint32(16, centralStart, true);
  dv.setUint16(20, 0, true); // comment length

  const blobParts = [...localParts, ...centralParts, eocd];
  return new Blob(blobParts, { type: "application/zip" });
}

export { zipFiles };
