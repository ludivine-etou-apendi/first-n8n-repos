# Projet Chatbot

Chatbot RAG qui pose des questions sur un livre et n'y répond qu'à partir du
livre lui-même. Le workflow n8n comporte deux parties indépendantes sur le même
canvas.

| Fichier | Rôle |
|---|---|
| `workflow/rag-chatbot.workflow.ts` | le workflow complet, code TypeScript SDK — **le seul fichier de workflow du projet** |
| `data-tables/rag-chat-history.md` | structure de la Data Table qui mémorise les conversations |

Le workflow est une source unique en `.ts` : il n'existe pas de doublon JSON
dans le dépôt.

## 1. Ingestion

Déclenchée par l'envoi d'un PDF dans le formulaire.

| Étape | Nœud(s) | Ce qui se passe |
|---|---|---|
| Entrée | `On form submission` | reçoit un PDF |
| Extraction | `Extract from File` | produit le texte brut, toutes les pages réunies |
| Découpage | `Code in JavaScript` + `Limit` | fragments de 1 200 caractères, chevauchement de 150, 500 fragments maximum par envoi |
| Vectorisation | `Embeddings Google Gemini` | chaque fragment devient un vecteur de 3 072 dimensions (`gemini-embedding-2`) |
| Stockage | `Supabase Vector Store` | écriture dans la table `documents` de Supabase |

Le PDF **doit contenir une couche texte**. Un PDF scanné (image seule) n'en
produit pas : rien n'est ingéré, et le chatbot répondra que le contexte ne
contient pas la réponse.

## 2. Answering

Déclenchée par un message dans le chat.

| Étape | Nœud(s) | Ce qui se passe |
|---|---|---|
| Entrée / chat | `Answer Chat Trigger` | reçoit le message et l'identifiant de conversation |
| Contexte | `Load Session History` + `Build Context` | recharge les 20 derniers messages |
| Reformulation | `Query Reformulation` + `Parse Reformulation` | réécrit la question de façon autonome |
| Recherche | `Answer Vector Search` + `Answer Embeddings` | 100 fragments les plus proches dans `documents` |
| Classement | `Merge Candidates` + `Re-rank Chunks` | l'IA garde les 3 meilleurs |
| Génération | `Build Answer Context` + `Generate Answer` | réponse rédigée à partir de ces 3 fragments seuls |
| Mémoire | `Build History Rows` + `Save Chat Turn` + `Chat Response` | enregistre l'échange et renvoie la réponse |

La **reformulation** est ce qui permet de comprendre une question de suivi :
« Et l'Afrique du Sud ? » est réécrit en une question complète grâce à
l'historique, avant la recherche.

La recherche est volontairement à **haut rappel** (100 fragments) et le classement
à **haute précision** (3 fragments) : mieux vaut trop de candidats à filtrer que
l'inverse.

## Importer dans n8n

Dans l'UI n8n : **Workflows → ⋯ → Import from File**, et choisir
`workflow/rag-chatbot.workflow.ts`.

## Prérequis sur l'instance

**Credentials** (Settings → Credentials) : une clé Google Gemini pour les nœuds
`googleGemini` et `embeddingsGoogleGemini`, une clé Supabase pour le vector store.

**Variable** (Settings → Variables) : `WORKFLOW_ID` contenant l'identifiant de ce
workflow. Le nœud `Call 'RAG N8N'` s'appelle lui-même pour écrire chaque fragment :
l'identifiant vient de la variable pour que le dépôt reste portable d'une instance
à l'autre.

**Data Table** : `rag_chat_history`, à créer avant d'activer (voir
`data-tables/rag-chat-history.md`).

**Table Supabase** : `documents`, avec la fonction `match_documents` utilisée par le
nœud Vector Store. Pour changer de livre, vider la table avec
`DELETE FROM documents` — jamais `DROP TABLE`, qui supprimerait la fonction de
recherche.

## Limites connues

- Les métadonnées des fragments ne sont pas renseignées : une réponse ne peut pas
  citer le livre ni la page dont elle vient.
- Le classement ne lit que les 400 premiers caractères de chaque fragment. Sur un
  ouvrage dense (tableaux, définitions, données chiffrées), l'information utile
  peut se trouver après et le fragment choisi n'est pas le meilleur.
- Chaque fragment de l'ingestion consomme une exécution n8n, le nœud
  `Call 'RAG N8N'` fonctionnant en mode `each`. Un livre de 300 pages représente
  environ 143 exécutions.
- L'historique de conversation survit au changement de livre : il faut vider
  `rag_chat_history` en même temps que `documents`, sinon la reformulation
  s'appuiera sur l'ancien contenu.
