# Data Tables du projet Boussole

Quatre tables à créer sur l'instance n8n avant d'activer le workflow.
Le workflow les lit et les écrit via l'API REST (`/api/v1/data-tables/{id}/rows`),
en utilisant la variable `N8N_API_KEY`.

## `boussole_quotidien`

Un point par jour, matin ou soir.

| Colonne | Type | Rôle |
|---|---|---|
| `date` | date | jour du point |
| `moment` | string | `matin` ou `soir` |
| `energie` | number | 1 à 5 |
| `sommeil_h` | number | heures dormies, ex. 7.5 |
| `stress` | number | 1 à 5 |
| `activite` | string | objectif du jour ou bilan de la journée |
| `objectif` | string | réservé |
| `bilan` | string | réservé |

C'est la source du contexte des 7 derniers jours envoyé au modèle.

## `boussole_etat`

État du formulaire en cours, une ligne par session de chat.

| Colonne | Type | Rôle |
|---|---|---|
| `etat_id` | string | clé primaire (= `sessionId` du chat) |
| `session` | string | identifiant de session du chat |
| `etape` | string | `attente`, `energie`, `sommeil`, `stress` ou `texte` |
| `moment` | string | `matin` ou `soir` |
| `energie` | number | 1 à 5 |
| `sommeil_h` | number | heures dormies |
| `stress` | number | 1 à 5 |
| `texte` | string | objectif ou bilan saisi |
| `maj` | date | horodatage de mise à jour |

C'est ce qui permet au formulaire de s'étaler sur plusieurs messages : sans
cette table, n8n ne sait pas où en était la conversation.

## `boussole_conversations`

Archive des échanges.

| Colonne | Type | Rôle |
|---|---|---|
| `ts` | date | horodatage |
| `session` | string | session du chat |
| `role` | string | `user` ou `assistant` |
| `contenu` | string | texte du message |

Les commandes `/matin` et `/soir` ne sont pas archivées : ce ne sont pas des
échanges.

## `boussole_bilans`

Un bilan par période.

| Colonne | Type | Rôle |
|---|---|---|
| `periode` | string | `jour`, `semaine`, `mois` ou `annee` |
| `debut` | date | début de la période |
| `fin` | date | fin de la période |
| `contenu` | string | bilan rédigé |
| `ts` | date | horodatage de génération |

Alimentée par le workflow de bilans automatiques, qui n'est pas inclus dans ce
dépôt.

## Création par API

```bash
curl -X POST https://<instance>/api/v1/data-tables \
  -H "X-N8N-API-KEY: <ta-cle>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "boussole_etat",
    "columns": [
      {"name": "etat_id", "type": "string"},
      {"name": "session", "type": "string"},
      {"name": "etape", "type": "string"},
      {"name": "moment", "type": "string"},
      {"name": "energie", "type": "number"},
      {"name": "sommeil_h", "type": "number"},
      {"name": "stress", "type": "number"},
      {"name": "texte", "type": "string"},
      {"name": "maj", "type": "date"}
    ]
  }'
```

Les colonnes doivent être créées avant d'importer le workflow, sinon les nœuds
HTTP n'auront pas de table à écrire.
