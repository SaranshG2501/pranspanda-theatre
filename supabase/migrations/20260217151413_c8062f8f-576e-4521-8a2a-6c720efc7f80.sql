
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 1. allowed_users table
CREATE TABLE public.allowed_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  uti TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. seat_layout table
CREATE TABLE public.seat_layout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Main Theatre',
  total_rows INTEGER NOT NULL DEFAULT 20,
  total_columns INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. seats table
CREATE TABLE public.seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_layout_id UUID NOT NULL REFERENCES public.seat_layout(id) ON DELETE CASCADE,
  row_num INTEGER NOT NULL,
  col_num INTEGER NOT NULL,
  is_booked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(seat_layout_id, row_num, col_num)
);

-- 4. user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- 5. bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL UNIQUE REFERENCES public.seats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Helper function: has_role (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function: check if user already has a booking
CREATE OR REPLACE FUNCTION public.user_has_booking(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings WHERE user_id = _user_id
  )
$$;

-- Helper function: check if seat is available
CREATE OR REPLACE FUNCTION public.seat_is_available(_seat_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT is_booked FROM public.seats WHERE id = _seat_id
$$;

-- Helper function: validate allowed email
CREATE OR REPLACE FUNCTION public.is_allowed_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_users WHERE email = lower(_email)
  )
$$;

-- Helper function: get UTI for email (used by edge function only, security definer)
CREATE OR REPLACE FUNCTION public.get_uti_for_email(_email TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uti FROM public.allowed_users WHERE email = lower(_email)
$$;

-- Trigger to update seat is_booked on booking insert
CREATE OR REPLACE FUNCTION public.mark_seat_booked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.seats SET is_booked = true WHERE id = NEW.seat_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_created
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.mark_seat_booked();

-- Trigger to free seat on booking delete
CREATE OR REPLACE FUNCTION public.free_seat_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.seats SET is_booked = false WHERE id = OLD.seat_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_booking_deleted
AFTER DELETE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.free_seat_on_delete();

-- Trigger to handle seat reassignment (update booking)
CREATE OR REPLACE FUNCTION public.handle_booking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.seat_id <> NEW.seat_id THEN
    UPDATE public.seats SET is_booked = false WHERE id = OLD.seat_id;
    UPDATE public.seats SET is_booked = true WHERE id = NEW.seat_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_updated
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.handle_booking_update();

-- RLS Policies for allowed_users (no SELECT on uti for non-admins)
CREATE POLICY "Admins can do everything on allowed_users"
ON public.allowed_users FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for seat_layout
CREATE POLICY "Anyone authenticated can view seat layout"
ON public.seat_layout FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage seat layout"
ON public.seat_layout FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for seats
CREATE POLICY "Anyone authenticated can view seats"
ON public.seats FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage seats"
ON public.seats FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for bookings
CREATE POLICY "Users can view own bookings"
ON public.bookings FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can book if no existing booking and seat available"
ON public.bookings FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT public.user_has_booking(auth.uid())
  AND public.seat_is_available(seat_id)
);

CREATE POLICY "Admins can manage all bookings"
ON public.bookings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bookings"
ON public.bookings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Function to generate seats for a layout
CREATE OR REPLACE FUNCTION public.generate_seats_for_layout(_layout_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rows INTEGER;
  _cols INTEGER;
  r INTEGER;
  c INTEGER;
BEGIN
  SELECT total_rows, total_columns INTO _rows, _cols
  FROM public.seat_layout WHERE id = _layout_id;

  -- Delete existing unbooked seats for this layout
  DELETE FROM public.seats
  WHERE seat_layout_id = _layout_id AND is_booked = false;

  -- Insert new seats (skip existing booked ones)
  FOR r IN 1.._rows LOOP
    FOR c IN 1.._cols LOOP
      INSERT INTO public.seats (seat_layout_id, row_num, col_num)
      VALUES (_layout_id, r, c)
      ON CONFLICT (seat_layout_id, row_num, col_num) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- Insert default seat layout
INSERT INTO public.seat_layout (name, total_rows, total_columns)
VALUES ('Main Theatre', 20, 10);

-- Generate seats for the default layout
SELECT public.generate_seats_for_layout(id) FROM public.seat_layout LIMIT 1;
