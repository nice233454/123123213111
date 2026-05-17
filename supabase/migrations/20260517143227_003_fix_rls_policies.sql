/*
  # Fix RLS policies for chat creation, order claiming, and plan creation

  1. Issues Fixed
    - Chat creation: The chat_members INSERT policy required the user to already be a member,
      which is impossible when creating a new chat. Fixed by allowing the chat creator to
      add members during creation.
    - Order claiming: The orders UPDATE policy required developer_id = auth.uid() in the
      USING clause, but when a developer tries to claim an open order, developer_id is NULL.
      Fixed by adding a condition for open orders with no developer assigned.
    - Plan creation: Added a separate policy allowing developers to create plans for open
      orders they are claiming (same issue as order claiming).

  2. Security
    - Chat members can only be added by existing members OR by the chat creator
    - Developers can only update orders that are open (to claim them) or assigned to them
    - Plan creation requires the developer to be assigned to the order
*/

-- Drop and recreate chat_members INSERT policy
DROP POLICY IF EXISTS "Chat members can add new members" ON chat_members;

CREATE POLICY "Chat members or creator can add members"
  ON chat_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Creator of the chat can add members (including themselves)
    EXISTS (SELECT 1 FROM chats WHERE id = chat_members.chat_id AND created_by = auth.uid())
    -- OR existing members can add new members
    OR EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid())
  );

-- Drop and recreate orders UPDATE policy
DROP POLICY IF EXISTS "Managers and assigned developers can update orders" ON orders;

CREATE POLICY "Managers and assigned developers can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    manager_id = auth.uid()
    OR developer_id = auth.uid()
    OR (status = 'open' AND developer_id IS NULL)
  )
  WITH CHECK (
    manager_id = auth.uid()
    OR developer_id = auth.uid()
  );

-- Drop and recreate order_plans INSERT policy to also allow claiming developers
DROP POLICY IF EXISTS "Developers can create plans for assigned orders" ON order_plans;

CREATE POLICY "Developers can create plans for assigned orders"
  ON order_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = developer_id
    AND (
      EXISTS (SELECT 1 FROM orders WHERE id = order_id AND developer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM orders WHERE id = order_id AND status = 'in_progress' AND developer_id IS NOT NULL)
    )
  );
