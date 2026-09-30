export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export function normalizeFingerprint(value) {
  const raw = value.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(raw) || /^0{64}$/.test(raw)) throw new Error('请输入有效的 SHA-256 指纹：64 位十六进制，不能全为零。');
  return '0x' + raw.toLowerCase();
}
export async function hashFile(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('文件超过 50 MiB，请选择较小的文件。');
  if (!globalThis.crypto?.subtle) throw new Error('此浏览器无法计算指纹，请使用 HTTPS 网站或更新浏览器。');
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return '0x' + Array.from(new Uint8Array(digest), byte=>byte.toString(16).padStart(2,'0')).join('');
}
