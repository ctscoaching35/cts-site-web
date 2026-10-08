import EnTeteApp from '@/components/app/EnTeteApp';
import LienFiche from '@/components/app/LienFiche';
import RetourPlan from '@/components/app/RetourPlan';
import TexteRiche from '@/components/app/TexteRiche';
import { Avertissement, Partie, Puces, Tableau } from '@/components/app/Texte';
import { contexte, type Recherche } from '@/lib/app/contexte';
import { FAMILLES } from '@/lib/app/charte';
import { cheminFiche } from '@/lib/app/plan';
import { texteAllure, texteFc } from '@/lib/app/zones';

// Le mode d'emploi (cts_contenu.contenu_mode_emploi), dans l'ordre du PDF. « Lire une semaine »
// est le même texte sur le papier et à l'écran (décision coach du 07/10/2026, moteur v8.304).
export default async function ModeEmploi({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const m = plan.mode_emploi;
  // « Tes zones » : deux colonnes de plus dès qu'une valeur du profil est connue (Z8).
  const { profil } = ctx;
  const avecZones = plan.zones && (profil.fc_seuil1 !== null || profil.vc_ms !== null);
  const zonesTableau = avecZones
    ? m.effort.zones.map((ligne, i) =>
        i === 0
          ? [...ligne, ...plan.zones!.tableau.colonnes]
          : [
              ...ligne,
              texteFc(plan.zones!.tableau.lignes[i - 1]?.fc, profil)?.replace(/^FC /, '') ?? '—',
              texteAllure(plan.zones!.tableau.lignes[i - 1]?.allure_vc, profil) ?? '—',
            ])
    : m.effort.zones;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <RetourPlan ctx={ctx} />
        <h1 className="text-2xl text-indigo leading-tight">{m.titre}</h1>

        <Partie titre={m.effort.titre}>
          <p>{m.effort.intro}</p>
          <Tableau lignes={zonesTableau} />
          <p className="text-sm text-indigo/70">{m.effort.note}</p>
        </Partie>

        <Partie titre={m.lire_semaine.titre}>
          <p>
            <TexteRiche texte={m.lire_semaine.texte} />
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-indigo/75">
            {m.lire_semaine.familles.map(([f, libelle]) => (
              <li key={f} className="flex items-center gap-1.5">
                <span
                  className={f === 'course' ? 'w-3.5 h-3.5' : 'w-4 h-1.5 rounded-full'}
                  style={{ backgroundColor: FAMILLES[f].filet }}
                />
                {libelle}
              </li>
            ))}
          </ul>
        </Partie>

        <Partie titre={m.lire_seance.titre}>
          <p>
            <TexteRiche texte={m.lire_seance.texte} />
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {m.lire_seance.codes.map(([code, sens]) => (
              <div key={code} className="contents">
                <dt className="font-bold text-indigo whitespace-nowrap">{code}</dt>
                <dd>{sens}</dd>
              </div>
            ))}
          </dl>
        </Partie>

        <Partie titre={m.seances.titre}>
          <Puces puces={m.seances.glossaire.map(([nom, definition]) => `<b>${nom}</b> — ${definition}`)} />
        </Partie>

        <Partie titre={m.adapter.titre}>
          <Puces puces={m.adapter.puces} />
        </Partie>

        <Partie titre={m.fatigue.titre} id="fatigue">
          <Puces puces={m.fatigue.puces} />
        </Partie>

        <Partie titre={m.renforcement.titre}>
          <p>{m.renforcement.texte}</p>
          <LienFiche
            ctx={ctx}
            href={cheminFiche(plan, 'renforcement')}
            libelle={plan.pour_aller_plus_loin.fiches.find((f) => f.cle === 'renforcement')?.titre ?? ''}
          />
        </Partie>

        <Avertissement avertissement={plan.avertissement} />
      </main>
    </>
  );
}
