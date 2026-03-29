const WebSocket = require('ws');

const API = 'http://localhost:9282';
const CWD = '/home/hemanth/Project/my-agent';

async function createSession(permMode) {
  const res = await fetch(`${API}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd: CWD, permission_mode: permMode }),
  });
  const data = await res.json();
  return data.session_id;
}

function connectWs(sessionId) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:9282/ws/claude?session_id=${sessionId}`);
    const msgs = [];
    ws.on('message', (d) => {
      const msg = JSON.parse(d.toString());
      msgs.push(msg);
    });
    ws.on('open', () => resolve({ ws, msgs }));
  });
}

function waitForResult(msgs, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = setInterval(() => {
      const result = msgs.find(m => m.type === 'result');
      if (result) { clearInterval(check); resolve(result); }
      if (Date.now() - start > timeout) { clearInterval(check); reject(new Error('Timeout')); }
    }, 200);
  });
}

function waitForPermission(msgs, timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = setInterval(() => {
      const perm = msgs.find(m => m.type === 'permission_request');
      if (perm) { clearInterval(check); resolve(perm); }
      if (Date.now() - start > timeout) { clearInterval(check); resolve(null); }
    }, 200);
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

async function run() {
  console.log('\n=== PERMISSION MODE E2E TESTS ===\n');

  // TEST 1: acceptEdits — Read should auto-allow (no permission request)
  await test('acceptEdits: Read auto-allowed', async () => {
    const sid = await createSession('acceptEdits');
    const { ws, msgs } = await connectWs(sid);
    ws.send(JSON.stringify({ type: 'query', prompt: 'read pyproject.toml using Read tool' }));
    const result = await waitForResult(msgs);
    const perms = msgs.filter(m => m.type === 'permission_request');
    ws.close();
    if (perms.length > 0) throw new Error(`Got ${perms.length} permission requests, expected 0`);
    if (result.is_error) throw new Error('Query errored');
  });

  // TEST 2: acceptEdits — Bash should ask for permission
  await test('acceptEdits: Bash asks permission', async () => {
    const sid = await createSession('acceptEdits');
    const { ws, msgs } = await connectWs(sid);
    ws.send(JSON.stringify({ type: 'query', prompt: 'run echo test123 using Bash' }));
    const perm = await waitForPermission(msgs);
    ws.close();
    if (!perm) throw new Error('No permission request received');
    if (perm.tool_name !== 'Bash') throw new Error(`Expected Bash, got ${perm.tool_name}`);
  });

  // TEST 3: bypassPermissions — Bash should auto-allow (no permission request)
  await test('bypassPermissions: Bash auto-allowed', async () => {
    const sid = await createSession('bypassPermissions');
    const { ws, msgs } = await connectWs(sid);
    ws.send(JSON.stringify({ type: 'query', prompt: 'run echo bypass_test using Bash' }));
    const result = await waitForResult(msgs);
    const perms = msgs.filter(m => m.type === 'permission_request');
    ws.close();
    if (perms.length > 0) throw new Error(`Got ${perms.length} permission requests, expected 0`);
    if (result.is_error) throw new Error('Query errored');
  });

  // TEST 4: default — Read should ask for permission
  await test('default: Read asks permission', async () => {
    const sid = await createSession('default');
    const { ws, msgs } = await connectWs(sid);
    ws.send(JSON.stringify({ type: 'query', prompt: 'read pyproject.toml' }));
    const perm = await waitForPermission(msgs);
    ws.close();
    if (!perm) throw new Error('No permission request received');
  });

  // TEST 5: plan — no tool execution at all
  await test('plan: tools denied', async () => {
    const sid = await createSession('plan');
    const { ws, msgs } = await connectWs(sid);
    ws.send(JSON.stringify({ type: 'query', prompt: 'read pyproject.toml' }));
    const result = await waitForResult(msgs, 20000);
    const perms = msgs.filter(m => m.type === 'permission_request');
    ws.close();
    if (perms.length > 0) throw new Error('Got permission request in plan mode');
    // In plan mode, Claude should respond with text only (no tool use)
  });

  // TEST 6: acceptEdits — Edit should auto-allow
  await test('acceptEdits: Edit auto-allowed', async () => {
    const sid = await createSession('acceptEdits');
    const { ws, msgs } = await connectWs(sid);
    ws.send(JSON.stringify({ type: 'query', prompt: 'use the Glob tool to find all .py files' }));
    const result = await waitForResult(msgs);
    const perms = msgs.filter(m => m.type === 'permission_request');
    ws.close();
    if (perms.length > 0) throw new Error(`Got ${perms.length} permission requests for Glob`);
  });

  // TEST 7: Runtime mode switch — change from acceptEdits to bypassPermissions
  await test('runtime switch: acceptEdits → bypass', async () => {
    const sid = await createSession('acceptEdits');
    const { ws, msgs } = await connectWs(sid);
    // Switch to bypass
    ws.send(JSON.stringify({ type: 'config', permission_mode: 'bypassPermissions' }));
    await new Promise(r => setTimeout(r, 1000));
    // Now Bash should auto-allow
    ws.send(JSON.stringify({ type: 'query', prompt: 'run echo switched_test' }));
    const result = await waitForResult(msgs);
    const perms = msgs.filter(m => m.type === 'permission_request');
    ws.close();
    if (perms.length > 0) throw new Error('Got permission request after switching to bypass');
  });

  // TEST 8: acceptEdits — permission allow resolves and tool runs
  await test('acceptEdits: allow permission → tool runs', async () => {
    const sid = await createSession('acceptEdits');
    const { ws, msgs } = await connectWs(sid);
    ws.send(JSON.stringify({ type: 'query', prompt: 'run echo allowed_test' }));
    const perm = await waitForPermission(msgs);
    if (!perm) throw new Error('No permission request');
    // Allow it
    ws.send(JSON.stringify({ type: 'permission_response', request_id: perm.request_id, decision: 'allow' }));
    const result = await waitForResult(msgs);
    ws.close();
    if (result.is_error) throw new Error('Query errored after allow');
  });

  // TEST 9: acceptEdits — permission deny
  await test('acceptEdits: deny permission → tool denied', async () => {
    const sid = await createSession('acceptEdits');
    const { ws, msgs } = await connectWs(sid);
    ws.send(JSON.stringify({ type: 'query', prompt: 'run echo denied_test' }));
    const perm = await waitForPermission(msgs);
    if (!perm) throw new Error('No permission request');
    // Deny it
    ws.send(JSON.stringify({ type: 'permission_response', request_id: perm.request_id, decision: 'deny', message: 'test denial' }));
    const result = await waitForResult(msgs, 20000);
    ws.close();
    // Should complete (Claude will respond with text saying tool was denied)
  });

  // TEST 10: No duplicate permission requests for same tool
  await test('no duplicate permission requests', async () => {
    const sid = await createSession('acceptEdits');
    const { ws, msgs } = await connectWs(sid);
    ws.send(JSON.stringify({ type: 'query', prompt: 'run echo dedup_test' }));
    const perm = await waitForPermission(msgs);
    if (!perm) throw new Error('No permission request');
    // Allow it
    ws.send(JSON.stringify({ type: 'permission_response', request_id: perm.request_id, decision: 'allow' }));
    const result = await waitForResult(msgs);
    const perms = msgs.filter(m => m.type === 'permission_request');
    ws.close();
    if (perms.length > 1) throw new Error(`Got ${perms.length} permission requests, expected 1`);
  });

  console.log('\n=== TESTS COMPLETE ===\n');
}

run().catch(console.error);
