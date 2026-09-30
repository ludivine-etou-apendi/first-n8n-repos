"""Workflow Boussole - version SANS noeuds Data Table.

Les noeuds dataTable Seems to be the culprit for the editor crash. This version
replaces them with plain HTTP Request nodes calling the n8n REST Data Table API:
  GET    /api/v1/data-tables/{tableId}/rows
  POST   /api/v1/data-tables/{tableId}/rows
  PUT    /api/v1/data-tables/{tableId}/rows  (upsert)
The HTTP nodes use the n8n API key via {{$vars.N8N_API_KEY}}.

IDs des tables creees precedemment sur l'instance :
  boussole_etat         P7G27SLdIWYRTSXn
  boussole_quotidien    b52lE6aeplzD3ifn
  boussole_conversations zpmCJfqEfW6mK9IT
"""
import json

SYSTEM = (
    "Tu es Boussole, un assistant bienveillant qui aide a suivre sa routine, son energie et son equilibre de vie.\n\n"
    "REGLE ABSOLUE : tu ne poses AUCUN diagnostic medical et tu n'utilises jamais de vocabulaire medical. "
    "Si l'utilisateur parle de sante, recentre sur des pistes generales (repos, hydratation, mouvement, respiration) "
    "et invite-le a consulter un professionnel.\n\n"
    "Tu reponds UNIQUEMENT avec un objet JSON valide :\n"
    '  "message"        : 2 phrases, ton chaleureux.\n'
    '  "recommandations" : tableau de 2 a 3 chaines courtes, actions concretes.\n'
    '  "alerte"          : chaine vide, ou phrase si sommeil < 5h ou stress >= 4 ou energie <= 2.'
)

T_ETAT = "P7G27SLdIWYRTSXn"
T_JOUR = "b52lE6aeplzD3ifn"
T_CONV = "zpmCJfqEfW6mK9IT"
BASE = "https://ludivine0210.app.n8n.cloud/api/v1/data-tables"
AUTH = "=Bearer {{ $vars.N8N_API_KEY }}"


def n(name, type_, pos, params, nid, tv, **kw):
    d = {"parameters": params, "id": nid, "name": name, "type": type_,
         "typeVersion": tv, "position": pos}
    d.update(kw)
    return d


def http_rows(table, method, body_expr=None, pos=(0, 0), nid="h", name="HTTP"):
    """Appel REST sur les lignes d'une Data Table."""
    url = f"{BASE}/{table}/rows"
    params = {
        "method": method,
        "url": url,
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "X-N8N-API-KEY", "value": AUTH}]},
        "options": {},
    }
    if body_expr is not None:
        params.update({"sendBody": True, "contentType": "raw",
                       "rawContentType": "application/json",
                       "body": body_expr})
    return n(name, "n8n-nodes-base.httpRequest", pos, params, nid, 4.5,
             onError="continueRegularOutput")


def mistral_body(prompt_field):
    body = {
        "model": "mistral-small-latest", "temperature": 0.4, "max_tokens": 400,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": "={{ " + prompt_field + " }}"}],
    }
    return "={{ JSON.stringify(" + json.dumps(body) + ") }}"


INIT_JS = r"""
const items = $input.all();
return items.map((it) => {
  const j = it.json || {};
  const texte = (j.chatInput !== undefined ? j.chatInput : (j.text || '')) || '';
  return { json: { texte: String(texte).trim(), session: j.sessionId || 'default' }};
});
"""

LIT_JS = r"""
const head = $json;
let etat = {
  session: head.session, etat_id: head.session, etape: 'attente',
  moment: null, energie: null, sommeil_h: null, stress: null, texte: '',
};
// Si le GET a renvoye une ligne, on fusionne (la reponse est { data: [...] })
const d = head.data;
if (Array.isArray(d) && d.length) Object.assign(etat, d[0]);
else if (head.etape !== undefined) Object.assign(etat, head);
etat.session = head.session;
etat.entree = head.texte;
return [{ json: etat }];
"""

