CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$'),
  full_name text CHECK (full_name IS NULL OR char_length(full_name) <= 50),
  avatar_url text CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500),
  username_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.username_changed_at := CASE WHEN NEW.username IS NULL THEN NULL ELSE now() END;
    RETURN NEW;
  END IF;
  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF OLD.username_changed_at IS NOT NULL AND OLD.username IS NOT NULL
       AND OLD.username_changed_at > now() - interval '14 days' THEN
      RAISE EXCEPTION 'USERNAME_LOCKED: username can be changed once every 14 days';
    END IF;
    NEW.username_changed_at := now();
  ELSE
    NEW.username_changed_at := OLD.username_changed_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

CREATE POLICY "avatar public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatar own insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatar own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatar own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);