// Cree le workflow dans le dossier Sandbox via create_workflow_from_code.
const URL = 'https://ludivine0210.app.n8n.cloud/mcp-server/http';
const TOKEN = process.env.N8N_MCP_TOKEN;
const PROJECT = process.env.N8N_PROJECT_ID;
const FOLDER = process.env.N8N_FOLDER_ID;
const { readFileSync } = await import('node:fs');

async function rpc(body, sid) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${TOKEN}`,
  };
  if (sid) headers['Mcp-Session-Id'] = sid;
  const res = await fetch(URL, { method: 'POST', headers, body: JSON.stringify(body) });
  const newSid = res.headers.get('mcp-session-id');
  const raw = await res.text();
  let payload = raw;
  if (raw.includes('data:')) {
    const line = raw.split('\n').find((l) => l.startsWith('data:'));
    if (line) payload = line.slice(5).trim();
  }
  return { data: payload ? JSON.parse(payload) : null, sid: newSid };
}

const code = readFileSync(process.argv[2], 'utf-8');

const init = await rpc({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'deploy', version: '1' } },
});
await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, init.sid);

const args = {
  code,
  name: process.env.N8N_WORKFLOW_NAME || '1er idée de projet',
  versionName: 'Version initiale - assistant Boussole',
  projectId: PROJECT,
};
if (FOLDER) args.folderId = FOLDER;

const r = await rpc({
  jsonrpc: '2.0', id: 2, method: 'tools/call',
  params: { name: 'create_workflow_from_code', arguments: args },
}, init.sid);

const res = r.data?.result;
if (res?.isError) {
  console.log('ERREUR:', JSON.stringify(res.content));
} else if (res?.content?.[0]?.text) {
  console.log(res.content[0].text);
} else {
  console.log(JSON.stringify(res ?? r.data, null, 2).slice(0, 2500));
}
