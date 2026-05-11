
-- 1) Add options column for dynamic survey answer choices per question
ALTER TABLE public.survey_questions
  ADD COLUMN IF NOT EXISTS options jsonb;

-- 2) Lock down SECURITY DEFINER helpers from being callable via PostgREST.
-- They are still callable from RLS policies and triggers (those run as table owner).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.calc_sentiment(text)            FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_journal_sentiment()         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()               FROM anon, authenticated, public;

-- 3) Ensure the journal sentiment trigger is actually attached
DROP TRIGGER IF EXISTS journal_entries_set_sentiment ON public.journal_entries;
CREATE TRIGGER journal_entries_set_sentiment
  BEFORE INSERT OR UPDATE OF text ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_journal_sentiment();

-- 4) Ensure new auth users get a profile + default 'user' role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
