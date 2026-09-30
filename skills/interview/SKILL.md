---
name: Interview
description: À utiliser AVANT de commencer tout nouveau projet, quand le besoin n'est pas encore complètement compris. L'IA pose les questions nécessaires pour cerner l'objectif, le contexte, les utilisateurs, les contraintes et les ambiguïtés, puis reformule le besoin pour valider la compréhension avant d'écrire la moindre ligne. Déclencheur : "je veux créer...", "j'aimerais faire...", "on doit développer...", ou dès qu'une demande est formulée sans que les détails soient posés.
---

# Interview

## Objectif

Garantir que le besoin est compris avant de produire quoi que ce soit. Cette
skill précède le développement : son rôle est de faire émerger ce qui manque,
pas de commencer à construire.

## Principe directeur

**Ne pas commencer à construire tant que le besoin n'est pas suffisamment
compris.**

## Déroulé

### 1. Cadrer l'objectif

Reformuler en une phrase : quel problème résout-on, pour qui ? Demander si
l'objectif formulé est un problème ou une solution déjà arrêtée — souvent la
demande initiale décrit une solution alors que le besoin est en amont.

### 2. Explorer le contexte

- Quel est le contexte d'usage réel, pas théorique ?
- Qu'est-ce qui existe déjà et doit être réutilisé ?
- Y a-t-il des contraintes de temps, d'équipe, de budget ?

### 3. Identifier les utilisateurs

- Qui utilise le résultat, exactement ?
- Quels sont les cas d'usage concrets, du premier au plus courant ?
- Quel niveau de compétence technique présumé chez eux ?

### 4. Extraire les contraintes

Techniques, de sécurité, de confidentialité, de coût, de conformité. Y compris
celles qui n'ont pas été dites explicitement mais qui découlent du contexte.

### 5. Traquer les ambiguïtés

Lister explicitement ce qui reste flou. Ne pas trancher silencieusement : une
ambiguïté non signalée devient une mauvaise décision prise sans le savoir.
Pour chaque ambiguïté, proposer une lecture par défaut et demander
confirmation.

### 6. Lister les informations manquantes

Ce qu'il faudrait savoir et qui n'est pas disponible. Distinguer :
- bloquant (on ne peut pas avancer)
- important (on peut avancer avec une hypothèse à valider)
- secondaire (pourra être tranché plus tard)

### 7. Reformuler et faire valider

Présenter la synthèse du besoin compris, puis **demander explicitement si c'est
bien cela**. Ne pas enchaîner sur le développement tant que la reformulation
n'est pas validée.

## Règles de conduite

- Poser des questions ouvertes avant des questions fermées.
- Grouper les questions par thème, éviter l'interrogatoire à la question
  unique.
- Ne jamais produire de code, d'architecture ou de choix technique avant la
  reformulation validée.
- Si l'utilisateur a manifestement déjà décidé d'une solution, le signaler
  courtoisement : demander quel est le besoin derrière, sans bloquer s'il
  confirme.
- Préférer peu de questions bien ciblées à une longue liste exhaustive.

## Sortie attendue

Une synthèse en quatre points : **objectif**, **utilisateurs**, **contraintes**,
**questions ouvertes**, suivie d'une demande de validation explicite.

## Exemple de formulation

> Avant de commencer, quatre points que j'ai compris de ton besoin — dis-moi si
> c'est juste :
> 1. **Objectif** : ...
> 2. **Utilisateurs** : ...
> 3. **Contraintes** : ...
> 4. **À clarifier** : ...
> Est-ce que ça correspond à ce que tu veux ? Y a-t-il des points à corriger ?
