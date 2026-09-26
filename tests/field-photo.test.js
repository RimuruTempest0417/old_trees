/**
 * 實地考察照片上傳（/api/photo → Supabase Storage）與結構化欄位的寫入形狀。
 *
 * 為什麼要攔截 fetch 而不是真的上傳：線上事故（.env.example 外洩、Storage bucket
 * 不存在導致「以為上傳成功」）都是發生在「送出的請求形狀」這一層，本機示範模式
 * 不會重現。這裡直接驗證：請求送到哪個 URL、帶什麼標頭、body 是不是真的圖片位元組、
 * 失敗時回什麼訊息（而且訊息要能指出下一步要做什麼）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key-not-real';

const repo = await import('../lib/repo.js');

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

/** 一張 1×1 的 JPEG（最小可用圖檔），base64 之後非常短 */
const TINY_JPEG_B64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/E'
  + 'ABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const TINY_JPEG = `data:image/jpeg;base64,${TINY_JPEG_B64}`;

function stub(handler) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body };
    calls.push(call);
    return handler(call);
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('測試前提：這支測試確實跑在 Supabase 模式', () => {
  assert.equal(repo.DATA_SOURCE, 'supabase');
});

test('uploadFieldPhoto() 把照片送到 Storage 的正確路徑，並回公開網址', async () => {
  const { calls, restore } = stub(() => json({ Key: 'field-photos/x.jpg' }));
  try {
    const saved = await repo.uploadFieldPhoto({ dataUrl: TINY_JPEG, treeNo: '1060' });
    const call = calls.find((c) => c.url.includes('/storage/v1/object/'));
    assert.ok(call, `沒有發出 Storage 上傳請求，實際：${calls.map((c) => c.url).join(' | ')}`);
    assert.equal(call.method, 'POST');
    assert.ok(call.url.startsWith('https://example.supabase.co/storage/v1/object/field-photos/'),
      `上傳路徑應在 field-photos bucket 內，實際：${call.url}`);
    assert.equal(call.headers['Content-Type'], 'image/jpeg');
    assert.ok(String(call.headers.Authorization || '').startsWith('Bearer '),
      'Storage 上傳必須帶 service_role 授權（否則 bucket 非公開寫入會失敗）');
    assert.equal(call.headers['x-upsert'], 'false', '不得覆寫既有照片');
    assert.ok(call.body instanceof Uint8Array || Buffer.isBuffer(call.body), 'body 要是圖片位元組');

    // 路徑形狀：日期／樹號-時間-隨機.jpg（樹號只留安全字元）
    assert.match(saved.path, /^\d{4}-\d{2}-\d{2}\/1060-[a-z0-9]+-[a-z0-9]+\.jpg$/);
    assert.equal(saved.stored, true);
    assert.equal(saved.url, `https://example.supabase.co/storage/v1/object/public/field-photos/${saved.path}`);
    assert.ok(saved.bytes > 0);
  } finally {
    restore();
  }
});

