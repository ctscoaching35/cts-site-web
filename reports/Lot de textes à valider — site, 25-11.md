# Lot de textes à valider — site, 25/11/2026

Les points encore ouverts côté site, à valider en une fois. Rien n’est codé : chaque point donne l’écran, qui le lit, la phrase d’aujourd’hui mot pour mot, une ou deux propositions (la recommandée en premier) et une ligne de raison. Les phrases sont dans la voix du guide éditorial : « tu », « on » = Juliette et Romain ensemble, « je » pour le coaché (c’est le coach qui parle), voix neutre pour l’acheteur. Aucune proposition ne contient « moteur », « calculé », « s’écrit », « lu » ; « calculateur » reste (décision 212). Nulle part l’acheteur n’est invité à parler au coach.

**Comment répondre** : « A », « B » ou « garder » pour chaque point (S3, S52, S73, S17, S49, S12–S16, S36, S51, S77, R1, R2, L1 à L3).

---

## S3 — « Comment c’est calculé ? »
- **Où, qui** : Accueil, sous le chiffre en pourcentage de la préparation réalisée, un lien qui déplie l’explication. Lu par le coaché, l’acheteur, et le coach sur la page d’un plan (`components/app/TableauDeBord.tsx:209`).
- **Aujourd’hui** : « Comment c’est calculé ? » (l’explication dessous : « Chaque séance faite compte pour sa durée. 100 %, c’est tout le volume prévu jusqu’à ta course : ce chiffre ne fait que monter. »)
- **A (recommandée)** : « D’où vient ce chiffre ? » (même phrase pour tout le monde)
- **B** : « Ce que compte ce chiffre »
- **Pourquoi** : la question vient de celui qui regarde, pas du coach ; « D’où vient » ne parle ni de machine ni de formule. La proposition « Comment j’en arrive là ? » du lot 212 faisait parler le coach d’un chiffre qui est celui du coureur.

## S52 — « Le moteur ne construit pas ce cas… »
- **Où, qui** : le questionnaire du coaching, deux endroits : sous le temps visé (« Au-delà de 12h, c’est hors du plafond de ce plan. … ») et sous la distance (« Une course de … km est un … : ce format n’est pas ouvert à ton niveau. Choisis une course de … . … »). Lu par le coach (Nouveau coaché) et par le coaché qui demande un objectif (Nouvel objectif) ; un seul texte pour les deux, le même sous les deux moteurs (`lib/plan.ts:188`).
- **Aujourd’hui** : « Le moteur ne construit pas ce cas : à préparer toi-même, hors du parcours automatique. »
- **A (recommandée)** : « Ce cas sort du parcours habituel : il se prépare à la main. »
- **B (deux voix)** : coaché : « Ce cas sort du parcours habituel : je le prépare à la main avec toi. » ; coach : « Ce cas sort du parcours habituel : à préparer à la main. »
- **Pourquoi** : « à la main » est déjà le mot du coach pour ce qu’il écrit lui-même ; la phrase d’aujourd’hui dit « toi-même » à un coaché qui ne peut rien préparer, et « moteur » à quelqu’un qui ne doit pas sentir de machine.

## S73 — « Un test refait de ton côté s’entre ici »
- **Où, qui** : Profil, carte « Tes tests », sous la liste. Lu par le coaché seulement (`app/app/profil/page.tsx:176-177`). Deux phrases selon que le coach écrit à la main ou non.
- **Aujourd’hui** : (à la main) « Un test refait de ton côté s’entre ici : tes zones changent dès maintenant, ton coach le voit sur ta fiche et en tient compte pour ta semaine suivante. » (sinon) « Un test refait de ton côté s’entre ici : tes zones changent dès maintenant, tes séances à partir de la semaine écrite dimanche, et ton coach le voit sur ta fiche. »
- **A (recommandée)** : (à la main) « Tu as refait un test de ton côté ? Entre-le ici. Tes zones changent tout de suite, je le vois sur ta fiche et j’en tiens compte pour ta semaine suivante. » (sinon) « Tu as refait un test de ton côté ? Entre-le ici. Tes zones changent tout de suite, tes séances à partir de la semaine que je te prépare dimanche, et je le vois sur ta fiche. »
- **B** (la proposition du lot 212, une seule faute corrigée) : « Un test refait de ton côté se saisit ici : tes zones changent dès maintenant, tes séances à partir de la semaine que je prépare dimanche, et je le vois sur ta fiche. »
- **Pourquoi** : « s’entre » n’existe pas en français et « s’écrit » donne l’idée d’une machine ; A dit à la personne ce qu’elle fait (« Entre-le ici ») en phrases courtes.

