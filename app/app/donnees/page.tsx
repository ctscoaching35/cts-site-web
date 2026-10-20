import EnTeteApp from '@/components/app/EnTeteApp';
import { GraphiqueCharge, GraphiqueHooper, GraphiqueVolume } from '@/components/app/TableauDeBord';
import { Carte, Surtitre } from '@/components/app/Ui';
import { contexte, type Recherche } from '@/lib/app/contexte';
import { barresDeVolume, pointsHooper } from '@/lib/app/tableau';
import { donneesTableau, saisonDuCoureur } from '@/lib/app/tableauDuPlan';

// Mes données (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, AP1, AP3, T10 ; maquette validée par le coach le
// 19/10/2026) : la charge faite seule (RPE de séance × durée) et sa moyenne sur 4 semaines, le volume en heures fait
// contre prévu, le Hooper du dimanche et sa zone habituelle. Tout vient de la base, rangé chaque dimanche soir. Un
// coaché les voit sur toute sa saison, d'un objectif à l'autre, ses courses en repère (décision coach du 20/10/2026).
export default async function MesDonnees({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const d = await donneesTableau(ctx);
  // Un coaché : toute sa saison, d'un objectif à l'autre, ses courses en repère (décision coach du 20/10/2026).
  const saison = await saisonDuCoureur(ctx, d);
  // Les 8 dernières semaines faites, la semaine en cours et les 3 qui viennent.
  // Programmé à la main (décision coach du 20/10/2026) : ses semaines lues dans Nolio, sans la trame du moteur.
  const trame = ctx.aLaMain ? [] : d.trame;
  const toutes = d.ecrit || saison.realises.length ? barresDeVolume(trame, saison.realises, ctx.jour, saison.courses) : [];
  const futur = toutes.findIndex((b) => b.moment === 'avenir');
  const barres = futur < 0 ? toutes : toutes.slice(0, futur + 3);
  const points = d.accord ? pointsHooper(trame, saison.realises, ctx.jour, saison.courses) : [];
  const rien = !saison.realises.length;
  // La charge et le Hooper demandent deux semaines lues : avant, leur cadre dit quand ils arrivent (retour du coach du
  // 20/10/2026 : « pas de graphique Hooper ? charge ? »).
  const chargePrete = saison.realises.filter((r) => r.rpe_lu && r.charge_faite > 0).length >= 2;
  const hooperPret = points.filter((p) => p.valeur !== null).length >= 2;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div>
          <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight">Mes données</h1>
          <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78] leading-relaxed">
            {d.accord && ctx.aLaMain ? 'Lues dans Nolio avec ton accord, mises à jour chaque nuit.'
              : d.accord ? 'Lues dans Nolio avec ton accord, mises à jour chaque dimanche soir.'
              : 'Tes séances faites ou manquées et leur durée, mises à jour chaque dimanche soir.'}
          </p>
        </div>
        {rien && !d.accord && (
          <Carte className="text-sm text-[#4A4866] leading-relaxed">
            <p>Tes premières données arrivent le dimanche soir qui suit ta première semaine : ton volume, semaine après semaine.</p>
          </Carte>
        )}
        {/* Une semaine se dit par son lundi, pas par son numéro (décision coach du 19/10/2026). */}
        {d.accord && (chargePrete ? <GraphiqueCharge realises={saison.realises} courses={saison.courses} />
          : <EnAttente titre="Ta charge d’entraînement" texte="Elle s’affiche après deux semaines faites : ton effort ressenti (RPE) multiplié par la durée de chaque séance, lus dans Nolio le dimanche soir." />)}
        <GraphiqueVolume barres={barres} />
        {d.accord && (hooperPret ? <GraphiqueHooper points={points} />
          : <EnAttente titre="Ton Hooper du dimanche" texte="Il s’affiche après deux questionnaires du dimanche : ta fatigue, ton sommeil, ton stress et tes courbatures, semaine après semaine." />)}
        {!d.accord && !rien && (
          <Carte className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            <p>Ta charge et ton Hooper s’affichent avec ton accord de lecture : l’app lit alors dans Nolio ton effort ressenti et ton Hooper.</p>
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
