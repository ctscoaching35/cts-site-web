import Link from 'next/link';
import type { LigneTrame } from '@/lib/app/ecriture';
import { BANNIERE } from '@/lib/app/charte';
import { lien, type Contexte } from '@/lib/app/contexte';
import { slugFiche } from '@/lib/app/plan';
import { ECART_ZONE_HOOPER, enHeures, type Barre, type Fiche, type Jauge, type PointHooper } from '@/lib/app/tableau';
import type { EtatNolio } from '@/lib/app/tableauDuPlan';

// Les pièces du tableau de bord (CTS_NOLIO_CADRAGE.md, T1, T4, T10) : où en est l'athlète dans Nolio, la semaine de
// la trame, la jauge par piliers, la charge et le Hooper, la fiche du moment. Jamais le mot « chance » (J4).

const NOLIO = 'https://www.nolio.io/';

// ─── Nolio ────────────────────────────────────────────────────────────────

export function CarteNolio({ etat }: { etat: EtatNolio }) {
  if (!etat) return null;
  const textes: Record<Exclude<EtatNolio, null>, { titre: string; texte: string; bouton: boolean }> = {
    a_inviter: { titre: 'Ton invitation Nolio arrive', bouton: false,
      texte: 'Nolio t’envoie dans quelques minutes une invitation à rejoindre l’équipe CTS. Accepte-la : tes séances s’y installent aussitôt.' },
    en_cours: { titre: 'Ton invitation Nolio arrive', bouton: false,
      texte: 'Nolio t’envoie dans quelques minutes une invitation à rejoindre l’équipe CTS. Accepte-la : tes séances s’y installent aussitôt.' },
    invite: { titre: 'Accepte ton invitation Nolio', bouton: false,
      texte: 'Nolio t’a envoyé par e-mail une invitation à rejoindre l’équipe CTS (pense à regarder dans tes indésirables). Dès que tu l’acceptes, tes séances s’installent dans ton calendrier Nolio.' },
    actif: { titre: 'Tes séances sont dans Nolio', bouton: true,
      texte: 'Chaque dimanche, la semaine qui vient s’écrit d’après ta semaine écoulée et tes réponses au questionnaire.' },
    coache: { titre: 'Tes séances sont dans Nolio', bouton: true, texte: 'Ton coach les y prépare semaine après semaine.' },
    refuse: { titre: 'Ton invitation Nolio n’a pas abouti', bouton: false,
      texte: 'Réponds simplement à ton e-mail de bienvenue : nous t’en renvoyons une.' },
    sorti: { titre: 'Ta préparation est terminée dans Nolio', bouton: true,
      texte: 'Ton compte Nolio et tes séances restent à toi.' },
  };
  const t = textes[etat];
  return (
    <section className="bg-white shadow-sm border-l-4 border-teal px-4 py-3 space-y-2">
      <h2 className="font-bold text-indigo">{t.titre}</h2>
      <p className="text-sm text-indigo/75 leading-relaxed">{t.texte}</p>
      {t.bouton && <a href={NOLIO} className="btn btn-primary !py-2.5 inline-block">Mes séances dans Nolio</a>}
    </section>
  );
}

// ─── La semaine de la trame ───────────────────────────────────────────────

