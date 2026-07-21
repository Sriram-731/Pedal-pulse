-- 1. Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Clean up existing policies for these buckets to avoid conflicts during development
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Upload Policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat Media Upload Policy" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete Policy" ON storage.objects;

-- 3. Set up RLS Policies for 'avatars' bucket
CREATE POLICY "Avatar Public View"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Avatar Auth Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Avatar Owner Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Set up RLS Policies for 'chat-media' bucket
CREATE POLICY "Chat Media Public View"
ON storage.objects FOR SELECT
USING ( bucket_id = 'chat-media' );

CREATE POLICY "Chat Media Auth Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' 
  AND auth.role() = 'authenticated'
);
