import { getDb } from '../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;
  const sql = getDb();
  const rows = await sql`
    SELECT o.id as "orderId", o.order_date, o.order_time, o.total_bill,
           c.customer_name, c.phone_number,
           COALESCE(p.product_name, '[Deleted Brand]') AS product_name,
           oi.quantity_bought, oi.price_at_sale
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.id = ${id}
  `;
  if (!rows || rows.length === 0) return res.status(404).json(null);
  return res.status(200).json(rows);
}
