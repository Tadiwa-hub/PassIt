-- ==========================================
-- PASSIT SUPABASE SQL SCHEMA
-- ==========================================

-- 1. Profiles Table (Extends Supabase Auth)
-- Stores custom user data like subscription status and roles.
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  has_active_subscription BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Note: You should create a trigger in Supabase to automatically create a profile when a new auth.user signs up.
-- Trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Subjects Table (e.g., Mathematics, Physics, Chemistry)
CREATE TABLE subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  color_hex TEXT, -- e.g., #FFD700 for Maths
  icon_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Topics Table (e.g., Quantum Mechanics under Physics)
CREATE TABLE topics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  topic_order INTEGER NOT NULL DEFAULT 0, -- Used to order topics logically
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Videos Table (The actual lessons)
CREATE TABLE videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL, -- Link to Cloudinary/Mux or Supabase Storage
  duration_minutes INTEGER,
  video_order INTEGER NOT NULL DEFAULT 0,
  is_free_preview BOOLEAN DEFAULT false, -- Set true if this video can be watched without a subscription
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. User Progress Table (Tracks completed videos)
CREATE TABLE user_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, video_id) -- A user can only have one progress record per video
);


-- 6. User Subscriptions Table (Links users to paid subjects)
CREATE TABLE user_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, subject_id)
);


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read and update their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Public Data: Anyone authenticated can view subjects, topics, and video metadata
CREATE POLICY "Anyone can view subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Anyone can view topics" ON topics FOR SELECT USING (true);
CREATE POLICY "Anyone can view videos" ON videos FOR SELECT USING (true);

-- Progress: Users can only see and update their own progress
CREATE POLICY "Users view own progress" ON user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON user_progress FOR UPDATE USING (auth.uid() = user_id);

-- Subscriptions: Users can see their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Admins: Can do everything
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT role = 'admin' FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Admins can do everything on subjects" ON subjects FOR ALL USING (is_admin());
CREATE POLICY "Admins can do everything on topics" ON topics FOR ALL USING (is_admin());
CREATE POLICY "Admins can do everything on videos" ON videos FOR ALL USING (is_admin());
CREATE POLICY "Admins can do everything on user_subscriptions" ON user_subscriptions FOR ALL USING (is_admin());


-- ==========================================
-- SEED DATA (CORE SUBJECTS)
-- ==========================================
INSERT INTO subjects (title, description, color_hex, icon_name) VALUES
('Mathematics', 'Pure Maths, Mechanics & Statistics', '#FFD700', 'Target'),
('Physics', 'Quantum Mechanics, Waves & Dynamics', '#00E5FF', 'Trophy'),
('Chemistry', 'Organic, Physical & Inorganic Chemistry', '#39FF14', 'BookOpen');
