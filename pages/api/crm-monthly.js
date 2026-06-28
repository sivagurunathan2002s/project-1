import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const { phone } = req.query;
  if (!phone || !phone.trim()) return res.status(200).json({ customer: null, monthly: [], orders: [] });
  const sql = getDb();

  const monthly = await sql`
    SELECT
      TO_CHAR(TO_DATE(o.order_date, 'YYYY-MM-DD'), 'Month YYYY') AS month_label,
      TO_CHAR(TO_DATE(o.order_date, 'YYYY-MM-DD'), 'YYYY-MM') AS month_key,
      COUNT(DISTINCT o.id) AS order_count,
      SUM(o.total_bill) AS total_spent,
      SUM(oi.quantity_bought) AS total_sacks
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN order_items oi ON oi.order_id = o.id
    WHERE c.phone_number = ${phone.trim()}
    GROUP BY month_label, month_key
    ORDER BY month_key DESC
  `;

  const custRows = await sql`SELECT customer_name, phone_number FROM customers WHERE phone_number = ${phone.trim()} LIMIT 1`;

  const orders = await sql`
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

  return res.status(200).json({ customer: custRows[0] || null, monthly, orders });
}