ROUTE_JS = r"""
const e = $json;
const msg = (e.entree || '').trim();
const cmd = msg.split(/\s+/)[0].toLowerCase();
if (cmd === '/matin' || cmd === '/soir') {
  const reste = msg.slice(cmd.length).trim();
  if (reste && /\d/.test(reste)) {
    return [{ json: Object.assign({}, e, { mode: 'ligne', ligne: reste,
      moment: cmd === '/soir' ? 'soir' : 'matin', etape: 'attente',
      energie: null, sommeil_h: null, stress: null, texte: '' })}];
  }
  return [{ json: Object.assign({}, e, { mode: 'demarre', etape: 'energie',
    moment: cmd === '/soir' ? 'soir' : 'matin',
    energie: null, sommeil_h: null, stress: null, texte: reste || '' })}];
}
if (e.etape && e.etape !== 'attente') return [{ json: Object.assign({}, e, { mode: 'reponse' })}];
return [{ json: Object.assign({}, e, { mode: 'chat' })}];
"""

APPLY_JS = r"""
const e = $json;
const msg = (e.entree || '').trim();
function sauver() { e.etat_id = e.session; e.maj = new Date().toISOString(); return e; }
if (e.mode === 'ligne') return [{ json: Object.assign(sauver(), { termine: true })}];
if (e.mode === 'chat') { e.etape = 'attente'; return [{ json: Object.assign(sauver(), { termine: true, message_libre: msg })}]; }
if (e.mode === 'demarre') return [{ json: Object.assign(sauver(), { termine: false })}];
let refus = false;
if (e.etape === 'energie' || e.etape === 'stress') {
  const v = parseInt(msg.replace(/[^\d]/g, ''), 10);
  if (v >= 1 && v <= 5) e[e.etape] = v; else refus = true;
} else if (e.etape === 'sommeil') {
  const m = msg.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*h(?:eures|eu)?\s*(\d{1,2})?/);
  let v = m ? parseFloat(m[1].replace(',', '.')) + (m[2] ? parseInt(m[2], 10) / 60 : 0)
            : parseFloat(msg.replace(',', '.').replace(/[^\d.]/g, ''));
  if (Number.isFinite(v) && v > 0 && v <= 24) e.sommeil_h = Math.round(v * 10) / 10; else refus = true;
} else if (e.etape === 'texte') { e.texte = msg; }
if (refus) return [{ json: Object.assign(sauver(), { termine: false, valeur_refusee: true })}];
const ORDRE = { energie: 'sommeil', sommeil: 'stress', stress: 'texte', texte: null };
e.etape = ORDRE[e.etape];
const termine = e.etape === null;
if (termine) { e.etape = 'attente'; e.moment = null; }
return [{ json: Object.assign(sauver(), { termine }) }];
"""

UI_JS = r"""
const e = $json;
const tete = e.moment === 'soir' ? '🌙 *Boussole — bilan du soir*' : '☀️ *Boussole — point du matin*';
if (e.termine) return [{ json: Object.assign({}, e, { reponse: '' })}];
let q = '';
if (e.etape === 'energie') q = 'Comment est ton ' + (e.moment === 'soir' ? 'énergie ce soir ?' : 'énergie ce matin ?') + '\nRéponds par un chiffre de 1 (épuisé) à 5 (au top).';
else if (e.etape === 'sommeil') q = 'Tu as dormi combien de cette nuit ?\nRéponds en heures, par exemple « 7h » ou « 5h30 ».';
else if (e.etape === 'stress') q = 'Quel est ton niveau de stress ?\nRéponds par un chiffre de 1 (zen) à 5 (débordé).';
else if (e.etape === 'texte') q = e.moment === 'soir' ? 'Comment s’est passée ta journée ?' : 'Quel est ton objectif du jour ?';
if (e.valeur_refusee) q = '⚠️ Je n’ai pas compris, il me faut un nombre.\n\n' + q;
return [{ json: Object.assign({}, e, { reponse: tete + '\n\n' + q })}];
"""

