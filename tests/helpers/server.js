/** 測試用輔助：啟動本機開發伺服器（模擬 Vercel Functions）並提供 fetch 工具。 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

export async function startServer(port) {
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'dev-server.mjs'), String(port)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d.toString(); });
  child.stderr.on('data', (d) => { out += d.toString(); });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return { child, base, log: () => out };
    } catch { /* 尚未啟動 */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill('SIGKILL');
  throw new Error(`開發伺服器未能在時限內啟動：\n${out}`);
}

export function stopServer(child) {
  if (child && !child.killed) child.kill('SIGKILL');
}

export async function get(base, pathAndQuery, init) {
  const res = await fetch(base + pathAndQuery, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 回應 */ }
  return { status: res.status, headers: res.headers, text, json };
}
