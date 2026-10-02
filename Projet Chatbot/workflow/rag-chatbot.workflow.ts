// Chatbot RAG n8n — ingestion d'un PDF + answering d'une question par
// récupération de contexte, réformulation, recherche vectorielle, classement
// IA et génération ancrée.
//
// Deux pipelines indépendants sur le même canvas :
//   1. INGESTION  — formulaire PDF -> vecteurs dans Supabase (table `documents`)
//   2. ANSWERING  — chat -> contexte -> reformulation -> recherche -> classement -> génération
//
// Chaque étape est documentée par une note collante sur le canvas.

import { workflow, node, trigger, sticky, embedding, documentLoader, newCredential, expr } from '@n8n/workflow-sdk';

const embeddings_Google_Gemini = embedding({ type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', version: 1, config: { parameters: { modelName: 'models/gemini-embedding-2' }, credentials: { googlePalmApi: newCredential('cle ema', '0uTLeNxpmqA3gZPB') }, position: [928, 192] } });
const default_Data_Loader = documentLoader({ type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader', version: 1.1, config: { name: 'Default Data Loader', parameters: { options: {} }, position: [1152, 192] } });
const answer_Embeddings = embedding({ type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', version: 1, config: { name: 'Answer Embeddings', parameters: { modelName: 'models/gemini-embedding-2' }, credentials: { googlePalmApi: newCredential('cle ema', '0uTLeNxpmqA3gZPB') }, position: [-400, 1600], notes: 'Embeds the reformulated user question before the vector search. Same model as the ingestion side, so queries and documents share one vector space.' } });

const on_form_submission = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: { name: 'On form submission', parameters: { formTitle: 'lud', formFields: { values: [{ fieldLabel: 'pdf', fieldType: 'file' }] }, options: {} }, position: [-400, -272], webhookId: 'fb957cd7-8a4b-4978-851c-a366f5b78123' }
});

const extract_from_File = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: { name: 'Extract from File', parameters: { operation: 'pdf', binaryPropertyName: 'pdf', options: { keepSource: 'json' } }, position: [-80, -272] }
});

const code_in_JavaScript = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Code in JavaScript', parameters: { jsCode: '// Configuration du chunking\nconst chunkSize = 1200; // Nombre de caractères par chunk\nconst overlap = 150;    // Chevauchement pour préserver le contexte\nconst results = [];\n\nfor (const item of $input.all()) {\n  // Récupération du tableau de textes ou d\'une chaîne brute\n  const texts = Array.isArray(item.json.text) ? item.json.text : [item.json.text || \'\'];\n\n  texts.forEach((fullText, textIndex) => {\n    if (!fullText) return;\n\n    let start = 0;\n    let chunkIndex = 0;\n\n    // Découpage par tranche de taille (chunkSize) avec chevauchement (overlap)\n    while (start < fullText.length) {\n      const end = Math.min(start + chunkSize, fullText.length);\n      const chunkText = fullText.slice(start, end);\n\n      results.push({\n        json: {\n          chunk: chunkText,\n          chunkIndex: chunkIndex,\n          textSourceIndex: textIndex,\n          totalChars: fullText.length\n        }\n      });\n\n      // Si le texte est terminé, on sort de la boucle\n      if (end === fullText.length) break;\n\n      // Avancement avec chevauchement\n      start += chunkSize - overlap;\n      chunkIndex++;\n    }\n  });\n}\n\nreturn results;' }, position: [192, -272] }
});

const limit = node({
  type: 'n8n-nodes-base.limit',
  version: 1,
  config: { name: 'Limit', parameters: { maxItems: 500 }, position: [480, -272] }
});

// Ingestion delegue chaque fragment a ce meme workflow via le noeud Execute
// Workflow. L'identifiant vient d'une variable pour rester portable d'une
// instance a l'autre : creer la variable WORKFLOW_ID avec l'id de ce workflow.
const call_RAG_N8N = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: { name: 'Call \'RAG N8N\'', parameters: { workflowId: { __rl: true, value: '{{ $vars.WORKFLOW_ID }}', mode: 'id' }, workflowInputs: { mappingMode: 'defineBelow', value: { content: expr('{{ $json.chunk }}') }, matchingColumns: ['content'], schema: [{ id: 'content', displayName: 'content', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false }], attemptToConvertTypes: false, convertFieldsToString: true }, mode: 'each', options: {} }, position: [736, -272] }
});

