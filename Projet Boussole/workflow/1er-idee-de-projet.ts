import { workflow, node, trigger, ifElse, switchCase, merge, expr } from '@n8n/workflow-sdk';

const chat = trigger({
  "type": "@n8n/n8n-nodes-langchain.chatTrigger",
  "version": 1.1,
  "config": {
    "name": "Chat",
    "parameters": {
      "mode": "hostedChat",
      "public": true,
      "responseMode": "lastNode",
      "options": {
        "responseMode": "lastNode",
        "initialMessages": "Bonjour 👋 Je suis Boussole.\n\nTape /matin ou /soir, ou pose-moi une question."
      }
    }
  }
});

const init = node({
  "type": "n8n-nodes-base.code",
  "version": 2,
  "config": {
    "name": "Init",
    "parameters": {
      "jsCode": "\nconst items = $input.all();\nreturn items.map((it) => {\n  const j = it.json || {};\n  const texte = (j.chatInput !== undefined ? j.chatInput : (j.text || '')) || '';\n  return { json: { texte: String(texte).trim(), session: j.sessionId || 'default' }};\n});\n",
      "mode": "runOnceForAllItems"
    }
  }
});

const lit_etat_http = node({
  "type": "n8n-nodes-base.httpRequest",
  "version": 4.5,
  "config": {
    "name": "Lit etat (HTTP)",
    "parameters": {
      "method": "GET",
      "url": "={{ $vars.N8N_URL }}/api/v1/data-tables/{{ $vars.TABLE_ETAT }}/rows",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          {
            "name": "X-N8N-API-KEY",
            "value": "=Bearer {{ $vars.N8N_API_KEY }}"
          }
        ]
      },
      "options": {}
    },
    "onError": "continueRegularOutput"
  }
});

const assemble_etat = node({
  "type": "n8n-nodes-base.code",
  "version": 2,
  "config": {
    "name": "Assemble etat",
    "parameters": {
      "jsCode": "\nconst head = $json;\nlet etat = {\n  session: head.session, etat_id: head.session, etape: 'attente',\n  moment: null, energie: null, sommeil_h: null, stress: null, texte: '',\n};\n// Si le GET a renvoye une ligne, on fusionne (la reponse est { data: [...] })\nconst d = head.data;\nif (Array.isArray(d) && d.length) Object.assign(etat, d[0]);\nelse if (head.etape !== undefined) Object.assign(etat, head);\netat.session = head.session;\netat.entree = head.texte;\nreturn [{ json: etat }];\n",
      "mode": "runOnceForAllItems"
    }
  }
});

const route = node({
  "type": "n8n-nodes-base.code",
  "version": 2,
  "config": {
    "name": "Route",
    "parameters": {
      "jsCode": "\nconst e = $json;\nconst msg = (e.entree || '').trim();\nconst cmd = msg.split(/\\s+/)[0].toLowerCase();\nif (cmd === '/matin' || cmd === '/soir') {\n  const reste = msg.slice(cmd.length).trim();\n  if (reste && /\\d/.test(reste)) {\n    return [{ json: Object.assign({}, e, { mode: 'ligne', ligne: reste,\n      moment: cmd === '/soir' ? 'soir' : 'matin', etape: 'attente',\n      energie: null, sommeil_h: null, stress: null, texte: '' })}];\n  }\n  return [{ json: Object.assign({}, e, { mode: 'demarre', etape: 'energie',\n    moment: cmd === '/soir' ? 'soir' : 'matin',\n    energie: null, sommeil_h: null, stress: null, texte: reste || '' })}];\n}\nif (e.etape && e.etape !== 'attente') return [{ json: Object.assign({}, e, { mode: 'reponse' })}];\nreturn [{ json: Object.assign({}, e, { mode: 'chat' })}];\n",
      "mode": "runOnceForAllItems"
    }
  }
});

