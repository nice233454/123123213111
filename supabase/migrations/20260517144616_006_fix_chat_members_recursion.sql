/*
  # Fix infinite recursion in chat_members policies

  The problem: Both SELECT and INSERT policies on chat_members
  reference chat_members itself in subqueries, causing infinite recursion.

  Solution: Use a security definer function to check membership
  without triggering RLS recursion. This function runs with elevated
  privileges and bypasses RLS, breaking the recursion cycle.

  1. New function
    - is_chat_member(chat_id, user_id) - checks if user is a member of a chat
    - Runs as SECURITY DEFINER to bypass RLS on chat_members

  2. Updated policies
    - SELECT: uses is_chat_member() instead of self-referencing subquery
    - INSERT: uses is_chat_member() and checks chats.created_by
*/

-- Create a security definer function to check chat membership
-- This breaks the recursion by bypassing RLS when checking membership
CREATE OR REPLACE FUNCTION is_chat_member(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_id = p_chat_id AND user_id = p_user_id
  );
$$;

-- Drop and recreate SELECT policy
DROP POLICY IF EXISTS "Chat members can view other members" ON chat_members;

CREATE POLICY "Chat members can view other members"
  ON chat_members FOR SELECT
  TO authenticated
  USING (is_chat_member(chat_id, auth.uid()));

-- Drop and recreate INSERT policy
DROP POLICY IF EXISTS "Chat members or creator can add members" ON chat_members;

CREATE POLICY "Chat members or creator can add members"
  ON chat_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Creator of the chat can add members
    EXISTS (SELECT 1 FROM chats WHERE id = chat_members.chat_id AND created_by = auth.uid())
    -- OR existing members can add new members
    OR is_chat_member(chat_members.chat_id, auth.uid())
  );
