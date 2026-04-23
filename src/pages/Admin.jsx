import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Plus, Save, Trash2, Edit2, Play, 
  ExternalLink, CheckCircle2, AlertCircle,
  ChevronDown, ChevronRight, LayoutGrid, List,
  Search, Video, Lock, Unlock, Eye, Loader2, Link as LinkIcon, User, UserPlus
} from 'lucide-react';
import SubscriptionManager from '../components/admin/SubscriptionManager';

export default function Admin() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [message, setMessage] = useState(null);

  // Creation State
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubject, setNewSubject] = useState({ title: '', description: '', color_hex: '#00E5FF', icon_name: 'BookOpen', price: 10.00 });
  
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSection, setNewSection] = useState({ title: '' });
  
  const [isAddingLesson, setIsAddingLesson] = useState(null); // stores section_id
  const [newLesson, setNewLesson] = useState({ title: '', description: '', video_url: '', is_free: false, duration: '' });
  
  // UX State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [activeTab, setActiveTab] = useState("content");
  const [students, setStudents] = useState([]);

  const checkPermission = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }

    setCheckingAuth(false);
    fetchSubjects();
  }, [navigate]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    if (selectedSubject) {
      fetchSyllabus(selectedSubject.id);
    }
  }, [selectedSubject]);

  async function fetchSubjects() {
    const { data, error } = await supabase.from('subjects').select('*');
    if (!error && data) {
      setSubjects(data);
      if (data.length > 0) setSelectedSubject(data[0]);
    }
    setLoading(false);
  }

  
  async function fetchStudents() {
    setLoading(true);
    
    // 1. Fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*, id, full_name, role, is_banned, login_count, created_at')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
      
    // 2. Fetch subscriptions to avoid Foreign Key relation issues
    const { data: subsData } = await supabase
      .from('user_subscriptions')
      .select('user_id, subject_id, subjects(title)');
      
    if (!profilesError && profilesData) {
      // 3. Combine in memory
      const combined = profilesData.map(profile => {
        const userSubs = subsData ? subsData.filter(s => s.user_id === profile.id) : [];
        return { ...profile, user_subscriptions: userSubs };
      });
      setStudents(combined);
    }
    setLoading(false);
  }

  const toggleBanStatus = async (studentId, currentStatus) => {
    const newStatus = !currentStatus;
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_banned: newStatus })
      .eq('id', studentId)
      .select();
      
    if (error) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      console.error("Ban error:", error);
    } else {
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, is_banned: newStatus } : s));
      setMessage({ type: 'success', text: newStatus ? 'User banned successfully.' : 'User unbanned successfully.' });
      setTimeout(() => setMessage(null), 2500);
    }
  }

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents();
    }
  }, [activeTab]);