const applique_reponse = node({
  "type": "n8n-nodes-base.code",
  "version": 2,
  "config": {
    "name": "Applique reponse",
    "parameters": {
      "jsCode": "\nconst e = $json;\nconst msg = (e.entree || '').trim();\nfunction sauver() { e.etat_id = e.session; e.maj = new Date().toISOString(); return e; }\nif (e.mode === 'ligne') return [{ json: Object.assign(sauver(), { termine: true })}];\nif (e.mode === 'chat') { e.etape = 'attente'; return [{ json: Object.assign(sauver(), { termine: true, message_libre: msg })}]; }\nif (e.mode === 'demarre') return [{ json: Object.assign(sauver(), { termine: false })}];\nlet refus = false;\nif (e.etape === 'energie' || e.etape === 'stress') {\n  const v = parseInt(msg.replace(/[^\\d]/g, ''), 10);\n  if (v >= 1 && v <= 5) e[e.etape] = v; else refus = true;\n} else if (e.etape === 'sommeil') {\n  const m = msg.toLowerCase().match(/(\\d+(?:[.,]\\d+)?)\\s*h(?:eures|eu)?\\s*(\\d{1,2})?/);\n  let v = m ? parseFloat(m[1].replace(',', '.')) + (m[2] ? parseInt(m[2], 10) / 60 : 0)\n            : parseFloat(msg.replace(',', '.').replace(/[^\\d.]/g, ''));\n  if (Number.isFinite(v) && v > 0 && v <= 24) e.sommeil_h = Math.round(v * 10) / 10; else refus = true;\n} else if (e.etape === 'texte') { e.texte = msg; }\nif (refus) return [{ json: Object.assign(sauver(), { termine: false, valeur_refusee: true })}];\nconst ORDRE = { energie: 'sommeil', sommeil: 'stress', stress: 'texte', texte: null };\ne.etape = ORDRE[e.etape];\nconst termine = e.etape === null;\nif (termine) { e.etape = 'attente'; e.moment = null; }\nreturn [{ json: Object.assign(sauver(), { termine }) }];\n",
      "mode": "runOnceForAllItems"
    }
  }
});

const sauve_etat_http = node({
  "type": "n8n-nodes-base.httpRequest",
  "version": 4.5,
  "config": {
    "name": "Sauve etat (HTTP)",
    "parameters": {
      "method": "POST",
      "url": "={{ $vars.N8N_URL }}/api/v1/data-tables/{{ $vars.TABLE_ETAT }}/rows",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          {
            "name": "X-N8N-API-KEY",
            "value": "=Bearer {{ $vars.N8N_API_KEY }}"
          }
        ]
      },
      "options": {},
      "sendBody": true,
      "contentType": "raw",
      "rawContentType": "application/json",
      "body": "={{ JSON.stringify({ etat_id: $json.etat_id, session: $json.session, etape: $json.etape, moment: $json.moment, energie: $json.energie, sommeil_h: $json.sommeil_h, stress: $json.stress, texte: $json.texte, maj: $json.maj }) }}"
    },
    "onError": "continueRegularOutput"
  }
});

const pose_la_question = ifElse({
  "type": "n8n-nodes-base.if",
  "version": 2.2,
  "config": {
    "name": "Pose la question",
    "parameters": {
      "conditions": {
        "options": {
          "caseSensitive": true,
          "leftValue": "",
          "typeValidation": "loose",
          "version": 2
        },
        "conditions": [
          {
            "id": "ifq",
            "leftValue": "={{ $json.etape }}",
            "rightValue": "attente",
            "operator": {
              "type": "string",
              "operation": "notEquals"
            }
          }
        ],
        "combinator": "and"
      },
      "options": {}
    }
  }
});

const redige_question = node({
  "type": "n8n-nodes-base.code",
  "version": 2,
  "config": {
    "name": "Redige question",
    "parameters": {
      "jsCode": "\nconst e = $json;\nconst tete = e.moment === 'soir' ? '🌙 *Boussole — bilan du soir*' : '☀️ *Boussole — point du matin*';\nif (e.termine) return [{ json: Object.assign({}, e, { reponse: '' })}];\nlet q = '';\nif (e.etape === 'energie') q = 'Comment est ton ' + (e.moment === 'soir' ? 'énergie ce soir ?' : 'énergie ce matin ?') + '\\nRéponds par un chiffre de 1 (épuisé) à 5 (au top).';\nelse if (e.etape === 'sommeil') q = 'Tu as dormi combien de cette nuit ?\\nRéponds en heures, par exemple « 7h » ou « 5h30 ».';\nelse if (e.etape === 'stress') q = 'Quel est ton niveau de stress ?\\nRéponds par un chiffre de 1 (zen) à 5 (débordé).';\nelse if (e.etape === 'texte') q = e.moment === 'soir' ? 'Comment s’est passée ta journée ?' : 'Quel est ton objectif du jour ?';\nif (e.valeur_refusee) q = '⚠️ Je n’ai pas compris, il me faut un nombre.\\n\\n' + q;\nreturn [{ json: Object.assign({}, e, { reponse: tete + '\\n\\n' + q })}];\n",
      "mode": "runOnceForAllItems"
    }
  }
});

