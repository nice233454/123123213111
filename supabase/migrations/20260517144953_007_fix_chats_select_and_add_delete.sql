/*
  # Fix chats SELECT policy to avoid recursion

  The chats SELECT policy references chat_members, which can still
  cause recursion issues. Fix by using the is_chat_member() function.

  Also add DELETE policy for chats (creator can delete their chat).
*/

-- Fix chats SELECT policy
DROP POLICY IF EXISTS "Chat members can view chats" ON chats;

CREATE POLICY "Chat members can view chats"
  ON chats FOR SELECT
  TO authenticated
  USING (is_chat_member(id, auth.uid()));

-- Add DELETE policy for chats
CREATE POLICY "Chat creator can delete chat"
  ON chats FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