const when_Executed_by_Another_Workflow = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'When Executed by Another Workflow', parameters: { workflowInputs: { values: [{ name: 'content' }] } }, position: [784, -16] }
});

const supabase_Vector_Store = node({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.3,
  config: { name: 'Supabase Vector Store', parameters: { mode: 'insert', tableName: { __rl: true, value: 'documents', mode: 'list', cachedResultName: 'documents', cachedResultUrl: '' }, options: {} }, credentials: { supabaseApi: newCredential('Supabase account 2', 'tLCbXMTr0rqS4nlz') }, position: [1008, -16], subnodes: { embedding: embeddings_Google_Gemini, documentLoader: default_Data_Loader } }
});

const answer_Chat_Trigger = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.5,
  config: { name: 'Answer Chat Trigger', parameters: { public: true, options: { responseMode: 'lastNode' } }, position: [-400, 880], webhookId: 'b9dc68c1-bb6f-4fbb-b824-f6259b9726ea', notes: 'Entry point of the answering pipeline. Receives the user message in chatInput plus the conversation sessionId.' }
});

const load_Session_History = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Load Session History', parameters: { operation: 'get', dataTableId: { __rl: true, mode: 'name', value: 'rag_chat_history', cachedResultName: 'rag_chat_history' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'sessionId', keyValue: expr('{{ $json.sessionId }}') }] }, limit: 20, orderBy: true, orderByColumn: 'ts' }, position: [-160, 880], notes: 'Retrieves the last 20 messages of the current chat session so follow-up questions resolve against the conversation.', alwaysOutputData: true }
});

const build_Context = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Context', parameters: { jsCode: 'const trigger = $(\'Answer Chat Trigger\').first().json;\nconst rows = $input.all().map(function (item) { return item.json; });\n\nconst history = rows\n  .filter(function (row) { return row.content !== undefined && row.content !== null && row.content !== \'\'; })\n  .sort(function (a, b) { return String(a.ts).localeCompare(String(b.ts)); })\n  .map(function (row) { return (row.role === \'user\' ? \'User\' : \'Assistant\') + \': \' + String(row.content); })\n  .join(\'\\n\');\n\nreturn [{ json: { sessionId: trigger.sessionId, chatInput: trigger.chatInput, history: history } }];' }, position: [80, 880], notes: 'Re-attaches the chat trigger fields (sessionId, chatInput) to the history rows and formats the conversation into a readable transcript.' }
});

const query_Reformulation = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: { name: 'Query Reformulation', parameters: { modelId: { __rl: true, mode: 'id', value: 'models/gemini-3-flash-preview' }, messages: { values: [{ content: expr('You rewrite a chat message into a standalone search query.\n\n<conversation>\n{{ $json.history }}\n</conversation>\n\n<latest_message>\n{{ $json.chatInput }}\n</latest_message>\n\nRewrite the latest message into ONE self-contained question that is understandable without the conversation. Resolve pronouns, ellipsis and implicit references using the conversation. Keep the original language of the user.\n\nReturn ONLY a JSON object, no markdown, with exactly these keys:\n{"question": "<standalone question>", "keywords": "<3 to 6 short search keywords, space separated>"}') }] }, builtInTools: {}, options: { includeMergedResponse: true, systemMessage: 'You are a query rewriting assistant. You always answer with a single valid JSON object and nothing else.', maxOutputTokens: 2000, temperature: 0 } }, credentials: { googlePalmApi: newCredential('cle ema', '0uTLeNxpmqA3gZPB') }, position: [320, 880], notes: 'AI routing step: turns an elliptical follow-up such as "And South Africa?" into a self-contained question using the session history, plus short search keywords.' }
});

const parse_Reformulation = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Parse Reformulation', parameters: { jsCode: 'const base = $(\'Build Context\').first().json;\nconst raw = String($input.first().json.mergedResponse || \'\');\n\nlet parsed = {};\nconst match = raw.match(/\\{[\\s\\S]*\\}/);\nif (match) {\n  try { parsed = JSON.parse(match[0]); } catch (error) { parsed = {}; }\n}\n\nconst question = String(parsed.question || base.chatInput || \'\').trim();\nconst keywords = String(parsed.keywords || \'\').trim();\n\nreturn [{ json: Object.assign({}, base, {\n  question: question,\n  searchQuery: keywords ? question + \' \' + keywords : question\n}) }];' }, position: [560, 880], notes: 'Extracts the standalone question and the search query from the model output, tolerating markdown fences. Falls back to the raw user message.' }
});

