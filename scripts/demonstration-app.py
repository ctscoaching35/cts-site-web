#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les données de la démonstration de l'app des athlètes (lib/app/demonstration.ts) : quatre plans FICTIFS, faits par
le moteur, et ce qu'il écrit pour les états que la démonstration montre.

    PYTHONDONTWRITEBYTECODE=1 ~/"Site CTS"/.venv/bin/python3 scripts/demonstration-app.py

Écrit lib/app/exemples/app.json. Rien ne vient d'un vrai athlète : les prénoms sont inventés ; les courses, les niveaux,
les jours, les charges et les traces GPX sont ceux du corpus de lecture du moteur (exemples/corpus_lecture/profils.py,
charges.py et gpx/, dans le dépôt du moteur), sauf le semi-marathon sur route et la saison de fond, deux profils
inventés ici. Chaque plan sort du moteur comme à l'achat (cts_intake.valider_champs, cts_pdf_reel.construire_data_pdf,
cts_contenu.plan_en_donnees ; la saison de fond comme le site la range, lib/app/fond.ts), sa trame et ses fiches de
POST /v1/trame (cts_semaine.trame), et chaque semaine montrée par la démonstration est écrite par le moteur lui-même
(cts_semaine.ecrire_semaine), semaine après semaine, d'après des séances faites simulées ici :
  - « fatigue » : la semaine d'avant, deux séances au ressenti 2 et un Hooper de 17 (la fatigue franche) ;
  - « manquée » : la semaine d'avant, sa première séance de qualité non faite ;
  - « test » : la première semaine, sans aucun repère connu (TN1, TN2 : la séance qui sert de test devient le test) ;
  - « préparation » : la semaine d'une course de préparation ajoutée, et sa fiche de course (cts_pdf_reel.fiche_course_seule,
    POST /v1/fiche-course), sur la trace du GRF18 du corpus.
