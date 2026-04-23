import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Lock, MonitorPlay, Loader2, Search, 
  ChevronDown, ChevronRight, ListFilter,
  Maximize2, Minimize2, PlayCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UX State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: subData } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
        setSubject(subData);

        const { data: sectionsData } = await supabase
          .from('sections')
          .select(`*, lessons (*)`)
          .eq('subject_id', subjectId)
          .order('order_index');

        const sortedData = (sectionsData || []).map(section => ({
          ...section,
          lessons: (section.lessons || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
        }));

        setSections(sortedData);
        
        // Expand first section by default
        if (sortedData.length > 0) {
          setExpandedSections({ [sortedData[0].id]: true });
        }

      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [subjectId]);

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const all = {};
    sections.forEach(s => all[s.id] = true);
    setExpandedSections(all);
  };

  const handleCollapseAll = () => setExpandedSections({});

  const filteredSections = sections.map(sec => ({
    ...sec,
    lessons: sec.lessons.filter(l => 
      l.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(sec => sec.lessons.length > 0 || searchQuery === '');

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader2 size={48} className="animate-spin" color="var(--accent-physics)" />
      </div>
    );
  }

  if (!subject) return <div style={{ padding: '2rem' }}>Subject not found.</div>;

  const totalLessons = sections.reduce((acc, sec) => acc + (sec.lessons?.length || 0), 0);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '5rem', padding: '0 1rem' }}>
      
      {/* Subject Header (Udemy Style Hero) */}
      <div style={{
        padding: '3rem 2rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        marginTop: '1rem',
        background: '#1c1d1f',
        border: '1px solid #3e4143',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle background glow based on subject color */}
        <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px', background: subject.color_hex, filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none' }}></div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', position: 'relative', zIndex: 2 }}>
           <span style={{ fontSize: '0.75rem', background: '#3e4143', padding: '0.25rem 0.6rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700, color: 'white' }}>
             {sections.length} Sections
           </span>
           <span style={{ fontSize: '0.75rem', background: '#3e4143', padding: '0.25rem 0.6rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700, color: 'white' }}>
             {totalLessons} Lessons
           </span>
        </div>
        
        <h1 style={{ 
          fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', 
          marginBottom: '0.75rem', 
          lineHeight: 1.2,
          color: 'white',
          position: 'relative', zIndex: 2
        }}>
          {subject.title} Masterclass
        </h1>
        <p style={{ color: '#a1a7bb', fontSize: '1rem', maxWidth: '600px', lineHeight: 1.5, position: 'relative', zIndex: 2 }}>
          Comprehensive ZIMSEC breakdown. Master every concept with expert-led video tutorials.
        </p>
      </div>

      {/* Toolbar: Search & View Controls */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '1rem', 
        marginBottom: '1.5rem'
      }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a7bb' }} />
          <input 
            type="text"
            placeholder="Search topics or lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.85rem 1rem 0.85rem 3rem',
              background: '#1c1d1f',
              border: '1px solid #3e4143',
              color: 'white',
              fontSize: '0.95rem',
              outline: 'none'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
          <button 
            onClick={handleExpandAll} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              color: 'white', background: '#1c1d1f', border: '1px solid #3e4143',
              padding: '0.5rem 1rem'
            }}
          >
            <Maximize2 size={14} /> Expand All
          </button>
          <button 
            onClick={handleCollapseAll} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              color: 'white', background: '#1c1d1f', border: '1px solid #3e4143',
              padding: '0.5rem 1rem'
            }}
          >
            <Minimize2 size={14} /> Collapse
          </button>
        </div>
      </div>

      {/* Curriculum List */}
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #3e4143', background: '#1c1d1f' }}>
        {filteredSections.map((section, index) => {
          const isExpanded = expandedSections[section.id];
          return (
            <div key={section.id} style={{
              borderBottom: index < filteredSections.length - 1 ? '1px solid #3e4143' : 'none'
            }}>
              
              {/* Section Header */}
              <div 
                onClick={() => toggleSection(section.id)}
                style={{ 
                  padding: '1.25rem 1.5rem', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: isExpanded ? '#2d2f31' : 'transparent',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={(e) => !isExpanded && (e.currentTarget.style.background = '#2d2f31')}
                onMouseLeave={(e) => !isExpanded && (e.currentTarget.style.background = 'transparent')}
                >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    Section {index + 1}: {section.title}
                  </h3>
                </div>
                <div style={{ color: '#a1a7bb', fontSize: '0.85rem' }}>
                  {section.lessons.length} lectures
                </div>
              </div>

              {/* Lessons List (Collapsible Content) */}
              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', background: 'transparent' }}>
                  {section.lessons.length > 0 ? (
                    section.lessons.map((lesson) => (
                      <div 
                        key={lesson.id} 
                        onClick={() => navigate(`/play/${subjectId}`, { state: { lessonId: lesson.id } })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.85rem 1.5rem 0.85rem 3rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #3e4143',
                          background: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                           {lesson.is_free ? (
                             <PlayCircle size={16} color={subject.color_hex} /> 
                           ) : (
                             <div style={{ position: 'relative' }}>
                               <PlayCircle size={16} color="#a1a7bb" />
                               <Lock size={10} color="#1c1d1f" style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#a1a7bb', borderRadius: '50%', padding: '1px' }} />
                              </div>
                           )}
                           <span style={{ fontSize: '0.9rem', color: lesson.is_free ? 'white' : '#a1a7bb', textDecoration: lesson.is_free ? 'underline' : 'none' }}>
                             {lesson.title}
                           </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                           {lesson.is_free ? (
                             <span style={{ fontSize: '0.75rem', color: subject.color_hex, fontWeight: 700 }}>
                               Preview
                             </span>
                           ) : (
                             <span style={{ fontSize: '0.75rem', color: '#a1a7bb' }}>
                               {lesson.duration || '10:00'}
                             </span>
                           )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '2rem' }}>
                       No matches found for "{searchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
