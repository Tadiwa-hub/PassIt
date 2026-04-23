import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, UserCheck, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function BottomNav() {
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
    { name: 'Home', icon: <Home size={24} />, path: '/dashboard' },
    { name: 'My Subjects', icon: <Compass size={24} />, path: '/my-subjects' },
    ...(isAdmin ? [{ name: 'Admin', icon: <ShieldCheck size={24} />, path: '/admin' }] : []),
    { name: 'Profile', icon: <UserCheck size={24} />, path: '/settings' },
  ];

  return (
    <nav className="bottom-nav glass-panel">
      {navItems.map((item) => (
        <NavLink
          key={item.name}
          to={item.path}
          className={({ isActive }) => 
            `bottom-nav-item ${isActive ? 'active' : ''}`
          }
        >
          {item.icon}
          <span>{item.name}</span>
        </NavLink>
      ))}
    </nav>
  );
}
