import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, User, Lock, Mail, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('register'); // 'register' | 'otp'
  const [otpCode, setOtpCode] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (error) throw error;
      
      console.log("Registration successful!", data);
      navigate('/dashboard');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-background">
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '450px',
        padding: '3rem 2rem',
        borderRadius: '16px',
        textAlign: 'center'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
           <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', 
              background: 'rgba(0, 229, 255, 0.1)', 
              display: 'flex', justifyContent: 'center', alignItems: 'center' 
            }}>
              <BookOpen size={32} color="var(--accent-physics)" />
           </div>
        </div>

        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Join PassIt</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Create an account to start learning.
        </p>

        {error && (
          <div style={{
            background: 'rgba(255, 68, 68, 0.1)',
            border: '1px solid rgba(255, 68, 68, 0.2)',
            color: '#ff4444',
            padding: '0.75rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
           <div style={{ position: 'relative' }}>
            <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '1rem 1rem 1rem 3rem',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-physics)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="email" 
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '1rem 1rem 1rem 3rem',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-physics)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '1rem 3rem 1rem 3rem',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-physics)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="submit" disabled={loading} style={{
            background: 'var(--accent-physics)',
            color: '#000',
            padding: '1rem',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '1rem',
            transition: 'transform 0.2s, opacity 0.2s',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => !loading && (e.currentTarget.style.opacity = '1')}
          onMouseDown={(e) => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>Create Account <ArrowRight size={18} /></>}
          </button>
        </form>

        <p style={{ marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-physics)', fontWeight: 600 }}>Sign In</Link>
        </p>

      </div>
    </div>
  );
}
