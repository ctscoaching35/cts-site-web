/**
 * L'accès d'un athlète coaché à l'app (CTS_NOLIO_CADRAGE.md, T6, décision coach du 19/10/2026) : sur sa fiche, son
 * coach donne une adresse et l'invite ; le site lui crée un compte (ou reprend le sien, s'il a déjà acheté un plan),
 * le relie à sa fiche et lui envoie le lien de l'app ; il s'y connecte par un code. Il voit son tableau de bord :
 * ses objectifs, leur trame, ses graphiques, ses fiches. Côté serveur seulement. Le texte de l'e-mail est un
 * BROUILLON, à valider par le coach.
 */
import { site } from '@/lib/content';
import { EXPEDITEUR } from './emailBienvenue';
import { coachs } from './nolio';
import { clientService } from './supabase';

const echapper = (texte: string) => texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function ouvrirEspace(coachId: string, athlete: { id: string; nom: string }, email: string): Promise<void> {
  if (coachs().includes(email)) throw new Error('C’est l’adresse d’un compte coach : donne celle de l’athlète.');
  const service = clientService();
  const { error: erreurCreation } = await service.auth.admin.createUser({ email, email_confirm: true });
  if (erreurCreation && erreurCreation.code !== 'email_exists') throw new Error(`compte : ${erreurCreation.message}`);
  const { data: lien, error: erreurLien } = await service.auth.admin.generateLink({ type: 'magiclink', email });
  if (erreurLien || !lien.user) throw new Error(`compte : ${erreurLien?.message ?? 'sans utilisateur'}`);
  const compteId = lien.user.id;
  // Un compte qui existe déjà (un plan acheté) garde son nom.
  await service.from('comptes').upsert({ id: compteId, nom: athlete.nom }, { onConflict: 'id', ignoreDuplicates: true });
  const { error } = await service.from('athletes_coaches').update({ compte_id: compteId }).eq('id', athlete.id).eq('coach_id', coachId);
  if (error) throw new Error(`fiche : ${error.message}`);
  await envoyerLien(email, athlete.nom);
}

export async function fermerEspace(coachId: string, athleteId: string): Promise<void> {
  await clientService().from('athletes_coaches').update({ compte_id: null }).eq('id', athleteId).eq('coach_id', coachId);
}

// L'adresse du compte relié à une fiche, pour la montrer au coach.
export async function adresseDuCompte(compteId: string | null): Promise<string | null> {
  if (!compteId) return null;
  const { data } = await clientService().auth.admin.getUserById(compteId);
  return data?.user?.email ?? null;
}

async function envoyerLien(email: string, nom: string) {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) {
    console.warn('Lien de l’app non envoyé : BREVO_API_KEY absente.');
    return;
  }
  const lienApp = `${site.url}/app`;
  const prenom = nom.trim().split(/\s+/)[0] ?? nom;
  const paragraphes = [
    'Ton coach t’ouvre ton espace CTS : ton tableau de bord, la vue d’ensemble de ta préparation, ta fiche de course '
      + 'et les fiches de la bibliothèque. Tes séances restent dans Nolio.',
    'Pour te connecter, l’app te demande cette adresse e-mail, puis t’y envoie un code à 6 chiffres. Ajoute-la à '
      + 'l’écran d’accueil de ton téléphone : elle te montre comment à la première ouverture.',
  ];
  const signature = 'Juliette et Romain — CTS Coaching';
  const p = (contenu: string) => `<p style="margin:0 0 16px;line-height:1.55">${contenu}</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#F3F7F0">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#2F2D4E">
${p(`Bonjour ${echapper(prenom)},`)}
${p(echapper(paragraphes[0]))}
<p style="margin:24px 0"><a href="${echapper(lienApp)}" style="display:inline-block;background:#0C6E5F;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px">Ouvrir mon espace</a></p>
${p(echapper(paragraphes[1]))}
<p style="margin:24px 0 0;line-height:1.55;font-weight:bold">${signature}</p>
</div></body></html>`;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: EXPEDITEUR, replyTo: EXPEDITEUR, to: [{ email, name: nom }], subject: 'Ton espace CTS est ouvert',
      textContent: [`Bonjour ${prenom},`, paragraphes[0], `Ouvrir mon espace : ${lienApp}`, paragraphes[1], signature].join('\n\n'),
      htmlContent: html,
    }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}`);
}
