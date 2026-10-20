import Link from 'next/link';
import { notFound } from 'next/navigation';
import EnTeteApp from '@/components/app/EnTeteApp';
import FormulaireZones from '@/components/app/FormulaireZones';
import { effacerZones } from '@/lib/app/actionsZones';
import { maFiche } from '@/lib/app/coaching';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { dateLongue, type CleTest } from '@/lib/app/plan';
import {
  allure, fcSeuil2HorsPlan, kmh, QUAND_FC_SEUIL2_HORS_PLAN, remplir, testFait, testOuvert, testsProposes, texteRecoupement,
  valeursChange, type Profil,
} from '@/lib/app/zones';

// « Tes zones » (cadrage de l'app §7.1, textes validés par le coach le 08/10/2026) : trois tests de
// terrain, leur protocole, ce qu'ils changent au plan, leurs limites et leurs sources, et la saisie.
// Le RPE prime. Un plan d'avant le moteur v8.311 n'a pas la rubrique. Un coaché y saisit aussi ses tests, sur sa fiche,
// avec l'accord donné à son coach (décision coach du 20/10/2026).

function valeurAffichee(cle: CleTest, p: Profil) {
  if (cle === 'parole' && p.fc_seuil1 !== null)
    return { valeur: `${p.fc_seuil1} bpm${p.v_seuil1_ms !== null ? `, à ${allure(p.v_seuil1_ms)}/km` : ''}`, le: p.fc_seuil1_le };
  if (cle === 'vitesse_critique' && p.vc_ms !== null)
    return {
      // D′ n'est plus dite (décision coach du 08/10/2026) : elle ne sert qu'à vérifier les deux efforts.
      valeur: `${kmh(p.vc_ms)} km/h (${allure(p.vc_ms)}/km)`,
      le: p.vc_le,
    };
  if (cle === 'fc_seuil2' && p.fc_seuil2 !== null) return { valeur: `${p.fc_seuil2} bpm`, le: p.fc_seuil2_le };
  return null;
}

export default async function TesZones({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const { plan, profil } = ctx;
  const zones = plan.zones;
  if (!zones) notFound();
  const valeurs = valeursChange(profil, zones) ?? {};
  const consentementDonne = (['parole', 'vitesse_critique', 'fc_seuil2'] as const).some((c) => testFait(c, profil));
  const tests = zones.tests.filter((t) => testsProposes(zones).includes(t.cle));
  // Son accord tient lieu de la case à cocher ; en démonstration, la saisie se montre.
  const accord = !ctx.coache || ctx.demonstration || Boolean((await maFiche())?.accord);
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <Link href={lien('/app/profil', ctx)} className="inline-flex items-center min-h-11 text-teal font-bold text-sm">‹ Ton profil</Link>
        <h1 className="text-2xl text-indigo">{zones.titre}</h1>
        {zones.intro.map((p) => (
          <p key={p} className="text-indigo/80 leading-relaxed">{p}</p>
        ))}
        <p className="bg-white border-l-4 border-teal shadow-sm p-4 text-indigo leading-relaxed font-semibold">{zones.rpe_decide}</p>

        {tests.map((t) => {
          const fait = valeurAffichee(t.cle, profil);
          const ouvert = testOuvert(t.cle, zones, profil);
          const change = t.change.map((m) => remplir(m, valeurs));
          return (
            <section key={t.cle} id={t.cle} className="bg-white shadow-sm p-4 space-y-3 scroll-mt-20">
              <h2 className="text-lg text-indigo leading-snug">{t.titre}</h2>
              {fait && (
                <p className="text-sm font-semibold text-teal">
                  Ta valeur : {fait.valeur}{fait.le ? ` · le ${dateLongue(fait.le, true)}` : ''}
                </p>
              )}
              {/* Le seuil 1 recoupé (moteur 8.320), comme le calculateur : sans l'allure du palier, une invitation ;
                  avec la vitesse critique, la situation du test et la phrase de transparence. */}
              {t.cle === 'parole' && zones.recoupement && profil.fc_seuil1 !== null && profil.v_seuil1_ms === null && profil.vc_ms === null && (
                <p className="text-sm text-indigo/80 leading-relaxed">{zones.recoupement.textes.sans_allure}</p>
              )}
              {t.cle === 'parole' && texteRecoupement(profil, zones) && (
                <p className="text-sm text-indigo leading-relaxed bg-sand border-l-4 border-teal p-3">{texteRecoupement(profil, zones)}</p>
              )}
              <div className="text-sm text-indigo/80 leading-relaxed space-y-2">
                <p><strong className="text-indigo">Ce qu’il mesure.</strong> {t.mesure}</p>
                <p><strong className="text-indigo">Pour qui.</strong> {t.pour_qui}</p>
                <p><strong className="text-indigo">Quand.</strong> {t.cle === 'fc_seuil2' && fcSeuil2HorsPlan(zones) ? QUAND_FC_SEUIL2_HORS_PLAN : t.quand}</p>
                {t.materiel.length > 0 && (
                  <div>
                    <strong className="text-indigo">Ce qu’il te faut.</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">{t.materiel.map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                )}
                <div>
                  <strong className="text-indigo">{t.cle === 'fc_seuil2' ? 'Comment.' : 'Le test.'}</strong>
                  <ol className="list-decimal pl-5 mt-1 space-y-1">{t.etapes.map((e) => <li key={e}>{e}</li>)}</ol>
                </div>
                {t.duree && <p>{t.duree}</p>}
                <div>
                  <strong className="text-indigo">Ce que ça change dans ton plan.</strong>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {t.change.map((m, i) => <li key={m}>{change[i] ?? t.change_general[i]}</li>)}
                  </ul>
                </div>
                {t.limites && <p><strong className="text-indigo">Ses limites.</strong> {t.limites}</p>}
                <p className="text-xs text-indigo/55 italic">Sources : {t.sources}</p>
              </div>
              {!accord ? (
                <p className="text-sm text-indigo/60">Ton coach attend encore ton accord pour garder tes repères : réponds oui à son message, puis reviens ici.</p>
              ) : ouvert ? (
                <FormulaireZones
                  cle={t.cle}
                  planId={ctx.cle}
                  consentement={zones.consentement}
                  consentementDonne={consentementDonne || ctx.coache}
                  allureActuelle={t.cle === 'parole' && profil.v_seuil1_ms !== null
                    ? (allure(profil.v_seuil1_ms).split(':') as [string, string]) : null}
                  valeurActuelle={t.cle === 'parole' ? (profil.fc_seuil1?.toString() ?? null)
                    : t.cle === 'fc_seuil2' ? (profil.fc_seuil2?.toString() ?? null) : (profil.vc_ms !== null ? 'fait' : null)}
                  demonstration={ctx.demonstration}
                />
              ) : (
                <p className="text-sm text-indigo/60">Ce test s’ouvre une fois ta vitesse critique enregistrée.</p>
              )}
            </section>
          );
        })}

        {consentementDonne && !ctx.demonstration && !ctx.coache && (
          <form action={effacerZones.bind(null, ctx.cle)}>
            <button type="submit" className="text-sm font-semibold text-red-700 underline underline-offset-2">{zones.effacer}</button>
          </form>
        )}
      </main>
    </>
  );
}
