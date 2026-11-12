import Link from 'next/link';
import clsx from 'clsx';
import type { LigneTrame } from '@/lib/app/ecriture';
import { BANNIERE, FAMILLES } from '@/lib/app/charte';
import { lien, type Contexte } from '@/lib/app/contexte';
import { estSemaineDeWeekEndChoc, nomPourLAthlete, SEMAINE_DE_REPRISE } from '@/lib/app/nomsSeances';
import { motsDeLaSemaine } from '@/lib/app/motsDeLaSemaine';
import { ajouterJours, dateLongue, slugFiche, type Jour, type Plan, type Semaine } from '@/lib/app/plan';
import { calculDeLaMontee, enHeures, estRoute, libelleDeLaMontee, pourcentDeLaMontee, texteDeLaMontee, type Fiche, type Jauge,
  type Montee } from '@/lib/app/tableau';
import type { CourseSecondaire, EtatNolio, RaisonNolio, SeanceNolio } from '@/lib/app/tableauDuPlan';
import { BOUTON, Carte, CarteSombre, EcrisNous, LIEN, PastilleDate, Surtitre } from './Ui';

// Les pièces de l'accueil (CTS_NOLIO_CADRAGE.md, T1, T4, AP1, AP2 ; maquettes validées par le coach le 19/10/2026) :
// l'objectif et sa montagne, les piliers, les courses de préparation, la semaine, la fiche du moment. Jamais le mot
// « chance » (J4) ; sous la montagne, la part réalisée (13/11/2026). Les graphiques de « Mes données » sont dans
// components/app/Graphiques.tsx.
// C9 (audits du 05/11/2026) : aucun lien ne mène plus au site de Nolio (il ouvrait le navigateur, pas l'appli) ; aucune
// adresse documentée n'ouvre l'appli Nolio : l'app dit « dans ton appli Nolio », sans bouton.

// ─── Nolio, tant que l'athlète n'y est pas ──────────────────────────────────

// Les deux réponses de Nolio à l'invitation (décision coach du 20/10/2026) : un compte existant l'accepte (« invite »),
// une adresse inconnue reçoit un compte créé, déjà dans l'équipe (« actif » d'emblée).
const ARRIVE = 'Nolio t’écrit dans quelques minutes : une invitation à rejoindre l’équipe CTS si tu as déjà un compte '
  + 'Nolio, sinon les identifiants de ton nouveau compte. Ta première semaine s’y installe la veille de son début.';
