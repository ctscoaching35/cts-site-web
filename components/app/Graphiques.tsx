'use client';

import { useEffect, useRef, useState } from 'react';
import type { Realise } from '@/lib/app/ecriture';
import { courseDeLaSemaine, ECART_ZONE_HOOPER, enHeures, type Barre, type CourseDuGraphique, type PointHooper } from '@/lib/app/tableau';
import { Carte, Surtitre } from './Ui';

// LES GRAPHIQUES DE « MES DONNÉES » (AP3, T10 ; maquettes validées par le coach le 19/10/2026) : la charge, le volume, le
// Hooper. Revus après les audits du 05/11/2026 :
// - C2 : le texte des graphiques a une taille fixe (11 px), quelle que soit la largeur ; avant, il était dessiné dans le
//   graphique et grandissait avec lui (8 px sur téléphone, 17 px sur tablette). Le dessin se fait donc à la largeur réelle
//   de sa carte, mesurée dans le navigateur (326 px avant la mesure) ;
// - C2 : une date sur deux quand elles ne tiennent pas toutes, la dernière jamais coupée ; des graduations régulières ;
// - C4 : les dates en « 22 mars », les durées en « 4h30 » ;
// - Q15 (décision coach du 05/11/2026 au soir, « A ») : les trois sur les mêmes semaines, les 10 dernières et la semaine
//   en cours (axe) ; le volume garde en plus ses 3 semaines à venir, à droite ;
// - C3 : des gris d'au moins #5E5C78, sans transparence.

const TEXTE = 11;
const GAUCHE = 46;
const GRIS = '#5E5C78';

