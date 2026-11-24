# Phrases qui sonnent automatiques — site, 24/11/2026

Relevé sans code, sans proposition de phrase : ce que le site montre à un coaché (l'app, les questionnaires, notes et messages posés dans Nolio, les courriels) et qui contient un mot d'automatisation (moteur, calculé, lue / lit, s'écrit, automatique, généré, analysé, se recale, tout seul…). Branche `claude/elastic-satoshi-155ad9`, état du 24/11/2026.

## Comment le lire
- **103 entrées** : 12 « coaché » (texte que voit un coaché et que l'acheteur ne voit pas), 57 « partagé » (vu aussi d'un acheteur : sa voix reste neutre), 34 « à voir » (le public ou le sens est à juger : la note le dit). 11 entrées de la fin sont des outils que l'athlète utilise lui-même (calculateurs), notées à part.
- Chaque phrase est copiée du source, balises retirées ; les interpolations restent telles que dans le code (`${…}`, `{motsDuQuestionnaire(…)}`). Un script a contrôlé que le début de chaque phrase se trouve à la ligne indiquée ou dans les trois suivantes : 101 sur 103 d'emblée ; les deux autres (`app/confidentialite/page.tsx` 183 et 210) commencent par un passage en gras (`<strong>`) et ont été relues à la main.
- « 8.x seulement » : le texte ne s'affiche que sous le moteur 8.x ; « 9.x seulement » : sous le moteur v1. Sans mention : les deux.

## Dans l'app

### Page « Accueil »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| components/app/PourBienDemarrer.tsx:102 | Ton accord de lecture est donné | accord de lecture | à voir — public : coaché ; « accord de lecture » = l’app lit les données |
| components/app/TableauDeBord.tsx:56 | Ce plan ne s’écrit pas dans Nolio | s’écrit | coaché — plan acheté pendant un coaching |
| components/app/TableauDeBord.tsx:209 | Comment c’est calculé&nbsp;? | calculé | partagé |
| lib/app/motsDeLaSemaine.ts:26 | l’allure de ta course, calculée sur ton chrono visé. | calculée | partagé |
| lib/app/motsDuQuestionnaire.ts:38 | Chaque samedi à 8 h, le questionnaire « Ta semaine prochaine » t’attend dans Nolio : réponds d’ici dimanche 18 h, ta semaine suivante s’écrit dimanche soir d’après tes réponses. | s’écrit | partagé — 8.x seulement ; texte « avant » (moteur 8.x) |
| lib/app/motsDuQuestionnaire.ts:39 | Chaque dimanche vers midi, « Ton point du dimanche » t’attend dans Nolio : réponds d’ici dimanche 18 h, ta semaine suivante s’écrit dimanche soir d’après tes réponses. | s’écrit | partagé — 9.x seulement ; texte « v9 » (moteur 9.x) |
| lib/app/motsDuQuestionnaire.ts:43 | Ta préparation s’adapte chaque semaine : le samedi, un court questionnaire dans Nolio te demande tes jours et ton nombre de séances ; le dimanche soir, ta semaine s’écrit d’après tes réponses et ce que tu as couru. | s’adapte, s’écrit | partagé — 8.x seulement ; texte « avant » (moteur 8.x) |
| lib/app/motsDuQuestionnaire.ts:44 | Ta préparation s’adapte chaque semaine : le dimanche vers midi, « Ton point du dimanche », un court questionnaire dans Nolio, te demande tes jours et ton nombre de séances ; le dimanche soir, ta semaine s’écrit d’après tes réponses et ce que tu as couru. | s’adapte, s’écrit | partagé — 9.x seulement ; texte « v9 » (moteur 9.x) |
| lib/app/motsDuQuestionnaire.ts:48 | Sans ça, elle reste au même niveau, puis se recale dès que tu actualises. | se recale | partagé — 9.x seulement ; texte « avant » (moteur 8.x) |
| lib/app/motsDuQuestionnaire.ts:49 | Sans ça, elle reste au même niveau, puis se recale dès que tu actualises. | se recale | partagé — 9.x seulement ; texte « v9 » (moteur 9.x) |

### Page « Aller plus loin »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| app/app/aller-plus-loin/page.tsx:26 | Chaque dimanche, ta semaine suivante est réécrite selon ce que tu as fait. | réécrite | à voir — public : app gratuite (page de vente du plan), pas un coaché a priori |

### Page « Coaching »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| lib/app/coachingRegles.ts:210 | Ton année de naissance ne se lit pas : quatre chiffres, par exemple 1988. | ne se lit pas | à voir — message de saisie ; public : prospect/free qui demande le coaching |
| lib/app/coachingRegles.ts:221 | Tes heures par semaine ne se lisent pas : un nombre, par exemple 5 ou 5,5. | ne se lisent pas | à voir — message de saisie ; public : prospect/free qui demande le coaching |
| lib/app/coachingRegles.ts:240 | La date de ta course ne se lit pas. | ne se lit pas | à voir — message de saisie ; public : prospect/free qui demande le coaching |
| lib/app/coachingRegles.ts:244 | La distance ou le D+ de ta course ne se lit pas : des nombres, en km et en mètres. | ne se lit pas | à voir — message de saisie ; public : prospect/free qui demande le coaching |
| lib/app/coachingRegles.ts:259 | Ton téléphone ne se lit pas : un numéro avec ses 10 chiffres, par exemple 06 12 34 56 78. | ne se lit pas | à voir — message de saisie ; public : prospect/free qui demande le coaching |

### Page « Compte »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| app/app/compte/page.tsx:116 | ${coach.prenom} relit ta préparation et peut reprendre la main sur une semaine à tout moment. | relit, reprendre la main | à voir — public : coaché (non programmé à la main) ; « relit » = le coach, mais « reprendre la main » suppose une machine |
| app/app/compte/page.tsx:141 | Tes séances s’y écrivent chaque dimanche soir, d’après ta semaine et ton questionnaire. | s’écrivent | partagé — carte Nolio ; vue quand le coach n’écrit pas à la main |
| app/app/compte/page.tsx:155 | Ton coach et l’app lisent dans Nolio tes séances faites, ton RPE, ton ressenti et ton Hooper, seulement pour ajuster ta préparation et afficher tes graphiques. | lisent, ajuster | coaché — carte « Tes données » du coaché avec accord |

### Page « Confidentialité »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| app/confidentialite/page.tsx:42 | Aucune de tes données n’est analysée par une intelligence artificielle, ni utilisée pour en entraîner une. | analysée, intelligence artificielle | partagé |
| app/confidentialite/page.tsx:131 | Ton nom, ton e-mail, ta course, ton niveau, ton volume et ta plus longue sortie actuels, ton terrain, tes jours disponibles et ta trace GPX partent vers notre moteur, qui construit ton plan. | moteur | partagé — section « Quand tu construis ton plan » (acheteur), page lue en entier par le coaché |
| app/confidentialite/page.tsx:183 | Si ton achat date de plus de 3 semaines au moment de ton invitation, ton app CTS te demande si ce que tu cours a changé (ton volume par semaine, ta plus longue sortie) : ta réponse rejoint celles de ton achat, et ta première semaine s’écrit dessus (le contrat). | s’écrit | partagé — section « Tes séances dans Nolio » (acheteur), page lue en entier par le coaché |
| app/confidentialite/page.tsx:188 | ta semaine suivante s’écrit d’après {motsDuQuestionnaire('confidentialite', v9)}, et tes séances faites ou manquées et leur durée, que nous lisons dans Nolio (le contrat : c’est le service que tu as acheté). | s’écrit, lisons | partagé — section « Tes séances dans Nolio » ; commence après « Chaque dimanche, » |
| app/confidentialite/page.tsx:193 | nous lisons aussi ton effort ressenti (RPE), ton ressenti, ton Hooper (fatigue, sommeil, stress, courbatures) et la trace de tes séances test (distance, fréquence cardiaque), pour ajuster ta semaine à ta fatigue et en tirer tes repères. Ce sont des données liées à ta santé : nous ne les lisons qu’avec cet accord exprès (ton consentement explicite), que tu retires quand tu veux. | lisons, ajuster, lisons | partagé — section « Tes séances dans Nolio » ; commence après « Avec ton accord de lecture (…), » |
| app/confidentialite/page.tsx:200 | nous lisons toutes tes séances de course et de trail réalisées dans Nolio, depuis le début de ton historique (date, distance, durée, dénivelé), et ne gardons que tes badges débloqués, avec leur date, et tes totaux de kilomètres et de dénivelé par mois. | lisons | partagé — section « Tes séances dans Nolio » ; commence après « Tes badges, avec ce même accord : » |
| app/confidentialite/page.tsx:205 | pour chaque semaine écrite, ce qui a été décidé et un résumé chiffré (charge faite, séances faites, plus longue sortie, Hooper), pour ta jauge et tes graphiques. | écrite, décidé | à voir — public : partagé ; commence après « Nous gardons, » |
| app/confidentialite/page.tsx:210 | Une semaine décidée par des règles. Ta semaine suivante est décidée automatiquement, par les règles de la méthode CTS, à partir de ces données ; personne ne la relit avant qu’elle parte. | décidée, automatiquement, règles | partagé — mention légale (décision automatisée) ; section « Tes séances dans Nolio » |
| app/confidentialite/page.tsx:246 | l’espace de ton coach garde ton profil de coureur (tes réponses au questionnaire), tes repères d’entraînement (fréquence cardiaque aux seuils, vitesse critique, allures) avec la date et l’origine de chaque test, tes objectifs, tes courses de préparation et leur fiche de course, et ta préparation, pour écrire tes séances dans ton calendrier Nolio ; | écrire | à voir — public : coaché ; « pour écrire tes séances » sans sujet humain |
| app/confidentialite/page.tsx:252 | le suivi de ton coach lit dans Nolio tes séances prévues et réalisées, avec ton effort ressenti, tes sensations, tes commentaires et ton questionnaire Hooper ; chaque soir, nous en gardons seulement des signaux pour ton coach (une séance manquée, un effort plus dur que prévu, de mauvaises sensations ou une fatigue qui monte, un commentaire à lire, le jour de ta dernière activité), jamais le contenu d’une séance ni le texte d’un commentaire, remplacés le soir suivant ; | lit | coaché — section « Si tu es coaché par CTS sur Nolio » |
| app/confidentialite/page.tsx:258 | ton espace CTS t’affiche ta semaine telle qu’elle est dans Nolio, lue au moment où tu l’ouvres, sans en garder de copie ; | lue | coaché — section « Si tu es coaché par CTS sur Nolio » |
| app/confidentialite/page.tsx:260 | pour tes badges, nous lisons toutes tes séances de course et de trail réalisées dans Nolio (date, distance, durée, dénivelé) et ne gardons que tes badges débloqués, avec leur date, et tes totaux de kilomètres et de dénivelé par mois ; | lisons | coaché — section « Si tu es coaché par CTS sur Nolio » |
| app/confidentialite/page.tsx:265 | chaque dimanche, sauf si ton coach les écrit lui-même, tes séances de la semaine suivante s’écrivent d’après ta semaine écoulée, avec les mêmes lectures ; nous gardons un résumé chiffré de chaque semaine (charge, séances faites, plus longue sortie, dénivelé, Hooper), celles que ton coach écrit à la main comprises, lues chaque nuit dans Nolio, pour ajuster tes séances et afficher tes graphiques dans ton espace CTS ; | s’écrivent, lues, ajuster | coaché — section « Si tu es coaché par CTS sur Nolio » |
| app/confidentialite/page.tsx:280 | Les séances écrites dans ton calendrier restent dans Nolio, qui applique sa propre politique de confidentialité. | écrites | à voir — public : coaché (section « Si tu es coaché par CTS sur Nolio ») ; « séances écrites » sans sujet humain |
| app/confidentialite/page.tsx:293 | Render : le moteur qui construit les séances (serveurs en Allemagne) ; | moteur | partagé — section « Qui y a accès » |

### Page « Courses »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| components/app/courses/FormulaireCourse.tsx:111 | Il est analysé, puis seul le résultat est gardé, jamais le fichier. | analysé | partagé |
| lib/app/rangerDossier.ts:23 | Ce dossier ne se lit pas : refais-le, puis garde-le. | ne se lit pas | à voir — app gratuite |

### Page « Données »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| app/app/donnees/page.tsx:58 | Lues dans Nolio avec ton accord : rangées chaque dimanche soir, complétées chaque nuit. | Lues | partagé |
| app/app/donnees/page.tsx:73 | Elle s’affiche après deux semaines faites : ton effort ressenti (RPE) multiplié par la durée de chaque séance, lus dans Nolio. | lus | partagé |
| app/app/donnees/page.tsx:76 | Il s’affiche après ta première semaine faite : tes heures de course, semaine après semaine, lues dans Nolio. | lues | partagé |
| app/app/donnees/page.tsx:81 | Ta charge et ton Hooper s’affichent avec ton accord de lecture : l’app lit alors dans Nolio ton effort ressenti et ton Hooper. | l’app lit, accord de lecture | partagé |

### Page « Mentions légales »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| app/mentions-legales/page.tsx:39 | Les données des comptes sont hébergées en Irlande par Supabase, et le moteur qui construit les séances en Allemagne par Render | moteur | partagé — document ouvert depuis Compte |

### Page « Nouvel objectif »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| app/app/objectif/nouveau/page.tsx:75 | Ton profil d’entraînement part avec ta demande (ci-dessous) : seules ta charge du moment${depuisNolio ? ' (lue dans tes séances Nolio : relis-la)' : ''} et ta course sont demandées. | lue | coaché |
| app/app/objectif/nouveau/page.tsx:75 | Ton coach relit ta demande et lance ta préparation. | relit, lance ta préparation | à voir — public : coaché ; « relit » = le coach |
| app/app/objectif/nouveau/page.tsx:76 | Ton coach relit ta demande et lance ta préparation. | relit, lance ta préparation | à voir — public : coaché ; « relit » = le coach |
| app/app/objectif/nouveau/page.tsx:168 | Ton coach relit chaque objectif majeur avant de le lancer. | relit, lancer | à voir — public : coaché ; « relit » = le coach |
| components/plan/Questionnaire.tsx:164 | Le service de génération ne répond pas. Réessaie dans quelques minutes. | génération | partagé — questionnaire d’achat aussi |
| components/plan/Questionnaire.tsx:499 | Le service de génération ne répond pas. Vérifie ta connexion et réessaie. | génération | partagé — envoi de la demande du coaché (et du coach) |
| components/plan/Questionnaire.tsx:604 | Avant de générer ton plan, lis ces points | générer | partagé — questionnaire d’achat aussi |
| components/plan/Questionnaire.tsx:614 | Ton coach relit tes réponses avant de lancer ta préparation. | relit, lancer ta préparation | à voir — public : coaché (demande d’objectif) ; « relit » = le coach |
| components/plan/Questionnaire.tsx:1113 | Avec une douleur ou une blessure en cours, une préparation automatique n’est pas adaptée. | automatique | partagé — questionnaire d’achat aussi |
| lib/cote.ts:38 | Ta plus longue côte ne se lit pas : un nombre de minutes, par exemple 12. | ne se lit pas | à voir — message de saisie ; questionnaire d’achat et de coaching |
| lib/plan.ts:188 | Le moteur ne construit pas ce cas : à préparer toi-même, hors du parcours automatique. | moteur, automatique | à voir — public : mode coach du questionnaire (coach, ou coaché en demande) |

### Page « Plan »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| app/app/plan/page.tsx:129 | Ta demande est partie chez ton coach : il la relit et lance ta préparation. | relit, lance ta préparation | à voir — public : coaché ; « relit » = le coach |
| app/app/plan/page.tsx:205 | Une course avant ton objectif ? Ajoute-la : les jours autour d’elle s’ajustent (quelques jours plus légers avant, de la récupération après), sans toucher à la suite de ta préparation. | s’ajustent | à voir — public : partagé ; « s’ajustent » = le plan qui s’ajuste seul |
| components/app/FormulaireZones.tsx:90 | Tes valeurs s’effacent : tes séances se règlent de nouveau sur ton effort ressenti. | se règlent | à voir — public : partagé ; « se règlent » = le plan se règle seul |
| components/app/SaisonDeFond.tsx:85 | Trois blocs de quatre semaines, la dernière allégée, ton terrain chaque semaine ; tes séances s’écrivent chaque dimanche dans Nolio. | s’écrivent | coaché |
| components/app/SemainesDuPlan.tsx:119 | Prévue : elle s’écrit dimanche d’après ton questionnaire. | s’écrit | partagé |
| components/app/SemainesDuPlan.tsx:196 | Les semaines à venir s’écrivent chaque dimanche d’après tes réponses : leur contenu peut changer. | s’écrivent | partagé |
| lib/app/actionsEcriture.ts:25 | Les courses de préparation reviennent avec l’objectif mineur : cette version du moteur ne les ajoute pas encore. | moteur | partagé |
| lib/app/actionsEcriture.ts:124 | Ta course doit tomber à partir de lundi prochain : la semaine en cours est déjà écrite. | écrite | partagé |
| lib/app/actionsEcriture.ts:140 | La distance ou le dénivelé ne se lisent pas. | ne se lisent pas | à voir — message de saisie ; public : partagé |
| lib/app/actionsEcriture.ts:142 | Le chrono visé ne se lit pas : par exemple 2h15. | ne se lit pas | à voir — message de saisie ; public : partagé |
| lib/app/actionsEcriture.ts:155 | Le moteur ne répond pas : réessaie dans un moment. | moteur | partagé |
| lib/app/actionsEcriture.ts:217 | Sa fiche de course est prête, mais sa trace ne s’est pas lue : le profil reste schématique. | lue | à voir — public : partagé ; « ne s’est pas lue » |
| lib/app/actionsEcriture.ts:224 | Course modifiée : les jours autour d’elle s’ajustent dans tes prochaines semaines. | s’ajustent | à voir — public : partagé ; « s’ajustent » = le plan s’ajuste seul |
| lib/app/actionsEcriture.ts:225 | Course ajoutée : les jours autour d’elle s’ajustent dans tes semaines. | s’ajustent | à voir — public : partagé ; « s’ajustent » = le plan s’ajuste seul |
| lib/app/actionsEcriture.ts:255 | Le moteur ne répond pas : réessaie dans un moment. | moteur | partagé |
| lib/app/actionsEcriture.ts:258 | Ta trace ne s’est pas lue : exporte-la de nouveau depuis le site de la course, avec son altitude. | lue | à voir — message de saisie ; public : partagé |
| lib/app/actionsEcriture.ts:329 | Course retirée : tes prochaines semaines s’écrivent sans elle. | s’écrivent | partagé |
| lib/app/actionsZones.ts:98 | C’est enregistré, ton coach le voit : tes zones changent dès maintenant, tes séances à partir de la semaine écrite dimanche. | écrite | coaché |

### Page « Profil »
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| app/app/profil/page.tsx:157 | Quand un repère manque, ta préparation écrit le test à la place d’une séance ; son résultat se lit dans Nolio. | écrit, se lit | partagé — carte « Tes tests » |
| app/app/profil/page.tsx:158 | Quand un repère manque, ta préparation écrit le test à la place d’une séance ; | écrit | partagé — carte « Tes tests » (sans accord de lecture) |
| app/app/profil/page.tsx:176 | Un test refait de ton côté s’entre ici : tes zones changent dès maintenant, tes séances à partir de la semaine écrite dimanche, et ton coach le voit sur ta fiche. | écrite | coaché |
| components/app/Badges.tsx:43 | Tes badges se débloquent tout seuls, d’après tes séances, avec ton accord : réponds « oui » au message de ton coach dans Nolio. | tout seuls | à voir — public : coaché ; « tout seuls » = automatisme |
| components/app/Badges.tsx:49 | Tes badges se calculent la nuit, d’après toutes tes séances de course et de trail dans Nolio. | se calculent | partagé |
| components/app/ProfilAthlete.tsx:68 | Ton coach le relit. | relit | à voir — public : coaché ; « relit » = le coach |
| components/app/ProfilGratuit.tsx:25 | J’accepte que City to Summit garde ces valeurs dans mon compte, seulement pour calculer mes zones et mes repères. Je peux les effacer à tout moment. | calculer | à voir — public : app gratuite ; « calculer mes zones » = outil |
| components/app/ProfilGratuit.tsx:101 | Ton style de coureur se lit dans ce test, ramené à un test de référence. | se lit | à voir — public : app gratuite |
| lib/app/zones.ts:132 | Ta préparation n’a pas de séance sur le plat où l’écrire : fais-le de toi-même, sur du plat, à la place d’une séance de seuil 2, hors des deux dernières semaines avant ta course. | écrire | à voir — public : partagé ; « où l’écrire » = la préparation écrit le test |

### Dans Nolio : questionnaires
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| lib/app/dimancheV9.ts:41 | Une minute, d’ici dimanche 18 h : tes séances de la semaine prochaine s’écrivent dimanche soir à partir de tes réponses. | s’écrivent | partagé — 9.x seulement ; description de « Ton point du dimanche » (moteur 9.x) |
| lib/app/dimancheV9.ts:61 | Une séance clé pas faite comme écrite ? | écrite | à voir — 9.x seulement ; public : partagé ; question de « Ton point du dimanche » (moteur 9.x) ; « comme écrite » sans sujet humain |
| lib/app/questionnaireSamedi.ts:63 | Une minute, d’ici dimanche 18 h : tes séances de la semaine prochaine s’écrivent dimanche soir à partir de tes réponses. | s’écrivent | partagé — 8.x seulement ; description de « Ta semaine prochaine » (moteur 8.x) |

### Dans Nolio : messages
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| lib/app/rappelDimanche.ts:20 | Petit rappel : ta semaine prochaine s’écrit ce soir. Pour qu’elle colle à ce que tu as vraiment fait, réponds au questionnaire du samedi et fais remonter tes séances dans Nolio (synchronise ta montre). Sinon, elle reste au même niveau, puis se recale dès que tout est à jour. | s’écrit, se recale | partagé — 8.x seulement ; rappel du dimanche sous la 8.x (les deux manquent) |
| lib/app/rappelDimanche.ts:21 | Petit rappel : ta semaine prochaine s’écrit ce soir. Pour qu’elle colle à ce que tu as vraiment fait, réponds au questionnaire du samedi. Sinon, elle reste au même niveau, puis se recale dès que tout est à jour. | s’écrit, se recale | partagé — 8.x seulement ; rappel du dimanche sous la 8.x (réponse seule) |
| lib/app/rappelDimanche.ts:22 | Petit rappel : ta semaine prochaine s’écrit ce soir. Pour qu’elle colle à ce que tu as vraiment fait, fais remonter tes séances dans Nolio (synchronise ta montre). Sinon, elle reste au même niveau, puis se recale dès que tout est à jour. | s’écrit, se recale | partagé — 8.x seulement ; rappel du dimanche sous la 8.x (séances seules) |

### Dans Nolio : notes
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| lib/app/ecriture.ts:2547 | Ta réponse ne se lit pas : envoie ta FC au seuil 1 à ton coach dans Nolio. | ne se lit pas | coaché — note « Ton test de la parole » ; variante sans compte app |
| lib/app/ecriture.ts:2548 | Ta réponse ne se lit pas : donne ta FC au seuil 1 dans ton app, ${lienZones} | ne se lit pas | partagé — note « Ton test de la parole » |
| lib/app/ecriture.ts:2562 | Ton test n’a pas pu se lire tout seul (${r.erreur.toLowerCase().replace(/\.$/, '')}) : ${sansApp(o) ? 'envoie tes deux distances à ton coach dans Nolio.' : `donne tes deux distances dans ton app, ${lienZones}`} | se lire tout seul | partagé — note « Ton test de vitesse critique » ; variante coaché sans app : « envoie tes deux distances à ton coach dans Nolio » |
| lib/app/ecriture.ts:2576 | Ta FC au seuil 2 n’a pas pu se lire toute seule : envoie-la à ton coach dans Nolio. | se lire toute seule | coaché — note « Ta FC au seuil 2 » ; variante sans compte app |
| lib/app/ecriture.ts:2577 | Ta FC au seuil 2 n’a pas pu se lire toute seule : donne-la dans ton app, ${lienZones} | se lire toute seule | partagé — note « Ta FC au seuil 2 » |

### Courriels
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| lib/app/emailBienvenue.ts:129 | ton app CTS te demandera aussi si ce que tu cours a changé depuis ton achat (ton volume par semaine, ta plus longue sortie) : ta première semaine s’écrira sur ta réponse. | s’écrira | partagé — courriel de l’acheteur d’un plan (le coaché qui achète un plan le reçoit aussi) ; commence après « Le jour de ton invitation, » |
| lib/app/emailBienvenue.ts:131 | Chaque semaine, Nolio te pose quelques questions sur ta semaine à venir, et la semaine suivante s’écrit le dimanche soir d’après tes réponses et ta semaine écoulée. | s’écrit | partagé — courriel de l’acheteur d’un plan (le coaché qui achète un plan le reçoit aussi) |

### Outils que l'athlète utilise lui-même (le mot décrit l'outil)
| Fichier:ligne | Phrase exacte | Mots repérés | Qui |
|---|---|---|---|
| app/app/calculateurs/[slug]/page.tsx:4 | Calculateur | Calculateur (outil) | partagé — outil |
| app/app/courses/[id]/nutrition/page.tsx:12 | Calculateur | Calculateur (outil) | partagé — outil |
| app/confidentialite/page.tsx:67 | Ce que tu saisis dans les calculateurs (fréquence cardiaque, allures, poids) reste dans ton navigateur : rien n’est envoyé ni enregistré. | calculateurs (outil) | partagé — outil |
| app/confidentialite/page.tsx:68 | Une exception, à ta demande : dans l’app, « Garder ma stratégie » range ta stratégie de course avec ta course (tes réponses au calculateur de nutrition, ton poids compris, et ses quatre repères), pour l’afficher dans ta fiche de course. | calculateur (outil) | partagé — outil |
| components/app/ProfilGratuit.tsx:130 | Calculer mes zones | Calculer (outil) | à voir — public : app gratuite ; libellé de bouton, outil |
| components/app/StrategieCourse.tsx:49 | Ta stratégie de course se construit avec le calculateur : il part de ta durée et de ton niveau, et tient compte de ton intestin, de la chaleur et de ta sueur. | calculateur (outil) | partagé — outil |
| components/app/StrategieCourse.tsx:54 | Revoir le détail dans le calculateur | calculateur (outil) | partagé — outil |
| components/app/StrategieCourse.tsx:61 | Ta stratégie gardée s’efface ; le calculateur reste là pour la refaire. | calculateur (outil) | partagé — outil |
| components/app/courses/ActionsDossier.tsx:167 | Ta stratégie gardée s’efface ; le calculateur reste là pour la refaire. | calculateur (outil) | partagé — outil |
| components/app/courses/DossierCourse.tsx:146 | Avec le calculateur City to Summit | calculateur (outil) | partagé — outil |
| components/app/courses/DossierCourse.tsx:161 | Ta stratégie de course se construit avec le calculateur : il part de ta durée et de ton niveau, et tient compte de ton intestin, de la chaleur et de ta sueur. | calculateur (outil) | partagé — outil |

## Ce que ce relevé ne couvre pas
- **Textes écrits par le moteur** (autre dépôt) : notes « Ta semaine », bilan, note « Ta réponse », noms et contenus de séances, description du questionnaire Hooper, `plan.couverture` et `plan.avertissement` repris dans la page de bienvenue et le courriel.
- **Fiches et calculateurs en HTML** : `public/bibliotheque/*.html`, `public/calculateur*.html` (s'affichent dans l'app). Un grep brut y donne environ 80 occurrences de moteur, calcul, génér, analys ou système, sans tri entre contexte machine et sens courant.
- **Courriel du code de connexion** : son gabarit est dans le tableau de bord Supabase, non versionné. **Textes écrits à la main par le coach dans Nolio** : hors dépôt.
- **CGV (`lib/cgv.ts`, 12 occurrences) et `lib/content.ts`** : acheteur et vente. Le lien « Conditions générales » est masqué aux coachés dans Compte, mais `/app/document/cgv` s'ouvre par son adresse.
- **Écartés comme acheteur seul** : `app/app/compte/page.tsx:160`, `lib/app/motsDuQuestionnaire.ts:24-25` et `33-34`, `components/app/Badges.tsx:44`, `ConfirmationCharge.tsx:37` et `76`, `lib/app/confirmation.ts:94`, `138`, `142`, `143`, `lib/app/actionsEcriture.ts:386` et `402`, `GestesEcriture.tsx:109-110`, `TableauDeBord.tsx:54` et `84`, `lib/app/emailBienvenue.ts:284`, `components/plan/Questionnaire.tsx` (372, 515, 635, 651, 677), `ApercuPlan.tsx`, `FinalisationAchat.tsx:49`, `lib/apercu.ts:17-18`.
- **Écartés comme coach seul** : `GestesEcriture` (33, 46, 237, 292), `actionsEcriture.ts` (53-59, 74, 370, 456, 468-469), `journalEnClair`, `passeDuLundi`, `espaceCoach`, `mesAthletes`, `zones.ts:208` et `213`, `correctionsTextes`, `actionsCoaching`, les courriels au coach.
- **« Nolio t'écrit / t'écrira »** (le sujet est Nolio, pas la semaine) : `app/app/bienvenue/page.tsx:76-77`, `PourBienDemarrer.tsx:73`, `TableauDeBord.tsx:26` et `40`, `emailBienvenue.ts:125`. **« adaptatif / s'adapte »**, hors du vocabulaire donné : `app/app/aller-plus-loin/page.tsx:46`, `52`, `55`, `components/app/AllerPlusLoin.tsx:7-8` ; `s'adapte` de `motsDuQuestionnaire.ts:43-44` figure dans des phrases déjà retenues.
- **Mots seuls écartés** : « Lire la fiche », « À lire avant ta course » (verbe d'action de l'athlète), « accord de lecture » hors des entrées retenues.
- **Les « à voir »** sont jugés sur le sens et les mots proches (relit, s'ajustent, tout seuls, se règlent, « ne se lit pas » des messages de saisie). Les cinq messages de saisie de `lib/app/coachingRegles.ts` s'adressent au prospect qui demande le coaching ; l'app gratuite (`aller-plus-loin`, `ProfilGratuit`, `rangerDossier`) s'adresse à l'utilisateur de l'app gratuite, pas à un coaché.