// inviteLe : une préparation qui commence plus tard, invitée le lundi de la semaine qui précède son départ (décision coach
// du 04/11/2026 au soir, lib/app/invitation.ts) ; confirmer : ce jour-là, l'app lui demandera si sa charge a changé ;
// avantCourse : sorti de l'équipe avant sa course (B-PL-41), il peut la rejoindre.
// ecrire (Q5, décision coach du 05/11/2026 au soir) : la carte renvoie au lien vers CTS (« Écris-nous › »), à la place de
// « réponds simplement à ton e-mail de bienvenue ».
export function CarteNolio({ etat, inviteLe = null, confirmer = false, avantCourse = false }: {
  etat: EtatNolio; inviteLe?: string | null; confirmer?: boolean; avantCourse?: boolean;
}) {
  if (!etat || etat === 'actif' || etat === 'coache') return null;
  const textes: Record<'a_inviter' | 'en_cours' | 'invite' | 'refuse' | 'sorti' | 'arrete' | 'coaching', { titre: string; texte: string; ecrire?: boolean }> = {
    a_inviter: inviteLe
      ? { titre: 'Ton accès Nolio arrive une semaine avant ta préparation',
        texte: `Nolio t’écrira le ${dateLongue(inviteLe)} : une invitation à rejoindre l’équipe CTS si tu as déjà un compte Nolio, sinon les identifiants de ton nouveau compte. Ta première semaine s’y installe la veille de son début.${confirmer ? ' Ce jour-là, ton app te demande aussi si ce que tu cours a changé depuis ton achat.' : ''}` }
      : { titre: 'Ton accès Nolio arrive', texte: ARRIVE },
    en_cours: { titre: 'Ton accès Nolio arrive', texte: ARRIVE },
    invite: { titre: 'Accepte ton invitation Nolio',
      texte: 'Nolio t’a envoyé par e-mail une invitation à rejoindre l’équipe CTS (pense à regarder dans tes indésirables). Dès que tu l’acceptes, tes séances s’installent dans ton calendrier Nolio.' },
    // Q5 : Validé par le coach le 05/11/2026 (1A).
    refuse: { titre: 'Ton invitation Nolio n’a pas abouti', ecrire: true, texte: 'Écris-nous : nous t’en renvoyons une.' },
    sorti: avantCourse
      // Q5 : Validé par le coach le 05/11/2026 (1A).
      ? { titre: 'Tu as quitté l’équipe CTS dans Nolio', ecrire: true,
        texte: 'Tes séances ne t’arrivent plus. Pour rejoindre l’équipe, écris-nous : nous t’envoyons une nouvelle invitation.' }
      : { titre: 'Ta préparation est terminée dans Nolio', texte: 'Ton compte Nolio et tes séances restent à toi.' },
    // E3 (audits du 05/11/2026) : arrêtée par le coach après un remboursement. Validé par le coach le 05/11/2026 au soir.
    arrete: { titre: 'Ta préparation est arrêtée',
      texte: 'Elle a été arrêtée après ton remboursement : plus rien ne s’écrit dans ton Nolio. Ton compte Nolio et les séances déjà passées restent à toi.' },
    // Un plan acheté, l'athlète en coaching (décision coach du 23/10/2026).
    coaching: { titre: 'Ce plan ne s’écrit pas dans Nolio',
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
      {t.ecrire && <EcrisNous />}
    </Carte>
  );
}

// ─── Le test de vitesse critique plus proposé (D5) ──────────────────────────

// D5 (moteur 8.452 ; 7B, décision coach du 05/11/2026 au soir) : après deux propositions restées sans valeur, la
// préparation d'un acheteur n'écrit plus le test de vitesse critique (le journal porte la ligne TN « non reproposé » ;
// lib/app/tableauDuPlan.ts, testVcNonRepropose). La carte le dit, tant qu'aucune vitesse critique n'est connue.
// Validée par le coach le 05/11/2026 au soir. saisie : « Tes tests », où il entre ses deux distances ; null sans elle.
// Elle ne s'affiche pas la semaine où la préparation écrit ce test (Q14) : elles se contrediraient.
export function CarteTestVitesseCritique({ saisie }: { saisie: string | null }) {
  return (
    <Carte className="space-y-2">
      <Surtitre>Ton test de vitesse critique</Surtitre>
      <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">
        Il ne t’est plus proposé : les deux derniers sont restés sans résultat. Tes séances se règlent sur ton effort
        ressenti. Tu peux le faire quand tu veux : entre ensuite tes deux distances dans ton profil, à « La vitesse critique ».
      </p>
      {saisie && <Link href={saisie} className={LIEN}>Entrer mes distances ›</Link>}
    </Carte>
  );
}

// ─── L'objectif et sa montagne (AP2) ──────────────────────────────────────


// UNE SEULE COULEUR (lot 2 de l'app, maquette validée « tout A » par le coach le 12/11/2026) : plus de couleur qui juge.
const REMPLI = 'rgba(143,209,195,0.85)';
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
export { estRoute };

// AT3 (décision coach du 04/11/2026, « A ») : la montagne se remplit de la part de la préparation déjà faite (le sommet au
// jour J). LA MONTÉE (lot 2 de l'app, maquette validée « tout A » par le coach le 12/11/2026 ; lib/app/tableau.ts,
// monteeDuPlan) : part, la charge vraiment faite sur toute la charge prévue jusqu'à la course, d'une seule couleur. Plus
// de couleur du verdict ; plus de pointillé « prévu aujourd'hui » (version sobre, décision coach du 13/11/2026, « tout
// A ») : le remplissage seul, qui ne fait que monter. libelle : ce qu'en lit un lecteur d'écran (libelleDeLaMontee).
// C17 (audits du 05/11/2026) : neutre, avant deux semaines lues, la montagne se remplit en blanc translucide (part : le
// temps écoulé), sans dire « tout va bien ». Q8 (décision coach du 05/11/2026 au soir, « A ») : le dessin ne
// dépasse pas 140 px de haut, quelle que soit la largeur (avant, près de 300 px sur tablette) ; la route suit la même règle.
const NEUTRE = 'rgba(255,255,255,0.28)';
const DESSIN = 'block w-full h-auto max-h-[140px]';
const EN_ATTENTE = 'Ta préparation, qui se remplira semaine après semaine';
const borne = (x: number | null) => (x === null ? null : Math.max(0, Math.min(1, x)));
export function Montagne({ part, neutre = false, route = false, libelle = EN_ATTENTE }: {
  part: number | null; neutre?: boolean; route?: boolean; libelle?: string;
}) {
  if (route) return <Route part={part} neutre={neutre} libelle={libelle} />;
  const p = borne(part);
  // La montagne monte de 170 (le pied) à 26 (le sommet).
  const niveau = p === null ? null : 170 - p * 144;
  return (
    <svg viewBox="0 0 350 170" className={DESSIN} role="img" aria-label={libelle}>
      <defs><clipPath id="cts-montagne"><path d={SOMMET} /></clipPath></defs>
      <path d={SOMMET} fill="rgba(255,255,255,0.07)" />
      {niveau !== null && (
        <rect x="0" y={niveau} width="350" height={170 - niveau} fill={neutre ? NEUTRE : REMPLI} clipPath="url(#cts-montagne)" />
      )}
      <path d={SOMMET} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinejoin="round" />
      {neutre && niveau !== null && <line x1="0" y1={niveau} x2="350" y2={niveau} stroke="#8FD1C3" strokeWidth={1} strokeDasharray="3 4" />}
      <line x1="176" y1="26" x2="176" y2="6" stroke="#FFFFFF" strokeWidth={1.5} />
      <path d="M176 6 L192 11 L176 16 Z" fill="#8FD1C3" />
    </svg>
  );
}

// Le point de l'axe de la route à une part de sa longueur (en largeur du dessin).
const surLaRoute = (part: number) => ROUTE_AXE[Math.round(((ROUTE_X0 + part * (ROUTE_X1 - ROUTE_X0) - ROUTE_X0) / (ROUTE_X1 - ROUTE_X0)) * (ROUTE_AXE.length - 1))];

function Route({ part: brute, neutre = false, libelle }: { part: number | null; neutre?: boolean; libelle: string }) {
  const part = borne(brute);
  const niveau = part === null ? null : ROUTE_X0 + part * (ROUTE_X1 - ROUTE_X0);
  // Le repère s'arrête avant la ligne d'arrivée, pour ne pas couvrir le damier.
  const avantLArrivee = (ROUTE_X1 - DAMIER * 2 - 6 - ROUTE_X0) / (ROUTE_X1 - ROUTE_X0);
  const repere = part === null ? null : surLaRoute(Math.min(part, avantLArrivee));
  const fin = ROUTE_AXE[ROUTE_AXE.length - 1];
  return (
    <svg viewBox="0 0 350 170" className={DESSIN} role="img" aria-label={libelle}>
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
      {niveau !== null && <rect x="0" y="0" width={niveau} height="170" fill={neutre ? NEUTRE : REMPLI} clipPath="url(#cts-route)" />}
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

// LA MONTÉE SOBRE (décision coach du 13/11/2026, « tout A » ; maquettes « Proposition A ») : sous le dessin, le chiffre (la
// part réalisée, qui ne fait que monter) et sa suite ; sous un trait fin, le bloc en cours s'il est connu et, à droite,
// « Comment c'est calculé ? », replié. Ni prévu ni écart : l'athlète voit la comparaison en taux, dans « Assiduité ».
// coache : « de ta préparation » (sa montée part de son objectif en cours), sinon « de ton plan ».
export function ChiffreDeLaMontee({ montee, coache = false, bloc = null }: { montee: Montee; coache?: boolean; bloc?: string | null }) {
  return (
    <div className="space-y-2.5">
      <p className="flex items-baseline gap-2.5">
        <span className="shrink-0 text-[2.125rem] font-extrabold leading-none tabular-nums text-[#8FD1C3]">{pourcentDeLaMontee(montee)}</span>
        <span className="text-[0.875rem] font-semibold leading-snug">{texteDeLaMontee(montee, coache)}</span>
      </p>
      {/* Le bloc et la question sur la même ligne (la même case de la grille) ; ouverte, son texte passe dessous, sur toute
          la largeur. La place de la question est gardée à droite du bloc. */}
      <div className="grid border-t border-white/[0.12]">
        {bloc && <span className="col-start-1 row-start-1 self-start flex items-center min-h-11 pr-44 text-[0.78rem] text-[#D6D5E6]">{bloc}</span>}
        <details className="col-start-1 row-start-1 pointer-events-none">
          <summary className={'pointer-events-auto ml-auto flex w-fit items-center min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden '
            + 'rounded text-[0.75rem] text-[#D6D5E6] underline underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FD1C3]'}>
            Comment c’est calculé&nbsp;?
          </summary>
          <p className="pointer-events-auto pb-1 text-[0.75rem] leading-relaxed text-[#D6D5E6]">{calculDeLaMontee(montee)}</p>
        </details>
      </div>
    </div>
  );
}

// Un compte à rebours en « J- » jusqu'à l'objectif, sans « semaine x sur N », pour tous, plans achetés compris
// (décisions coach du 19/10/2026 : « on part de l'objectif et on revient jusqu'au jour J »).
// surtitre : « Ton objectif majeur » (décision coach du 07/11/2026 ; avant, « Ton objectif »), ou « Ta dernière course »
// après elle.
// jauge : null pour un coaché que son coach programme à la main (décision coach du 20/10/2026) : ni montagne ni verdict,
// qui suivent la trame du moteur ; le compte à rebours et sa course.
// coache : pour un coaché, ni le début calendaire du plan ni la semaine rejointe (décision coach du 22/10/2026 : ses
// objectifs s'enchaînent).
// jour et debut : l'avancée dans la préparation, qui remplit la montagne avant deux semaines lues (AT3, C17) ; ensuite, la
// montée (jauge.montee, lot 2 du 12/11/2026) : la charge vraiment faite, et son chiffre (ChiffreDeLaMontee, 13/11/2026).
// bloc : le bloc en cours (celui de « Ta préparation, bloc par bloc »), sous le chiffre ; null s'il n'est pas connu.
// bouton (Q16, décision coach du 05/11/2026 au soir, « A ») : un coaché programmé à la main ouvre directement sa fiche de
// course, sa préparation n'étant pas dans l'app ; jourJ : la fiche de course à « Ton jour J » (C14).
// ajouter (décision coach du 07/11/2026) : sous le bouton, « Ajouter une course », vers l'aiguillage « Ta prochaine course »
// (objectif majeur ou course de préparation), tant que l'objectif est à venir.
export function CarteObjectif({ plan, restants, jauge, etape, href, surtitre = 'Ton objectif majeur', coache = false, jour = null, debut = null,
  bouton = null, jourJ = null, ajouter = null, bloc = null }: {
  plan: Plan; restants: number; jauge: Jauge | null; etape: 'avant' | 'pendant' | 'apres'; href: string; surtitre?: string;
  coache?: boolean; jour?: string | null; debut?: string | null; bouton?: { texte: string; href: string } | null; jourJ?: string | null;
  ajouter?: string | null; bloc?: string | null;
}) {
  const depart = debut ?? plan.course.date_debut_plan;
  const total = depart ? Math.max(1, (Date.parse(`${plan.course.date}T12:00:00Z`) - Date.parse(`${depart}T12:00:00Z`)) / 86_400_000) : 0;
  const temps = !jour || !depart ? null : etape === 'avant' ? 0 : etape === 'apres' ? 1
    : Math.max(0, Math.min(1, (Date.parse(`${jour}T12:00:00Z`) - Date.parse(`${depart}T12:00:00Z`)) / 86_400_000 / total));
  const montee = etape === 'avant' ? null : jauge?.montee ?? null;
  const route = estRoute(plan.course.format);
  // C14 (audits du 05/11/2026) : le jour de la course.
  const cestLeJour = etape === 'pendant' && restants === 0;
  // C21 : l'année, quand la course ne tombe pas l'année en cours.
  const annee = Boolean(jour && plan.course.date.slice(0, 4) !== jour.slice(0, 4));
  const action = cestLeJour && jourJ ? { texte: 'Voir ton jour J', href: jourJ } : bouton ?? { texte: 'Voir ma préparation', href };
  return (
    <CarteSombre className="space-y-3.5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <Surtitre ton="clair" as="div">{surtitre}</Surtitre>
          <h2 className="mt-1.5 text-[1.625rem] font-extrabold leading-tight">{plan.course.nom}</h2>
          <p className="mt-1.5 text-[0.8125rem] text-[#D6D5E6]">{dateLongue(plan.course.date, annee)} · {plan.course.format_clair}</p>
        </div>
        {(restants > 0 || cestLeJour) && (
          <div className="shrink-0 text-center bg-white/10 rounded-xl px-3 py-2.5">
            <div className="text-[1.375rem] font-extrabold leading-none whitespace-nowrap">{cestLeJour ? 'Jour J' : `J-${restants}`}</div>
          </div>
        )}
      </div>
      {jauge && <Montagne part={montee ? montee.fait : temps} neutre={!montee} route={route}
        libelle={montee ? libelleDeLaMontee(montee, coache) : undefined} />}
      {cestLeJour ? (
        // C14 : Validé par le coach le 05/11/2026 (1A).
        <p className="text-base font-bold">C’est le jour J. Bonne course !</p>
      ) : !jauge || etape === 'apres' ? null
      : etape === 'avant' ? (
        <p className="text-[0.9375rem] font-bold">{coache ? 'Tes séances arrivent chaque dimanche dans Nolio.' : plan.couverture.debut}</p>
      ) : montee ? (
        // La montée sobre (décision coach du 13/11/2026, « tout A ») : le chiffre, sans prévu ni verdict.
        <ChiffreDeLaMontee montee={montee} coache={coache} bloc={bloc} />
      ) : (
        <p className="text-base font-bold">Ta préparation est lancée</p>
      )}
      <Link href={action.href} className={BOUTON}>{action.texte}</Link>
      {ajouter && (
        <Link href={ajouter} className="-mt-2 flex w-fit items-center min-h-11 text-[0.8125rem] font-bold text-[#D6D5E6]">
          Ajouter une course ›
        </Link>
      )}
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

// Q6-b (décision coach du 05/11/2026 au soir, « A ») : sur l'accueil, seulement quand une course est prévue (avant, la
// carte invitait chaque semaine à en ajouter une) ; l'ajout reste dans « Ta préparation ».
export function CoursesPreparation({ courses, ajout }: { courses: CourseSecondaire[]; ajout: string | null }) {
  if (!courses.length) return null;
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

// AT5 (décision coach du 04/11/2026) : le type de la semaine en mots de coureur ; Q3 (décision coach du 05/11/2026 au
// soir) : « Semaine allégée », un seul nom (plus d'« assimilation » ni de « décharge »), et « Semaine de course » pour celle
// de la course (C13, ailleurs). Le week-end choc, sous son ancien et son nouveau nom (Q2).
const TYPE_EN_CLAIR: Record<string, string> = {
  Charge: 'Semaine de charge', Assimilation: 'Semaine allégée', Décharge: 'Semaine allégée', 'Affûtage actif': 'Affûtage',
};
// reprise : la première semaine écrite après une course (« reprise_apres_course » de la semaine écrite, moteur 8.459 ;
// « Semaine de reprise », décision coach du 08/11/2026, « A »).
export const typeEnClair = (type: string, reprise = false) =>
  (reprise ? SEMAINE_DE_REPRISE : TYPE_EN_CLAIR[type] ?? (estSemaineDeWeekEndChoc(type) ? 'Semaine de charge' : type));
// La semaine qui contient la course (C13).
export const contientLaCourse = (lundi: string | null | undefined, course: string | null | undefined) =>
  Boolean(lundi && course && course >= lundi && course <= ajouterJours(lundi, 6));

const ARRIVEE = {
  invitation: 'Tes séances arrivent dans Nolio dès que tu as rejoint l’équipe CTS.',
  bientot: 'Tes séances de la semaine arrivent bientôt dans Nolio.',
} as const;

// Le test que la préparation écrit cette semaine (Q14) : son nom, son protocole, et, sans accord de lecture, sa saisie.
export type TestDeLaSemaine = { titre: string; comment: string; saisie: string | null };

// nolio : la semaine telle qu'elle est dans Nolio, retouches du coach comprises (tableauDuPlan.lireSemaineNolio) ; sans
// elle, la semaine écrite par le moteur. Tant qu'elle n'est pas dans Nolio (décision coach du 20/10/2026) : arrivee dit
// quand elle y arrive, et les jours d'avant depuis ne s'y poseront pas (un départ en milieu de semaine). Toujours la
// semaine en cours, rien d'autre (décision coach du 24/10/2026). C21 (audits du 05/11/2026) : avant le départ, la date de
// début n'est plus dite ici, seulement dans la carte de l'objectif.
// raison (AT1, décision coach du 04/11/2026 ; B-AT-1 et B-AT-2) : sans accord de lecture, plus de liste de séances (la
// semaine du moteur n'est souvent pas celle que le coach a retouchée) mais « elles sont dans Nolio », et comment donner
// l'accord (C18 : « Donner mon accord › », accord : son adresse, pour un acheteur) ; Nolio muet, la semaine écrite et
// « Nolio ne répond pas ».
// lundi : le lundi de la semaine, quand il n'y a pas de semaine écrite (un coaché à la main ou sans objectif), pour
// reconnaître la semaine de la course.
// SES SÉANCES SEULEMENT (lot 2 de l'app, décision coach du 12/11/2026) : les lignes « Questionnaire « Ta semaine
// prochaine » » du samedi et « Ta forme du dimanche (Hooper) » du dimanche ne sont plus dans la liste des jours ; le
// questionnaire et le Hooper restent dans Nolio, et le Hooper dans « Données ».
// horsNolio : un plan acheté pendant un coaching (« coaching », décision coach du 05/11/2026 au soir, « 3 A ») : la semaine
// du plan seule, sans rien de Nolio (ni ses séances, ni « elles arrivent », ni le lien).
// jour (C15) : aujourd'hui, mis en avant, les jours passés grisés. course (C13) : la date de la course, pour « Semaine de
// course ». test (Q14) : le test que la préparation écrit cette semaine. (ajustee, Q7, retiré le 10/11/2026 : la phrase
// « Ajustée d'après ta semaine passée… » n'est plus montrée, décision 20 du coach.)
// AUCUNE MARQUE (décision 11 du coach du 09/11/2026, doctrine de la semaine) : il voit sa semaine telle qu'elle est dans
// Nolio, c'est tout ; une séance retirée n'y est plus, une séance déplacée est à son nouveau jour (la lecture de Nolio,
// triée par date). « Ajustée par ton coach. » et l'étiquette « Semaine ajustée » sont retirées.
export function CetteSemaine({ semaine, ligne, nolio = null, arrivee = null, depuis = null,
  raison = null, coache = false, lundi = null, horsNolio = false, jour = null, course = null,
  test = null, accord = null }: {
  semaine: Semaine | null; ligne: LigneTrame | null; nolio?: SeanceNolio[] | null;
  arrivee?: keyof typeof ARRIVEE | null; depuis?: string | null; raison?: RaisonNolio | null;
  coache?: boolean; lundi?: string | null; horsNolio?: boolean; jour?: string | null; course?: string | null;
  test?: TestDeLaSemaine | null; accord?: string | null;
}) {
  const muet = !nolio && raison === 'muet';
  const sansAccord = !nolio && raison === 'sans_accord';
  const jours = (semaine?.jours ?? []).filter((j) => j.famille !== 'repos' && j.seance && !(!muet && depuis && j.date_iso && j.date_iso < depuis));
  if (!nolio && !jours.length && !ligne && !raison) return null;
  const lundiDeLaSemaine = ligne?.lundi || semaine?.lundi || lundi;
  const etiquette = contientLaCourse(lundiDeLaSemaine, course) ? { texte: 'Semaine de course', couleur: '#0C6E5F' }
    : ligne ? { texte: typeEnClair(ligne.type, Boolean(semaine?.reprise_apres_course && semaine.numero === ligne.numero)),
      couleur: BANNIERE[ligne.type] ?? '#4F6F69' } : null;
  // Une ligne de la semaine : le jour (aujourd'hui en avant, les jours passés grisés, C15), la couleur de la séance, son
  // nom et, dans sa colonne, sa durée totale (C16 : le nom garde le temps de travail de Nolio, « Seuil 2 court · 18 min —
  // 9 × 2 min », la colonne dit la séance entière, « 51 min »).
  const ligneDeSemaine = ({ cle, date, jourTexte, couleur, nom, duree }: {
    cle: string; date: string | null; jourTexte: string; couleur: string; nom: string; duree?: string | null;
  }) => {
    const passe = Boolean(jour && date && date < jour);
    const aujourdhui = Boolean(jour && date === jour);
    return (
      <li key={cle} className={clsx('grid grid-cols-[62px_6px_1fr_auto] gap-x-2.5 items-center min-h-11 py-1',
        aujourdhui ? '-mx-2 px-2 rounded-lg bg-[#E1EFEA]' : 'border-b border-indigo/[0.06]')}>
        <span className={clsx('text-xs font-semibold whitespace-nowrap leading-tight', aujourdhui ? 'text-teal-dark' : 'text-[#5E5C78]')}>
          {jourCourt(date, jourTexte)}
          {aujourdhui && <span className="block text-[0.6875rem] font-bold">aujourd’hui</span>}
        </span>
        <span className={clsx('w-1.5 h-7 rounded-full', passe && 'opacity-40')} style={{ backgroundColor: couleur }} aria-hidden />
        <span className={clsx('text-sm leading-snug', passe ? 'text-[#5E5C78] font-medium' : 'text-indigo font-semibold')}>
          {nom}{passe && <span className="sr-only"> (passée)</span>}
        </span>
        <span className="text-xs tabular-nums text-right whitespace-nowrap text-[#5E5C78]">{duree ?? ''}</span>
      </li>
    );
  };
  const ligneNolio = (x: SeanceNolio) => ligneDeSemaine({ cle: x.id, date: x.date, jourTexte: '', couleur: x.couleur ?? '#B9C7C3',
    nom: nomPourLAthlete(x.nom), duree: x.minutes !== null ? enHeures(x.minutes) : null });
  const ligneJour = (j: Jour) => ligneDeSemaine({ cle: j.id, date: j.date_iso, jourTexte: j.jour, couleur: couleurDuJour(j),
    nom: nomPourLAthlete(j.nom ?? j.seance), duree: j.duree || null });
  const note = (texte: string) => <p className="mt-2.5 p-3 rounded-xl bg-sand text-xs text-[#4A4866] leading-relaxed">{texte}</p>;
  // Les noms des séances affichées, dans le même ordre que les branches ci-dessous (sans accord de lecture : aucune).
  const affichees = sansAccord ? [] : nolio ? nolio.map((x) => x.nom) : jours.length ? jours.map((j) => j.nom ?? j.seance)
    : ligne ? ligne.seances_cles.map((c) => c.nom ?? c.seance) : [];
  const lexique = motsDeLaSemaine(affichees);
  return (
    <Carte className="space-y-1">
      <div className="flex justify-between items-baseline gap-3 mb-2">
        <Surtitre>Ta semaine</Surtitre>
        {etiquette && <span className="text-xs font-semibold" style={{ color: etiquette.couleur }}>{etiquette.texte}</span>}
      </div>
      {/* Q7 : la phrase « Ajustée d'après ta semaine passée : le pourquoi est dans la note de ta semaine, dans Nolio. » est
          retirée (décision 20 du coach du 10/11/2026 : l'app de l'athlète montre sa semaine, c'est tout ; le pourquoi reste
          dans la note de sa semaine, dans Nolio). */}
      {/* Q14 : la semaine d'un test a sa ligne. Validé par le coach le 05/11/2026 (1A). */}
      {test && (
        <div className="mb-2 p-3 rounded-xl bg-[#FFF6E5] space-y-0.5">
          <p className="text-sm font-bold text-indigo">Cette semaine : {test.titre}</p>
          <div className="flex flex-wrap gap-x-5">
            <Link href={test.comment} className={LIEN}>Comment faire ›</Link>
            {test.saisie && <Link href={test.saisie} className={LIEN}>Entrer mon résultat ›</Link>}
          </div>
        </div>
      )}
      {sansAccord ? (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-indigo">Tes séances de la semaine sont dans Nolio.</p>
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            {coache ? 'Pour les voir ici, réponds « oui » au message de ton coach dans Nolio.'
              // C18 : Validé par le coach le 05/11/2026 (1A).
              : 'Pour les voir ici, donne ton accord de lecture.'}
          </p>
          {!coache && accord && <Link href={accord} className={LIEN}>Donner mon accord ›</Link>}
        </div>
      ) : nolio ? (
        <ul>
          {nolio.length === 0 && <li className="min-h-11 flex items-center text-sm text-[#5E5C78] border-b border-indigo/[0.06]">Rien de prévu dans Nolio cette semaine.</li>}
          {nolio.map(ligneNolio)}
        </ul>
      ) : jours.length > 0 ? (
        <ul>{jours.map(ligneJour)}</ul>
      ) : !ligne ? null : (
        <div className="space-y-1">
          <p className="text-sm text-indigo">{enHeures(Math.round(ligne.volume_h * 60))} de volume prévu{ligne.week_end_choc ? ' · week-end choc' : ''}</p>
          {ligne.seances_cles.length > 0 && (
            <ul className="text-sm text-indigo space-y-0.5">
              {ligne.seances_cles.map((c) => <li key={`${c.jour}-${c.seance}`}><span className="text-[#5E5C78]">{c.jour} ·</span> {nomPourLAthlete(c.nom ?? c.seance)}</li>)}
            </ul>
          )}
        </div>
      )}
      {horsNolio ? null
        // C9 : plus de bouton vers le site de Nolio ; validé par le coach le 05/11/2026 (1A ; « dans ton appli Nolio »).
        : sansAccord ? note('Le détail de chaque séance est dans ton appli Nolio.')
        : muet ? note('Nolio ne répond pas pour l’instant : tes séances y sont, avec leur détail.')
        : !nolio && !jours.length && !ligne ? null
        : nolio || !arrivee ? note('Le détail de chaque séance est dans ton appli Nolio.')
        : note(ARRIVEE[arrivee])}
      {/* Q1 (05/11/2026) : les noms restent ceux de Nolio ; dessous, repliés, les mots qu'ils emploient. Lot 2 (décision
          du coach du 12/11/2026) : ceux des séances affichées seulement, lib/app/motsDeLaSemaine.ts ; aucun, pas de bloc. */}
      {lexique.length > 0 && (
        <details className="group pt-1">
          <summary className="cursor-pointer list-none inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">
            Les mots de ta semaine <span aria-hidden className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
          </summary>
          <dl className="pb-1 space-y-1.5">
            {lexique.map(({ mot, sens }) => (
              <div key={mot} className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
                <dt className="inline font-bold text-indigo">{mot}</dt> : <dd className="inline">{sens}</dd>
              </div>
            ))}
          </dl>
        </details>
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
            <Link href={href(f)} className="block py-2.5 min-h-11">
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
