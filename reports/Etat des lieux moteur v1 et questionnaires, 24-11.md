# État des lieux : ce que le moteur v1 lit, et ce que le site demande (24/11/2026)

Lecture seule du code du site (branche `claude/elastic-satoshi-155ad9`, 80e28bb) et de la section « MOTEUR v1 » de `CONTRAT_API_CTS.md`. Aucune donnée d'athlète lue. Libellés copiés du code. **Achat** : le questionnaire du plan acheté (sur la 8.474 jusqu'à la 9.1). **Fiche** : « Modifier son profil » du coaché. **Dimanche** : « Ton point du dimanche ». Les écarts E1 à E9 sont au §3.

## 1. Une ligne par donnée que le moteur v1 lit

### `parametres`
| Donnée | Où le site la demande (libellé exact) ou d'où il la tire |
|---|---|
| `format` | Achat : déduit de « Distance de ta course (km) » (trail) ; route : boutons de distance. Coaching : boutons « Trail » / route |
| `date_course` | « Date de la course » |
| `distance_km` | « Distance de ta course (km) » |
| `dplus_m` | « D+ (m) » (trail ; sur route, 0 sans question) |
| `dmoins_m` | « D− (m) » (replié sous le D+, facultatif) |
| `temps_cible` | « Temps cible » (trail) ; « Chrono visé » (route) |
| `duree_mois` | Achat seulement : « Durée du plan » |
| `criteres.intensite` | Fiche : « Intensité » (« Fractionné ou seuil, ces 3 derniers mois »). Achat : jamais demandée (E7) |
| `criteres.mecanique` | Fiche : « Mécanique » (« Dénivelé (côtes, trails), ces 3 derniers mois »). Achat : jamais ; route : jamais (E7) |
| `cote_min` | Achat et fiche : « Ta plus longue côte près de chez toi : combien de minutes pour la monter de bas en haut… » (fiche : « Sa plus longue côte, en minutes »). Route : jamais |
| `cote_max` | Jamais demandée ; `parametresV9` la déduit de l'ancien `terrain` d'un profil d'avant, sans `cote_min` |
| `tapis` | Achat : « As-tu accès à un tapis de course qui monte ? » ; fiche : « Accès à un tapis de course qui monte ». Route : jamais (E5) |
| `jours_disponibles` | Achat : « Jours disponibles pour t’entraîner » ; fiche : « Sa semaine habituelle » ; Dimanche : « Quels jours peux-tu courir la semaine prochaine ? » |
| `jour_sl` | Achat : « Jour de la sortie longue » ; fiche : « Sortie longue le » ; Dimanche : « Quel jour pour ta sortie longue ? » |
| `freq_hebdo` | Achat : « Séances par semaine » ; fiche : « Séances par semaine » ; Dimanche : « Combien de séances veux-tu faire ? » (E6) |
| `volume_hebdo_actuel` | Achat : « Ton volume de course par semaine, en ce moment » ; coaching : « Sa charge du moment » (E4) |
| `sortie_longue_actuelle` | Achat : « Ta plus longue sortie en ce moment » ; coaching : idem (E4) |
| `lu.volume_min`, `lu.sl_min` | Tiré de Nolio, jamais demandé : `lireLuAuDepart` (entrée 203), un coaché relié avec accord, lu une fois au premier passage. Acheteur : jamais (E3) |
| `vc_ms`, `fc_seuil1`, `fc_seuil2` | Jamais dans le questionnaire : repères de l'athlète (tests de l'app : vitesse critique, test de la parole, FC au seuil 2 ; fiche du coaché ; tests lus dans Nolio) |
| `glucides_cible` | Calculateur de nutrition, « Garder ma stratégie » : milieu de la fourchette de la carte « Glucides » (E8) |
| `coaching` | Calculé : plan relié à la fiche d'un coaché |
| `entree` | Calculé : premier lundi du plan (`champs.entree` gardé au départ d'un objectif) |
| `course_precedente` | Calculé : la course du dernier objectif du site (moins de 60 jours) et son « Temps cible » en heures (E2) |
| `aisance` | Jamais demandée : le texte « Te sens-tu moins à l’aise en montée ou en descente ? » est préparé, pas branché (E1) |
| `montees` | Jamais demandée, ni corrigeable par le coach sur la fiche |
| `gpx` (`montees`, `dplus_par_pente`) | « Trace GPX de la course — facultatif » (achat) est demandée, mais rien n'en part au moteur v1 |
| `saison_de_fond` | Jamais envoyé (saison de fond du site = 8.x, coupée sous la 9.x) |
| `pic_precedent` | Jamais envoyé |
| `courses_mineures` | Jamais envoyé ; la course de préparation se saisit, fermée sous la 9.x (E9) |
| `accord_lecture` | Achat : « J’accepte que l’app lise aussi dans Nolio mon RPE, mon ressenti, mon Hooper… » ; coaché : accord reçu par le coach |

### `reponses` (Dimanche, lues par `lireReponsesDimanche`)
| Donnée | Question exacte |
|---|---|
| `version` | Choisie par le moteur (`POST /v1/questionnaire`), jamais demandée |
| `arret` | « As-tu arrêté de courir cette semaine ? » (Non / Quelques jours / Oui, toute la semaine) |
| `semaines_arret` | « Si tu as arrêté toute la semaine : depuis combien de semaines as-tu arrêté, en tout ? » (1 à 4, Plus de 4) |
| `cause` | « Si tu as arrêté toute la semaine : pourquoi ? » (Blessure / Maladie / Autre) |
| `cles_pas_faites` | « Une séance clé pas faite comme écrite ? » (liste « Mardi · Seuil 1 »…, sur la semaine écrite) |
| `fatigue_oui` | « Veux-tu une semaine plus légère ? » (version « fatigue » seulement) |
| `jours`, `nb_seances`, `jour_sl` | Les trois questions ci-dessus (jours, séances, sortie longue) |
| `illisible` | Jamais envoyé (décision : le site n'envoie rien) |

### `nolio` (lu, jamais demandé)
Séances prévues et faites, `id` (« S9-mardi »), `duree_faite_min`, `activites_vues`, `course` : lus dans Nolio. `rpe`, `ressenti`, `hooper` : seulement avec l'accord de lecture. `faite: false` : jamais envoyé. `numero` : rang dans la trame ; `etat` : gardé par plan.

## 2. Questions posées que le moteur v1 ne lit plus
- **« Ton niveau »** (Débutant / Intermédiaire / Confirmé ; achat ; même grille dans la demande de coaching et l'app gratuite, `grilleExperience.ts`) : `niveau` est retiré. Autre raison : l'achat reste sur la 8.474 (formats ouverts au débutant) ; la carte de coureur l'affiche.
- **Fiche, « Son niveau »** : « Depuis combien de temps court-il régulièrement ? », « Son entraînement » (3 cases), niveau « choisi par toi » : non lus. Le site s'en sert pour la carte.
- **Fiche, « Ce qui lui coûte le plus en trail »** (Les montées / Les descentes / La technique / La fin de course) : non lue, le v1 lit `aisance` (E1). Sert à la saison de fond de la 8.x.
- **Achat, « Nom de la course »** : hors contrat. « Nom / prénom » : le `nom` part dans `parametres` sans être au contrat.
- **Achat, « C’est son premier marathon »** : non lue. Gardée pour un avertissement de durée (moins de 20 semaines).
- **Achat, « Avant de commencer »** (blessure, cœur) : jamais envoyées ; sécurité (ne quittent pas le navigateur, la blessure arrête l'achat).
- **Achat, « Je demande que mon accès commence dès mon paiement »** : légale (CGV), pas un paramètre. « E-mail » et « Adresse de ton compte Nolio » : compte et liaison Nolio.
- **Dimanche, « Une information à remonter à ton coach ? »** (coaché) : non lue par le moteur ; lue par le coach (« À regarder »).
- **Samedi, « Ta semaine prochaine »** (jours, sortie longue « parmi les jours cochés », séances, « Cette semaine, as-tu dû arrêter de courir ? ») : plus lue sous la 9.x ; séries à retirer à la main.
- **Calculateur de nutrition** : « Ton poids (kg) », « Durée prévue », conditions, niveau (Débutant / Intermédiaire / Expert), intestin, sueur, nuit : seul `glucides_cible` part ; `strategie` (4 repères) est retiré par `parametresV9`. Gardées : l'outil de l'app.
- **Course de préparation, « Comment tu la cours ? »** (En gestion / À fond) : hors `courses_mineures` (E9).
- **Plus posées, encore dans les profils** : l'ancien `terrain` (4 cases), `coupure` (champ envoyé vide).

## 3. Écarts de sens
- **E1 `aisance`** : le moteur attend `montee` ou `descente` ; la fiche pose 4 cases (`cout_trail`) qui ne se ramènent pas à 2 valeurs.
- **E2 `course_precedente.duree_h`** : le contrat dit la durée de l'objectif majeur couru ; le site envoie le « Temps cible » (visé) de l'objectif précédent, seulement s'il est un objectif du site.
- **E3 `lu`** : le contrat écrit encore « ses 4 dernières semaines » ; le site envoie l'entrée 203 (SL des 4 dernières semaines, volume = 4 plus grosses des 8). En minutes, nombres entiers.
- **E4 déclarés** : « 4h » / « 4h30 » / « 90min » en texte libre ; le contrat ne dit pas leur forme (l'essai enregistré a lu « 5h »).
- **E5 `tapis`** : « demandé à tous » au contrat ; sur route, l'achat ne pose ni côte ni tapis (section « Ton terrain d’entraînement » cachée).
- **E6 `freq_hebdo`** : le contrat dit « au plus » ; « Séances par semaine » et « Combien de séances veux-tu faire ? » disent un nombre voulu. L'achat borne les valeurs (jours cochés, planchers de `/v1/config` 8.x que la v1 retire).
- **E7 `criteres`** : textes des questions et des 3 réponses identiques à `moteur/config.py`. L'achat ne les pose pas (« Ton niveau » à la place : `CRITERES_BRANCHES` faux), donc tout acheteur vaut « jamais » ; une fois branchés, sur route seule l'intensité sera posée ; fiche : absent = « Pas renseigné : compte comme « Jamais » ».
- **E8 `glucides_cible`** : le contrat veut un nombre (absent : 60) ; le site garde une fourchette et envoie son milieu arrondi.
- **E9 `courses_mineures`** : le contrat veut `{date, duree_h, nom}`, aucune porte ; le site saisit nom, date, distance, D+, « Chrono visé » (obligatoire, en heures) et le mode. Le chrono visé n'est pas la durée estimée ; mineure ou majeure n'est pas demandé.