## S17 — la carte « Ton coach »
- **Où, qui** : Compte, carte sombre « Ton coach ». Lu par le coaché seulement (`app/app/compte/page.tsx:112-122`).
- **Aujourd’hui** (de haut en bas) : « Ton coach » / « Romain » / « Kiné du sport, à Rennes. Je relis ta préparation et je peux changer une semaine à tout moment. » (si le coach écrit à la main : « … Romain écrit tes séances dans Nolio. ») / « Écris-lui sur WhatsApp ou dans ton appli Nolio. Ses mots sur ta semaine sont dans Nolio. »
- **Le défaut** : la carte mélange deux voix : « Je relis » (le coach parle) puis « Écris-lui », « Ses mots » (on parle de lui).
- **A (recommandée, tout en « je »)** : « Kiné du sport, à Rennes. Je relis ta préparation et je peux changer une semaine à tout moment. » (à la main : « J’écris tes séances dans Nolio. ») / « Écris-moi sur WhatsApp ou dans ton appli Nolio. Mes mots sur ta semaine sont dans Nolio. »
- **B (tout à la troisième personne, la phrase d’origine)** : « Romain relit ta préparation et peut reprendre la main sur une semaine à tout moment. » (à la main : « Romain écrit tes séances dans Nolio. ») / « Écris-lui sur WhatsApp ou dans ton appli Nolio. Ses mots sur ta semaine sont dans Nolio. »
- **Pourquoi** : le lot 212 a choisi « je » pour le coaché ; A va au bout du choix. Le surtitre « Ton coach » et le prénom restent, comme une carte de visite.
- **À savoir** : cette phrase (comme S49) change aussi sous la 8.x : je ne l’ai pas fermée derrière la 9.x. Dis-le si elle doit rester comme avant sous la 8.x.

## S49 — « Je relis tes réponses… dis-le-lui »
- **Où, qui** : dernière étape du questionnaire quand un coaché demande un objectif, bloc « À lire avant d’envoyer ». Lu par le coaché (`components/plan/Questionnaire.tsx:612-616`).
- **Aujourd’hui** : « Je relis tes réponses avant de lancer ta préparation. Si une douleur ou une blessure t’empêche de courir normalement, dis-le-lui : vous adapterez ensemble. Ce plan ne remplace pas un avis médical. »
- **A (recommandée)** : « Je relis tes réponses avant de lancer ta préparation. Si une douleur ou une blessure t’empêche de courir normalement, dis-le-moi : j’adapte ta préparation avec toi. Ce plan ne remplace pas un avis médical. »
- **B** : « … dis-le-moi : on adaptera ensemble. … » (garde la phrase d’avant, seulement « lui » et « vous » changent)
- **Pourquoi** : la phrase voisine du lot 212 parlait encore du coach à la troisième personne. B reste proche de la phrase d’avant, mais dans le guide « on » veut dire Juliette et Romain, pas le coach et le coaché : A évite ce « on ».

## S12 à S16 — messages de saisie du formulaire de coaching
- **Où, qui** : « Demander le coaching » (`lib/app/coachingRegles.ts`), sous le champ, après un envoi. Lu par qui demande le coaching (compte gratuit), voix neutre. Le champ date est un calendrier : le message n’arrive que rarement.
- Les deux formes d’avant (« ne se lit pas », « je ne comprends pas ») sont écartées : A et B disent simplement quoi écrire.

