import React, { useState, useEffect } from 'react';

const DAYS = ['2026-06-16', '2026-06-17'];
const DAY_LABELS = {
  '2026-06-16': 'Tuesday, June 16',
  '2026-06-17': 'Wednesday, June 17',
};

function slotColor(slot) {
  if (slot.bookedCount >= 2) return '#dc2626';
  if (slot.bookedCount === 1) return '#d97706';
  return '#16a34a';
}

function slotLabel(slot) {
  if (slot.bookedCount >= 2) {
    return slot.waitlistCount > 0 ? `Full (+${slot.waitlistCount} waitlist)` : 'Full';
  }
  if (slot.bookedCount === 1) return '1 spot left';
  return 'Available';
}

export default function App() {
  const [slots, setSlots] = useState({});
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadSlots() {
    try {
      const res = await fetch('/api/slots');
      setSlots(await res.json());
    } catch (err) {
      console.error('Failed to load slots', err);
    }
  }

  useEffect(() => {
    loadSlots();
    const id = setInterval(loadSlots, 8000);
    return () => clearInterval(id);
  }, []);

  async function handleBook(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: selected.day, start: selected.start, name: form.name, email: form.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ type: 'error', message: data.error || 'Booking failed' });
      } else if (data.status === 'booked') {
        setStatus({ type: 'success', message: `Confirmed! You're booked for ${selected.start} on ${DAY_LABELS[selected.day]}. Check your email for details and your cancel link.` });
        setSelected(null);
        setForm({ name: '', email: '' });
        loadSlots();
      } else {
        setStatus({ type: 'success', message: `You're on the waitlist at position #${data.position} for ${selected.start} on ${DAY_LABELS[selected.day]}. We'll email you if a spot opens up.` });
        setSelected(null);
        setForm({ name: '', email: '' });
        loadSlots();
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  const s = {
    page: { fontFamily: 'Arial, sans-serif', maxWidth: 920, margin: '0 auto', padding: '24px 16px' },
    h1: { textAlign: 'center', color: '#111', marginBottom: 4 },
    sub: { textAlign: 'center', color: '#666', marginBottom: 24, marginTop: 0 },
    alert: (type) => ({
      padding: '14px 18px', marginBottom: 20, borderRadius: 8,
      background: type === 'success' ? '#dcfce7' : '#fee2e2',
      color: type === 'success' ? '#166534' : '#991b1b',
      border: `1px solid ${type === 'success' ? '#86efac' : '#fca5a5'}`,
    }),
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 },
    dayHead: { borderBottom: '2px solid #4F46E5', paddingBottom: 8, marginBottom: 14, color: '#111' },
    slotBtn: (slot) => ({
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      width: '100%', padding: '10px 14px', marginBottom: 7,
      background: 'white', border: `2px solid ${slotColor(slot)}`,
      borderRadius: 8, cursor: 'pointer', fontSize: 14, textAlign: 'left',
    }),
    badge: (slot) => ({
      padding: '2px 10px', borderRadius: 20, fontSize: 12,
      background: slotColor(slot), color: 'white', whiteSpace: 'nowrap',
    }),
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    },
    modal: {
      background: 'white', padding: 32, borderRadius: 12,
      width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    },
    label: { display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 14 },
    input: { width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box', marginBottom: 16 },
    btnPrimary: { flex: 1, padding: 12, background: '#4F46E5', color: 'white', border: 'none', borderRadius: 6, fontSize: 15, cursor: 'pointer' },
    btnSecondary: { padding: 12, background: '#f3f4f6', color: '#333', border: '1px solid #ddd', borderRadius: 6, fontSize: 15, cursor: 'pointer' },
  };

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Book an Appointment</h1>
      <p style={s.sub}>Select a 20-minute slot on June 16 or 17, 2026.</p>

      {status && (
        <div style={s.alert(status.type)}>
          {status.message}
          <button onClick={() => setStatus(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {selected && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div style={s.modal}>
            <h2 style={{ marginTop: 0 }}>{selected.bookedCount >= 2 ? 'Join Waitlist' : 'Confirm Booking'}</h2>
            <p style={{ color: '#555', marginBottom: 20 }}>
              <strong>{DAY_LABELS[selected.day]}</strong><br />
              {selected.start} – {selected.end}
              {selected.bookedCount >= 2 && <span style={{ color: '#d97706' }}> · Slot is full</span>}
            </p>
            <form onSubmit={handleBook}>
              <label style={s.label}>Full Name</label>
              <input type="text" value={form.name} required style={s.input}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <label style={s.label}>Email Address</label>
              <input type="email" value={form.email} required style={s.input}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={loading} style={s.btnPrimary}>
                  {loading ? 'Processing...' : selected.bookedCount >= 2 ? 'Join Waitlist' : 'Confirm Booking'}
                </button>
                <button type="button" style={s.btnSecondary} onClick={() => { setSelected(null); setStatus(null); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={s.grid}>
        {DAYS.map(day => (
          <div key={day}>
            <h2 style={s.dayHead}>{DAY_LABELS[day]}</h2>
            {(slots[day] || []).map(slot => (
              <button key={slot.id} style={s.slotBtn(slot)} onClick={() => setSelected({ ...slot, day })}>
                <span style={{ fontWeight: 'bold' }}>{slot.start} – {slot.end}</span>
                <span style={s.badge(slot)}>{slotLabel(slot)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
