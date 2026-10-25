import Link from 'next/link';
import clsx from 'clsx';
import type { LigneTrame, Realise } from '@/lib/app/ecriture';
import { BANNIERE, FAMILLES } from '@/lib/app/charte';
import { lien, type Contexte } from '@/lib/app/contexte';
import { dateLongue, jourMois, slugFiche, type Jour, type Plan, type Semaine } from '@/lib/app/plan';
import {
  courseDeLaSemaine, ECART_ZONE_HOOPER, enHeures, type Barre, type CourseDuGraphique, type Fiche, type Jauge, type PointHooper,
} from '@/lib/app/tableau';
import type { CourseSecondaire, EtatNolio, SeanceNolio } from '@/lib/app/tableauDuPlan';
import { Carte, CarteSombre, PastilleDate, Surtitre } from './Ui';

// Les pièces de l'accueil et de « Mes données » (CTS_NOLIO_CADRAGE.md, T1, T4, T10, AP1 à AP3 ; maquettes validées
// par le coach le 19/10/2026) : l'objectif et sa montagne, les piliers, les courses de préparation, la semaine, la
// fiche du moment ; la charge, le volume et le Hooper. Jamais le mot « chance » (J4) ; la montagne sans pourcentage.

const NOLIO = 'https://www.nolio.io/';

// ─── Nolio, tant que l'athlète n'y est pas ──────────────────────────────────

// Les deux réponses de Nolio à l'invitation (décision coach du 20/10/2026) : un compte existant l'accepte (« invite »),
// une adresse inconnue reçoit un compte créé, déjà dans l'équipe (« actif » d'emblée).
const ARRIVE = 'Nolio t’écrit dans quelques minutes : une invitation à rejoindre l’équipe CTS si tu as déjà un compte '
  + 'Nolio, sinon les identifiants de ton nouveau compte. Tes séances s’y installent aussitôt.';