| N° | Aujourd’hui | A (recommandée) | B |
|---|---|---|---|
| S12 | « Ton année de naissance n’est pas valide : quatre chiffres, par exemple 1988. » | « Écris ton année de naissance en quatre chiffres, par exemple 1988. » | « Ton année de naissance : quatre chiffres, par exemple 1988. » |
| S13 | « Tes heures par semaine ne sont pas valides : un nombre, par exemple 5 ou 5,5. » | « Écris tes heures par semaine en nombre, par exemple 5 ou 5,5. » | « Tes heures par semaine : un nombre, par exemple 5 ou 5,5. » |
| S14 | « La date de ta course n’est pas valide. » | « Choisis la date de ta course dans le calendrier. » | « Indique la date de ta course. » |
| S15 | « La distance ou le D+ de ta course n’est pas valide : des nombres, en km et en mètres. » | « Écris la distance de ta course en km et son D+ en mètres, avec des chiffres. » | « Distance en km, D+ en mètres : des nombres. » |
| S16 | « Ton téléphone n’est pas valide : un numéro avec ses 10 chiffres, par exemple 06 12 34 56 78. » | « Écris ton numéro de téléphone avec ses 10 chiffres, par exemple 06 12 34 56 78. » | « Ton téléphone : 10 chiffres, par exemple 06 12 34 56 78. » |

- **Pourquoi** : une consigne (« Écris… ») dit quoi faire sans que personne ne « comprenne » ou « lise » : le formulaire n’a pas de voix, le coach ne parle pas à sa place. B est plus sec, au cas où A paraîtrait long sous un champ.

## S36 — dossier de course refusé
- **Où, qui** : calculateur, quand on garde un dossier de course dans son compte gratuit (`lib/app/rangerDossier.ts:23`). Lu par le visiteur ou le compte gratuit, voix neutre. Arrive seulement si le dossier envoyé par le navigateur est mal formé.
- **Aujourd’hui** : « Ce dossier n’est pas valide : refais-le, puis garde-le. »
- **A (recommandée)** : « Ce dossier n’a pas pu être gardé : refais-le dans le calculateur, puis garde-le. »
- **B** : « Ce dossier est incomplet : relance le calculateur avec ta course, puis garde-le. »
- **Pourquoi** : A dit ce qui s’est passé (il n’est pas gardé) puis quoi faire ; B est plus précis mais suppose que c’est bien un oubli de la personne.

## S51 — plus longue côte
- **Où, qui** : trois endroits, trois lecteurs (`lib/cote.ts:39-43`) : (1) le formulaire de coaching, pour qui demande le coaching ; (2) le profil du coaché, dans la voix du coach ; (3) la fiche du coaché vue par le coach.
- **Aujourd’hui** : (1) « Ta plus longue côte n’est pas valide : un nombre de minutes, par exemple 12. » (2) « Je ne comprends pas ta plus longue côte : un nombre de minutes, par exemple 12. » (3) « Sa plus longue côte ne se lit pas : un nombre de minutes, par exemple 12. »
- **A (recommandée, un seul texte pour (1) et (2), un pour (3))** : (1)(2) « Écris ta plus longue côte en minutes, par exemple 12. » (3) « Écris sa plus longue côte en minutes, par exemple 12. »
- **B** : (1)(2) « Ta plus longue côte : un nombre de minutes, par exemple 12. » (3) « Sa plus longue côte : un nombre de minutes, par exemple 12. »
- **Pourquoi** : même consigne que S12 à S16 ; avec A, la voix « coach » de (2) n’est plus nécessaire, une clé de texte de moins.

