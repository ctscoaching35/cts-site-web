import type { Metadata } from 'next';
import { PageLegale, Section } from '@/components/PageLegale';
import { mediateur, plansVisibles, vendeur } from '@/lib/legal';

// Les mentions légales (loi pour la confiance dans l'économie numérique ; CTS_LANCEMENT_CADRAGE.md dans le dépôt du
// moteur, L5 et C5 ; écrites le 15/10/2026, relues par le coach).
export const metadata: Metadata = {
  title: 'Mentions légales — CTS Coaching',
  description: 'Éditeur, hébergement et contact du site CTS Coaching.',
};

// Lit la porte des plans (cookie, session) : calculée à chaque visite.
export const dynamic = 'force-dynamic';

export default async function MentionsLegales() {
  const plans = await plansVisibles();
  return (
    <PageLegale titre="Mentions légales" plans={plans}>
      <Section titre="Éditeur du site">
        <p>
          {vendeur.nom}, {vendeur.forme}, nom commercial {vendeur.nomCommercial}
          <br />
          {vendeur.adresse}
          <br />
          SIRET {vendeur.siret} · TVA intracommunautaire {vendeur.tvaIntracom} (TVA non applicable, article 293 B du
          code général des impôts)
          <br />
          E-mail : <a href={`mailto:${vendeur.email}`}>{vendeur.email}</a> · Téléphone :{' '}
          <a href={`tel:${vendeur.telephoneLien}`}>{vendeur.telephone}</a>
        </p>
        <p>Directeur de la publication : {vendeur.nom}.</p>
      </Section>

      <Section titre="Hébergement">
        <p>
          Le site et l’app sont hébergés par Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis
          (vercel.com, privacy@vercel.com). Les données des comptes sont hébergées en Irlande par Supabase, et le moteur
          qui construit les séances en Allemagne par Render : voir la{' '}
          <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </Section>

      <Section titre="Propriété intellectuelle">
        <p>
          Les textes, les fiches, les plans, les photographies et les logos de ce site appartiennent à{' '}
          {vendeur.nomCommercial}, sauf mention contraire. Toute reproduction ou diffusion, même partielle, sans notre
          accord écrit est interdite.
        </p>
      </Section>

      <Section titre="Médiation de la consommation">
        <p>
          Nous relevons du médiateur de la consommation {mediateur.nom}, {mediateur.adresse},{' '}
          <a href={mediateur.site} target="_blank" rel="noopener noreferrer">
            www.cm2c.net
          </a>
          , que tu peux saisir gratuitement si une réclamation écrite auprès de nous n’a pas abouti.
        </p>
      </Section>

      <Section titre="Conditions et données">
        <p>
          {plans && (
            <>
              La vente des plans suit les <a href="/cgv">conditions générales de vente</a>.{' '}
            </>
          )}
          Ce que nous faisons de tes données est dit dans la <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </Section>
    </PageLegale>
  );
}
