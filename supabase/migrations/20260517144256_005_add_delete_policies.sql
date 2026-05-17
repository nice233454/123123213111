/*
  # Add DELETE policies for orders and order_comments

  1. New Policies
    - Managers can delete their own orders
    - Comment authors or order manager can delete comments

  2. Security
    - Only the manager who created the order can delete it
    - Comment authors can delete their own comments
    - Order managers can delete any comment on their orders
*/

-- Allow managers to delete their own orders
CREATE POLICY "Managers can delete own orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    manager_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Allow comment authors or order manager to delete comments
CREATE POLICY "Author or manager can delete comments"
  ON order_comments FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_comments.order_id
      AND orders.manager_id = auth.uid()
    )
  );
