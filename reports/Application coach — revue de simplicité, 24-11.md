# Application coach : revue de simplicité, 24/11

Lecture seule, faite sur le code (`app/app/coach/`, `components/app/`, `lib/app/espaceCoach.ts`, `espaceParAthlete.ts`, `moteurEnLigne.ts`). Rien n'a été modifié ni lancé. Les propositions ne sont pas des décisions : le coach tranche.

Repères : « v1 » = le moteur 9.x. Le coach corrige dans Nolio, le moteur repart de sa correction. « Annuler » disparaît (213).

## 1. Inventaire

### Écrans (10, plus 4 redirections)

| Chemin | Ce qu'il montre | Ce que le coach y fait | Sous la 9.x |
|---|---|---|---|
| `/app/coach` (Mes athlètes) | Une ligne par athlète : couleur, objectif, semaine et « Partie / Pas partie », semaine passée, « Ce qui l'attend ». Bandeau du bilan du dimanche. Filtres. Cartes « Anciens athlètes » et « Dans Nolio » | Ouvre un athlète. « + Ajouter un athlète ». « Créer sa fiche » pour les athlètes Nolio sans fiche. « Créer ta fiche de test » | Utile. Les étiquettes « course de préparation », « test » et « saison de fond » reposent sur des données que la 9.x n'écrit pas encore |
| `/app/coach/urgent` | La seule vue transversale : 4 groupes (« A besoin de toi », « Ne court plus », « Semaine pas partie », « Objectif bloqué »), un bouton et « Réglé » par ligne | Ouvre le geste de chaque point, ou marque « Réglé » | Utile. Doublon partiel avec « À faire pour lui » (page athlète) et avec le bandeau de l'accueil |
| `/app/coach/athlete/[id]` | La page centrale : en-tête et pastilles, « Son entrée », « À faire pour lui » + revue du dimanche, « Sa semaine qui arrive », « Sa semaine passée » + « Ses 7 jours », « Ses objectifs », « Ses courses dans Nolio », « Ses repères », « Son profil de coureur », « Ses zones », « Son style », « Réglages » (replié) | Voir plus bas, un geste par bloc | Utile, mais 13 blocs : c'est l'écran le plus chargé |
| `/app/coach/plan/[id]` (page d'un objectif) | « Semaine par semaine » (une ligne par semaine écrite), « Sa préparation » (montée), « Son départ », « Ses courses de préparation », « Retirer cet objectif » | Démarrer dans Nolio, modifier l'objectif, ajouter/modifier/retirer une course de préparation, retirer l'objectif, ouvrir Nolio | Partiel : « Annuler les ajustements » est encore là (obsolète). Courses de préparation : à ne pas proposer (pas encore gérées) |
| `/app/coach/plan/[id]/apercu` | « Aperçu du dimanche » : ce que le moteur ferait maintenant, « Pourquoi cette semaine », « Ce qu'il a lu » | Lecture seule (le bloc « Corriger avant l'envoi » est éteint : `CORRECTIONS_ACTIVES = false`) | Annoncé « pas encore » sous la 9.x. À ne pas montrer tant qu'il ne marche pas |
| `/app/coach/nouveau` | Le questionnaire d'un objectif (trail ou route), 1145 lignes de formulaire, plus le profil de coureur la première fois | Remplir ou relire le questionnaire, lancer l'objectif | Utile. C'est le plus long à remplir |
| `/app/coach/chiffres` | Par mois, « Les coachings », « Semaines envoyées sans retouche », « Tes corrections avant l'envoi », « Tes retouches dans Nolio », « Par famille, 4 dernières semaines », « Les plans » (acheteurs) | Lecture seule | Utile pour piloter l'activité. « Tes corrections » ne s'affiche que s'il y a des données (éteint). « Tes retouches » reste la mesure clé sous la v1 |
| `/app/coach/demandes` et `/demandes/[id]` | Les demandes de coaching de l'app gratuite (prénom, ville, objectif, moments d'appel) | Appeler, puis accepter ou classer sans suite | Utile, mais introuvable tant que l'app gratuite est coupée |
| `/app/coach/series-du-samedi` | Les athlètes dont « Ta semaine prochaine » est encore dans Nolio | Retirer la série à la main dans Nolio (entrée 198) | Nouveau, 9.x seulement. Textes à valider le 28/11 |
| Redirections | `a-regarder` vers Urgent ; `dimanche`, `dimanche/rapport` et `mes-athletes` vers l'accueil | Rien | Mortes : à supprimer quand plus aucun lien n'y mène |

Le menu de gauche compte 3 entrées (Mes athlètes, Urgent, Chiffres), plus « Demandes » si l'app gratuite est ouverte. Une pastille compte les athlètes d'« Urgent ».

### Gestes (environ 30)

