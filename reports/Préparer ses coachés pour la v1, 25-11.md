# Préparer ses coachés pour la v1 — 25/11/2026

La v1 tourne sur les coachés ce week-end. Ce document dit ce que le moteur lit pour un coaché, d'où ça vient, où le coach le remplit, et ce qui manque. Tout est lu dans le code et essayé sur des cas fictifs (`scripts/test-preparer-coaches-v1.mjs`) : **je n'ai vu aucun écran**, aucune donnée d'athlète n'a été lue. Sous la 8.x rien ne change, sauf ce qui est dit.

## La check-list, pour chaque coaché, dans l'ordre des écrans
1. **« Mes athlètes », sa ligne, puis « À faire pour lui » en haut de sa page**
   - « Son compte Nolio n'est pas associé » : « Associer › ». Sans lui, la v1 ne lit rien dans Nolio.
   - « Son accord de lecture n'est pas reçu » : envoie-lui le message dans Nolio, puis « Accord reçu ». Sans l'accord, pas de RPE, de ressenti ni de Hooper lus, et la saisie de son test est refusée.
2. **Sa carte de coureur** (« Il manque : … »)
   - Son profil (niveau, jours, sortie longue, séances) : « Remplir son profil ». Il sert à ses prochains objectifs.
   - Sa côte en minutes, son tapis, ses deux critères (intensité, mécanique) : dans le même formulaire, « Modifier son profil ». La v1 relit la fiche à chaque passage : ça sert dès sa prochaine semaine. Sans eux : côte de 1 min, pas de tapis, critères « jamais » (la note « Pourquoi cette semaine » le dit).
   - Son test de vitesse critique : « Saisir son test de vitesse critique ». Ses repères de fréquence cardiaque : « Modifier ses repères ». La v1 ne relit pas les tests dans Nolio : c'est ta saisie (ou la sienne dans son app) qui compte.
3. **Ses objectifs** : une ligne par objectif à venir, « Complet » ou « Il manque : … », et sous chaque manque son geste
   - Sa côte, son tapis, ses critères : « Modifier son profil » (ouvre le formulaire de la carte, même page).
   - Sa trace GPX : « Ajouter la trace » (le questionnaire de l'objectif, le champ GPX). Sans elle, la v1 retombe sur la classe de la course.
   - Sa semaine habituelle (jours, sortie longue, séances), nouvelle ligne « Semaine » : « Modifier l'objectif ». Cette semaine est celle de l'objectif, pas celle de la fiche.
   - La course (date, format, distance, D+, chrono visé) : « + Objectif trail » ou « + Objectif route », puis « Modifier ». En route, la date, la distance et le format ne changent plus.
   - Ce qu'il court en ce moment (volume, sortie longue déclarés) : le questionnaire de l'objectif. Nolio le remplace au premier passage.
4. **« Son objectif n'a pas démarré dans Nolio »** : le départ pose l'entrée de la v1 (le lundi de sa première semaine) et la course d'avant (sa durée courue, lue dans Nolio, sinon le chrono visé).
5. **L'alerte de la 234**, sous « À faire pour lui », pour un objectif qui n'a pas démarré : « Pour cet objectif, il lui faudrait une sortie longue de … au départ » et/ou « … séances par semaine ». Bouton « Modifier l'objectif ».

## L'inventaire : ce que la v1 lit, d'où, et le geste
| Ce que la v1 lit | Vient de | Geste du coach | Sous la 9.x |
|---|---|---|---|
| course, date, distance, D+, chrono visé | questionnaire de l'objectif | « + Objectif », « Modifier » | marche |
| jours, sortie longue, séances | questionnaire de l'objectif (prérempli par la fiche) | « Modifier l'objectif » | marche ; la fiche seule ne change pas un objectif en cours (dit maintenant au coach) |
| côte, tapis, critères | fiche du coaché | « Modifier son profil » | marche ; lien direct depuis « Il manque » |
| trace GPX | `/v1/trace`, gardée dans l'objectif | questionnaire de l'objectif, « Ajouter la trace » | marche |
| volume et sortie longue au départ (203) | Nolio, lu une fois au premier passage ; sinon le déclaré | questionnaire (déclaré) | **pas de geste pour corriger ce qui est lu** |
| entrée, course d'avant | départ de l'objectif | « Démarrer » | marche ; **perdus par « Modifier » d'un objectif parti : corrigé** |
| test de vitesse critique, FC aux seuils | saisie du coach ou de l'athlète | « Saisir son test », « Modifier ses repères » | marche, sans relecture de Nolio |
| accord de lecture | Nolio (message), « Accord reçu » | « Accord reçu » | marche |
| semaines faites, durées, RPE, ressenti, Hooper, réponses du dimanche | Nolio | aucun | automatique |
| cible de glucides | le calculateur de l'athlète | aucun | automatique |

## Ce que la 9.x ne lit pas encore : les trous à connaître avant samedi
- **Courses de préparation** (`courses_mineures`) : fermées. Un coaché qui en a une dans les semaines qui viennent aura une semaine écrite comme sans elle : à corriger à la main dans Nolio. C'est le trou qui touche le plus de coachés.
- **Tests lus dans Nolio** : plus de « Test à revoir ». Quand la v1 écrit un test, personne n'est prévenu qu'il est fait : à saisir après.
- **Coaché sans objectif daté** (saison de fond, `saison_de_fond`) : la v1 n'écrit rien. Crée-lui un objectif.
- **Pas envoyés** : `d_prime_m`, `aisance`, `pic_precedent`, le type de montées corrigé sur la fiche (`montees`). La v1 se replie (le dit dans « Pourquoi cette semaine »).
- **Ce qui est lu au départ** (203) : pas de geste pour le corriger si Nolio montre un mauvais mois.

## Corrigé dans ce lot (commit 1c1ea78)
- **« Modifier l'objectif » d'un objectif parti perdait** son entrée, sa course d'avant et ce qu'il courait au départ (les réponses neuves remplaçaient les anciennes). Ils sont gardés, sous la 9.x seulement.
- Chaque « Il manque » d'un objectif a son geste ; la ligne « Semaine » dit ce que la v1 lit pour ses jours.
- « Modifier son profil » enregistré dit ce qui sert tout de suite et ce qui passe par l'objectif (sous la 9.x).
- L'alerte de la 234, branchée sur la forme du contrat de `POST /v1/prerequis` : la route n'est pas encore en ligne, donc rien ne s'affiche avant elle. Pas dans « Mes athlètes » (un appel du moteur par objectif) : seulement sur sa page.

## Écrans à regarder avant la mise en ligne (je n'en ai vu aucun)
1. « Mes athlètes » : la ligne d'un coaché avec un manque.
2. Sa page, en haut : « À faire pour lui » (avec une alerte, une fois la route en ligne), sa carte de coureur, « Ses objectifs » avec ses gestes et la ligne « Semaine ».
3. Le clic sur « Modifier son profil » depuis « Ses objectifs » : le formulaire de la carte s'ouvre et la page y descend ; le message après « Enregistrer ».
4. « Modifier » un objectif déjà parti : sa première semaine et la note « Pourquoi cette semaine » restent comme avant.
5. Le questionnaire d'un nouvel objectif (coach) : « Ce cas sort du parcours habituel : il se prépare à la main. » sous un temps visé trop long.
6. « Démarrer », puis la semaine écrite dans Nolio ; « Saisir son test de vitesse critique ».
7. Côté coaché : Accueil (« D'où vient ce chiffre ? »), Profil (« Tes tests »), Compte (la carte « Ton coach » en « je ») ; la page de confidentialité (décision 236).
