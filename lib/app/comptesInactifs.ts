/**
 * Le passage quotidien des comptes inactifs (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, E7 ; la règle dans
 * lib/app/inactifs.ts), avec celui des relances (app/api/relance/envoyer) : un e-mail 30 jours avant, puis la
 * suppression, 3 ans après la dernière activité. La dernière activité : la plus récente de la création du compte, de la
 * dernière connexion par code et des sessions de l'app (fonction SQL derniere_activite). Sans cette fonction ou sans
 * BREVO_API_KEY, rien ne se passe : jamais une suppression sur une activité mal connue, jamais sans avertissement. La
 * date de l'avertissement est gardée avec le compte (app_metadata), rien d'autre. Côté serveur seulement.
 */
import { site } from '@/lib/content';
import { EXPEDITEUR, REPONSE } from './emailBienvenue';
import { effacerCompte } from './effacement';
import { gestesDuJour, type CompteAge } from './inactifs';
import { coachs } from './nolio';
import { clientService } from './supabase';

const PAR_PAGE = 1000;

export function contenuAvertissement(suppressionLe: string) {
  const date = new Date(suppressionLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
  const lien = `${site.url}/app`;
  const paragraphes = [
    `L’app CTS n’a pas été ouverte avec ton compte depuis près de 3 ans. Comme l’annonce notre politique de confidentialité, ton compte sera supprimé le ${date}, avec tes plans et leurs PDF.`,
    'Pour le garder, il suffit d’ouvrir l’app d’ici là. Si tu n’en as plus besoin, tu n’as rien à faire.',
  ];
  const signature = 'Juliette et Romain — CTS Coaching';
  const texte = ['Bonjour,', ...paragraphes, `Ouvrir l’app : ${lien}`, signature].join('\n\n');
  const p = (contenu: string) => `<p style="margin:0 0 16px;line-height:1.55">${contenu}</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#F3F7F0">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#2F2D4E">
${p('Bonjour,')}
${paragraphes.map(p).join('\n')}
<p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#0C6E5F;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px">Ouvrir l’app</a></p>
<p style="margin:24px 0 0;line-height:1.55;font-weight:bold">${signature}</p>
</div></body></html>`;
  return { sujet: `Ton compte CTS sera supprimé le ${date}`, texte, html };
}

async function envoyerAvertissement(email: string, suppressionLe: string, cle: string) {
  const { sujet, texte, html } = contenuAvertissement(suppressionLe);
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: EXPEDITEUR, replyTo: REPONSE, to: [{ email }], subject: sujet, textContent: texte, htmlContent: html }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}`);
}

const plusRecente = (dates: (string | null | undefined)[]) =>
  (dates.filter(Boolean) as string[]).reduce((a, b) => (new Date(b) > new Date(a) ? b : a));

// Rend ce qui a été fait ; « essai » calcule sans rien envoyer ni effacer.
export async function passerComptesInactifs(maintenant = new Date(), essai = false) {
  const rien = { avertis: 0, supprimes: 0 };
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) return rien;
  const service = clientService();
  const { data: activites, error } = await service.rpc('derniere_activite');
  if (error) {
    console.error('Comptes inactifs : la fonction derniere_activite ne répond pas :', error.message);
    return rien;
  }
  const vu = new Map((activites as { compte_id: string; vu_le: string }[] | null ?? []).map((a) => [a.compte_id, a.vu_le]));
  const comptes: CompteAge[] = [];
  const metadonnees = new Map<string, Record<string, unknown>>();
  for (let page = 1; ; page += 1) {
    const { data, error: erreur } = await service.auth.admin.listUsers({ page, perPage: PAR_PAGE });
    if (erreur) {
      console.error('Comptes inactifs : la liste des comptes ne répond pas :', erreur.message);
      return rien;
    }
    for (const u of data.users) {
      comptes.push({
        id: u.id, email: u.email ?? '', derniere: plusRecente([u.created_at, u.last_sign_in_at, vu.get(u.id)]),
        avertiLe: typeof u.app_metadata?.inactivite_avertie_le === 'string' ? u.app_metadata.inactivite_avertie_le : null,
      });
      metadonnees.set(u.id, u.app_metadata ?? {});
    }
    if (data.users.length < PAR_PAGE) break;
  }
  const fait = { ...rien };
  for (const g of gestesDuJour(comptes, maintenant, coachs())) {
    if (essai) {
      fait[g.geste === 'avertir' ? 'avertis' : 'supprimes'] += 1;
      continue;
    }
    try {
      if (g.geste === 'avertir') {
        if (!g.email) continue;
        await envoyerAvertissement(g.email, g.suppressionLe, cle);
        await service.auth.admin.updateUserById(g.id, {
          app_metadata: { ...metadonnees.get(g.id), inactivite_avertie_le: maintenant.toISOString() },
        });
        fait.avertis += 1;
      } else {
        await effacerCompte(service, g.id);
        fait.supprimes += 1;
      }
    } catch (e) {
      // Sans l'adresse : un journal de Vercel n'a pas à garder d'e-mail.
      console.error(`Compte inactif (${g.geste}) :`, e instanceof Error ? e.message : e);
    }
  }
  return fait;
}