export function CarteNolio({ etat }: { etat: EtatNolio }) {
  if (!etat || etat === 'actif' || etat === 'coache') return null;
  const textes: Record<'a_inviter' | 'en_cours' | 'invite' | 'refuse' | 'sorti' | 'coaching', { titre: string; texte: string; bouton: boolean }> = {
    a_inviter: { titre: 'Ton accès Nolio arrive', bouton: false, texte: ARRIVE },
    en_cours: { titre: 'Ton accès Nolio arrive', bouton: false, texte: ARRIVE },
    invite: { titre: 'Accepte ton invitation Nolio', bouton: false,
      texte: 'Nolio t’a envoyé par e-mail une invitation à rejoindre l’équipe CTS (pense à regarder dans tes indésirables). Dès que tu l’acceptes, tes séances s’installent dans ton calendrier Nolio.' },
    refuse: { titre: 'Ton invitation Nolio n’a pas abouti', bouton: false,
      texte: 'Réponds simplement à ton e-mail de bienvenue : nous t’en renvoyons une.' },
    sorti: { titre: 'Ta préparation est terminée dans Nolio', bouton: true, texte: 'Ton compte Nolio et tes séances restent à toi.' },
    // Un plan acheté, l'athlète en coaching (décision coach du 23/10/2026).
    coaching: { titre: 'Ce plan ne s’écrit pas dans Nolio', bouton: false,
      texte: 'Tu es en coaching : ton coach écrit ta préparation. Ce plan reste lisible ici ; s’il doit reprendre, ton coach le relance.' },
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
// Un objectif sur route (décision coach du 25/10/2026) : à la place de la montagne, la route qui serpente du départ
// (à gauche) jusqu'à la ligne d'arrivée et son fanion ; le même remplissage, dans le sens de la course.
const ROUTE_X0 = 14;
const ROUTE_X1 = 314;
const ROUTE_DEMI = 19;
// Le damier de la ligne d'arrivée : 6 cases sur la largeur de la route, 2 en profondeur.
const DAMIER = (ROUTE_DEMI * 2) / 6;
// Une ondulation et demie, à plat aux deux bouts (la ligne d'arrivée tombe droite) ; les bords à la normale de l'axe,
// pour une route d'égale largeur.
const ROUTE_AXE = Array.from({ length: 81 }, (_, i) => {
  const u = i / 80;
  const pente = (-26 * 3 * Math.PI * Math.sin(3 * Math.PI * u)) / (ROUTE_X1 - ROUTE_X0);
  const n = Math.hypot(1, pente);
  return { x: ROUTE_X0 + u * (ROUTE_X1 - ROUTE_X0), y: 98 + 26 * Math.cos(3 * Math.PI * u), nx: -pente / n, ny: 1 / n };
});
const ROUTE = `M${ROUTE_AXE.map((p) => `${(p.x - p.nx * ROUTE_DEMI).toFixed(1)} ${(p.y - p.ny * ROUTE_DEMI).toFixed(1)}`).join(' L')} L${[...ROUTE_AXE]
  .reverse().map((p) => `${(p.x + p.nx * ROUTE_DEMI).toFixed(1)} ${(p.y + p.ny * ROUTE_DEMI).toFixed(1)}`).join(' L')} Z`;
// La ligne médiane : un tiret toutes les cinq étapes de l'axe.
const ROUTE_TIRETS = ROUTE_AXE.slice(0, -8).filter((_, i) => i % 5 === 0).map((p, k) => ({ a: p, b: ROUTE_AXE[k * 5 + 3] }));
export const estRoute = (format: string | null | undefined) => /^R(10|21|42)$/.test(String(format ?? ''));

export function Montagne({ score, ton, route = false }: { score: number | null; ton: keyof typeof REMPLI | null; route?: boolean }) {
  if (route) return <Route score={score} ton={ton} />;
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

function Route({ score, ton }: { score: number | null; ton: keyof typeof REMPLI | null }) {
  const part = score === null ? null : Math.max(0, Math.min(1, score));
  const niveau = part === null ? null : ROUTE_X0 + part * (ROUTE_X1 - ROUTE_X0);
  // Le repère s'arrête avant la ligne d'arrivée, pour ne pas couvrir le damier.
  const x = niveau === null ? null : Math.min(niveau, ROUTE_X1 - DAMIER * 2 - 6);
  const repere = x === null ? null : ROUTE_AXE[Math.round(((x - ROUTE_X0) / (ROUTE_X1 - ROUTE_X0)) * (ROUTE_AXE.length - 1))];
  const fin = ROUTE_AXE[ROUTE_AXE.length - 1];
  const libelle = part === null ? 'Ta route de préparation, qui se remplira semaine après semaine'
    : `Ta route de préparation, remplie ${part >= 0.85 ? 'presque jusqu’à l’arrivée' : part >= 0.65 ? 'aux deux tiers' : 'à moitié ou moins'}`;
  return (
    <svg viewBox="0 0 350 170" className="block w-full h-auto" role="img" aria-label={libelle}>
      <defs>
        <clipPath id="cts-route"><path d={ROUTE} /></clipPath>
        <pattern id="cts-damier" patternUnits="userSpaceOnUse" x={fin.x} y={fin.y - ROUTE_DEMI} width={DAMIER * 2} height={DAMIER * 2}>
          <rect width={DAMIER * 2} height={DAMIER * 2} fill="#2F2D4E" />
          <rect width={DAMIER} height={DAMIER} fill="#FFFFFF" />
          <rect x={DAMIER} y={DAMIER} width={DAMIER} height={DAMIER} fill="#FFFFFF" />
        </pattern>
        <pattern id="cts-drapeau" patternUnits="userSpaceOnUse" x={fin.x + 6} y={fin.y - ROUTE_DEMI - 45} width="10" height="10">
          <rect width="10" height="10" fill="#2F2D4E" />
          <rect width="5" height="5" fill="#FFFFFF" />
          <rect x="5" y="5" width="5" height="5" fill="#FFFFFF" />
        </pattern>
      </defs>
      <path d={ROUTE} fill="rgba(255,255,255,0.07)" />
      {niveau !== null && ton && <rect x="0" y="0" width={niveau} height="170" fill={REMPLI[ton]} clipPath="url(#cts-route)" />}
      <path d={ROUTE} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinejoin="round" />
      {ROUTE_TIRETS.map(({ a, b }) => (
        <line key={a.x} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} strokeLinecap="round" />
      ))}
      {/* La ligne d'arrivée : un damier de 6 cases sur la largeur de la route, calé sur ses bords. */}
      <rect x={fin.x - DAMIER * 2} y={fin.y - ROUTE_DEMI} width={DAMIER * 2} height={ROUTE_DEMI * 2} fill="url(#cts-damier)" clipPath="url(#cts-route)" />
      <line x1={fin.x - DAMIER * 2} y1={fin.y - ROUTE_DEMI} x2={fin.x - DAMIER * 2} y2={fin.y + ROUTE_DEMI} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
      {/* Le drapeau à damier, planté au bord de la route. */}
      <line x1={fin.x + 5} y1={fin.y - ROUTE_DEMI + 2} x2={fin.x + 5} y2={fin.y - ROUTE_DEMI - 44} stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={fin.x + 5} cy={fin.y - ROUTE_DEMI - 45} r={1.8} fill="#FFFFFF" />
      <path d={`M${fin.x + 6} ${fin.y - ROUTE_DEMI - 43} C${fin.x + 12} ${fin.y - ROUTE_DEMI - 47} ${fin.x + 19} ${fin.y - ROUTE_DEMI - 39} ${fin.x + 27} ${fin.y - ROUTE_DEMI - 43}`
        + ` L${fin.x + 27} ${fin.y - ROUTE_DEMI - 28} C${fin.x + 19} ${fin.y - ROUTE_DEMI - 24} ${fin.x + 12} ${fin.y - ROUTE_DEMI - 32} ${fin.x + 6} ${fin.y - ROUTE_DEMI - 28} Z`}
        fill="url(#cts-drapeau)" stroke="#FFFFFF" strokeWidth={0.8} strokeLinejoin="round" />
      {repere && <circle cx={repere.x} cy={repere.y} r={4.5} fill="#FFFFFF" stroke="#8FD1C3" strokeWidth={2} />}
    </svg>
  );
}

// Un compte à rebours en « J- » jusqu'à l'objectif, sans « semaine x sur N », pour tous, plans achetés compris
// (décisions coach du 19/10/2026 : « on part de l'objectif et on revient jusqu'au jour J »).
// surtitre : « Ton prochain objectif majeur » pour un coaché (décision coach du 20/10/2026 : son app le suit d'un
// objectif à l'autre), « Ton objectif » pour un acheteur.
// jauge : null pour un coaché que son coach programme à la main (décision coach du 20/10/2026) : ni montagne ni verdict,
// qui suivent la trame du moteur ; le compte à rebours et sa course.
// coache : pour un coaché, ni le début calendaire du plan ni la semaine rejointe (décision coach du 22/10/2026 : ses
// objectifs s'enchaînent).
export function CarteObjectif({ plan, restants, jauge, etape, href, surtitre = 'Ton objectif', coache = false }: {
  plan: Plan; restants: number; jauge: Jauge | null; etape: 'avant' | 'pendant' | 'apres'; href: string; surtitre?: string;
  coache?: boolean;
}) {
  return (
    <CarteSombre className="space-y-3.5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <Surtitre ton="clair" as="div">{surtitre}</Surtitre>
          <h2 className="mt-1.5 text-[1.625rem] font-extrabold leading-tight">{plan.course.nom}</h2>
          <p className="mt-1.5 text-[0.8125rem] text-[#D6D5E6]">{dateLongue(plan.course.date)} · {plan.course.format_clair}</p>
        </div>
        {restants > 0 && (
          <div className="shrink-0 text-center bg-white/10 rounded-xl px-3 py-2.5">
            <div className="text-[1.375rem] font-extrabold leading-none">J-{restants}</div>
          </div>
        )}
      </div>
      {jauge && <Montagne score={jauge.score} ton={jauge.verdict?.ton ?? null} route={estRoute(plan.course.format)} />}
      {!jauge ? (etape === 'apres' && <p className="text-[0.9375rem] font-bold">Ta course est derrière toi : bravo pour le chemin.</p>)
      : etape === 'avant' ? (
        <p className="text-[0.9375rem] font-bold">{coache ? 'Tes séances arrivent chaque dimanche dans Nolio.' : plan.couverture.debut}</p>
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
          Une course avant ton objectif ? Ajoute-la : les jours autour d’elle s’ajustent, sans toucher à la suite de ta préparation.
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

// ─── Ta semaine ───────────────────────────────────────────────────────────

const jourCourt = (iso: string | null, jour: string) => {
  if (!iso) return jour.slice(0, 3);
  const d = new Date(`${iso}T12:00:00Z`);
  const j = d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' });
  return `${j.charAt(0).toUpperCase()}${j.slice(1).replace('.', '')}. ${d.getUTCDate()}`;
};
const couleurDuJour = (j: Jour) => j.couleur ?? FAMILLES[j.famille]?.filet ?? '#B9C7C3';

// nolio : la semaine telle qu'elle est dans Nolio, retouches du coach comprises (tableauDuPlan.semaineDansNolio) ; sans
// elle, la semaine écrite par le moteur. Tant qu'elle n'est pas dans Nolio (décision coach du 20/10/2026) : arrivee dit
// quand elle y arrive, et les jours d'avant depuis ne s'y poseront pas (un départ en milieu de semaine). Toujours la
// semaine en cours, rien d'autre (décision coach du 24/10/2026) : avant le départ, ce qui est dans Nolio cette semaine ;
// sans rien à y montrer, debut dit quand la préparation commence.
const ARRIVEE = {
  invitation: 'Tes séances arrivent dans Nolio dès que tu as rejoint l’équipe CTS.',
  bientot: 'Tes séances de la semaine arrivent bientôt dans Nolio.',
} as const;
export function CetteSemaine({ semaine, ligne, questionnaire, nolio = null, arrivee = null, depuis = null, debut = null }: {
  semaine: Semaine | null; ligne: LigneTrame | null; questionnaire: boolean; nolio?: SeanceNolio[] | null;
  arrivee?: keyof typeof ARRIVEE | null; depuis?: string | null; debut?: string | null;
}) {
  const jours = (semaine?.jours ?? []).filter((j) => j.famille !== 'repos' && j.seance && !(depuis && j.date_iso && j.date_iso < depuis));
  // Le questionnaire du samedi (décision coach du 24/10/2026), à sa place parmi les séances : après celles du samedi.
  const samedi = semaine?.jours.find((j) => j.jour.toLowerCase().startsWith('sam'));
  const apresSamedi = (date: string | null | undefined, jour: string) =>
    samedi?.date_iso && date ? date > samedi.date_iso : jour.toLowerCase().startsWith('dim');
  if (!nolio && !jours.length && !ligne && !debut) return null;
  const commence = debut && <p className="text-sm text-indigo">Ta préparation commence le {dateLongue(debut)}.</p>;
  const quiz = questionnaire && samedi && (
    <li className="grid grid-cols-[52px_6px_1fr] gap-x-2.5 items-center min-h-11 border-b border-indigo/[0.06]">
      <span className="text-xs font-semibold text-[#5E5C78] whitespace-nowrap">{jourCourt(samedi.date_iso, samedi.jour)}</span>
      <span className="w-1.5 h-7 rounded-full bg-[#B7B6C8]" aria-hidden />
      <span className="text-[0.8125rem] text-[#5E5C78]">Questionnaire « Ta semaine prochaine » à 8 h</span>
    </li>
  );
  const ligneNolio = (x: SeanceNolio) => (
    <li key={x.id} className="grid grid-cols-[52px_6px_1fr] gap-x-2.5 items-center min-h-11 border-b border-indigo/[0.06]">
      <span className="text-xs font-semibold text-[#5E5C78] whitespace-nowrap">{jourCourt(x.date, '')}</span>
      <span className="w-1.5 h-7 rounded-full" style={{ backgroundColor: x.couleur ?? '#B9C7C3' }} aria-hidden />
      <span className="text-sm font-semibold text-indigo">
        {x.nom}{x.minutes !== null && <span className="font-normal text-[#5E5C78]"> · {enHeures(x.minutes)}</span>}
      </span>
    </li>
  );
  const ligneJour = (j: Jour) => (
    <li key={j.id} className="grid grid-cols-[52px_6px_1fr] gap-x-2.5 items-center min-h-11 border-b border-indigo/[0.06]">
      <span className="text-xs font-semibold text-[#5E5C78] whitespace-nowrap">{jourCourt(j.date_iso, j.jour)}</span>
      <span className="w-1.5 h-7 rounded-full" style={{ backgroundColor: couleurDuJour(j) }} aria-hidden />
      <span className="text-sm font-semibold text-indigo">
        {j.seance}{j.duree && <span className="font-normal text-[#5E5C78]"> · {j.duree}</span>}
      </span>
    </li>
  );
  return (
    <Carte className="space-y-1">
      <div className="flex justify-between items-baseline gap-3 mb-2">
        <Surtitre>Ta semaine</Surtitre>
        {ligne && <span className="text-xs font-semibold" style={{ color: BANNIERE[ligne.type] ?? '#4F6F69' }}>{ligne.type}</span>}
      </div>
      {nolio ? (
        <ul>
          {nolio.length === 0 && <li className="min-h-11 flex items-center text-sm text-[#5E5C78] border-b border-indigo/[0.06]">Rien de prévu dans Nolio cette semaine.</li>}
          {nolio.filter((x) => !apresSamedi(x.date, '')).map(ligneNolio)}
          {quiz}
          {nolio.filter((x) => apresSamedi(x.date, '')).map(ligneNolio)}
          {nolio.length === 0 && commence && <li className="pt-2">{commence}</li>}
        </ul>
      ) : jours.length > 0 ? (
        <ul>
          {jours.filter((j) => !apresSamedi(j.date_iso, j.jour)).map(ligneJour)}
          {quiz}
          {jours.filter((j) => apresSamedi(j.date_iso, j.jour)).map(ligneJour)}
        </ul>
      ) : !ligne ? commence : (
        <div className="space-y-1">
          <p className="text-sm text-indigo">{enHeures(Math.round(ligne.volume_h * 60))} de volume prévu{ligne.week_end_choc ? ' · week-end choc' : ''}</p>
          {ligne.seances_cles.length > 0 && (
            <ul className="text-sm text-indigo space-y-0.5">
              {ligne.seances_cles.map((c) => <li key={`${c.jour}-${c.seance}`}><span className="text-[#5E5C78]">{c.jour} ·</span> {c.seance}</li>)}
            </ul>
          )}
        </div>
      )}
      {!nolio && !jours.length && !ligne ? null : nolio || !arrivee ? (
        <div className="mt-2.5 p-3 rounded-xl bg-sand flex items-center justify-between gap-3">
          <span className="text-xs text-[#4A4866]">Le détail de chaque séance est dans Nolio.</span>
          <a href={NOLIO} target="_blank" rel="noopener" className="shrink-0 inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Ouvrir Nolio ›</a>
        </div>
      ) : (
        <p className="mt-2.5 p-3 rounded-xl bg-sand text-xs text-[#4A4866] leading-relaxed">{ARRIVEE[arrivee]}</p>
      )}
    </Carte>
  );
}

// ─── Les fiches de la semaine ─────────────────────────────────────────────

export function FichesDeLaSemaine({ fiches, ctx }: { fiches: Fiche[]; ctx: Contexte }) {
  if (!fiches.length) return null;
  const href = (f: Fiche) => (f.cle === 'course' ? lien('/app/plan/course', ctx) : lien(`/app/bibliotheque/${f.url ? slugFiche(f.url) : f.cle}`, ctx));
  return (
    <Carte className="space-y-1">
      <Surtitre ton="ocre">{fiches.length > 1 ? 'Les fiches de la semaine' : 'La fiche de la semaine'}</Surtitre>
      <ul>
        {fiches.map((f) => (
          <li key={f.cle} className="border-b border-indigo/[0.06] last:border-b-0">
            <Link href={href(f)} className="block py-2.5">
              <span className="block text-[0.9375rem] font-bold text-indigo leading-snug">{f.titre}</span>
              <span className="block mt-0.5 text-[0.8125rem] text-[#4A4866] leading-relaxed">
                {f.pourquoi} <span className="font-bold text-[#8A5E10]">›</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
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

// Le repère d'une course (un objectif ou une course de préparation) sur un graphique : un petit drapeau, son nom au survol.
function Drapeau({ x, y, nom }: { x: number; y: number; nom: string }) {
  return (
    <g>
      <title>{nom}</title>
      <line x1={x} y1={y} x2={x} y2={y + 12} stroke="#2F2D4E" strokeWidth={1.2} />
      <path d={`M${x} ${y}h7l-2 3 2 3h-7z`} fill="#2BB39B" />
    </g>
  );
}

export function GraphiqueCharge({ realises, courses = [] }: { realises: Realise[]; courses?: CourseDuGraphique[] }) {
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
        {semaines.map((r, i) => {
          const course = courseDeLaSemaine(r.lundi, courses);
          return (
            <g key={r.lundi}>
              <title>{`${laSemaine(r.numero, r.lundi)} : ${Math.round(r.charge_faite)}`}</title>
              <rect x={30 + i * pas + pas * 0.22} y={y(r.charge_faite)} width={pas * 0.56} height={bas - y(r.charge_faite)} rx="3" fill="#0C6E5F" />
              <text x={30 + i * pas + pas / 2} y="154" fontSize="9" fill="#5E5C78" textAnchor="middle">{etiquette(r.numero, r.lundi)}</text>
              {course && <Drapeau x={30 + i * pas + pas / 2} y={Math.max(0, y(r.charge_faite) - 14)} nom={course} />}
            </g>
          );
        })}
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

// Le volume (retour du coach du 20/10/2026 : « pas très pro », le haut tronqué) : des graduations rondes qui tiennent
// dans le cadre, le prévu en fond clair et le fait en vert par-dessus, le futur en pointillé fin, la semaine en cours
// soulignée.
export function GraphiqueVolume({ barres }: { barres: Barre[] }) {
  if (!barres.length) return null;
  const H = 150;
  const HAUT = 12;
  const BAS = 126;
  const G = 34;
  const pas = (L - G) / barres.length;
  const max = Math.max(60, ...barres.map((b) => Math.max(b.prevue, b.faite ?? 0)));
  const pasH = max <= 180 ? 1 : max <= 360 ? 2 : max <= 720 ? 3 : 5;
  const sommet = Math.ceil(max / 60 / pasH) * pasH;
  const h = (min: number) => (min / (sommet * 60)) * (BAS - HAUT);
  const graduations = Array.from({ length: sommet / pasH }, (_, k) => (k + 1) * pasH);
  const passee = [...barres].reverse().find((b) => b.moment === 'passee' && b.faite !== null);
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
            <line x1={G} y1={BAS - h(g * 60)} x2={L} y2={BAS - h(g * 60)} stroke="rgba(47,45,78,0.07)" />
            <text x="2" y={BAS - h(g * 60) + 3} fontSize="9" fill="#8A88A3">{g} h</text>
          </g>
        ))}
        <line x1={G} y1={BAS} x2={L} y2={BAS} stroke="rgba(47,45,78,0.18)" />
        {barres.map((b, i) => {
          const x = G + i * pas;
          const w = Math.min(28, pas * 0.6);
          const x0 = x + (pas - w) / 2;
          const avenir = b.moment !== 'passee';
          return (
            <g key={b.lundi}>
              <title>{`${laSemaine(b.numero, b.lundi)} : ${enHeures(b.prevue)} prévues${b.faite !== null ? `, ${enHeures(b.faite)} faites` : ''}`}</title>
              {b.moment === 'encours' && <rect x={x + 1} y={HAUT - 6} width={pas - 2} height={BAS - HAUT + 6} rx="6" fill="rgba(12,110,95,0.06)" />}
              {avenir ? (
                <rect x={x0} y={BAS - h(b.prevue)} width={w} height={h(b.prevue)} rx="3" fill="none" stroke="#B9B8CC" strokeWidth={1} strokeDasharray="3 3" />
              ) : (
                <rect x={x0} y={BAS - h(b.prevue)} width={w} height={h(b.prevue)} rx="3" fill="#ECEBF3" />
              )}
              {b.faite !== null && <rect x={x0 + w * 0.2} y={BAS - h(b.faite)} width={w * 0.6} height={h(b.faite)} rx="2" fill="#0C6E5F" />}
              {b.course && <Drapeau x={x + pas / 2} y={Math.max(0, BAS - h(Math.max(b.prevue, b.faite ?? 0)) - 14)} nom={b.course} />}
              {(barres.length <= 9 || i % 2 === 0 || b.moment === 'encours') && (
                <text x={x + pas / 2} y={BAS + 15} fontSize="9" fontWeight={b.moment === 'encours' ? 700 : 500}
                  fill={b.moment === 'encours' ? '#2F2D4E' : '#8A88A3'} textAnchor="middle">{etiquette(b.numero, b.lundi)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.72rem] text-[#4A4866]">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal" />fait</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#ECEBF3]" />prévu</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-[#9C9AB3]" />à venir</span>
        {barres.some((b) => b.course) && (
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 10 14" className="w-2.5 h-3.5" aria-hidden><line x1="1" y1="1" x2="1" y2="13" stroke="#2F2D4E" strokeWidth="1.2" /><path d="M1 1h7l-2 3 2 3H1z" fill="#2BB39B" /></svg>
            une course
          </span>
        )}
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
          <circle key={p.lundi} cx={x(i)} cy={y(p.valeur)} r={auDessus(p) ? 5 : 3.5} fill={auDessus(p) ? '#C2410C' : '#2F2D4E'}>
            <title>{`${laSemaine(p.numero, p.lundi)} : ${p.valeur}`}</title>
          </circle>
        ))}
        {points.map((p, i) => p.course && <Drapeau key={`c-${p.lundi}`} x={x(i)} y={2} nom={p.course} />)}
        {points.map((p, i) => (i % 2 === 0 || i === points.length - 1) && (
          <text key={`t-${p.lundi}`} x={x(i)} y={BAS + 14} fontSize="9" fill="#5E5C78" textAnchor="middle">{etiquette(p.numero, p.lundi)}</text>
        ))}
      </svg>
      <p className={clsx('text-xs leading-relaxed text-[#4A4866]')}>
        La bande verte : ta zone habituelle (ta moyenne des 4 semaines d’avant). Plus le Hooper est haut, plus tu es
        fatigué. Un point orange : au-dessus de ta zone, ta semaine suivante a pu être allégée.
      </p>
    </Carte>
  );
}