async function fetchSyllabus(subjectId) {
    setLoading(true);
    const { data: sectionsData, error: secError } = await supabase
      .from('sections')
      .select(`*, lessons (*)`)
      .eq('subject_id', subjectId)
      .order('order_index');

    if (!secError) {
      const sortedData = sectionsData.map(section => ({
        ...section,
        lessons: section.lessons.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      }));
      setSections(sortedData);
      
      // Expand first section by default
      if (sortedData.length > 0) {
        setExpandedSections({ [sortedData[0].id]: true });
      }
    }
    setLoading(false);
  }

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleVideoUrlPaste = async (url, isEditing) => {
    if (!url) return;
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return;
    
    setIsFetchingUrl(true);
    try {
      const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data && data.title) {
        if (isEditing) {
          setEditingLesson(prev => ({ ...prev, title: data.title, video_url: url }));
        } else {
          setNewLesson(prev => ({ ...prev, title: data.title, video_url: url }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch video title", err);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleUpdateLesson = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('lessons')
      .update({
        title: editingLesson.title,
        description: editingLesson.description,
        video_url: editingLesson.video_url,
        is_free: editingLesson.is_free,
        duration: editingLesson.duration
      })
      .eq('id', editingLesson.id);

    setSaving(false);
    if (!error) {
      setMessage({ type: 'success', text: 'Changes saved!' });
      fetchSyllabus(selectedSubject.id);
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.from('subjects').insert([newSubject]).select();
    setSaving(false);
    if (!error && data) {
      setSubjects([...subjects, data[0]]);
      setSelectedSubject(data[0]);
      setIsAddingSubject(false);
      setNewSubject({ title: '', description: '', color_hex: '#00E5FF', icon_name: 'BookOpen', price: 10.00 });
      setMessage({ type: 'success', text: 'Subject created!' });
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ type: 'error', text: error?.message || 'Failed to create subject' });
    }
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    setSaving(true);
    const order_index = sections.length;
    const { error } = await supabase.from('sections').insert([{
      subject_id: selectedSubject.id,
      title: newSection.title,
      order_index
    }]);
    setSaving(false);
    if (!error) {
      fetchSyllabus(selectedSubject.id);
      setIsAddingSection(false);
      setNewSection({ title: '' });
      setMessage({ type: 'success', text: 'Section added!' });
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    setSaving(true);
    const targetSection = sections.find(s => s.id === isAddingLesson);
    const order_index = targetSection ? targetSection.lessons.length : 0;
    
    const { error } = await supabase.from('lessons').insert([{
      section_id: isAddingLesson,
      title: newLesson.title,
      description: newLesson.description,
      video_url: newLesson.video_url,
      is_free: newLesson.is_free,
      duration: newLesson.duration,
      order_index
    }]);
    
    setSaving(false);
    if (!error) {
      fetchSyllabus(selectedSubject.id);
      setIsAddingLesson(null);
      setNewLesson({ title: '', description: '', video_url: '', is_free: false, duration: '' });
      setExpandedSections(prev => ({ ...prev, [isAddingLesson]: true }));
      setMessage({ type: 'success', text: 'Lesson added!' });
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDeleteLesson = async (lessonId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this lesson? This cannot be undone.")) return;
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
    if (!error) {
       fetchSyllabus(selectedSubject.id);
    }
  };

  const filteredSections = sections.map(sec => ({
    ...sec,
    lessons: sec.lessons.filter(l => 
      l.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(sec => sec.lessons.length > 0 || searchQuery === '');

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '1rem' }}>
        <Loader2 size={40} className="animate-spin" color="var(--accent-physics)" />
        <p style={{ color: 'var(--text-secondary)' }}>Verifying admin permissions...</p>
      </div>
    );
  }

  if (loading && subjects.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Hub Data...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', paddingBottom: '6rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Management Hub</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage your courses, videos, and students.</p>
        </div>
        
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '0.25rem', borderRadius: '12px' }}>
          <button 
            onClick={() => setActiveTab('content')}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', background: activeTab === 'content' ? 'var(--accent-physics)' : 'transparent', color: activeTab === 'content' ? 'black' : 'white', border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Video size={16} /> Content
          </button>
          <button 
            onClick={() => setActiveTab('students')}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', background: activeTab === 'students' ? 'var(--accent-physics)' : 'transparent', color: activeTab === 'students' ? 'black' : 'white', border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <User size={16} /> Students
          </button>
          <button 
            onClick={() => setActiveTab('subscriptions')}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', background: activeTab === 'subscriptions' ? 'var(--accent-physics)' : 'transparent', color: activeTab === 'subscriptions' ? 'black' : 'white', border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <UserPlus size={16} /> Subs
          </button>
        </div>
      </header>

      

      {activeTab === 'content' ? (
        <>
          {/* Subject Selector Tabs */}
      <div className="hide-scrollbar" style={{ 
        display: 'flex', 
        gap: '0.75rem', 
        marginBottom: '2rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem'
      }}>
        {subjects.map(sub => (
          <button
            key={sub.id}
            onClick={() => setSelectedSubject(sub)}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              border: selectedSubject?.id === sub.id ? `2px solid ${sub.color_hex}` : '1px solid rgba(255,255,255,0.08)',
              background: selectedSubject?.id === sub.id ? `${sub.color_hex}15` : 'rgba(255,255,255,0.03)',
              color: selectedSubject?.id === sub.id ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              flexShrink: 0,
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            {sub.title}
          </button>
        ))}
        
        <button
          onClick={() => {
            setEditingLesson(null);
            setIsAddingSection(false);
            setIsAddingLesson(null);
            setIsAddingSubject(true);
            setNewSubject({ title: '', description: '', color_hex: '#00E5FF', icon_name: 'BookOpen', price: 10.00 });
            setMessage(null);
          }}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            border: '1px dashed rgba(255,255,255,0.2)',
            background: 'transparent',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 600,
            flexShrink: 0,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Plus size={16} /> New Subject
        </button>
      </div>

      <div className="admin-layout-container">
        
        {/* Syllabus Browser (Becomes column 1 on Desktop) */}
        <div className="list-panel">
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                placeholder={`Search ${selectedSubject?.title} lessons...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.9rem 1rem 0.9rem 3rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  color: 'white',
                  outline: 'none'
                }}
              />
            </div>
            <button 
              onClick={() => {
                setEditingLesson(null);
                setIsAddingSubject(false);
                setIsAddingLesson(null);
                setIsAddingSection(true);
                setNewSection({ title: '' });
                setMessage(null);
              }}
              style={{ 
                padding: '0 1.25rem', 
                borderRadius: '14px', 
                background: selectedSubject ? `${selectedSubject.color_hex}20` : 'rgba(255,255,255,0.1)', 
                color: selectedSubject?.color_hex || 'white', 
                border: selectedSubject ? `1px solid ${selectedSubject.color_hex}40` : '1px solid rgba(255,255,255,0.2)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                minHeight: '44px',
                gap: '0.5rem', 
                fontWeight: 600, 
                cursor: 'pointer', 
                transition: 'all 0.2s',
                flexGrow: window.innerWidth < 640 ? 1 : 0
              }}
              onMouseEnter={(e) => { if(selectedSubject) e.currentTarget.style.background = `${selectedSubject.color_hex}30`; }}
              onMouseLeave={(e) => { if(selectedSubject) e.currentTarget.style.background = `${selectedSubject.color_hex}20`; }}
            >
              <Plus size={18} /> Add Section
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredSections.map(section => {
              const isExpanded = expandedSections[section.id];
              const lessonsWithVideo = section.lessons.filter(l => l.video_url).length;
              const totalLessons = section.lessons.length;

              return (
                <div key={section.id} className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden' }}>
                  <div 
                    onClick={() => toggleSection(section.id)}
                    style={{ 
                      padding: '1rem 1.25rem', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent'
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{section.title}</h3>
                      <span style={{ fontSize: '0.7rem', color: lessonsWithVideo === totalLessons ? '#39FF14' : 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                         {lessonsWithVideo}/{totalLessons} Ready
                      </span>
                    </div>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  
                  {isExpanded && (
                    <div style={{ padding: '0.5rem' }}>
                      {section.lessons.map(lesson => (
                        <div 
                          key={lesson.id} 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsAddingSubject(false);
                            setIsAddingSection(false);
                            setIsAddingLesson(null);
                            setEditingLesson(lesson); 
                            setMessage(null);
                            // Scroll to top on mobile
                            if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.85rem 1rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            background: editingLesson?.id === lesson.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                            transition: 'all 0.2s',
                            border: editingLesson?.id === lesson.id ? `1px solid ${selectedSubject?.color_hex}40` : '1px solid transparent'
                          }}
                          className="admin-lesson-row"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {lesson.video_url ? (
                              <CheckCircle2 size={16} color="#39FF14" />
                            ) : (
                              <AlertCircle size={16} color="#ffa500" />
                            )}
                            <span style={{ fontSize: '0.9rem', color: lesson.video_url ? 'white' : 'var(--text-secondary)' }}>
                              {lesson.title || 'Untitled Lesson'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {lesson.is_free && <Eye size={14} color="#39FF14" title="Free Preview" />}
                            <Edit2 size={14} color="var(--text-muted)" />
                            <div 
                              onClick={(e) => handleDeleteLesson(lesson.id, e)}
                              style={{ display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '4px' }}
                              className="admin-delete-btn"
                            >
                              <Trash2 size={14} color="#ff4444" />
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Add New Lesson Button */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLesson(null);
                          setIsAddingSubject(false);
                          setIsAddingSection(false);
                          setIsAddingLesson(section.id);
                          setNewLesson({ title: '', description: '', video_url: '', is_free: false, duration: '' });
                          setMessage(null);
                          // Scroll to top on mobile
                          if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          color: selectedSubject?.color_hex || 'white',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          transition: 'all 0.2s',
                          marginTop: '0.5rem',
                          borderRadius: '10px',
                          background: isAddingLesson === section.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                          border: isAddingLesson === section.id ? `1px solid ${selectedSubject?.color_hex}40` : '1px solid transparent'
                        }}
                        className="admin-lesson-row"
                      >
                        <Plus size={16} /> Add New Lesson...
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Editor Panel (Becomes column 2 on Desktop) */}
        {(editingLesson || isAddingSubject || isAddingSection || isAddingLesson) && (
          <div className="glass-panel editor-panel" style={{ 
            padding: '1.5rem', 
            borderRadius: '20px', 
            border: `1px solid ${selectedSubject?.color_hex || '#00E5FF'}60`,
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
                {editingLesson && `Edit Lesson`}
                {isAddingSubject && 'Create New Subject'}
                {isAddingSection && 'Add New Section'}
                {isAddingLesson && 'Add New Lesson'}
              </h3>
              <button 
                onClick={() => {
                  setEditingLesson(null);
                  setIsAddingSubject(false);
                  setIsAddingSection(false);
                  setIsAddingLesson(null);
                  setMessage(null);
                }} 
                style={{ color: 'var(--text-muted)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
            
            {/* Adding SUBJECT Form */}
            {isAddingSubject && (
              <form onSubmit={handleAddSubject}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="admin-label">Subject Title</label>
                  <input type="text" value={newSubject.title} onChange={(e) => setNewSubject({...newSubject, title: e.target.value})} className="admin-input" required placeholder="e.g. A-Level Mathematics" />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="admin-label">Description</label>
                  <textarea value={newSubject.description} onChange={(e) => setNewSubject({...newSubject, description: e.target.value})} className="admin-input" style={{ minHeight: '80px' }} placeholder="Brief description of the course..." />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="admin-label">Theme Color Hex</label>
                  <input type="text" value={newSubject.color_hex} onChange={(e) => setNewSubject({...newSubject, color_hex: e.target.value})} className="admin-input" style={{ border: `1px solid ${newSubject.color_hex || 'rgba(255,255,255,0.1)'}` }} />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="admin-label">Monthly Price ($)</label>
                  <input type="number" step="0.01" value={newSubject.price} onChange={(e) => setNewSubject({...newSubject, price: e.target.value})} className="admin-input" placeholder="10.00" />
                </div>
                <button type="submit" disabled={saving} className="admin-submit-btn" style={{ background: newSubject.color_hex || 'white' }}>
                  {saving ? 'Creating...' : 'Create Subject'}
                </button>
              </form>
            )}

            {/* Adding SECTION Form */}
            {isAddingSection && (
              <form onSubmit={handleAddSection}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="admin-label">Section Title</label>
                  <input type="text" value={newSection.title} onChange={(e) => setNewSection({...newSection, title: e.target.value})} className="admin-input" required placeholder="e.g. Chapter 1: Calculus" />
                </div>
                <button type="submit" disabled={saving} className="admin-submit-btn" style={{ background: selectedSubject?.color_hex || 'white' }}>
                  {saving ? 'Creating...' : 'Create Section'}
                </button>
              </form>
            )}

            {/* Adding / Editing LESSON Form */}
            {(isAddingLesson || editingLesson) && (() => {
              const lessonState = editingLesson || newLesson;
              const setLessonState = editingLesson ? setEditingLesson : setNewLesson;
              const handleSubmit = editingLesson ? handleUpdateLesson : handleAddLesson;
              const submitText = editingLesson ? 'Save Changes' : 'Create Lesson';

              return (
                <form onSubmit={handleSubmit}>
                  {/* MOVED URL FIRST TO FACILITATE AUTO-TYPING */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="admin-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>1. Paste YouTube URL</span>
                      {isFetchingUrl && <span style={{ color: selectedSubject?.color_hex, display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Loader2 size={12} className="animate-spin" /> Auto-fetching title</span>}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <LinkIcon size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="url" 
                        placeholder="https://www.youtube.com/watch?v=..." 
                        value={lessonState.video_url || ''} 
                        onChange={(e) => setLessonState({...lessonState, video_url: e.target.value})}
                        onBlur={(e) => handleVideoUrlPaste(e.target.value, !!editingLesson)}
                        className="admin-input" 
                        style={{ paddingLeft: '2.5rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="admin-label">2. Lesson Title</label>
                    <input 
                      type="text" 
                      value={lessonState.title} 
                      onChange={(e) => setLessonState({...lessonState, title: e.target.value})} 
                      className="admin-input" 
                      required 
                      placeholder="Will auto-fill if you paste a YouTube link above"
                    />
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="admin-label">3. Description (Optional)</label>
                    <textarea 
                      value={lessonState.description || ''} 
                      onChange={(e) => setLessonState({...lessonState, description: e.target.value})} 
                      className="admin-input" 
                      style={{ minHeight: '80px' }} 
                      placeholder="Add any extra notes or assignments..."
                    />
                  </div>
                  
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="admin-label">4. Duration</label>
                    <input 
                      type="text" 
                      value={lessonState.duration || ''} 
                      onChange={(e) => setLessonState({...lessonState, duration: e.target.value})} 
                      className="admin-input" 
                      placeholder="e.g. 10:45 or 15 mins"
                    />
                  </div>
                  
                  <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div onClick={() => setLessonState({...lessonState, is_free: !lessonState.is_free})} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: '10px', background: lessonState.is_free ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255,255,255,0.05)', border: lessonState.is_free ? '1px solid #39FF1440' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '0.85rem' }}>
                      {lessonState.is_free ? <Unlock size={14} color="#39FF14" /> : <Lock size={14} color="var(--text-muted)" />}
                      {lessonState.is_free ? 'Free Preview' : 'Premium Only'}
                    </div>
                  </div>
                  <button type="submit" disabled={saving || isFetchingUrl} className="admin-submit-btn" style={{ background: selectedSubject?.color_hex || 'white', boxShadow: `0 4px 15px ${selectedSubject?.color_hex}40` }}>
                    {saving ? 'Saving...' : submitText}
                  </button>
                </form>
              );
            })()}

            {/* Status Message */}
            {message && (
              <div style={{ marginTop: '1rem', padding: '0.8rem', borderRadius: '10px', background: message.type === 'success' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 0, 0, 0.1)', color: message.type === 'success' ? '#39FF14' : '#ff4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: message.type === 'success' ? '1px solid #39FF1440' : '1px solid #ff444440' }}>
                {message.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                {message.text}
              </div>
            )}
          </div>
        )}
      </div>
      </>
      ) : activeTab === 'students' ? (
        <div className="admin-layout-container" style={{ gridTemplateColumns: '1fr' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Registered Students</h2>
            {students.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No students found.</p>
            ) : (
              <div style={{ overflowX: 'auto', paddingBottom: '1rem', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      <th style={{ padding: '0.5rem 0.2rem', fontWeight: 600 }}>Student</th>
                      <th className="hide-on-mobile" style={{ padding: '0.5rem 0.2rem', fontWeight: 600 }}>Subjects</th>
                      <th style={{ padding: '0.5rem 0.2rem', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '0.5rem 0.2rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem 0.2rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{student.full_name || 'Unnamed'}</div>
                          <div className="hide-on-mobile" style={{ fontSize: '0.75rem', color: 'var(--accent-physics)', opacity: 0.9 }}>{student.email || 'No email'}</div>
                        </td>
                        <td className="hide-on-mobile" style={{ padding: '0.75rem 0.2rem' }}>
                          {student.user_subscriptions?.length > 0 ? (
                            <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                              {student.user_subscriptions.map(sub => (
                                <span key={sub.subject_id} style={{ background: 'rgba(57, 255, 20, 0.1)', color: '#39FF14', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.65rem', border: '1px solid #39FF1440', whiteSpace: 'nowrap' }}>
                                  {sub.subjects?.title?.split(' ')[0]} {/* Just show first word to save space */}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>None</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.2rem' }}>
                          <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {student.is_banned ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', color: '#ff4444', fontSize: '0.7rem' }}><Lock size={10} /> Ban</span>
                            ) : (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', color: '#39FF14', fontSize: '0.7rem' }}><CheckCircle2 size={10} /> OK</span>
                            )}
                            
                            {student.login_count > 20 && (
                              <AlertCircle size={12} color="#ffa500" title="Suspicious activity" />
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.2rem', textAlign: 'right' }}>
                          <button 
                            onClick={() => toggleBanStatus(student.id, student.is_banned)}
                            style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', background: student.is_banned ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 68, 68, 0.1)', color: student.is_banned ? '#39FF14' : '#ff4444', border: student.is_banned ? '1px solid #39FF1440' : '1px solid #ff444440', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            {student.is_banned ? 'Unban' : 'Ban'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {message && activeTab === 'students' && (
              <div style={{ marginTop: '1rem', padding: '0.8rem', borderRadius: '10px', background: message.type === 'success' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 0, 0, 0.1)', color: message.type === 'success' ? '#39FF14' : '#ff4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: message.type === 'success' ? '1px solid #39FF1440' : '1px solid #ff444440' }}>
                {message.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                {message.text}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="admin-layout-container" style={{ gridTemplateColumns: '1fr' }}>
          <SubscriptionManager />
        </div>
      )}

      <style>{`
        /* Global Admin UI components */
        .admin-label {
          display: block; 
          font-size: 0.8rem; 
          color: var(--text-secondary); 
          margin-bottom: 0.5rem; 
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .admin-input {
          width: 100%; 
          background: rgba(0,0,0,0.2); 
          border: 1px solid rgba(255,255,255,0.1); 
          color: white; 
          padding: 0.9rem; 
          border-radius: 12px;
          transition: border-color 0.2s, background 0.2s;
          outline: none;
        }
        
        .admin-input:focus {
          border-color: rgba(255,255,255,0.3);
          background: rgba(0,0,0,0.3);
        }

        .admin-submit-btn {
          width: 100%; 
          color: black; 
          padding: 1rem; 
          border-radius: 12px; 
          border: none; 
          font-weight: 800; 
          font-size: 1rem;
          cursor: pointer; 
          transition: transform 0.2s, opacity 0.2s;
        }
        
        .admin-submit-btn:hover {
          transform: translateY(-2px);
        }
        
        .admin-submit-btn:active {
          transform: translateY(0);
        }

        .admin-submit-btn:disabled {
          opacity: 0.7;
          transform: none;
          cursor: not-allowed;
        }

        .admin-lesson-row {
          margin-bottom: 0.25rem;
        }

        .admin-lesson-row:hover {
          background: rgba(255,255,255,0.08) !important;
        }
        
        .admin-delete-btn:hover {
          background: rgba(255, 68, 68, 0.15) !important;
        }
        
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        
        /* Layout Grid */
        .admin-layout-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }

        .editor-panel {
           order: -1; /* On mobile, move editor to the top when active */
           margin-bottom: 1rem;
        }
        
        @media (max-width: 640px) {
          .hide-on-mobile {
            display: none !important;
          }
        }
        
        @media (min-width: 1024px) {
          .admin-layout-container {
            grid-template-columns: 1fr 400px; /* Two column layout */
            align-items: start;
          }
          .editor-panel {
            position: sticky;
            top: 2rem; /* Keep editor in view when scrolling lessons */
            order: 2; /* Move it back to the right side on desktop */
            margin-bottom: 0;
          }
          .list-panel {
            order: 1;
          }
        }
      `}</style>
    </div>
  );
}
