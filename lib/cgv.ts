/**
 * LE TEXTE DES CONDITIONS GÉNÉRALES DE VENTE, UNE SEULE SOURCE (5B, décision coach du 05/11/2026 au soir) : la page /cgv
 * (app/cgv/page.tsx) et la confirmation de commande (lib/app/emailBienvenue.ts, art. L221-13 du code de la consommation :
 * le contrat confirmé sur un support durable, qu'un lien vers une page web n'est pas) rendent ces mêmes articles. Un
 * changement du texte se fait ici, et change les deux.
 *
 * Les articles, dans l'ordre où ils s'affichent : leur numéro se calcule de leur rang (NUMEROS), et un renvoi
 * (« article 11 ») se donne par la clé de l'article visé ({ article: 'retractation' }). Un paragraphe est une suite de
 * morceaux : du texte, un lien, un renvoi, un saut de ligne. Deux blocs dépendent du support : le prix (la page le lit dans
 * l'API ; l'e-mail renvoie à la commande, en tête) et le formulaire de rétractation (lib/vendeur.ts).
 *
 * Sans dépendance au serveur (lu par les e-mails, qui ne doivent pas tirer la session du site).
 *
 * L'historique du texte (repris des commentaires de la page) :
 * - les CGV des plans (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L5), écrites le 15/10/2026 à partir de ce que le
 *   site et l'app font réellement, relues par le coach ; la case du récapitulatif les fait accepter
 *   (components/plan/Questionnaire.tsx), l'API en garde la date chez Stripe (E4) ;
 * - CORRIGÉ LE 05/11/2026 d'après les audits A et B de la Préparation CTS (S3, « A » : corrigé sans juriste, relu par
 *   Romain) : la garantie de fourniture continue (J2), l'accès dès le paiement et ce qu'on achète (J3), Nolio, une course
 *   qui change et « personne ne relit » (J4), la préparation qui évolue (J6), le code promotionnel (J10), et les mineurs
 *   (majorité, langue et archivage, propriété, juridiction) ; la relecture juridique du 05/11/2026 au soir (l'art. 6 suit
 *   L. 224-25-26). La date de version (lib/vendeur.ts, VERSION_CGV) passe au jour de la mise en ligne.
 */
import { FORMULAIRE_RETRACTATION, mediateur, vendeur, VERSION_CGV } from './vendeur';
import { site } from './content';

export type CleArticle = 'qui' | 'couvrent' | 'plan' | 'nolio' | 'course' | 'evolue' | 'sante' | 'prix' | 'commande'
  | 'paiement' | 'retractation' | 'garanties' | 'propriete' | 'donnees' | 'reclamations' | 'droit';
// Un lien : vers une page du site (« /confidentialite »), une adresse (mailto:, tel:) ou un autre site (externe).
export type Lien = { lien: string; texte: string; externe?: boolean };
export type Morceau = string | Lien | { article: CleArticle } | { saut: true };
export type Bloc =
  | { type: 'p'; morceaux: Morceau[] }
  | { type: 'liste'; elements: Morceau[][] }
  // La liste des prix (page) ou le renvoi à la commande (e-mail).
  | { type: 'prix' }
  // Le formulaire de rétractation, encadré (lib/vendeur.ts, FORMULAIRE_RETRACTATION).
  | { type: 'formulaire' }
  // L'encadré des garanties légales, un paragraphe par élément.
  | { type: 'encadre'; paragraphes: Morceau[][] };
export type Article = { cle: CleArticle; titre: string; blocs: Bloc[] };

// Le « X » du modèle de la fourniture continue (J2) : la période contractuelle de fourniture.
export const PERIODE_FOURNITURE = 'la durée de la préparation (du paiement à la fin de la récupération qui suit la course)';

// Le prix sans la liste de l'API (la page, quand l'API ne répond pas).
export const PRIX_SANS_LISTE = 'Le prix de chaque durée est affiché sur la page des plans.';
// Le prix dans l'e-mail (5B) : le renvoi à la commande, en tête de l'e-mail. BROUILLON, à valider par le coach.
export const PRIX_DANS_L_EMAIL = 'Le prix de chaque durée est affiché sur la page des plans ; celui que tu as payé est dans ta commande, en tête de cet e-mail.';