export function SemaineDeLaTrame({ ligne, rang, total }: { ligne: LigneTrame; rang: number; total: number }) {
  return (
    <div className="bg-white shadow-sm border-l-4 px-4 py-3" style={{ borderLeftColor: BANNIERE[ligne.type] ?? '#2F2D4E' }}>
      <div className="text-[0.7rem] font-semibold tracking-cts uppercase text-indigo/55">Semaine {rang} sur {total} · {ligne.dates}</div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className="text-xl font-extrabold text-indigo">{ligne.type}</span>
        <span className="text-xs font-semibold text-indigo bg-[#E4E3EE] px-2.5 py-1 rounded-full">{ligne.bloc}</span>
        {ligne.week_end_choc && <span className="text-xs font-semibold text-white bg-teal px-2.5 py-1 rounded-full">Week-end choc</span>}
      </div>
      <p className="text-sm text-indigo/70 mt-1">{enHeures(Math.round(ligne.volume_h * 60))} de volume prévu</p>
      {ligne.seances_cles.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm text-indigo">
          {ligne.seances_cles.map((c) => (
            <li key={`${c.jour}-${c.seance}`}><span className="text-indigo/55">{c.jour} ·</span> {c.seance}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── La jauge (T4) ────────────────────────────────────────────────────────

const TON = { bien: '#0C6E5F', retrait: '#9A6A12', retard: '#9A3B2C' } as const;

export function JaugePiliers({ jauge }: { jauge: Jauge }) {
  if (!jauge.piliers.length && !jauge.jalons.some((j) => j.atteint)) return null;
  return (
    <section className="bg-white shadow-sm px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[0.7rem] font-semibold tracking-cts uppercase text-teal">
          Ta préparation{jauge.semaine ? ` · semaine ${jauge.semaine} sur ${jauge.total}` : ''}
        </h2>
        {jauge.verdict && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: TON[jauge.verdict.ton] }}>
            {jauge.verdict.libelle}
          </span>
        )}
      </div>
      {jauge.piliers.map((p) => (
        <div key={p.cle} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-indigo">{p.titre}</span>
            <span className="text-indigo/60">{Math.round(p.valeur * 100)} %</span>
          </div>
          <div className="h-2 bg-[#E6E8EE]" aria-hidden>
            <div className="h-2 bg-teal" style={{ width: `${Math.round(p.valeur * 100)}%` }} />
          </div>
          <p className="text-xs text-indigo/65">{p.detail}</p>
        </div>
      ))}
      {jauge.jalons.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Tes jalons">
          {jauge.jalons.map((j) => (
            <li key={j.titre} className={j.atteint ? 'text-xs font-semibold px-2.5 py-1 rounded-full bg-[#D9ECE6] text-teal'
              : 'text-xs px-2.5 py-1 rounded-full bg-[#F1F2F6] text-indigo/45'}>
              {j.atteint ? '✓ ' : ''}{j.titre}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── La charge de la semaine (T10) ────────────────────────────────────────

const L = 300;
const H = 110;
const BAS = 92;

export function GraphiqueCharge({ barres }: { barres: Barre[] }) {
  if (!barres.length) return null;
  const pas = L / barres.length;
  const pic = Math.max(1, ...barres.map((b) => Math.max(b.prevue, b.faite ?? 0)));
  const h = (v: number) => (v / (pic * 1.1)) * (BAS - 6);
  const faites = barres.some((b) => b.faite !== null);
  return (
    <section className="bg-white shadow-sm px-4 py-3 space-y-2">
      <h2 className="text-[0.7rem] font-semibold tracking-cts uppercase text-teal">Ta charge, semaine par semaine</h2>
      <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label="La charge faite à côté de la charge prévue, chaque semaine">
        {barres.map((b, i) => {
          const x = i * pas;
          const w = pas * 0.8;
          const avenir = b.moment !== 'passee';
          return (
            <g key={b.numero}>
              <title>{`${b.numero} : prévue ${b.prevue}${b.faite !== null ? `, faite ${b.faite}` : ''}`}</title>
              <rect x={x + pas * 0.1} y={BAS - h(b.prevue)} width={w} height={h(b.prevue)}
                fill={avenir ? 'none' : '#E4E3EE'} stroke={avenir ? '#8A94A8' : 'none'} strokeDasharray={avenir ? '3 2' : undefined} strokeWidth={0.8} />
              {b.faite !== null && (
                <rect x={x + pas * 0.28} y={BAS - h(b.faite)} width={w * 0.55} height={h(b.faite)} fill="#0C6E5F" />
              )}
              {b.moment === 'encours' && <rect x={x + pas * 0.1} y={BAS + 2} width={w} height={2} fill="#2F2D4E" />}
              {b.choc && <text x={x + pas / 2} y={BAS - h(b.prevue) - 2} textAnchor="middle" fontSize={7} fill="#0C6E5F">●</text>}
              {b.affutage && <rect x={x} y={BAS + 6} width={pas} height={3} fill="#BEE4DE" />}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-indigo/70">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#E4E3EE]" />prévue</span>
        {faites && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-teal" />faite</span>}
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 border border-dashed border-[#8A94A8]" />à venir</span>
        <span className="flex items-center gap-1.5"><span className="text-teal">●</span>week-end choc</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 bg-[#BEE4DE]" />affûtage</span>
      </div>
      <p className="text-xs text-indigo/60">La charge d’une séance : ton RPE multiplié par sa durée. Elle se met à jour chaque dimanche.</p>
    </section>
  );
}

// ─── Le Hooper du dimanche (T10) ──────────────────────────────────────────

export function GraphiqueHooper({ points }: { points: PointHooper[] }) {
  const valeurs = points.filter((p) => p.valeur !== null);
  if (valeurs.length < 2) return null;
  // Une marge de chaque côté : les points des bords restent entiers.
  const marge = 6;
  const pas = (L - 2 * marge) / Math.max(1, points.length - 1);
  const x = (i: number) => marge + i * pas;
  const haut = Math.max(...points.flatMap((p) => [p.valeur ?? 0, (p.zone ?? 0) + ECART_ZONE_HOOPER])) + 2;
  const bas = Math.max(0, Math.min(...points.flatMap((p) => (p.valeur !== null ? [p.valeur] : []).concat(p.zone !== null ? [p.zone - ECART_ZONE_HOOPER] : []))) - 2);
  const y = (v: number) => 8 + ((haut - v) / (haut - bas)) * (BAS - 16);
  const zone = points.map((p, i) => (p.zone !== null ? { x: x(i), hautZ: y(p.zone + ECART_ZONE_HOOPER), basZ: y(p.zone - ECART_ZONE_HOOPER) } : null))
    .filter((z): z is { x: number; hautZ: number; basZ: number } => z !== null);
  const ligne = points.map((p, i) => (p.valeur !== null ? `${x(i)},${y(p.valeur)}` : null)).filter(Boolean).join(' ');
  return (
    <section className="bg-white shadow-sm px-4 py-3 space-y-2">
      <h2 className="text-[0.7rem] font-semibold tracking-cts uppercase text-teal">Ton Hooper du dimanche</h2>
      <svg viewBox={`0 0 ${L} ${BAS}`} className="w-full h-auto" role="img" aria-label="Ton Hooper chaque dimanche et ta zone habituelle">
        {zone.length >= 2 && (
          <polygon fill="#D9ECE6" points={[...zone.map((z) => `${z.x},${z.hautZ}`), ...[...zone].reverse().map((z) => `${z.x},${z.basZ}`)].join(' ')} />
        )}
        <polyline fill="none" stroke="#2F2D4E" strokeWidth={1.5} points={ligne} />
        {points.map((p, i) => p.valeur !== null && (
          <circle key={p.numero} cx={x(i)} cy={y(p.valeur)} r={2.5}
            fill={p.zone !== null && p.valeur > p.zone + ECART_ZONE_HOOPER ? '#9A3B2C' : '#2F2D4E'}>
            <title>{`${p.numero} : ${p.valeur}`}</title>
          </circle>
        ))}
      </svg>
      <p className="text-xs text-indigo/60">
        La bande verte : ta zone habituelle (ta moyenne des 4 semaines d’avant). Plus le Hooper est haut, plus tu es fatigué.
      </p>
    </section>
  );
}

// ─── La fiche du moment ───────────────────────────────────────────────────

export function FicheDuMoment({ fiche, avenir, ctx }: { fiche: Fiche; avenir: boolean; ctx: Contexte }) {
  const href = fiche.cle === 'course' ? lien('/app/plan/jour-j', ctx) : lien(`/app/bibliotheque/${fiche.url ? slugFiche(fiche.url) : fiche.cle}`, ctx);
  return (
    <Link href={href} className="block bg-white shadow-sm border-l-4 border-[#9A6A12] px-4 py-3">
      <span className="text-[0.7rem] font-semibold tracking-cts uppercase text-[#9A6A12] block">
        {avenir ? 'Bientôt, à lire' : 'La fiche du moment'}
      </span>
      <span className="font-bold text-indigo block mt-0.5">{fiche.titre} ›</span>
      <span className="text-sm text-indigo/70 block mt-0.5">{fiche.pourquoi}</span>
    </Link>
  );
}
