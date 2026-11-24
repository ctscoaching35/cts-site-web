#!/usr/bin/env python3
"""Enregistre des échanges RÉELS du moteur v1 (CONTRAT_API_CTS.md, « MOTEUR v1 »), pour un athlète FICTIF, en appelant ses fonctions en
local : aucun appel à l'API en ligne, à Nolio ni à un athlète. Chaque fichier garde la requête (chemin, corps) et la réponse ; les essais
du site (scripts/test-ecriture-v9.mjs) rejouent la réponse quand le site envoie EXACTEMENT ce corps.

    MOTEUR_V1=~/"Site CTS"/.claude/worktrees/moteur-v1-540ea4 python3 scripts/enregistrer-moteur-v9.py PARAMETRES.json scripts/fixtures/moteur-v9

PARAMETRES.json : {"parametres": …}, produit par `parametresV9` (lib/app/moteurV9.ts) : le moteur accepte donc ce que le site envoie."""
import copy, datetime as dt, json, os, sys

sys.path.insert(0, os.path.expanduser(os.environ["MOTEUR_V1"]))
from moteur import semaine as S          # noqa: E402
from moteur import nolio as N            # noqa: E402
from moteur import tables as T           # noqa: E402

parametres = json.load(open(sys.argv[1]))["parametres"]
sortie = sys.argv[2]
os.makedirs(sortie, exist_ok=True)


def jsonable(x):
    return json.loads(json.dumps(x, default=str))


def enregistrer(nom, chemin, corps, reponse):
    corps, reponse = jsonable(corps), jsonable(reponse)
    json.dump({"requete": {"chemin": chemin, "corps": corps}, "reponse": reponse}, open(os.path.join(sortie, nom + ".json"), "w"),
              ensure_ascii=False, indent=1, sort_keys=False)
    return reponse


def vue_de_nolio(semaine, faites):
    """Ce que Nolio montrerait d'une semaine écrite : ses séances de course (avec leur identifiant), faites ou non, sans rien d'autre."""
    seances = []
    for j in semaine["jours"]:
        x = j["seance"]
        if not x or x["famille"] in ("renfo", "course"):
            continue
        fait = faites(x)
        seances.append({"id": x["id"], "date": j["date"], "titre": x["titre"], "duree_min": x["duree_min"], "etapes": [], "faite": True if fait else None,
                        "duree_faite_min": x["duree_min"] if fait else None, "rpe": 4 if fait else None, "ressenti": 3 if fait else None, "course": False})
    return {"lundi": semaine["lundi"], "seances": seances, "hooper": [], "activites_vues": sum(1 for s in seances if s["faite"])}


# 1. La trame (le numéro d'une semaine est son rang dans cette liste).
trame = {"semaines": S.trame(parametres), "version_moteur": T.VERSION_MOTEUR}
enregistrer("trame", "/v1/trame", {"parametres": parametres}, trame)
n1 = trame["semaines"][0]["numero"]

# 2. La première semaine : sans état, sans Nolio, sans réponse.
c1 = {"parametres": parametres, "numero": n1}
r1 = enregistrer("semaine-1", "/v1/semaine", c1, S.ecrire_la_semaine(parametres, n1))

# 3. La deuxième : l'état rendu, ce que Nolio montre de la première (toutes ses séances faites), la réponse du dimanche.
nolio1 = {"semaines": [vue_de_nolio(r1["semaine"], lambda x: True)]}
reponses = {"version": "normale", "arret": "non", "cles_pas_faites": [], "jours": ["mardi", "jeudi", "samedi", "dimanche"], "nb_seances": 4, "jour_sl": "dimanche"}
n2 = n1 + 1
c2 = {"parametres": parametres, "numero": n2, "etat": r1["etat"], "nolio": nolio1, "reponses": reponses}
r2 = enregistrer("semaine-2", "/v1/semaine", c2, S.ecrire_la_semaine(parametres, n2, copy.deepcopy(r1["etat"]), nolio1, reponses))

# 4. La deuxième réécrite : une nouvelle réponse arrive avant sa première séance ; MÊME numéro, MÊME état d'avant (celui de la première).
reponses_b = dict(reponses, nb_seances=3, jours=["mardi", "jeudi", "dimanche"])
c2b = {"parametres": parametres, "numero": n2, "etat": r1["etat"], "nolio": nolio1, "reponses": reponses_b}
enregistrer("semaine-2-reecrite", "/v1/semaine", c2b, S.ecrire_la_semaine(parametres, n2, copy.deepcopy(r1["etat"]), nolio1, reponses_b))

# 5. Le dimanche matin : la version du questionnaire de la semaine suivante, d'après ce que Nolio montre de la deuxième (une séance faite).
n3 = n2 + 1
premiere = next(j["seance"]["id"] for j in r2["semaine"]["jours"] if j["seance"] and j["seance"]["famille"] not in ("renfo", "course"))
nolio2 = {"semaines": [nolio1["semaines"][0], vue_de_nolio(r2["semaine"], lambda x: x["id"] == premiere)]}
cq = {"parametres": parametres, "numero": n3, "etat": r2["etat"], "nolio": nolio2}
enregistrer("questionnaire", "/v1/questionnaire", cq, {"version": S.version_du_questionnaire(parametres, n3, copy.deepcopy(r2["etat"]), nolio2)})
nolio_vide = {"semaines": [nolio1["semaines"][0], vue_de_nolio(r2["semaine"], lambda x: False)]}
cq0 = {"parametres": parametres, "numero": n3, "etat": r2["etat"], "nolio": nolio_vide}
enregistrer("questionnaire-aucune-seance-vue", "/v1/questionnaire", cq0,
            {"version": S.version_du_questionnaire(parametres, n3, copy.deepcopy(r2["etat"]), nolio_vide)})

# 5 bis. Le lundi : Nolio montre la deuxième semaine écrite (ses séances posées par le moteur, aucune faite) ; une nouvelle réponse arrive avant la
# première séance : même numéro, même état d'avant.
c2l = {"parametres": parametres, "numero": n2, "etat": r1["etat"], "nolio": nolio_vide, "reponses": reponses_b}
enregistrer("semaine-2-reecrite-le-lundi", "/v1/semaine", c2l, S.ecrire_la_semaine(parametres, n2, copy.deepcopy(r1["etat"]), nolio_vide, reponses_b))

# 6. Une réponse après une séance faite : un arrêt et une séance clé pas faite ; la semaine n'est pas réécrite.
cle = next(x["id"] for j in r2["semaine"]["jours"] if j["seance"] for x in [j["seance"]] if x["famille"] in ("seuil1", "tempo", "seuil2", "vo2max", "mecanique"))
tardive = {"version": "normale", "arret": "quelques_jours", "cause": "blessure", "cles_pas_faites": [cle]}
ct = {"parametres": parametres, "numero": n2, "etat": r2["etat"], "nolio": nolio2, "reponses": tardive}
enregistrer("reponse-tardive", "/v1/reponse-tardive", ct, S.reponse_tardive(parametres, n2, copy.deepcopy(r2["etat"]), nolio2, tardive))

# 7. La semaine pour Nolio : ses séances et son bandeau, avec le profil de l'athlète.
profil = {"fc_seuil1": 150, "fc_seuil2": 168, "vc_ms": 3.6}
enregistrer("nolio-seances", "/v1/nolio/seances", {"semaine": r2["semaine"], "profil": profil}, N.corps_de_la_semaine(r2["semaine"], profil))
print("enregistré dans", sortie, ":", ", ".join(sorted(os.listdir(sortie))))
