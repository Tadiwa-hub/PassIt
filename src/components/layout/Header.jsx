import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Bell, BookOpen, User, LogOut, ChevronDown, Crown } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        // Get profile data for subscription status & name
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
        }
      }
    };
    getUser();

    // Close dropdown on outside click
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <header className="glass-panel app-header" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 'var(--nav-height)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 1000,
      padding: '0 1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <BookOpen size={32} color="var(--accent-physics)" />
        <Link to="/dashboard" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>
          Pass<span style={{ color: 'var(--accent-physics)' }}>It</span>
        </Link>
      </div>

      <div className="hide-on-mobile" style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        padding: '0.5rem 1rem',
        borderRadius: '50px',
        width: '400px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <Search size={18} color="var(--text-secondary)" />
        <input 
          type="text" 
          placeholder="Search subjects, topics..." 
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            width: '100%',
            marginLeft: '0.5rem',
            outline: 'none'
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button style={{ 
          color: 'var(--text-secondary)',
          background: 'rgba(255,255,255,0.05)',
          padding: '0.5rem',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Bell size={20} />
        </button>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.25rem' }}></div>
        
        {/* Profile Section */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <div 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              cursor: 'pointer',
              padding: '0.35rem 0.5rem',
              borderRadius: '12px',
              transition: 'background 0.2s',
              background: showDropdown ? 'rgba(255,255,255,0.08)' : 'transparent'
            }}
            onMouseEnter={(e) => !showDropdown && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => !showDropdown && (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-physics), var(--accent-chemistry))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontWeight: '700',
              fontSize: '0.85rem',
              boxShadow: '0 0 15px rgba(0, 229, 255, 0.2)'
            }}>
              {getUserInitials()}
            </div>
            
            <div className="hide-on-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>
                  {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Student'}
                </span>
                {profile?.has_active_subscription && (
                  <Crown size={12} color="var(--accent-maths)" fill="var(--accent-maths)" />
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {profile?.has_active_subscription ? 'Premium' : 'Free Account'}
              </span>
            </div>
            <ChevronDown size={16} color="var(--text-secondary)" />
          </div>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="glass-panel" style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: '0',
              width: '180px',
              borderRadius: '16px',
              padding: '0.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              zIndex: 1000,
              border: '1px solid rgba(255,255,255,0.1)',
              animation: 'dropdownIn 0.2s ease-out'
            }}>
              <Link to="/settings" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                color: 'white',
                textDecoration: 'none',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <User size={18} color="var(--text-secondary)" /> My Profile
              </Link>
              
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }}></div>
              
              <button 
                onClick={handleSignOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  color: '#ff4444',
                  background: 'transparent',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 68, 68, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={18} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
