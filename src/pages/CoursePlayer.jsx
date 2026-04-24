import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { 
  PlayCircle, Lock, MonitorPlay, 
  ChevronLeft, ChevronDown, ChevronRight, 
  Loader2, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import PaymentModal from '../components/PaymentModal';

export default function CoursePlayer() {
  const { subjectId } = useParams();
  const location = useLocation();
  const [subject, setSubject] = useState(null);
  const [sections, setSections] = useState([]);
  const [activeLesson, setActiveLesson] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [userIsSubscribed, setUserIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [mobileTab, setMobileTab] = useState('video'); // 'video' or 'syllabus'
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [completedLessons, setCompletedLessons] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        // 1. Fetch Subject
        const { data: subData, error: subError } = await supabase
          .from('subjects')
          .select('*')
          .eq('id', subjectId)
          .single();
        if (subError) throw subError;
        setSubject(subData);

        // 2. Check Subscription
        if (session) {
          setUserId(session.user.id);
          setUserEmail(session.user.email);
          const { data: sub } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('subject_id', subjectId)
            .eq('active', true)
            .single();
          setUserIsSubscribed(!!sub);
        }

        // 3. Fetch Syllabus (Sections and Lessons)
        const { data: sectionsData, error: secError } = await supabase
          .from('sections')
          .select(`
            *,
            lessons (*)
          `)
          .eq('subject_id', subjectId)
          .order('order_index');

        if (secError) throw secError;

        // Map and sort
        const sortedSections = (sectionsData || []).map(section => ({
          ...section,
          lessons: (section.lessons || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
        }));

        setSections(sortedSections);

        // Fetch User Progress
        if (session) {
          const allLessonIds = sortedSections.flatMap(s => s.lessons.map(l => l.id));
          if (allLessonIds.length > 0) {
            const { data: progressData } = await supabase
              .from('user_progress')
              .select('lesson_id, is_completed')
              .eq('user_id', session.user.id)
              .in('lesson_id', allLessonIds);
              
            const completedSet = new Set(
              (progressData || []).filter(p => p.is_completed).map(p => p.lesson_id)
            );
            setCompletedLessons(completedSet);
          }
        }

        // Handle Initial Lesson Selection (from State or Default)
        const passedLessonId = location.state?.lessonId;
        let initialLesson = null;
        let initialSectionId = null;

        if (passedLessonId) {
          // Find the lesson in the structure
          for (const section of sortedSections) {
            const lesson = section.lessons.find(l => l.id === passedLessonId);
            if (lesson) {
              initialLesson = lesson;
              initialSectionId = section.id;
              break;
            }
          }
        }

        // Fallback to first lesson if not found or not passed
        if (!initialLesson) {
          const firstSectionWithLessons = sortedSections.find(s => s.lessons.length > 0);
          if (firstSectionWithLessons) {
            initialLesson = firstSectionWithLessons.lessons[0];
            initialSectionId = firstSectionWithLessons.id;
          }
        }

        if (initialLesson) {
          setActiveLesson(initialLesson);
          setExpandedSections({ [initialSectionId]: true });
        }

      } catch (err) {
        console.error("Error in CoursePlayer:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location.state?.lessonId, subjectId]);

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getFlattenedLessons = () => {
    return sections.flatMap(sec => sec.lessons.map(l => ({ ...l, sectionId: sec.id })));
  };

  const getSiblingLesson = (direction) => {
    const flat = getFlattenedLessons();
    const currentIdx = flat.findIndex(l => l.id === activeLesson?.id);
    if (direction === 'next') return flat[currentIdx + 1];
    if (direction === 'prev') return flat[currentIdx - 1];
    return null;
  };

  const handleNavigateLesson = (direction) => {
    const sibling = getSiblingLesson(direction);
    if (sibling) {
      setActiveLesson(sibling);
      setExpandedSections(prev => ({ ...prev, [sibling.sectionId]: true }));
      // Scroll to top of video area when changing lessons
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleCompleted = async (lessonId, currentStatus) => {
    if (!userId) return;
    
    // Optimistic UI Update
    const newStatus = !currentStatus;
    setCompletedLessons(prev => {
      const next = new Set(prev);
      if (newStatus) next.add(lessonId);
      else next.delete(lessonId);
      return next;
    });

    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          lesson_id: lessonId,
          is_completed: newStatus,
          last_watched_at: new Date().toISOString()
        }, { onConflict: 'user_id, lesson_id' });
        
      if (error) throw error;
    } catch (err) {
      console.error("Error setting progress:", err);
      // Revert on error
      setCompletedLessons(prev => {
        const next = new Set(prev);
        if (currentStatus) next.add(lessonId);
        else next.delete(lessonId);
        return next;
      });
    }
  };

  // Extract YouTube ID from URL
  const getYTId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Loader2 size={48} className="animate-spin" color="white" />
      </div>
    );
  }

  if (!subject) return <div style={{ padding: '2rem' }}>Subject not found.</div>;

  const canWatch = userIsSubscribed || activeLesson?.is_free;
  const youtubeId = activeLesson ? getYTId(activeLesson.video_url) : null;

  return (
    <div className="course-player-container" style={{ margin: '-1rem' }}>

      {/* ===== MOBILE TAB SWITCHER ===== */}
      <div className="player-mobile-tabs" style={{ position: 'sticky', top: 0, left: 0, right: 0, zIndex: 100 }}>
        <button 
          onClick={() => setMobileTab('video')}
          className={`player-tab-btn ${mobileTab === 'video' ? 'active' : ''}`}
          style={{ borderBottom: `3px solid ${mobileTab === 'video' ? subject.color_hex : 'transparent'}` }}
        >
          ▶ Now Playing
        </button>
        <button 
          onClick={() => setMobileTab('syllabus')}
          className={`player-tab-btn ${mobileTab === 'syllabus' ? 'active' : ''}`}
          style={{ borderBottom: `3px solid ${mobileTab === 'syllabus' ? subject.color_hex : 'transparent'}` }}
        >
          ☰ Course Content
        </button>
      </div>

      {/* ===== VIDEO / PAYWALL PANE ===== */}
      <div className={`player-main-pane ${mobileTab === 'syllabus' ? 'hidden-on-mobile' : ''}`}>

        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          borderBottom: '1px solid #3e4143',
          flexShrink: 0,
          background: '#1c1d1f'
        }}>
          <Link to="/dashboard" style={{ color: 'white', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={24} />
          </Link>
          <span style={{ fontSize: 'clamp(1rem, 3.5vw, 1.25rem)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'white' }}>
            {subject.title}
          </span>
        </div>

        {/* Video/Lock Area */}
        <div className="player-video-wrapper" style={{ position: 'relative', overflow: 'hidden' }} onContextMenu={(e) => e.preventDefault()}>
          {canWatch ? (
            activeLesson?.video_url ? (
              <>
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`}
                  title={activeLesson.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                ></iframe>

                {/* 
                  Anti-Piracy Click Shield
                  An invisible layer that sits on top of the video and blocks clicks 
                  on the title, share button, and more-videos grid.
                  It only leaves the bottom 50px unblocked so the timeline still works.
                */}
                <div 
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    bottom: '50px',
                    zIndex: 20,
                    cursor: 'default',
                    background: 'transparent'
                  }}
                />

                {/* Anti-Piracy Floating Watermark (Un-clickable) */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none', // Clicks pass through to YouTube/Shield
                  zIndex: 25,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden'
                }}>
                  <div className="dynamic-watermark" style={{
                    color: 'rgba(255, 255, 255, 0.04)', // Very subtle
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    userSelect: 'none'
                  }}>
                    {userEmail} • DO NOT SHARE
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                background: '#1c1d1f',
                textAlign: 'center', padding: '1.5rem'
              }}>
                <Info size={44} color="#a1a7bb" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: 'white' }}>Video Coming Soon</h3>
                <p style={{ color: '#a1a7bb', fontSize: '0.85rem' }}>
                  We are currently preparing the content for this lesson.
                </p>
              </div>
            )
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              background: '#1c1d1f',
              textAlign: 'center', padding: '1.5rem'
            }}>
              <Lock size={44} color="#a1a7bb" style={{ marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: 'white' }}>Subscribe to Watch</h3>
              <p style={{ color: '#a1a7bb', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: '260px' }}>
                Unlock all premium video lessons for {subject.title}.
              </p>
              <button 
                onClick={() => setShowPaymentModal(true)}
                style={{
                  background: subject.color_hex,
                  color: '#000',
                  padding: '0.8rem 2rem',
                  borderRadius: '4px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Subscribe $10/mo
              </button>
            </div>
          )}
        </div>

        {/* Lesson Info & Navigation */}
        <div style={{ padding: '2rem 1.5rem', flexShrink: 0, background: '#1c1d1f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: 'white', marginBottom: '1rem', lineHeight: 1.3 }}>{activeLesson?.title}</h3>
              <p style={{ color: 'white', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '800px' }}>{activeLesson?.description || "No description provided for this lesson."}</p>
            </div>
            
            {/* Quick Navigation Controls */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button 
                onClick={() => handleNavigateLesson('prev')}
                disabled={!getSiblingLesson('prev')}
                style={{ 
                  padding: '0.6rem 1.25rem', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontWeight: 600, borderRadius: '4px',
                  opacity: getSiblingLesson('prev') ? 1 : 0.4, cursor: getSiblingLesson('prev') ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => getSiblingLesson('prev') && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => getSiblingLesson('prev') && (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronLeft size={18} /> Prev
              </button>
              <button 
                onClick={() => handleNavigateLesson('next')}
                disabled={!getSiblingLesson('next')}
                style={{ 
                  padding: '0.6rem 1.25rem', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', 
                  display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontWeight: 600, borderRadius: '4px',
                  opacity: getSiblingLesson('next') ? 1 : 0.4, cursor: getSiblingLesson('next') ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => getSiblingLesson('next') && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => getSiblingLesson('next') && (e.currentTarget.style.background = 'transparent')}
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SYLLABUS SIDEBAR ===== */}
      <div className={`player-side-pane ${mobileTab === 'video' ? 'hidden-on-mobile' : ''}`}>

        <div style={{
          padding: '1rem',
          borderBottom: '1px solid #3e4143',
          position: 'sticky', top: 0,
          background: '#1c1d1f', zIndex: 5
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>Course Content</h3>
        </div>

        {sections.map((section, index) => {
          const isExpanded = expandedSections[section.id];
          return (
            <div key={section.id} style={{ borderBottom: '1px solid #3e4143' }}>

              {/* Section header — click to expand */}
              <div
                onClick={() => toggleSection(section.id)}
                style={{
                  padding: '1rem',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: '#1c1d1f',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#2d2f31'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#1c1d1f'}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                  <p style={{
                    margin: 0, fontSize: '0.95rem', fontWeight: 700,
                    color: 'white', lineHeight: 1.3
                  }}>
                    Section {index + 1}: {section.title}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#a1a7bb', marginTop: '0.2rem' }}>
                    {section.lessons.filter(l => completedLessons.has(l.id)).length} / {section.lessons.length} | {section.lessons.reduce((acc, l) => acc + (parseInt(l.duration) || 5), 0)} min
                  </p>
                </div>
                <div style={{ color: 'white', flexShrink: 0, marginTop: '0.1rem' }}>
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronLeft size={18} style={{ transform: 'rotate(-90deg)' }} />}
                </div>
              </div>

              {/* Lessons list */}
              {isExpanded && (
                <div style={{ background: '#1c1d1f' }}>
                  {section.lessons.map((lesson) => {
                    const isActive = activeLesson?.id === lesson.id;
                    const canPlay = userIsSubscribed || lesson.is_free;

                    return (
                      <div 
                        key={lesson.id} 
                        onClick={() => setActiveLesson(lesson)}
                        style={{
                          padding: '0.75rem 1rem',
                          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                          cursor: 'pointer',
                          background: isActive ? '#2d2f31' : '#1c1d1f',
                          transition: 'background 0.1s'
                        }}
                        onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = '#2d2f31')}
                        onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = '#1c1d1f')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', paddingTop: '0.1rem' }}>
                          <input 
                            type="checkbox" 
                            checked={completedLessons.has(lesson.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleCompleted(lesson.id, completedLessons.has(lesson.id));
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-physics)' }} 
                            onClick={(e) => e.stopPropagation()} 
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ 
                            fontSize: '0.9rem', 
                            color: 'white',
                            fontWeight: isActive ? 700 : 400,
                            margin: 0,
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {lesson.title}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
                            <PlayCircle size={12} color="#a1a7bb" />
                            <span style={{ fontSize: '0.75rem', color: '#a1a7bb' }}>{lesson.duration || '5:00'}</span>
                            {!canPlay && (
                               <Lock size={10} color="#a1a7bb" style={{ marginLeft: '0.2rem' }} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          subject={subject}
          userId={userId}
          userEmail={userEmail}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            setUserIsSubscribed(true);
          }}
        />
      )}

      <style>{`
        @keyframes floatWatermark {
          0% { transform: translate(-40%, -40%) rotate(-10deg); }
          25% { transform: translate(30%, -20%) rotate(5deg); }
          50% { transform: translate(20%, 30%) rotate(10deg); }
          75% { transform: translate(-30%, 20%) rotate(0deg); }
          100% { transform: translate(-40%, -40%) rotate(-10deg); }
        }
        .dynamic-watermark {
          animation: floatWatermark 30s infinite linear alternate;
        }
      `}</style>
    </div>
  );
}