const answer_Vector_Search = node({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.3,
  config: { name: 'Answer Vector Search', parameters: { mode: 'load', tableName: { __rl: true, mode: 'list', value: 'documents', cachedResultName: 'documents' }, prompt: expr('{{ $json.searchQuery }}'), topK: 100, options: {} }, credentials: { supabaseApi: newCredential('Supabase account 2', 'tLCbXMTr0rqS4nlz') }, position: [-400, 1120], notes: 'High recall similarity search over the existing Supabase vector store (table documents). topK 100 keeps many candidates on purpose; the AI re-ranking step narrows them down.', subnodes: { embedding: answer_Embeddings } }
});

const merge_Candidates = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Merge Candidates', parameters: { jsCode: 'const base = $(\'Parse Reformulation\').first().json;\nconst docs = $input.all().map(function (item) { return item.json; });\n\nconst candidates = docs.map(function (doc, index) {\n  let text = \'\';\n  if (doc.document !== undefined && doc.document !== null && typeof doc.document === \'object\') {\n    text = doc.document.pageContent;\n  } else if (typeof doc.document === \'string\') {\n    text = doc.document;\n  } else if (doc.pageContent !== undefined && doc.pageContent !== null) {\n    text = doc.pageContent;\n  } else if (typeof doc.text === \'string\') {\n    text = doc.text;\n  }\n  return { index: index, score: typeof doc.score === \'number\' ? doc.score : 0, text: String(text) };\n});\n\nreturn [{ json: Object.assign({}, base, { candidates: candidates }) }];' }, position: [-160, 1120], notes: 'Collapses the retrieved passages into a single item so the re-ranking step runs as one model call instead of one call per candidate.' }
});

const re_rank_Chunks = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: { name: 'Re-rank Chunks', parameters: { modelId: { __rl: true, mode: 'id', value: 'models/gemini-3-flash-preview' }, messages: { values: [{ content: expr('<question>\n{{ $json.question }}\n</question>\n\n<candidate_passages>\n{{ $json.candidates.map(function (candidate) { return \'[\' + candidate.index + \'] \' + String(candidate.text).slice(0, 400); }).join(\'\\n\\n\') }}\n</candidate_passages>\n\nSelect the 3 candidate passages that best answer the question. Return ONLY a JSON array of the passage ids, best first, for example [12, 3, 40]. Return fewer than 3 if not enough passages are relevant. Return [] if none are relevant.') }] }, builtInTools: {}, options: { includeMergedResponse: true, systemMessage: 'You are a passage re-ranking assistant. You always answer with a single valid JSON array of integers and nothing else.', maxOutputTokens: 4000, temperature: 0 } }, credentials: { googlePalmApi: newCredential('cle ema', '0uTLeNxpmqA3gZPB') }, position: [80, 1120], notes: 'AI re-ranking: reduces the high recall candidate set to the 3 most relevant passages. Each candidate is truncated to 700 characters for ranking.' }
});

const build_Answer_Context = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Answer Context', parameters: { jsCode: 'const base = $(\'Merge Candidates\').first().json;\nconst raw = String($input.first().json.mergedResponse || \'\');\n\nlet keep = [];\nconst match = raw.match(/\\[[\\s\\S]*?\\]/);\nif (match) {\n  try { keep = JSON.parse(match[0]).map(Number).filter(function (value) { return Number.isInteger(value); }); }\n  catch (error) { keep = []; }\n}\n\nif (keep.length === 0) {\n  keep = base.candidates\n    .slice()\n    .sort(function (a, b) { return b.score - a.score; })\n    .slice(0, 3)\n    .map(function (candidate) { return candidate.index; });\n}\n\nconst seen = {};\nconst chosen = [];\nfor (const requested of keep) {\n  if (chosen.length >= 3) { break; }\n  if (seen[requested] === true) { continue; }\n  seen[requested] = true;\n  const found = base.candidates.find(function (candidate) { return candidate.index === requested; });\n  if (found) { chosen.push(found); }\n}\n\nconst context = chosen.map(function (candidate, position) {\n  return \'--- Passage \' + (position + 1) + \' (similarity \' + Number(candidate.score).toFixed(4) + \') ---\\n\' + candidate.text;\n}).join(\'\\n\\n\');\n\nreturn [{ json: Object.assign({}, base, { context: context }) }];' }, position: [320, 1120], notes: 'Maps the ids chosen by the re-ranking step back to the full untruncated passages and assembles the final context block for generation.' }
});

