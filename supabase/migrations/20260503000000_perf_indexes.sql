-- Performance indexes recommended by Supabase advisor.
-- Both queries scan small-but-growing tables on a single column; adding btree
-- indexes prevents the API timeouts we saw when Supabase throttled under load.

CREATE INDEX IF NOT EXISTS idx_composer_experience_qubes_created_at
  ON public.composer_experience_qubes USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_nakamoto_knyt_personas_user_id
  ON public.nakamoto_knyt_personas USING btree (user_id);