function useLargeur(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(326);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mesurer = () => setLargeur(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    mesurer();
    const o = new ResizeObserver(mesurer);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return [ref, largeur];
}

// « 22 mars », « 5 avr. ».
const date = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const laSemaine = (lundi: string | undefined, numero: string) => (lundi ? `la semaine du ${date(lundi)}` : `la semaine ${numero.replace('S', '')}`);

// Une étiquette sur combien : elles tiennent toutes à partir de 52 px par colonne ; la dernière (la semaine en cours)
// est toujours écrite.
const pasDesEtiquettes = (largeurColonne: number) => Math.max(1, Math.ceil(52 / Math.max(1, largeurColonne)));
const etiquetee = (i: number, n: number, pas: number) => (n - 1 - i) % pas === 0;
// La position et l'ancrage d'une étiquette : près du bord droit, calée à droite, jamais coupée.
const ancre = (x: number, largeur: number) => (x > largeur - 26 ? { x: largeur - 1, textAnchor: 'end' as const } : { x, textAnchor: 'middle' as const });

// Des graduations régulières (100, 200, 250, 500, 1 000…) : trois ou quatre lignes sous le haut.
function graduationsRegulieres(haut: number): number[] {
  const brut = haut / 3.5;
  const puissance = 10 ** Math.floor(Math.log10(Math.max(1, brut)));
  const pas = [1, 2, 2.5, 5, 10].map((k) => k * puissance).find((p) => p >= brut) ?? 10 * puissance;
  return Array.from({ length: Math.floor(haut / pas) }, (_, k) => (k + 1) * pas);
}

// Le repère d'une course (un objectif ou une course de préparation) : un petit drapeau, son nom au survol.
function Drapeau({ x, y, nom }: { x: number; y: number; nom: string }) {
  return (
    <g>
      <title>{nom}</title>
      <line x1={x} y1={y} x2={x} y2={y + 12} stroke="#2F2D4E" strokeWidth={1.2} />
      <path d={`M${x} ${y}h7l-2 3 2 3h-7z`} fill="#2BB39B" />
    </g>
  );
}

// ─── La charge ────────────────────────────────────────────────────────────

// La charge de chaque semaine écoulée (RPE de séance × durée, Foster), et sa moyenne sur 4 semaines ; sans prévu à côté
// (décision coach du 19/10/2026 : calculée autrement, la comparaison serait biaisée). axe : les lundis des semaines
// montrées (Q15).
export function GraphiqueCharge({ realises, courses = [], axe }: { realises: Realise[]; courses?: CourseDuGraphique[]; axe: string[] }) {
  const [ref, W] = useLargeur();
  const valides = realises.filter((r) => r.rpe_lu && r.charge_faite > 0 && r.lundi).sort((a, b) => a.lundi.localeCompare(b.lundi));
  const parLundi = new Map(valides.map((r, k) => [r.lundi, k]));
  const montrees = axe.filter((l) => parLundi.has(l));
  if (montrees.length < 2) return null;
  const moyenne = (k: number) => (k >= 3 ? valides.slice(k - 3, k + 1).reduce((a, r) => a + r.charge_faite, 0) / 4 : null);
  const derniere = valides[parLundi.get(montrees[montrees.length - 1]) as number];
  const moyDerniere = moyenne(parLundi.get(derniere.lundi) as number);
  const H = 168;
  const BAS = 140;
  const haut = Math.max(...montrees.map((l) => valides[parLundi.get(l) as number].charge_faite)) * 1.15;
  const y = (v: number) => BAS - (v / haut) * (BAS - 10);
  const pas = (W - GAUCHE) / axe.length;
  const cx = (i: number) => GAUCHE + i * pas + pas / 2;
  const tous = pasDesEtiquettes(pas);
  const ligne = axe.map((l, i) => {
    const k = parLundi.get(l);
    const m = k === undefined ? null : moyenne(k);
    return m === null ? null : `${cx(i)},${y(m)}`;
  }).filter(Boolean);
  return (
    <Carte className="space-y-2.5">
      <Surtitre>Ta charge d’entraînement</Surtitre>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[1.625rem] font-extrabold text-indigo">{Math.round(derniere.charge_faite).toLocaleString('fr-FR')}</span>
        <span className="text-xs text-[#5E5C78]">{laSemaine(derniere.lundi, derniere.numero)}</span>
      </div>
      {/* Un repère pour un nombre sans unité (AT5, décision coach du 04/11/2026) : l'écart à sa moyenne, la seule
          comparaison (C40 ; avant, la moyenne était aussi dite en chiffre juste au-dessus). */}
      {moyDerniere !== null && moyDerniere > 0 && (() => {
        const ecart = Math.round(((derniere.charge_faite - moyDerniere) / moyDerniere) * 100);
        return (
          <p className="text-[0.8125rem] font-semibold text-indigo">
            {Math.abs(ecart) < 3 ? 'Dans ta moyenne des 4 dernières semaines.'
              : `${Math.abs(ecart)} % de ${ecart > 0 ? 'plus' : 'moins'} que ta moyenne des 4 dernières semaines.`}
          </p>
        );
      })()}
      <div ref={ref}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label="Ta charge par semaine, avec ta moyenne sur quatre semaines">
          {graduationsRegulieres(haut).map((g) => (
            <g key={g}>
              <line x1={GAUCHE} y1={y(g)} x2={W} y2={y(g)} stroke="rgba(47,45,78,0.08)" />
              <text x="0" y={y(g) + 4} fontSize={TEXTE} fill={GRIS}>{g.toLocaleString('fr-FR')}</text>
            </g>
          ))}
          <line x1={GAUCHE} y1={BAS} x2={W} y2={BAS} stroke="rgba(47,45,78,0.25)" />
          {axe.map((l, i) => {
            const k = parLundi.get(l);
            const r = k === undefined ? null : valides[k];
            const course = courseDeLaSemaine(l, courses);
            return (
              <g key={l}>
                {r && (
                  <>
                    <title>{`${laSemaine(l, r.numero)} : ${Math.round(r.charge_faite)}`}</title>
                    <rect x={GAUCHE + i * pas + pas * 0.22} y={y(r.charge_faite)} width={pas * 0.56} height={BAS - y(r.charge_faite)} rx="3" fill="#0C6E5F" />
                  </>
                )}
                {etiquetee(i, axe.length, tous) && <text {...ancre(cx(i), W)} y={BAS + 17} fontSize={TEXTE} fill={GRIS}>{date(l)}</text>}
                {course && <Drapeau x={cx(i)} y={Math.max(0, (r ? y(r.charge_faite) : BAS) - 14)} nom={course} />}
              </g>
            );
          })}
          {ligne.length >= 2 && <polyline points={ligne.join(' ')} fill="none" stroke="#2F2D4E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.75rem] text-[#4A4866]">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal" />ta charge (RPE × durée)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-0.5 bg-indigo" />moyenne sur 4 semaines</span>
      </div>
    </Carte>
  );
}

// ─── Le volume ────────────────────────────────────────────────────────────

// Le volume (retour du coach du 20/10/2026 : « pas très pro », le haut tronqué) : des graduations rondes qui tiennent
// dans le cadre, le prévu en fond clair et le fait en vert par-dessus, le futur en pointillé fin, la semaine en cours
// soulignée.
export function GraphiqueVolume({ barres }: { barres: Barre[] }) {
  const [ref, W] = useLargeur();
  if (!barres.length) return null;
  const H = 156;
  const HAUT = 12;
  const BAS = 126;
  const pas = (W - GAUCHE) / barres.length;
  const max = Math.max(60, ...barres.map((b) => Math.max(b.prevue, b.faite ?? 0)));
  const pasH = max <= 180 ? 1 : max <= 360 ? 2 : max <= 720 ? 3 : 5;
  const sommet = Math.ceil(max / 60 / pasH) * pasH;
  const h = (min: number) => (min / (sommet * 60)) * (BAS - HAUT);
  const graduations = Array.from({ length: sommet / pasH }, (_, k) => (k + 1) * pasH);
  const passee = [...barres].reverse().find((b) => b.moment === 'passee' && b.faite !== null);
  const tous = pasDesEtiquettes(pas);
  const encours = barres.findIndex((b) => b.moment === 'encours');
  // La semaine en cours est toujours écrite ; les autres, une sur `tous` à partir d'elle.
  const ecrite = (i: number) => (encours >= 0 ? Math.abs(i - encours) % tous === 0 : etiquetee(i, barres.length, tous));
  return (
    <Carte className="space-y-2.5">
      <Surtitre>Ton volume de course</Surtitre>
      {passee && (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[1.625rem] font-extrabold text-indigo">{enHeures(passee.faite ?? 0)}</span>
          <span className="text-xs text-[#5E5C78]">{laSemaine(passee.lundi, passee.numero)}, sur {enHeures(passee.prevue)} prévues</span>
        </div>
      )}
      <div ref={ref}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label="Tes heures de course par semaine, faites à côté des prévues">
          {graduations.map((g) => (
            <g key={g}>
              <line x1={GAUCHE} y1={BAS - h(g * 60)} x2={W} y2={BAS - h(g * 60)} stroke="rgba(47,45,78,0.07)" />
              <text x="0" y={BAS - h(g * 60) + 4} fontSize={TEXTE} fill={GRIS}>{g}h</text>
            </g>
          ))}
          <line x1={GAUCHE} y1={BAS} x2={W} y2={BAS} stroke="rgba(47,45,78,0.18)" />
          {barres.map((b, i) => {
            const x = GAUCHE + i * pas;
            const w = Math.min(28, pas * 0.6);
            const x0 = x + (pas - w) / 2;
            const avenir = b.moment !== 'passee';
            return (
              <g key={b.lundi}>
                <title>{`${laSemaine(b.lundi, b.numero)} : ${enHeures(b.prevue)} prévues${b.faite !== null ? `, ${enHeures(b.faite)} faites` : ''}`}</title>
                {b.moment === 'encours' && <rect x={x + 1} y={HAUT - 6} width={pas - 2} height={BAS - HAUT + 6} rx="6" fill="rgba(12,110,95,0.06)" />}
                {avenir ? (
                  <rect x={x0} y={BAS - h(b.prevue)} width={w} height={h(b.prevue)} rx="3" fill="none" stroke="#9C9AB3" strokeWidth={1} strokeDasharray="3 3" />
                ) : (
                  <rect x={x0} y={BAS - h(b.prevue)} width={w} height={h(b.prevue)} rx="3" fill="#ECEBF3" />
                )}
                {b.faite !== null && <rect x={x0 + w * 0.2} y={BAS - h(b.faite)} width={w * 0.6} height={h(b.faite)} rx="2" fill="#0C6E5F" />}
                {b.course && <Drapeau x={x + pas / 2} y={Math.max(0, BAS - h(Math.max(b.prevue, b.faite ?? 0)) - 14)} nom={b.course} />}
                {ecrite(i) && (
                  <text {...ancre(x + pas / 2, W)} y={BAS + 17} fontSize={TEXTE} fontWeight={b.moment === 'encours' ? 700 : 500}
                    fill={b.moment === 'encours' ? '#2F2D4E' : GRIS}>{date(b.lundi)}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.75rem] text-[#4A4866]">
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

// ─── Le Hooper du dimanche ────────────────────────────────────────────────

// « Ta forme du dimanche (Hooper) », un seul nom (Q3) ; son explication avant le graphique (C40). aLaMain : un coaché
// que son coach programme à la main, ou sans objectif (C47) : personne n'allège sa semaine tout seul.
export function GraphiqueHooper({ points, axe, aLaMain = false }: { points: PointHooper[]; axe: string[]; aLaMain?: boolean }) {
  const [ref, W] = useLargeur();
  const parLundi = new Map(points.map((p) => [p.lundi, p]));
  const lignes = axe.map((l) => parLundi.get(l) ?? { numero: '', lundi: l, valeur: null, zone: null, course: null });
  const valeurs = lignes.filter((p) => p.valeur !== null);
  if (valeurs.length < 2) return null;
  const H = 150;
  const BAS = 122;
  const pas = (W - GAUCHE) / lignes.length;
  const x = (i: number) => GAUCHE + i * pas + pas / 2;
  const haut = Math.max(...lignes.flatMap((p) => [p.valeur ?? 0, p.zone !== null ? p.zone + ECART_ZONE_HOOPER : 0])) + 2;
  const bas = Math.max(0, Math.min(...lignes.flatMap((p) => (p.valeur !== null ? [p.valeur] : []).concat(p.zone !== null ? [p.zone - ECART_ZONE_HOOPER] : []))) - 2);
  const y = (v: number) => 12 + ((haut - v) / (haut - bas)) * (BAS - 22);
  const zone = lignes.map((p, i) => (p.zone !== null ? { x: x(i), hautZ: y(p.zone + ECART_ZONE_HOOPER), basZ: y(p.zone - ECART_ZONE_HOOPER) } : null))
    .filter((z): z is { x: number; hautZ: number; basZ: number } => z !== null);
  const ligne = lignes.map((p, i) => (p.valeur !== null ? `${x(i)},${y(p.valeur)}` : null)).filter(Boolean).join(' ');
  const dernier = [...lignes].reverse().find((p) => p.valeur !== null) as PointHooper;
  const auDessus = (p: PointHooper) => p.zone !== null && p.valeur !== null && p.valeur > p.zone + ECART_ZONE_HOOPER;
  const tous = pasDesEtiquettes(pas);
  return (
    <Carte className="space-y-2.5">
      <Surtitre>Ta forme du dimanche (Hooper)</Surtitre>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[1.625rem] font-extrabold text-indigo">{dernier.valeur}</span>
        <span className="text-xs text-[#5E5C78]">
          {laSemaine(dernier.lundi, dernier.numero)}{dernier.zone !== null ? (auDessus(dernier) ? ' · au-dessus de ta zone habituelle' : ' · dans ta zone habituelle') : ''}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-[#4A4866]">
        La bande verte : ta zone habituelle (ta moyenne des 4 semaines d’avant). Plus le Hooper est haut, plus tu es
        fatigué. {aLaMain
          // C47 (audits du 05/11/2026) : Validé par le coach le 05/11/2026 (1A).
          ? 'Un point orange : au-dessus de ta zone, ton coach en tient compte pour ta semaine suivante.'
          : 'Un point orange : au-dessus de ta zone, ta semaine suivante a pu être allégée.'}
      </p>
      <div ref={ref}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label="Ta forme chaque dimanche, et ta zone habituelle">
          {zone.length >= 2 && (
            <polygon fill="#E1EFEA" points={[...zone.map((z) => `${z.x},${z.hautZ}`), ...[...zone].reverse().map((z) => `${z.x},${z.basZ}`)].join(' ')} />
          )}
          <line x1={GAUCHE} y1={BAS} x2={W} y2={BAS} stroke="rgba(47,45,78,0.25)" />
          <text x="0" y="18" fontSize={TEXTE} fill={GRIS}>fatigué</text>
          <text x="0" y={BAS - 4} fontSize={TEXTE} fill={GRIS}>frais</text>
          <polyline fill="none" stroke="#2F2D4E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={ligne} />
          {lignes.map((p, i) => p.valeur !== null && (
            <circle key={p.lundi} cx={x(i)} cy={y(p.valeur)} r={auDessus(p) ? 5 : 3.5} fill={auDessus(p) ? '#C2410C' : '#2F2D4E'}>
              <title>{`${laSemaine(p.lundi, p.numero)} : ${p.valeur}`}</title>
            </circle>
          ))}
          {lignes.map((p, i) => p.course && <Drapeau key={`c-${p.lundi}`} x={x(i)} y={2} nom={p.course} />)}
          {lignes.map((p, i) => etiquetee(i, lignes.length, tous) && (
            <text key={`t-${p.lundi}`} {...ancre(x(i), W)} y={BAS + 17} fontSize={TEXTE} fill={GRIS}>{date(p.lundi)}</text>
          ))}
        </svg>
      </div>
    </Carte>
  );
}
