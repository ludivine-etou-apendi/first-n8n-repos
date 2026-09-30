"""Genere le code SDK n8n a partir du workflow JSON deja construit et teste.

Le SDK est un DSL fluide. Chaque noeud se declare (node/trigger/ifElse/switchCase)
puis le graphe se compose en arbre depuis le trigger :

    workflow('id', 'nom').add(declencheur).to(arbre)

Comme le JSON de reference part d'un seul trigger et que chaque noeud a un seul
chemin d'arrivee dans la grille `main`, on peut reconstruire l'arbre par
recursion sur les connexions.
"""
import json
import re

SRC = "1er idee de projet.json"
OUT = "boussole_sdk.ts"

# Identifiants de Data Tables de l'instance de dev -> variables d'environnement.
# Un depot partage ne doit pas embarquer les identifiants d'une instance.
TABLE_IDS = {
    "P7G27SLdIWYRTSXn": "TABLE_ETAT",
    "b52lE6aeplzD3ifn": "TABLE_QUOTIDIEN",
    "zpmCJfqEfW6mK9IT": "TABLE_CONVERSATIONS",
    "P7OxPmXXHduoXONC": "TABLE_BILANS",
}

KIND = {
    "@n8n/n8n-nodes-langchain.chatTrigger": "trigger",
    "n8n-nodes-base.chatTrigger": "trigger",
    "n8n-nodes-base.if": "ifElse",
    "n8n-nodes-base.switch": "switchCase",
}

IMPORTS = ["workflow", "node", "trigger", "ifElse", "switchCase", "merge", "expr"]


def ident(nom):
    b = re.sub(r"[^a-zA-Z0-9]+", "_", nom).strip("_").lower() or "n"
    return ("n_" + b) if b[0].isdigit() else b


def q(s):
    return json.dumps(s, ensure_ascii=False)


def conv(v):
    """Convertit les valeurs du JSON n8n vers ce que le SDK attend.

    Le SDK interprete une chaine '{"{{ ... }}"' comme une expression et y
    ajoute le '=' tout seul. Il ne faut donc surtout PAS entourer ces valeurs
    par expr(...) dans les parametres : le serveur le stocke litteralement et
    casse le workflow.

    On touche aussi les valeurs trop specifiques d'une instance : URL d'instance
    et identifiants de Data Tables sont remplaces par des variables
    d'environnement, pour que le workflow soit portable d'une instance a l'autre
    et ne fuite aucune identite dans un depot partage.
    """
    if isinstance(v, dict):
        return {k: conv(x) for k, x in v.items()}
    if isinstance(v, list):
        return [conv(x) for x in v]
    if isinstance(v, str):
        substitue = v
        # identifiants de tables de l'instance d'origine -> variables d'env
        for tid, var in TABLE_IDS.items():
            substitue = substitue.replace(tid, "{{ $vars." + var + " }}")
        # URL de l'instance -> variable d'env
        substitue = re.sub(r"https://[a-z0-9.-]+\.app\.n8n\.cloud",
                           "{{ $vars.N8N_URL }}", substitue)
        # si on a injecte une expression et que la valeur n'etait pas deja une
        # expression, il faut ajouter le '=' initial que n8n exige
        if substitue != v and "{{" in substitue and not v.startswith("="):
            return "=" + substitue
        return substitue
    return v


def declarer(nd):
    kind = KIND.get(nd["type"], "node")
    params = conv(nd.get("parameters", {}))
    corps = {"type": nd["type"], "version": nd.get("typeVersion", 1),
             "config": {"name": nd["name"], "parameters": params}}
    if "onError" in nd:
        corps["config"]["onError"] = nd["onError"]
    return "const %s = %s(%s);" % (
        ident(nd["name"]), kind, json.dumps(corps, ensure_ascii=False, indent=2))


def build():
    wf = json.load(open(SRC, encoding="utf-8"))
    nodes = {n["name"]: n for n in wf["nodes"]}
    conns = wf["connections"]
    var = {n["name"]: ident(n["name"]) for n in wf["nodes"]}

    def enfants(nom, idx):
        """Noeuds connectes en sortie `idx` de `nom`."""
        outs = conns.get(nom, {}).get("main", [])
        if idx >= len(outs) or not outs[idx]:
            return []
        return [e["node"] for e in outs[idx]]

    def sous_arbre(nom, idx, stack):
        """Retourne l'expression d'un noeud et de toute sa continuite, en texte."""
        if nom in stack:                      # garde-fou anti-cycle
            return var[nom]
        stack = stack + [nom]
        ntype = nodes[nom]["type"]

        if ntype == "n8n-nodes-base.if":
            vrai = sous_arbre(enfants(nom, 0)[0], 0, stack) if enfants(nom, 0) else None
            faux = sous_arbre(enfants(nom, 1)[0], 0, stack) if len(enfants(nom, 1)) and enfants(nom, 1) else None
            bloc = var[nom]
            if vrai:
                bloc += ".onTrue(%s)" % vrai
            if faux:
                bloc += ".onFalse(%s)" % faux
            return bloc

        if ntype == "n8n-nodes-base.switch":
            outs = conns.get(nom, {}).get("main", [])
            bloc = var[nom]
            for idx2 in range(len(outs)):
                e = enfants(nom, idx2)
                if not e:
                    continue
                suite = sous_arbre(e[0], 0, stack)
                bloc += ".onCase(%d, %s)" % (idx2, suite)
            return bloc

        # noeud ordinaire : on enchaine toujours vers sa premiere sortie,
        # meme si l'enfant est une feuille (un .to vers une feuille est valide).
        e = enfants(nom, idx)
        if not e:
            return var[nom]
        suite = sous_arbre(e[0], 0, stack)
        if suite == var[nom]:                 # garde-fou anti-boucle
            return var[nom]
        return "%s.to(%s)" % (var[nom], suite)

    # declencheur(s) : les noeuds sans parent dans la grille main
    parents = set()
    for src, c in conns.items():
        for out in c.get("main", []):
            for e in out or []:
                parents.add(e["node"])
    triggers = [n["name"] for n in wf["nodes"]
                if n["name"] not in parents and KIND.get(n["type"]) == "trigger"]
    if not triggers:
        triggers = [n["name"] for n in wf["nodes"] if n["name"] not in parents]

    flow = []
    for t in triggers:
        flow.append("  .add(%s)" % var[t])
        e = enfants(t, 0)
        if e:
            suite = sous_arbre(e[0], 0, [t])
            flow.append("  .to(%s)" % suite)

    decls = "\n\n".join(declarer(n) for n in wf["nodes"])
    code = ("import { %s } from '@n8n/workflow-sdk';\n\n" % ", ".join(IMPORTS)
            + decls + "\n\n"
            + "export default workflow('boussole', '1er idée de projet')\n"
            + "\n".join(flow) + ";\n")
    open(OUT, "w", encoding="utf-8").write(code)
    print("ecrit :", OUT, len(code), "caracteres")
    return OUT


if __name__ == "__main__":
    build()
