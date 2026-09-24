#!/usr/bin/env node
/**
 * 本機開發伺服器 —— 模擬 Vercel 的靜態檔案 + Serverless Functions 行為。
 *
 *   node scripts/dev-server.mjs [port]
 *
 * 靜態檔案： public/  →  /
 * 函式：     api/x.js  →  /api/x
 * 動態路由： api/tree/[tree_no].js → /api/tree/:tree_no
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  '.map': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

/** 掃描 api/ 目錄，建立路由表 */
function buildRoutes(dir = API, prefix = '/api') {
  const routes = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...buildRoutes(full, `${prefix}/${entry.name}`));
    } else if (entry.name.endsWith('.js')) {
      const base = entry.name.replace(/\.js$/, '');
      const name = base === 'index' ? '' : base;
      routes.push({ pattern: `${prefix}/${name}`.replace(/\/$/, ''), file: full, kind: 'exact' });
    }
  }
  // 動態路由：[param].js
  const exact = routes.filter((r) => !/\[[^\]]+\]/.test(r.pattern));
  const dyn = [];
  for (const r of routes) {
    const last = r.pattern.split('/').pop();
    if (last && last.startsWith('[') && last.endsWith(']')) {
      dyn.push({
        ...r, kind: 'dynamic', param: last.slice(1, -1),
        regex: new RegExp(`^${r.pattern.replace(/\[[^\]]+\]/, '([^/]+)')}$`),
      });
    }
  }
  return [...exact, ...dyn];
}

const ROUTES = buildRoutes();
const cache = new Map();

async function loadHandler(file) {
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

  const route = ROUTES.find((r) => (r.kind === 'dynamic' ? r.regex.test(pathname) : r.pattern === pathname));
  if (!route) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: `找不到 API 路由 ${pathname}` }));
  }
  // 收集 body
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  req.body = raw && raw.trim().startsWith('{') ? raw : undefined;

  if (route.kind === 'dynamic') {
    const m = pathname.match(route.regex);
    req.query = { ...(req.query || {}), [route.param]: decodeURIComponent(m[1]) };
  } else {
    req.query = req.query || {};
  }
  try {
    const fn = await loadHandler(route.file);
    await fn(req, res);
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
  console.log(`已掛載 ${ROUTES.length} 個 API 路由：`);
  for (const r of ROUTES) console.log('  ', r.pattern);
});