LIGNE_JS = r"""
function parseLigne(text) {
  let t = String(text || '').toLowerCase();
  let sommeil = null;
  const mh = t.match(/(\d+(?:[.,]\d+)?)\s*h(?:eures|eu)?\s*(\d{1,2})?/);
  if (mh) { sommeil = parseFloat(mh[1].replace(',', '.')) + (mh[2] ? parseInt(mh[2], 10) / 60 : 0); t = t.replace(mh[0], ' '); }
  let labels = { energie: null, stress: null };
  const LBL = 'energie|énergie|sommeil|dodo|stress|objectif|activite|activité|bilan';
  t = t.replace(new RegExp('\\b(' + LBL + ')\\b\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)\\s*h?', 'g'), (m2, lbl, val) => {
    const k = lbl.toLowerCase().replace('é', 'e');
    const v = parseFloat(val.replace(',', '.'));
    if (k.startsWith('energi')) labels.energie = v;
    else if (k === 'stress') labels.stress = v;
    else if (k === 'sommeil' || k === 'dodo') { if (sommeil === null) sommeil = v; }
    return ' '; });
  const nums = (t.match(/\d+(?:[.,]\d+)?/g) || []).map((s) => parseFloat(s.replace(',', '.')));
  const b5 = (v) => (v === undefined ? null : Math.max(1, Math.min(5, Math.round(v))));
  let energie = null, stress = null;
  if (sommeil !== null) { energie = b5(nums[0]); stress = b5(nums[1]); }
  else if (nums.length >= 3) { energie = b5(nums[0]); const s2 = Math.round(nums[1] * 10) / 10; sommeil = (s2 > 0 && s2 <= 24) ? s2 : null; stress = b5(nums[2]); }
  else { energie = b5(nums[0]); stress = b5(nums[1]); }
  if (labels.energie !== null) energie = b5(labels.energie);
  if (labels.stress !== null) stress = b5(labels.stress);
  if (sommeil !== null) sommeil = Math.round(sommeil * 10) / 10;
  let texte = '';
  if (nums.length) { let pos = -1; const re = /\d+(?:[.,]\d+)?/g; let mm; while ((mm = re.exec(t)) !== null) pos = mm.index + mm[0].length; if (pos !== -1) texte = t.slice(pos).replace(/^[\s,;.:-]+/, '').trim(); }
  if (!texte) texte = String(text || '').replace(/^[\s,;:.-]+/, '').trim();
  else { texte = texte.replace(new RegExp('(^|[\\s,;:.()-])(' + LBL + ')([\\s:=-]|$)', 'gi'), '$1$3').replace(/[\s,;.:-]{2,}/g, ' ').replace(/^[\s,;.:-]+|[\s,;.:-]+$/g, '').trim(); }
  if (texte && !/[a-z]{2,}/i.test(texte)) texte = '';
  return { energie, sommeil, stress, texte };
}
const e = $json;
const p = parseLigne(e.ligne || '');
return { json: Object.assign({}, e, { energie: p.energie, sommeil_h: p.sommeil, stress: p.stress, texte_libre: p.texte })};
"""

PROMED_JS = r"""
const j = $json;
const body = j.body !== undefined ? j.body : j;
let h = [];
if (Array.isArray(body) && body.length && body[0] && Array.isArray(body[0].data)) h = body[0].data;
else if (Array.isArray(body)) h = body;
const lignes = h.slice(-14).map((r) => [String(r.date||'').slice(0,10), r.moment||'?', 'energie='+(r.energie??'?'), 'sommeil='+(r.sommeil_h??'?')+'h', 'stress='+(r.stress??'?'), (r.texte||'').slice(0,80)].join(' | ')).join('\n');
const question = j.message_libre || '';
const prompt = 'Donnees du jour :\n  energie : ' + (j.energie ?? 'non renseignee') + ' /5\n  sommeil : ' + (j.sommeil_h ?? 'non renseigne') + ' h\n  stress  : ' + (j.stress ?? 'non renseigne') + ' /5\n  note    : ' + (j.texte_libre || j.ligne || '-') + '\n\nHistorique des 7 derniers jours :\n' + (lignes || '  (aucune donnee)') + '\n\n' + (question ? 'L'utilisateur te pose cette question : "' + question + '". ' : (j.moment === 'soir' ? 'Fin de journee : bilan et conseils pour la soiree.' : 'Donne 2 ou 3 recommandations concretes pour la journee.'));
return { json: Object.assign({}, j, { prompt }) };
"""

