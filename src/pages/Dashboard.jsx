import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, Target, Trophy, BookOpen, Clock, ArrowRight, Loader2, Star, StarHalf } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PaymentModal from '../components/PaymentModal';

const IconMap = {
  Target: Target,
  Trophy: Trophy,
  BookOpen: BookOpen
};

const getSubjectImage = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('math')) return 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=600';
  if (t.includes('physic')) return 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&q=80&w=600';
  if (t.includes('chem')) return 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=600';
  if (t.includes('bio')) return 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&q=80&w=600';
  if (t.includes('geograph')) return 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600';
  return 'https://images.unsplash.com/photo-1456406644174-8ddd4cd52a06?auto=format&fit=crop&q=80&w=600';
};

export default function Dashboard() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasStartedLearning, setHasStartedLearning] = useState(false);
  const [lastLesson, _setLastLesson] = useState(null);
  const [_firstName, setFirstName] = useState('');
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [paymentSubject, setPaymentSubject] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }
        
        const name = session.user.user_metadata?.full_name || 'Student';
        setFirstName(name.split(' ')[0]);
        setUserId(session.user.id);
        setUserEmail(session.user.email);

        // 1. Fetch Subjects & Progress
        const { data: allSubjects } = await supabase.from('subjects').select('*');
        const { data: userSubs } = await supabase
          .from('user_subscriptions')
          .select('subject_id')
          .eq('user_id', session.user.id)
          .eq('active', true);

        // Fetch progress to calculate percentage
        const { data: progressData } = await supabase
          .from('user_progress')
          .select('lesson_id, is_completed')
          .eq('user_id', session.user.id)
          .eq('is_completed', true);

        // Fetch total lessons to calculate percentage
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('id, section_id, sections!inner(subject_id)');

        const subscribedIds = new Set(userSubs?.map(s => s.subject_id) || []);
        const completedLessonIds = new Set(progressData?.map(p => p.lesson_id) || []);

        if (allSubjects) {
          setSubjects(allSubjects.map(sub => {
            const subjectLessons = lessonsData?.filter(l => l.sections.subject_id === sub.id) || [];
            const totalLessons = subjectLessons.length;
            const completedLessons = subjectLessons.filter(l => completedLessonIds.has(l.id)).length;
            const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

            return {
              ...sub,
              icon: IconMap[sub.icon_name] || BookOpen,
              isSubscribed: subscribedIds.has(sub.id),
              progress: progressPercent
            };
          }));
        }

        // We have temporarily removed the user_progress query here 
        // to prevent the 400 Bad Request error from blocking the dashboard.
        setHasStartedLearning(false);

      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ height: '40px', width: '200px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '2rem' }} className="skeleton-pulse"></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '320px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ height: '160px', background: 'rgba(255,255,255,0.05)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }} className="skeleton-pulse"></div>
              <div style={{ padding: '1rem' }}>
                <div style={{ height: '20px', width: '80%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '1rem' }} className="skeleton-pulse"></div>
                <div style={{ height: '14px', width: '40%', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', marginBottom: '1.5rem' }} className="skeleton-pulse"></div>
                <div style={{ height: '36px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }} className="skeleton-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Resume Learning Section */}
      {hasStartedLearning && lastLesson && (
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} color={lastLesson?.sections?.subjects?.color_hex || 'var(--accent-physics)'} /> Continue Watching
          </h2>
          
          <div className="glass-panel" style={{
            display: 'flex',
            flexDirection: 'column', 
            padding: '1.5rem',
            borderRadius: '20px',
            borderLeft: `4px solid ${lastLesson?.sections?.subjects?.color_hex || 'var(--accent-physics)'}`,
            background: `linear-gradient(135deg, rgba(255,255,255,0.03), transparent)`,
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '300px',
                aspectRatio: '16/9',
                background: '#000',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.6)), url('https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&q=80') center/cover`, opacity: 0.6 }}></div>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlayCircle size={48} color={lastLesson?.sections?.subjects?.color_hex || 'var(--accent-physics)'} style={{ filter: `drop-shadow(0 0 10px ${lastLesson?.sections?.subjects?.color_hex || 'var(--accent-physics)'}80)` }} />
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '280px' }}>
                <span style={{ color: lastLesson?.sections?.subjects?.color_hex || 'var(--accent-physics)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  {lastLesson?.sections?.subjects?.title || 'Subject'} • {lastLesson?.sections?.title || 'Section'}
                </span>
                <h3 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{lastLesson?.title}</h3>
                
                <div>
                  <Link to={`/play/${lastLesson?.sections?.subjects?.id}`} state={{ lessonId: lastLesson?.id }} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    background: lastLesson?.sections?.subjects?.color_hex || 'var(--accent-physics)',
                    color: '#000',
                    padding: '0.8rem 1.75rem',
                    borderRadius: '12px',
                    fontWeight: 800,
                    textDecoration: 'none',
                    boxShadow: `0 8px 20px ${lastLesson?.sections?.subjects?.color_hex || 'var(--accent-physics)'}40`
                  }}>
                    Resume Lesson <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Available Subjects Grid (Selling Point) */}
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Available Subjects</h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {subjects.length > 0 ? (
            subjects.map((sub) => {
              const imgUrl = getSubjectImage(sub.title);
              return (
                <div key={sub.id} className="udemy-card" style={{
                  background: '#1c1d1f',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid #3e4143',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  <Link to={sub.isSubscribed ? `/play/${sub.id}` : `/subjects/${sub.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Thumbnail */}
                    <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', position: 'relative' }}>
                      <img src={imgUrl} alt={sub.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: sub.color_hex, color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                        ZIMSEC
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'white', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                        {sub.title} - Full Masterclass
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#a1a7bb', marginBottom: '0.4rem' }}>PassIt Instructors</p>
                      
                      {/* Rating */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#f69c08', fontWeight: 700, fontSize: '0.9rem' }}>4.8</span>
                        <div style={{ display: 'flex', color: '#f69c08' }}>
                          <Star size={14} fill="#f69c08" />
                          <Star size={14} fill="#f69c08" />
                          <Star size={14} fill="#f69c08" />
                          <Star size={14} fill="#f69c08" />
                          <StarHalf size={14} fill="#f69c08" />
                        </div>
                        <span style={{ color: '#a1a7bb', fontSize: '0.8rem' }}>(1,234)</span>
                      </div>

                      {/* Price / Status */}
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {sub.isSubscribed ? (
                          <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#a1a7bb', marginBottom: '0.3rem' }}>
                              <span>{sub.progress}% Completed</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: '#3e4143', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${sub.progress}%`, height: '100%', background: sub.color_hex, transition: 'width 1s ease-out' }}></div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
                            $10<span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#a1a7bb' }}>/month</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Actions (only if not subscribed) */}
                  {!sub.isSubscribed && (
                    <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPaymentSubject(sub);
                      }} style={{
                        width: '100%',
                        background: sub.color_hex,
                        color: '#000',
                        border: 'none',
                        padding: '0.6rem',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginTop: '0.5rem'
                      }}>
                        Subscribe $10/mo
                      </button>
                      <Link to={`/subjects/${sub.id}`} onClick={(e) => e.stopPropagation()} style={{
                        width: '100%',
                        background: 'transparent',
                        color: 'white',
                        border: '1px solid white',
                        padding: '0.6rem',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        textAlign: 'center',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.color = '#000';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'white';
                      }}
                      >
                        Preview Course
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#a1a7bb' }}>
              No subjects available at the moment.
            </div>
          )}
        </div>
      </section>

      {/* Payment Modal */}
      {paymentSubject && (
        <PaymentModal
          subject={paymentSubject}
          userId={userId}
          userEmail={userEmail}
          onClose={() => setPaymentSubject(null)}
          onSuccess={() => {
            setPaymentSubject(null);
            // Re-fetch to update subscription status
            window.location.reload();
          }}
        />
      )}

    </div>
  );
}
