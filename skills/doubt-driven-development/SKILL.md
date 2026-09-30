---
name: Doubt-Driven Development
description: À utiliser PENDANT le développement, pendant que l'IA construit. L'empêche de considérer sa première idée ou sa première solution comme définitive : elle vérifie ses hypothèses, cherche des alternatives, questionne l'approche courante et itère. Déclencheur : dès qu'une décision technique est prise, qu'un choix d'architecture est fait, qu'une brique est écrite, ou à chaque étape intermédiaire d'un projet.
---

# Doubt-Driven Development

## Objectif

Empêcher l'IA de considérer sa première idée comme définitive. Cette skill
accompagne tout le développement : chaque résultat intermédiaire est un
candidat à la remise en question, pas un acquis.

## Principe directeur

**Ne jamais considérer la première solution comme la solution finale.**

## Règles de conduite

### 1. Nommer les hypothèses explicitement

Avant d'écrire du code, formuler ce que l'on suppose vrai. Une hypothèse non
énoncée ne peut pas être vérifiée. Format recommandé :

> Je suppose que : (1) ..., (2) ..., (3) ...

Puis distinguer celles qui sont **certaines** de celles qui sont **probables**.

### 2. Chercher activement des alternatives

Avant de s'engager, identifier au moins deux autres approches possibles. Ne pas
les implémenter, mais les nommer et les comparer sur des critères explicites :
complexité, lisibilité, coût, réversibilité, risque.

> Alternative écartée : (a) ... — écartée parce que ...

Une absence d'alternatives trouvées est elle-même un signal d'alerte : soit la
question n'a pas été posée, soit la solution est évidente, ce qui est rare.

### 3. Tester la solution avant de la valider

Écrire le test, le cas limite, le scénario d'échec. Une solution qui n'a jamais
été exécutée n'est pas validée, elle est seulement écrite. Si l'exécution n'est
pas possible, le dire explicitement plutôt que de présenter le code comme
fonctionnel.

### 4. Se demander si l'approche est la bonne

À chaque brique livrée, poser la question structurelle : est-ce que ce mécanisme
est le bon, ou est-ce que jeourced cette solution parce que c'est la première
qui me soit venue ?

### 5. Itérer plutôt que défendre

Un résultat intermédiaire peut être :
- **confirmé** — les hypothèses se tiennent, on continue
- **amélioré** — le fond est bon, la forme est à ajuster
- **remis en cause** — l'approche ne tient pas, on repart

Seule la première option est un piège. Les deux autres sont des réussites.

### 6. Exposer les incertitudes restantes

Après chaque étape, indiquer ce qui n'a pas été vérifié et ce qui pourrait ne
pas fonctionner. Une étape livrée avec la mention explicite de ses limites
vaut mieux qu'une étape prétendument fiable.

## Grille de doute

À passer mentalement avant de déclarer une étape terminée :

| Question | Si la réponse est non |
|---|---|
| Les hypothèses sont-elles explicites ? | Les formuler avant d'aller plus loin |
| Une alternative a-t-elle été considérée ? | En chercher au moins une |
| Le cas d'échec a-t-il été testé ? | L'écrire et l'exécuter |
| L'approche est-elle la plus simple qui marche ? | Simplifier |
| Qu'est-ce qui n'a pas été vérifié ? | Le dire, ne pas le taire |

## Ce qu'il ne faut pas faire

- Présenter une solution sans mentionner qu'une alternative existait
- Dire « ça fonctionne » sans l'avoir exécuté
- Justifier a posteriori un choix par « c'est plus simple » sans l'avoir comparé
- Laisser une incertitude non dite devenir une conviction

## Exemple de formulation

> **Étape suivante : lecture de la config.**
> - Hypothèses : (1) le fichier existe, (2) il est du JSON valide. (1) est
>   certaine, (2) est probable.
> - Alternative écartée : un parseur tolérant — écarté parce que le fichier est
>   généré par nous, donc supposé valide.
> - Cas d'échec testé : JSON invalide → le parseur lève, le workflow s'arrête
>   proprement. Vérifié.
> - Non vérifié : le comportement si le fichier est vide.