FORMATE_JS = r"""
const items = $input.all();
return items.map((it) => {
  const j = it.json;
  let d = {};
  try { const b = j.body !== undefined ? j.body : j; d = typeof b === 'string' ? JSON.parse(b) : (b || {}); } catch (e) { d = {}; }
  const msg = d.message || 'Réponse indisponible.';
  const recos = Array.isArray(d.recommandations) ? d.recommandations : [];
  const alerte = d.alerte || '';
  let out = String(msg);
  if (recos.length) out += '\n\n' + recos.map((r, i) => (i + 1) + '. ' + r).join('\n');
  if (alerte) out += '\n\n⚠️ ' + alerte;
  return { json: Object.assign({}, j, { sortie: out }) };
});
"""

nodes = [
    n("Chat", "@n8n/n8n-nodes-langchain.chatTrigger", [-900, 300],
      {"mode": "hostedChat", "public": True, "responseMode": "lastNode",
       "options": {"responseMode": "lastNode",
                   "initialMessages": "Bonjour 👋 Je suis Boussole.\n\nTape /matin ou /soir, ou pose-moi une question."}},
      "trigger", 1.1),

    n("Init", "n8n-nodes-base.code", [-720, 300],
      {"jsCode": INIT_JS, "mode": "runOnceForAllItems"}, "init", 2),

    http_rows(T_ETAT, "GET", pos=(-540, 400), nid="get-etat", name="Lit etat (HTTP)"),

    n("Assemble etat", "n8n-nodes-base.code", [-360, 300],
      {"jsCode": LIT_JS, "mode": "runOnceForAllItems"}, "lit", 2),

    n("Route", "n8n-nodes-base.code", [-180, 300],
      {"jsCode": ROUTE_JS, "mode": "runOnceForAllItems"}, "route", 2),

    n("Applique reponse", "n8n-nodes-base.code", [0, 180],
      {"jsCode": APPLY_JS, "mode": "runOnceForAllItems"}, "apply", 2),

    # upsert etat : PUT sur la ligne dont l'id = etat_id
    http_rows(T_ETAT, "POST",
              body_expr="={{ JSON.stringify({ etat_id: $json.etat_id, session: $json.session, etape: $json.etape, moment: $json.moment, energie: $json.energie, sommeil_h: $json.sommeil_h, stress: $json.stress, texte: $json.texte, maj: $json.maj }) }}",
              pos=(180, 180), nid="save-etat", name="Sauve etat (HTTP)"),

    n("Pose la question", "n8n-nodes-base.if", [400, 60],
      {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                  "conditions": [{"id": "ifq", "leftValue": "={{ $json.etape }}", "rightValue": "attente",
                                  "operator": {"type": "string", "operation": "notEquals"}}],
                  "combinator": "and"}, "options": {}}, "ifq", 2.2),

    n("Redige question", "n8n-nodes-base.code", [580, -60],
      {"jsCode": UI_JS, "mode": "runOnceForAllItems"}, "ui", 2),

    n("Question au chat", "n8n-nodes-base.set", [760, -60],
      {"mode": "raw", "jsonOutput": "={{ { output: $json.reponse } }}", "options": {}}, "pose", 3.5),

    n("Formulaire termine", "n8n-nodes-base.noOp", [760, 160], {}, "noop", 1),

    n("Passe en ligne", "n8n-nodes-base.switch", [940, 160],
      {"rules": {"values": [
          {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                          "conditions": [{"id": "l1", "leftValue": "={{ $json.mode }}", "rightValue": "ligne",
                                          "operator": {"type": "string", "operation": "equals"}}],
                          "combinator": "and"}, "renameOutput": True, "outputKey": "ligne"}]},
       "options": {"fallbackOutput": "extra", "renameFallbackOutput": "chat"}}, "switch", 3.4),

    n("Parse ligne", "n8n-nodes-base.code", [1120, 160],
      {"jsCode": LIGNE_JS, "mode": "runOnceForAllItems"}, "parse", 2),

    http_rows(T_JOUR, "GET", pos=(1300, 300), nid="get-ctx", name="Contexte 7j (HTTP)"),

    n("Assemble prompt", "n8n-nodes-base.code", [1480, 300],
      {"jsCode": PROMED_JS, "mode": "runOnceForAllItems"}, "prompt", 2),

    http_rows(T_JOUR, "POST",
              body_expr="={{ JSON.stringify({ date: $now.toISODate(), moment: $json.moment, energie: $json.energie, sommeil_h: $json.sommeil_h, stress: $json.stress, activite: $json.texte_libre }) }}",
              pos=(1660, 200), nid="save-jour", name="Enregistre jour (HTTP)"),

    n("Recommandation", "n8n-nodes-base.httpRequest", [1840, 300],
      {"method": "POST", "url": "https://api.mistral.ai/v1/chat/completions",
       "sendHeaders": True,
       "headerParameters": {"parameters": [
           {"name": "Authorization", "value": AUTH},
           {"name": "Content-Type", "value": "application/json"}]},
       "sendBody": True, "contentType": "raw", "rawContentType": "application/json",
       "body": mistral_body("$json.prompt"), "options": {"timeout": 25000}}, "llm", 4.5),

    n("Formate", "n8n-nodes-base.code", [2020, 300],
      {"jsCode": FORMATE_JS, "mode": "runOnceForAllItems"}, "formate", 2),

    n("Archive", "n8n-nodes-base.code", [2200, 400],
      {"jsCode": "const f = $('Formate').item.json; const src = $('Init').item.json; const ts = new Date().toISOString(); const msg = (src.texte||'').trim(); const rows = []; if (msg && msg.charAt(0) !== '/') rows.push({ ts, session: f.session, role: 'user', contenu: msg }); if (f.sortie) rows.push({ ts, session: f.session, role: 'assistant', contenu: f.sortie }); return rows.map(r => ({ json: r }));",
       "mode": "runOnceForAllItems"}, "prep-archive", 2),

    http_rows(T_CONV, "POST",
              body_expr="={{ JSON.stringify({ ts: $json.ts, session: $json.session, role: $json.role, contenu: $json.contenu }) }}",
              pos=(2380, 400), nid="archive", name="Archive echange (HTTP)"),

    n("Reponse au chat", "n8n-nodes-base.set", [2200, 200],
      {"mode": "raw", "jsonOutput": "={{ { output: $json.sortie } }}", "options": {}}, "envoi", 3.5),
]

