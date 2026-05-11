-- Allow users to insert their own recommendations
CREATE POLICY "Users insert own recommendations"
ON public.recommendations
FOR INSERT
WITH CHECK (auth.uid() = user_id);