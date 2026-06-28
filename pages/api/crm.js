import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const { phone } = req.query;
  if (!phone || !phone.trim()) return res.status(200).json([]);
  const sql = getDb();
  const rows = await sql`
    SELECT o.id as "orderId", o.order_date, o.order_time, o.total_bill,
           STRING_AGG(COALESCE(p.product_name, '[Deleted Brand]') || ' x' || oi.quantity_bought, ' | ') as description
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE c.phone_number = ${phone.trim()}
    GROUP BY o.id, o.order_date, o.order_time, o.total_bill
    ORDER BY o.id DESC
  `;
  return res.status(200).json(rows || []);
}