connections = {
    "Chat": {"main": [[{"node": "Init", "type": "main", "index": 0}]]},
    "Init": {"main": [[{"node": "Lit etat (HTTP)", "type": "main", "index": 0}]]},
    "Lit etat (HTTP)": {"main": [[{"node": "Assemble etat", "type": "main", "index": 0}]]},
    "Assemble etat": {"main": [[{"node": "Route", "type": "main", "index": 0}]]},
    "Route": {"main": [[{"node": "Applique reponse", "type": "main", "index": 0}]]},
    "Applique reponse": {"main": [[{"node": "Sauve etat (HTTP)", "type": "main", "index": 0}]]},
    "Sauve etat (HTTP)": {"main": [[{"node": "Pose la question", "type": "main", "index": 0}]]},
    "Pose la question": {"main": [
        [{"node": "Redige question", "type": "main", "index": 0}],
        [{"node": "Formulaire termine", "type": "main", "index": 0}],
    ]},
    "Redige question": {"main": [[{"node": "Question au chat", "type": "main", "index": 0}]]},
    "Formulaire termine": {"main": [[{"node": "Passe en ligne", "type": "main", "index": 0}]]},
    "Passe en ligne": {"main": [
        [{"node": "Parse ligne", "type": "main", "index": 0}],
        [{"node": "Contexte 7j (HTTP)", "type": "main", "index": 0}],
    ]},
    "Parse ligne": {"main": [[{"node": "Contexte 7j (HTTP)", "type": "main", "index": 0}]]},
    "Contexte 7j (HTTP)": {"main": [[{"node": "Assemble prompt", "type": "main", "index": 0}]]},
    "Assemble prompt": {"main": [[{"node": "Enregistre jour (HTTP)", "type": "main", "index": 0}]]},
    "Enregistre jour (HTTP)": {"main": [[{"node": "Recommandation", "type": "main", "index": 0}]]},
    "Recommandation": {"main": [[{"node": "Formate", "type": "main", "index": 0}]]},
    "Formate": {"main": [[
        {"node": "Archive", "type": "main", "index": 0},
        {"node": "Reponse au chat", "type": "main", "index": 0},
    ]]},
    "Archive": {"main": [[{"node": "Archive echange (HTTP)", "type": "main", "index": 0}]]},
}

workflow = {
    "name": "1er idée de projet",
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": "v1"},
}

if __name__ == "__main__":
    print(json.dumps(workflow, ensure_ascii=False))
