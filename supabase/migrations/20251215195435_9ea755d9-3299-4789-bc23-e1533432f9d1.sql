-- Make avatars bucket private
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Add RLS policies for trade-images bucket (already private)
CREATE POLICY "Users can upload own trade images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'trade-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own trade images"
ON storage.objects FOR SELECT
USING (bucket_id = 'trade-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own trade images"
ON storage.objects FOR DELETE
USING (bucket_id = 'trade-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add RLS policies for avatars bucket
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);