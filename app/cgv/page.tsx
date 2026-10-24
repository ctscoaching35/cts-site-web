import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Liste, PageLegale, Section } from '@/components/PageLegale';
import { mediateur, plansVisibles, vendeur, VERSION_CGV } from '@/lib/legal';
import { API_URL } from '@/lib/plan';

// Les conditions générales de vente des plans (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L5, écrites le
// 15/10/2026 à partir de ce que le site et l'app font réellement ; relues par le coach). La case du récapitulatif les
// fait accepter (components/plan/Questionnaire.tsx) ; l'API en garde la date chez Stripe (E4). Les prix viennent de
// l'API, comme sur la page des plans. Fermées comme elle jusqu'au lancement (lib/legal.ts, plansVisibles).
export const metadata: Metadata = {
  title: 'Conditions générales de vente — CTS Coaching',
  description: 'Les conditions de vente des plans d’entraînement trail CTS Coaching.',
};

export const dynamic = 'force-dynamic';

async function prixParMois(): Promise<Record<string, number> | null> {
  try {
    const r = await fetch(`${API_URL}/v1/config`, { next: { revalidate: 3600 } });
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
          vigueur le jour de ta commande. Le service s’adresse aux personnes majeures ; une personne mineure ne peut
          commander qu’avec l’accord de son représentant légal.
        </p>
      </Section>

      <Section titre="3. Le plan">
        {/* Le parcours Nolio (décisions coach des 18-19/10/2026, P1 à P4, T1 à T11, O1 à O3) : BROUILLON à valider. */}
        <p>
          Une préparation de trail, construite automatiquement par la méthode CTS à partir de tes réponses au
          questionnaire : ta course (date, distance, dénivelé, trace GPX si tu en as une), ton niveau, ce que tu cours en
          ce moment, ton terrain d’entraînement et tes jours disponibles, puis ajustée chaque semaine par des règles
          automatiques. Elle est construite et ajustée sans échange avec un coach : personne ne relit tes réponses ni tes
          commentaires.
        </p>
        <p>Elle comprend :</p>
        <Liste>
          <li>
            ta trame jusqu’à ta course, sur la durée choisie (3, 4 ou 6 mois) : pour chaque semaine, son type, son volume
            et ses séances clés, les week-ends choc annoncés d’avance ;
          </li>
          <li>
            une invitation dans l’équipe CTS sur Nolio, la plateforme d’entraînement que nous utilisons (un compte
            d’athlète gratuit, créé à ton adresse si tu n’en as pas) : tes séances détaillées y sont écrites chaque
            dimanche pour la semaine suivante, d’après ta semaine écoulée, tes réponses au questionnaire du samedi et,
            si tu l’acceptes, ton effort ressenti et ton Hooper ; tu quittes l’équipe une semaine après ta course, ton
            compte Nolio et tes séances restent à toi ;
          </li>
          <li>
            l’accès à l’app CTS, ton tableau de bord : ta course, ta trame, ta jauge de préparation et tes graphiques, ta
            fiche de course et la bibliothèque de fiches ;
          </li>
        </Liste>
        <p>
          Elle ne comprend ni suivi ni échange avec un coach, ne convient pas à une blessure en cours, et ne remplace pas
          un avis médical (article 4). Nolio s’utilise dans son application et sur son site, selon ses propres
          conditions ; l’envoi des séances sur une montre dépend de Nolio et de ta montre.
        </p>
        <p>
          L’app s’ouvre dans un navigateur récent, sur téléphone ou sur ordinateur, et peut s’ajouter à l’écran d’accueil
          du téléphone. Il faut une connexion internet pour s’y connecter : la connexion se fait par un code à 6 chiffres
          envoyé par e-mail, sans mot de passe.
        </p>
        <p>
          Ton plan reste accessible dans l’app au moins jusqu’au lendemain de ta course, et tant que ton compte existe. Un
          compte resté 3 ans sans activité est supprimé, après un e-mail d’avertissement 30 jours avant (voir la{' '}
          <a href="/confidentialite">politique de confidentialité</a>).
        </p>
        <p>
          Les durées proposées dépendent de ta course et de ton niveau. Avant tout paiement, le questionnaire te dit si la
          préparation demandée ne lui paraît pas possible, et pourquoi.
        </p>
      </Section>

      <Section titre="4. Ta santé">
        <p>
          Le plan ne remplace pas un avis médical. Avant de commencer, lis l’avertissement affiché au récapitulatif et en
          tête de ton plan : si tu as un doute de santé, une douleur, une blessure en cours ou un antécédent qui pourrait
          interagir avec l’entraînement, consulte un professionnel de santé. En cours de préparation, adapte ou interromps
          une séance en cas de douleur inhabituelle, de fatigue excessive ou de tout signe qui te semble anormal : le plan
          ne peut pas remplacer ton propre jugement sur ce que ton corps te dit.
        </p>
      </Section>

      <Section titre="5. Prix">
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
        <p>
          Un code promotionnel, quand il y en a un, se saisit sur la page de paiement ; sa réduction s’applique dans les
          conditions et jusqu’à la date annoncées avec lui. C’est un achat unique : pas d’abonnement, rien ne se
          renouvelle.
        </p>
      </Section>

      <Section titre="6. Commande">
        <Liste>
          <li>Tu réponds au questionnaire.</li>
          <li>
            Au récapitulatif, tu relis tes réponses et peux les corriger, tu lis l’avertissement santé, puis tu coches la
            case qui accepte ces conditions et celle qui demande que ta préparation commence tout de suite (article 8).
          </li>
          <li>Tu payes sur la page de paiement sécurisée de notre prestataire Stripe.</li>
        </Liste>
        <p>
          Le contrat est conclu quand ton paiement est confirmé. Tu reçois alors par e-mail la confirmation de ta commande.
        </p>
      </Section>

      <Section titre="7. Paiement">
        <p>
          Par carte bancaire (Apple Pay et Google Pay compris), sur la page de paiement de Stripe (Stripe Payments Europe,
          Ltd.). Nous ne voyons ni ne gardons tes numéros de carte. Le prix est débité en une fois, au moment de la
          commande ; il apparaît sur ton relevé sous le libellé « CTS COACHING ».
        </p>
      </Section>

      {/* Décision coach du 19/10/2026 : avec Nolio, la préparation s'exécute semaine après semaine jusqu'à la course ;
          c'est un service, rétractable 14 jours, payé au prorata de ce qui a été fourni (art. L221-25). */}
      <Section titre="8. Début de ta préparation et droit de rétractation">
        <p>
          Ta préparation commence dès ton paiement confirmé : ton plan s’affiche dans l’app, ton compte est créé, l’e-mail
          de bienvenue t’est envoyé et Nolio t’invite dans l’équipe CTS ; tes séances s’y écrivent
          ensuite chaque dimanche, jusqu’à ta course. Si ton plan n’a pas pu être construit, la page te le dit :
          écris-nous, nous te le livrons ou, si nous ne le pouvons pas, nous te remboursons intégralement.
        </p>
        <p>
          Tu disposes d’un délai de rétractation de 14 jours à compter de ton paiement, sans avoir à te justifier. Ta
          préparation commence tout de suite parce que tu l’as demandé expressément, par la case prévue au récapitulatif ;
          l’e-mail de bienvenue le confirme. Si tu te rétractes, tu nous dois la part du prix qui correspond aux jours de
          préparation déjà écoulés le jour où tu nous le dis, rapportés à sa durée jusqu’à ta course (article L221-25 du
          code de la consommation) ; avant la date de début donnée dans ton plan, rien. Nous te remboursons le reste sous
          14 jours, par le moyen de paiement que tu as utilisé, sans frais. Les garanties légales de l’article 9 restent
          entières.
        </p>
        <p>
          Pour te rétracter, écris-nous {contact}, en le disant clairement ; tu peux utiliser ce formulaire :
        </p>
        <div className="border border-indigo/20 p-4 text-sm space-y-2">
          <p className="font-semibold">Formulaire de rétractation</p>
          <p>(Complète et renvoie ce formulaire seulement si tu veux te rétracter du contrat.)</p>
          <p>
            À l’attention de {vendeur.nom}, {vendeur.nomCommercial}, {vendeur.adresse}, {vendeur.email} :
          </p>
          <p>Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous :</p>
          <p>Commandé le :</p>
          <p>Nom :</p>
          <p>Adresse :</p>
          <p>Signature (seulement si ce formulaire est envoyé sur papier) :</p>
          <p>Date :</p>
        </div>
      </Section>

      <Section titre="9. Garanties légales">
        <p>
          {vendeur.nom} ({vendeur.nomCommercial}) répond des garanties légales ci-dessous. Pour les mettre en œuvre,
          contacte-nous {contact}.
        </p>
        <div className="border-2 border-indigo/20 bg-white p-5 space-y-3 text-sm">
          <p>
            Le consommateur dispose d’un délai de deux ans à compter de la fourniture du contenu numérique ou du service
            numérique pour obtenir la mise en œuvre de la garantie légale de conformité en cas d’apparition d’un défaut de
            conformité. Durant un délai d’un an à compter de la date de fourniture, le consommateur n’est tenu d’établir
            que l’existence du défaut de conformité et non la date d’apparition de celui-ci.
          </p>
          <p>
            La garantie légale de conformité emporte obligation de fournir toutes les mises à jour nécessaires au maintien
            de la conformité du contenu numérique ou du service numérique.
          </p>
          <p>
            La garantie légale de conformité donne au consommateur droit à la mise en conformité du contenu numérique ou du
            service numérique sans retard injustifié suivant sa demande, sans frais et sans inconvénient majeur pour lui.
          </p>
          <p>
            Le consommateur peut obtenir une réduction du prix en conservant le contenu numérique ou le service numérique
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
          <p>
            Les droits mentionnés ci-dessus résultent de l’application des articles L. 224-25-1 à L. 224-25-31 du code de
            la consommation.
          </p>
          <p>
            Le professionnel qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité
            encourt une amende civile d’un montant maximal de 300 000 euros, qui peut être porté jusqu’à 10 % du chiffre
            d’affaires moyen annuel (article L. 242-18-1 du code de la consommation).
          </p>
          <p>
            Le consommateur bénéficie, en outre, de la garantie légale des vices cachés en application des articles 1641 à
            1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne
            droit à une réduction de prix si le contenu numérique ou le service numérique est conservé ou à un
            remboursement intégral contre renonciation au contenu numérique ou au service numérique.
          </p>
        </div>
      </Section>

      <Section titre="10. Propriété intellectuelle">
        <p>
          Ton plan, ses textes, les fiches de la bibliothèque et l’app sont protégés par le droit d’auteur. Ils sont à ton
          usage personnel : tu peux les consulter, les imprimer et t’en servir pour t’entraîner, pas les revendre, les
          diffuser ni les publier.
        </p>
      </Section>

      <Section titre="11. Données personnelles">
        <p>
          Ce que nous gardons, pourquoi, combien de temps, et tes droits : voir la{' '}
          <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </Section>

      <Section titre="12. Réclamations et médiation">
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

      <Section titre="13. Droit applicable">
        <p>
          Ces conditions sont soumises au droit français. En cas de litige, tu peux saisir, à ton choix, la juridiction du
          lieu où tu demeurais au moment de ta commande ou celle du lieu où le vendeur est établi.
        </p>
      </Section>
    </PageLegale>
  );
}
