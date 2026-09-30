// Cree les Data Tables du projet Boussole sur l'instance n8n via MCP.
const URL = 'https://ludivine0210.app.n8n.cloud/mcp-server/http';
const TOKEN = process.env.N8N_MCP_TOKEN;
const PROJECT = '5Q6x01ZD8zQs3ehO';

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

const init = await rpc({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'setup', version: '1' } },
});
await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, init.sid);

async function tool(name, args) {
  const r = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }, init.sid);
  const res = r.data?.result;
  if (res?.isError) throw new Error(name + ' : ' + JSON.stringify(res.content));
  return res?.structuredContent ?? res?.content?.[0]?.text;
}

const TABLES = [
  { name: 'boussole_quotidien', columns: [
      { name: 'date', type: 'date' }, { name: 'moment', type: 'string' },
      { name: 'energie', type: 'number' }, { name: 'sommeil_h', type: 'number' },
      { name: 'stress', type: 'number' }, { name: 'objectif', type: 'string' },
      { name: 'bilan', type: 'string' }, { name: 'activite', type: 'string' }] },
  { name: 'boussole_etat', columns: [
      { name: 'etat_id', type: 'string' }, { name: 'session', type: 'string' },
      { name: 'etape', type: 'string' }, { name: 'moment', type: 'string' },
      { name: 'energie', type: 'number' }, { name: 'sommeil_h', type: 'number' },
      { name: 'stress', type: 'number' }, { name: 'texte', type: 'string' },
      { name: 'maj', type: 'date' }] },
  { name: 'boussole_conversations', columns: [
      { name: 'ts', type: 'date' }, { name: 'session', type: 'string' },
      { name: 'role', type: 'string' }, { name: 'contenu', type: 'string' }] },
  { name: 'boussole_bilans', columns: [
      { name: 'periode', type: 'string' }, { name: 'debut', type: 'date' },
      { name: 'fin', type: 'date' }, { name: 'contenu', type: 'string' },
      { name: 'ts', type: 'date' }] },
];

for (const t of TABLES) {
  try {
    const r = await tool('create_data_table', { projectId: PROJECT, name: t.name, columns: t.columns });
    console.log('OK  ', t.name, '->', r?.dataTable?.id || r?.id || JSON.stringify(r).slice(0, 80));
  } catch (e) {
    console.log('ECHEC', t.name, ':', e.message);
  }
}
