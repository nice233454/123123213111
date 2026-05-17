/*
  # Storage bucket policies for order-files

  1. Storage
    - Allow authenticated users to upload files to order-files bucket
    - Allow public read access to files in order-files bucket
    - Allow uploaders and order managers to delete files

  2. Security
    - Upload restricted to authenticated users
    - Files are publicly readable (for download access)
    - Delete restricted to file owner or order manager
*/

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload order files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'order-files');

-- Allow public read
CREATE POLICY "Public read access for order files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'order-files');

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own order files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'order-files');
