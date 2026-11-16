'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { enregistrerDossier } from '@/lib/app/actionsCourses';
import { garderDossierBrouillon, lireBrouillon } from '@/lib/app/brouillonGratuit';
import {
  SAISIE_COURSE_VIDE, allegerReponse, appelerCourseLibre, construireDemande, reperesDuProfil,
  type SaisieCourse,
} from '@/lib/app/courseLibre';
import { calculer, type Experience, type TestsGratuits } from '@/lib/app/profilGratuit';
import { BOUTON, CHAMP, Carte, Surtitre, TITRE } from '../Ui';

// La nouvelle course (maquette « Course » validée le 16/11/2026) : sa trace GPX, ou sa distance et son D+ ; sa date ; le temps visé.
// Le navigateur appelle le moteur directement (la trace peut dépasser les 4,5 Mo que le serveur du site relaie ; le moteur ne
// garde rien). Les repères viennent du profil : un compte gratuit, celui qu'il a gardé (la FC seulement avec son accord) ; un
// visiteur, ce qu'il a sous les yeux dans l'onglet (sa vitesse critique seulement : la FC ne part jamais pour lui).
// Le fichier GPX n'est conservé nulle part : lu, envoyé au moteur, oublié.
const etiquette = 'block text-xs font-semibold text-indigo mb-1.5';
const TAILLE_MAX_GPX = 10 * 1024 * 1024;
// Le refus d'une trace trop lourde : la phrase du moteur (AF.1), dite avant l'envoi.
const TRACE_TROP_LOURDE = 'Ta trace GPX est trop lourde : exporte-la de nouveau, sans les points inutiles.';

export type ProfilDeLaCourse = { experience: Experience | null; tests: TestsGratuits; avecFc: boolean };

