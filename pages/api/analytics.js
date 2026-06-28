import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const { filterMode, specificDate } = req.query;
  const sql = getDb();

  let rows;
  if (filterMode === 'day' && specificDate) {
    rows = await sql`
      SELECT o.id as "orderId", o.order_date, o.order_time, o.total_bill,
             c.customer_name, c.phone_number,
             STRING_AGG(COALESCE(p.product_name, '[Deleted Brand]') || ' (' || oi.quantity_bought || ' sacks)', ', ') as items_summary
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.order_date = ${specificDate}
      GROUP BY o.id, o.order_date, o.order_time, o.total_bill, c.customer_name, c.phone_number
      ORDER BY o.id DESC
    `;
  } else {
    rows = await sql`
      SELECT o.id as "orderId", o.order_date, o.order_time, o.total_bill,
             c.customer_name, c.phone_number,
             STRING_AGG(COALESCE(p.product_name, '[Deleted Brand]') || ' (' || oi.quantity_bought || ' sacks)', ', ') as items_summary
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      GROUP BY o.id, o.order_date, o.order_time, o.total_bill, c.customer_name, c.phone_number
      ORDER BY o.id DESC
    `;
  }
  return res.status(200).json(rows || []);
}
