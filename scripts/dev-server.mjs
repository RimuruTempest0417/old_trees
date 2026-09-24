#!/usr/bin/env node
/**
 * 本機開發伺服器 —— 模擬 Vercel 的靜態檔案 + Serverless Functions 行為。
 *
 *   node scripts/dev-server.mjs [port]
 *
 * 靜態檔案： public/  →  /
 * 函式：     lib/routes/x.js → /api/x（由 lib/router.js 分派，與 Vercel 上線後同一套）
 * 動態路由： /api/tree/:tree_no
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as ROUTER from '../lib/router.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');
const API = path.join(ROOT, 'api');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

/**
 * 掃描 lib/routes/ 目錄，建立熱重載用的檔案對照表。
 * 路由「比對」交給 lib/router.js（與 Vercel 上線後同一套），這裡只負責找到檔案，
 * 並以 mtime 做快取破壞，讓修改 handler 後不必重啟伺服器。
 */
function buildFiles(dir, prefix = '') {
  const out = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(out, buildFiles(full, `${prefix}${entry.name}/`));
    else if (entry.name.endsWith('.js')) out[`${prefix}${entry.name.replace(/\.js$/, '')}`] = full;
  }
  return out;
}

const ROUTE_FILES = buildFiles(path.join(ROOT, 'lib', 'routes'));
const ROUTES = ROUTER.ROUTES;
const cache = new Map();

async function loadHandler(id) {
  const file = ROUTE_FILES[id];
  if (!file) throw new Error(`找不到路由檔 lib/routes/${id}.js`);
  const key = file + ':' + fs.statSync(file).mtimeMs;
  if (cache.has(key)) return cache.get(key);
  const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
  const fn = mod.default;
  if (typeof fn !== 'function') throw new Error(`${file} 沒有 default export 函式`);
  cache.set(key, fn);
  return fn;
}

function serveStatic(req, res, pathname) {
  // 路徑安全：拒絕目錄跳脫與空位元組
  if (pathname.includes('\0') || pathname.split('/').includes('..') || pathname.includes('\\')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: '請求路徑不合法' }));
  }
  let filePath = path.join(PUBLIC, decodeURIComponent(pathname));
  if (!filePath.startsWith(PUBLIC + path.sep) && filePath !== PUBLIC) {
    res.statusCode = 403;
    return res.end('403');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    const html = `${filePath}.html`;
    if (fs.existsSync(html)) filePath = html;
  }
  if (!fs.existsSync(filePath)) {
    // 本專案使用雜湊路由（#/map），不需要以路徑為基礎的單頁回退；
    // 任何不存在的檔案一律 404，避免把不存在的路徑誤判為前端路由。
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('404 Not Found');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname === '/' ? '/index.html' : pathname);

  const match = ROUTER.matchRoute(pathname, url.search);
  if (!match) return ROUTER.notFound(res, pathname);
  // 收集 body
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  req.body = raw && raw.trim().startsWith('{') ? raw : undefined;

  req.query = { ...(req.query || {}), ...match.params };
  try {
    const fn = await loadHandler(match.id);
    await ROUTER.dispatch(req, res, pathname, { handler: fn });
  } catch (err) {
    console.error('[dev-server]', err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`古樹保育平台 開發伺服器： http://localhost:${PORT}`);
  console.log(`已掛載 ${ROUTES.length} 個 API 路由（由 lib/router.js 分派，與線上一致）：`);
  for (const r of ROUTES) console.log('  ', r.path);
  console.log('（Vercel 上只有一個 Serverless Function：api/[[...route]].js）');
});
