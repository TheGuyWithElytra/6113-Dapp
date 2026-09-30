export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export function normalizeFingerprint(value) {
  const raw = value.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(raw) || /^0{64}$/.test(raw)) throw new Error('Enter a valid SHA-256 fingerprint: 64 hexadecimal characters, not all zeros.');
  return '0x' + raw.toLowerCase();
}
export async function hashFile(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('This file exceeds 50 MiB. Please select a smaller file.');
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot compute fingerprints. Use HTTPS or update your browser.');
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return '0x' + Array.from(new Uint8Array(digest), byte=>byte.toString(16).padStart(2,'0')).join('');
}
