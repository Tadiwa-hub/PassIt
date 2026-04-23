const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.jsx', 'utf8');

// 1. Add User import
code = code.replace(
  'Search, Video, Lock, Unlock, Eye, Loader2, Link as LinkIcon',
  'Search, Video, Lock, Unlock, Eye, Loader2, Link as LinkIcon, User'
);

// 2. Add State for activeTab and students
code = code.replace(
  'const [expandedSections, setExpandedSections] = useState({});',
  'const [expandedSections, setExpandedSections] = useState({});\n  const [activeTab, setActiveTab] = useState("content");\n  const [students, setStudents] = useState([]);'
);

// 3. Add fetchStudents and toggleBanStatus
const fetchSyllabusStr = 'async function fetchSyllabus(subjectId) {';
const functionsToAdd = `
  async function fetchStudents() {
    setLoading(true);
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*, user_subscriptions(subject_id, subjects(title))')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
      
    if (!profilesError && profilesData) {
      setStudents(profilesData);
    }
    setLoading(false);
  }

  const toggleBanStatus = async (studentId, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('profiles')
      .update({ is_banned: newStatus })
      .eq('id', studentId);
      
    if (!error) {
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, is_banned: newStatus } : s));
      setMessage({ type: 'success', text: newStatus ? 'User banned.' : 'User unbanned.' });
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ type: 'error', text: error.message });
    }
  }

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents();
    }
  }, [activeTab]);

`;
code = code.replace(fetchSyllabusStr, functionsToAdd + fetchSyllabusStr);

// 4. Update Header
const oldHeader = `<header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Management Hub</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upload videos and automatically fill titles by just pasting a YouTube URL!</p>
      </header>`;
const newHeader = `<header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
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
        </div>
      </header>`;
code = code.replace(oldHeader, newHeader);

// 5. Wrap existing layout in {activeTab === 'content' ? ( ... ) : ( ...students_view... )}
const tabContentStart = '{/* Subject Selector Tabs */}';
const tabContentEndStr = `      </div>

      <style>{\``;
const studentsView = `

      {activeTab === 'content' ? (
        <>
          {/* Subject Selector Tabs */}`;
          
const studentsViewEnd = `
        </>
      ) : (
        <div className="admin-layout-container" style={{ gridTemplateColumns: '1fr' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Registered Students</h2>
            {students.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No students found.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '1rem', fontWeight: 600 }}>Student Name</th>
                      <th style={{ padding: '1rem', fontWeight: 600 }}>Purchased Subjects</th>
                      <th style={{ padding: '1rem', fontWeight: 600 }}>Status / Warnings</th>
                      <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 600 }}>{student.full_name || 'Unnamed Student'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Joined {new Date(student.created_at).toLocaleDateString()}</div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {student.user_subscriptions?.length > 0 ? (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {student.user_subscriptions.map(sub => (
                                <span key={sub.subject_id} style={{ background: 'rgba(57, 255, 20, 0.1)', color: '#39FF14', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', border: '1px solid #39FF1440' }}>
                                  {sub.subjects?.title}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No purchases</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {student.is_banned ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ff4444', fontSize: '0.85rem' }}><Lock size={14} /> Banned</span>
                            ) : (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#39FF14', fontSize: '0.85rem' }}><CheckCircle2 size={14} /> Active</span>
                            )}
                            
                            {student.login_count > 20 && (
                              <span title="High login count - possible device sharing" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ffa500', fontSize: '0.85rem', background: 'rgba(255, 165, 0, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                <AlertCircle size={14} /> Suspicious
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button 
                            onClick={() => toggleBanStatus(student.id, student.is_banned)}
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: student.is_banned ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 68, 68, 0.1)', color: student.is_banned ? '#39FF14' : '#ff4444', border: student.is_banned ? '1px solid #39FF1440' : '1px solid #ff444440', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                          >
                            {student.is_banned ? 'Unban User' : 'Ban User'}
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
      )}

      <style>{\``;

code = code.replace(tabContentStart, studentsView);
code = code.replace(tabContentEndStr, studentsViewEnd);

fs.writeFileSync('src/pages/Admin.jsx', code);
console.log('Admin.jsx successfully updated.');