test('uploadFieldPhoto() 擋掉非圖片的 data URL、過大的檔案，並在 bucket 不存在時給出可行指示', async () => {
  const { restore } = stub(() => json({}));
  try {
    await assert.rejects(() => repo.uploadFieldPhoto({ dataUrl: 'https://evil.example/x.jpg' }),
      /data URL/, '外部網址不得當成上傳內容');
    await assert.rejects(() => repo.uploadFieldPhoto({ dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' }),
      /JPEG／PNG／WebP|data URL/, '只接受圖片型別');
    // 4,194,312 個 base64 字元 → 解碼後 3,145,734 位元組，剛好超過 3 MB 上限
    await assert.rejects(() => repo.uploadFieldPhoto({ dataUrl: `data:image/jpeg;base64,${'A'.repeat(4 * 1024 * 1024 + 8)}` }),
      (err) => /照片過大/.test(err.message) && err.status === 413, '過大的照片要回 413 並說清楚');
  } finally {
    restore();
  }

  // bucket 不存在（使用者還沒重跑 init.sql）→ 訊息必須指出要重跑 init.sql，而不是含糊的 500
  const { restore: restore2 } = stub(() => new Response('{"message":"Bucket not found"}', { status: 404 }));
  try {
    await assert.rejects(() => repo.uploadFieldPhoto({ dataUrl: TINY_JPEG }),
      (err) => {
        assert.equal(err.status, 503);
        assert.match(err.message, /儲存空間（field-photos）還不存在/);
        assert.match(JSON.stringify(err.hint || err), /init\.sql/, '要告訴使用者下一步：重跑 init.sql');
        return true;
      });
  } finally {
    restore2();
  }
});

test('insertFieldRecord() 送出的內容包含結構化欄位，且照片路徑已清洗', async () => {
  const { calls, restore } = stub((call) => {
    if (call.url.includes('/rest/v1/field_records') && call.method === 'POST') {
      return json([{ id: 1, ...JSON.parse(call.body) }]);
    }
    return json([]);
  });
  try {
    const { record, errors } = repo.normalizeFieldRecord({
      tree_no: '1060',
      observer: '高三甲 12 號',
      health: '一般',
      bark_conditions: ['剝落', '黴斑'],
      surround_items: ['鄰近馬路', '排水口'],
      concrete_cover: '約一半',
      photo_paths: ['2026-09-26/1060-abc.jpg', '../etc/passwd', '/abs/x.jpg', 'https://evil.example/x.jpg'],
      photo_url: 'https://photos.example/ok.jpg',
    });
    assert.deepEqual(errors, [], `驗證不該出錯：${errors.join('／')}`);
    // 與 /api/field-records 的實際流程一致：先驗證正規化，再寫入
    const rec = await repo.insertFieldRecord(record);
    const call = calls.find((c) => c.url.includes('/rest/v1/field_records') && c.method === 'POST');
    const sent = JSON.parse(call.body);
    assert.deepEqual(sent.bark_conditions, ['剝落', '黴斑']);
    assert.deepEqual(sent.surround_items, ['鄰近馬路', '排水口']);
    assert.equal(sent.concrete_cover, '約一半');
    assert.deepEqual(sent.photo_paths, ['2026-09-26/1060-abc.jpg'],
      '只留安全的相對路徑（不得寫進 ../、絕對路徑或外部網址）');
    assert.equal(sent.photo_url, 'https://photos.example/ok.jpg');
    // 回傳值附上可直接顯示的公開網址
    assert.deepEqual(rec.photo_urls,
      ['https://example.supabase.co/storage/v1/object/public/field-photos/2026-09-26/1060-abc.jpg']);
  } finally {
    restore();
  }
});

test('結構化欄位驗證：非法值回 400 並列出允許值；合法值原樣保留', () => {
  const bad = repo.normalizeFieldRecord({ observer: '甲', bark_conditions: ['樹皮爛掉'], surround_items: ['海邊'] });
  assert.ok(bad.errors.length >= 2, `應回報非法值，實際：${JSON.stringify(bad.errors)}`);
  assert.ok(bad.errors.some((e) => /樹皮狀況只接受/.test(e) && /白色鹽類結晶/.test(e)));
  assert.ok(bad.errors.some((e) => /周邊環境只接受/.test(e) && /排水口/.test(e)));

  const badCover = repo.normalizeFieldRecord({ observer: '甲', concrete_cover: '很多' });
  assert.ok(badCover.errors.some((e) => /水泥覆蓋範圍只接受/.test(e)));

  const good = repo.normalizeFieldRecord({
    observer: '甲',
    bark_conditions: ['黴斑', '黴斑', '白色鹽類結晶'],
    surround_items: ['鄰近建築物', '水泥覆蓋'],
    concrete_cover: '幾乎全部覆蓋',
  });
  assert.deepEqual(good.errors, []);
  assert.deepEqual(good.record.bark_conditions, ['黴斑', '白色鹽類結晶'], '重複值要去掉');
  assert.deepEqual(good.record.surround_items, ['鄰近建築物', '水泥覆蓋']);
  assert.equal(good.record.concrete_cover, '幾乎全部覆蓋');
  // 逗號字串（例如 CSV 匯入）也要能接受
  const csv = repo.normalizeFieldRecord({ observer: '甲', bark_conditions: '剝落、黴斑' });
  assert.deepEqual(csv.record.bark_conditions, ['剝落', '黴斑']);
});

test('listFieldRecords() 會把 photo_paths 轉成可顯示的公開網址', async () => {
  const { restore } = stub((call) => {
    if (call.url.includes('/rest/v1/field_records')) {
      return json([{ id: 1, tree_no: '1060', photo_paths: ['2026-09-26/a.jpg', '2026-09-26/b.jpg'] },
        { id: 2, tree_no: '1061', photo_paths: [] }]);
    }
    return json([]);
  });
  try {
    const rows = await repo.listFieldRecords(10);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].photo_urls.length, 2);
    assert.equal(rows[0].photo_urls[0],
      'https://example.supabase.co/storage/v1/object/public/field-photos/2026-09-26/a.jpg');
    assert.deepEqual(rows[1].photo_urls, []);
  } finally {
    restore();
  }
});
