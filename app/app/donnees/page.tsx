import type { Metadata } from 'next';
import Link from 'next/link';
import EnTeteApp from '@/components/app/EnTeteApp';
import { GraphiqueCharge, GraphiqueHooper, GraphiqueVolume } from '@/components/app/Graphiques';
import { Carte, LIEN, Surtitre, TITRE } from '@/components/app/Ui';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { barresDeVolume, pointsHooper } from '@/lib/app/tableau';
import { donneesTableau, saisonDuCoureur } from '@/lib/app/tableauDuPlan';

export const metadata: Metadata = { title: 'Tes données' };

// Mes données (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, AP1, AP3, T10 ; maquette validée par le coach le
// 19/10/2026) : la charge faite seule (RPE de séance × durée) et sa moyenne sur 4 semaines, le volume en heures fait
// contre prévu, le Hooper du dimanche et sa zone habituelle. Tout vient de la base, rangé chaque dimanche soir et refait
// chaque nuit avec les retours tardifs (décision coach du 20/10/2026). Un
// coaché les voit sur toute sa saison, d'un objectif à l'autre, ses courses en repère (décision coach du 20/10/2026).
// Q15 (décision coach du 05/11/2026 au soir, « A ») : les trois graphiques sur les mêmes semaines, les 10 dernières et la
// semaine en cours ; le volume garde en plus ses 3 semaines à venir.
export default async function MesDonnees({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const d = await donneesTableau(ctx);
  // Un coaché : toute sa saison, d'un objectif à l'autre, ses courses en repère (décision coach du 20/10/2026).
  const saison = await saisonDuCoureur(ctx, d);
  // Programmé à la main (décision coach du 20/10/2026) : ses semaines lues dans Nolio, sans la trame du moteur.
  const trame = ctx.aLaMain ? [] : d.trame;
  const toutes = d.ecrit || saison.realises.length ? barresDeVolume(trame, saison.realises, ctx.jour, saison.courses) : [];
  const futur = toutes.findIndex((b) => b.moment === 'avenir');
  const barres = futur < 0 ? toutes : toutes.slice(0, futur + 3);
  // L'axe commun : les semaines faites et la semaine en cours du volume.
  const axe = barres.filter((b) => b.moment !== 'avenir').map((b) => b.lundi);
  const points = d.accord ? pointsHooper(trame, saison.realises, ctx.jour, saison.courses) : [];
  const rien = !saison.realises.length;
  // La charge et le Hooper demandent deux semaines lues : avant, leur cadre dit quand ils arrivent (retour du coach du
  // 20/10/2026 : « pas de graphique Hooper ? charge ? »).
  const dansAxe = new Set(axe);
  const chargePrete = saison.realises.filter((r) => r.rpe_lu && r.charge_faite > 0 && dansAxe.has(r.lundi)).length >= 2;
  const hooperPret = points.filter((p) => p.valeur !== null && dansAxe.has(p.lundi)).length >= 2;
  // C18 (audits du 05/11/2026) : sans accord, le renvoi à l'accord est un lien, pour un acheteur (celui d'un coaché se
  // donne dans Nolio).
  const accord = `${lien('/app/compte', ctx)}#accord`;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div>
          <h1 className={TITRE}>Tes données</h1>
          {/* C40 : une seule phrase de mise à jour, et juste. Validé par le coach le 05/11/2026 (1A). */}
          <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78] leading-relaxed">
            {d.accord ? 'Lues dans Nolio avec ton accord : rangées chaque dimanche soir, complétées chaque nuit.'
              : 'Tes séances faites ou manquées et leur durée : rangées chaque dimanche soir, complétées chaque nuit.'}
          </p>
        </div>
        {rien && !d.accord && (
          <Carte className="text-sm text-[#4A4866] leading-relaxed">
            {/* B5 (audit du 03/11/2026) : un coaché à la main ou sans objectif, sans accord, n'a rien qui arrive le dimanche. */}
            <p>{ctx.coache && (ctx.aLaMain || ctx.sansObjectif)
              ? 'Tes données arrivent avec ton accord : réponds « oui » au message de ton coach dans Nolio, et ton volume, ta charge et ta forme s’affichent ici.'
              : 'Tes premières données arrivent le dimanche soir qui suit ta première semaine : ton volume, semaine après semaine.'}</p>
          </Carte>
        )}
        {/* Une semaine se dit par son lundi, pas par son numéro (décision coach du 19/10/2026). */}
        {d.accord && (chargePrete ? <GraphiqueCharge realises={saison.realises} courses={saison.courses} axe={axe} />
          // C40 : sans « le dimanche soir », qui contredisait la phrase de mise à jour. Validé par le coach le 05/11/2026 (1A).
          : <EnAttente titre="Ta charge d’entraînement" texte="Elle s’affiche après deux semaines faites : ton effort ressenti (RPE) multiplié par la durée de chaque séance, lus dans Nolio." />)}
        {barres.length > 0 ? <GraphiqueVolume barres={barres} />
          // C41 : la carte du volume dit quand elle arrive, comme les deux autres. Validé par le coach le 05/11/2026 (1A).
          : !(rien && !d.accord) && <EnAttente titre="Ton volume de course" texte="Il s’affiche après ta première semaine faite : tes heures de course, semaine après semaine, lues dans Nolio." />}
        {d.accord && (hooperPret ? <GraphiqueHooper points={points} axe={axe} aLaMain={ctx.aLaMain} />
          : <EnAttente titre="Ta forme du dimanche (Hooper)" texte="Elle s’affiche après deux dimanches : ta fatigue, ton sommeil, ton stress et tes courbatures, à remplir le dimanche à 8 h dans Nolio." />)}
        {!d.accord && !rien && (
          <Carte className="space-y-1 text-[0.8125rem] text-[#4A4866] leading-relaxed">
            <p>Ta charge et ton Hooper s’affichent avec ton accord de lecture : l’app lit alors dans Nolio ton effort ressenti et ton Hooper.</p>
            {!ctx.coache && <Link href={accord} className={LIEN}>Donner mon accord ›</Link>}
          </Carte>
        )}
      </main>
    </>
  );
}

// Le cadre d'un graphique qui attend ses données : son titre, et quand il arrive.
function EnAttente({ titre, texte }: { titre: string; texte: string }) {
  return (
    <Carte className="space-y-2">
      <Surtitre>{titre}</Surtitre>
      <div className="h-16 rounded-xl border border-dashed border-indigo/15 bg-sand/60 flex items-end gap-1.5 px-3 pb-2" aria-hidden>
        {[30, 45, 38, 55, 48, 62].map((v, i) => <span key={i} className="flex-1 rounded-sm bg-indigo/[0.06]" style={{ height: `${v}%` }} />)}
      </div>
      <p className="text-xs text-[#5E5C78] leading-relaxed">{texte}</p>
    </Carte>
  );
}