const generate_Answer = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: { name: 'Generate Answer', parameters: { modelId: { __rl: true, mode: 'id', value: 'models/gemini-3-flash-preview' }, messages: { values: [{ content: expr('<context>\n{{ $json.context }}\n</context>\n\n<conversation>\n{{ $json.history }}\n</conversation>\n\n<question>\n{{ $json.question }}\n</question>\n\nAnswer the question using ONLY the passages in the context. If the context does not contain the answer, say so plainly instead of guessing. Answer in the same language as the question. Be concise and factual.') }] }, builtInTools: {}, options: { includeMergedResponse: true, systemMessage: 'You are a helpful assistant that answers questions strictly from the provided context passages.', maxOutputTokens: 1500, temperature: 0.2 } }, credentials: { googlePalmApi: newCredential('cle ema', '0uTLeNxpmqA3gZPB') }, position: [560, 1120], notes: 'Final generation step: answers the standalone question from the re-ranked passages, with the conversation history for continuity.' }
});

const build_History_Rows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build History Rows', parameters: { jsCode: 'const context = $(\'Build Answer Context\').first().json;\nconst answer = String($input.first().json.mergedResponse || \'\');\nconst timestamp = Date.now();\n\nreturn [\n  { json: { sessionId: context.sessionId, role: \'user\', content: String(context.chatInput || \'\'), ts: String(timestamp) } },\n  { json: { sessionId: context.sessionId, role: \'assistant\', content: answer, ts: String(timestamp + 1) } }\n];' }, position: [-400, 1360], notes: 'Builds the two rows (user turn and assistant turn) that persist this exchange into the session history.' }
});

const save_Chat_Turn = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Chat Turn', parameters: { dataTableId: { __rl: true, mode: 'name', value: 'rag_chat_history', cachedResultName: 'rag_chat_history' }, columns: { mappingMode: 'defineBelow', value: { sessionId: expr('{{ $json.sessionId }}'), role: expr('{{ $json.role }}'), content: expr('{{ $json.content }}'), ts: expr('{{ $json.ts }}') }, schema: [{ id: 'sessionId', displayName: 'sessionId', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false }, { id: 'role', displayName: 'role', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false }, { id: 'content', displayName: 'content', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false }, { id: 'ts', displayName: 'ts', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false }] }, options: {} }, position: [-160, 1360], notes: 'Persists the user turn and the assistant turn in the session history so the next message can resolve follow-up questions.' }
});

const chat_Response = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Chat Response', parameters: { jsCode: 'const answer = String($(\'Generate Answer\').first().json.mergedResponse || \'\');\nreturn [{ json: { output: answer } }];' }, position: [80, 1360], notes: 'Last node of the chain. The chat trigger uses responseMode lastNode, so it must emit the reply under the output key.' }
});

const wf = workflow('rag-chatbot', 'RAG N8N', { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: true });

