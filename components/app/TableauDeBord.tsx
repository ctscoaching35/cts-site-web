import Link from 'next/link';
import clsx from 'clsx';
import type { LigneTrame, Realise } from '@/lib/app/ecriture';
import { BANNIERE, FAMILLES } from '@/lib/app/charte';
import { lien, type Contexte } from '@/lib/app/contexte';
import { dateLongue, jourMois, slugFiche, type Jour, type Plan, type Semaine } from '@/lib/app/plan';
import { ECART_ZONE_HOOPER, enHeures, type Barre, type Fiche, type Jauge, type PointHooper } from '@/lib/app/tableau';
import type { CourseSecondaire, EtatNolio, SeanceNolio } from '@/lib/app/tableauDuPlan';
import { Carte, CarteSombre, PastilleDate, Surtitre } from './Ui';

// Les pièces de l'accueil et de « Mes données » (CTS_NOLIO_CADRAGE.md, T1, T4, T10, AP1 à AP3 ; maquettes validées
// par le coach le 19/10/2026) : l'objectif et sa montagne, les piliers, les courses de préparation, la semaine, la
// fiche du moment ; la charge, le volume et le Hooper. Jamais le mot « chance » (J4) ; la montagne sans pourcentage.

const NOLIO = 'https://www.nolio.io/';

// ─── Nolio, tant que l'athlète n'y est pas ──────────────────────────────────

export function CarteNolio({ etat }: { etat: EtatNolio }) {
  if (!etat || etat === 'actif' || etat === 'coache') return null;
  const textes: Record<'a_inviter' | 'en_cours' | 'invite' | 'refuse' | 'sorti', { titre: string; texte: string; bouton: boolean }> = {
    a_inviter: { titre: 'Ton invitation Nolio arrive', bouton: false,
      texte: 'Nolio t’envoie dans quelques minutes une invitation à rejoindre l’équipe CTS. Accepte-la : tes séances s’y installent aussitôt.' },
    en_cours: { titre: 'Ton invitation Nolio arrive', bouton: false,
      texte: 'Nolio t’envoie dans quelques minutes une invitation à rejoindre l’équipe CTS. Accepte-la : tes séances s’y installent aussitôt.' },
    invite: { titre: 'Accepte ton invitation Nolio', bouton: false,
      texte: 'Nolio t’a envoyé par e-mail une invitation à rejoindre l’équipe CTS (pense à regarder dans tes indésirables). Dès que tu l’acceptes, tes séances s’installent dans ton calendrier Nolio.' },
    refuse: { titre: 'Ton invitation Nolio n’a pas abouti', bouton: false,
      texte: 'Réponds simplement à ton e-mail de bienvenue : nous t’en renvoyons une.' },
    sorti: { titre: 'Ta préparation est terminée dans Nolio', bouton: true, texte: 'Ton compte Nolio et tes séances restent à toi.' },
  };
  const t = textes[etat];
  return (
    <Carte className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#C9A25A]" aria-hidden />
        <h2 className="font-bold text-indigo">{t.titre}</h2>
      </div>
      <p className="text-sm text-[#4A4866] leading-relaxed">{t.texte}</p>
      {t.bouton && <a href={NOLIO} target="_blank" rel="noopener" className="inline-flex items-center min-h-11 text-sm font-bold text-teal">Ouvrir Nolio ›</a>}
    </Carte>
  );
}

// ─── L'objectif et sa montagne (AP2) ──────────────────────────────────────

const REMPLI = { bien: '#2BB39B', retrait: '#E3A23B', retard: '#E2725B' } as const;
const SOMMET = 'M0 170 L78 92 L112 116 L176 26 L236 98 L262 80 L350 170 Z';

