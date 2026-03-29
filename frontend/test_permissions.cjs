const WebSocket = require('ws');
const http = require('http');
const API = 'http://localhost:9282';
const CWD = '/home/hemanth/Project/my-agent';

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const data = JSON.stringify(body);
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let buf = ''; res.on('data', c => buf += c); res.on('end', () => resolve(JSON.parse(buf)));
    }); req.on('error', reject); req.write(data); req.end();
  });
}
async function createSession(permMode) {
  return (await httpPost('/api/sessions', { cwd: CWD, permission_mode: permMode })).session_id;
}
function connectWs(sid) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:9282/ws/claude?session_id=${sid}`);
    const msgs = [];
    ws.on('message', d => msgs.push(JSON.parse(d.toString())));
    ws.on('open', () => resolve({ ws, msgs }));
    ws.on('error', reject);
  });
}
function waitFor(msgs, pred, timeout = 20000) {
  return new Promise(resolve => {
    const start = Date.now();
    const iv = setInterval(() => {
      const f = msgs.find(pred);
      if (f) { clearInterval(iv); resolve(f); }
      if (Date.now() - start > timeout) { clearInterval(iv); resolve(null); }
    }, 200);
  });
}
let passed = 0, failed = 0;
async function test(name, fn) {
  process.stdout.write(`  ⏳ ${name}...`);
  try { await fn(); passed++; process.stdout.write(`\r  ✅ ${name}                                                        \n`); }
  catch (e) { failed++; process.stdout.write(`\r  ❌ ${name}: ${e.message}                              \n`); }
}

async function run() {
  console.log('\n=== PERSISTENCE & AUTONOMY TESTS ===\n');

  // 1. bypassPermissions persists across multiple queries in same session
  await test('bypass: persists across 3 queries (autonomous)', async () => {
    const sid = await createSession('bypassPermissions');
    const { ws, msgs } = await connectWs(sid);

    // Query 1: safe bash
    ws.send(JSON.stringify({ type: 'query', prompt: 'run echo q1' }));
    await waitFor(msgs, m => m.type === 'result');

    // Query 2: file read
    ws.send(JSON.stringify({ type: 'query', prompt: 'read pyproject.toml' }));
    await waitFor(msgs, m => m.type === 'result' && msgs.filter(x => x.type === 'result').length >= 2, 20000);

    // Query 3: dangerous bash
    ws.send(JSON.stringify({ type: 'query', prompt: 'run: mkdir -p /tmp/test_persist && rm -rf /tmp/test_persist' }));
    await waitFor(msgs, m => m.type === 'result' && msgs.filter(x => x.type === 'result').length >= 3, 20000);

    const perms = msgs.filter(m => m.type === 'permission_request');
    ws.close();
    if (perms.length > 0) throw new Error(`Got ${perms.length} permission requests — bypass should be fully autonomous`);
  });

  // 2. "allow_always" from permission card switches to bypass for session
  await test('allow_always: switches session to bypass', async () => {
    const sid = await createSession('acceptEdits');
    const { ws, msgs } = await connectWs(sid);

    // First query: dangerous bash triggers permission
    ws.send(JSON.stringify({ type: 'query', prompt: 'run: rm -rf /tmp/test_always_1' }));
    const perm = await waitFor(msgs, m => m.type === 'permission_request');
    if (!perm) throw new Error('No permission request on first dangerous cmd');

    // Respond with allow_always
    ws.send(JSON.stringify({ type: 'permission_response', request_id: perm.request_id, decision: 'allow_always' }));
    await waitFor(msgs, m => m.type === 'result');

    // Second query: another dangerous bash — should NOT ask anymore
    ws.send(JSON.stringify({ type: 'query', prompt: 'run: rm -rf /tmp/test_always_2' }));
    await waitFor(msgs, m => m.type === 'result' && msgs.filter(x => x.type === 'result').length >= 2, 20000);

    const perms = msgs.filter(m => m.type === 'permission_request');
    ws.close();
    if (perms.length > 1) throw new Error(`Got ${perms.length} perm requests — allow_always should bypass rest`);
  });

  // 3. "allow_session" from permission card switches to acceptEdits
  await test('allow_session: switches to acceptEdits', async () => {
    const sid = await createSession('default');
    const { ws, msgs } = await connectWs(sid);

    // In default mode, even Read asks permission
    ws.send(JSON.stringify({ type: 'query', prompt: 'read pyproject.toml' }));
    const perm = await waitFor(msgs, m => m.type === 'permission_request');
    if (!perm) throw new Error('No perm request in default mode');

    // Accept edits for session
    ws.send(JSON.stringify({ type: 'permission_response', request_id: perm.request_id, decision: 'allow_session' }));
    await waitFor(msgs, m => m.type === 'result');

    // Now Read should auto-allow (acceptEdits mode)
    ws.send(JSON.stringify({ type: 'query', prompt: 'use Glob to find *.toml' }));
    await waitFor(msgs, m => m.type === 'result' && msgs.filter(x => x.type === 'result').length >= 2, 20000);

    const permsAfter = msgs.filter(m => m.type === 'permission_request').length;
    ws.close();
    // Should only have 1 perm request (the first Read), not the second Glob
    if (permsAfter > 1) throw new Error(`Got ${permsAfter} perm requests — Glob should auto-allow after allow_session`);
  });

  // 4. Disconnect and reconnect — permission mode persists in DB
  await test('permission mode persists across reconnect', async () => {
    const sid = await createSession('bypassPermissions');
    const conn1 = await connectWs(sid);
    // Wait for session_info
    await waitFor(conn1.msgs, m => m.type === 'session_info');
    conn1.ws.close();

    // Reconnect
    await new Promise(r => setTimeout(r, 1000));
    const conn2 = await connectWs(sid);
    const info = await waitFor(conn2.msgs, m => m.type === 'session_info');
    conn2.ws.close();
    if (!info) throw new Error('No session_info on reconnect');
    if (info.config?.permission_mode !== 'bypassPermissions') {
      throw new Error(`Mode is ${info.config?.permission_mode}, expected bypassPermissions`);
    }
  });

  // 5. Runtime switch persists for subsequent queries
  await test('runtime switch persists for all subsequent queries', async () => {
    const sid = await createSession('acceptEdits');
    const { ws, msgs } = await connectWs(sid);

    // Switch to bypass
    ws.send(JSON.stringify({ type: 'config', permission_mode: 'bypassPermissions' }));
    await new Promise(r => setTimeout(r, 500));

    // Multiple dangerous commands — all should auto-allow
    ws.send(JSON.stringify({ type: 'query', prompt: 'run: rm -rf /tmp/switch_test_1 && echo done1' }));
    await waitFor(msgs, m => m.type === 'result');

    ws.send(JSON.stringify({ type: 'query', prompt: 'run: rm -rf /tmp/switch_test_2 && echo done2' }));
    await waitFor(msgs, m => m.type === 'result' && msgs.filter(x => x.type === 'result').length >= 2, 20000);

    const perms = msgs.filter(m => m.type === 'permission_request');
    ws.close();
    if (perms.length > 0) throw new Error(`Got ${perms.length} perm requests after runtime bypass switch`);
  });

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
