# Skills

Trois skills génériques pour encadrer le travail d'une IA sur n'importe quel
projet : application, web app, automatisation, développement logiciel, analyse,
création d'un outil.

## Les trois skills

| Skill | Moment | Rôle |
|---|---|---|
| [Interview](interview/SKILL.md) | avant de commencer | faire émerger le besoin réel avant d'écrire quoi que ce soit |
| [Doubt-Driven Development](doubt-driven-development/SKILL.md) | pendant le développement | empêcher la première solution d'être considérée comme définitive |
| [Hostile Review](hostile-review/SKILL.md) | une fois terminé | auditer le résultat final en cherchant activement les défauts |

## La logique

```
Interview                 → comprendre le problème
Doubt-Driven Development  → construire en remettant ses choix en question
Hostile Review            → critiquer le résultat final
```

## Utilisation

Chaque skill est un fichier `SKILL.md` avec un frontmatter `name` et
`description`. Le champ `description` est ce que l'IA lit pour savoir **quand**
déclencher la skill ; le corps décrit **comment** elle doit se comporter.

Pour les utiliser dans un projet, pointez votre outil vers ce dossier, ou copiez
les `SKILL.md` dans l'emplacement attendu par cet outil (`~/.claude/skills/`,
`.agents/skills/`, etc. — selon l'outil).