export function Montagne({ score, ton }: { score: number | null; ton: keyof typeof REMPLI | null }) {
  // La montagne monte de 170 (le pied) à 26 (le sommet) : elle se remplit de la moyenne des piliers.
  const niveau = score === null ? null : 170 - Math.max(0, Math.min(1, score)) * 144;
  const libelle = score === null ? 'Ta montagne de préparation, qui se remplira semaine après semaine'
    : `Ta montagne de préparation, remplie ${score >= 0.85 ? 'presque jusqu’au sommet' : score >= 0.65 ? 'aux deux tiers' : 'à moitié ou moins'}`;
  return (
    <svg viewBox="0 0 350 170" className="block w-full h-auto" role="img" aria-label={libelle}>
      <defs><clipPath id="cts-montagne"><path d={SOMMET} /></clipPath></defs>
      <path d={SOMMET} fill="rgba(255,255,255,0.07)" />
      {niveau !== null && ton && (
        <rect x="0" y={niveau} width="350" height={170 - niveau} fill={REMPLI[ton]} clipPath="url(#cts-montagne)" />
      )}
      <path d={SOMMET} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinejoin="round" />
      {niveau !== null && <line x1="0" y1={niveau} x2="350" y2={niveau} stroke="#8FD1C3" strokeWidth={1} strokeDasharray="3 4" />}
      <line x1="176" y1="26" x2="176" y2="6" stroke="#FFFFFF" strokeWidth={1.5} />
      <path d="M176 6 L192 11 L176 16 Z" fill="#8FD1C3" />
    </svg>
  );
}

// Un compte à rebours en « J- » jusqu'à l'objectif, sans « semaine x sur N », pour tous, plans achetés compris
// (décisions coach du 19/10/2026 : « on part de l'objectif et on revient jusqu'au jour J »).
export function CarteObjectif({ plan, restants, jauge, etape, href }: {
  plan: Plan; restants: number; jauge: Jauge; etape: 'avant' | 'pendant' | 'apres'; href: string;
}) {
  return (
    <CarteSombre className="space-y-3.5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <Surtitre ton="clair" as="div">Ton objectif</Surtitre>
          <h2 className="mt-1.5 text-[1.625rem] font-extrabold leading-tight">{plan.course.nom}</h2>
          <p className="mt-1.5 text-[0.8125rem] text-[#D6D5E6]">{dateLongue(plan.course.date)} · {plan.course.format_clair}</p>
        </div>
        {restants > 0 && (
          <div className="shrink-0 text-center bg-white/10 rounded-xl px-3 py-2.5">
            <div className="text-[1.375rem] font-extrabold leading-none">J-{restants}</div>
          </div>
        )}
      </div>
      <Montagne score={jauge.score} ton={jauge.verdict?.ton ?? null} />
      {etape === 'avant' ? (
        <p className="text-[0.9375rem] font-bold">{plan.couverture.debut}</p>
      ) : etape === 'apres' ? (
        <p className="text-[0.9375rem] font-bold">Ta course est derrière toi : bravo pour le chemin.</p>
      ) : (
        <div className="flex items-center gap-2">
          {jauge.verdict && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REMPLI[jauge.verdict.ton] }} aria-hidden />}
          <span className="text-base font-bold">{jauge.verdict?.libelle ?? 'Ta préparation est lancée'}</span>
        </div>
      )}
      <Link href={href} className="inline-flex items-center min-h-11 px-4 rounded-full bg-white text-indigo text-[0.8125rem] font-bold">
        Voir ma préparation
      </Link>
    </CarteSombre>
  );
}

// ─── Les piliers (T4) ─────────────────────────────────────────────────────

export function Piliers({ jauge }: { jauge: Jauge }) {
  if (!jauge.piliers.length) return null;
  return (
    <Carte className="space-y-3.5">
      <Surtitre>Ta préparation, pilier par pilier</Surtitre>
      {jauge.piliers.map((p) => (
        <div key={p.cle} className="space-y-1.5">
          <div className="text-[0.8125rem] font-semibold text-indigo">{p.titre}</div>
          <div className="h-2 rounded bg-sand-dark" aria-hidden>
            <div className="h-2 rounded bg-teal" style={{ width: `${Math.round(p.valeur * 100)}%` }} />
          </div>
          <p className="text-xs text-[#5E5C78] leading-relaxed">{p.detail}</p>
        </div>
      ))}
    </Carte>
  );
}

// ─── Les courses de préparation (O2, PO3) ─────────────────────────────────