- Accueil : ajouter un athlète ; créer une fiche depuis Nolio (×2 : athlète, fiche de test) ; 4 filtres (Tous, En route, À démarrer, Sans objectif).
- Urgent : un bouton par ligne (Réessayer, Relire, Lire dans Nolio, Lui écrire, Associer, Accord reçu, Son profil, Démarrer, Retirer) ; « Réglé » ; le lien « Séries du samedi ».
- Page athlète : « Accord reçu » ; « Relire maintenant » ; « Garder la séance d'origine » ; + Objectif trail ; + Objectif route ; Créer l'objectif depuis une course Nolio ; Saisir son test de vitesse critique ; Modifier ses repères ; Remplir ou modifier son profil ; Le programmer à la main ou repasser en automatique ; Inviter dans l'app ; Retirer son accès ; Associer, changer ou retirer son compte Nolio ; Retirer l'accord ; Retirer cet athlète.
- Page objectif : Démarrer ou changer le départ ; Modifier l'objectif ; fiche de course ; Ouvrir dans Nolio ; Annuler les ajustements ; Ajouter, modifier ou retirer une course de préparation (avec trace GPX facultative) ; Retirer l'objectif ; Appliquer ce que le moteur aurait écrit ; Arrêter une préparation remboursée.
- Demandes : accepter ou classer.

## 2. Ce que le coach doit remplir ou mettre en place lui-même

| Élément | Obligatoire ? | Sans lui |
|---|---|---|
| Associer le compte Nolio de l'athlète | Oui | Aucune semaine écrite ; ligne « Objectif bloqué » dans Urgent |
| « Accord reçu » (accord de lecture) | Oui pour que l'app lise séances, RPE et Hooper | Rien n'est lu : pas de « Ses 7 jours », pas de repères, pas d'adaptation. Ligne « Objectif bloqué » |
| Profil de coureur (niveau, terrain, jour de sortie longue, séances par semaine, jours disponibles) | Oui | La saison de fond ne peut pas partir ; sinon refus du moteur (« saison refusée ») |
| Questionnaire de l'objectif (course, date, distance, D+, chrono visé, charge du moment) | Oui pour un objectif | Pas d'objectif, donc pas de semaine |
| Démarrer dans Nolio (lundi du départ, au choix) | Oui | « n'a pas démarré dans Nolio » : rien ne part. Vide = dès que possible |
| Retirer de Nolio ses anciennes séries de questionnaire et de Hooper avant de démarrer | Oui (une fois par athlète) | Doublons chez l'athlète. Le site ne le vérifie pas |
| Retirer les séries du samedi (« Ta semaine prochaine ») | Oui sous la 9.x, chaque semaine | Écran d'attente qui reste plein ; risque de séance en double dans Nolio |
| Ses repères (FC, allures) ou le test de vitesse critique | Non | Les séances partent au RPE ; le test s'écrit à la place d'une séance |
| Course de préparation (nom, date, distance, D+, chrono, gestion ou à fond, GPX) | Non | La préparation continue sans elle. Sous la 9.x elle n'est pas gérée |
| Trace GPX de l'objectif | Non | La fiche de course n'a pas son profil |
| Inviter dans l'app | Non | L'athlète n'a pas son tableau de bord |
| « Réglé » sur un point | Non | Le point reste en tête d'Urgent |
| Programmation « à la main » | Non (par défaut : automatique) | Le moteur écrit toutes les semaines |
| Retouches dans Nolio | Non, mais c'est le geste central de la v1 | Le moteur garde sa semaine telle quelle |

Côté mise en place technique, l'accueil rappelle en clair que la clé de l'API Nolio manque, et que la migration du 04/11 « est à passer dans Supabase » : des messages pour le développeur, lus par le coach.

## 3. Ce qui est en double, inutile sous la 9.x ou difficile à lire

**En double**
- Le même point apparaît jusqu'à trois fois : bandeau de l'accueil, ligne d'Urgent, ligne de « À faire pour lui ». Même geste, même « Réglé ».
- « Sa semaine passée » (séances, charge tenue, Hooper) est sur l'accueil, sur la page athlète et dans « Semaine par semaine » de l'objectif.
- « Sa semaine qui arrive » (athlète) et « Aperçu du dimanche » (objectif) décrivent la même semaine.
- Deux portes pour « Démarrer dans Nolio » (page athlète et page objectif) ; deux pour « Associer Nolio » (Urgent et Réglages) ; « Son profil » apparaît sur la page athlète et dans « nouveau ».
- « Chiffres » compte les retouches ; Urgent et la page athlète montrent aussi « sans retour », « sous le plan », « RPE à revoir » : trois lectures de la même charge.

