-- CTS — un plan par achat (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, webhook Stripe, 13/10/2026). La page
-- de retour du paiement et le webhook de Stripe rangent le même achat, parfois au même instant : l'index refuse
-- le second plan, et l'appel qui arrive en second reprend celui du premier (lib/app/rangement.ts), sans second
-- e-mail de bienvenue. Aucun achat n'était rangé deux fois au 13/10/2026 (vérifié). À exécuter une fois dans le
-- projet Supabase : SQL Editor, coller ce fichier, Run.

create unique index if not exists plans_un_par_achat on public.plans (achat_id) where achat_id is not null;