export function CoursesPreparation({ courses, ajout }: { courses: CourseSecondaire[]; ajout: string | null }) {
  if (!courses.length && !ajout) return null;
  return (
    <Carte className="space-y-3">
      <Surtitre>Tes courses de préparation</Surtitre>
      {courses.map((c) => (
        <div key={`${c.date}-${c.nom}`} className="flex items-center gap-3">
          <PastilleDate iso={c.date} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-indigo">{c.nom}</span>
            <span className="block text-xs text-[#5E5C78]">
              {c.distance_km} km{c.dplus_m ? ` · ${c.dplus_m} m D+` : ''}{c.chrono ? ` · objectif ${c.chrono}` : ''}
            </span>
          </span>
        </div>
      ))}
      {!courses.length && (
        <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
          Une course avant ton objectif ? Ajoute-la : les jours autour d’elle s’ajustent, sans toucher à la suite de ton plan.
        </p>
      )}
      {ajout && (
        <Link href={ajout} className="flex items-center justify-center min-h-11 rounded-xl border-[1.5px] border-dashed border-teal/45 text-[0.8125rem] font-bold text-teal">
          + Ajouter une course
        </Link>
      )}
    </Carte>
  );
}

// ─── Cette semaine ────────────────────────────────────────────────────────

const jourCourt = (iso: string | null, jour: string) => {
  if (!iso) return jour.slice(0, 3);
  const d = new Date(`${iso}T12:00:00Z`);
  const j = d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' });
  return `${j.charAt(0).toUpperCase()}${j.slice(1).replace('.', '')}. ${d.getUTCDate()}`;
};
const couleurDuJour = (j: Jour) => j.couleur ?? FAMILLES[j.famille]?.filet ?? '#B9C7C3';

