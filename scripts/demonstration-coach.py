#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Les données de la démonstration de l'espace coach (lib/app/demonstrationCoach.ts) : dix coachés FICTIFS, leurs
objectifs pris dans le corpus de lecture du moteur, et leurs semaines écrites par le moteur lui-même.

    ~/"Site CTS"/.venv/bin/python3 scripts/demonstration-coach.py

Écrit lib/app/exemples/coach.json. Rien ne vient d'un vrai coaché : les prénoms sont inventés ; les courses, les
niveaux, les jours et les charges sont ceux des huit profils du corpus (exemples/corpus_lecture/profils.py et
charges.py, dans le dépôt du moteur), datés pour la semaine de démonstration ; chaque semaine écrite, son journal, son
bilan, son pourquoi et ce qui a été fait sortent du moteur (cts_semaine.ecrire_semaine), à partir de séances faites
simulées ici, scénario par scénario. On le relance quand le moteur change ; on ne retouche jamais le JSON à la main.

La semaine de démonstration est celle du lundi LUNDI (la même que LUNDI_DEMONSTRATION, lib/app/demonstrationCoachPorte.ts) ;
le site simule le jour (?jour=, de ce lundi au lundi suivant). Le moteur lit la date du jour pour refuser une course
passée : il la lit ici à la date de chaque écriture, sauf pour les semaines de récupération, écrites au jour de la
course — le moteur 8.447 refuse /v1/recuperation une fois la course passée (« cette date est déjà passée »), ce qui est
toujours le cas d'une récupération. Une semaine que le moteur refuse ne part pas : le site la montre comme le passage
du dimanche la laisserait.
"""
import datetime
import json
import math
import os
import sys
import types

MOTEUR = os.path.expanduser(os.environ.get("CTS_MOTEUR", "~/Site CTS"))
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(SITE, "lib", "app", "exemples", "coach.json")
sys.path.insert(0, MOTEUR)
sys.path.insert(0, os.path.join(MOTEUR, "exemples", "corpus_lecture"))
os.chdir(MOTEUR)

import cts_fond  # noqa: E402
import cts_intake  # noqa: E402
from cts_intake import semaines_formule, valider_champs  # noqa: E402
from cts_pdf_reel import _URLS_BIBLIOTHEQUE_GABARIT, construire_data_pdf  # noqa: E402
from cts_semaine import (SCHEMA_PARAMETRES, donnees_actualisees, ecrire_semaine, parametres_du_plan,  # noqa: E402
                         semaine_de_recuperation, trame)
from cts_linter import ErreurQualite  # noqa: E402
from cts_semaine import ParametresInvalides  # noqa: E402
from cts_suivi import SEUILS_SUIVI  # noqa: E402
from profils import PROFILS  # noqa: E402
from charges import CHARGES  # noqa: E402

D = datetime.date
LUNDI = D(2026, 11, 9)
DIMANCHE = LUNDI + datetime.timedelta(days=6)
J = lambda n: LUNDI + datetime.timedelta(days=n)  # noqa: E731  (J(0) : le lundi de la semaine de démonstration)

# ─── La date du jour lue par le moteur ───────────────────────────────────────────────────────────────────────────
AUJOURDHUI = [LUNDI]


class _Jour(datetime.date):
    @classmethod
    def today(cls):
        return AUJOURDHUI[0]


_horloge = types.ModuleType("datetime_demonstration")
_horloge.__dict__.update(datetime.__dict__)
_horloge.date = _Jour
cts_intake.datetime = _horloge
cts_fond.datetime = _horloge

# ─── Les coachés ──────────────────────────────────────────────────────────────────────────────────────────────────
# k : la semaine du plan au lundi de démonstration. Scénarios : ce que leurs séances simulées font dire au site et au
# moteur. Les adresses sont en .test, les identifiants Nolio inventés.
COACHES = [
    {"id": "demo-lea", "nom": "Léa Martin", "profil": "L4", "k": 8, "app": True,
     "scenario": "tout va bien", "reperes": (152, 3.33, 171, 2.92)},
    {"id": "demo-hugo", "nom": "Hugo Bernard", "profil": "L4", "k": 8,
     "scenario": "séance clé manquée, un commentaire à lire, une course de préparation", "reperes": (158, 3.47, 176, 3.03),
     "preparation": {"nom": "GRF18", "date": "2026-11-21", "distance_km": 18, "dplus_m": 366, "chrono": "1h40",
                     "temps_h": 1.6667, "discipline": "trail", "mode": "gestion"}},
    {"id": "demo-ines", "nom": "Inès Moreau", "profil": "L5", "k": 13,
     "scenario": "plus dur que prévu, RPE à revoir", "reperes": (149, 3.06, 167, 2.69)},
    {"id": "demo-thomas", "nom": "Thomas Petit", "profil": "L0", "k": 10,
     "scenario": "mauvaises sensations, Hooper qui monte, fatigue franche", "reperes": (155, 3.56, 174, 3.11),
     "course_b": {"nom": "Les Lucioles", "date": "2026-12-05", "distance_km": 14.7, "dplus_m": 481}},
    {"id": "demo-camille", "nom": "Camille Roux", "profil": "L2", "k": 6, "mot": "2026-11-07",
     "scenario": "un mot pour toi, semaine du dimanche pas partie", "reperes": (161, 3.61, 178, 3.17)},
    {"id": "demo-julien", "nom": "Julien Fabre", "profil": "L6", "k": 9,
     "scenario": "silencieux depuis 8 jours, semaine posée à la main par le coach", "reperes": (147, 3.28, 166, 2.86)},
    {"id": "demo-manon", "nom": "Manon Girard", "profil": "L7", "pas_demarre": True, "sans_accord": True,
     "scenario": "sans accord de lecture, objectif pas encore démarré", "reperes": None},
    {"id": "demo-antoine", "nom": "Antoine Dubois", "profil": "L1", "k": 11,
     "scenario": "course dans 10 jours, rien après, objectif suivant demandé", "reperes": (163, 2.78, 179, 2.44)},
    {"id": "demo-sarah", "nom": "Sarah Lambert", "profil": "L3", "couru": D(2026, 11, 7),
     "scenario": "en récupération après sa course", "reperes": (151, 3.19, 170, 2.78)},
    {"id": "demo-nicolas", "nom": "Nicolas Faure", "fond": D(2026, 10, 12), "k": 5,
     "scenario": "sans objectif : saison de fond", "reperes": (156, 3.39, 173, 2.97),
     "course_a": {"nom": "Trail Alsace 47k", "date": "2027-06-05", "distance_km": 47, "dplus_m": 1772}},
]
SPORT_COURSE, SPORT_TRAIL = "spt_kNYHjuEzDJRiYCX", "spt_YprHS7jgV5vdsz0"
VALEURS = {"fc_seuil1": True, "vc": True, "fc_seuil2": True}
HEURE_PASSAGE = "T17:05:00Z"  # le premier passage du dimanche, 18 h 05 à Paris l'hiver


def minutes(duree):
    duree = str(duree)
    if "h" in duree:
        h, _, m = duree.partition("h")
        return int(h) * 60 + int(m or 0)
    return int(duree.split()[0]) if duree[:1].isdigit() else 0


def rpe_de(j):
    return int(j["rpe"]) if str(j.get("rpe", "")).isdigit() else None


def iso(d):
    return d.isoformat()


def champs_du_profil(p, date_course):
    (_id, titre, fmt, mois, km, dplus, tc, niv, jours, jsl, freq, terr) = p
    volume, sl = CHARGES[_id]
    return {"nom": "Démonstration", "email": "demonstration@cts.test", "niveau": niv, "format": fmt,
            "duree_mois": str(mois), "course_nom": titre.split(" — ")[0], "distance_km": str(km), "dplus_m": str(dplus),
            "dmoins_m": str(dplus), "temps_cible": f"{int(tc)}h{round((tc - int(tc)) * 60):02d}", "terrain": terr,
            "jours_disponibles": list(jours), "jour_sl": jsl, "freq_hebdo": str(freq), "volume_hebdo_actuel": volume,
            "sortie_longue_actuelle": sl, "coupure": "non", "coaching": "oui", "date_course": iso(date_course)}


def parametres_de(c):
    """(champs, parametres) : la course datée pour que la semaine k tombe le lundi de démonstration ; un objectif pas
    démarré garde la date du corpus ; une course courue, sa date."""
    p = next(x for x in PROFILS if x[0] == c["profil"])
    n = semaines_formule(p[2], p[3])
    if c.get("couru"):
        course = c["couru"]
    elif c.get("pas_demarre"):
        course = D(2027, 6, 5)
    else:
        debut = LUNDI - datetime.timedelta(weeks=c["k"] - 1)
        course = debut + datetime.timedelta(weeks=n - 1, days=5)
    champs = champs_du_profil(p, course)
    debut = course - datetime.timedelta(weeks=n - 1) - datetime.timedelta(days=course.weekday())
    declaree = debut - datetime.timedelta(days=8)
    AUJOURDHUI[0] = declaree
    intake, refus = valider_champs(champs)
    if refus:
        raise SystemExit(f"{c['id']} : {refus}")
    gpx = os.path.join(MOTEUR, "exemples", "corpus_lecture", "gpx", f"{c['profil']}.gpx")
    data = construire_data_pdf(intake, gpx if os.path.isfile(gpx) else None, _URLS_BIBLIOTHEQUE_GABARIT)
    params = parametres_du_plan(champs, declaree, data["parametres_gpx"])
    params.update({"au_rang_du_plan": True, "fondations_sautees": False})
    if c.get("preparation"):
        params["courses_secondaires"] = [c["preparation"]]
    return champs, params, declaree


def parametres_fond(c):
    debut = c["fond"]
    AUJOURDHUI[0] = debut - datetime.timedelta(days=1)
    champs = {"niveau": "intermediaire", "terrain": "vallonne", "jours_disponibles": ["mardi", "jeudi", "samedi", "dimanche"],
              "jour_sl": "dimanche", "freq_hebdo": "4", "coupure": "non", "blessure": "non",
              "volume_hebdo_actuel": "4h30", "sortie_longue_actuelle": "1h45"}
    params = {"schema": SCHEMA_PARAMETRES, "champs": champs, "declaree_le": iso(debut),
              "plage_dominante": None, "bande_majeure": None,
              "fond": {"debut": iso(debut), "saison": 1, "entree": False, "sl_reference_h": None,
                       "volume_reference_h": None, "accent": None}}
    return champs, params, debut - datetime.timedelta(days=1)


# ─── Les séances simulées ─────────────────────────────────────────────────────────────────────────────────────────
# Ce que le coaché a fait de chaque séance écrite : faite ou non, son RPE, son ressenti (sur 5), un commentaire ; et son
# Hooper du dimanche. Par défaut tout est fait, au RPE prévu, ressenti 4.

def premiere(sem, familles, apres=None):
    for j in sem["jours"]:
        if j["famille"] in familles and (apres is None or j["date_iso"] >= iso(apres)):
            return j
    return None


def scenario(c, sem, n, k):
    """{jour_id: {...}} pour la semaine n (k : la semaine de démonstration), et le Hooper de son dimanche."""
    s = {}
    hooper = {"demo-thomas": 11, "demo-ines": 9, "demo-julien": 8}.get(c["id"], 10) + (n % 3) - 1
    cid = c["id"]
    if cid == "demo-hugo":
        if n == k - 1:
            # Sa séance de VO2max du mardi (R8 au dimanche), puis celle du mercredi (le signal des 7 jours).
            for j in (premiere(sem, ("qualite",)), premiere(sem, ("qualite", "mecanique"), J(-5))):
                if j:
                    s[j["id"]] = {"faite": False}
        if n == k:
            j = next((x for x in sem["jours"] if x["date_iso"] == iso(J(0)) and x["famille"] != "repos"), None)
            if j:
                s[j["id"]] = {"commentaire": "Mollet droit un peu raide sur la fin, rien de méchant."}
    elif cid == "demo-ines":
        if n == k - 2:
            j = premiere(sem, ("qualite",))
            if j and rpe_de(j):
                s[j["id"]] = {"rpe": min(10, rpe_de(j) + 3)}
        if n == k - 1:
            # Une semaine allégée : sa sortie longue et ses navettes, plus dures que prévu.
            for j in sem["jours"]:
                if j["famille"] in ("sl", "mecanique") and rpe_de(j):
                    s[j["id"]] = {"rpe": min(10, rpe_de(j) + 3)}
        if n == k:
            j = next((x for x in sem["jours"] if x["date_iso"] == iso(J(1)) and x["famille"] != "repos"), None)
            if j and rpe_de(j):
                s[j["id"]] = {"rpe": min(10, rpe_de(j) + 3)}
    elif cid == "demo-thomas":
        if n == k - 1:
            for d in (J(-4), J(-2)):
                j = next((x for x in sem["jours"] if x["date_iso"] >= iso(d) and x["famille"] != "repos"), None)
                if j:
                    s[j["id"]] = {"ressenti": 2}
            hooper = 17
        if n == k:
            for d in (J(1), J(3)):
                j = next((x for x in sem["jours"] if x["date_iso"] >= iso(d) and x["famille"] != "repos"), None)
                if j:
                    s[j["id"]] = {"ressenti": 2}
            hooper = 15
    elif cid == "demo-julien":
        # Plus rien après le mardi de la semaine passée : sa montre, ou il décroche.
        for j in sem["jours"]:
            if j["date_iso"] > iso(J(-6)):
                s[j["id"]] = {"faite": False}
        if n >= k - 1:
            hooper = None
    return s, hooper


def seances_de(c, sem, n, k, ecrite):
    """Ce que Nolio a de la semaine : les séances prévues (écrites par le moteur), réalisées, et le Hooper."""
    cid = c["id"]
    s, hooper = scenario(c, sem, n, k)
    prevues, reelles = [], []
    for j in sem["jours"]:
        if j["famille"] in ("repos",) or minutes(j["duree"]) == 0:
            continue
        jid = j["id"]
        sport = SPORT_TRAIL if j["famille"] in ("sl", "mecanique", "course") else SPORT_COURSE
        # Nolio date les séances au jour ; elles remontent le matin le week-end, le soir en semaine.
        heure = "T08:30:00Z" if j["jour"] in ("Samedi", "Dimanche") else "T17:30:00Z"
        if j["famille"] != "course" and ecrite:
            prevues.append({"id": f"ptrn_{cid.replace('-', '')}{jid.replace('-', '')}", "name": j["seance"],
                            "date_start": j["date_iso"], "rpe": rpe_de(j), "sport": sport,
                            "duration": {"value": minutes(j["duree"]) * 60}, "jour_id": jid,
                            "_des": iso(D.fromisoformat(sem["lundi"]) - datetime.timedelta(days=1)) + HEURE_PASSAGE})
        x = s.get(jid, {})
        if x.get("faite") is False:
            continue
        duree = minutes(j["duree"])
        vitesse = 6.5 if sport == SPORT_TRAIL else 9.8
        reelles.append({"id": f"rtrn_{cid.replace('-', '')}{jid.replace('-', '')}", "name": j["seance"],
                        "date_start": j["date_iso"], "sport": sport,
                        "planned": f"ptrn_{cid.replace('-', '')}{jid.replace('-', '')}" if ecrite and j["famille"] != "course" else None,
                        "duration": {"value": duree * 60}, "distance": {"value": round(duree / 60 * vitesse, 1), "unit": "km"},
                        "elevation_gain": {"value": round(duree * (14 if sport == SPORT_TRAIL else 2))},
                        "debrief": {"rpe": x.get("rpe", rpe_de(j)), "feeling": x.get("ressenti", 4),
                                    "comment": x.get("commentaire")}, "jour_id": jid, "course": j["famille"] == "course",
                        "_des": j["date_iso"] + ("T10:30:00Z" if heure == "T08:30:00Z" else "T19:30:00Z")})
    return prevues, reelles, hooper


def retours_de(sem, prevues, reelles, hooper_hist, questionnaire, jusqua=None):
    """Les retours que le site lit dans Nolio pour écrire la semaine suivante (lib/app/ecriture.ts, lireRetours)."""
    garde = (lambda d: d <= jusqua) if jusqua else (lambda d: True)
    faites = {r["jour_id"]: r for r in reelles if r.get("planned") and garde(r["date_start"][:10])}
    seances = []
    for p in prevues:
        r = faites.get(p["jour_id"])
        if r:
            seances.append({"id": p["jour_id"], "date": r["date_start"][:10], "faite": True,
                            "duree_min": round(r["duration"]["value"] / 60), "rpe": r["debrief"]["rpe"],
                            "ressenti": r["debrief"]["feeling"], "dplus_m": r["elevation_gain"]["value"]})
    ajoutees = [{"date": r["date_start"][:10], "prevue_min": None, "rpe_prevu": None, "faite": True,
                 "duree_min": round(r["duration"]["value"] / 60), "rpe": r["debrief"]["rpe"],
                 "ressenti": r["debrief"]["feeling"], "dplus_m": r["elevation_gain"]["value"]}
                for r in reelles if not r.get("planned") and not r.get("course") and garde(r["date_start"][:10])]
    return {"seances": seances, "hooper": [h for h in hooper_hist if garde(h["date"])],
            "nolio": {"prevues": {p["jour_id"]: {"duree_min": round(p["duration"]["value"] / 60), "rpe": p["rpe"]}
                                  for p in prevues}, "ajoutees": ajoutees},
            **({"questionnaire": questionnaire} if questionnaire else {})}


# ─── Ce que le site garde ─────────────────────────────────────────────────────────────────────────────────────────

JOUR_KEYS = ("jour", "date", "seance", "terrain", "duree", "rpe", "famille", "id", "date_iso", "origine")
SEMAINE_KEYS = ("numero", "numero_int", "type", "bloc", "volume", "seances", "dates", "progression", "passee", "lundi", "theme")


def reduite(sem):
    """La semaine telle que les écrans du coach la lisent : sans le détail des séances (consignes, cartes, repères)."""
    out = {k: sem[k] for k in SEMAINE_KEYS if k in sem}
    out["jours"] = [{k: j[k] for k in JOUR_KEYS if k in j} for j in sem["jours"]]
    return out


def plan_reduit(donnees):
    """Le plan tel que les écrans du coach le lisent : sa course, ses semaines (leurs séances sont dans la trame et dans
    les semaines écrites)."""
    semaines = []
    for s in donnees["semaines"]:
        r = reduite(s)
        r["jours"] = []
        semaines.append(r)
    return {"schema": donnees["schema"], "version_moteur": donnees["version_moteur"], "athlete": donnees["athlete"],
            "course": donnees["course"], **({"fond": donnees["fond"]} if donnees.get("fond") else {}),
            "semaines": semaines, "pour_aller_plus_loin": {"fiches": []}}


def sortie_reduite(s):
    return {"semaine": reduite(s["semaine"]), "notes": s.get("notes") or [], "bilan": s.get("bilan"),
            "journal": s.get("journal") or [], "realise": s.get("realise"), "pourquoi": s.get("pourquoi"),
            "etat": None, "parametres": None}


def questionnaire_de(champs):
    return {"jours": list(champs.get("jours_disponibles") or []), "jour_sl": champs.get("jour_sl"),
            "nb_seances": int(champs.get("freq_hebdo") or 4), "arret": False}


def simuler(c):
    """Les semaines écrites d'un coaché, une par dimanche, chacune d'après la précédente."""
    fond = bool(c.get("fond"))
    champs, params, declaree = parametres_fond(c) if fond else parametres_de(c)  # noqa: F841
    plan_id = f"demo-plan-{c['id'][5:]}"
    params["_demonstration"] = plan_id
    t = trame(params)
    donnees = donnees_actualisees(params, None)
    if fond:
        # Comme le site range une saison (lib/app/fond.ts, creerSaison).
        donnees["course"] = {**donnees["course"], "nom": "Saison de fond 1", "date": t["fond"]["fin"],
                             "date_debut_plan": t["fond"]["debut"]}
        donnees["fond"] = t["fond"]
    donnees["athlete"] = {"nom": c["nom"]}
    semaines = donnees["semaines"]
    total = len(semaines)
    lundis = {s["numero"]: s["lundi"] for s in semaines}
    # Jusqu'où il a écrit : la semaine de démonstration et la suivante (le dimanche de démonstration, au soir).
    if c.get("couru"):
        dernier_n = total + 2
    elif c.get("pas_demarre"):
        dernier_n = 0
    else:
        dernier_n = c["k"] + 1
    k = c.get("k") or (total + 1 if c.get("couru") else 0)
    etat = None
    lignes, envois, prevues_nolio, reelles_nolio, hoopers = [], [], [], [], []
    apercus = []
    retours = None
    questionnaire = questionnaire_de(champs)
    jusqua_recup = None
    if not fond:
        # La reprise après la course (lib/app/ecriture.ts, debutApres) : deux jours par heure de course, 3 à 21.
        h, _, m = champs["temps_cible"].partition("h")
        fin = D.fromisoformat(champs["date_course"]) + datetime.timedelta(days=max(3, min(21, math.ceil(2 * (int(h) + int(m or 0) / 60)))))
        jusqua_recup = fin + datetime.timedelta(days=7 - fin.weekday())
    for n in range(1, dernier_n + 1):
        numero = f"S{n}"
        recup = n > total
        lundi = D.fromisoformat(lundis[numero]) if not recup else D.fromisoformat(lundis[f"S{total}"]) + datetime.timedelta(weeks=n - total)
        dimanche_avant = lundi - datetime.timedelta(days=1)
        AUJOURDHUI[0] = min(dimanche_avant, D.fromisoformat(champs.get("date_course") or iso(dimanche_avant))) if recup else dimanche_avant
        if recup and lundi >= jusqua_recup:
            break
        try:
            s = (semaine_de_recuperation(params, numero, iso(jusqua_recup), etat, retours) if recup
                 else ecrire_semaine(params, numero, etat, retours, valeurs=VALEURS))
            refus = None
        except (ErreurQualite, ParametresInvalides) as e:
            # Le moteur refuse : le passage du dimanche échoue, la semaine ne part pas.
            print(f"  {c['id']} {numero} : le moteur refuse ({str(e).splitlines()[-1][:120]})")
            s, refus = {"semaine": next(x for x in semaines if x["numero"] == numero), "etat": etat}, str(e)
        etat = s["etat"]
        sem = s["semaine"]
        # Les échecs et la semaine laissée au coach : rien d'écrit ni d'envoyé cette semaine-là.
        echec = (c["id"] == "demo-camille" and n >= k) or refus is not None
        laissee = c["id"] == "demo-julien" and n == k
        ecrite = not (echec or laissee)
        ecrite_le = iso(dimanche_avant) + HEURE_PASSAGE
        # Ce qui a été fait la semaine écoulée se range avec elle quand la suivante s'écrit.
        if ecrite and s.get("realise") and lignes:
            lignes[-1]["realise"] = s["realise"]
            lignes[-1]["_realise_des"] = ecrite_le
        if ecrite:
            lignes.append({"plan_id": plan_id, "numero": numero, "donnees": reduite(sem), "journal": s.get("journal") or [],
                           "bilan": s.get("bilan"), "sans_ajustement": False, "ecrite_le": ecrite_le, "realise": None,
                           "_des": ecrite_le})
            envois.append({"plan_id": plan_id, "semaine": numero, "envoye_le": ecrite_le,
                           "seances": [{"jour_id": j["id"], "nolio_id": f"ptrn_{c['id'].replace('-', '')}{j['id'].replace('-', '')}",
                                        "revision": "r1"} for j in sem["jours"] if j["famille"] not in ("repos", "course")],
                           "_des": ecrite_le})
        if laissee:
            envois.append({"plan_id": plan_id, "semaine": f"laissee:{iso(lundi)}", "envoye_le": ecrite_le, "seances": [],
                           "_des": ecrite_le})
        prevues, reelles, hooper = seances_de(c, sem, n, k, ecrite)
        if laissee:
            # Les séances que le coach a posées lui-même dans Nolio, avant le passage.
            for d, nom, m in ((1, "Footing de reprise", 40), (3, "Footing de reprise", 45), (5, "Sortie nature tranquille", 70)):
                prevues.append({"id": f"ptrn_coachjulien{d}", "name": nom, "date_start": iso(lundi + datetime.timedelta(days=d)),
                                "rpe": 3, "sport": SPORT_COURSE, "duration": {"value": m * 60}, "jour_id": None,
                                "_des": iso(lundi - datetime.timedelta(days=3)) + "T20:00:00Z"})
        if echec:
            # Il court quand même, de lui-même : deux sorties que Nolio rattache à rien.
            for d in (1, 4):
                if (lundi + datetime.timedelta(days=d)) <= DIMANCHE:
                    reelles.append({"id": f"rtrn_camille{n}{d}", "name": "Course à pied", "date_start": iso(lundi + datetime.timedelta(days=d)),
                                    "sport": SPORT_COURSE, "planned": None, "duration": {"value": 45 * 60},
                                    "distance": {"value": 7.4, "unit": "km"}, "elevation_gain": {"value": 60},
                                    "debrief": {"rpe": 4, "feeling": 4, "comment": None}, "jour_id": None,
                                    "_des": iso(lundi + datetime.timedelta(days=d)) + "T19:30:00Z"})
        prevues_nolio += prevues
        reelles_nolio += reelles
        if hooper is not None:
            hoopers.append({"date": iso(lundi + datetime.timedelta(days=6)), "valeur": hooper})
        q = questionnaire_de(champs)
        hooper_hist = [h for h in hoopers if h["date"] >= iso(lundi - datetime.timedelta(days=42))]
        retours = retours_de(sem, [p for p in prevues if p.get("jour_id")], reelles, hooper_hist, q)
        if c["id"] == "demo-julien" and n >= k - 1:
            retours.pop("questionnaire", None)
        # L'aperçu du dimanche de la semaine de démonstration : ce que le moteur écrirait, au fil de la semaine.
        if lundi == LUNDI and n < dernier_n:
            suivant = f"S{n + 1}"
            for vu_le in (J(2), J(5), J(6)):
                AUJOURDHUI[0] = vu_le
                r = retours_de(sem, [p for p in prevues if p.get("jour_id")], reelles,
                               hooper_hist if vu_le >= J(6) else [h for h in hooper_hist if h["date"] < iso(vu_le)],
                               q if vu_le >= J(5) else questionnaire, iso(vu_le - datetime.timedelta(days=1)))
                if c["id"] == "demo-julien":
                    r.pop("questionnaire", None)
                try:
                    if n + 1 > total:
                        if LUNDI + datetime.timedelta(weeks=1) >= jusqua_recup:
                            continue
                        AUJOURDHUI[0] = min(AUJOURDHUI[0], D.fromisoformat(champs["date_course"]))
                        a = semaine_de_recuperation(params, suivant, iso(jusqua_recup), etat, r)
                    else:
                        a = ecrire_semaine(params, suivant, etat, r, valeurs=VALEURS)
                except (ErreurQualite, ParametresInvalides) as e:
                    print(f"  {c['id']} aperçu {suivant} du {iso(vu_le)} : le moteur refuse ({str(e).splitlines()[-1][:120]})")
                    continue
                # La première vaut dès le lundi matin de la semaine de démonstration.
                des = iso(J(0) if vu_le == J(2) else vu_le) + "T06:00:00Z"
                apercus.append({"plan_id": plan_id, "numero": suivant, "des": des,
                                "sortie": sortie_reduite(a)})
        if lundi == LUNDI + datetime.timedelta(weeks=1) and n < dernier_n + 1:
            AUJOURDHUI[0] = lundi
            suivant = f"S{n + 1}"
            r = retours_de(sem, [], [], hooper_hist, questionnaire, iso(lundi))
            a = None
            try:
                if n + 1 <= total:
                    a = ecrire_semaine(params, suivant, etat, r, valeurs=VALEURS)
                elif jusqua_recup and lundi + datetime.timedelta(weeks=1) < jusqua_recup:
                    AUJOURDHUI[0] = min(lundi, D.fromisoformat(champs["date_course"]))
                    a = semaine_de_recuperation(params, suivant, iso(jusqua_recup), etat, r)
            except (ErreurQualite, ParametresInvalides) as e:
                print(f"  {c['id']} aperçu {suivant} du {iso(lundi)} : le moteur refuse ({str(e).splitlines()[-1][:120]})")
            if a:
                apercus.append({"plan_id": plan_id, "numero": suivant, "des": iso(lundi) + "T06:00:00Z",
                                "sortie": sortie_reduite(a)})
    if c.get("pas_demarre"):
        pass
    # Ce que les écrans lisent : le détail des trois dernières semaines écrites, et Nolio sur dix semaines.
    for l in lignes[:-3]:
        l["donnees"] = {"numero": l["donnees"]["numero"], "lundi": l["donnees"]["lundi"], "jours": []}
    depuis = iso(LUNDI - datetime.timedelta(weeks=10))
    prevues_nolio = [{k: v for k, v in x.items() if k != "jour_id"} for x in prevues_nolio if x["date_start"] >= depuis]
    reelles_nolio = [{k: v for k, v in x.items() if k not in ("jour_id", "course")} for x in reelles_nolio if x["date_start"] >= depuis]
    return {
        "plan": {"id": plan_id, "athlete_id": c["id"], "course_nom": donnees["course"]["nom"],
                 "course_date": donnees["course"]["date"], "debut_plan": donnees["course"]["date_debut_plan"],
                 "schema": donnees["schema"], "version_moteur": donnees["version_moteur"], "donnees": plan_reduit(donnees),
                 "intake": {k: v for k, v in champs.items() if k not in ("nom", "email")},
                 "parametres": params, "trame": t,
                 "demarre_le": None if c.get("pas_demarre") else iso(D.fromisoformat(lundis["S1"]) - datetime.timedelta(days=1)) + HEURE_PASSAGE,
                 "depart_prevu": None, "cree_le": iso(declaree) + "T10:00:00Z"},
        "semaines_ecrites": lignes, "nolio_envois": envois, "apercus": apercus,
        "nolio": {"prevues": prevues_nolio, "reelles": reelles_nolio,
                  "hooper": [{"id": f"mval_{c['id'].replace('-', '')}{h['date'].replace('-', '')}", "date_start": h["date"],
                              "value": h["valeur"], "_des": h["date"] + "T08:00:00Z"} for h in hoopers]},
    }


def main():
    sortie = {"genere_le": datetime.date.today().isoformat(), "lundi": iso(LUNDI), "athletes": [], "plans": [],
              "semaines_ecrites": [], "nolio_envois": [], "apercus": [], "nolio": {}}
    for c in COACHES:
        r = simuler(c)
        sortie["plans"].append(r["plan"])
        sortie["semaines_ecrites"] += r["semaines_ecrites"]
        sortie["nolio_envois"] += r["nolio_envois"]
        sortie["apercus"] += r["apercus"]
        sortie["nolio"][c["id"]] = r["nolio"]
        sortie["athletes"].append({k: v for k, v in c.items() if k in ("id", "nom", "profil", "k", "scenario", "app",
                                                                         "pas_demarre", "sans_accord", "reperes",
                                                                         "course_b", "course_a", "mot", "couru", "fond")}
                                  | {"champs": r["plan"]["intake"]})
        journaux = [(l["numero"], [j.get("regle") for j in l["journal"]]) for l in r["semaines_ecrites"] if l["journal"]]
        print(f"{c['id']:14s} {r['plan']['course_nom'][:22]:22s} {r['plan']['course_date']}  "
              f"{len(r['semaines_ecrites']):2d} écrites  {len(r['apercus'])} aperçus  journaux {journaux[-3:]}")
    sortie["version_moteur"] = sortie["plans"][0]["version_moteur"]
    sortie["seuils"] = SEUILS_SUIVI
    with open(SORTIE, "w", encoding="utf-8") as f:
        json.dump(sortie, f, ensure_ascii=False, separators=(",", ":"), default=str)
    print(f"{SORTIE} : {os.path.getsize(SORTIE) // 1024} Ko")


if __name__ == "__main__":
    main()