const question_au_chat = node({
  "type": "n8n-nodes-base.set",
  "version": 3.5,
  "config": {
    "name": "Question au chat",
    "parameters": {
      "mode": "raw",
      "jsonOutput": "={{ { output: $json.reponse } }}",
      "options": {}
    }
  }
});

const formulaire_termine = node({
  "type": "n8n-nodes-base.noOp",
  "version": 1,
  "config": {
    "name": "Formulaire termine",
    "parameters": {}
  }
});

const passe_en_ligne = switchCase({
  "type": "n8n-nodes-base.switch",
  "version": 3.4,
  "config": {
    "name": "Passe en ligne",
    "parameters": {
      "rules": {
        "values": [
          {
            "conditions": {
              "options": {
                "caseSensitive": true,
                "leftValue": "",
                "typeValidation": "loose",
                "version": 2
              },
              "conditions": [
                {
                  "id": "l1",
                  "leftValue": "={{ $json.mode }}",
                  "rightValue": "ligne",
                  "operator": {
                    "type": "string",
                    "operation": "equals"
                  }
                }
              ],
              "combinator": "and"
            },
            "renameOutput": true,
            "outputKey": "ligne"
          }
        ]
      },
      "options": {
        "fallbackOutput": "extra",
        "renameFallbackOutput": "chat"
      }
    }
  }
});

const parse_ligne = node({
  "type": "n8n-nodes-base.code",
  "version": 2,
  "config": {
    "name": "Parse ligne",
    "parameters": {
      "jsCode": "\nfunction parseLigne(text) {\n  let t = String(text || '').toLowerCase();\n  let sommeil = null;\n  const mh = t.match(/(\\d+(?:[.,]\\d+)?)\\s*h(?:eures|eu)?\\s*(\\d{1,2})?/);\n  if (mh) { sommeil = parseFloat(mh[1].replace(',', '.')) + (mh[2] ? parseInt(mh[2], 10) / 60 : 0); t = t.replace(mh[0], ' '); }\n  let labels = { energie: null, stress: null };\n  const LBL = 'energie|énergie|sommeil|dodo|stress|objectif|activite|activité|bilan';\n  t = t.replace(new RegExp('\\\\b(' + LBL + ')\\\\b\\\\s*[:=]?\\\\s*(\\\\d+(?:[.,]\\\\d+)?)\\\\s*h?', 'g'), (m2, lbl, val) => {\n    const k = lbl.toLowerCase().replace('é', 'e');\n    const v = parseFloat(val.replace(',', '.'));\n    if (k.startsWith('energi')) labels.energie = v;\n    else if (k === 'stress') labels.stress = v;\n    else if (k === 'sommeil' || k === 'dodo') { if (sommeil === null) sommeil = v; }\n    return ' '; });\n  const nums = (t.match(/\\d+(?:[.,]\\d+)?/g) || []).map((s) => parseFloat(s.replace(',', '.')));\n  const b5 = (v) => (v === undefined ? null : Math.max(1, Math.min(5, Math.round(v))));\n  let energie = null, stress = null;\n  if (sommeil !== null) { energie = b5(nums[0]); stress = b5(nums[1]); }\n  else if (nums.length >= 3) { energie = b5(nums[0]); const s2 = Math.round(nums[1] * 10) / 10; sommeil = (s2 > 0 && s2 <= 24) ? s2 : null; stress = b5(nums[2]); }\n  else { energie = b5(nums[0]); stress = b5(nums[1]); }\n  if (labels.energie !== null) energie = b5(labels.energie);\n  if (labels.stress !== null) stress = b5(labels.stress);\n  if (sommeil !== null) sommeil = Math.round(sommeil * 10) / 10;\n  let texte = '';\n  if (nums.length) { let pos = -1; const re = /\\d+(?:[.,]\\d+)?/g; let mm; while ((mm = re.exec(t)) !== null) pos = mm.index + mm[0].length; if (pos !== -1) texte = t.slice(pos).replace(/^[\\s,;.:-]+/, '').trim(); }\n  if (!texte) texte = String(text || '').replace(/^[\\s,;:.-]+/, '').trim();\n  else { texte = texte.replace(new RegExp('(^|[\\\\s,;:.()-])(' + LBL + ')([\\\\s:=-]|$)', 'gi'), '$1$3').replace(/[\\s,;.:-]{2,}/g, ' ').replace(/^[\\s,;.:-]+|[\\s,;.:-]+$/g, '').trim(); }\n  if (texte && !/[a-z]{2,}/i.test(texte)) texte = '';\n  return { energie, sommeil, stress, texte };\n}\nconst e = $json;\nconst p = parseLigne(e.ligne || '');\nreturn { json: Object.assign({}, e, { energie: p.energie, sommeil_h: p.sommeil, stress: p.stress, texte_libre: p.texte })};\n",
      "mode": "runOnceForAllItems"
    }
  }
});