const p = (...morceaux: Morceau[]): Bloc => ({ type: 'p', morceaux });
const liste = (...elements: (Morceau | Morceau[])[]): Bloc => ({ type: 'liste', elements: elements.map((e) => (Array.isArray(e) ? e : [e])) });
const art = (article: CleArticle) => ({ article });
const SAUT = { saut: true } as const;
// « par e-mail à …, par téléphone au … ou par courrier au … », repris dans quatre articles.
const CONTACT: Morceau[] = [
  'par e-mail à ', { lien: `mailto:${vendeur.email}`, texte: vendeur.email }, ', par téléphone au ',
  { lien: `tel:${vendeur.telephoneLien}`, texte: vendeur.telephone }, ` ou par courrier au ${vendeur.adresse}`,
];
const CONFIDENTIALITE: Lien = { lien: '/confidentialite', texte: 'politique de confidentialité' };

export const ARTICLES: Article[] = [
  {
    cle: 'qui', titre: 'Qui vend', blocs: [
      p(`Les plans d’entraînement vendus sur www.cts-coaching.com le sont par ${vendeur.nom}, ${vendeur.forme}, sous le nom commercial ${vendeur.nomCommercial}, ${vendeur.adresse}, SIRET ${vendeur.siret}. Pour nous joindre : `, ...CONTACT, '.'),
    ],
  },
  {
    cle: 'couvrent', titre: 'Ce que couvrent ces conditions', blocs: [
      p('Elles s’appliquent à l’achat d’un plan d’entraînement en ligne (« le plan ») par un particulier (« tu »). Le coaching individualisé, suivi par Juliette ou Romain, fait l’objet d’un accord séparé : ces conditions ne le couvrent pas.'),
      p('En cochant la case prévue au récapitulatif, avant le paiement, tu acceptes ces conditions dans leur version en vigueur le jour de ta commande. Le service s’adresse aux personnes majeures : en cochant cette case, tu confirmes être majeur, ou avoir l’accord de ton représentant légal.'),
    ],
  },
  // Le parcours Nolio (décisions coach des 18-19/10/2026, P1 à P4, T1 à T11, O1 à O3) ; partie acheteurs validée par le
  // coach le 04/11/2026 au soir, avec l'invitation le lundi de la semaine qui précède le départ et la confirmation de
  // charge avant un départ éloigné (lib/app/invitation.ts). Corrigée le 05/11/2026 (S3, J4) : « personne ne relit »
  // n'était pas vrai, le coach voit l'équipe Nolio.
  {
    cle: 'plan', titre: 'Le plan', blocs: [
      p('Une préparation de trail, construite automatiquement par la méthode CTS à partir de tes réponses au questionnaire : ta course (date, distance, dénivelé, trace GPX si tu en as une), ton niveau, ce que tu cours en ce moment, ton terrain d’entraînement et tes jours disponibles, puis ajustée chaque semaine par des règles automatiques. Elle est construite et ajustée sans échange avec un coach : aucun coach ne suit ta préparation au jour le jour ni ne répond à tes commentaires dans Nolio. Juliette et Romain, les coachs de l’équipe CTS dans Nolio, y voient tes séances comme celles de tout athlète de l’équipe, et peuvent y corriger une séance ; pour une question, écris-nous.'),
      p('Elle comprend :'),
      liste(
        'ta trame jusqu’à ta course, sur la durée choisie (3, 4 ou 6 mois), dans l’app (« Mon plan ») : pour chaque semaine, son type, son volume et ses séances clés, les week-ends choc annoncés d’avance ;',
        'une invitation dans l’équipe CTS sur Nolio, la plateforme d’entraînement que nous utilisons (un compte d’athlète gratuit, créé à ton adresse si tu n’en as pas), envoyée le lundi de la semaine qui précède ton départ, ou dès ton paiement si ta préparation commence dans les 7 jours : tes séances détaillées y sont écrites chaque dimanche pour la semaine suivante, d’après ta semaine écoulée, tes réponses au questionnaire du samedi et, si tu l’acceptes, ton effort ressenti et ton Hooper ; après ta course, ta récupération y est écrite aussi, puis tu quittes l’équipe, ton compte Nolio et tes séances restent à toi ;',
        'l’accès à l’app CTS, ton tableau de bord : ta course, ta trame, ta jauge de préparation et tes graphiques, ta fiche de course et la bibliothèque de fiches ; si ton achat date de plus de 3 semaines au moment de ton invitation, l’app te demande alors si ce que tu cours a changé, et ta première semaine s’écrit sur ta réponse.',
      ),
      p('Elle ne comprend ni suivi ni échange avec un coach, ne convient pas à une blessure en cours, et ne remplace pas un avis médical (article ', art('sante'), '). Nolio s’utilise dans son application et sur son site, selon ses propres conditions ; l’envoi des séances sur une montre dépend de Nolio et de ta montre.'),
      p('L’app s’ouvre dans un navigateur récent, sur téléphone ou sur ordinateur, et peut s’ajouter à l’écran d’accueil du téléphone. Il faut une connexion internet pour s’y connecter : la connexion se fait par un code à 6 chiffres envoyé par e-mail, sans mot de passe.'),
      p('Ton plan reste accessible dans l’app au moins jusqu’à la fin de ta récupération après ta course, et tant que ton compte existe. Un compte resté 3 ans sans activité est supprimé, après un e-mail d’avertissement 30 jours avant (voir la ', CONFIDENTIALITE, ').'),
      p('Les durées proposées dépendent de ta course et de ton niveau. Avant tout paiement, le questionnaire te dit si la préparation demandée ne lui paraît pas possible, et pourquoi.'),
    ],
  },
  // J4 (audits du 05/11/2026, S3) : ce qui se passe sans Nolio, de ton fait ou du nôtre. À relire par Romain.
  {
    cle: 'nolio', titre: 'Nolio', blocs: [
      p('Tes séances détaillées s’écrivent dans Nolio : il te faut un compte Nolio (gratuit), que l’invitation crée si tu n’en as pas.'),
      liste(
        ['Si tu ne rejoins pas l’équipe CTS (une invitation refusée ou jamais acceptée), si tu la quittes ou si tu coupes l’accès de Nolio à ton compte, tes séances ne peuvent plus t’arriver : ta trame reste dans l’app, et ton achat n’est pas remboursé en dehors de ton droit de rétractation (article ', art('retractation'), '). Écris-nous : nous t’envoyons une nouvelle invitation.'],
        'Si Nolio est en panne, tes séances s’écrivent dès qu’il répond de nouveau. Si Nolio ne nous permet plus de les écrire et que nous ne pouvons pas te les fournir autrement, nous te remboursons la part du prix des semaines qui restent jusqu’à ta course.',
      ),
    ],
  },
  // J4 (audits du 05/11/2026, S3) : une course reportée ou annulée (PL6 du 04/11/2026 : la date ne change qu'avant le
  // départ). À relire par Romain.
  {
    cle: 'course', titre: 'Ta course change', blocs: [
      liste(
        'Avant ton départ (ta première semaine dans Nolio), ta course change de date : écris-nous, nous déplaçons ta préparation sur la nouvelle date, sans frais.',
        'Ta course est annulée avant ton départ : nous te remboursons intégralement.',
        ['Après ton départ, ta préparation continue jusqu’à la date prévue : un report ou une annulation de ta course ne donne pas de remboursement en dehors de ton droit de rétractation (article ', art('retractation'), ') ; écris-nous, nous voyons avec toi la meilleure suite.'],
      ),
    ],
  },
  // J6 (audits du 05/11/2026, S3) : le moteur refait les plans en cours avec ses améliorations, chaque nuit qui suit une
  // mise à jour ; la clause qui le prévoit (une modification d'un service fourni en continu). À relire par Romain.
  {
    cle: 'evolue', titre: 'Ta préparation évolue', blocs: [
      p('La méthode CTS s’améliore au fil des semaines : ses améliorations s’appliquent à tes semaines suivantes, sans frais, jamais à celles déjà écrites dans ton Nolio. Elles ne changent ni ta course, ni ta formule, ni ton prix. Si l’une te gêne, écris-nous : nous voyons avec toi. Une modification qui pourrait gêner ta préparation t’est annoncée à l’avance par e-mail, avec sa date ; si elle la gêne autrement que de façon mineure, tu peux mettre fin au contrat, sans frais, dans les 30 jours qui suivent son annonce ou, si c’est plus tard, son application, et nous te remboursons la part du prix des semaines qui restent jusqu’à ta course (article L. 224-25-26 du code de la consommation).'),
    ],
  },
  {
    cle: 'sante', titre: 'Ta santé', blocs: [
      p('Le plan ne remplace pas un avis médical. Avant de commencer, lis l’avertissement affiché au récapitulatif et en tête de ton plan : si tu as un doute de santé, une douleur, une blessure en cours ou un antécédent qui pourrait interagir avec l’entraînement, consulte un professionnel de santé. En cours de préparation, adapte ou interromps une séance en cas de douleur inhabituelle, de fatigue excessive ou de tout signe qui te semble anormal : le plan ne peut pas remplacer ton propre jugement sur ce que ton corps te dit.'),
    ],
  },
  {
    cle: 'prix', titre: 'Prix', blocs: [
      { type: 'prix' },
      p('TVA non applicable, article 293 B du code général des impôts. Aucun autre frais ne s’ajoute. Le prix à payer est affiché au récapitulatif, puis sur la page de paiement, avant que tu ne payes.'),
      // J10 (audits du 05/11/2026, S3) : un code est une remise sur le prix affiché, jamais un prix de référence barré.
      p('Un code promotionnel, quand il y en a un, se saisit sur la page de paiement : il donne une remise sur le prix affiché ci-dessus, qui reste le prix de la formule, dans les conditions et jusqu’à la date annoncées avec lui. C’est un achat unique : pas d’abonnement, rien ne se renouvelle.'),
    ],
  },
  {
    cle: 'commande', titre: 'Commande', blocs: [
      liste(
        'Tu réponds au questionnaire.',
        ['Au récapitulatif, tu relis tes réponses et peux les corriger, tu lis l’avertissement santé et ce que tu achètes, puis tu coches la case qui accepte ces conditions et celle qui demande que ton accès commence dès ton paiement (article ', art('retractation'), ').'],
        'Tu payes sur la page de paiement sécurisée de notre prestataire Stripe.',
      ),
      p('Le contrat est conclu quand ton paiement est confirmé. Tu reçois alors par e-mail la confirmation de ta commande : ta formule et ses dates, le prix payé, le vendeur, le lien vers ces conditions avec leur version, et le formulaire de rétractation. Garde-la : c’est ton exemplaire du contrat.'),
      // A-42 (audits du 05/11/2026) : la langue et l'archivage du contrat (article 1127-1 du code civil).
      p('Le contrat est conclu en français. Nous gardons la version de ces conditions que tu as acceptée, avec la date de ton acceptation, et te l’envoyons sur simple demande.'),
    ],
  },
  {
    cle: 'paiement', titre: 'Paiement', blocs: [
      p('Par carte bancaire (Apple Pay et Google Pay compris), sur la page de paiement de Stripe (Stripe Payments Europe, Ltd.). Nous ne voyons ni ne gardons tes numéros de carte. Le prix est débité en une fois, au moment de la commande ; il apparaît sur ton relevé sous le libellé « CTS COACHING ».'),
    ],
  },
  // Décision coach du 19/10/2026 : avec Nolio, la préparation s'exécute semaine après semaine jusqu'à la course ; c'est un
  // service, rétractable 14 jours, payé au prorata de ce qui a été fourni (art. L221-25). J3 (audits du 05/11/2026, S3) :
  // la demande porte sur l'accès, qui commence au paiement ; la première séance a sa date.
  {
    cle: 'retractation', titre: 'Début de ta préparation et droit de rétractation', blocs: [
      p('Ton accès commence dès ton paiement confirmé : ton plan s’affiche dans l’app, ton compte est créé, l’e-mail de bienvenue t’est envoyé, et Nolio t’invite dans l’équipe CTS le lundi de la semaine qui précède ton départ (dès ton paiement, s’il tombe dans les 7 jours) ; ta première séance tombe à la date donnée au récapitulatif, et tes séances s’écrivent ensuite chaque dimanche, jusqu’à ta course. Si ton plan n’a pas pu être construit, la page te le dit : écris-nous, nous te le livrons ou, si nous ne le pouvons pas, nous te remboursons intégralement.'),
      p('Tu disposes d’un délai de rétractation de 14 jours à compter de ton paiement, sans avoir à te justifier. Ton accès commence tout de suite parce que tu l’as demandé expressément, par la case prévue au récapitulatif ; l’e-mail de confirmation de ta commande le redit. Si tu te rétractes, tu nous dois la part du prix qui correspond aux jours de préparation déjà écoulés le jour où tu nous le dis, rapportés à sa durée jusqu’à la fin de ta récupération après ta course (article L221-25 du code de la consommation) ; avant ta première séance, rien. Nous te remboursons le reste sous 14 jours, par le moyen de paiement que tu as utilisé, sans frais. Les garanties légales de l’article ', art('garanties'), ' restent entières.'),
      p('Pour te rétracter, écris-nous ', ...CONTACT, ', en le disant clairement ; tu peux utiliser ce formulaire, qui est aussi dans l’e-mail de confirmation de ta commande :'),
      { type: 'formulaire' },
    ],
  },
  // J2 (audits du 05/11/2026, S3) : la préparation est fournie en continu, de ton paiement à la fin de ta récupération ;
  // l'encadré est le modèle de la fourniture continue (annexe à l'article D. 211-4 du code de la consommation, Légifrance
  // LEGIARTI000045981322), mot pour mot, « X » remplacé par cette période. À relire par Romain.
  {
    cle: 'garanties', titre: 'Garanties légales', blocs: [
      p(`${vendeur.nom} (${vendeur.nomCommercial}) répond des garanties légales ci-dessous. Ta préparation est fournie en continu, de ton paiement à la fin de ta récupération après ta course. Pour mettre ces garanties en œuvre, contacte-nous `, ...CONTACT, '.'),
      {
        type: 'encadre', paragraphes: [
          [`Le consommateur a droit à la mise en œuvre de la garantie légale de conformité en cas d’apparition d’un défaut de conformité durant un délai de ${PERIODE_FOURNITURE} à compter de la fourniture du contenu numérique ou du service numérique. Durant ce délai, le consommateur n’est tenu d’établir que l’existence du défaut de conformité et non la date d’apparition de celui-ci.`],
          [`La garantie légale de conformité emporte obligation de fournir toutes les mises à jour nécessaires au maintien de la conformité du contenu numérique ou du service numérique durant ${PERIODE_FOURNITURE}.`],
          ['La garantie légale de conformité donne au consommateur droit à la mise en conformité du contenu numérique ou du service numérique sans retard injustifié suivant sa demande, sans frais et sans inconvénient majeur pour lui.'],
          ['Le consommateur peut obtenir une réduction du prix en conservant le contenu numérique ou le service numérique, ou il peut mettre fin au contrat en se faisant rembourser intégralement contre renoncement au contenu numérique ou au service numérique, si :'],
          [
            '1° Le professionnel refuse de mettre le contenu numérique ou le service numérique en conformité ;', SAUT,
            '2° La mise en conformité du contenu numérique ou du service numérique est retardée de manière injustifiée ;', SAUT,
            '3° La mise en conformité du contenu numérique ou du service numérique ne peut intervenir sans frais imposés au consommateur ;', SAUT,
            '4° La mise en conformité du contenu numérique ou du service numérique occasionne un inconvénient majeur pour le consommateur ;', SAUT,
            '5° La non-conformité du contenu numérique ou du service numérique persiste en dépit de la tentative de mise en conformité du professionnel restée infructueuse.',
          ],
          ['Le consommateur a également droit à une réduction du prix ou à la résolution du contrat lorsque le défaut de conformité est si grave qu’il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n’est alors pas tenu de demander la mise en conformité du contenu numérique ou du service numérique au préalable.'],
          ['Dans les cas où le défaut de conformité est mineur, le consommateur n’a droit à l’annulation du contrat que si le contrat ne prévoit pas le paiement d’un prix.'],
          ['Toute période d’indisponibilité du contenu numérique ou du service numérique en vue de sa remise en conformité suspend la garantie qui restait à courir jusqu’à la fourniture du contenu numérique ou du service numérique de nouveau conforme.'],
          ['Ces droits résultent de l’application des articles L. 224-25-1 à L. 224-25-31 du code de la consommation.'],
          ['Le professionnel qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile d’un montant maximal de 300 000 euros, qui peut être porté jusqu’à 10 % du chiffre d’affaires moyen annuel (article L. 242-18-1 du code de la consommation).'],
          ['Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à 1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction de prix si le contenu numérique ou le service numérique est conservé, ou à un remboursement intégral contre renonciation au contenu numérique ou au service numérique.'],
        ],
      },
    ],
  },
  // A-42 (audits du 05/11/2026) : les droits appartiennent à une personne, pas à un nom commercial.
  {
    cle: 'propriete', titre: 'Propriété intellectuelle', blocs: [
      p(`Ton plan, ses textes, les fiches de la bibliothèque et l’app sont protégés par le droit d’auteur ; ils appartiennent à ${vendeur.nom}, qui les publie sous le nom commercial ${vendeur.nomCommercial}. Ils sont à ton usage personnel : tu peux les consulter, les imprimer et t’en servir pour t’entraîner, pas les revendre, les diffuser ni les publier.`),
    ],
  },
  {
    cle: 'donnees', titre: 'Données personnelles', blocs: [
      p('Ce que nous gardons, pourquoi, combien de temps, et tes droits : voir la ', CONFIDENTIALITE, '.'),
    ],
  },
  {
    cle: 'reclamations', titre: 'Réclamations et médiation', blocs: [
      p('Pour toute réclamation, contacte-nous ', ...CONTACT, '.'),
      p(`Si ta réclamation écrite n’a pas abouti, tu peux saisir gratuitement le médiateur de la consommation dont nous relevons, dans un délai d’un an à compter de cette réclamation : ${mediateur.nom}, ${mediateur.adresse}, `, { lien: mediateur.site, texte: 'www.cm2c.net', externe: true }, '.'),
    ],
  },
  // A-42 (audits du 05/11/2026) : le choix du consommateur entre les juridictions (article R631-3 du code de la
  // consommation), et la loi de son pays s'il réside ailleurs dans l'Union.
  {
    cle: 'droit', titre: 'Droit applicable', blocs: [
      p('Ces conditions sont soumises au droit français ; si tu résides dans un autre pays de l’Union européenne, tu gardes la protection que te donnent les règles impératives de ton pays. En cas de litige, tu peux saisir, à ton choix, l’une des juridictions territorialement compétentes selon le code de procédure civile, ou celle du lieu où tu demeurais au moment de la conclusion du contrat (article R631-3 du code de la consommation).'),
    ],
  },
];

