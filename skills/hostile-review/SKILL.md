---
name: Hostile Review
description: À utiliser APRÈS la fin du travail, une fois le résultat considéré comme terminé. L'IA adopte une posture de critique exigeante et cherche activement tout ce qui pose problème : erreurs, incohérences, oublis, failles, hypothèses injustifiées, limites, risques, éléments superflus ou non conformes au besoin initial. Déclencheur : "relis", "revue", "revue de code", "est-ce que c'est bon", ou systématiquement avant une livraison.
---

# Hostile Review

## Objectif

Auditer le résultat final en adoptant délibérément une posture de critique. Cette
skill intervient une fois le travail terminé : son rôle est de trouver ce qui ne
va pas, pas de valider.

## Principe directeur

**Considérer le résultat final comme quelque chose à challenger et à auditer, pas
comme quelque chose à valider automatiquement.**

## Posture

La critique est le travail, pas une politesse en fin de réponse. Un rapport de
revue qui commence par « c'est bien » et où la review est mise en aplat n'a
rien fait.

Règle simple : **si on ne trouve rien à critiquer, la revue n'a pas été faite.**
Chercher des défauts est le travail ; les trouver est normal.

## Axes d'audit

### 1. Conformité au besoin initial

Reprendre la reformulation validée en phase Interview et vérifier point par
point que le résultat y répond. Y a-t-il un écart, même petit ? Une exigence
oubliée en cours de route est le défaut le plus fréquent et le plus grave.

### 2. Erreurs et failles

- Cas limites non gérés, entrées invalides, valeurs nulles
- Logique qui tient sur un cas nominal mais casse ailleurs
- Divisions par zéro, index hors tableau, `undefined` supposé absent
- Gestion d'erreur absente ou qui masque la panne

### 3. Incohérences internes

- Un nom qui signifie deux choses selon le fichier
- Une constante définie ici et contredite ailleurs
- Un commentaire qui ne correspond plus au code qu'il décrit
- Deux chemins qui devraient être symétriques et ne le sont pas

### 4. Hypothèses injustifiées

Lister les hypothèses implicites : ce qui est supposé vrai sans l'avoir vérifié.
Une hypothèse non formulée est un risque invisible.

### 5. Ce qui est inutile

- Éléments ajoutés sans demande explicite
- Abstraction pour un seul cas d'usage
- Dépendance inutile
- Code mort, paramètre jamais utilisé

Sur ce point : demander si l'objet n'a pas été fait « au cas où ». Le superflu
coûte de la maintenance et de la confusion.

### 6. Limites et risques

Ce qui n'a pas été testé, ce qui n'est pas exécuté, ce qui pourrait ne pas
fonctionner en conditions réelles. Une limite non mentionnée devient une
découverte brutale chez quelqu'un d'autre.

### 7. Les choix à remettre en cause

Reprendre les décisions d'architecture et se demander, avec recul, si une
autre aurait été meilleure. Non pas pour tout refaire, mais pour signaler les
choix fragiles.

## Format de sortie

Classer les constats par gravité. Un rapport trié par ordre d'apparition n'est
pas exploitable.

```markdown
## Critique de <sujet>

### Bloquant
- **<titre>** : <description> — <où> — <correctif proposé>

### Important
- ...

### Mineur
- ...

### Non conforme au besoin initial
- ...

### Non vérifié
- ...

### Points remarks sur les choix
- ...
```

Si une section est vide, écrire explicitement « rien à signaler » plutôt que de
la supprimer : l'absence de constat est une information.

## Règles de conduite

- Chercher activement, ne pas se contenter de confirmer
- Chaque constat doit être localisé (fichier, nœud, ligne) et actionnable
- Proposer un correctif quand c'est possible, sinon poser la question
- Ne pas tcouberter d'une correction pour rendre le rapport moins dur
- Reconnaître ce qui est solide : mais **après** les défauts, pas avant
- Si le travail est bon, le dire — mais en ayant cherché longtemps, et en
  listant ce qui reste non vérifié

## Sortie attendue

Une liste de constats triés par gravité, chacun localisé et accompagné d'un
correctif possible. Un rapport sans aucun constat significatif doit être
considéré avec méfiance : c'est souvent un signe que la revue n'a pas été
menée.

## Exemple de formulation

> **Ce qui va bien** : le parseur a été testé sur 8 cas réels, dont les valeurs
> aberrantes.
>
> **Bloquant** : `getConnectionInfo` lit `envs.production` alors que l'instance
> s'appelle `prod` — le workflow partira toujours en erreur de config.
> Correctif : renommer partout, ou lire les deux noms.
>
> **Important** : le nœud Mistral n'a pas de credential. Le workflow s'active
> mais toute recommandation échoue. C'est documenté dans le README, mais le
> livrable n'est pas fonctionnel en l'état.
>
> **Non vérifié** : aucune exécution de bout en bout n'a eu lieu.
