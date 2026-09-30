# 1er idée de projet — Boussole

Assistant de suivi de routine, d'énergie et d'équilibre de vie, construit sur
n8n. Projet de cours : instance n8n Cloud, déploiement via MCP et le SDK
`@n8n/workflow-sdk`.

## Ce que fait le workflow

Taper `/matin` ou `/soir` dans le chat n8n ouvre un formulaire qui pose les
questions une par une : énergie (1-5), sommeil (heures), stress (1-5), puis
objectif ou bilan de la journée. Une valeur hors bornes est refusée et la
question est reposée.

À la dernière réponse, le workflow appelle Mistral avec le point du jour et les
7 derniers jours, puis renvoie un message et 2 ou 3 recommandations concrètes.
Tout autre message part en chat libre et obtient la même analyse.

Raccourci : `/matin 3, 7h, 2, finir la présentation` passe la ligne d'un coup.

## Fichiers

| Fichier | Rôle |
|---|---|
| `workflow/1er-idee-de-projet.js` | le workflow, code SDK (c'est le fichier à importer dans n8n) |
| `workflow/1er-idee-de-projet.json` | le même workflow au format JSON natif n8n |
| `scripts/` | utilitaires de génération et de déploiement MCP |
| `schema-datables.md` | structure des 4 tables de données |

## Importer dans n8n

Dans l'UI n8n : **Workflows → ⋯ → Import from File**, et choisir
`workflow/1er-idee-de-projet.js`. Ou par API :

```bash
curl -X POST https://<instance>/api/v1/workflows \
  -H "X-N8N-API-KEY: <ta-cle>" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"1er idée de projet\",\"code\":$(cat workflow/1er-idee-de-projet.js)}"
```

## Variables d'environnement à créer dans n8n

Les deux sont des **variables** (Settings → Variables), pas des secrets en clair
dans le workflow. Aucun secret n'est versionné ici.

| Variable | Rôle |
|---|---|
| `N8N_API_KEY` | clé API n8n, utilisée par les nœuds HTTP pour lire/écrire dans les Data Tables |
| `MISTRAL_API_KEY` | clé API Mistral, pour la rédaction des recommandations |

## Data Tables

À créer sur l'instance avant d'activer (voir `schema-datables.md`) :
`boussole_quotidien`, `boussole_etat`, `boussole_conversations`,
`boussole_bilans`.

## Choix techniques

**Appel direct à Mistral, sans AI Agent.** Un nœud HTTP Request vers
`api.mistral.ai/v1/chat/completions` avec `response_format: json_object`. Un agent
apporterait du tool-calling et de l'interprétation d'intentions pour un résultat
équivalent ; ici la réponse est du JSON qu'on contrôle et qu'on parse de façon
fiable, ce qui rend la contrainte « moins de 5 secondes » tenable.

**Pas de nœuds Data Table.** La première version utilisait le nœud `dataTable`
natif. Il faisait planter l'éditeur n8n Cloud à l'ouverture
(« Problem opening workflow ») et le validateur MCP le signalait par 5
avertissements. Remplacé par des appels HTTP vers l'API REST
`/api/v1/data-tables/{id}/rows` : même résultat, zéro avertissement, et
l'éditeur s'ouvre normalement.

**L'état du formulaire vit en base.** Un formulaire multi-tours ne peut pas tenir
dans une exécution n8n. L'étape courante est stockée dans `boussole_etat`, une
ligne par session ; chaque message relit, met à jour, et renvoie la question
suivante. Ça survit au redémarrage de n8n.

**Aucune dépendance externe.** Le chat est hébergé par n8n lui-même, sans
Telegram ni autre service. Les données ne quittent la machine que pour l'appel
Mistral.

## Garde-fou médical

Le prompt système des deux workflows interdit explicitement tout diagnostic et
tout vocabulaire médical, avec renvoi vers un professionnel. C'est une garde-fou
au niveau du prompt, pas une garantie technique : c'est une contrainte de
conception à maintenir, pas une propriété vérifiable du système.

## Limites connues

- Non exécuté de bout en bout. Le validateur MCP renvoie `valid: true` et zéro
  avertissement, mais le comportement réel des nœuds HTTP (lecture/écriture des
  tables, appel Mistral) n'a pas été vérifié sur l'instance.
- `boussole_bilans` est créée mais alimentée par un second workflow (bilans
  automatiques) qui n'est pas inclus ici.
- Le workflow n'ouvre pas tout seul à une heure fixe : n8n ne peut pas ouvrir
  une fenêtre de navigateur sans script externe.