// Le numéro de chaque article, de son rang : les titres et les renvois le prennent ici.
export const NUMEROS = Object.fromEntries(ARTICLES.map((a, i) => [a.cle, i + 1])) as Record<CleArticle, number>;
export const titreNumerote = (a: Article) => `${NUMEROS[a.cle]}. ${a.titre}`;

// Les lignes du formulaire de rétractation, dans l'ordre de l'encadré.
export const LIGNES_FORMULAIRE = [FORMULAIRE_RETRACTATION.titre, FORMULAIRE_RETRACTATION.consigne,
  FORMULAIRE_RETRACTATION.destinataire, ...FORMULAIRE_RETRACTATION.lignes];

// ─── Le texte entier dans la confirmation de commande (5B) ────────────────────────────────────────────────────────

export const TITRE_DANS_L_EMAIL = `Les conditions générales de vente (version du ${VERSION_CGV}) que tu as acceptées`;

const echapper = (texte: string) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function morceauEnTexte(m: Morceau): string {
  if (typeof m === 'string') return m;
  if ('saut' in m) return '\n';
  if ('article' in m) return String(NUMEROS[m.article]);
  return m.texte;
}
// Un lien du site devient une adresse entière dans l'e-mail (« /confidentialite » -> « https://www…/confidentialite »).
function morceauEnHtml(m: Morceau): string {
  if (typeof m === 'string') return echapper(m);
  if ('saut' in m) return '<br>';
  if ('article' in m) return String(NUMEROS[m.article]);
  const href = m.lien.startsWith('/') ? `${site.url}${m.lien}` : m.lien;
  return `<a href="${echapper(href)}" style="color:#0C6E5F">${echapper(m.texte)}</a>`;
}
const enTexte = (morceaux: Morceau[]) => morceaux.map(morceauEnTexte).join('');
const enHtml = (morceaux: Morceau[]) => morceaux.map(morceauEnHtml).join('');

