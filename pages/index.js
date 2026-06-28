import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

const api = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  patch: (url, body) => fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url) => fetch(url, { method: 'DELETE' }).then(r => r.json()),
};

function Toast({ msg, type, visible }) {
  return (
    <div style={{
      position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
      padding: '14px 28px', borderRadius: 10, fontWeight: 700, fontSize: 15,
      zIndex: 99999, opacity: visible ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: 'none',
      background: type === 'success' ? '#00e676' : type === 'error' ? '#ff5252' : '#00b0ff',
      color: type === 'success' ? '#0f2027' : 'white',
    }}>{msg}</div>
  );
}

function generateInvoicePDF(data) {
  const meta = data[0];
  let itemRows = '';
  let grandTotal = 0;
  data.forEach(item => {
    const subtotal = item.quantity_bought * item.price_at_sale;
    grandTotal += subtotal;
    itemRows += `<tr>
      <td style="padding:10px;border-bottom:1px solid #ddd">${item.product_name || '[Deleted Item]'}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd;text-align:center">${item.quantity_bought}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right">Rs.${parseFloat(item.price_at_sale).toFixed(2)}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right">Rs.${subtotal.toFixed(2)}</td>
    </tr>`;
  });
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #INV-${meta.orderId}</title>
  <style>body{font-family:Arial,sans-serif;padding:30px;color:#333}.header{display:flex;justify-content:space-between;margin-bottom:35px;border-bottom:2px solid #00e676;padding-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:25px}th{background:#f5f5f5;padding:12px;text-align:left;border-bottom:2px solid #ddd}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:25px;padding-top:10px;border-top:2px solid #333}@media print{body{padding:10px}}</style>
  </head><body>
  <div class="header"><div><h2 style="margin:0">AMUTHAN CATTLE FEEDS</h2><p style="margin:4px 0">Madurai, Tamil Nadu</p></div>
  <div style="text-align:right"><h3 style="margin:0">INVOICE: #INV-${meta.orderId}</h3><p style="margin:4px 0">${meta.order_date} | ${meta.order_time}</p></div></div>
  <div style="margin-bottom:20px"><strong>Customer:</strong> ${meta.customer_name}<br><strong>Phone:</strong> ${meta.phone_number}</div>
  <table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Subtotal</th></tr></thead>
  <tbody>${itemRows}</tbody></table>
  <div class="total">Grand Total: Rs.${grandTotal.toFixed(2)}</div>
  <script>window.onload=function(){window.print()}<\/script></body></html>`;
  const pw = window.open('', '_blank', 'width=800,height=600');
  if (pw) { pw.document.write(html); pw.document.close(); }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('billing');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState({ msg: '', type: 'info', visible: false });
  const toastTimer = useRef(null);

  // Billing
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [knownCustomer, setKnownCustomer] = useState(false);
  const [selProduct, setSelProduct] = useState('');
  const [qty, setQty] = useState(1);

  // Warehouse
  const [newName, setNewName] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [addError, setAddError] = useState('');

  // Restock modal
  const [restockModal, setRestockModal] = useState(false);
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockQty, setRestockQty] = useState(10);

  // Invoice modal
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  // Analytics
  const [filterMode, setFilterMode] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [analyticsRows, setAnalyticsRows] = useState([]);
  const [analyticsSummary, setAnalyticsSummary] = useState('');

  // CRM
  const [crmPhone, setCrmPhone] = useState('');
  const [crmView, setCrmView] = useState('list'); // 'list' | 'monthly'
  const [crmRows, setCrmRows] = useState([]);
  const [crmSummary, setCrmSummary] = useState('');
  const [crmMonthly, setCrmMonthly] = useState([]);
  const [crmCustomer, setCrmCustomer] = useState(null);
  const [crmMonthlyOrders, setCrmMonthlyOrders] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type, visible: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(p => ({ ...p, visible: false })), 3500);
  }, []);

  const loadProducts = useCallback(async () => {
    const data = await api.get('/api/products');
    setProducts(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { loadProducts(); }, []);

  // ── Phone autofill ────────────────────────────────────────────────────────
  const phoneDebounce = useRef(null);
  function handlePhoneChange(val) {
    setCustPhone(val);
    setKnownCustomer(false);
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current);
    if (val.replace(/\D/g, '').length >= 10) {
      setIsLookingUp(true);
      phoneDebounce.current = setTimeout(async () => {
        const data = await api.get(`/api/customer-lookup?phone=${encodeURIComponent(val)}`);
        setIsLookingUp(false);
        if (data && data.customer_name) {
          setCustName(data.customer_name);
          setKnownCustomer(true);
          showToast(`👤 Returning customer: ${data.customer_name}`, 'info');
        }
      }, 500);
    } else {
      setIsLookingUp(false);
    }
  }

  // ── Warehouse ─────────────────────────────────────────────────────────────
  async function submitNewProduct() {
    setAddError('');
    if (!newName.trim()) { setAddError('Product name is required.'); return; }
    if (newStock === '' || parseInt(newStock, 10) < 0) { setAddError('Stock must be 0 or more.'); return; }
    if (!newPrice || parseFloat(newPrice) <= 0) { setAddError('Price must be greater than zero.'); return; }
    const res = await api.post('/api/products', { name: newName, stock: parseInt(newStock, 10), price: parseFloat(newPrice) });
    if (res.success) {
      setNewName(''); setNewStock(''); setNewPrice('');
      showToast(`Product "${newName}" added!`, 'success');
      await loadProducts();
    } else {
      setAddError('Error: ' + res.message);
    }
  }

  async function confirmRestock() {
    if (!restockQty || restockQty <= 0) { showToast('Enter a valid quantity.', 'error'); return; }
    const res = await api.patch(`/api/products/${restockTarget.id}`, { additionalStock: restockQty });
    setRestockModal(false);
    if (res.success) { showToast('Stock updated!', 'success'); await loadProducts(); }
    else showToast('Error: ' + res.message, 'error');
  }

  async function deleteProduct(id, name) {
    if (!confirm(`Delete "${name}" from warehouse? This cannot be undone.`)) return;
    const res = await api.del(`/api/products/${id}`);
    if (res.success) { showToast('Product deleted.', 'info'); await loadProducts(); }
    else showToast('Error: ' + res.message, 'error');
  }

  // ── Cart / Billing ────────────────────────────────────────────────────────
  function addToCart() {
    const pId = parseInt(selProduct);
    const q = parseInt(qty, 10);
    if (!pId || isNaN(pId)) { showToast('Select a valid product.', 'error'); return; }
    if (!q || q < 1) { showToast('Quantity must be at least 1.', 'error'); return; }
    const prod = products.find(x => x.id === pId);
    if (!prod) { showToast('Product not found. Refresh and try again.', 'error'); return; }
    const inCart = (cart.find(i => i.productId === pId) || {}).quantity || 0;
    if (prod.stock_quantity < inCart + q) {
      showToast(`Only ${prod.stock_quantity - inCart} sacks available.`, 'error'); return;
    }
    setCart(prev => {
      const ex = prev.find(i => i.productId === pId);
      if (ex) return prev.map(i => i.productId === pId ? { ...i, quantity: i.quantity + q } : i);
      return [...prev, { productId: pId, name: prod.product_name, price: parseFloat(prod.price_per_sack), quantity: q }];
    });
    setQty(1);
    showToast(`Added ${q} x ${prod.product_name}`, 'success');
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  async function checkout() {
    if (!custName.trim()) { showToast('Enter customer name.', 'error'); return; }
    if (!custPhone.trim()) { showToast('Enter phone number.', 'error'); return; }
    if (cart.length === 0) { showToast('Cart is empty.', 'error'); return; }
    const res = await api.post('/api/checkout', {
      customerName: custName, phoneNumber: custPhone,
      items: cart, totalBill: parseFloat(cartTotal.toFixed(2))
    });
    if (res.success) {
      showToast('SMS sent to customer!', 'success');
      const details = await api.get(`/api/order/${res.orderId}`);
      if (details && details.length > 0) {
        setInvoiceData(details);
        setInvoiceModal(true);
      } else {
        showToast('Order saved, invoice unavailable.', 'info');
        resetBilling(); await loadProducts();
      }
    } else {
      showToast('Checkout failed: ' + res.message, 'error');
    }
  }

  function resetBilling() {
    setCart([]); setCustName(''); setCustPhone(''); setQty(1); setKnownCustomer(false);
  }

  function closeInvoice() {
    setInvoiceModal(false); setInvoiceData(null);
    resetBilling(); loadProducts();
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    if (filterMode === 'day' && !filterDate) { showToast('Select a date.', 'error'); return; }
    const params = new URLSearchParams({ filterMode, specificDate: filterDate });
    const data = await api.get(`/api/analytics?${params}`);
    setAnalyticsRows(Array.isArray(data) ? data : []);
    if (data && data.length > 0) {
      const total = data.reduce((s, r) => s + parseFloat(r.total_bill || 0), 0);
      setAnalyticsSummary(`${data.length} order${data.length !== 1 ? 's' : ''} — Total Revenue: Rs.${total.toFixed(2)}`);
    } else setAnalyticsSummary('');
  }, [filterMode, filterDate, showToast]);

  useEffect(() => { if (activeTab === 'analytics') loadAnalytics(); }, [activeTab]);

  // ── CRM ───────────────────────────────────────────────────────────────────
  async function fetchCRM() {
    if (!crmPhone.trim()) { showToast('Enter a phone number.', 'error'); return; }
    const data = await api.get(`/api/crm?phone=${encodeURIComponent(crmPhone)}`);
    setCrmRows(Array.isArray(data) ? data : []);
    setCrmView('list');
    setCrmMonthly([]); setCrmCustomer(null); setSelectedMonth(null);
    if (data && data.length > 0) {
      const total = data.reduce((s, r) => s + parseFloat(r.total_bill || 0), 0);
      setCrmSummary(`${data.length} order${data.length !== 1 ? 's' : ''} — Total Spent: Rs.${total.toFixed(2)}`);
    } else setCrmSummary('');
  }

  async function loadMonthlyReport() {
    if (!crmPhone.trim()) { showToast('Enter a phone number first.', 'error'); return; }
    const data = await api.get(`/api/crm-monthly?phone=${encodeURIComponent(crmPhone)}`);
    setCrmCustomer(data.customer || null);
    setCrmMonthly(Array.isArray(data.monthly) ? data.monthly : []);
    setCrmMonthlyOrders(Array.isArray(data.orders) ? data.orders : []);
    setCrmView('monthly');
    setSelectedMonth(null);
  }

  async function reprintOrder(orderId) {
    const data = await api.get(`/api/order/${orderId}`);
    if (data && data.length > 0) generateInvoicePDF(data);
    else showToast('Could not load invoice.', 'error');
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    body: { fontFamily: "'Segoe UI', sans-serif", margin: 0, background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', color: '#f5f6fa', minHeight: '100vh' },
    nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,32,39,0.8)', padding: '15px 40px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    brand: { fontSize: 24, fontWeight: 800, background: 'linear-gradient(to right, #00e676, #00b0ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    tabBtn: (active) => ({ background: active ? '#00e676' : 'rgba(255,255,255,0.06)', border: `1px solid ${active ? '#00e676' : 'rgba(255,255,255,0.1)'}`, color: active ? '#0f2027' : 'rgba(255,255,255,0.6)', padding: '12px 24px', borderRadius: 30, fontWeight: 600, cursor: 'pointer', transition: '0.3s', boxShadow: active ? '0 0 20px rgba(0,230,118,0.4)' : 'none' }),
    screen: { padding: 40 },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 35 },
    card: { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 30 },
    label: { fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'block', marginTop: 15, textTransform: 'uppercase' },
    input: { width: '100%', padding: 14, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white', boxSizing: 'border-box', marginTop: 5 },
    btn: (bg = '#00e676', color = '#0f2027') => ({ width: '100%', padding: 15, marginTop: 20, background: bg, color, border: 'none', fontSize: 16, fontWeight: 700, borderRadius: 8, cursor: 'pointer' }),
    th: { padding: 14, textAlign: 'left', background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)' },
    td: { padding: 14, borderBottom: '1px solid rgba(255,255,255,0.08)' },
    miniBtn: (bg) => ({ padding: '6px 12px', background: bg, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', marginRight: 4 }),
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
    modal: { background: '#1e3c45', border: '1px solid rgba(255,255,255,0.1)', padding: 35, borderRadius: 16, width: 550, maxHeight: '90vh', overflowY: 'auto' },
    monthCard: (selected) => ({ background: selected ? 'rgba(0,230,118,0.15)' : 'rgba(0,0,0,0.25)', border: `1px solid ${selected ? '#00e676' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '14px 18px', cursor: 'pointer', marginBottom: 10, transition: '0.2s' }),
  };

  const ordersForMonth = selectedMonth
    ? crmMonthlyOrders.filter(o => o.order_date && o.order_date.startsWith(selectedMonth))
    : [];

  return (
    <>
      <Head>
        <title>Cattle Feed Enterprise Ledger</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={s.body}>
        <Toast msg={toast.msg} type={toast.type} visible={toast.visible} />

        {/* Invoice Modal */}
        {invoiceModal && invoiceData && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <h2 style={{ marginTop: 0, color: '#00e676' }}>Invoice #INV-{invoiceData[0].orderId}</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                <strong>Customer:</strong> {invoiceData[0].customer_name} ({invoiceData[0].phone_number})<br />
                <strong>Date/Time:</strong> {invoiceData[0].order_date} | {invoiceData[0].order_time}
              </p>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: 15, borderRadius: 8, maxHeight: 200, overflowY: 'auto', margin: '15px 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={s.th}>Feed Item</th><th style={s.th}>Qty</th><th style={s.th}>Rate</th><th style={s.th}>Subtotal</th></tr></thead>
                  <tbody>
                    {invoiceData.map((item, i) => {
                      const cost = item.quantity_bought * item.price_at_sale;
                      return <tr key={i}><td style={s.td}>{item.product_name}</td><td style={s.td}>{item.quantity_bought}</td><td style={s.td}>Rs.{parseFloat(item.price_at_sale).toFixed(2)}</td><td style={s.td}>Rs.{cost.toFixed(2)}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 'bold', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span>Net Total Payable:</span>
                <span style={{ color: '#00e676' }}>Rs.{invoiceData.reduce((s, i) => s + i.quantity_bought * i.price_at_sale, 0).toFixed(2)}</span>
              </div>
              <p style={{ fontSize: 13, color: '#00e676', marginTop: 10, textAlign: 'center' }}>SMS confirmation sent to customer's phone</p>
              <div style={{ display: 'flex', gap: 15, marginTop: 20 }}>
                <button style={{ flex: 1, padding: 14, fontSize: 15, fontWeight: 'bold', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#00e676', color: '#0f2027' }}
                  onClick={() => { generateInvoicePDF(invoiceData); closeInvoice(); }}>Print / Save PDF</button>
                <button style={{ flex: 1, padding: 14, fontSize: 15, fontWeight: 'bold', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                  onClick={closeInvoice}>Close & Next Bill</button>
              </div>
            </div>
          </div>
        )}

        {/* Restock Modal */}
        {restockModal && restockTarget && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, width: 380 }}>
              <h2 style={{ marginTop: 0, color: '#00b0ff' }}>Restock Product</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>Product: {restockTarget.name}</p>
              <label style={s.label}>Additional Sacks to Add</label>
              <input style={s.input} type="number" min="1" value={restockQty} onChange={e => setRestockQty(parseInt(e.target.value, 10))} />
              <div style={{ display: 'flex', gap: 15, marginTop: 25 }}>
                <button style={{ flex: 1, padding: 14, fontSize: 15, fontWeight: 'bold', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#00b0ff', color: 'white' }} onClick={confirmRestock}>Add Stock</button>
                <button style={{ flex: 1, padding: 14, fontSize: 15, fontWeight: 'bold', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }} onClick={() => setRestockModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={s.nav}>
          <div style={s.brand}>Amuthan Cattle Feeds</div>
          <div style={{ display: 'flex', gap: 15 }}>
            {[['billing', 'Billing'], ['warehouse', 'Warehouse'], ['analytics', 'Analytics'], ['crm', 'Customer CRM']].map(([id, label]) => (
              <button key={id} style={s.tabBtn(activeTab === id)} onClick={() => { setActiveTab(id); if (id === 'analytics') setTimeout(loadAnalytics, 50); }}>{label}</button>
            ))}
          </div>
        </div>

        {/* ── BILLING ── */}
        {activeTab === 'billing' && (
          <div style={s.screen}>
            <div style={s.grid}>
              <div style={s.card}>
                <h2>Construct Customer Bill</h2>
                <label style={s.label}>Mobile Number</label>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...s.input, borderColor: knownCustomer ? '#00e676' : 'rgba(255,255,255,0.1)' }}
                    placeholder="Enter number to auto-fill name" maxLength={15}
                    value={custPhone} onChange={e => handlePhoneChange(e.target.value)} />
                  {isLookingUp && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#00b0ff', fontSize: 12 }}>Looking up...</span>}
                  {knownCustomer && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#00e676', fontSize: 14 }}>Known</span>}
                </div>
                <label style={s.label}>Buyer Name</label>
                <input style={{ ...s.input, background: knownCustomer ? 'rgba(0,230,118,0.08)' : 'rgba(0,0,0,0.4)', borderColor: knownCustomer ? '#00e676' : 'rgba(255,255,255,0.1)' }}
                  placeholder="Auto-filled or type name" value={custName} onChange={e => { setCustName(e.target.value); setKnownCustomer(false); }} />
                {knownCustomer && <p style={{ fontSize: 12, color: '#00e676', margin: '4px 0 0' }}>Returning customer — name auto-filled</p>}
                <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.1)', margin: '25px 0' }} />
                <label style={s.label}>Feed Product Line</label>
                <select style={s.input} value={selProduct} onChange={e => setSelProduct(e.target.value)}>
                  <option value="">— Select product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.product_name} ({p.stock_quantity} left) — Rs.{p.price_per_sack}</option>)}
                </select>
                <label style={s.label}>Number of Sacks</label>
                <input style={s.input} type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value, 10))} />
                <button style={s.btn('#ff9100', 'white')} onClick={addToCart}>Add to Cart</button>
              </div>
              <div style={s.card}>
                <h2>Active Checkout Queue</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={s.th}>Product</th><th style={s.th}>Unit Price</th><th style={s.th}>Qty</th><th style={s.th}>Subtotal</th><th style={s.th}></th></tr></thead>
                  <tbody>
                    {cart.length === 0
                      ? <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Cart is empty.</td></tr>
                      : cart.map(item => (
                        <tr key={item.productId}>
                          <td style={s.td}>{item.name}</td>
                          <td style={s.td}>Rs.{item.price.toFixed(2)}</td>
                          <td style={s.td}>{item.quantity}</td>
                          <td style={s.td}>Rs.{(item.price * item.quantity).toFixed(2)}</td>
                          <td style={s.td}><button onClick={() => setCart(c => c.filter(i => i.productId !== item.productId))} style={{ background: '#ff5252', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>X</button></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, padding: 15, background: 'rgba(0,0,0,0.2)', borderRadius: 8, fontSize: 18, fontWeight: 'bold' }}>
                  <span>Net Invoice Value:</span>
                  <span style={{ color: '#00e676' }}>Rs.{cartTotal.toFixed(2)}</span>
                </div>
                <button style={s.btn()} onClick={checkout}>Generate Bill + Send SMS</button>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 8 }}>SMS will be sent to customer from Amuthan Cattle Feeds</p>
              </div>
            </div>
          </div>
        )}

        {/* ── WAREHOUSE ── */}
        {activeTab === 'warehouse' && (
          <div style={s.screen}>
            <div style={s.grid}>
              <div style={s.card}>
                <h2>Add New Feed Brand</h2>
                <label style={s.label}>Brand / Product Name</label>
                <input style={s.input} placeholder="e.g. Gold Cattle Mix" value={newName} onChange={e => setNewName(e.target.value)} />
                <label style={s.label}>Starting Inventory (Sacks)</label>
                <input style={s.input} type="number" placeholder="e.g. 100" min="0" value={newStock} onChange={e => setNewStock(e.target.value)} />
                <label style={s.label}>Selling Price Per Sack (Rs.)</label>
                <input style={s.input} type="number" placeholder="e.g. 850" min="0.01" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                <button style={s.btn()} onClick={submitNewProduct}>Deploy to Storefront</button>
                {addError && <div style={{ color: '#ff5252', marginTop: 10, fontSize: 13 }}>{addError}</div>}
              </div>
              <div style={s.card}>
                <h2>Warehouse Inventory Matrix</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={s.th}>Product</th><th style={s.th}>Stock</th><th style={s.th}>Price</th><th style={s.th}>Actions</th></tr></thead>
                  <tbody>
                    {products.length === 0
                      ? <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No products in warehouse. Add one!</td></tr>
                      : products.map(p => {
                        const low = p.stock_quantity <= 5;
                        return (
                          <tr key={p.id}>
                            <td style={s.td}>{p.product_name}</td>
                            <td style={{ ...s.td, color: low ? '#ff5252' : 'inherit' }}>{p.stock_quantity} Sacks{low ? ' !' : ''}</td>
                            <td style={s.td}>Rs.{parseFloat(p.price_per_sack).toFixed(2)}</td>
                            <td style={s.td}>
                              <button style={s.miniBtn('#00b0ff')} onClick={() => { setRestockTarget({ id: p.id, name: p.product_name }); setRestockQty(10); setRestockModal(true); }}>Restock</button>
                              <button style={s.miniBtn('#ff5252')} onClick={() => deleteProduct(p.id, p.product_name)}>Delete</button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <div style={s.screen}>
            <div style={s.card}>
              <h2>Sales History & Analytics</h2>
              <div style={{ display: 'flex', gap: 15, alignItems: 'flex-end', marginBottom: 25, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={s.label}>Filter Mode</label>
                  <select style={s.input} value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                    <option value="all">Entire History</option>
                    <option value="day">Day-Wise</option>
                  </select>
                </div>
                {filterMode === 'day' && (
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={s.label}>Select Date</label>
                    <input style={s.input} type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                  </div>
                )}
                <button style={{ ...s.btn('#ff9100', 'white'), width: 'auto', padding: '12px 25px', margin: 0 }} onClick={loadAnalytics}>Generate Report</button>
              </div>
              {analyticsSummary && (
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '12px 18px', marginBottom: 18, fontSize: 15 }}>{analyticsSummary}</div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={s.th}>Invoice ID</th><th style={s.th}>Timestamp</th><th style={s.th}>Customer</th><th style={s.th}>Items</th><th style={s.th}>Value</th><th style={s.th}>Action</th></tr></thead>
                <tbody>
                  {analyticsRows.length === 0
                    ? <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No records found.</td></tr>
                    : analyticsRows.map(r => (
                      <tr key={r.orderId}>
                        <td style={s.td}>#INV-{r.orderId}</td>
                        <td style={s.td}>{r.order_date} {r.order_time}</td>
                        <td style={{ ...s.td, color: '#00b0ff', cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => { setCrmPhone(r.phone_number); setActiveTab('crm'); setTimeout(loadMonthlyReport, 100); }}
                          title="View monthly report for this customer">
                          {r.customer_name}
                        </td>
                        <td style={{ ...s.td, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.items_summary}>{r.items_summary}</td>
                        <td style={s.td}>Rs.{parseFloat(r.total_bill).toFixed(2)}</td>
                        <td style={s.td}><button style={s.miniBtn('#00b0ff')} onClick={() => reprintOrder(r.orderId)}>Print</button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CRM ── */}
        {activeTab === 'crm' && (
          <div style={s.screen}>
            <div style={s.card}>
              <h2>Customer CRM Ledger</h2>
              <div style={{ display: 'flex', gap: 15, marginBottom: 20, maxWidth: 600, flexWrap: 'wrap' }}>
                <input style={{ ...s.input, flex: 1 }} placeholder="Enter Mobile Number..." maxLength={15}
                  value={crmPhone} onChange={e => setCrmPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchCRM()} />
                <button style={{ ...s.btn('#00b0ff', 'white'), width: 'auto', padding: '12px 20px', margin: 0 }} onClick={fetchCRM}>Search Orders</button>
                <button style={{ ...s.btn('#00e676', '#0f2027'), width: 'auto', padding: '12px 20px', margin: 0 }} onClick={loadMonthlyReport}>Monthly Report</button>
              </div>

              {/* List View */}
              {crmView === 'list' && (
                <>
                  {crmSummary && <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '12px 18px', marginBottom: 18, fontSize: 15 }}>{crmSummary}</div>}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={s.th}>Timestamp</th><th style={s.th}>Items</th><th style={s.th}>Total Bill</th><th style={s.th}>Action</th></tr></thead>
                    <tbody>
                      {crmRows.length === 0
                        ? <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No orders found. Search a phone number above.</td></tr>
                        : crmRows.map(row => (
                          <tr key={row.orderId}>
                            <td style={s.td}>{row.order_date} {row.order_time}</td>
                            <td style={s.td}>{row.description}</td>
                            <td style={s.td}>Rs.{parseFloat(row.total_bill).toFixed(2)}</td>
                            <td style={s.td}><button style={s.miniBtn('#00b0ff')} onClick={() => reprintOrder(row.orderId)}>Print</button></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Monthly Report View */}
              {crmView === 'monthly' && (
                <>
                  {crmCustomer && (
                    <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: 10, padding: '14px 20px', marginBottom: 20 }}>
                      <strong style={{ fontSize: 18 }}>{crmCustomer.customer_name}</strong>
                      <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 12 }}>{crmCustomer.phone_number}</span>
                      <span style={{ float: 'right', color: '#00e676', fontWeight: 700 }}>
                        Total all-time: Rs.{crmMonthlyOrders.reduce((s, o) => s + parseFloat(o.total_bill || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: selectedMonth ? '1fr 1.5fr' : '1fr', gap: 20 }}>
                    <div>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12, textTransform: 'uppercase' }}>Click a month to see orders</p>
                      {crmMonthly.length === 0
                        ? <p style={{ color: 'rgba(255,255,255,0.4)' }}>No purchase history found.</p>
                        : crmMonthly.map(m => (
                          <div key={m.month_key} style={s.monthCard(selectedMonth === m.month_key)}
                            onClick={() => setSelectedMonth(selectedMonth === m.month_key ? null : m.month_key)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: 16 }}>{m.month_label}</strong>
                              <span style={{ color: '#00e676', fontWeight: 700 }}>Rs.{parseFloat(m.total_spent).toFixed(2)}</span>
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>
                              {m.order_count} order{m.order_count != 1 ? 's' : ''} &bull; {m.total_sacks} sacks purchased
                            </div>
                          </div>
                        ))}
                    </div>

                    {selectedMonth && (
                      <div>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12, textTransform: 'uppercase' }}>
                          Orders in {crmMonthly.find(m => m.month_key === selectedMonth)?.month_label}
                        </p>
                        {ordersForMonth.length === 0
                          ? <p style={{ color: 'rgba(255,255,255,0.4)' }}>No orders found for this month.</p>
                          : ordersForMonth.map(o => (
                            <div key={o.orderId} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#00b0ff', fontWeight: 600 }}>#INV-{o.orderId}</span>
                                <span style={{ color: '#00e676', fontWeight: 700 }}>Rs.{parseFloat(o.total_bill).toFixed(2)}</span>
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0' }}>{o.order_date} {o.order_time}</div>
                              <div style={{ fontSize: 13 }}>{o.description}</div>
                              <button style={{ ...s.miniBtn('#00b0ff'), marginTop: 8, fontSize: 12 }} onClick={() => reprintOrder(o.orderId)}>Print Invoice</button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <button style={{ ...s.btn('rgba(255,255,255,0.08)', 'white'), marginTop: 20 }} onClick={() => { setCrmView('list'); setSelectedMonth(null); }}>
                    Back to Order List
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
