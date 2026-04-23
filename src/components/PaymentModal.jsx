import React, { useState } from 'react';
import { X, Smartphone, CreditCard, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

export default function PaymentModal({ subject, onClose, onSuccess }) {
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('ecocash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('details'); // 'details' | 'processing' | 'success'

  const METHODS = [
    { id: 'ecocash',  label: 'EcoCash',  color: '#39FF14', hint: '077/078' },
    { id: 'onemoney', label: 'OneMoney', color: '#00E5FF', hint: '071' },
    { id: 'innbucks', label: 'InnBucks', color: '#FFD700', hint: 'InnBucks' },
  ];

  const selectedMethod = METHODS.find(m => m.id === method);

  const handlePay = async () => {
    if (!phone.trim()) {
      setError('Please enter your mobile money number.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const data = await api.initiatePayment({
        subjectId: subject.id,
        subjectTitle: subject.title,
        phone: phone.trim(),
        paymentMethod: method,
      });

      if (data?.pollUrl) {
        setStep('processing');
        startPolling(data.pollUrl);
      } else {
        throw new Error('No payment instructions received.');
      }
    } catch (err) {
      setError(err.message || 'Payment initiation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (url) => {
    const interval = setInterval(async () => {
      try {
        const params = await api.checkPayment(url);
        const status = params.get('status');

        if (status === 'Paid' || status === 'Awaiting Delivery') {
          clearInterval(interval);
          setStep('success');
          setTimeout(() => onSuccess(), 2500);
        } else if (status === 'Cancelled' || status === 'Refused') {
          clearInterval(interval);
          setStep('details');
          setError('Payment was cancelled or refused. Please try again.');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)'
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '420px',
        borderRadius: '24px', position: 'relative',
        overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      }}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Subscribe to {subject.title}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Secure Checkout via Paynow</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {step === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Price */}
              <div style={{ textAlign: 'center', padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: `1px solid ${subject.color_hex}25` }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Monthly Subscription</span>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', margin: '0.25rem 0' }}>${subject.price ? Number(subject.price).toFixed(2) : '10.00'}</div>
                <span style={{ color: subject.color_hex, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Full Syllabus Access</span>
              </div>

              {/* Payment Method */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Payment Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {METHODS.map(m => (
                    <button key={m.id} onClick={() => setMethod(m.id)} style={{
                      padding: '0.6rem 0.4rem', borderRadius: '10px',
                      border: `2px solid ${method === m.id ? m.color : 'rgba(255,255,255,0.07)'}`,
                      background: method === m.id ? `${m.color}15` : 'rgba(255,255,255,0.02)',
                      color: method === m.id ? 'white' : 'var(--text-secondary)',
                      fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem'
                    }}>
                      <span>{m.label}</span>
                      <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone Input */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {selectedMethod?.label} Number
                </label>
                <div style={{ position: 'relative' }}>
                  <Smartphone size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="tel"
                    placeholder="07XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: '100%', padding: '0.9rem 1rem 0.9rem 2.8rem',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {error && (
                <div style={{ padding: '0.7rem', borderRadius: '8px', background: 'rgba(255,68,68,0.1)', color: '#ff4444', fontSize: '0.85rem', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <button disabled={loading} onClick={handlePay} style={{
                width: '100%', padding: '1.1rem', borderRadius: '14px',
                background: subject.color_hex, color: '#000', border: 'none',
                fontWeight: 800, fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                boxShadow: `0 8px 20px ${subject.color_hex}35`, opacity: loading ? 0.7 : 1
              }}>
                {loading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                {loading ? 'Processing...' : `Pay $${subject.price ? Number(subject.price).toFixed(2) : '10.00'}`}
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ position: 'relative', width: '72px', height: '72px', margin: '0 auto 1.5rem' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: selectedMethod?.color || subject.color_hex }} className="animate-spin"></div>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Smartphone size={28} color={selectedMethod?.color || subject.color_hex} />
                </div>
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>Check your phone</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                A payment prompt was sent to <strong style={{ color: 'white' }}>{phone}</strong>.<br />Enter your PIN to confirm.
              </p>
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ⏳ Waiting for confirmation...
              </div>
            </div>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ width: '72px', height: '72px', background: 'rgba(57, 255, 20, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <CheckCircle2 size={40} color="#39FF14" />
              </div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Payment Successful!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Unlocking <strong style={{ color: 'white' }}>{subject.title}</strong>...
              </p>
            </div>
          )}
        </div>

        <div style={{ padding: '0.75rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={11} /> SECURE 256-BIT ENCRYPTED PAYMENT · POWERED BY PAYNOW
        </div>
      </div>
    </div>
  );
}

function ShieldCheck({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
