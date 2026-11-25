-- L'e-mail d'un coaché, gardé à la création de sa fiche (« Nouveau coaché », décision 241 du coach, 25/11/2026, retouche) : rien n'est envoyé. Le lien de son app ne partira que par un geste explicite du coach
-- (« Inviter dans l'app », qui le reprend). Écrite, pas appliquée.
alter table public.athletes_coaches add column if not exists email_app text;