On le relance quand le moteur change ; on ne retouche jamais le JSON à la main. Rien n'est écrit dans le dépôt du
moteur (PYTHONDONTWRITEBYTECODE=1 : pas même ses caches).
"""
import datetime
import json
import os
import sys
import types

MOTEUR = os.path.expanduser(os.environ.get("CTS_MOTEUR", "~/Site CTS"))
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(SITE, "lib", "app", "exemples", "app.json")
CORPUS = os.path.join(MOTEUR, "exemples", "corpus_lecture")
sys.dont_write_bytecode = True
sys.path.insert(0, MOTEUR)
sys.path.insert(0, CORPUS)
os.chdir(MOTEUR)

import cts_fond  # noqa: E402
import cts_intake  # noqa: E402
from cts_contenu import plan_en_donnees  # noqa: E402
from cts_intake import semaines_formule, valider_champs  # noqa: E402
from cts_pdf_reel import _URLS_BIBLIOTHEQUE_GABARIT, construire_data_pdf, fiche_course_seule  # noqa: E402
from cts_semaine import (SCHEMA_PARAMETRES, donnees_actualisees, ecrire_semaine, parametres_du_plan,  # noqa: E402
                         plan_de_reference, trame)
from profils import PROFILS  # noqa: E402
from charges import CHARGES  # noqa: E402

D = datetime.date
UN_JOUR = datetime.timedelta(days=1)

# ─── La date du jour lue par le moteur (comme scripts/demonstration-coach.py) ──────────────────────────────────────
AUJOURDHUI = [D(2026, 11, 1)]


class _Jour(datetime.date):
    @classmethod
    def today(cls):
        return AUJOURDHUI[0]


_horloge = types.ModuleType("datetime_demonstration")
_horloge.__dict__.update(datetime.__dict__)
_horloge.date = _Jour
cts_intake.datetime = _horloge
cts_fond.datetime = _horloge

# ─── Les plans ────────────────────────────────────────────────────────────────────────────────────────────────────
# La course de tous les plans du corpus : le samedi 5 juin 2027 (exemples/corpus_lecture/profils.py, DATE_COURSE).
COURSE = D(2027, 6, 5)
# L'achat simulé : 60 jours avant le départ (la confirmation de charge sera demandée, lib/app/invitation.ts).
ACHAT_AVANT_DEPART = 60
VALEURS = {"fc_seuil1": True, "vc": True, "fc_seuil2": True}
PLANS = [
    {"cle": "L4", "profil": "L4", "nom": "Clara Morel", "gpx": True, "titre": "OCC — trail, confirmée, 7 séances, avec sa trace",
     # Une course de préparation (O2, PO3) : le GRF18 du corpus, sa trace comprise, huit semaines avant l'OCC.
     "preparation": {"nom": "GRF18", "date": "2027-04-04", "distance_km": 18.0, "dplus_m": 366.0, "chrono": "1h40",
                     "temps_h": 1.6667, "discipline": "trail", "mode": "gestion", "gpx": "L1"}},
    {"cle": "L1", "profil": "L1", "nom": "Lucas Garnier", "gpx": False, "titre": "GRF18 — trail, débutant, 3 séances, sans trace"},
    {"cle": "R21", "nom": "Chloé Bernard", "titre": "Semi-marathon — route, intermédiaire, 4 séances",
     "champs": {"niveau": "intermediaire", "format": "R21", "duree_mois": "4", "course_nom": "Semi-marathon",
                "temps_cible": "1h50", "jours_disponibles": ["mardi", "jeudi", "samedi", "dimanche"], "jour_sl": "dimanche",
                "freq_hebdo": "4", "volume_hebdo_actuel": "3h30", "sortie_longue_actuelle": "1h15", "coupure": "non"}},
    {"cle": "F1", "nom": "Nicolas Faure", "fond": True, "titre": "Saison de fond — coaché sans objectif à préparer"},
]


def iso(d):
    return d.isoformat()


def minutes(duree):
    duree = str(duree)
    if "h" in duree:
        h, _, m = duree.partition("h")
        return int(h) * 60 + int(m or 0)
    return int(duree.split()[0]) if duree[:1].isdigit() else 0


def rpe_de(j):
    return int(j["rpe"]) if str(j.get("rpe", "")).isdigit() else None


def champs_corpus(p):
    (_id, titre, fmt, mois, km, dplus, tc, niv, jours, jsl, freq, terr) = p
    volume, sl = CHARGES[_id]
    return {"nom": "Démonstration", "email": "demonstration@cts.test", "niveau": niv, "format": fmt,
            "duree_mois": str(mois), "course_nom": titre.split(" — ")[0], "distance_km": str(km), "dplus_m": str(dplus),
            "dmoins_m": str(dplus), "temps_cible": f"{int(tc)}h{round((tc - int(tc)) * 60):02d}", "terrain": terr,
            "jours_disponibles": list(jours), "jour_sl": jsl, "freq_hebdo": str(freq), "volume_hebdo_actuel": volume,
            "sortie_longue_actuelle": sl, "coupure": "non", "date_course": iso(COURSE)}


def debut_du_plan(champs):
    n = semaines_formule(champs["format"], int(champs["duree_mois"]))
    return COURSE - datetime.timedelta(weeks=n - 1) - datetime.timedelta(days=COURSE.weekday())


def plan_achete(c):
    """(donnees, parametres, champs, achat) : le plan tel qu'il se range à l'achat (api.py, /v1/plans)."""
    if c.get("profil"):
        p = next(x for x in PROFILS if x[0] == c["profil"])
        champs = champs_corpus(p)
    else:
        champs = {"nom": "Démonstration", "email": "demonstration@cts.test", "date_course": iso(COURSE), **c["champs"]}
    achat = debut_du_plan(champs) - datetime.timedelta(days=ACHAT_AVANT_DEPART)
    AUJOURDHUI[0] = achat
    intake, refus = valider_champs(champs)
    if refus:
        raise SystemExit(f"{c['cle']} : {refus}")
    gpx = os.path.join(CORPUS, "gpx", f"{c['profil']}.gpx") if c.get("gpx") else None
    data = construire_data_pdf(intake, gpx, _URLS_BIBLIOTHEQUE_GABARIT)
    donnees = json.loads(json.dumps(plan_en_donnees(data), ensure_ascii=False, default=str))
    params = parametres_du_plan(champs, achat, data["parametres_gpx"])
    return donnees, params, champs, achat


def saison_de_fond(c):
    """Une saison de fond comme le site la range (lib/app/fond.ts, creerSaison ; scripts/demonstration-coach.py)."""
    debut = D(2026, 10, 12)
    AUJOURDHUI[0] = debut - UN_JOUR
    champs = {"niveau": "intermediaire", "terrain": "vallonne", "jours_disponibles": ["mardi", "jeudi", "samedi", "dimanche"],
              "jour_sl": "dimanche", "freq_hebdo": "4", "coupure": "non", "blessure": "non",
              "volume_hebdo_actuel": "4h30", "sortie_longue_actuelle": "1h45"}
    params = {"schema": SCHEMA_PARAMETRES, "champs": champs, "declaree_le": iso(debut),
              "plage_dominante": None, "bande_majeure": None,
              "fond": {"debut": iso(debut), "saison": 1, "entree": False, "sl_reference_h": None,
                       "volume_reference_h": None, "accent": None}}
    t = trame(params)
    donnees = json.loads(json.dumps(donnees_actualisees(params, None), ensure_ascii=False, default=str))
    donnees["course"] = {**donnees["course"], "nom": "Saison de fond 1", "date": t["fond"]["fin"],
                         "date_debut_plan": t["fond"]["debut"]}
    donnees["fond"] = t["fond"]
    return donnees, params, champs, debut - UN_JOUR, t


# ─── Les séances faites simulées ──────────────────────────────────────────────────────────────────────────────────

def seances_faites(sem, scenario):
    """Ce que Nolio aurait de la semaine écrite `sem` : chaque séance faite au RPE prévu, ressenti 4, sauf le
    scénario ; et le Hooper du dimanche."""
    qualites = [j for j in sem["jours"] if j["famille"] in ("qualite", "mecanique") and minutes(j["duree"])]
    autres = [j for j in sem["jours"] if j["famille"] not in ("repos", "course") and minutes(j["duree"])]
    manquees = {j["id"] for j in qualites[:1]} if scenario == "manquee" else set()
    dures = {j["id"] for j in autres[-3:-1]} if scenario == "fatigue" else set()
    seances = []
    for j in sem["jours"]:
        if j["famille"] in ("repos", "course") or not minutes(j["duree"]) or j["id"] in manquees:
            continue
        seances.append({"id": j["id"], "date": j["date_iso"], "faite": True, "duree_min": minutes(j["duree"]),
                        "rpe": rpe_de(j), "ressenti": 2 if j["id"] in dures else 4,
                        "dplus_m": round(minutes(j["duree"]) * 12)})
    prevues = {j["id"]: {"duree_min": minutes(j["duree"]), "rpe": rpe_de(j)}
               for j in sem["jours"] if j["famille"] not in ("repos", "course") and minutes(j["duree"])}
    hooper = 17 if scenario == "fatigue" else 10
    return seances, prevues, hooper


def ecrire_jusqua(params, champs, k, scenario=None, valeurs=VALEURS):
    """La semaine k écrite par le moteur, semaine après semaine depuis la première, chacune d'après la précédente ; le
    scénario joue la semaine k-1. Rend la sortie du moteur pour k."""
    _, plan = plan_de_reference(params)
    lundis = {s["numero"]: s["_lundi"] for s in plan["semaines"]}
    etat, retours, hoopers = None, None, []
    questionnaire = {"jours": list(champs.get("jours_disponibles") or []), "jour_sl": champs.get("jour_sl"),
                     "nb_seances": int(champs.get("freq_hebdo") or 4), "arret": False}
    sortie = None
    for n in range(1, k + 1):
        lundi = lundis[f"S{n}"]
        AUJOURDHUI[0] = lundi - UN_JOUR
        sortie = ecrire_semaine(params, f"S{n}", etat, retours, valeurs=valeurs)
        etat = sortie["etat"]
        seances, prevues, hooper = seances_faites(sortie["semaine"], scenario if n == k - 1 else None)
        hoopers.append({"date": iso(lundi + datetime.timedelta(days=6)), "valeur": hooper})
        retours = {"seances": seances, "hooper": hoopers[-6:], "questionnaire": questionnaire,
                   "nolio": {"prevues": prevues, "ajoutees": []}}
    return sortie


def semaine_montree(sortie):
    """Ce que l'app lit d'une semaine écrite (semaines_ecrites.donnees) et ce que le moteur en dit : ses notes Nolio et
    son journal, pour le bandeau de la démonstration."""
    return {"semaine": sortie["semaine"], "notes": sortie.get("notes") or [], "journal": sortie.get("journal") or []}


def numero_de(trame_, predicat, apres=0):
    for i, l in enumerate(trame_["semaines"]):
        if i >= apres and predicat(l):
            return l["numero"], i + 1
    return None, None


def main():
    sortie = {"genere_le": datetime.date.today().isoformat(), "plans": {}}
    for c in PLANS:
        if c.get("fond"):
            donnees, params, champs, achat, t = saison_de_fond(c)
        else:
            donnees, params, champs, achat = plan_achete(c)
            t = trame(params, [f["cle"] for f in (donnees.get("pour_aller_plus_loin") or {}).get("fiches") or []])
        donnees["athlete"] = {"nom": c["nom"]}
        semaines = {}
        if not c.get("fond"):
            # Une semaine de charge au milieu du plan, après une autre semaine de charge : la fatigue, la séance manquée.
            charges = [i for i, l in enumerate(t["semaines"]) if l["type"] == "Charge" and i >= 3
                       and t["semaines"][i - 1]["type"] == "Charge" and i < len(t["semaines"]) * 0.75]
            k = charges[len(charges) // 2] + 1
            for scenario in ("fatigue", "manquee"):
                s = ecrire_jusqua(params, champs, k, scenario)
                semaines[scenario] = {"numero": f"S{k}", **semaine_montree(s)}
            # La semaine de test : la première, sans aucun repère (un acheteur, avec son accord de lecture).
            s = ecrire_jusqua(params, champs, 1, None, {"fc_seuil1": False, "vc": False, "fc_seuil2": False,
                                                         "lecture": True, "coache": False})
            semaines["test"] = {"numero": "S1", **semaine_montree(s)}
            # Le week-end choc : la première semaine qui en a un.
            numero, _ = numero_de(t, lambda l: l.get("week_end_choc"))
            if numero:
                semaines["choc"] = {"numero": numero}
        else:
            # La semaine de tests de la saison.
            numero, n = numero_de(t, lambda l: l.get("tests"))
            if numero:
                semaines["test"] = {"numero": numero, **semaine_montree(ecrire_jusqua(params, champs, n))}
        preparation = None
        if c.get("preparation"):
            prep = {k: v for k, v in c["preparation"].items() if k != "gpx"}
            params_prep = {**params, "courses_secondaires": [prep]}
            t_prep = trame(params_prep, [f["cle"] for f in (donnees.get("pour_aller_plus_loin") or {}).get("fiches") or []])
            numero, n = numero_de(t_prep, lambda l: l["lundi"] <= prep["date"] <= iso(D.fromisoformat(l["lundi"]) + datetime.timedelta(days=6)))
            AUJOURDHUI[0] = achat
            _, plan = plan_de_reference(params)
            fiche = fiche_course_seule({"nom": prep["nom"], "date": D.fromisoformat(prep["date"]), "distance_km": prep["distance_km"],
                                        "dplus_m": prep["dplus_m"], "dmoins_m": None, "temps_h": prep["temps_h"]},
                                       plan["niveau"], os.path.join(CORPUS, "gpx", f"{c['preparation']['gpx']}.gpx"), plan["semaines"])
            preparation = {"course": prep, "trame": t_prep["semaines"], "fiche": json.loads(json.dumps(fiche, ensure_ascii=False, default=str)),
                           "semaine": {"numero": numero, **semaine_montree(ecrire_jusqua(params_prep, champs, n))}}
        profil = {"niveau": champs.get("niveau"), "terrain": champs.get("terrain"),
                  "jours_disponibles": champs.get("jours_disponibles"), "jour_sl": champs.get("jour_sl"),
                  "freq_hebdo": champs.get("freq_hebdo")}
        sortie["plans"][c["cle"]] = {
            "titre": c["titre"], "achat": iso(achat), "niveau": champs.get("niveau"), "plan": donnees, "trame": t,
            "profil_entrainement": profil, "semaines": semaines, "preparation": preparation,
        }
        dates = (donnees["course"]["date_debut_plan"], donnees["course"]["date"])
        print(f"{c['cle']:4s} {donnees['course']['nom'][:22]:22s} {dates[0]} → {dates[1]}  {len(t['semaines']):2d} semaines  "
              f"{len(t.get('fiches') or [])} fiches  états {sorted(semaines)}{'  + préparation' if preparation else ''}")
        for cle, s in semaines.items():
            if s.get("journal"):
                print(f"     {cle:8s} {s['numero']} : {[j.get('regle') for j in s['journal']]}")
    sortie["version_moteur"] = sortie["plans"]["L4"]["plan"]["version_moteur"]
    with open(SORTIE, "w", encoding="utf-8") as f:
        json.dump(sortie, f, ensure_ascii=False, separators=(",", ":"), default=str)
    print(f"{SORTIE} : {os.path.getsize(SORTIE) // 1024} Ko")


if __name__ == "__main__":
    main()
