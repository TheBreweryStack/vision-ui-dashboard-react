-- Drop the existing SELECT policy that only allows admin
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create new policy that allows both admin AND owner to view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO public
USING (
  auth.uid() = id 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role)
);