# n8n RAG — cours

Dépôt créé dans le cadre d'un cours sur **n8n et les systèmes RAG** (*Retrieval
Augmented Generation*). Il rassemble les deux projets réalisés pendant le cours,
construits sur n8n Cloud et déployés via le SDK TypeScript `@n8n/workflow-sdk`.

## Les deux projets

### [Projet Boussole](Projet%20Boussole/)

Assistant de suivi de routine, d'énergie et d'équilibre de vie. Dans le chat,
`/matin` ou `/soir` ouvre un formulaire qui pose les questions une par une
(énergie, sommeil, stress, objectif). Le workflow appelle ensuite Mistral avec le
point du jour et les 7 derniers jours, et renvoie un message accompagné de 2 ou
3 recommandations concrètes.

### [Projet Chatbot](Projet%20Chatbot/)

Chatbot de type RAG qui répond à des questions sur un livre. Le workflow
comporte deux parties :

- **Ingestion** — un PDF est découpé en fragments, converti en vecteurs et stocké
  dans Supabase.
- **Answering** — une question est reformulée, recherchée dans ces vecteurs, puis
  la réponse est rédigée à partir des seuls fragments retenus, en tenant compte de
  l'historique de la conversation.

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| [`Projet Boussole/`](Projet%20Boussole/) | workflow, scripts de déploiement et schémas de Data Tables |
| [`Projet Chatbot/`](Projet%20Chatbot/) | workflow RAG et schéma de la table d'historique |
| [`skills/`](skills/) | compétences réutilisables (interview, revue critique, développement guidé par le doute) |

Aucun secret n'est versionné : les clés d'API et les tokens n8n se passent par des
variables d'environnement. Voir [`.gitignore`](.gitignore).
