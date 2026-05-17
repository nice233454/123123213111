/*
  # Fix order_plans INSERT policy

  The previous policy had an overly restrictive condition that could fail
  when a developer just claimed an order. Simplified to check that the
  developer is assigned to the order.
*/

DROP POLICY IF EXISTS "Developers can create plans for assigned orders" ON order_plans;

CREATE POLICY "Developers can create plans for assigned orders"
  ON order_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = developer_id
    AND EXISTS (SELECT 1 FROM orders WHERE id = order_id AND developer_id = auth.uid())
  );
