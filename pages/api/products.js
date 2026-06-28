import { getDb, initDB } from '../../lib/db';

export default async function handler(req, res) {
  await initDB();
  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM products ORDER BY id DESC`;
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { name, stock, price } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Product name cannot be empty.' });
    const cleanStock = parseInt(stock, 10);
    const cleanPrice = parseFloat(price);
    if (isNaN(cleanStock) || cleanStock < 0) return res.status(400).json({ success: false, message: 'Stock must be a non-negative number.' });
    if (isNaN(cleanPrice) || cleanPrice <= 0) return res.status(400).json({ success: false, message: 'Price must be a positive number.' });
    const rows = await sql`
      INSERT INTO products (product_name, stock_quantity, price_per_sack)
      VALUES (${name.trim()}, ${cleanStock}, ${cleanPrice})
      RETURNING id
    `;
    return res.status(200).json({ success: true, id: rows[0].id });
  }

  res.status(405).end();
}