// Le texte brut : le titre, puis chaque article, son titre numéroté et ses blocs, séparés d'une ligne vide ; une liste
// en tirets ; le formulaire, une ligne par ligne.
export function cgvEnTexte(): string {
  const blocEnTexte = (b: Bloc): string => {
    switch (b.type) {
      case 'p': return enTexte(b.morceaux);
      case 'liste': return b.elements.map((e) => `- ${enTexte(e)}`).join('\n');
      case 'prix': return PRIX_DANS_L_EMAIL;
      case 'formulaire': return LIGNES_FORMULAIRE.join('\n');
      case 'encadre': return b.paragraphes.map(enTexte).join('\n\n');
    }
  };
  return [TITRE_DANS_L_EMAIL, ...ARTICLES.map((a) => [titreNumerote(a), ...a.blocs.map(blocEnTexte)].join('\n\n'))].join('\n\n');
}

// Le HTML, en styles en ligne (les messageries ne lisent pas de feuille de style), plus petit que le corps de l'e-mail.
export function cgvEnHtml(): string {
  const para = (contenu: string, style = '') => `<p style="margin:0 0 8px${style}">${contenu}</p>`;
  const encadre = (contenu: string) => `<div style="margin:0 0 8px;padding:10px 12px;border:1px solid #D6DBD2">${contenu}</div>`;
  const blocEnHtml = (b: Bloc): string => {
    switch (b.type) {
      case 'p': return para(enHtml(b.morceaux));
      case 'liste': return `<ul style="margin:0 0 8px;padding-left:20px">${b.elements.map((e) => `<li style="margin:0 0 4px">${enHtml(e)}</li>`).join('')}</ul>`;
      case 'prix': return para(echapper(PRIX_DANS_L_EMAIL));
      case 'formulaire': return encadre(LIGNES_FORMULAIRE.map((l, i) => para(echapper(l), i === 0 ? ';font-weight:bold' : '')).join(''));
      case 'encadre': return encadre(b.paragraphes.map((x) => para(enHtml(x))).join(''));
    }
  };
  return `<div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #D6DBD2;font-size:13px;line-height:1.5;color:#2F2D4E">
${para(echapper(TITRE_DANS_L_EMAIL), ';font-size:15px;font-weight:bold')}
${ARTICLES.map((a) => `${para(echapper(titreNumerote(a)), ';margin-top:16px;font-weight:bold')}\n${a.blocs.map(blocEnHtml).join('\n')}`).join('\n')}
</div>`;
}