const contexte_7j_http = node({
  "type": "n8n-nodes-base.httpRequest",
  "version": 4.5,
  "config": {
    "name": "Contexte 7j (HTTP)",
    "parameters": {
      "method": "GET",
      "url": "={{ $vars.N8N_URL }}/api/v1/data-tables/{{ $vars.TABLE_QUOTIDIEN }}/rows",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          {
            "name": "X-N8N-API-KEY",
            "value": "=Bearer {{ $vars.N8N_API_KEY }}"
          }
        ]
      },
      "options": {}
    },
    "onError": "continueRegularOutput"
  }
});

const assemble_prompt = node({
  "type": "n8n-nodes-base.code",
  "version": 2,
  "config": {
    "name": "Assemble prompt",
    "parameters": {
      "jsCode": "\nconst j = $json;\nconst body = j.body !== undefined ? j.body : j;\nlet h = [];\nif (Array.isArray(body) && body.length && body[0] && Array.isArray(body[0].data)) h = body[0].data;\nelse if (Array.isArray(body)) h = body;\nconst lignes = h.slice(-14).map((r) => [String(r.date||'').slice(0,10), r.moment||'?', 'energie='+(r.energie??'?'), 'sommeil='+(r.sommeil_h??'?')+'h', 'stress='+(r.stress??'?'), (r.texte||'').slice(0,80)].join(' | ')).join('\\n');\nconst question = j.message_libre || '';\nconst prompt = 'Donnees du jour :\\n  energie : ' + (j.energie ?? 'non renseignee') + ' /5\\n  sommeil : ' + (j.sommeil_h ?? 'non renseigne') + ' h\\n  stress  : ' + (j.stress ?? 'non renseigne') + ' /5\\n  note    : ' + (j.texte_libre || j.ligne || '-') + '\\n\\nHistorique des 7 derniers jours :\\n' + (lignes || '  (aucune donnee)') + '\\n\\n' + (question ? 'L'utilisateur te pose cette question : \"' + question + '\". ' : (j.moment === 'soir' ? 'Fin de journee : bilan et conseils pour la soiree.' : 'Donne 2 ou 3 recommandations concretes pour la journee.'));\nreturn { json: Object.assign({}, j, { prompt }) };\n",
      "mode": "runOnceForAllItems"
    }
  }
});

const enregistre_jour_http = node({
  "type": "n8n-nodes-base.httpRequest",
  "version": 4.5,
  "config": {
    "name": "Enregistre jour (HTTP)",
    "parameters": {
      "method": "POST",
      "url": "={{ $vars.N8N_URL }}/api/v1/data-tables/{{ $vars.TABLE_QUOTIDIEN }}/rows",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          {
            "name": "X-N8N-API-KEY",
            "value": "=Bearer {{ $vars.N8N_API_KEY }}"
          }
        ]
      },
      "options": {},
      "sendBody": true,
      "contentType": "raw",
      "rawContentType": "application/json",
      "body": "={{ JSON.stringify({ date: $now.toISODate(), moment: $json.moment, energie: $json.energie, sommeil_h: $json.sommeil_h, stress: $json.stress, activite: $json.texte_libre }) }}"
    },
    "onError": "continueRegularOutput"
  }
});

