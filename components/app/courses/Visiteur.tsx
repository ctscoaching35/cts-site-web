'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { effacerDossierBrouillon, garderDossierBrouillon, lireDossierBrouillon } from '@/lib/app/brouillonGratuit';
import { ID_VISITEUR, dossierSur, modeleCarte, nomDeLaCourse, parametresNutrition, type Dossier } from '@/lib/app/courseLibre';
import { lireStrategie } from '@/lib/app/strategiePure';
import { AllerPlusLoin } from '../AllerPlusLoin';
import CadreSite from '../CadreSite';
import { BOUTON, BOUTON_SECONDAIRE, Carte, Surtitre, TITRE } from '../Ui';
import { BoutonPartager, EffacerStrategie, SupprimerDossier } from './ActionsDossier';
import DossierCourse, { type FicheDeCourse } from './DossierCourse';
import { dateLongue } from '@/lib/app/plan';

// Le dossier d'un visiteur (sans compte) : il tient le temps de l'onglet (sessionStorage, comme son profil), jamais plus. Pour le
// garder, il se connecte avec le code par e-mail : le compte le reçoit (lib/app/actionsGratuit.ts, garderApresConnexion).
const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

export function dossierDeLOnglet(): Dossier | null {
  const b = lireDossierBrouillon();
  const d = dossierSur(b);
  if (!b || !d) return null;
  const s = lireStrategie(b.strategie);
  const le = (b.strategie as { le?: unknown } | null)?.le;
  return { id: null, ...d, strategie: s ? { ...s, le: typeof le === 'string' ? le : '' } : null, cree_le: '' };
}

function garderStrategieDeLOnglet(donnees: unknown): { ok: boolean; message: string } {
  const b = lireDossierBrouillon();
  const s = lireStrategie(donnees);
  if (!b || !s) return { ok: false, message: 'Indique au moins la durée de ta course pour garder ta stratégie.' };
  const ok = garderDossierBrouillon({ ...b, strategie: { ...s, le: aujourdhui() } });
  return ok ? { ok: true, message: 'Ta stratégie est gardée.' } : { ok: false, message: 'Ce navigateur ne laisse rien garder le temps de la visite.' };
}

// Le visiteur lit son onglet une fois la page chargée (le serveur ne le voit pas).
function useDossier() {
  const [dossier, setDossier] = useState<Dossier | null | undefined>(undefined);
  useEffect(() => { setDossier(dossierDeLOnglet()); }, []);
  return [dossier, setDossier] as const;
}

// « Tes courses » d'un visiteur : son dossier, s'il en a un.
export function ListeVisiteur() {
  const [dossier] = useDossier();
  return (
    <div className="space-y-4">
      <h1 className={TITRE}>Tes courses</h1>
      {dossier ? (
        <Carte className="space-y-3">
          <Link href={`/app/courses/${ID_VISITEUR}`} className="flex items-center gap-3 min-h-11">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-indigo">{nomDeLaCourse(dossier.reponse)}</span>
              <span className="block text-xs text-[#5E5C78]">
                {dateLongue(dossier.reponse.course.date, true)} · {String(dossier.reponse.course.distance_km).replace('.', ',')} km · {Math.round(dossier.reponse.course.dplus_m)} m D+
              </span>
            </span>
            <span aria-hidden className="text-[#5E5C78]">›</span>
          </Link>
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Sans compte, une seule course à la fois, le temps de cette visite : un nouveau dossier remplace celui-ci.
          </p>
        </Carte>
      ) : dossier === null ? (
        <Carte className="space-y-1.5">
          <p className="text-sm font-bold text-indigo">Comprends ta course.</p>
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Sa trace GPX fait tout le dossier : profil, pentes, type de course, effort du jour J, zones, nutrition, carte à partager.
          </p>
        </Carte>
      ) : null}
      <Link href="/app/courses/nouvelle" className={`${dossier ? BOUTON_SECONDAIRE : BOUTON} w-full`}>{dossier ? 'Une nouvelle course' : 'Ajouter une course'}</Link>
      <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
        Pour garder tes courses sur ton téléphone et ton ordinateur, ton e-mail suffit, sans mot de passe.{' '}
        <Link href="/app/me-connecter" className="font-bold text-teal whitespace-nowrap">Créer mon compte ›</Link>
      </p>
      <AllerPlusLoin />
    </div>
  );
}

export function DossierVisiteur({ fiches }: { fiches: FicheDeCourse[] }) {
  const [dossier, setDossier] = useDossier();
  if (dossier === undefined) return <p className="text-sm text-[#5E5C78]">Le dossier se charge…</p>;
  if (!dossier) {
    return (
      <Carte className="space-y-2.5">
        <Surtitre>Ton dossier de course</Surtitre>
        <p className="text-sm text-[#4A4866] leading-relaxed">Ce dossier n’est plus là : sans compte, il ne dure que le temps de la visite.</p>
        <Link href="/app/courses/nouvelle" className={`${BOUTON} w-full`}>Ajouter une course</Link>
      </Carte>
    );
  }
  const ultra = dossier.reponse.effort_jour_j.duree_h > 8;
  return (
    <DossierCourse dossier={dossier} fiches={fiches.filter((f) => ultra || f.slug !== 'ultra')} fiche={(slug) => `/app/bibliotheque/${slug}`}
      nutritionHref={`/app/courses/${ID_VISITEUR}/nutrition`} profilHref="/app/profil?test=1"
      partager={<BoutonPartager modele={modeleCarte(dossier.reponse)} />}
      effacerStrategie={<EffacerStrategie action={async () => {
        const b = lireDossierBrouillon();
        if (b) garderDossierBrouillon({ ...b, strategie: null });
        setDossier(dossierDeLOnglet());
        return { ok: true, message: '' };
      }} />}
      avant={(
        <Carte className="space-y-1.5">
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Sans compte, ce dossier tient le temps de cette visite. Pour le garder sur ton téléphone et ton ordinateur, ton e-mail suffit, sans mot de passe.
          </p>
          <Link href="/app/me-connecter" className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Me connecter pour le garder ›</Link>
        </Carte>
      )}
      pied={(
        <>
          <AllerPlusLoin />
          <SupprimerDossier apres="/app/courses" action={async () => { effacerDossierBrouillon(); return { ok: true, message: '' }; }} />
        </>
      )} />
  );
}

// Le calculateur de nutrition ouvert depuis le dossier d'un visiteur : « Garder ma stratégie » la range dans l'onglet.
export function NutritionVisiteur({ titre }: { titre: string }) {
  const [dossier] = useDossier();
  if (dossier === undefined) return null;
  if (!dossier) return <div className="px-4 py-6"><Link href="/app/courses" className="font-bold text-teal">‹ Mes courses</Link></div>;
  const params = new URLSearchParams(parametresNutrition(dossier.reponse, dossier.strategie)).toString();
  return (
    <CadreSite src={`/calculateur-nutrition${params ? `?${params}` : ''}`} titre={titre}
      retour={{ href: `/app/courses/${ID_VISITEUR}`, libelle: 'Retour' }}
      garder={async (donnees) => garderStrategieDeLOnglet(donnees)} masquer=".titre .surtitre" />
  );
}
