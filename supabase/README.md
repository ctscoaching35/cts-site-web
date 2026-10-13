# Supabase — mise en place des comptes de l'app

*Étape 1b du cadrage de l'app (CTS_APP_CADRAGE.md, dépôt du moteur). Décisions : comptes créés au
paiement, connexion par un code à 6 chiffres reçu par e-mail (D6) ; Supabase, serveurs en Europe
(D7) ; aucune donnée de santé (D4). Ce que tu fais une fois, dans l'ordre.*

## 1. Le projet

Sur supabase.com : un compte, puis **New project**, région **Europe (Paris ou Francfort)**. Le mot
de passe de la base que Supabase demande se garde dans ton gestionnaire de mots de passe ; l'app
ne s'en sert pas.

## 2. Les tables

**SQL Editor › New query** : coller `supabase/migrations/20261007000000_comptes_plans_achats.sql`,
puis **Run**. Il crée les comptes, les achats, les plans, le rangement privé des PDF, et les règles
qui ne laissent chacun lire que ce qui est à lui.

## 3. La connexion par code

- **Authentication › Sign In / Providers › Email** : l'e-mail activé ; **Email OTP Length** à 6.
- **Authentication › Sign In / Providers** : décocher **Allow new users to sign up**. Un compte
  naît au paiement, jamais depuis la page de connexion.
- **Authentication › Emails › Magic Link** : le modèle envoie le code, pas un lien. Sujet et
  texte proposés (à valider) :

  > **Sujet :** Ton code de connexion CTS
  >
  > Ton code pour ouvrir ton plan CTS : **{{ .Token }}**
  >
  > Il est valable une heure. Si tu n'as rien demandé, ignore cet e-mail.

- **Authentication › URL Configuration › Site URL** : `http://localhost:3000` pendant la
  construction (l'adresse du site au lancement).

**Le modèle n'est modifiable qu'avec un serveur d'envoi à soi** (constaté le 07/10/2026 : les
nouveaux projets gratuits sur le service intégré de Supabase envoient le modèle par défaut, un
lien, et seulement aux membres de l'organisation). D'où Brevo, prévu au cadrage (D7) :
- Brevo, **SMTP et API › SMTP** : serveur `smtp-relay.brevo.com`, port `587`, identifiant
  `…@smtp-brevo.com` (pas l'e-mail du compte), et une clé SMTP générée pour Supabase (affichée
  une seule fois) ; l'expéditeur déclaré et vérifié dans **Expéditeurs**.
- Supabase, **Authentication › Emails › SMTP Settings** : *Enable Custom SMTP*, l'expéditeur,
  le nom « CTS Coaching », le serveur, le port, l'identifiant et la clé de Brevo.

Expéditeur des essais : ctscoaching35@gmail.com, **non authentifié** (Brevo ne peut pas
authentifier une adresse Gmail) : le code peut finir en indésirables. Avant le lancement :
authentifier le domaine cts-coaching.com dans Brevo (enregistrements DNS) et envoyer depuis une
adresse du site.

## 4. Les clés

**Project Settings › API Keys** (et **Data API** pour l'URL), dans `.env.local` (le fichier n'est
jamais versionné). Selon l'âge du projet, Supabase nomme les clés `anon` / `service_role` (onglet
*Legacy API Keys*) ou `publishable` / `secret` (`sb_publishable_…`, `sb_secret_…`) : les deux
conviennent, la publique dans la deuxième ligne, la secrète dans la troisième.

```
NEXT_PUBLIC_SUPABASE_URL=…          (Project URL)
NEXT_PUBLIC_SUPABASE_ANON_KEY=…     (anon public)
SUPABASE_SERVICE_ROLE_KEY=…         (service_role — secrète, jamais dans le navigateur)
```

Puis relancer `npm run dev`. Dès que les deux premières sont là, `/app` demande la connexion ; sans
elles, l'app reste en démonstration.

## 5. Essayer

```
npm run app:plan-exemple -- ton@email.fr L4
```