// nolio : la semaine telle qu'elle est dans Nolio, retouches du coach comprises (tableauDuPlan.semaineDansNolio) ; sans
// elle, la semaine écrite par le moteur.
export function CetteSemaine({ semaine, ligne, questionnaire, nolio = null }: {
  semaine: Semaine | null; ligne: LigneTrame | null; questionnaire: boolean; nolio?: SeanceNolio[] | null;
}) {
  const jours = (semaine?.jours ?? []).filter((j) => j.famille !== 'repos' && j.seance);
  const dimanche = semaine?.jours.find((j) => j.jour.toLowerCase().startsWith('dim'));
  if (!nolio && !jours.length && !ligne) return null;
  const quiz = questionnaire && dimanche && (
    <li className="grid grid-cols-[52px_6px_1fr] gap-x-2.5 items-center min-h-11">
      <span className="text-xs font-semibold text-[#5E5C78] whitespace-nowrap">{jourCourt(dimanche.date_iso, dimanche.jour)}</span>
      <span className="w-1.5 h-7 rounded-full bg-[#B7B6C8]" aria-hidden />
      <span className="text-[0.8125rem] text-[#5E5C78]">Questionnaire « Ta semaine prochaine » à 8 h</span>
    </li>
  );
  return (
    <Carte className="space-y-1">
      <div className="flex justify-between items-baseline gap-3 mb-2">
        <Surtitre>Cette semaine</Surtitre>
        {ligne && <span className="text-xs font-semibold" style={{ color: BANNIERE[ligne.type] ?? '#4F6F69' }}>{ligne.type}</span>}
      </div>
      {nolio ? (
        <ul>
          {nolio.length === 0 && <li className="min-h-11 flex items-center text-sm text-[#5E5C78] border-b border-indigo/[0.06]">Rien de prévu dans Nolio cette semaine.</li>}
          {nolio.map((x) => (
            <li key={x.id} className="grid grid-cols-[52px_6px_1fr] gap-x-2.5 items-center min-h-11 border-b border-indigo/[0.06]">
              <span className="text-xs font-semibold text-[#5E5C78] whitespace-nowrap">{jourCourt(x.date, '')}</span>
              <span className="w-1.5 h-7 rounded-full" style={{ backgroundColor: x.couleur ?? '#B9C7C3' }} aria-hidden />
              <span className="text-sm font-semibold text-indigo">
                {x.nom}{x.minutes !== null && <span className="font-normal text-[#5E5C78]"> · {enHeures(x.minutes)}</span>}
              </span>
            </li>
          ))}
          {quiz}
        </ul>
      ) : jours.length > 0 ? (
        <ul>
          {jours.map((j) => (
            <li key={j.id} className="grid grid-cols-[52px_6px_1fr] gap-x-2.5 items-center min-h-11 border-b border-indigo/[0.06]">
              <span className="text-xs font-semibold text-[#5E5C78] whitespace-nowrap">{jourCourt(j.date_iso, j.jour)}</span>
              <span className="w-1.5 h-7 rounded-full" style={{ backgroundColor: couleurDuJour(j) }} aria-hidden />
              <span className="text-sm font-semibold text-indigo">
                {j.seance}{j.duree && <span className="font-normal text-[#5E5C78]"> · {j.duree}</span>}
              </span>
            </li>
          ))}
          {quiz}
        </ul>
      ) : ligne && (
        <div className="space-y-1">
          <p className="text-sm text-indigo">{enHeures(Math.round(ligne.volume_h * 60))} de volume prévu{ligne.week_end_choc ? ' · week-end choc' : ''}</p>
          {ligne.seances_cles.length > 0 && (
            <ul className="text-sm text-indigo space-y-0.5">
              {ligne.seances_cles.map((c) => <li key={`${c.jour}-${c.seance}`}><span className="text-[#5E5C78]">{c.jour} ·</span> {c.seance}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="mt-2.5 p-3 rounded-xl bg-sand flex items-center justify-between gap-3">
        <span className="text-xs text-[#4A4866]">Le détail de chaque séance est dans Nolio.</span>
        <a href={NOLIO} target="_blank" rel="noopener" className="shrink-0 inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Ouvrir Nolio ›</a>
      </div>
    </Carte>
  );
}

// ─── La fiche du moment ───────────────────────────────────────────────────

export function FicheDuMoment({ fiche, avenir, ctx }: { fiche: Fiche; avenir: boolean; ctx: Contexte }) {
  const href = fiche.cle === 'course' ? lien('/app/plan/course', ctx) : lien(`/app/bibliotheque/${fiche.url ? slugFiche(fiche.url) : fiche.cle}`, ctx);
  return (
    <Carte className="space-y-2">
      <Surtitre ton="ocre">{avenir ? 'Bientôt, à lire' : 'La fiche du moment'}</Surtitre>
      <p className="text-[1.0625rem] font-bold text-indigo leading-snug">{fiche.titre}</p>
      <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">{fiche.pourquoi}</p>
      <Link href={href} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-[#8A5E10]">Lire la fiche ›</Link>
    </Carte>
  );
}

// ─── Mes données : la charge (AP3) ────────────────────────────────────────

const L = 326;

// La charge de chaque semaine écoulée (RPE de séance × durée, Foster), et sa moyenne sur 4 semaines ; sans prévu à
// côté (décision coach du 19/10/2026 : calculé autrement, la comparaison serait biaisée).
// Une semaine se dit par son lundi, pour tous (décision coach du 19/10/2026) ; par son numéro seulement sans date.
const etiquette = (numero: string, lundi: string | undefined) => (lundi ? jourMois(lundi) : numero);
const laSemaine = (numero: string, lundi: string | undefined) =>
  lundi ? `la semaine du ${jourMois(lundi)}` : `la semaine ${numero.replace('S', '')}`;

export function GraphiqueCharge({ realises }: { realises: Realise[] }) {
  const semaines = realises.filter((r) => r.rpe_lu && r.charge_faite > 0).slice(-10);
  if (semaines.length < 2) return null;
  const moyenne = (i: number) => {
    const avant = semaines.slice(Math.max(0, i - 3), i + 1);
    return avant.length === 4 ? avant.reduce((a, r) => a + r.charge_faite, 0) / 4 : null;
  };
  const pic = Math.max(...semaines.map((r) => r.charge_faite)) * 1.15;
  const bas = 140;
  const y = (v: number) => bas - (v / pic) * 130;
  const pas = (L - 30) / semaines.length;
  const derniere = semaines[semaines.length - 1];
  const moyDerniere = moyenne(semaines.length - 1);
  const ligne = semaines.map((_, i) => moyenne(i)).map((m, i) => (m === null ? null : `${30 + i * pas + pas / 2},${y(m)}`)).filter(Boolean);
  const graduations = [0.33, 0.66, 1].map((k) => Math.round((pic * k) / 100) * 100);
  return (
    <Carte className="space-y-2.5">
      <Surtitre>Ta charge d’entraînement</Surtitre>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[1.625rem] font-extrabold text-indigo">{Math.round(derniere.charge_faite).toLocaleString('fr-FR')}</span>
        <span className="text-xs text-[#5E5C78]">
          {laSemaine(derniere.numero, derniere.lundi)}{moyDerniere !== null ? ` · moyenne sur 4 semaines : ${Math.round(moyDerniere).toLocaleString('fr-FR')}` : ''}
        </span>
      </div>
      <svg viewBox={`0 0 ${L} 160`} className="block w-full h-auto" role="img" aria-label="Ta charge par semaine, avec ta moyenne sur quatre semaines">
        {graduations.map((g) => (
          <g key={g}>
            <line x1="30" y1={y(g)} x2={L} y2={y(g)} stroke="rgba(47,45,78,0.08)" />
            <text x="0" y={y(g) + 3} fontSize="9" fill="#5E5C78">{g.toLocaleString('fr-FR')}</text>
          </g>
        ))}
        <line x1="30" y1={bas} x2={L} y2={bas} stroke="rgba(47,45,78,0.25)" />
        {semaines.map((r, i) => (
          <g key={r.numero}>
            <title>{`${r.numero} : ${Math.round(r.charge_faite)}`}</title>
            <rect x={30 + i * pas + pas * 0.22} y={y(r.charge_faite)} width={pas * 0.56} height={bas - y(r.charge_faite)} rx="3" fill="#0C6E5F" />
            <text x={30 + i * pas + pas / 2} y="154" fontSize="9" fill="#5E5C78" textAnchor="middle">{etiquette(r.numero, r.lundi)}</text>
          </g>
        ))}
        {ligne.length >= 2 && <polyline points={ligne.join(' ')} fill="none" stroke="#2F2D4E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      </svg>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.72rem] text-[#4A4866]">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal" />ta charge (RPE × durée)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-0.5 bg-indigo" />moyenne sur 4 semaines</span>
      </div>
    </Carte>
  );
}

// ─── Mes données : le volume (T10, en durées) ─────────────────────────────

export function GraphiqueVolume({ barres }: { barres: Barre[] }) {
  if (!barres.length) return null;
  const H = 140;
  const BAS = 120;
  const pas = (L - 30) / barres.length;
  const pic = Math.max(60, ...barres.map((b) => Math.max(b.prevue, b.faite ?? 0))) * 1.1;
  const h = (v: number) => (v / pic) * (BAS - 10);
  const passee = [...barres].reverse().find((b) => b.moment === 'passee' && b.faite !== null);
  const heures = Math.ceil(pic / 60);
  const graduations = [Math.ceil(heures / 3), Math.ceil((2 * heures) / 3), heures].filter((g, i, t) => g > 0 && t.indexOf(g) === i);
  return (
    <Carte className="space-y-2.5">
      <Surtitre>Ton volume de course</Surtitre>
      {passee && (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[1.625rem] font-extrabold text-indigo">{enHeures(passee.faite ?? 0)}</span>
          <span className="text-xs text-[#5E5C78]">{laSemaine(passee.numero, passee.lundi)}, sur {enHeures(passee.prevue)} prévues</span>
        </div>
      )}
      <svg viewBox={`0 0 ${L} ${H}`} className="block w-full h-auto" role="img" aria-label="Tes heures de course par semaine, faites à côté des prévues">
        {graduations.map((g) => (
          <g key={g}>
            <line x1="30" y1={BAS - h(g * 60)} x2={L} y2={BAS - h(g * 60)} stroke="rgba(47,45,78,0.08)" />
            <text x="4" y={BAS - h(g * 60) + 3} fontSize="9" fill="#5E5C78">{g} h</text>
          </g>
        ))}
        <line x1="30" y1={BAS} x2={L} y2={BAS} stroke="rgba(47,45,78,0.25)" />
        {barres.map((b, i) => {
          const x = 30 + i * pas;
          const avenir = b.moment !== 'passee';
          return (
            <g key={b.numero}>
              <title>{`${b.numero} : ${enHeures(b.prevue)} prévues${b.faite !== null ? `, ${enHeures(b.faite)} faites` : ''}`}</title>
              <rect x={x + pas * 0.12} y={BAS - h(b.prevue)} width={pas * 0.76} height={h(b.prevue)} rx="4" fill="none"
                stroke="#9C9AB3" strokeWidth={1.5} strokeDasharray={avenir ? '3 2' : undefined} />
              {b.faite !== null && <rect x={x + pas * 0.24} y={BAS - h(b.faite)} width={pas * 0.52} height={h(b.faite)} rx="3" fill="#0C6E5F" />}
              {(barres.length <= 9 || i % 2 === 0 || b.moment === 'encours') && (
                <text x={x + pas / 2} y={BAS + 14} fontSize="9" fontWeight={b.moment === 'encours' ? 700 : 600}
                  fill={b.moment === 'encours' ? '#2F2D4E' : '#5E5C78'} textAnchor="middle">{etiquette(b.numero, b.lundi)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.72rem] text-[#4A4866]">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal" />fait</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border-[1.5px] border-[#9C9AB3]" />prévu</span>
      </div>
    </Carte>
  );
}

// ─── Mes données : le Hooper du dimanche (T10) ────────────────────────────

export function GraphiqueHooper({ points }: { points: PointHooper[] }) {
  const valeurs = points.filter((p) => p.valeur !== null);
  if (valeurs.length < 2) return null;
  const BAS = 120;
  const marge = 10;
  const pas = (L - 30 - 2 * marge) / Math.max(1, points.length - 1);
  const x = (i: number) => 30 + marge + i * pas;
  const haut = Math.max(...points.flatMap((p) => [p.valeur ?? 0, (p.zone ?? 0) + ECART_ZONE_HOOPER])) + 2;
  const bas = Math.max(0, Math.min(...points.flatMap((p) => (p.valeur !== null ? [p.valeur] : []).concat(p.zone !== null ? [p.zone - ECART_ZONE_HOOPER] : []))) - 2);
  const y = (v: number) => 10 + ((haut - v) / (haut - bas)) * (BAS - 20);
  const zone = points.map((p, i) => (p.zone !== null ? { x: x(i), hautZ: y(p.zone + ECART_ZONE_HOOPER), basZ: y(p.zone - ECART_ZONE_HOOPER) } : null))
    .filter((z): z is { x: number; hautZ: number; basZ: number } => z !== null);
  const ligne = points.map((p, i) => (p.valeur !== null ? `${x(i)},${y(p.valeur)}` : null)).filter(Boolean).join(' ');
  const dernier = [...points].reverse().find((p) => p.valeur !== null) as PointHooper;
  const auDessus = (p: PointHooper) => p.zone !== null && p.valeur !== null && p.valeur > p.zone + ECART_ZONE_HOOPER;
  return (
    <Carte className="space-y-2.5">
      <Surtitre>Ton Hooper du dimanche</Surtitre>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[1.625rem] font-extrabold text-indigo">{dernier.valeur}</span>
        <span className="text-xs text-[#5E5C78]">
          {laSemaine(dernier.numero, dernier.lundi)}{dernier.zone !== null ? (auDessus(dernier) ? ' · au-dessus de ta zone habituelle' : ' · dans ta zone habituelle') : ''}
        </span>
      </div>
      <svg viewBox={`0 0 ${L} ${BAS + 18}`} className="block w-full h-auto" role="img" aria-label="Ton Hooper chaque dimanche, et ta zone habituelle">
        {zone.length >= 2 && (
          <polygon fill="#E1EFEA" points={[...zone.map((z) => `${z.x},${z.hautZ}`), ...[...zone].reverse().map((z) => `${z.x},${z.basZ}`)].join(' ')} />
        )}
        <line x1="30" y1={BAS} x2={L} y2={BAS} stroke="rgba(47,45,78,0.25)" />
        <text x="0" y="16" fontSize="9" fill="#5E5C78">fatigué</text>
        <text x="0" y={BAS - 4} fontSize="9" fill="#5E5C78">frais</text>
        <polyline fill="none" stroke="#2F2D4E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={ligne} />
        {points.map((p, i) => p.valeur !== null && (
          <circle key={p.numero} cx={x(i)} cy={y(p.valeur)} r={auDessus(p) ? 5 : 3.5} fill={auDessus(p) ? '#C2410C' : '#2F2D4E'}>
            <title>{`${p.numero} : ${p.valeur}`}</title>
          </circle>
        ))}
        {points.map((p, i) => (i % 2 === 0 || i === points.length - 1) && (
          <text key={`t-${p.numero}`} x={x(i)} y={BAS + 14} fontSize="9" fill="#5E5C78" textAnchor="middle">{etiquette(p.numero, p.lundi)}</text>
        ))}
      </svg>
      <p className={clsx('text-xs leading-relaxed text-[#4A4866]')}>
        La bande verte : ta zone habituelle (ta moyenne des 4 semaines d’avant). Plus le Hooper est haut, plus tu es
        fatigué. Un point orange : au-dessus de ta zone, ta semaine suivante a pu être allégée.
      </p>
    </Carte>
  );
}
