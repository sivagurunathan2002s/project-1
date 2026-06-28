export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ success: false, message: 'Phone and message are required.' });

  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  try {
    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone, message, key: process.env.TEXTBELT_API_KEY || 'textbelt' }),
    });
    const data = await response.json();
    if (data.success) return res.status(200).json({ success: true, quotaRemaining: data.quotaRemaining });
    return res.status(200).json({ success: false, message: data.error || 'SMS failed.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'SMS service unreachable.' });
  }
}
