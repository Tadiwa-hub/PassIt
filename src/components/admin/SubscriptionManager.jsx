import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, UserPlus, Trash2, Loader2, CheckCircle2 } from 'lucide-react';

export default function SubscriptionManager() {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'student');
    const { data: subjectsData } = await supabase.from('subjects').select('*');
    setStudents(profiles || []);
    setSubjects(subjectsData || []);
    setLoading(false);
  }

  const handleAddSubscription = async (studentId, subjectId) => {
    const { error } = await supabase
      .from('user_subscriptions')
      .upsert({ user_id: studentId, subject_id: subjectId, active: true }, { onConflict: 'user_id, subject_id' });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Subscription added successfully!' });
      setTimeout(() => setMessage(null), 2500);
      fetchData(); // Refresh
    }
  };

  const handleRemoveSubscription = async (studentId, subjectId) => {
    const { error } = await supabase
      .from('user_subscriptions')
      .delete()
      .eq('user_id', studentId)
      .eq('subject_id', subjectId);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Subscription removed.' });
      setTimeout(() => setMessage(null), 2500);
      fetchData();
    }
  };

  const filteredStudents = students.filter(s => 
    (s.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <UserPlus size={20} /> Subscription Manager
      </h2>

      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Search student by name or ID..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-input"
          style={{ width: '100%', paddingLeft: '2.8rem' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredStudents.map(student => (
            <div key={student.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{student.full_name || 'Unnamed Student'}</h4>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{student.id}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {subjects.map(subject => {
                  // This is a bit inefficient for a large number of students, but fine for now
                  // Ideally we'd fetch subscriptions in the main query
                  return (
                    <button 
                      key={subject.id}
                      onClick={() => handleAddSubscription(student.id, subject.id)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      + {subject.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div style={{ marginTop: '1rem', padding: '0.8rem', borderRadius: '10px', background: message.type === 'success' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 0, 0, 0.1)', color: message.type === 'success' ? '#39FF14' : '#ff4444', fontSize: '0.85rem' }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
