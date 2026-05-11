-- Enable RLS and add policies for user data tables
ALTER TABLE public."Profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

-- Rename "Profiles" to profiles (lowercase) for convention; if it errors due to existing, skip
-- Keep as-is to avoid breaking. Add user_id link via id column matching auth.uid()

-- Profiles policies (id = auth.uid())
CREATE POLICY "Users view own profile" ON public."Profiles"
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public."Profiles"
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public."Profiles"
  FOR UPDATE USING (auth.uid() = id);

-- Journal entries policies
CREATE POLICY "Users view own journal" ON public.journal_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own journal" ON public.journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own journal" ON public.journal_entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own journal" ON public.journal_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Mood logs policies
CREATE POLICY "Users view own moods" ON public.mood_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own moods" ON public.mood_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own moods" ON public.mood_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own moods" ON public.mood_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Recommendations policies (read-only for users)
CREATE POLICY "Users view own recommendations" ON public.recommendations
  FOR SELECT USING (auth.uid() = user_id);

-- Surveys: publicly readable
CREATE POLICY "Anyone can view surveys" ON public.surveys
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view survey questions" ON public.survey_questions
  FOR SELECT USING (true);

-- Survey responses
CREATE POLICY "Users view own responses" ON public.survey_responses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own responses" ON public.survey_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."Profiles" (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();