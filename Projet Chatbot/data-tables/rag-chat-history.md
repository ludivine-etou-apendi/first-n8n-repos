# Data Table `rag_chat_history`

Mémorise les échanges du chatbot pour que la question suivante soit comprise
dans son contexte. À créer sur l'instance avant d'activer le workflow.

Deux nœuds l'utilisent :

- `Load Session History` la lit, filtrée sur `sessionId` (= l'identifiant de
  conversation fourni par le chat), 20 messages au plus ;
- `Save Chat Turn` y écrit deux lignes par question posée : une pour l'utilisateur,
  une pour l'assistant.

## Colonnes

Les quatre colonnes sont de type `string`. `id`, `createdAt` et `updatedAt` sont
ajoutées automatiquement par n8n.

| Colonne | Type | Rôle |
|---|---|---|
| `sessionId` | string | identifiant de la conversation, sert de clé de regroupement |
| `role` | string | `user` ou `assistant` |
| `content` | string | le message, en clair |
| `ts` | string | horodatage en millisecondes, sert au tri |

`ts` est stocké en chaîne et non en nombre pour rester compatible avec le type
`string` de la colonne. Les nœuds le comparent donc avec `localeCompare`.

## Remarque

Le workflow est conçu pour **un seul livre à la fois**. L'historique n'étant pas
rattaché à un livre, il faut vider cette table en même temps que la table
`documents` de Supabase quand on change d'ouvrage — sinon la reformulation
s'appuiera sur l'ancien contenu et posera la question dans le mauvais contexte.