const recommandation = node({
  "type": "n8n-nodes-base.httpRequest",
  "version": 4.5,
  "config": {
    "name": "Recommandation",
    "parameters": {
      "method": "POST",
      "url": "https://api.mistral.ai/v1/chat/completions",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          {
            "name": "Authorization",
            "value": "=Bearer {{ $vars.N8N_API_KEY }}"
          },
          {
            "name": "Content-Type",
            "value": "application/json"
          }
        ]
      },
      "sendBody": true,
      "contentType": "raw",
      "rawContentType": "application/json",
      "body": "={{ JSON.stringify({\"model\": \"mistral-small-latest\", \"temperature\": 0.4, \"max_tokens\": 400, \"response_format\": {\"type\": \"json_object\"}, \"messages\": [{\"role\": \"system\", \"content\": \"Tu es Boussole, un assistant bienveillant qui aide a suivre sa routine, son energie et son equilibre de vie.\\n\\nREGLE ABSOLUE : tu ne poses AUCUN diagnostic medical et tu n'utilises jamais de vocabulaire medical. Si l'utilisateur parle de sante, recentre sur des pistes generales (repos, hydratation, mouvement, respiration) et invite-le a consulter un professionnel.\\n\\nTu reponds UNIQUEMENT avec un objet JSON valide :\\n  \\\"message\\\"        : 2 phrases, ton chaleureux.\\n  \\\"recommandations\\\" : tableau de 2 a 3 chaines courtes, actions concretes.\\n  \\\"alerte\\\"          : chaine vide, ou phrase si sommeil < 5h ou stress >= 4 ou energie <= 2.\"}, {\"role\": \"user\", \"content\": \"={{ $json.prompt }}\"}]}) }}",
      "options": {
        "timeout": 25000
      }
    }
  }
});

const formate = node({
  "type": "n8n-nodes-base.code",
  "version": 2,
  "config": {
    "name": "Formate",
    "parameters": {
      "jsCode": "\nconst items = $input.all();\nreturn items.map((it) => {\n  const j = it.json;\n  let d = {};\n  try { const b = j.body !== undefined ? j.body : j; d = typeof b === 'string' ? JSON.parse(b) : (b || {}); } catch (e) { d = {}; }\n  const msg = d.message || 'Réponse indisponible.';\n  const recos = Array.isArray(d.recommandations) ? d.recommandations : [];\n  const alerte = d.alerte || '';\n  let out = String(msg);\n  if (recos.length) out += '\\n\\n' + recos.map((r, i) => (i + 1) + '. ' + r).join('\\n');\n  if (alerte) out += '\\n\\n⚠️ ' + alerte;\n  return { json: Object.assign({}, j, { sortie: out }) };\n});\n",
      "mode": "runOnceForAllItems"
    }
  }
});

const archive = node({
  "type": "n8n-nodes-base.code",
  "version": 2,
  "config": {
    "name": "Archive",
    "parameters": {
      "jsCode": "const f = $('Formate').item.json; const src = $('Init').item.json; const ts = new Date().toISOString(); const msg = (src.texte||'').trim(); const rows = []; if (msg && msg.charAt(0) !== '/') rows.push({ ts, session: f.session, role: 'user', contenu: msg }); if (f.sortie) rows.push({ ts, session: f.session, role: 'assistant', contenu: f.sortie }); return rows.map(r => ({ json: r }));",
      "mode": "runOnceForAllItems"
    }
  }
});

const archive_echange_http = node({
  "type": "n8n-nodes-base.httpRequest",
  "version": 4.5,
  "config": {
    "name": "Archive echange (HTTP)",
    "parameters": {
      "method": "POST",
      "url": "={{ $vars.N8N_URL }}/api/v1/data-tables/{{ $vars.TABLE_CONVERSATIONS }}/rows",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          {
            "name": "X-N8N-API-KEY",
            "value": "=Bearer {{ $vars.N8N_API_KEY }}"
          }
        ]
      },
      "options": {},
      "sendBody": true,
      "contentType": "raw",
      "rawContentType": "application/json",
      "body": "={{ JSON.stringify({ ts: $json.ts, session: $json.session, role: $json.role, contenu: $json.contenu }) }}"
    },
    "onError": "continueRegularOutput"
  }
});

const reponse_au_chat = node({
  "type": "n8n-nodes-base.set",
  "version": 3.5,
  "config": {
    "name": "Reponse au chat",
    "parameters": {
      "mode": "raw",
      "jsonOutput": "={{ { output: $json.sortie } }}",
      "options": {}
    }
  }
});

export default workflow('boussole', '1er idée de projet')
  .add(chat)
  .to(init.to(lit_etat_http.to(assemble_etat.to(route.to(applique_reponse.to(sauve_etat_http.to(pose_la_question.onTrue(redige_question.to(question_au_chat)).onFalse(formulaire_termine.to(passe_en_ligne.onCase(0, parse_ligne.to(contexte_7j_http.to(assemble_prompt.to(enregistre_jour_http.to(recommandation.to(formate.to(archive.to(archive_echange_http)))))))).onCase(1, contexte_7j_http.to(assemble_prompt.to(enregistre_jour_http.to(recommandation.to(formate.to(archive.to(archive_echange_http))))))))))))))));
