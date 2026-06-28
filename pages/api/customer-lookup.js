import { getDb } from '../../lib/db';

export default async function handler(req, res) {
  const { phone } = req.query;
  if (!phone || !phone.trim()) return res.status(200).json(null);
  const sql = getDb();
  const rows = await sql`SELECT customer_name, phone_number FROM customers WHERE phone_number = ${phone.trim()} LIMIT 1`;
  if (rows.length === 0) return res.status(200).json(null);
  return res.status(200).json(rows[0]);
}
