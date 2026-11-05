import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Liste, PageLegale, Section } from '@/components/PageLegale';
import { FORMULAIRE_RETRACTATION, mediateur, plansVisibles, vendeur, VERSION_CGV } from '@/lib/legal';
import { API_URL } from '@/lib/plan';
import { enTetesMoteur } from '@/lib/app/cleMoteur';

// TEXTE CORRIGÉ LE 05/11/2026 d'après les audits A et B de la Préparation CTS (S3, « A » : corrigé sans juriste, relu par
// Romain) : la garantie de fourniture continue (J2), l'accès dès le paiement et ce qu'on achète (J3), Nolio, une course
// qui change et « personne ne relit » (J4), la préparation qui évolue (J6), le code promotionnel (J10), et les mineurs
// (majorité, langue et archivage, propriété, juridiction). La date de version passe au jour de la mise en ligne.
// Les conditions générales de vente des plans (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L5, écrites le
// 15/10/2026 à partir de ce que le site et l'app font réellement ; relues par le coach). La case du récapitulatif les
// fait accepter (components/plan/Questionnaire.tsx) ; l'API en garde la date chez Stripe (E4). Les prix viennent de
// l'API, comme sur la page des plans. Fermées comme elle jusqu'au lancement (lib/legal.ts, plansVisibles).
export const metadata: Metadata = {
  title: 'Conditions générales de vente — CTS Coaching',
  description: 'Les conditions de vente des plans d’entraînement trail CTS Coaching.',
};

export const dynamic = 'force-dynamic';

// Le « X » du modèle de la fourniture continue (J2) : la période contractuelle de fourniture.
const PERIODE_FOURNITURE = 'la durée de la préparation (du paiement à la fin de la récupération qui suit la course)';

async function prixParMois(): Promise<Record<string, number> | null> {
  try {
    const r = await fetch(`${API_URL}/v1/config`, { next: { revalidate: 3600 }, headers: enTetesMoteur() });
    return r.ok ? (await r.json()).prix_eur_par_mois ?? null : null;
  } catch {
    return null;
  }
}

