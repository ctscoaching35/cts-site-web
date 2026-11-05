/**
 * ÉCRIRE À CTS DEPUIS L'APP (Q5, décision coach du 05/11/2026 au soir, « A », avec la règle du même soir : « pour les
 * plans, pas d'interaction avec moi ») : un acheteur n'est invité nulle part à échanger sur son entraînement ; les
 * contacts de service restent (l'achat, l'app, l'invitation Nolio, la date de course, la rétractation, ses données). Un
 * seul lien, vers l'adresse de réponse de l'e-mail de bienvenue : la ligne de Compte, et les messages qui disaient
 * « réponds simplement à ton e-mail de bienvenue ».
 */
import { site } from '@/lib/content';

export const ECRIRE_A_CTS = `mailto:${site.email}`;