export default function FormulaireCourse({ compte, profil }: { compte: boolean; profil: ProfilDeLaCourse | null }) {
  const router = useRouter();
  const [saisie, setSaisie] = useState<SaisieCourse>(SAISIE_COURSE_VIDE);
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  // Le profil d'un visiteur : lu dans l'onglet, une fois la page chargée.
  const [vu, setVu] = useState<ProfilDeLaCourse | null>(profil);
  useEffect(() => {
    if (compte) return;
    const b = lireBrouillon();
    const c = b ? calculer(b, '') : null;
    setVu(c?.ok ? { experience: c.experience, tests: c.tests, avecFc: false } : { experience: b?.experience ?? null, tests: {}, avecFc: false });
  }, [compte]);

  const reperes = vu ? reperesDuProfil(vu.tests, vu.avecFc) : null;
  const champ = (cle: keyof SaisieCourse) => (e: React.ChangeEvent<HTMLInputElement>) => setSaisie((s) => ({ ...s, [cle]: e.target.value }));
  const aujourdhui = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    if (fichier && fichier.size > TAILLE_MAX_GPX) { setErreur(TRACE_TROP_LOURDE); return; }
    setEnCours(true);
    const demande = construireDemande(saisie, { experience: vu?.experience ?? null, reperes });
    const r = await appelerCourseLibre(demande, fichier);
    if (!r.ok) { setErreur(r.message); setEnCours(false); return; }
    // Ce qui se range : la réponse allégée, et ce qui est parti (jamais le fichier).
    const dossier = { entrees: { ...demande, trace: Boolean(fichier) }, reponse: allegerReponse(r.reponse), strategie: null };
    if (compte) {
      const s = await enregistrerDossier(dossier);
      if (!s.ok || !s.id) { setErreur(s.message || 'L’enregistrement n’a pas abouti. Réessaie dans un moment.'); setEnCours(false); return; }
      router.push(`/app/courses/${s.id}`);
      return;
    }
    // Un visiteur : son dossier tient le temps de l'onglet. Sans stockage (navigation privée stricte), il ne peut pas se garder.
    if (!garderDossierBrouillon(dossier)) { setErreur('Ce navigateur ne laisse rien garder le temps de la visite : le dossier ne peut pas s’afficher.'); setEnCours(false); return; }
    router.push('/app/courses/ici');
  }

  return (
    <form onSubmit={valider} className="space-y-4">
      <div className="space-y-2">
        <Surtitre>Ajouter une course</Surtitre>
        <h1 className={TITRE}>Une nouvelle course</h1>
        <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
          Sa trace GPX fait tout le dossier : profil, pentes, type de course. Sans trace, le dossier part du dénivelé total.
        </p>
      </div>

      <Carte className="space-y-3.5">
        <label className="block">
          <span className={etiquette}>Nom de la course</span>
          <input className={CHAMP} maxLength={120} value={saisie.nom} onChange={champ('nom')} placeholder="Trail de la Côte sauvage" autoComplete="off" />
        </label>
        <label className="block">
          <span className={etiquette}>Date</span>
          <input type="date" required min={aujourdhui} className={CHAMP} value={saisie.date} onChange={champ('date')} />
        </label>
        <div>
          <label className="block">
            <span className={etiquette}>Temps visé</span>
            <input required className={CHAMP} value={saisie.temps} onChange={champ('temps')} placeholder="2h15" autoComplete="off" inputMode="text" />
          </label>
          <p className="mt-1.5 text-[0.72rem] text-[#5E5C78] leading-relaxed">Écris-le comme 5h30, 5:30 ou 90 min.</p>
          <details className="mt-1">
            <summary className="cursor-pointer min-h-11 flex items-center text-[0.8125rem] font-bold text-teal">Je ne sais pas quel temps viser</summary>
            <p className="pb-2 text-[0.8125rem] text-[#4A4866] leading-relaxed">
              Pars du temps d’une course récente de distance et de dénivelé proches, ou du temps des arrivants de l’an dernier, donné sur le
              site de la course : ce n’est qu’un point de départ, tu pourras refaire le dossier avec un autre temps.
            </p>
          </details>
        </div>
      </Carte>

      <Carte className="space-y-3.5">
        <div>
          <span className={etiquette}>Sa trace GPX</span>
          <label className="flex items-center justify-center gap-2 min-h-12 rounded-xl border-[1.5px] border-dashed border-teal/45 px-3 text-[0.8125rem] font-bold text-teal cursor-pointer text-center">
            <input type="file" accept=".gpx,application/gpx+xml" className="sr-only"
              onChange={(e) => { setFichier(e.target.files?.[0] ?? null); setErreur(''); }} />
            {fichier ? fichier.name : 'Choisir la trace GPX'}
          </label>
          <p className="mt-1.5 text-[0.72rem] text-[#5E5C78] leading-relaxed">
            Le fichier .gpx de l’organisateur, ou exporté de ta montre. Il est analysé, puis seul le résultat est gardé, jamais le fichier.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={etiquette}>Distance · km</span>
            <input className={CHAMP} inputMode="decimal" value={saisie.distance} onChange={champ('distance')} placeholder={fichier ? 'selon la trace' : '18'} required={!fichier} />
          </label>
          <label className="block">
            <span className={etiquette}>D+ · m</span>
            <input className={CHAMP} inputMode="numeric" value={saisie.dplus} onChange={champ('dplus')} placeholder={fichier ? 'selon la trace' : '540'} required={!fichier} />
          </label>
        </div>
        {fichier && <p className="text-[0.72rem] text-[#5E5C78] leading-relaxed">Avec une trace, laisse ces deux cases vides : elle donne la distance et le dénivelé. Remplies, elles font foi.</p>}
      </Carte>

      <Carte className="space-y-1.5">
        <Surtitre>Tes repères</Surtitre>
        {reperes ? (
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Ton profil donne tes repères
            {vu?.experience ? '' : ', sans ton expérience en trail'} : le dossier s’en sert pour tes zones.
          </p>
        ) : (
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Sans test, le dossier n’a pas de zones : il se lit sans tes FC ni tes allures.{' '}
            <Link href="/app/profil?test=1" className="font-bold text-teal whitespace-nowrap">Faire un test ›</Link>
          </p>
        )}
        {vu && !vu.experience && (
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            Ton expérience n’est pas renseignée : le dossier suppose « intermédiaire ».{' '}
            <Link href="/app/profil?test=1" className="font-bold text-teal whitespace-nowrap">La renseigner ›</Link>
          </p>
        )}
      </Carte>

      {erreur && <p role="alert" className="text-sm text-[#9A3B2C]">{erreur}</p>}
      <button type="submit" disabled={enCours} className={`${BOUTON} w-full`}>{enCours ? 'Le dossier se prépare…' : 'Créer le dossier'}</button>
      <p className="text-xs text-[#5E5C78] leading-relaxed">Ces repères informent, ils ne remplacent pas un avis médical personnalisé.</p>
    </form>
  );
}