export default wf
  .add(on_form_submission)
  .to(extract_from_File)
  .to(code_in_JavaScript)
  .to(limit)
  .to(call_RAG_N8N)
  .add(when_Executed_by_Another_Workflow)
  .to(supabase_Vector_Store)
  .add(sticky('## 1. INGESTION\nTraitement du document et création des vecteurs.\nTransforme un PDF en vecteurs de recherche stockés dans Supabase.\nSe déclenche à l\u2019envoi d\u2019un fichier via le formulaire. Non utilisé lors des échanges avec le chatbot.', [], { name: 'Sticky Note', width: 430, height: 110, position: [-255, -760] }))
  .add(answer_Chat_Trigger)
  .to(load_Session_History)
  .to(build_Context)
  .to(query_Reformulation)
  .to(parse_Reformulation)
  .to(answer_Vector_Search)
  .to(merge_Candidates)
  .to(re_rank_Chunks)
  .to(build_Answer_Context)
  .to(generate_Answer)
  .to(build_History_Rows)
  .to(save_Chat_Turn)
  .to(chat_Response)
  .add(sticky('## 2. ANSWERING\nRéponses aux questions par récupération de contexte et mémoire de conversation.\nUtilise les vecteurs créés par le pipeline d\u2019ingestion pour répondre à une question posée dans le chat.\nSe déclenche uniquement à la réception d\u2019un message. Indépendant de l\u2019ingestion.', [], { name: 'Answering', width: 430, height: 90, position: [-255, 330] }))
  .add(sticky('### ENTRÉE\n`On form submission`\nPoint de départ du pipeline d\u2019ingestion. Accepte un fichier PDF par envoi.', [], { name: 'Doc 1 Entrée', width: 300, height: 150, position: [-350, -560] }))
  .add(sticky('### EXTRACTION\n`Extract from File`\nLit le PDF et produit le texte brut, toutes les pages réunies en une seule chaîne.\nNécessite une vraie couche texte : un PDF scanné (image seule) ne produit rien et rien n\u2019est ingéré.', [], { name: 'Doc 2 Extraction', width: 300, height: 150, position: [-30, -560] }))
  .add(sticky('### DÉCOUPAGE\n`Code in JavaScript` + `Limit`\nDécoupe le texte en fragments de 1 200 caractères avec un chevauchement de 150 caractères, afin qu\u2019une phrase coupée entre deux fragments reste lisible.\n`Limit` plafonne le lot à 500 fragments par envoi.', [], { name: 'Doc 3 Découpage', width: 340, height: 150, position: [336, -560] }))
  .add(sticky('### VECTORISATION ET STOCKAGE\n`Call \'RAG N8N\'` vers `Supabase Vector Store`\nChaque fragment est converti en vecteur de 3 072 dimensions par `Embeddings Google Gemini` (gemini-embedding-2), puis enregistré dans la table `documents` de Supabase.\n`Default Data Loader` prépare le texte avant le stockage.', [], { name: 'Doc 4 Vectorisation', width: 420, height: 150, position: [900, -560] }))
  .add(sticky('### ENTRÉE / CHAT\n`Answer Chat Trigger`\nReçoit le message de l\u2019utilisateur et l\u2019identifiant de conversation, puis renvoie la réponse produite par le dernier nœud de la chaîne.', [], { name: 'Doc 5 Entrée Chat', width: 280, height: 150, position: [-320, 480] }))
  .add(sticky('### CONTEXTE\n`Load Session History` + `Build Context`\nCharge les 20 derniers messages de la conversation, afin qu\u2019une question de suivi comme « Et l\u2019Afrique du Sud ? » soit comprise seule.', [], { name: 'Doc 6 Contexte', width: 280, height: 150, position: [-30, 480] }))
  .add(sticky('### RÉFORMULATION DE LA QUESTION\n`Query Reformulation` + `Parse Reformulation`\nL\u2019IA réécrit le message en une question autonome, accompagnée de mots-clés de recherche, en utilisant l\u2019historique pour résoudre les pronoms et les sous-entendus.', [], { name: 'Doc 7 Reformulation', width: 280, height: 150, position: [260, 480] }))
  .add(sticky('### RECHERCHE\n`Answer Vector Search` + `Answer Embeddings`\nConvertit la question réformulée en vecteur avec le même modèle que l\u2019ingestion, puis récupère les 100 fragments les plus proches dans Supabase.\nRappel volontairement élevé : trop de fragments plutôt que trop peu.', [], { name: 'Doc 8 Recherche', width: 280, height: 150, position: [550, 480] }))
  .add(sticky('### CLASSEMENT\n`Merge Candidates` + `Re-rank Chunks`\nRegroupe les 100 fragments en une seule requête, puis l\u2019IA sélectionne les 3 qui répondent réellement à la question.', [], { name: 'Doc 9 Classement', width: 440, height: 150, position: [-240, 650] }))
  .add(sticky('### GÉNÉRATION\n`Build Answer Context` + `Generate Answer`\nReconstitue le texte intégral des 3 fragments retenus et rédige la réponse à partir de ceux-ci uniquement. Si les fragments ne contiennent pas la réponse, il le dit au lieu d\u2019inventer.', [], { name: 'Doc 10 Génération', width: 440, height: 150, position: [210, 650] }))
  .add(sticky('### MÉMOIRE ET RÉPONSE\n`Build History Rows` + `Save Chat Turn` + `Chat Response`\nEnregistre la question et la réponse dans la table de données pour que le message suivant garde son contexte, puis renvoie la réponse au chat.', [], { name: 'Doc 11 Mémoire', width: 440, height: 150, position: [660, 650] }))