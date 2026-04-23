import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, Target, Trophy, BookOpen, Clock, ArrowRight, Loader2, Star, StarHalf } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

export default function MySubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrolled = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch subjects that the user has a subscription for
        const { data: subData, error: subError } = await supabase
          .from('user_subscriptions')
          .select(`
            subject_id,
            subjects (*)
          `)
          .eq('user_id', session.user.id)
          .eq('active', true);

        if (subError) throw subError;

        if (subData) {
          const enrolled = subData.map(item => ({
            ...item.subjects,
            icon: IconMap[item.subjects.icon_name] || BookOpen
          }));
          setSubjects(enrolled);
        }
      } catch (err) {
        console.error("Error fetching enrolled subjects:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEnrolled();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader2 size={48} className="animate-spin" color="var(--accent-physics)" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>My Subjects</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
        Access your active courses and continue your learning journey.
      </p>

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
                <Link to={`/play/${sub.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, display: 'flex', flexDirection: 'column' }}>

                  {/* Thumbnail */}
                  <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', position: 'relative' }}>
                    <img src={imgUrl} alt={sub.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: sub.color_hex, color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                      ENROLLED
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

                    {/* Action */}
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
                      <span style={{ color: '#39FF14', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <PlayCircle size={16} /> Resume Course
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })
        ) : (
          <div className="glass-panel" style={{ 
            gridColumn: '1 / -1', 
            padding: '4rem 2rem', 
            textAlign: 'center',
            borderRadius: '16px',
            border: '1px dashed rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No Subscriptions Yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
              You haven't enrolled in any subjects yet. Visit the home page to browse our ZIMSEC A-Level catalog.
            </p>
            <Link to="/dashboard" style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              padding: '0.75rem 2rem',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              textDecoration: 'none',
              display: 'inline-block'
            }}>
              Browse Subjects
            </Link>
          </div>
        )}
      </div>    </div>
  );
}
