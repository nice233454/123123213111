/*
  # Team Messenger - Initial Schema

  1. New Tables
    - `profiles` - User profiles with role (manager/developer), linked to auth.users
    - `orders` - Work orders created by managers, assigned to developers
    - `order_comments` - Comments on orders for communication
    - `order_plans` - Execution plans with stages for developers
    - `order_plan_stages` - Individual stages within a plan
    - `order_files` - Files attached to orders (deliverables)
    - `chats` - Chat rooms (direct and group)
    - `chat_members` - Members of chat rooms
    - `messages` - Chat messages

  2. Security
    - RLS enabled on all tables
    - Policies restrict access based on authentication and ownership/membership
    - Managers can create/update orders; developers can claim and update assigned orders
    - Chat access restricted to members only

  3. Important Notes
    - Roles: 'manager' or 'developer'
    - Order statuses: 'open', 'in_progress', 'review', 'revision', 'completed'
    - Chat types: 'direct' (1-on-1) or 'group'
*/

-- Create all tables first

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'developer' CHECK (role IN ('manager', 'developer')),
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'review', 'revision', 'completed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  deadline timestamptz,
  manager_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  developer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  developer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_plan_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES order_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_plan_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Orders policies

CREATE POLICY "Authenticated users can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "Managers and assigned developers can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    manager_id = auth.uid()
    OR developer_id = auth.uid()
  )
  WITH CHECK (
    manager_id = auth.uid()
    OR developer_id = auth.uid()
  );

-- Order comments policies

CREATE POLICY "Authenticated users can view order comments"
  ON order_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can add order comments"
  ON order_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Order plans policies

CREATE POLICY "Authenticated users can view order plans"
  ON order_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Developers can create plans for assigned orders"
  ON order_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = developer_id
    AND EXISTS (SELECT 1 FROM orders WHERE id = order_id AND developer_id = auth.uid())
  );

CREATE POLICY "Plan creator can update plan"
  ON order_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = developer_id)
  WITH CHECK (auth.uid() = developer_id);

-- Order plan stages policies

CREATE POLICY "Authenticated users can view plan stages"
  ON order_plan_stages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Plan owner can insert stages"
  ON order_plan_stages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM order_plans WHERE id = plan_id AND developer_id = auth.uid())
  );

CREATE POLICY "Plan owner can update stages"
  ON order_plan_stages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM order_plans WHERE id = plan_id AND developer_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM order_plans WHERE id = plan_id AND developer_id = auth.uid())
  );

-- Order files policies

CREATE POLICY "Authenticated users can view order files"
  ON order_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload order files"
  ON order_files FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "File uploader or order manager can delete files"
  ON order_files FOR DELETE
  TO authenticated
  USING (
    uploader_id = auth.uid()
    OR EXISTS (SELECT 1 FROM orders WHERE id = order_id AND manager_id = auth.uid())
  );

-- Chats policies

CREATE POLICY "Chat members can view chats"
  ON chats FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_id = chats.id AND user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create chats"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Chat creator can update chat"
  ON chats FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Chat members policies

CREATE POLICY "Chat members can view other members"
  ON chat_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid())
  );

CREATE POLICY "Chat members can add new members"
  ON chat_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_id = chat_members.chat_id AND user_id = auth.uid())
  );

-- Messages policies

CREATE POLICY "Chat members can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid())
  );

CREATE POLICY "Chat members can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid())
  );

-- Indexes for performance

CREATE INDEX IF NOT EXISTS idx_orders_manager ON orders(manager_id);
CREATE INDEX IF NOT EXISTS idx_orders_developer ON orders(developer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_comments_order ON order_comments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_plans_order ON order_plans(order_id);
CREATE INDEX IF NOT EXISTS idx_order_stages_plan ON order_plan_stages(plan_id);
CREATE INDEX IF NOT EXISTS idx_order_files_order ON order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

-- Auto-update updated_at trigger

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER order_plans_updated_at
  BEFORE UPDATE ON order_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
