import { Carte, Surtitre } from './Ui';
import { enClair, momentsEnClair, objectifEnClair, telephoneEnClair } from '@/lib/app/coachingRegles';
import type { Jointes, LigneDemande } from '@/lib/app/demandesCoaching';
import { titreExperience } from '@/lib/app/profilGratuit';
import { allure, profilCoureur } from '@/lib/app/zones';

// Une demande de coaching, lue en entier par le coach (app gratuite, lot A2) : ses réponses, ce que l'app sait déjà de la personne
// (expérience, tests, style, courses : joints sans qu'elle les redonne), sa santé SEULEMENT si le consentement est donné, le
// téléphone en lien « tel: » et les moments d'appel.
const mois = (iso: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)).replace(/^1 /, '1er ');

function Ligne({ titre, valeur }: { titre: string; valeur: React.ReactNode }) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-0.5 py-2 border-t first:border-t-0 border-indigo/[0.07] text-sm">
      <dt className="text-[#5E5C78] font-semibold">{titre}</dt>
      <dd className="text-indigo whitespace-pre-line break-words">{valeur}</dd>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return <Carte className="!p-5 space-y-1"><Surtitre>{titre}</Surtitre><dl>{children}</dl></Carte>;
}

export default function DemandeLue({ d, jointes }: { d: LigneDemande; jointes: Jointes }) {
  const r = d.reponses;
  const t = jointes.tests;
  const profil = t.vc ? { vc_ms: t.vc.vc_ms, d_prime_m: t.vc.d_prime_m } : null;
  const style = profil ? profilCoureur(profil) : null;
  const experience = r.experience_trail ?? jointes.experience;
  return (
    <>
      <Bloc titre="Pour l’appeler">
        <Ligne titre="Téléphone" valeur={d.telephone ? <a href={`tel:${d.telephone}`} className="font-bold text-teal">{telephoneEnClair(d.telephone)}</a> : null} />
        <Ligne titre="Moments possibles" valeur={momentsEnClair(d.moments)} />
        <Ligne titre="Un mot" valeur={r.mot} />
      </Bloc>

      <Bloc titre="Son objectif">
        <Ligne titre="Course" valeur={r.objectif ? objectifEnClair(r.objectif) : null} />
        <Ligne titre="Ce qui est visé" valeur={r.vise ? `${enClair.vise(r.vise)}${r.vise_autre ? ` : ${r.vise_autre}` : ''}` : null} />
      </Bloc>

      <Bloc titre="Son vécu">
        <Ligne titre="Année de naissance" valeur={r.naissance ? String(r.naissance) : null} />
        <Ligne titre="Court depuis" valeur={r.course_depuis ? enClair.depuis(r.course_depuis) : null} />
        <Ligne titre="Expérience en trail" valeur={experience ? `${enClair.experience(experience) ?? ''}${r.experience_trail ? '' : ' (repris de son profil)'}` : null} />
        <Ligne titre="Courses marquantes" valeur={r.courses_marquantes} />
      </Bloc>

      <Bloc titre="Sa semaine aujourd’hui">
        <Ligne titre="Séances par semaine" valeur={r.seances ? enClair.seances(r.seances) : null} />
        <Ligne titre="Heures par semaine" valeur={r.heures != null ? `${r.heures.toLocaleString('fr-FR')} h` : null} />
        <Ligne titre="Plus longue sortie" valeur={r.longue} />
      </Bloc>

      <Bloc titre="Son terrain">
        <Ligne titre="Près de chez la personne" valeur={r.terrain?.length ? r.terrain.map(enClair.terrain).join(', ') : null} />
        <Ligne titre="D+ possible" valeur={r.dplus_pres} />
        <Ligne titre="Montagne" valeur={r.montagne ? enClair.montagne(r.montagne) : null} />
      </Bloc>

      <Bloc titre="Ses disponibilités et sa montre">
        <Ligne titre="Jours possibles" valeur={r.jours?.length ? r.jours.map(enClair.jour).join(', ') : null} />
        <Ligne titre="Temps d’une séance" valeur={r.temps_seance ? enClair.tempsSeance(r.temps_seance) : null} />
        <Ligne titre="Sortie longue" valeur={r.jour_sl ? enClair.jour(r.jour_sl) : null} />
        <Ligne titre="Montre" valeur={r.montre ? enClair.montre(r.montre) : null} />
        <Ligne titre="Compte Nolio" valeur={r.nolio ? enClair.nolio(r.nolio) : null} />
      </Bloc>

      {r.attentes && <Bloc titre="Ce qui est attendu d’un coach"><Ligne titre="Ses mots" valeur={r.attentes} /></Bloc>}

      {/* La santé : seulement avec le consentement (la base le refuse aussi sans lui). */}
      {d.sante && d.consentement_sante_le && (
        <Bloc titre="Sa santé (avec son accord)">
          <Ligne titre="Ses mots" valeur={d.sante} />
          <Ligne titre="Accord donné le" valeur={mois(d.consentement_sante_le)} />
        </Bloc>
      )}

      <Bloc titre="Ce que l’app sait déjà de la personne">
        <Ligne titre="Expérience du profil" valeur={titreExperience(jointes.experience)} />
        <Ligne titre="Vitesse critique" valeur={t.vc ? `${allure(t.vc.vc_ms)} /km · D′ ${Math.round(t.vc.d_prime_m)} m · test du ${mois(t.vc.le)}` : null} />
        <Ligne titre="Style de coureur" valeur={style ? style.nom : null} />
        {jointes.consentementFc && <Ligne titre="FC au seuil 1" valeur={t.parole ? `${t.parole.fc_seuil1} bpm${t.parole.v_seuil1_ms ? ` · à ${allure(t.parole.v_seuil1_ms)} /km` : ''}` : null} />}
        {jointes.consentementFc && <Ligne titre="FC au seuil 2" valeur={t.fc2 ? `${t.fc2.fc_seuil2} bpm` : null} />}
        {!jointes.consentementFc && (t.parole || t.fc2) && <Ligne titre="FC" valeur="Pas de consentement : non montrée" />}
        {!t.vc && !t.parole && !t.fc2 && !jointes.experience && <Ligne titre="Tests" valeur="Aucun test dans son profil." />}
      </Bloc>

      <Bloc titre="Ses courses dans l’app">
        {jointes.courses.length === 0 ? <Ligne titre="Courses" valeur="Aucune course dans l’app." /> : jointes.courses.map((c) => (
          <Ligne key={c.id} titre={c.course_date ? mois(c.course_date) : 'Sans date'}
            valeur={[c.nom, c.distance_km != null ? `${c.distance_km.toLocaleString('fr-FR')} km` : null, c.dplus_m != null ? `${c.dplus_m.toLocaleString('fr-FR')} m D+` : null,
              c.temps_vise_s ? `visée ${Math.floor(c.temps_vise_s / 3600)} h ${String(Math.round((c.temps_vise_s % 3600) / 60)).padStart(2, '0')}` : null].filter(Boolean).join(' · ')} />
        ))}
      </Bloc>
    </>
  );
}
