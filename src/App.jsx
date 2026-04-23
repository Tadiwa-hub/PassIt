import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SubjectDetail from './pages/SubjectDetail';
import CoursePlayer from './pages/CoursePlayer';
import Admin from './pages/Admin';
import MySubjects from './pages/MySubjects';
import Settings from './pages/Settings';
import { supabase } from './lib/supabase';

// Protected Route — redirects to /login if no session
function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('unauthenticated');
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_banned')
        .eq('id', session.user.id)
        .single();
        
      if (profile?.is_banned) {
        await supabase.auth.signOut();
        setStatus('unauthenticated');
        alert("Your account has been banned. Please contact support.");
        return;
      }
      
      setStatus('authenticated');
    };
    checkAuth();
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-physics)', borderRadius: '50%' }}></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Admin Route — checks role after auth
function AdminRoute({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'admin' | 'denied'

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('denied');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      setStatus(profile?.role === 'admin' ? 'admin' : 'denied');
    };
    check();
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-physics)', borderRadius: '50%' }}></div>
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Layout wrapper for authenticated/internal pages
function AppLayout({ children }) {
  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <Sidebar />
        <main className="page-wrapper">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Authentication Pages as Entry Points */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Internal Dashboard Pages — Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/my-subjects" element={<ProtectedRoute><AppLayout><MySubjects /></AppLayout></ProtectedRoute>} />
        <Route path="/subjects/:subjectId" element={<ProtectedRoute><AppLayout><SubjectDetail /></AppLayout></ProtectedRoute>} />  
        <Route path="/play/:subjectId" element={<ProtectedRoute><AppLayout><CoursePlayer /></AppLayout></ProtectedRoute>} />  
        <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />

        {/* Admin — Protected + Role Check */}
        <Route path="/admin" element={<AdminRoute><AppLayout><Admin /></AppLayout></AdminRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
