
-- Function to get user email by ID (for admin use in bookings view)
CREATE OR REPLACE FUNCTION public.get_user_email_by_id(_user_id UUID)
RETURNS TABLE(email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email::TEXT FROM auth.users WHERE id = _user_id
$$;