**Obsolète ou cassé sous la 9.x**
- « Annuler les ajustements » (page objectif) : l'annulation est abandonnée (213). Le texte « Ajustements annulés » reste lisible.
- « Garder la séance d'origine » et « allégée en EF (fatigue franche) » : reposent sur la route de fatigue retirée par la v1 (404). À vérifier.
- Bloc « Corriger avant l'envoi » et carte « Tes corrections » : interrupteur éteint, mais code et textes restent.
- « Aperçu du dimanche », courses de préparation, saison de fond, tests lus, lien « course Nolio » et « prérequis du marathon » : annoncés non fonctionnels sous la 9.x ; leurs lignes peuvent encore apparaître ou rester vides.
- Sous la 9.x, la garde `moteurEstV9()` ne sert qu'à trois endroits visibles (Urgent, Séries du samedi, profil). Le reste de l'écran ne change pas : la vue est celle de la 8.x, avec ses textes (« le moteur écrit ses semaines, tu retouches dans Nolio au besoin »).
- 4 pages de redirection et la route `athletes/route.ts`, `suivi/route.ts` (techniques).

**Jargon et textes difficiles à lire**
- « Marche » (série, étapes du samedi), « dose », « branche », « R1 à R6 », « cran », « trame », « pilier », « bloc », « montée », « charge tenue », « écart au prévu », « Hooper » (sans explication), « RPE », « vitesse critique », « D+ », « EF », « SL ».
- Trois chiffres sans explication sur la page athlète : « charge tenue 87 % », « charge 1 240 », « Hooper 8,8 (moyenne…) ».
- La légende de couleur (« proche d'un seuil », « le moteur changera sa semaine ») suppose de connaître les seuils.
- La page « Son départ » : quatre phrases techniques (échelons, fondations sautées, rythme repris) qui parlent au développeur.
- Les messages d'erreur d'infra dans l'interface : NOLIO_API_KEY, migration Supabase, « reprises de 20 h et 22 h ».
- Le tableau de l'accueil mesure 940 px de large (déroulant sur téléphone) alors qu'Urgent est conçu « pour le téléphone d'abord ».

## 4. Propositions, de la plus utile à la moins utile

1. Une seule page de travail : fondre Urgent dans « Mes athlètes » (une section « À faire » en haut, les athlètes dessous), avec un seul « Réglé ».
2. Sur la page athlète, ne garder en haut que 3 blocs (« À faire pour lui », sa semaine qui arrive, sa semaine passée) ; tout le reste dans « Réglages », replié.
3. Retirer de l'écran tout ce que la 9.x ne fait pas encore (aperçu du dimanche, courses de préparation, saison de fond, tests lus, « Garder la séance d'origine ») au lieu de le laisser vide ou cassé.
4. Supprimer « Annuler les ajustements », le bloc « Corriger avant l'envoi » et « Tes corrections » (code et textes), puisque le coach corrige dans Nolio.
5. Remplacer les jargons par des mots du coach (« charge tenue » en « semaine tenue à 87 % du prévu », « Hooper » en « forme déclarée », etc.) ; un glossaire d'une ligne sous chaque chiffre.
6. Un seul parcours « Nouvel athlète » : profil, Nolio, accord, démarrage, avec une coche d'avancement (« Son entrée » existe déjà : en faire la porte unique).
7. Garder un seul point d'entrée par geste (un seul « Démarrer dans Nolio », un seul « Associer Nolio »).
8. Réduire les filtres de l'accueil (4) et les groupes d'Urgent (4) à deux : « À faire » et « Tout va bien ».
9. Cacher les messages d'infra (clé API, migration) hors de la vue du coach ; les envoyer au développeur par un autre canal.
10. Supprimer les 4 redirections mortes et les routes techniques inutilisées.
11. Alléger « Chiffres » à trois blocs : activité, retouches, acheteurs ; déplacer le reste dans un repli.
12. Rendre l'accueil lisible sur téléphone (cartes, pas de tableau de 940 px).

## 5. Ce que je n'ai pas pu vérifier

- Je n'ai pas vu les écrans : faute de connexion, rien n'a été ouvert ni mesuré. Tout vient du code.
- Je n'ai pas lu les données des athlètes ni celles de Nolio, ni lancé de test.
- Sous la 9.x, je n'ai pas confirmé ligne à ligne quelles étiquettes ou quels points restent affichés alors que la fonction est coupée (courses de préparation, tests lus, saison de fond, séances allégées) : à confirmer à l'écran.
- Je n'ai pas lu en entier les gros fichiers : `plan/[id]/page.tsx` (32 Ko, lu aux deux tiers), `athlete/[id]/page.tsx` (49 Ko, lu en grande partie), `components/plan/Questionnaire.tsx` (1145 lignes, non lu), `chiffres/page.tsx` (27 Ko, titres seulement).
- Je n'ai pas lu `demandes/[id]` en détail, ni `ActionsDemande`, `ProfilAthlete` en entier, ni `lib/app/entree.ts`.
- Le nombre de gestes (environ 30) est un décompte du code, pas du temps passé.
