import type { Metadata } from 'next';
import { Liste, PageLegale, Section } from '@/components/PageLegale';
import { plansVisibles, vendeur, VERSION_CONFIDENTIALITE } from '@/lib/legal';

// La politique de confidentialité (RGPD ; CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L5 ; écrite le 15/10/2026
// d'après l'inventaire de ce que le site, l'app et l'API gardent réellement, après la correction des écarts E1 à E7 ;
// relue par le coach). Elle ne dit que ce que le code fait : un changement de ce que l'app garde la change aussi. Ce
// qu'elle dit des plans (construction, achat, app) n'apparaît que derrière la porte des plans, jusqu'au lancement
// (décision coach du 15/10/2026 ; lib/legal.ts, plansVisibles) ; ailleurs, le site, le contact et le coaching.
export const metadata: Metadata = {
  title: 'Politique de confidentialité — CTS Coaching',
  description: 'Les données que CTS Coaching garde, pourquoi, combien de temps, et tes droits.',
};

// Lit la porte des plans (cookie, session) : calculée à chaque visite.
export const dynamic = 'force-dynamic';

export default async function Confidentialite() {
  const plans = await plansVisibles();
  // Les sections numérotées dans l'ordre où elles s'affichent.
  let n = 0;
  const no = (titre: string) => `${++n}. ${titre}`;
  return (
    <PageLegale titre="Politique de confidentialité" version={VERSION_CONFIDENTIALITE} plans={plans}>
      <Section titre="En bref">
        <Liste>
          <li>Nous ne gardons que ce qui sert à tes séances ou à ton suivi, et chaque donnée a une durée.</li>
          <li>Nous ne vendons rien, ne faisons pas de publicité et ne posons aucun traceur publicitaire.</li>
          <li>Aucune de tes données n’est analysée par une intelligence artificielle, ni utilisée pour en entraîner une.</li>
          <li>Tes données de compte sont hébergées dans l’Union européenne.</li>
        </Liste>
      </Section>

      <Section titre={no('Qui est responsable')}>
        <p>
          {vendeur.nom}, {vendeur.forme}, {vendeur.nomCommercial}, {vendeur.adresse}. Pour toute question sur tes
          données : <a href={`mailto:${vendeur.email}`}>{vendeur.email}</a> ou {vendeur.telephone}.
        </p>
      </Section>

      <Section titre={no('Quand tu visites le site')}>
        <Liste>
          <li>
            <strong>Mesure d’audience.</strong> Nous comptons les pages vues avec Vercel Web Analytics, sans cookie et
            sans identifier les visiteurs (intérêt légitime : savoir quelles pages sont lues).
          </li>
          {plans && (
            <li>
              <strong>Parcours d’achat.</strong> Nous comptons chaque jour combien de questionnaires sont commencés, de
              récapitulatifs atteints et de paiements lancés : des nombres, sans cookie ni identifiant.
            </li>
          )}
          <li>
            <strong>Fiches et calculateurs.</strong> Ce que tu saisis dans les calculateurs (fréquence cardiaque, allures,
            poids) reste dans ton navigateur : rien n’est envoyé ni enregistré. Une exception, à ta demande : dans l’app,
            « Garder ma stratégie » range ta stratégie de course avec ta course (tes réponses au calculateur de nutrition,
            ton poids compris, et ses quatre repères), pour l’afficher dans ta fiche de course. Tu l’effaces quand tu veux
            (« Effacer ma stratégie ») ; elle part avec ta course ou ton compte.
          </li>
          <li>
            <strong>Formulaire de contact.</strong> Ton prénom, ton e-mail, ta ville, ton objectif et ton message nous
            parviennent par Formspree dans notre messagerie (Gmail), pour te répondre. Nous les gardons 3 ans après notre
            dernier échange.
          </li>
        </Liste>
      </Section>

      {plans && (
        <>
        <Section titre={no('Quand tu construis ton plan')}>
          <Liste>
            <li>
              <strong>Tes réponses en cours.</strong> Tant que tu n’as pas payé, tes réponses au questionnaire restent dans
              ton navigateur, pour que tu puisses reprendre plus tard ; elles sont effacées au paiement. Tu peux aussi les
              effacer en supprimant les données du site dans ton navigateur.
            </li>
            <li>
              <strong>La question sur une blessure</strong> ne quitte jamais ton appareil : elle sert seulement à t’afficher
              un conseil.
            </li>
            <li>
              <strong>Le rappel.</strong> Si tu coches « Envoie-moi un rappel », nous gardons ton e-mail et la date de ton
              accord, pour un seul e-mail le lendemain. Ils sont effacés à ton achat, si tu décoches la case, et au plus
              tard 30 jours après (ton consentement).
            </li>
            <li>
              <strong>Quand tu passes au paiement.</strong> Ton nom, ton e-mail, ta course, ton niveau, ton volume et ta plus longue sortie
              actuels, un arrêt récent de la course à pied, ton terrain, tes jours disponibles et ta trace GPX partent vers
              notre moteur, qui construit ton plan. Ce dossier est effacé 30 jours après, que tu aies payé ou non (le contrat).
            </li>
          </Liste>
        </Section>

        <Section titre={no('Ton achat et ton compte')}>
          <Liste>
            <li>
              <strong>Ton compte</strong> : ton e-mail, ton nom, ton plan (ses données), les réponses qui ont
              servi à le construire, les dates de création et de connexion. Nous le gardons tant qu’il existe : tu peux le
              supprimer à tout moment dans l’app (Compte, puis « Supprimer mon compte ») ; s’il reste 3 ans sans activité,
              il est supprimé, après un e-mail d’avertissement 30 jours avant (le contrat).
            </li>
            <li>
              <strong>Ton achat</strong> : la date, le montant payé et la référence du paiement, gardés 10 ans pour notre
              comptabilité (obligation légale). Si tu supprimes ton compte, l’achat reste, sans lien avec lui.
            </li>
            <li>
              <strong>Le paiement</strong> se fait chez Stripe, qui reçoit ta carte, ton e-mail et le montant, et garde avec
              le paiement la date à laquelle tu as accepté les conditions de vente et demandé que ta préparation commence
              tout de suite.
              Nous ne voyons jamais tes numéros de carte.
            </li>
            <li>
              <strong>Les e-mails</strong> (bienvenue, codes de connexion, rappel si tu l’as demandé, avertissement avant suppression)
              partent par Brevo.
            </li>
          </Liste>
        </Section>

        <Section titre={no('Dans l’app : tes zones et ton journal')}>
          <p>
            Ces données touchent à ta condition physique : nous ne les gardons qu’avec ton accord exprès, donné par une case
            à cocher la première fois (ton consentement explicite).
          </p>
          <Liste>
            <li>
              <strong>Tes zones</strong> : ta fréquence cardiaque aux seuils, ta vitesse critique, tes allures. Elles servent
              seulement à régler tes séances. Tu les effaces quand tu veux (« Effacer mes valeurs »).
            </li>
            <li>
              <strong>Ton journal</strong> : séance faite ou non, effort ressenti (RPE), sensations. Il sert seulement à
              suivre et à ajuster ton plan. Tu l’effaces quand tu veux, en tout ou séance par séance.
            </li>
          </Liste>
          <p>
            Elles ne sont montrées à personne d’autre que toi et partent avec ton compte. Nous ne gardons ni ta réponse sur
            une blessure ni tes douleurs : le lien « J’ai une douleur » n’enregistre rien.
          </p>
        </Section>
        </>
      )}

      <Section titre={no('Si tu es coaché par CTS sur Nolio')}>
        <p>Avec ton accord, donné par écrit dans la messagerie Nolio et que tu peux retirer à tout moment :</p>
        <Liste>
          <li>
            l’espace de ton coach garde ton profil de coureur (tes réponses au questionnaire), tes repères
            d’entraînement (fréquence cardiaque aux seuils, vitesse critique, allures) avec la date et l’origine de chaque
            test, tes objectifs, tes courses de préparation et leur fiche de course, et ta préparation, pour écrire tes
            séances dans ton calendrier Nolio ;
          </li>
          <li>
            le tableau de suivi de ton coach lit dans Nolio tes séances prévues et réalisées, avec ton effort ressenti,
            tes sensations, tes commentaires et ton questionnaire Hooper, au moment où il l’ouvre, sans en garder de
            copie ;
          </li>
          <li>ton espace CTS t’affiche ta semaine telle qu’elle est dans Nolio, lue au moment où tu l’ouvres, sans en garder de copie ;</li>
          <li>
            pour tes badges, nous lisons toutes tes séances de course et de trail réalisées dans Nolio (date, distance, durée,
            dénivelé) et ne gardons que tes badges débloqués, avec leur date, et tes totaux de kilomètres et de dénivelé par
            mois ;
          </li>
          <li>
            chaque dimanche, sauf si ton coach les écrit lui-même, tes séances de la semaine suivante s’écrivent d’après ta
            semaine écoulée, avec les mêmes lectures ; nous gardons un résumé chiffré de chaque semaine (charge, séances
            faites, plus longue sortie, dénivelé, Hooper), celles que ton coach écrit à la main comprises, lues chaque nuit
            dans Nolio, pour ajuster tes séances et afficher tes graphiques dans ton espace CTS ;
          </li>
          <li>
            si ton coach t’ouvre un espace dans l’app, nous gardons ton adresse e-mail, pour ta connexion par un code
            envoyé par e-mail ; un objectif que tu y demandes (ton questionnaire, et la trace GPX si tu en joins une)
            arrive dans l’espace de ton coach ;
          </li>
          <li>nous gardons ton nom, ton identifiant Nolio et la date de ton accord.</li>
        </Liste>
        <p>
          Retirer ton accord efface tes repères, ces résumés et tes badges, et arrête la lecture. Personne d’autre que ton coach et toi
          ne voit ces données.
          Les séances écrites dans ton calendrier restent dans Nolio, qui applique sa propre politique de
          confidentialité. Ta fiche de course est une page à lien privé, que seuls ceux qui ont le lien peuvent ouvrir.
        </p>
      </Section>

      <Section titre={no('Qui y a accès')}>
        <p>
          Juliette et Romain, et nos prestataires techniques, chacun pour ce qui le concerne et seulement pour nous rendre
          ce service :
        </p>
        <Liste>
          <li>Vercel : hébergement du site et de l’app (États-Unis) ;</li>
          <li>Supabase : comptes et fichiers (serveurs en Irlande) ;</li>
          <li>Render : le moteur qui construit les séances (serveurs en Allemagne) ;</li>
          {plans && <li>Stripe : le paiement (Irlande) ;</li>}
          <li>Brevo : l’envoi des e-mails (France) ;</li>
          <li>Formspree : le formulaire de contact (États-Unis) ;</li>
          <li>Google : notre messagerie Gmail (États-Unis) ;</li>
          <li>Nolio : la plateforme d’entraînement des athlètes coachés (France).</li>
        </Liste>
        <p>
          Vercel, Supabase, Render, Formspree et Google sont des sociétés américaines. Quand des données peuvent être
          consultées depuis les États-Unis, ce transfert est encadré par le cadre de protection des données entre l’Union
          européenne et les États-Unis (Data Privacy Framework) pour les sociétés qui y adhèrent, ou par les clauses
          contractuelles types de la Commission européenne. Nous ne vendons ni ne louons aucune donnée.
        </p>
      </Section>

      <Section titre={no('Cookies et stockage dans ton navigateur')}>
        {plans ? (
          <>
            <p>
              Seulement ce qui fait fonctionner le site et l’app, sans traceur publicitaire ni mesure qui te suive : c’est
              pourquoi aucun bandeau ne te demande ton accord.
            </p>
            <Liste>
              <li>la session de connexion à l’app (Supabase) ;</li>
              <li>« cts_invitation » : ton lien d’invitation, quand la vente se fait sur invitation (90 jours) ;</li>
              <li>« cts_plan » : le plan affiché quand tu en as plusieurs (400 jours) ;</li>
              <li>« cts_bienvenue » : l’écran de bienvenue déjà vu (400 jours) ;</li>
              <li>« cts_hier_ignore » : une question sur la séance de la veille, mise de côté (3 jours) ;</li>
              <li>tes réponses en cours au questionnaire, jusqu’au paiement (stockage local) ;</li>
              <li>les pages de l’app gardées pour s’ouvrir sans connexion, effacées à la déconnexion.</li>
            </Liste>
          </>
        ) : (
          <p>
            Le site ne pose ni cookie ni traceur publicitaire : c’est pourquoi aucun bandeau ne te demande ton accord.
          </p>
        )}
      </Section>

      <Section titre={no('Tes droits')}>
        <p>
          Tu peux demander à accéder à tes données, les corriger, les effacer, en limiter l’usage, t’y opposer, les
          recevoir dans un format lisible pour les emporter ailleurs, retirer à tout moment un consentement donné, et
          dire ce qu’elles deviennent après ton décès. Écris-nous à <a href={`mailto:${vendeur.email}`}>{vendeur.email}</a>{' '}
          ou au {vendeur.adresse} : nous répondons sous un mois.
          {plans && ' Beaucoup se font directement dans l’app : effacer tes zones, ton journal ou ton compte.'}
        </p>
        <p>
          Si tu penses que tes droits ne sont pas respectés, tu peux saisir la CNIL, 3 place de Fontenoy, TSA 80715, 75334
          Paris Cedex 07,{' '}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
            www.cnil.fr
          </a>
          .
        </p>
      </Section>

      <Section titre={no('Sécurité')}>
        <p>
          Les échanges avec le site et l’app sont chiffrés.
          {plans && ' La connexion se fait par un code à 6 chiffres envoyé par e-mail, sans mot de passe à retenir ni à voler.'}{' '}
          L’accès aux outils d’administration est réservé à CTS Coaching.
        </p>
      </Section>

      <Section titre={no('Changements')}>
        <p>
          Cette politique suit ce que le site et l’app font réellement : quand ils changent, elle change aussi, et la date
          de version en tête de page avec elle. Pour un changement important, nous te prévenons par e-mail.
        </p>
      </Section>
    </PageLegale>
  );
}
