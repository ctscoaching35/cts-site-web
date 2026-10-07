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

Essai en local, sans Stripe : l'API lancée en mode test (`./.venv/bin/python3 api.py`, dépôt du
moteur) prend chaque questionnaire pour payé.

## 7. La bêta privée : le lien d'invitation

Le questionnaire (`/plan`) répond 404 sauf `CTS_PLAN_OUVERT=1` (ouvert à tous) ou, pour la bêta, sur
invitation : avec dans `.env.local`

```
CTS_INVITATION=un-mot-a-toi
```

le lien `…/plan?invitation=un-mot-a-toi` ouvre le questionnaire et la page de retour du paiement
dans ce navigateur, 90 jours (un cookie). Changer le mot referme les liens déjà donnés.

## Ce qui viendra ensuite

- Stripe en mode test, puis sa confirmation de paiement (webhook) et l'e-mail de bienvenue.
- La suppression des comptes restés 3 ans sans connexion, après un e-mail d'avertissement (D4).