## S77 — la case de consentement sur la fréquence cardiaque
- **Où, qui** : app gratuite, Profil (valeurs du test) et écran « Me connecter » avec un résultat à garder (`components/app/ProfilGratuit.tsx:25`). Lu par le visiteur ou le compte gratuit, à la première personne (c’est la personne qui consent).
- **Aujourd’hui** : « J’accepte que City to Summit garde ces valeurs dans mon compte, seulement pour établir mes zones et mes repères. Je peux les effacer à tout moment. »
- **A (recommandée)** : garder la case telle quelle, et mettre la page de confidentialité (« Dans l’app : tes zones », ligne 236) d’accord : « Elles servent seulement à établir tes zones et tes repères, et à régler tes séances. »
- **B** : changer la case : « … seulement pour établir mes zones et régler mes séances. Je peux les effacer à tout moment. »
- **Pourquoi** : la case dit « établir mes zones et mes repères », la page dit « régler tes séances » : deux finalités pour la même donnée. À faire relire par qui relit le juridique : le mot « établir » reste au coach, mais les deux textes doivent dire la même chose.

---

## « Romain » écrit en dur

Relevé complet (hors commentaires de code). Trois familles : (1) un seul prénom pour un rôle, à trancher ; (2) les deux prénoms ensemble, vrais tant que l’équipe est à deux ; (3) identité légale ou exemple.

### (1) Un seul prénom pour un rôle — à trancher

| N° | Fichier:ligne | Écran, lecteur | Phrase |
|---|---|---|---|
| R1 | `app/confidentialite/page.tsx:101` | Confidentialité, « ta demande de coaching ». Visiteur, compte gratuit. | « Elle va à Romain, qui t’appelle. » |
| R2 | `app/confidentialite/page.tsx:271` | Confidentialité, « Si tu es coaché par CTS sur Nolio ». Tout lecteur ; sujet : un coaché. | « Romain la suit et la corrige dans Nolio. » |

- **R1** : vrai aujourd’hui, car les demandes vont au seul premier compte de la liste des coachs (`lib/app/demandesCoaching.ts`) ; faux dès qu’un autre coach les reçoit. **A (recommandée)** : « Elle va à l’un de nous, qui t’appelle. » **B** : garder « Romain » (exact aujourd’hui). Pourquoi : la page ne doit pas changer à chaque changement de qui répond.
- **R2** : faux pour un coaché de Juliette ; la phrase est celle du lot 212. **A (recommandée)** : « Nous la suivons et la corrigeons dans Nolio. » **B** : « Juliette ou Romain la suit et la corrige dans Nolio. » Pourquoi : A parle comme le reste de la page (« nous gardons ») ; B garde les prénoms sans dire lequel.

### (2) Les deux prénoms — à garder, listés pour que tu les voies tous

| Fichier:ligne | Écran | Lecteur |
|---|---|---|
| `app/layout.tsx:18, 27` | description du site pour les moteurs de recherche, auteur de la page | public |
| `app/confidentialite/page.tsx:221, 292` | « Tes séances dans Nolio » ; « Qui y a accès » | acheteur, coaché |
| `lib/cgv.ts:70, 80` | CGV, « Ce que couvrent ces conditions » ; « Le plan » | acheteur |
| `app/app/bibliotheque/page.tsx:26, 46` | Bibliothèque (en-tête, et page vide) : « Les fiches de Juliette et Romain, kinés du sport, fondées sur la littérature. » | tous les comptes |
| `components/app/AccueilGratuit.tsx:21` | Accueil gratuit, carte « Lire la bibliothèque » : la même phrase | compte gratuit |
| `components/ContactForm.tsx:80` | site, confirmation du formulaire de contact : « Juliette ou Romain te répond personnellement sous 48h, à l’adresse indiquée. » | visiteur |
| `lib/content.ts:66, 68, 80, 142, 177, 251, 268` | pages publiques du site (équipe, avis, contact, questions fréquentes) | public |
| `lib/app/emailBienvenue.ts:154, 242, 288` | e-mails de bienvenue, de relance d’invitation et de rappel de confirmation (signature « Juliette et Romain — CTS Coaching ») | acheteur, coaché |
| `lib/app/relance.ts:36`, `lib/app/comptesInactifs.ts:25`, `lib/app/espaceAthlete.ts:55` | e-mails de relance du questionnaire, de suppression d’un compte inactif, d’ouverture de l’espace (même signature) | visiteur, compte, coaché |

