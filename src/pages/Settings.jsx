import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Shield, Calendar, 
  LogOut, CreditCard, CheckCircle2, 
  ChevronRight, ArrowLeft 
} from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      setUser(session.user);

      // Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setProfile(profileData);

      // Fetch Active Subscriptions
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select(`
          subject_id,
          active,
          subjects (title, color_hex)
        `)
        .eq('user_id', session.user.id)
        .eq('active', true);
      
      setSubscriptions(subData || []);

    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-physics)', borderRadius: '50%' }}></div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '1rem',
      paddingBottom: '5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem'
    }}>
      
      {/* Profile Header */}
      <div className="glass-panel" style={{ 
        padding: '2.5rem 2rem', 
        borderRadius: '24px', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)'
      }}>
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '30px',
          background: 'linear-gradient(135deg, var(--accent-physics), var(--accent-chemistry))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          fontWeight: 800,
          color: '#000',
          marginBottom: '1.5rem',
          boxShadow: '0 20px 40px rgba(0,229,255,0.2)'
        }}>
          {profile?.full_name ? profile.full_name[0].toUpperCase() : user?.email?.[0]?.toUpperCase()}
        </div>

        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{profile?.full_name || 'Student'}</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{user?.email}</p>

        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          borderRadius: '12px',
          background: profile?.role === 'admin' ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255,255,255,0.05)',
          color: profile?.role === 'admin' ? '#FFD700' : 'var(--text-secondary)',
          fontSize: '0.85rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {profile?.role === 'admin' ? <Shield size={16}/> : <User size={16}/>}
          {profile?.role || 'Student'} Account
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Subscription Section */}
        <section>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CreditCard size={20} color="var(--accent-physics)" /> My Subscriptions
          </h2>
          <div className="glass-panel" style={{ borderRadius: '20px', padding: '1rem' }}>
            {subscriptions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {subscriptions.map(sub => (
                  <div key={sub.subject_id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '12px',
                    border: `1px solid ${sub.subjects.color_hex}20`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: sub.subjects.color_hex }}></div>
                      <span style={{ fontWeight: 600 }}>{sub.subjects.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#39FF14', fontSize: '0.8rem', fontWeight: 700 }}>
                      <CheckCircle2 size={14} /> ACTIVE
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <p>No active subscriptions yet.</p>
                <button 
                  onClick={() => navigate('/dashboard')}
                  style={{ 
                    marginTop: '1rem', 
                    background: 'transparent', 
                    border: '1px solid var(--accent-physics)',
                    color: 'var(--accent-physics)',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Browse Subjects
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Account Details */}
        <section>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Shield size={20} color="var(--accent-physics)" /> Account Security
          </h2>
          <div className="glass-panel" style={{ borderRadius: '20px', padding: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              
              <div className="settings-row" style={{ 
                padding: '1.25rem 1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem',
                borderBottom: '1px solid rgba(255,255,255,0.03)'
              }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Calendar size={18} color="var(--text-secondary)" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Member Since</p>
                  <p style={{ fontWeight: 600, fontSize: '1rem' }}>{new Date(profile?.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="settings-row" style={{ 
                padding: '1.25rem 1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem'
              }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Mail size={18} color="var(--text-secondary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Login Email</p>
                  <p style={{ fontWeight: 600, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Actions */}
        <button 
          onClick={handleSignOut}
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '1.25rem',
            borderRadius: '16px',
            background: 'rgba(255, 68, 68, 0.1)',
            color: '#ff4444',
            border: '1px solid rgba(255, 68, 68, 0.2)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 68, 68, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 68, 68, 0.1)'}
        >
          <LogOut size={20} /> Sign Out of Account
        </button>

      </div>
    </div>
  );
}