crée le compte de cet e-mail s'il n'existe pas et y range le plan d'exemple de l'OCC (`L1` pour
GRF18) ; il répond « Plan L4 (OCC) rattaché à … ». Un plan est figé à sa génération : après une
correction de texte du moteur (plans d'exemple régénérés), `--remplacer` à la fin de la commande
supprime d'abord les plans d'essai du compte. Ensuite : http://localhost:3000/app → ton
e-mail → le code reçu → ton plan. La course de l'OCC est le 5 juin 2027 : aujourd'hui, l'app
montre « Ta préparation commence le 21 décembre 2026 » ; en développement, `?jour=2027-03-30`
simule un autre jour.

Si le code n'arrive pas : les indésirables, puis la limite d'envoi de Supabase (quelques e-mails
par heure) — attendre un peu. Si « Ce code ne fonctionne pas » : la longueur du code (6), le modèle
d'e-mail (`{{ .Token }}`), un code plus récent demandé entre-temps (seul le dernier vaut).

## 6. Le plan rangé au paiement

La page de retour du paiement (`/plan/merci?session_id=…`) demande le plan à l'API, puis le range
(`lib/app/rangement.ts`) : le compte de l'e-mail du questionnaire, retrouvé ou créé confirmé ;
l'achat ; le plan figé, ses réponses gardées, son PDF dans `plans-pdf`. Une page rechargée ne range
rien de plus. L'athlète arrive dans l'app SANS CODE seulement si le compte vient d'être ouvert par
cet achat, dans l'heure : l'e-mail tapé au questionnaire n'est pas prouvé, un compte qui portait déjà
un plan s'ouvre avec le code (« Ton nouveau plan est rangé dans ton compte »).

Essai en local : l'API lancée (`./.venv/bin/python3 api.py`, dépôt du moteur) ; avec la clé Stripe
de test dans son `.env`, le paiement passe par Stripe (carte 4242 4242 4242 4242) ; sans clé, chaque
questionnaire est pris pour payé.

L'e-mail de bienvenue (`lib/app/emailBienvenue.ts`, texte validé par le coach le 07/10/2026) part
avec le PDF, une fois par plan rangé, par l'API transactionnelle de Brevo : une clé d'API (pas la
clé SMTP), dans `.env.local`

```
BREVO_API_KEY=xkeysib-…
```

Brevo › profil › SMTP et API › Clés API › Générer. Sans elle, rien ne part (un avertissement dans
le journal du serveur). Expéditeur : ctscoaching35@gmail.com, ou `CTS_EMAIL_EXPEDITEUR`.

## 7. La bêta privée : le lien d'invitation

Le questionnaire (`/plan`) répond 404 sauf `CTS_PLAN_OUVERT=1` (ouvert à tous) ou, pour la bêta, sur
invitation : avec dans `.env.local`

```
CTS_INVITATION=un-mot-a-toi
```

le lien `…/plan?invitation=un-mot-a-toi` ouvre le questionnaire et la page de retour du paiement
dans ce navigateur, 90 jours (un cookie). Changer le mot referme les liens déjà donnés.

## 8. « Tes zones » : le profil de l'athlète

Une table de plus, `zones` (`supabase/migrations/20261008000000_zones.sql`) : SQL Editor, coller le
fichier, Run (« Success. No rows returned »). Elle garde, pour un plan, la FC au seuil 1, la vitesse
critique et D′, la FC au seuil 2, avec la date du consentement de l'athlète. Le serveur du site y
écrit (clé de service, après avoir vérifié la session) ; l'athlète ne lit que les siennes. Sans
cette table, la rubrique « Tes zones » s'affiche mais n'enregistre rien.

## 9. Le journal de séance

Deux tables de plus, `journaux` et `retours` (`supabase/migrations/20261008100000_journal.sql`) : SQL
Editor, coller le fichier, Run (« Success. No rows returned »). Après chaque séance, l'athlète dit si elle
est faite, raccourcie ou pas faite, son RPE ressenti et ses sensations ; rien n'est gardé sans son
consentement au journal (daté dans `journaux`), et jamais de douleur. Sans ces tables, le journal
s'affiche mais n'enregistre rien.

## 10. Déplacer une séance

Une table de plus, `deplacements` (`supabase/migrations/20261008200000_deplacements.sql`) : SQL Editor,
coller le fichier, Run (« Success. No rows returned »). L'athlète échange deux jours de la même semaine ;
une ligne par séance qui n'est plus à son jour prévu. Le plan lui-même ne change pas. Pas de
consentement : c'est l'organisation de la semaine, pas une donnée de santé. Sans cette table, « Changer
de jour » s'affiche mais l'échange n'aboutit pas.

## 11. S'adapter aux retours

Une table de plus, `ajustements` (`supabase/migrations/20261008300000_ajustements.sql`) : SQL Editor,
coller le fichier, Run (« Success. No rows returned »). Quand un retour de séance déclenche une règle du
mode d'emploi (une marche reprise, une séance dure allégée), l'app la propose ; l'athlète l'applique ou la
refuse, et la décision est gardée ici, sous le consentement du journal. Sans cette table, les propositions
s'affichent mais ne s'enregistrent pas.

## 12. Le coaching par Nolio

Trois tables de plus, `nolio_comptes`, `coaching` et `nolio_envois`
(`supabase/migrations/20261011000000_coaching.sql`) : SQL Editor, coller le fichier, Run. La page coach
(`/app/coach`, réservée aux e-mails de la variable `CTS_COACHS` dans Vercel) parle à Nolio au nom du coach. Depuis
le passage à l'API v2 (section 18), avec la clé de son application personnelle, `NOLIO_API_KEY` dans Vercel ;
`nolio_comptes` (la liaison OAuth de la v1) n'existe plus.

## 13. L'athlète coaché sur la durée

Une table de plus, `athletes_coaches` (`supabase/migrations/20261011100000_athletes_coaches.sql`) : SQL Editor,
coller le fichier, Run. La fiche d'un athlète coaché regroupe ses objectifs successifs (un plan par objectif),
son nom Nolio et ses valeurs (FC au seuil 1, vitesse critique, FC au seuil 2), saisies par le coach. Les
athlètes déjà ajoutés reçoivent leur fiche au passage du fichier.

## 14. Un plan par achat (webhook de Stripe)

Un index de plus (`supabase/migrations/20261013000000_un_plan_par_achat.sql`) : SQL Editor, coller le fichier,
Run. Le webhook de Stripe (`app/api/stripe/webhook`) range le plan d'un paiement réussi même si l'acheteur ferme
la page avant d'y revenir ; avec la page de retour, deux appels peuvent ranger le même achat au même instant :
l'index garde un seul plan, et un seul e-mail de bienvenue part.

## 15. La relance d'un questionnaire commencé

Une table de plus, `relances` (`supabase/migrations/20261013100000_relances.sql`) : SQL Editor, coller le fichier,
Run. La case « Envoie-moi un rappel » du questionnaire y range l'e-mail et la date de l'accord, rien d'autre ;
le passage quotidien (`vercel.json`, `/api/relance/envoyer`, protégé par CRON_SECRET) envoie une relance, une
seule, aux accords de plus de 24 h sans achat ; l'achat l'annule ; les lignes de plus de 30 jours s'effacent.

## 16. La mesure du tunnel de vente

Une table de plus, `mesures` (`supabase/migrations/20261013200000_mesures.sql`), et sa fonction
`compter_mesure` : SQL Editor, coller le fichier, Run. Des compteurs anonymes par jour (page des plans vue,
questionnaire commencé, récapitulatif atteint, paiement lancé), sans cookie ni adresse ; relus avec les achats
dans l'espace coach (`/app/coach/chiffres`). Les visites et leur provenance : Vercel Analytics.

## 17. L'allure du seuil 1

Deux colonnes de plus (`supabase/migrations/20261013300000_allure_seuil1.sql`) : `zones.v_seuil1_ms` (l'allure du
palier du test de la parole, saisie par l'athlète) et `athletes_coaches.v_seuil1_ms` (saisie par le coach, pour
Nolio) : SQL Editor, coller le fichier, Run. Recoupée avec la vitesse critique (moteur 8.320), elle décale les
allures de récupération, d'endurance et de seuil 1, comme le calculateur « Ton profil de traileur ».

## 18. Nolio en API v2

Un fichier de plus (`supabase/migrations/20261013400000_nolio_v2.sql`) : SQL Editor, coller le fichier, Run.
L'athlète Nolio d'une fiche devient un identifiant texte (« usr_… ») ; les numéros de la v1 déjà enregistrés sont
convertis par l'app à la première visite. La table `nolio_comptes` et ses jetons OAuth partent : l'app parle à
Nolio avec la clé `NOLIO_API_KEY` (Vercel), saisie par le coach.

## 19. L'accord des athlètes pour le suivi

Une table de plus, `nolio_accords` (`supabase/migrations/20261013500000_nolio_accords.sql`) : SQL Editor, coller le
fichier, Run. Le tableau de suivi du coach (`/app/coach/suivi`) ne lit dans Nolio que les athlètes dont l'accord est
coché ; la table ne garde que leur identifiant Nolio, leur nom et la date. Rien de ce qui est lu dans Nolio n'est gardé.

## Ce qui viendra ensuite

- La suppression des comptes restés 3 ans sans connexion, après un e-mail d'avertissement (D4).
