import React, { useState, useEffect } from 'react';

const DAY_LABELS = {
  '2026-06-16': 'Tuesday, June 16',
  '2026-06-17': 'Wednesday, June 17',
};

function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) onLogin();
      else setError('Invalid password');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'white', padding: 40, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.1)', width: 320 }}>
        <h1 style={{ marginTop: 0, marginBottom: 24 }}>Admin Login</h1>
        <form onSubmit={handleSubmit}>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required autoFocus
            style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box', marginBottom: 12 }} />
          {error && <p style={{ color: '#dc2626', margin: '0 0 12px', fontSize: 14 }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 12, background: '#4F46E5', color: 'white', border: 'none', borderRadius: 6, fontSize: 15, cursor: 'pointer' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

function SlotRow({ slot, onCancel }) {
  const [open, setOpen] = useState(false);
  const color = slot.confirmed.length >= 2 ? '#dc2626' : slot.confirmed.length === 1 ? '#d97706' : '#16a34a';

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: '#fafafa', borderLeft: `4px solid ${color}` }}>
        <span style={{ fontWeight: 'bold', fontSize: 14 }}>{slot.start_time} – {slot.end_time}</span>
        <span style={{ fontSize: 13, color: '#555' }}>
          {slot.confirmed.length}/2 confirmed
          {slot.waitlisted.length > 0 && ` · ${slot.waitlisted.length} waitlisted`}
          <span style={{ marginLeft: 8, color: '#aaa' }}>{open ? '▲' : '▼'}</span>
        </span>
      </div>
      {open && (
        <div style={{ padding: '10px 14px', background: 'white' }}>
          {slot.confirmed.length === 0 && slot.waitlisted.length === 0 && (
            <p style={{ color: '#aaa', margin: 0, fontSize: 13 }}>No bookings</p>
          )}
          {slot.confirmed.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 14 }}>
                <strong>{b.name}</strong>
                <span style={{ color: '#666', marginLeft: 8 }}>{b.email}</span>
                <span style={{ marginLeft: 8, padding: '1px 8px', background: '#dcfce7', color: '#166534', borderRadius: 12, fontSize: 11 }}>confirmed</span>
              </div>
              <button onClick={() => onCancel(b.id)}
                style={{ padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                Cancel
              </button>
            </div>
          ))}
          {slot.waitlisted.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 14 }}>
                <strong>{b.name}</strong>
                <span style={{ color: '#666', marginLeft: 8 }}>{b.email}</span>
                <span style={{ marginLeft: 8, padding: '1px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 12, fontSize: 11 }}>waitlist #{b.waitlist_position}</span>
              </div>
              <button onClick={() => onCancel(b.id)}
                style={{ padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ slotKey: '', name: '', email: '' });

  async function load() {
    try {
      const res = await fetch('/api/admin/bookings');
      if (res.status === 401) { window.location.reload(); return; }
      setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(id) {
    if (!confirm('Cancel this booking?')) return;
    const res = await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' });
    if (res.ok) { setMessage({ type: 'success', text: 'Booking cancelled' }); load(); }
    else setMessage({ type: 'error', text: 'Failed to cancel' });
  }

  async function handleAdd(e) {
    e.preventDefault();
    const [day, start] = addForm.slotKey.split('::');
    const res = await fetch('/api/admin/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, start, name: addForm.name, email: addForm.email }),
    });
    const d = await res.json();
    if (res.ok) {
      setMessage({ type: 'success', text: `Added as ${d.status}` });
      setAddModal(false);
      setAddForm({ slotKey: '', name: '', email: '' });
      load();
    } else {
      setMessage({ type: 'error', text: d.error });
    }
  }

  // Stats
  let confirmed = 0, waitlisted = 0, open = 0, full = 0;
  for (const day of Object.values(data)) {
    for (const slot of day) {
      confirmed += slot.confirmed.length;
      waitlisted += slot.waitlisted.length;
      if (slot.confirmed.length >= 2) full++; else open++;
    }
  }

  const allSlots = Object.entries(data).flatMap(([day, slots]) =>
    slots.map(s => ({ key: `${day}::${s.start_time}`, label: `${DAY_LABELS[day]} – ${s.start_time}` }))
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>Loading...</div>;

  const inp = { width: '100%', padding: 9, border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', marginBottom: 12 };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setAddModal(true)}
            style={{ padding: '8px 16px', background: '#4F46E5', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            + Add Booking
          </button>
          <a href="/api/admin/export"
            style={{ padding: '8px 16px', background: '#16a34a', color: 'white', borderRadius: 6, textDecoration: 'none', display: 'inline-block' }}>
            Download CSV
          </a>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Confirmed', value: confirmed, color: '#16a34a' },
          { label: 'Waitlisted', value: waitlisted, color: '#d97706' },
          { label: 'Open Slots', value: open, color: '#4F46E5' },
          { label: 'Full Slots', value: full, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', padding: '16px 20px', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.08)', textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 'bold', color: s.color }}>{s.value}</div>
            <div style={{ color: '#666', fontSize: 13 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {message && (
        <div style={{ padding: '12px 16px', marginBottom: 16, borderRadius: 6, background: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#166534' : '#991b1b' }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* Add booking modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: 32, borderRadius: 12, width: 400 }}>
            <h2 style={{ marginTop: 0 }}>Add Booking</h2>
            <form onSubmit={handleAdd}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Slot</label>
              <select required value={addForm.slotKey} onChange={e => setAddForm(f => ({ ...f, slotKey: e.target.value }))} style={inp}>
                <option value="">Select a slot...</option>
                {allSlots.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Name</label>
              <input type="text" required value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} style={inp} />
              <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Email</label>
              <input type="email" required value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} style={inp} />
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" style={{ flex: 1, padding: 10, background: '#4F46E5', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Add</button>
                <button type="button" onClick={() => setAddModal(false)} style={{ padding: 10, background: '#f3f4f6', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {['2026-06-16', '2026-06-17'].map(day => (
          <div key={day}>
            <h2 style={{ borderBottom: '2px solid #4F46E5', paddingBottom: 8, marginBottom: 14 }}>{DAY_LABELS[day]}</h2>
            {(data[day] || []).map(slot => (
              <SlotRow key={slot.id} slot={slot} onCancel={handleCancel} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(null);

  useEffect(() => {
    fetch('/api/admin/bookings').then(res => setLoggedIn(res.ok));
  }, []);

  if (loggedIn === null) return null;
  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />;
  return <Dashboard />;
}
