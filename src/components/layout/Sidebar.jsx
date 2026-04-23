import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Folder, Settings, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Sidebar() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(profile?.role === 'admin');
      }
    }
    checkRole();
  }, []);

  const navItems = [
    { name: 'Home', icon: Home, path: '/dashboard' },
    { name: 'My Subjects', icon: Compass, path: '/my-subjects' },
  ];

  const adminItems = [
    { name: 'Admin Hub', icon: ShieldCheck, path: '/admin' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  const activeStyle = {
    background: 'rgba(255,255,255,0.05)',
    borderLeft: '3px solid var(--accent-physics)',
    color: 'var(--text-primary)'
  };
  
  const defaultStyle = {
    color: 'var(--text-secondary)'
  };

  return (
    <aside className="glass-panel desktop-sidebar" style={{
      width: 'var(--sidebar-width)',
      height: 'calc(100vh - var(--nav-height))',
      position: 'fixed',
      left: 0,
      top: 'var(--nav-height)',
      padding: '2rem 0',
      gap: '2rem'
    }}>
      <div>
        <h4 style={{ padding: '0 2rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
          Menu
        </h4>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navItems.map((item) => (
            <NavLink 
              key={item.name} 
              to={item.path}
              style={({isActive}) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.75rem 2rem',
                transition: 'all 0.2s',
                ...(isActive ? activeStyle : defaultStyle)
              })}
            >
              <item.icon size={20} />
              <span style={{ fontWeight: 500 }}>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {isAdmin && (
        <div style={{ marginTop: 'auto' }}>
          <h4 style={{ padding: '0 2rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
            Management
          </h4>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {adminItems.map((item) => (
              <NavLink 
                key={item.name} 
                to={item.path}
                style={({isActive}) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 2rem',
                  transition: 'all 0.2s',
                  ...(isActive ? activeStyle : defaultStyle)
                })}
              >
                <item.icon size={20} />
                <span style={{ fontWeight: 500 }}>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </aside>
  );
}