export default async function CGV() {
  if (!(await plansVisibles())) notFound();
  const prix = await prixParMois();
  const contact = (
    <>
      par e-mail à <a href={`mailto:${vendeur.email}`}>{vendeur.email}</a>, par téléphone au{' '}
      <a href={`tel:${vendeur.telephoneLien}`}>{vendeur.telephone}</a> ou par courrier au {vendeur.adresse}
    </>
  );
  // Les articles, numérotés dans l'ordre où ils s'affichent (les renvois suivent).
  const A = { nolio: 4, course: 5, evolue: 6, sante: 7, prix: 8, commande: 9, paiement: 10, retractation: 11, garanties: 12 };
  return (
    <PageLegale titre="Conditions générales de vente" version={VERSION_CGV} plans>
      <Section titre="1. Qui vend">
        <p>
          Les plans d’entraînement vendus sur www.cts-coaching.com le sont par {vendeur.nom}, {vendeur.forme}, sous le
          nom commercial {vendeur.nomCommercial}, {vendeur.adresse}, SIRET {vendeur.siret}. Pour nous joindre : {contact}.
        </p>
      </Section>

      <Section titre="2. Ce que couvrent ces conditions">
        <p>
          Elles s’appliquent à l’achat d’un plan d’entraînement en ligne (« le plan ») par un particulier (« tu »). Le
          coaching individualisé, suivi par Juliette ou Romain, fait l’objet d’un accord séparé : ces conditions ne le
          couvrent pas.
        </p>
        <p>
          En cochant la case prévue au récapitulatif, avant le paiement, tu acceptes ces conditions dans leur version en
          vigueur le jour de ta commande. Le service s’adresse aux personnes majeures : en cochant cette case, tu confirmes
          être majeur, ou avoir l’accord de ton représentant légal.
        </p>
      </Section>

      <Section titre="3. Le plan">
        {/* Le parcours Nolio (décisions coach des 18-19/10/2026, P1 à P4, T1 à T11, O1 à O3) ; partie acheteurs validée par
            le coach le 04/11/2026 au soir, avec l'invitation le lundi de la semaine qui précède le départ et la
            confirmation de charge avant un départ éloigné (lib/app/invitation.ts). Corrigée le 05/11/2026 (S3, J4) :
            « personne ne relit » n'était pas vrai, le coach voit l'équipe Nolio. */}
        <p>
          Une préparation de trail, construite automatiquement par la méthode CTS à partir de tes réponses au
          questionnaire : ta course (date, distance, dénivelé, trace GPX si tu en as une), ton niveau, ce que tu cours en
          ce moment, ton terrain d’entraînement et tes jours disponibles, puis ajustée chaque semaine par des règles
          automatiques. Elle est construite et ajustée sans échange avec un coach : aucun coach ne suit ta préparation au
          jour le jour ni ne répond à tes commentaires dans Nolio. Juliette et Romain, les coachs de l’équipe CTS dans
          Nolio, y voient tes séances comme celles de tout athlète de l’équipe, et peuvent y corriger une séance ; pour une
          question, écris-nous.
        </p>
        <p>Elle comprend :</p>
        <Liste>
          <li>
            ta trame jusqu’à ta course, sur la durée choisie (3, 4 ou 6 mois), dans l’app (« Mon plan ») : pour chaque
            semaine, son type, son volume et ses séances clés, les week-ends choc annoncés d’avance ;
          </li>
          <li>
            une invitation dans l’équipe CTS sur Nolio, la plateforme d’entraînement que nous utilisons (un compte
            d’athlète gratuit, créé à ton adresse si tu n’en as pas), envoyée le lundi de la semaine qui précède ton
            départ, ou dès ton paiement si ta préparation commence dans les 7 jours : tes séances détaillées y sont écrites
            chaque dimanche pour la semaine suivante, d’après ta semaine écoulée, tes réponses au questionnaire du samedi et,
            si tu l’acceptes, ton effort ressenti et ton Hooper ; après ta course, ta récupération y est écrite aussi,
            puis tu quittes l’équipe, ton compte Nolio et tes séances restent à toi ;
          </li>
          <li>
            l’accès à l’app CTS, ton tableau de bord : ta course, ta trame, ta jauge de préparation et tes graphiques, ta
            fiche de course et la bibliothèque de fiches ; si ton achat date de plus de 3 semaines au moment de ton
            invitation, l’app te demande alors si ce que tu cours a changé, et ta première semaine s’écrit sur ta réponse.
          </li>
        </Liste>
        <p>
          Elle ne comprend ni suivi ni échange avec un coach, ne convient pas à une blessure en cours, et ne remplace pas
          un avis médical (article {A.sante}). Nolio s’utilise dans son application et sur son site, selon ses propres
          conditions ; l’envoi des séances sur une montre dépend de Nolio et de ta montre.
        </p>
        <p>
          L’app s’ouvre dans un navigateur récent, sur téléphone ou sur ordinateur, et peut s’ajouter à l’écran d’accueil
          du téléphone. Il faut une connexion internet pour s’y connecter : la connexion se fait par un code à 6 chiffres
          envoyé par e-mail, sans mot de passe.
        </p>
        <p>
          Ton plan reste accessible dans l’app au moins jusqu’à la fin de ta récupération après ta course, et tant que ton compte existe. Un
          compte resté 3 ans sans activité est supprimé, après un e-mail d’avertissement 30 jours avant (voir la{' '}
          <a href="/confidentialite">politique de confidentialité</a>).
        </p>
        <p>
          Les durées proposées dépendent de ta course et de ton niveau. Avant tout paiement, le questionnaire te dit si la
          préparation demandée ne lui paraît pas possible, et pourquoi.
        </p>
      </Section>

      {/* J4 (audits du 05/11/2026, S3) : ce qui se passe sans Nolio, de ton fait ou du nôtre. À relire par Romain. */}
      <Section titre={`${A.nolio}. Nolio`}>
        <p>
          Tes séances détaillées s’écrivent dans Nolio : il te faut un compte Nolio (gratuit), que l’invitation crée si tu
          n’en as pas.
        </p>
        <Liste>
          <li>
            Si tu ne rejoins pas l’équipe CTS (une invitation refusée ou jamais acceptée), si tu la quittes ou si tu coupes
            l’accès de Nolio à ton compte, tes séances ne peuvent plus t’arriver : ta trame reste dans l’app, et ton achat
            n’est pas remboursé en dehors de ton droit de rétractation (article {A.retractation}). Écris-nous : nous
            t’envoyons une nouvelle invitation.
          </li>
          <li>
            Si Nolio est en panne, tes séances s’écrivent dès qu’il répond de nouveau. Si Nolio ne nous permet plus de les
            écrire et que nous ne pouvons pas te les fournir autrement, nous te remboursons la part du prix des semaines
            qui restent jusqu’à ta course.
          </li>
        </Liste>
      </Section>

      {/* J4 (audits du 05/11/2026, S3) : une course reportée ou annulée (PL6 du 04/11/2026 : la date ne change qu'avant le
          départ). À relire par Romain. */}
      <Section titre={`${A.course}. Ta course change`}>
        <Liste>
          <li>
            Avant ton départ (ta première semaine dans Nolio), ta course change de date : écris-nous, nous déplaçons ta
            préparation sur la nouvelle date, sans frais.
          </li>
          <li>Ta course est annulée avant ton départ : nous te remboursons intégralement.</li>
          <li>
            Après ton départ, ta préparation continue jusqu’à la date prévue : un report ou une annulation de ta course ne
            donne pas de remboursement en dehors de ton droit de rétractation (article {A.retractation}) ; écris-nous, nous
            voyons avec toi la meilleure suite.
          </li>
        </Liste>
      </Section>

      {/* J6 (audits du 05/11/2026, S3) : le moteur refait les plans en cours avec ses améliorations, chaque nuit qui suit
          une mise à jour ; la clause qui le prévoit (une modification d'un service fourni en continu). À relire par Romain. */}
      <Section titre={`${A.evolue}. Ta préparation évolue`}>
        <p>
          La méthode CTS s’améliore au fil des semaines : ses améliorations s’appliquent à tes semaines suivantes, sans
          frais, jamais à celles déjà écrites dans ton Nolio. Elles ne changent ni ta course, ni ta formule, ni ton prix.
          Si l’une te gêne, écris-nous : nous voyons avec toi. Une modification qui pourrait gêner ta préparation t’est
          annoncée à l’avance par e-mail, avec sa date ; si elle la gêne autrement que de façon mineure, tu peux mettre
          fin au contrat, sans frais, dans les 30 jours qui suivent son annonce ou, si c’est plus tard, son application,
          et nous te remboursons la part du prix des semaines qui restent jusqu’à ta course (article L. 224-25-26 du code
          de la consommation).
        </p>
      </Section>

      <Section titre={`${A.sante}. Ta santé`}>
        <p>
          Le plan ne remplace pas un avis médical. Avant de commencer, lis l’avertissement affiché au récapitulatif et en
          tête de ton plan : si tu as un doute de santé, une douleur, une blessure en cours ou un antécédent qui pourrait
          interagir avec l’entraînement, consulte un professionnel de santé. En cours de préparation, adapte ou interromps
          une séance en cas de douleur inhabituelle, de fatigue excessive ou de tout signe qui te semble anormal : le plan
          ne peut pas remplacer ton propre jugement sur ce que ton corps te dit.
        </p>
      </Section>

      <Section titre={`${A.prix}. Prix`}>
        {prix ? (
          <Liste>
            {Object.entries(prix)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([mois, eur]) => (
                <li key={mois}>
                  Plan de {mois} mois : {eur} €
                </li>
              ))}
          </Liste>
        ) : (
          <p>Le prix de chaque durée est affiché sur la page des plans.</p>
        )}
        <p>
          TVA non applicable, article 293 B du code général des impôts. Aucun autre frais ne s’ajoute. Le prix à payer est
          affiché au récapitulatif, puis sur la page de paiement, avant que tu ne payes.
        </p>
        {/* J10 (audits du 05/11/2026, S3) : un code est une remise sur le prix affiché, jamais un prix de référence barré. */}
        <p>
          Un code promotionnel, quand il y en a un, se saisit sur la page de paiement : il donne une remise sur le prix
          affiché ci-dessus, qui reste le prix de la formule, dans les conditions et jusqu’à la date annoncées avec lui.
          C’est un achat unique : pas d’abonnement, rien ne se renouvelle.
        </p>
      </Section>

      <Section titre={`${A.commande}. Commande`}>
        <Liste>
          <li>Tu réponds au questionnaire.</li>
          <li>
            Au récapitulatif, tu relis tes réponses et peux les corriger, tu lis l’avertissement santé et ce que tu achètes,
            puis tu coches la case qui accepte ces conditions et celle qui demande que ton accès commence dès ton paiement
            (article {A.retractation}).
          </li>
          <li>Tu payes sur la page de paiement sécurisée de notre prestataire Stripe.</li>
        </Liste>
        <p>
          Le contrat est conclu quand ton paiement est confirmé. Tu reçois alors par e-mail la confirmation de ta commande :
          ta formule et ses dates, le prix payé, le vendeur, le lien vers ces conditions avec leur version, et le formulaire
          de rétractation. Garde-la : c’est ton exemplaire du contrat.
        </p>
        {/* A-42 (audits du 05/11/2026) : la langue et l'archivage du contrat (article 1127-1 du code civil). */}
        <p>
          Le contrat est conclu en français. Nous gardons la version de ces conditions que tu as acceptée, avec la date de
          ton acceptation, et te l’envoyons sur simple demande.
        </p>
      </Section>

      <Section titre={`${A.paiement}. Paiement`}>
        <p>
          Par carte bancaire (Apple Pay et Google Pay compris), sur la page de paiement de Stripe (Stripe Payments Europe,
          Ltd.). Nous ne voyons ni ne gardons tes numéros de carte. Le prix est débité en une fois, au moment de la
          commande ; il apparaît sur ton relevé sous le libellé « CTS COACHING ».
        </p>
      </Section>

      {/* Décision coach du 19/10/2026 : avec Nolio, la préparation s'exécute semaine après semaine jusqu'à la course ;
          c'est un service, rétractable 14 jours, payé au prorata de ce qui a été fourni (art. L221-25). J3 (audits du
          05/11/2026, S3) : la demande porte sur l'accès, qui commence au paiement ; la première séance a sa date. */}
      <Section titre={`${A.retractation}. Début de ta préparation et droit de rétractation`}>
        <p>
          Ton accès commence dès ton paiement confirmé : ton plan s’affiche dans l’app, ton compte est créé, l’e-mail de
          bienvenue t’est envoyé, et Nolio t’invite dans l’équipe CTS le lundi de la semaine qui précède ton départ (dès
          ton paiement, s’il tombe dans les 7 jours) ; ta première séance tombe à la date donnée au récapitulatif, et tes
          séances s’écrivent ensuite chaque dimanche, jusqu’à ta course. Si ton plan n’a pas pu être construit, la page te
          le dit : écris-nous, nous te le livrons ou, si nous ne le pouvons pas, nous te remboursons intégralement.
        </p>
        <p>
          Tu disposes d’un délai de rétractation de 14 jours à compter de ton paiement, sans avoir à te justifier. Ton
          accès commence tout de suite parce que tu l’as demandé expressément, par la case prévue au récapitulatif ;
          l’e-mail de confirmation de ta commande le redit. Si tu te rétractes, tu nous dois la part du prix qui correspond
          aux jours de préparation déjà écoulés le jour où tu nous le dis, rapportés à sa durée jusqu’à la fin de ta
          récupération après ta course (article L221-25 du code de la consommation) ; avant ta première séance, rien. Nous
          te remboursons le reste sous 14 jours, par le moyen de paiement que tu as utilisé, sans frais. Les garanties
          légales de l’article {A.garanties} restent entières.
        </p>
        <p>
          Pour te rétracter, écris-nous {contact}, en le disant clairement ; tu peux utiliser ce formulaire, qui est aussi
          dans l’e-mail de confirmation de ta commande :
        </p>
        <div className="border border-indigo/20 p-4 text-sm space-y-2">
          <p className="font-semibold">{FORMULAIRE_RETRACTATION.titre}</p>
          <p>{FORMULAIRE_RETRACTATION.consigne}</p>
          <p>{FORMULAIRE_RETRACTATION.destinataire}</p>
          {FORMULAIRE_RETRACTATION.lignes.map((l) => <p key={l}>{l}</p>)}
        </div>
      </Section>

      {/* J2 (audits du 05/11/2026, S3) : la préparation est fournie en continu, de ton paiement à la fin de ta
          récupération ; l'encadré est le modèle de la fourniture continue (annexe à l'article D. 211-4 du code de la
          consommation, Légifrance LEGIARTI000045981322), mot pour mot, « X » remplacé par cette période. À relire par
          Romain. */}
      <Section titre={`${A.garanties}. Garanties légales`}>
        <p>
          {vendeur.nom} ({vendeur.nomCommercial}) répond des garanties légales ci-dessous. Ta préparation est fournie en
          continu, de ton paiement à la fin de ta récupération après ta course. Pour mettre ces garanties en œuvre,
          contacte-nous {contact}.
        </p>
        <div className="border-2 border-indigo/20 bg-white p-5 space-y-3 text-sm">
          <p>
            Le consommateur a droit à la mise en œuvre de la garantie légale de conformité en cas d’apparition d’un défaut
            de conformité durant un délai de {PERIODE_FOURNITURE} à compter de la fourniture du contenu numérique ou du
            service numérique. Durant ce délai, le consommateur n’est tenu d’établir que l’existence du défaut de conformité
            et non la date d’apparition de celui-ci.
          </p>
          <p>
            La garantie légale de conformité emporte obligation de fournir toutes les mises à jour nécessaires au maintien
            de la conformité du contenu numérique ou du service numérique durant {PERIODE_FOURNITURE}.
          </p>
          <p>
            La garantie légale de conformité donne au consommateur droit à la mise en conformité du contenu numérique ou du
            service numérique sans retard injustifié suivant sa demande, sans frais et sans inconvénient majeur pour lui.
          </p>
          <p>
            Le consommateur peut obtenir une réduction du prix en conservant le contenu numérique ou le service numérique,
            ou il peut mettre fin au contrat en se faisant rembourser intégralement contre renoncement au contenu numérique
            ou au service numérique, si :
          </p>
          <p>
            1° Le professionnel refuse de mettre le contenu numérique ou le service numérique en conformité ;<br />
            2° La mise en conformité du contenu numérique ou du service numérique est retardée de manière injustifiée ;
            <br />
            3° La mise en conformité du contenu numérique ou du service numérique ne peut intervenir sans frais imposés au
            consommateur ;<br />
            4° La mise en conformité du contenu numérique ou du service numérique occasionne un inconvénient majeur pour le
            consommateur ;<br />
            5° La non-conformité du contenu numérique ou du service numérique persiste en dépit de la tentative de mise en
            conformité du professionnel restée infructueuse.
          </p>
          <p>
            Le consommateur a également droit à une réduction du prix ou à la résolution du contrat lorsque le défaut de
            conformité est si grave qu’il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le
            consommateur n’est alors pas tenu de demander la mise en conformité du contenu numérique ou du service
            numérique au préalable.
          </p>
          <p>
            Dans les cas où le défaut de conformité est mineur, le consommateur n’a droit à l’annulation du contrat que si
            le contrat ne prévoit pas le paiement d’un prix.
          </p>
          <p>
            Toute période d’indisponibilité du contenu numérique ou du service numérique en vue de sa remise en conformité
            suspend la garantie qui restait à courir jusqu’à la fourniture du contenu numérique ou du service numérique de
            nouveau conforme.
          </p>
          <p>Ces droits résultent de l’application des articles L. 224-25-1 à L. 224-25-31 du code de la consommation.</p>
          <p>
            Le professionnel qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité
            encourt une amende civile d’un montant maximal de 300 000 euros, qui peut être porté jusqu’à 10 % du chiffre
            d’affaires moyen annuel (article L. 242-18-1 du code de la consommation).
          </p>
          <p>
            Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à
            1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne
            droit à une réduction de prix si le contenu numérique ou le service numérique est conservé, ou à un
            remboursement intégral contre renonciation au contenu numérique ou au service numérique.
          </p>
        </div>
      </Section>

      {/* A-42 (audits du 05/11/2026) : les droits appartiennent à une personne, pas à un nom commercial. */}
      <Section titre="13. Propriété intellectuelle">
        <p>
          Ton plan, ses textes, les fiches de la bibliothèque et l’app sont protégés par le droit d’auteur ; ils
          appartiennent à {vendeur.nom}, qui les publie sous le nom commercial {vendeur.nomCommercial}. Ils sont à ton usage
          personnel : tu peux les consulter, les imprimer et t’en servir pour t’entraîner, pas les revendre, les diffuser
          ni les publier.
        </p>
      </Section>

      <Section titre="14. Données personnelles">
        <p>
          Ce que nous gardons, pourquoi, combien de temps, et tes droits : voir la{' '}
          <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </Section>

      <Section titre="15. Réclamations et médiation">
        <p>Pour toute réclamation, contacte-nous {contact}.</p>
        <p>
          Si ta réclamation écrite n’a pas abouti, tu peux saisir gratuitement le médiateur de la consommation dont nous
          relevons, dans un délai d’un an à compter de cette réclamation : {mediateur.nom}, {mediateur.adresse},{' '}
          <a href={mediateur.site} target="_blank" rel="noopener noreferrer">
            www.cm2c.net
          </a>
          .
        </p>
      </Section>

      {/* A-42 (audits du 05/11/2026) : le choix du consommateur entre les juridictions (article R631-3 du code de la
          consommation), et la loi de son pays s'il réside ailleurs dans l'Union. */}
      <Section titre="16. Droit applicable">
        <p>
          Ces conditions sont soumises au droit français ; si tu résides dans un autre pays de l’Union européenne, tu
          gardes la protection que te donnent les règles impératives de ton pays. En cas de litige, tu peux saisir, à ton
          choix, l’une des juridictions territorialement compétentes selon le code de procédure civile, ou celle du lieu où
          tu demeurais au moment de la conclusion du contrat (article R631-3 du code de la consommation).
        </p>
      </Section>
    </PageLegale>
  );
}
