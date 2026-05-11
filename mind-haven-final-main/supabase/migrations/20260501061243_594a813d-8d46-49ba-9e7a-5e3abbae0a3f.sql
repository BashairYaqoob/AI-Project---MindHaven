
-- =========================
-- Sentiment scoring
-- =========================
CREATE OR REPLACE FUNCTION public.calc_sentiment(_text text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  pos_words text[] := ARRAY[
    'happy','joy','joyful','grateful','thankful','love','loved','loving','calm','peace','peaceful',
    'hope','hopeful','excited','great','good','wonderful','amazing','beautiful','content','proud',
    'relaxed','relief','relieved','smile','smiling','laugh','laughing','blessed','warm','safe',
    'better','strong','enough','present','soft','gentle','kind','okay','ok','fine','rest','rested'
  ];
  neg_words text[] := ARRAY[
    'sad','depressed','depression','anxious','anxiety','worried','worry','scared','afraid','fear',
    'angry','anger','mad','furious','tired','exhausted','drained','lonely','alone','empty','numb',
    'hurt','hurting','pain','painful','cry','crying','cried','tears','hate','hated','awful','terrible',
    'bad','worse','worst','overwhelmed','stressed','stress','hopeless','helpless','broken','lost',
    'guilty','shame','ashamed','disappointed','frustrated','heavy','dark'
  ];
  lower_text text;
  pos_count int := 0;
  neg_count int := 0;
  w text;
  total int;
BEGIN
  IF _text IS NULL OR length(trim(_text)) = 0 THEN
    RETURN 0;
  END IF;
  lower_text := ' ' || lower(_text) || ' ';
  FOREACH w IN ARRAY pos_words LOOP
    pos_count := pos_count + (length(lower_text) - length(replace(lower_text, ' ' || w || ' ', ''))) / (length(w) + 2);
  END LOOP;
  FOREACH w IN ARRAY neg_words LOOP
    neg_count := neg_count + (length(lower_text) - length(replace(lower_text, ' ' || w || ' ', ''))) / (length(w) + 2);
  END LOOP;
  total := pos_count + neg_count;
  IF total = 0 THEN
    RETURN 0;
  END IF;
  RETURN round(((pos_count - neg_count)::numeric / total::numeric)::numeric, 3);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_journal_sentiment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.sentiment_score := public.calc_sentiment(NEW.text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journal_entries_set_sentiment ON public.journal_entries;
CREATE TRIGGER journal_entries_set_sentiment
  BEFORE INSERT OR UPDATE OF text ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_journal_sentiment();

-- Backfill existing entries
UPDATE public.journal_entries
SET sentiment_score = public.calc_sentiment(text)
WHERE text IS NOT NULL;

-- =========================
-- Seed 5 surveys + questions
-- =========================
DO $$
DECLARE
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid;
BEGIN
  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM public.surveys WHERE title = 'How are you, really?') THEN
    RETURN;
  END IF;

  INSERT INTO public.surveys (title, description) VALUES
    ('How are you, really?', 'A gentle weekly check-in. No right answers — only honest ones.')
    RETURNING id INTO s1;
  INSERT INTO public.surveys (title, description) VALUES
    ('The Quiet Mind', 'A soft reflection on worry and unease over the past two weeks.')
    RETURNING id INTO s2;
  INSERT INTO public.surveys (title, description) VALUES
    ('Beneath the Surface', 'A careful look at low mood and heaviness over the past two weeks.')
    RETURNING id INTO s3;
  INSERT INTO public.surveys (title, description) VALUES
    ('Rest & Restoration', 'How your body and mind have been resting lately.')
    RETURNING id INTO s4;
  INSERT INTO public.surveys (title, description) VALUES
    ('Thread of Connection', 'A reflection on closeness, belonging, and the people around you.')
    RETURNING id INTO s5;

  -- Survey 1
  INSERT INTO public.survey_questions (survey_id, question_type, question_text) VALUES
    (s1, 'scale', 'Overall, how steady has this past week felt?'),
    (s1, 'scale', 'How present have you felt in your own life?'),
    (s1, 'scale', 'How kind have you been to yourself?'),
    (s1, 'scale', 'How clear is your mind right now?'),
    (s1, 'text',  'Is there anything you have been carrying quietly? You may name it here.');

  -- Survey 2 — anxiety (soft GAD-style)
  INSERT INTO public.survey_questions (survey_id, question_type, question_text) VALUES
    (s2, 'scale', 'How often have you felt nervous or on edge?'),
    (s2, 'scale', 'How often has worry been hard to set down?'),
    (s2, 'scale', 'How often have small things felt larger than usual?'),
    (s2, 'scale', 'How often has it been hard to soften and rest?'),
    (s2, 'scale', 'How often have you felt a quiet sense of dread?');

  -- Survey 3 — low mood (soft PHQ-style)
  INSERT INTO public.survey_questions (survey_id, question_type, question_text) VALUES
    (s3, 'scale', 'How often have you felt little interest in things you usually love?'),
    (s3, 'scale', 'How often has a heaviness sat with you?'),
    (s3, 'scale', 'How often has sleep felt off — too little, too much, or restless?'),
    (s3, 'scale', 'How often has your energy felt low?'),
    (s3, 'scale', 'How often have you been hard on yourself in your thoughts?');

  -- Survey 4 — sleep & energy
  INSERT INTO public.survey_questions (survey_id, question_type, question_text) VALUES
    (s4, 'scale', 'How restful has your sleep felt this week?'),
    (s4, 'scale', 'How clear and unhurried have your mornings been?'),
    (s4, 'scale', 'How well have you let yourself pause during the day?'),
    (s4, 'scale', 'How often have you moved your body in a way that felt good?'),
    (s4, 'text',  'What is one small thing that would help you rest better this week?');

  -- Survey 5 — connection
  INSERT INTO public.survey_questions (survey_id, question_type, question_text) VALUES
    (s5, 'scale', 'How seen have you felt by the people close to you?'),
    (s5, 'scale', 'How easy has it been to say what you actually feel?'),
    (s5, 'scale', 'How present have you been with others, when together?'),
    (s5, 'scale', 'How held do you feel in your life right now?'),
    (s5, 'text',  'Who has felt like a quiet shelter to you lately?');
END $$;