- **Bibliothèque** : si tu veux sortir les prénoms de l’app, **A** : « Nos fiches de kinés du sport, fondées sur la littérature. » **B** : garder. Pourquoi : les prénoms sont ce que le guide appelle « chaleureux » ; je les garderais tant que l’équipe est à deux.

### (3) À garder

- `app/app/compte/page.tsx:30-31, 78, 85` : la table des coachs (« Romain : Kiné du sport, à Rennes. », « Juliette : … à Annecy. »), le coach d’exemple de la démonstration, et « Ton coach » quand le compte n’a pas de prénom. Dans l’app réelle le prénom vient du compte du coach.
- `lib/vendeur.ts:9` : « Romain Leterme », vendeur légal (mentions légales, CGV, pied des e-mails).
- Commentaires de code seulement, rien à l’écran : `lib/app/cleMoteur.ts:7`, `lib/app/coachingRegles.ts:11`, `lib/app/demandesCoaching.ts:6, 26`.

---

## « ton coach » dans les pages légales

Les pages parlent en « nous » (CTS) ; seule la section « Si tu es coaché par CTS sur Nolio » et la demande de coaching disent « ton coach » ou « le coach ». Les CGV disent « un coach » pour dire ce que le plan n’est pas (« sans échange avec un coach ») : exact, je n’y touche pas.

| N° | Fichier:ligne | Section, lecteur | Phrase d’aujourd’hui |
|---|---|---|---|
| L1 | `app/confidentialite/page.tsx:105` | app gratuite, « ta demande de coaching » ; visiteur | « … et elle l’est tout de suite si le coach la classe sans suite. » |
| L2 | `:272` | coaché ; tout lecteur | « … celles que ton coach écrit à la main comprises, relevées chaque nuit dans Nolio … » |
| L2 | `:276, 278` | idem | « si ton coach t’ouvre un espace dans l’app, nous gardons ton adresse e-mail … arrive dans l’espace de ton coach ; » |
| L3 | `:283` | idem | « Personne d’autre que ton coach et toi ne voit ces données. » |

- **A (recommandée)** : dire « nous » comme le reste de la page. L1 : « … si nous la classons sans suite. » L2 : « … celles que nous écrivons à la main comprises … » ; « si nous t’ouvrons un espace dans l’app, nous gardons ton adresse e-mail … arrive dans notre espace coach ; » L3 : « Personne d’autre que nous et toi ne voit ces données. »
- **B** : garder « ton coach » et dire qui il est, une fois, en tête de la section : « Ton coach, c’est Juliette ou Romain. »
- **Pourquoi** : A est plus juste en droit : « personne d’autre que ton coach et toi » est faux dans Nolio, où Juliette et Romain voient tous les deux l’équipe (la page le dit ligne 221) ; « nous » couvre les deux sans nommer qui. B garde un mot que le coaché connaît, au prix d’une phrase de plus.
- **Retombée** : si A, R2 devient « Nous la suivons et la corrigeons dans Nolio. » : un seul choix pour R2, L1, L2, L3.

---

## À dire en passant
- **Sous la 8.x** : S17 et S49 (« Je relis… ») changent aussi, S52 est un seul texte pour les deux moteurs, et chaque page légale n’a qu’une version. Dis-moi si l’une doit rester comme avant sous la 8.x.
- **Non repris ici** : les champs de la préparation du contrat (courses mineures, aisance, saison de fond, pic précédent, D′) : après la mise en ligne.
- Rien n’est codé, poussé, ni écrit dans Nolio. Une réponse « A » partout = environ vingt-cinq phrases à changer, avec leurs essais.
