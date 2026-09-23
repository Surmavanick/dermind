/**
 * Minimal ZIP reader (no dependencies) for capture uploads from tablets whose
 * file pickers cannot select custom extensions like `.spectrum`.
 * Supports stored (0) and deflated (8) entries; deflate uses the browser's
 * DecompressionStream. Zip64 and encrypted archives are not supported.
 */

export interface ZipEntry {
  name: string;
  data: ArrayBuffer;
}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

export const isZipFile = (file: File) =>
  /\.zip$/i.test(file.name) || file.type === "application/zip" || file.type === "application/x-zip-compressed";

const inflateRaw = async (bytes: Uint8Array): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot unpack compressed .zip files. Use an uncompressed zip or the .spectrum file directly.");
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).arrayBuffer();
};

export const readZipEntries = async (file: File): Promise<ZipEntry[]> => {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const decoder = new TextDecoder();

  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i -= 1) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .zip file.");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let k = 0; k < count; k += 1) {
    if (offset + 46 > buf.length || view.getUint32(offset, true) !== SIG_CENTRAL) throw new Error("Corrupt .zip central directory.");
    const method = view.getUint16(offset + 10, true);
    const compSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(buf.subarray(offset + 46, offset + 46 + nameLen));
    offset += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;

    if (localOffset + 30 > buf.length || view.getUint32(localOffset, true) !== SIG_LOCAL) throw new Error("Corrupt .zip entry.");
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(start, start + compSize);

    let data: ArrayBuffer;
    if (method === 0) data = raw.slice().buffer;
    else if (method === 8) data = await inflateRaw(raw);
    else throw new Error(`Unsupported .zip compression (method ${method}).`);
    entries.push({ name, data });
  }
  return entries;
};
