const { useState, useEffect, useCallback, useRef } = React;
const { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Cell } = Recharts;

// ── Constants ─────────────────────────────────────────────────────────────────
const LABELS = ['A','B','C','D'];
const STORAGE_KEY = 'rcdd_state_v1';
const BASE_URL = '/Quiz/questions.json';

const TEST_COLORS = {
  1:'#7c3aed', 2:'#0284c7', 3:'#059669', 4:'#d97706',
  5:'#dc2626', 6:'#0891b2', 7:'#65a30d', 8:'#9333ea',
  9:'#0f766e', 10:'#be185d'
};
const TEST_LIGHT = {
  1:'#f5f3ff', 2:'#f0f9ff', 3:'#ecfdf5', 4:'#fffbeb',
  5:'#fef2f2', 6:'#ecfeff', 7:'#f7fee7', 8:'#faf5ff',
  9:'#f0fdfa', 10:'#fdf2f8'
};

// ── Storage ───────────────────────────────────────────────────────────────────
function loadState() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch(e) {}
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const [allQ, setAllQ] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [screen, setScreen] = useState('home');
  const [activeTest, setActiveTest] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [state, setState] = useState(() => {
    const s = loadState();
    return s || { sessions: {}, history: [], starred: [] };
  });

  // Load questions
  useEffect(() => {
    fetch(BASE_URL)
      .then(r => { if (!r.ok) throw new Error('Failed to load questions'); return r.json(); })
      .then(data => { setAllQ(data); setLoading(false); })
      .catch(e => {
        // Try cached
        setError('Could not load questions. Please check your connection.');
        setLoading(false);
      });
  }, []);

  useEffect(() => { saveState(state); }, [state]);

  const tests = React.useMemo(() => {
    if (!allQ.length) return [];
    const map = {};
    allQ.forEach(q => {
      if (!map[q.test]) map[q.test] = { id: q.test, name: q.testName, questions: [] };
      map[q.test].questions.push(q);
    });
    return Object.values(map).sort((a,b) => a.id - b.id);
  }, [allQ]);

  const getSession = useCallback((testId) => {
    if (state.sessions[testId]) return state.sessions[testId];
    const t = tests.find(x => x.id === testId);
    if (!t) return null;
    const qs = shuffle(t.questions);
    const sess = { questions: qs, answers: Array(qs.length).fill(null) };
    setState(prev => ({ ...prev, sessions: { ...prev.sessions, [testId]: sess }}));
    return sess;
  }, [state.sessions, tests]);

  const submitAnswer = useCallback((testId, qIdx, optIdx) => {
    setState(prev => {
      const sess = prev.sessions[testId];
      if (!sess || sess.answers[qIdx] !== null) return prev;
      const newAns = [...sess.answers]; newAns[qIdx] = optIdx;
      return { ...prev, sessions: { ...prev.sessions, [testId]: { ...sess, answers: newAns }}};
    });
  }, []);

  const completeTest = useCallback((testId) => {
    const sess = state.sessions[testId];
    if (!sess) return;
    const score = sess.questions.filter((q,i) => sess.answers[i] === q.a).length;
    const entry = { date: new Date().toISOString(), testId, score, total: sess.questions.length, pct: Math.round(score/sess.questions.length*100) };
    setState(prev => ({ ...prev, history: [entry, ...prev.history] }));
    setScreen('result');
  }, [state.sessions]);

  const reshuffleTest = useCallback((testId) => {
    const t = tests.find(x => x.id === testId);
    if (!t) return;
    const qs = shuffle(t.questions);
    setState(prev => ({ ...prev, sessions: { ...prev.sessions, [testId]: { questions: qs, answers: Array(qs.length).fill(null) }}}));
    setScreen('test');
  }, [tests]);

  const resetTest = useCallback((testId) => {
    setState(prev => {
      const sess = prev.sessions[testId];
      if (!sess) return prev;
      return { ...prev, sessions: { ...prev.sessions, [testId]: { ...sess, answers: Array(sess.questions.length).fill(null) }}};
    });
    setScreen('test');
  }, []);

  const toggleStar = useCallback((qId) => {
    setState(prev => {
      const starred = prev.starred.includes(qId) ? prev.starred.filter(s=>s!==qId) : [...prev.starred, qId];
      return { ...prev, starred };
    });
  }, []);

  const testStats = React.useMemo(() => {
    return tests.map(t => {
      const sess = state.sessions[t.id];
      if (!sess) return { testId: t.id, name: t.name, done: 0, correct: 0, total: t.questions.length, pct: null };
      const done = sess.answers.filter(a => a !== null).length;
      const correct = sess.questions.filter((q,i) => sess.answers[i] === q.a && sess.answers[i] !== null).length;
      return { testId: t.id, name: t.name, done, correct, total: sess.questions.length, pct: done > 0 ? Math.round(correct/done*100) : null };
    });
  }, [tests, state.sessions]);

  const totalAnswered = testStats.reduce((s,ts) => s+ts.done, 0);
  const totalQs = testStats.reduce((s,ts) => s+ts.total, 0);
  const totalCorrect = testStats.reduce((s,ts) => s+ts.correct, 0);
  const overallScore = totalAnswered > 0 ? Math.round(totalCorrect/totalAnswered*100) : null;

  if (loading) return React.createElement(LoadingScreen);
  if (error) return React.createElement(ErrorScreen, { message: error });

  return React.createElement('div', { style: styles.shell },
    React.createElement(SideMenu, { open: menuOpen, onClose: () => setMenuOpen(false), testStats, history: state.history, totalAnswered, totalQs, totalCorrect, overallScore }),
    screen === 'home' && React.createElement(HomeScreen, { tests, testStats, overallScore, totalAnswered, totalQs, onSelect: id => { setActiveTest(id); getSession(id); setScreen('test'); }, onMenu: () => setMenuOpen(true), onReshuffleAll: () => { tests.forEach(t => { const qs = shuffle(t.questions); setState(prev => ({ ...prev, sessions: { ...prev.sessions, [t.id]: { questions: qs, answers: Array(qs.length).fill(null) }}})); }); }}),
    screen === 'test' && activeTest && React.createElement(TestScreen, { testId: activeTest, session: state.sessions[activeTest], starred: state.starred, onAnswer: submitAnswer, onStar: toggleStar, onBack: () => setScreen('home'), onFinish: () => completeTest(activeTest) }),
    screen === 'result' && activeTest && React.createElement(ResultScreen, { testId: activeTest, session: state.sessions[activeTest], onBack: () => setScreen('test'), onRetry: () => resetTest(activeTest), onReshuffle: () => reshuffleTest(activeTest), onHome: () => setScreen('home') })
  );
}

// ── Loading / Error ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return React.createElement('div', { style: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, background:'#f8fafc' } },
    React.createElement('div', { style: { fontSize:40 } }, '📡'),
    React.createElement('p', { style: { fontSize:16, color:'#64748b', fontWeight:600 } }, 'Loading questions…')
  );
}
function ErrorScreen({ message }) {
  return React.createElement('div', { style: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'#f8fafc', padding:32 } },
    React.createElement('div', { style: { fontSize:40 } }, '⚠️'),
    React.createElement('p', { style: { fontSize:15, color:'#dc2626', textAlign:'center', fontWeight:600 } }, message),
    React.createElement('p', { style: { fontSize:13, color:'#94a3b8', textAlign:'center' } }, 'If you are offline, try again when connected. The app will cache questions for future offline use.')
  );
}

// ── Side Menu ─────────────────────────────────────────────────────────────────
function SideMenu({ open, onClose, testStats, history, totalAnswered, totalQs, totalCorrect, overallScore }) {
  const accuracy = totalAnswered > 0 ? Math.round(totalCorrect/totalAnswered*100) : 0;
  const completion = totalQs > 0 ? Math.round(totalAnswered/totalQs*100) : 0;
  const sessions = history.length;
  const bestScore = history.length ? Math.max(...history.map(h=>h.pct)) : null;
  const avgScore = history.length ? Math.round(history.reduce((s,h)=>s+h.pct,0)/history.length) : null;
  const radarData = testStats.map(ts => ({ subject: ts.name.split(' ')[0].slice(0,6), score: ts.pct || 0, fullName: ts.name }));
  const trend = [...history].slice(0,10).reverse().map((h,i) => ({ x: i+1, score: h.pct }));

  return React.createElement('div', null,
    open && React.createElement('div', { onClick: onClose, style: { position:'fixed',inset:0,background:'rgba(15,23,42,0.45)',zIndex:40,backdropFilter:'blur(2px)' }}),
    React.createElement('div', { style: { position:'fixed',top:0,left:0,height:'100vh',width:290,background:'#fff',zIndex:50,overflowY:'auto',transition:'transform 0.28s ease',transform:open?'translateX(0)':'translateX(-100%)',boxShadow:'6px 0 32px rgba(0,0,0,0.12)',paddingBottom:60 }},
      // Header
      React.createElement('div', { style: { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'52px 18px 14px',borderBottom:'1px solid #f1f5f9' }},
        React.createElement('span', { style: { fontSize:20,fontWeight:800,color:'#0f172a' } }, 'Analytics'),
        React.createElement('button', { onClick: onClose, style: { background:'#f1f5f9',border:'none',borderRadius:8,width:30,height:30,fontSize:13,color:'#64748b' }}, '✕')
      ),
      React.createElement('div', { style: { padding:'14px 18px 0' }},
        // Stat grid
        secLabel('OVERALL'),
        React.createElement('div', { style: { display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14 }},
          ...[
            { label:'Score', val: overallScore !== null ? overallScore+'%' : '—', color:'#7c3aed' },
            { label:'Accuracy', val: accuracy+'%', color:'#059669' },
            { label:'Progress', val: completion+'%', color:'#d97706' },
            { label:'Sessions', val: sessions, color:'#0891b2' },
            { label:'Best', val: bestScore !== null ? bestScore+'%' : '—', color:'#dc2626' },
            { label:'Average', val: avgScore !== null ? avgScore+'%' : '—', color:'#9333ea' },
          ].map(({ label, val, color }) =>
            React.createElement('div', { key: label, style: { background:'#f8fafc',borderRadius:10,padding:'10px 12px',border:'1px solid #f1f5f9' }},
              React.createElement('div', { style: { fontSize:20,fontWeight:800,color,lineHeight:1 }}, val),
              React.createElement('div', { style: { fontSize:10,color:'#94a3b8',fontWeight:600,marginTop:3 }}, label)
            )
          )
        ),
        // Progress bar
        React.createElement('div', { style: { background:'#f8fafc',borderRadius:12,padding:'12px 14px',marginBottom:14 }},
          React.createElement('div', { style: { display:'flex',justifyContent:'space-between',marginBottom:7 }},
            React.createElement('span', { style: { fontSize:11,fontWeight:600,color:'#475569' }}, 'Completion'),
            React.createElement('span', { style: { fontSize:11,fontWeight:700,color:'#7c3aed' }}, totalAnswered+'/'+totalQs)
          ),
          React.createElement('div', { style: { height:6,background:'#f1f5f9',borderRadius:3,overflow:'hidden' }},
            React.createElement('div', { style: { height:'100%',background:'linear-gradient(90deg,#7c3aed,#a855f7)',borderRadius:3,width:completion+'%',transition:'width 0.5s' }})
          )
        ),
        // Per-test
        secLabel('TEST BREAKDOWN'),
        React.createElement('div', { style: { marginBottom:14 }},
          ...testStats.map(ts =>
            React.createElement('div', { key: ts.testId, style: { marginBottom:9 }},
              React.createElement('div', { style: { display:'flex',justifyContent:'space-between',marginBottom:4 }},
                React.createElement('span', { style: { fontSize:11,fontWeight:600,color:'#334155' }}, ts.name),
                React.createElement('span', { style: { fontSize:11,fontWeight:700,color:ts.pct===null?'#cbd5e1':ts.pct>=80?'#059669':ts.pct>=60?'#d97706':'#dc2626' }},
                  ts.pct !== null ? ts.pct+'%' : '—'
                )
              ),
              React.createElement('div', { style: { height:4,background:'#f1f5f9',borderRadius:2,overflow:'hidden' }},
                React.createElement('div', { style: { height:'100%',background:TEST_COLORS[ts.testId]||'#6366f1',borderRadius:2,width:(ts.pct||0)+'%',transition:'width 0.4s' }})
              )
            )
          )
        ),
        // Radar
        history.length > 0 && React.createElement('div', null,
          secLabel('TOPIC RADAR'),
          React.createElement('div', { style: { background:'#f8fafc',borderRadius:12,padding:'8px 4px',marginBottom:14 }},
            React.createElement(ResponsiveContainer, { width:'100%', height:150 },
              React.createElement(RadarChart, { data: radarData, margin:{top:5,right:10,bottom:5,left:10} },
                React.createElement(PolarGrid, { stroke:'#e2e8f0' }),
                React.createElement(PolarAngleAxis, { dataKey:'subject', tick:{ fontSize:8, fill:'#94a3b8' } }),
                React.createElement(Radar, { dataKey:'score', stroke:'#7c3aed', fill:'#7c3aed', fillOpacity:0.18, strokeWidth:1.5 }),
                React.createElement(Tooltip, { formatter:(v,n,p) => [v+'%', p.payload.fullName], contentStyle:{ fontSize:10,borderRadius:8,border:'1px solid #e2e8f0' } })
              )
            )
          )
        ),
        // Trend
        trend.length > 1 && React.createElement('div', null,
          secLabel('SCORE TREND'),
          React.createElement('div', { style: { background:'#f8fafc',borderRadius:12,padding:'8px 4px',marginBottom:14 }},
            React.createElement(ResponsiveContainer, { width:'100%', height:80 },
              React.createElement(LineChart, { data: trend, margin:{top:5,right:5,bottom:0,left:-22} },
                React.createElement(CartesianGrid, { stroke:'#f1f5f9', strokeDasharray:'3 3' }),
                React.createElement(XAxis, { dataKey:'x', tick:{ fontSize:8, fill:'#94a3b8' } }),
                React.createElement(YAxis, { domain:[0,100], tick:{ fontSize:8, fill:'#94a3b8' } }),
                React.createElement(Line, { type:'monotone', dataKey:'score', stroke:'#7c3aed', strokeWidth:2, dot:{ r:3, fill:'#7c3aed' } })
              )
            )
          )
        ),
        // Session log
        history.length > 0 && React.createElement('div', null,
          secLabel('RECENT SESSIONS'),
          ...history.slice(0,8).map((h,i) =>
            React.createElement('div', { key:i, style: { display:'flex',alignItems:'center',gap:8,paddingBottom:9,borderBottom:'1px solid #f8fafc' }},
              React.createElement('div', { style: { width:8,height:8,borderRadius:'50%',background:TEST_COLORS[h.testId]||'#6366f1',flexShrink:0 }}),
              React.createElement('span', { style: { fontSize:11,color:'#475569',flex:1 }}, 'Test '+h.testId),
              React.createElement('span', { style: { fontSize:11,fontWeight:700,color:h.pct>=80?'#059669':h.pct>=60?'#d97706':'#dc2626' }}, h.pct+'%'),
              React.createElement('span', { style: { fontSize:10,color:'#94a3b8' }}, new Date(h.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}))
            )
          )
        )
      )
    )
  );
}

function secLabel(text) {
  return React.createElement('p', { style: { fontSize:9,fontWeight:700,color:'#94a3b8',letterSpacing:2,textTransform:'uppercase',marginBottom:10 }}, text);
}

// ── Home Screen ───────────────────────────────────────────────────────────────
function HomeScreen({ tests, testStats, overallScore, totalAnswered, totalQs, onSelect, onMenu, onReshuffleAll }) {
  const pct = totalQs > 0 ? Math.round(totalAnswered/totalQs*100) : 0;
  return React.createElement('div', { style: { minHeight:'100vh',background:'#f8fafc',display:'flex',flexDirection:'column' }},
    React.createElement('div', { style: { background:'#fff',borderBottom:'1px solid #f1f5f9',padding:'52px 20px 14px',display:'flex',alignItems:'center',gap:14 }},
      React.createElement('button', { onClick: onMenu, style: { background:'none',border:'none',padding:4,display:'flex',flexDirection:'column',gap:4.5 }},
        ...[0,1,2].map(i => React.createElement('span', { key:i, style: { display:'block',width:20,height:2,background:'#1e293b',borderRadius:2 }}))
      ),
      React.createElement('div', { style: { flex:1 }},
        React.createElement('div', { style: { fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:2 }}, 'BICSI · RCDD'),
        React.createElement('h1', { style: { fontSize:22,fontWeight:800,color:'#0f172a' }}, 'Quiz Bank')
      ),
      React.createElement('div', { style: { textAlign:'right' }},
        React.createElement('div', { style: { fontSize:24,fontWeight:800,color:'#7c3aed',lineHeight:1 }}, overallScore !== null ? overallScore+'%' : '—'),
        React.createElement('div', { style: { fontSize:10,color:'#94a3b8' }}, 'score')
      )
    ),
    React.createElement('div', { style: { padding:'12px 20px 6px',background:'#fff' }},
      React.createElement('div', { style: { display:'flex',justifyContent:'space-between',marginBottom:5 }},
        React.createElement('span', { style: { fontSize:11,color:'#64748b' }}, 'Overall Progress'),
        React.createElement('span', { style: { fontSize:11,fontWeight:700,color:'#7c3aed' }}, totalAnswered+' / '+totalQs)
      ),
      React.createElement('div', { style: { height:5,background:'#f1f5f9',borderRadius:3,overflow:'hidden' }},
        React.createElement('div', { style: { height:'100%',background:'linear-gradient(90deg,#7c3aed,#a855f7)',borderRadius:3,width:pct+'%' }})
      )
    ),
    React.createElement('div', { style: { flex:1,padding:'16px 20px',overflowY:'auto' }},
      React.createElement('div', { style: { fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:2,marginBottom:12 }}, 'SELECT A TEST'),
      ...tests.map(t => {
        const ts = testStats.find(x => x.testId === t.id) || {};
        const color = TEST_COLORS[t.id]||'#6366f1';
        const light = TEST_LIGHT[t.id]||'#f5f3ff';
        const isComplete = ts.done === ts.total && ts.done > 0;
        return React.createElement('button', { key:t.id, onClick:()=>onSelect(t.id), style:{ width:'100%',background:'#fff',border:'1.5px solid '+(isComplete?color+'50':'#e2e8f0'),borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,marginBottom:9,textAlign:'left' }},
          React.createElement('div', { style:{ width:38,height:38,borderRadius:11,background:light,color:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,flexShrink:0 }}, t.id),
          React.createElement('div', { style:{ flex:1,minWidth:0 }},
            React.createElement('div', { style:{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }},
              React.createElement('span', { style:{ fontSize:13,fontWeight:700,color:'#0f172a' }}, t.name),
              isComplete && React.createElement('span', { style:{ fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:20,background:light,color:color }}, '✓')
            ),
            React.createElement('div', { style:{ fontSize:11,color:'#94a3b8',marginBottom:5 }}, t.questions.length+' questions'),
            React.createElement('div', { style:{ height:3,background:'#f1f5f9',borderRadius:2,overflow:'hidden' }},
              React.createElement('div', { style:{ height:'100%',background:color,borderRadius:2,width:ts.total>0?((ts.done/ts.total)*100)+'%':'0%' }})
            )
          ),
          React.createElement('div', { style:{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:1 }},
            ts.pct !== null ? React.createElement('span', { style:{ fontSize:17,fontWeight:800,color:color }}, ts.pct+'%') : React.createElement('span', { style:{ fontSize:13,color:'#e2e8f0' }}, '—')
          ),
          React.createElement('span', { style:{ fontSize:20,color:'#cbd5e1',marginLeft:2 }}, '›')
        );
      }),
      React.createElement('button', { onClick: onReshuffleAll, style:{ width:'100%',background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:12,padding:'12px',fontSize:13,fontWeight:600,color:'#64748b',marginTop:4 }}, '↺ Reshuffle All Tests')
    )
  );
}

// ── Test Screen ───────────────────────────────────────────────────────────────
function TestScreen({ testId, session, starred, onAnswer, onStar, onBack, onFinish }) {
  const [qIdx, setQIdx] = useState(0);
  const [showJump, setShowJump] = useState(false);
  if (!session) return null;
  const color = TEST_COLORS[testId]||'#6366f1';
  const light = TEST_LIGHT[testId]||'#f5f3ff';
  const qs = session.questions;
  const ans = session.answers;
  const q = qs[qIdx];
  const isAnswered = ans[qIdx] !== null;
  const selected = ans[qIdx];
  const allDone = ans.every(a => a !== null);
  const doneCount = ans.filter(a => a !== null).length;
  const progress = ((qIdx+1)/qs.length)*100;

  return React.createElement('div', { style:{ minHeight:'100vh',background:'#f8fafc',display:'flex',flexDirection:'column' }},
    // Header
    React.createElement('div', { style:{ background:'#fff',borderBottom:'2px solid '+color+'22',padding:'52px 14px 10px',display:'flex',alignItems:'center',gap:10 }},
      React.createElement('button', { onClick: onBack, style:{ background:'none',border:'none',fontSize:22,color:'#64748b',lineHeight:1 }}, '‹'),
      React.createElement('div', { style:{ flex:1 }},
        React.createElement('div', { style:{ fontSize:10,fontWeight:700,color:color,letterSpacing:1.5 }}, 'TEST '+testId),
        React.createElement('div', { style:{ fontSize:12,fontWeight:600,color:'#475569' }}, qs[0]&&qs[0].testName)
      ),
      React.createElement('button', { onClick:()=>setShowJump(s=>!s), style:{ background:showJump?color:'#f8fafc',border:'1.5px solid '+color,borderRadius:9,padding:'5px 12px',fontSize:12,fontWeight:700,color:showJump?'#fff':color }},
        showJump ? '✕' : '⊞ '+doneCount+'/'+qs.length
      )
    ),
    // Jump panel
    showJump && React.createElement('div', { style:{ background:light,padding:'12px 16px 10px',borderBottom:'1px solid '+color+'20' }},
      React.createElement('div', { style:{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:8 }},
        ...qs.map((qq,i) => {
          const done=ans[i]!==null, correct=done&&ans[i]===qq.a, isCurr=i===qIdx;
          return React.createElement('button', { key:qq.id, onClick:()=>{ setQIdx(i); setShowJump(false); }, style:{ width:34,height:30,borderRadius:7,border:'2px solid '+(isCurr?color:starred.includes(qq.id)?'#f59e0b':correct?'#22c55e':done?'#f43f5e':'#e2e8f0'),background:isCurr?color:correct?'#dcfce7':done?'#fff1f2':'#fff',color:isCurr?'#fff':correct?'#166534':done?'#9f1239':'#64748b',fontSize:10,fontWeight:700,position:'relative' }},
            starred.includes(qq.id)&&!isCurr&&React.createElement('span',{style:{position:'absolute',top:-4,right:-3,fontSize:7,color:'#f59e0b'}},'★'),
            i+1
          );
        })
      ),
      React.createElement('div', { style:{ display:'flex',gap:10,flexWrap:'wrap' }},
        ...[ ['#dcfce7','#22c55e','Correct'],['#fff1f2','#f43f5e','Wrong'],['#fff','#e2e8f0','Not yet'],['#fff','#f59e0b','★'] ].map(([bg,br,lbl]) =>
          React.createElement('div', { key:lbl, style:{ display:'flex',alignItems:'center',gap:4 }},
            React.createElement('div', { style:{ width:9,height:9,borderRadius:2,background:bg,border:'1.5px solid '+br }}),
            React.createElement('span', { style:{ fontSize:9,color:'#64748b' }}, lbl)
          )
        )
      )
    ),
    // Progress bar
    React.createElement('div', { style:{ height:3,background:'#f1f5f9' }},
      React.createElement('div', { style:{ height:'100%',background:color,width:progress+'%',transition:'width 0.4s',borderRadius:'0 2px 2px 0' }})
    ),
    // Question card
    React.createElement('div', { style:{ margin:'16px 18px 0',background:'#fff',borderRadius:14,padding:'16px',boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }},
      React.createElement('div', { style:{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }},
        React.createElement('span', { style:{ fontSize:10,fontWeight:700,color:color,letterSpacing:1.5 }}, 'Q'+(qIdx+1)+' OF '+qs.length),
        React.createElement('button', { onClick:()=>onStar(q.id), style:{ background:'none',border:'none',fontSize:18,color:starred.includes(q.id)?'#f59e0b':'#cbd5e1' }}, starred.includes(q.id)?'★':'☆')
      ),
      React.createElement('p', { style:{ fontSize:15,fontWeight:600,color:'#0f172a',lineHeight:1.55 }}, q.q)
    ),
    // Options
    React.createElement('div', { style:{ padding:'12px 18px 0',display:'flex',flexDirection:'column',gap:8 }},
      ...q.o.map((opt,i) => {
        let bg='#fff',border='#e2e8f0',col='#1e293b',lbg='#f1f5f9',lc='#64748b';
        if (isAnswered) {
          if(i===q.a){bg='#f0fdf4';border='#22c55e';col='#166534';lbg='#22c55e';lc='#fff';}
          else if(i===selected&&i!==q.a){bg='#fff1f2';border='#f43f5e';col='#9f1239';lbg='#f43f5e';lc='#fff';}
          else{bg='#fafafa';border='#f1f5f9';col='#b0bec5';lbg='#f1f5f9';lc='#b0bec5';}
        }
        return React.createElement('button', { key:i, onClick:()=>onAnswer(testId,qIdx,i), style:{ display:'flex',alignItems:'center',gap:10,border:'1.5px solid '+border,borderRadius:11,padding:'11px 12px',textAlign:'left',width:'100%',background:bg,color:col }},
          React.createElement('span', { style:{ minWidth:24,height:24,borderRadius:6,background:lbg,color:lc,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0 }}, LABELS[i]),
          React.createElement('span', { style:{ fontSize:13.5,lineHeight:1.4,flex:1 }}, opt),
          isAnswered&&i===q.a&&React.createElement('span',{style:{fontSize:14,marginLeft:'auto'}},'✓'),
          isAnswered&&i===selected&&i!==q.a&&React.createElement('span',{style:{fontSize:14,marginLeft:'auto'}},'✗')
        );
      })
    ),
    // Explanation
    isAnswered && React.createElement('div', { style:{ margin:'12px 18px 0',background:'#fff',borderRadius:12,padding:'13px',border:'1px solid #e2e8f0' }},
      React.createElement('div', { style:{ display:'flex',justifyContent:'space-between',marginBottom:5 }},
        React.createElement('span', { style:{ fontSize:12,fontWeight:700,color:selected===q.a?'#16a34a':'#dc2626' }}, selected===q.a?'Correct ✓':'Incorrect ✗'),
        React.createElement('span', { style:{ fontSize:11,color:'#94a3b8' }}, 'Answer: '+LABELS[q.a])
      ),
      React.createElement('p', { style:{ fontSize:12.5,color:'#475569',lineHeight:1.6 }}, q.w)
    ),
    // Nav
    React.createElement('div', { style:{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px 44px',marginTop:'auto' }},
      React.createElement('button', { onClick:()=>qIdx>0&&setQIdx(q=>q-1), disabled:qIdx===0, style:{ background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'9px 16px',fontSize:13,fontWeight:600,color:'#64748b',opacity:qIdx===0?0.35:1 }}, '‹ Prev'),
      allDone
        ? React.createElement('button', { onClick: onFinish, style:{ background:color,color:'#fff',border:'none',borderRadius:11,padding:'10px 22px',fontSize:14,fontWeight:700,boxShadow:'0 4px 14px '+color+'40' }}, 'Finish →')
        : isAnswered&&qIdx<qs.length-1
          ? React.createElement('button', { onClick:()=>setQIdx(q=>q+1), style:{ background:color,color:'#fff',border:'none',borderRadius:11,padding:'10px 22px',fontSize:14,fontWeight:700 }}, 'Next →')
          : React.createElement('div')
    )
  );
}

// ── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({ testId, session, onBack, onRetry, onReshuffle, onHome }) {
  if (!session) return null;
  const color = TEST_COLORS[testId]||'#6366f1';
  const light = TEST_LIGHT[testId]||'#f5f3ff';
  const qs = session.questions;
  const ans = session.answers;
  const score = qs.filter((q,i) => ans[i]===q.a).length;
  const pct = Math.round(score/qs.length*100);
  const grade = pct>=80?{label:'Excellent 🎯',color:'#059669',bg:'#f0fdf4'}:pct>=60?{label:'Good 👍',color:'#d97706',bg:'#fffbeb'}:{label:'Keep Going 📚',color:'#dc2626',bg:'#fff1f2'};

  // Chapter breakdown
  const breakdown = {};
  qs.forEach((q,i) => {
    const ch = q.chapter||'General';
    if(!breakdown[ch]) breakdown[ch]={correct:0,total:0};
    breakdown[ch].total++;
    if(ans[i]===q.a) breakdown[ch].correct++;
  });
  const chapters = Object.entries(breakdown).map(([ch,v])=>({ch,pct:Math.round(v.correct/v.total*100),correct:v.correct,total:v.total})).sort((a,b)=>a.pct-b.pct);

  const handleExport = () => {
    const lines = [
      'RCDD QUIZ — Test '+testId+' ('+qs[0].testName+')',
      'Date: '+new Date().toLocaleDateString()+'  Score: '+score+'/'+qs.length+' ('+pct+'%)  '+grade.label.replace(/[^\w\s]/g,''),
      '',
      '── CHAPTER BREAKDOWN ──',
      ...chapters.map(c => c.ch.padEnd(20)+c.correct+'/'+c.total+'  ('+c.pct+'%)'),
      '',
      '── QUESTIONS ──',
      ...qs.map((q,i) => [
        'Q'+(i+1)+' ['+q.chapter+']: '+q.q,
        'Your: '+(ans[i]!==null?LABELS[ans[i]]+'. '+q.o[ans[i]]:'—')+'  '+(ans[i]===q.a?'CORRECT':'WRONG'),
        ans[i]!==q.a?'Correct: '+LABELS[q.a]+'. '+q.o[q.a]:'',
        'Why: '+q.w,''
      ].filter(Boolean).join('\n')),
      '── STUDY PRIORITIES ──',
      ...chapters.filter(c=>c.pct<80).map(c=>'• '+c.ch+': '+(c.pct<60?'HIGH':'Review')+' priority — '+c.pct+'%'),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines],{type:'text/plain'}));
    a.download = 'RCDD_Test'+testId+'_'+new Date().toISOString().slice(0,10)+'.txt';
    a.click();
  };

  return React.createElement('div', { style:{ minHeight:'100vh',background:'#f8fafc',overflowY:'auto',paddingBottom:48 }},
    // Hero
    React.createElement('div', { style:{ background:grade.bg,padding:'52px 20px 22px',display:'flex',flexDirection:'column',alignItems:'center',borderRadius:'0 0 22px 22px',position:'relative' }},
      React.createElement('button', { onClick: onBack, style:{ position:'absolute',top:52,left:16,background:'none',border:'none',fontSize:22,color:'#64748b' }}, '‹'),
      React.createElement('div', { style:{ width:44,height:44,borderRadius:12,background:light,color:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,marginBottom:8 }}, testId),
      React.createElement('div', { style:{ fontSize:54,fontWeight:800,color:'#0f172a',lineHeight:1,fontVariantNumeric:'tabular-nums' }}, pct, React.createElement('span',{style:{fontSize:20}},'%')),
      React.createElement('div', { style:{ fontSize:14,fontWeight:700,color:grade.color,marginTop:3 }}, grade.label),
      React.createElement('div', { style:{ fontSize:12,color:'#64748b',marginTop:4 }}, score+' of '+qs.length+' correct')
    ),
    // Chapter breakdown
    React.createElement('div', { style:{ margin:'14px 18px 0',background:'#fff',borderRadius:14,padding:'16px',boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }},
      React.createElement('div', { style:{ fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:2,marginBottom:12 }}, 'TOPIC BREAKDOWN'),
      ...chapters.map(c =>
        React.createElement('div', { key:c.ch, style:{ marginBottom:10 }},
          React.createElement('div', { style:{ display:'flex',justifyContent:'space-between',marginBottom:4 }},
            React.createElement('span', { style:{ fontSize:12,fontWeight:600,color:'#334155' }}, c.ch),
            React.createElement('span', { style:{ fontSize:12,fontWeight:700,color:c.pct>=80?'#059669':c.pct>=60?'#d97706':'#dc2626' }}, c.pct+'%')
          ),
          React.createElement('div', { style:{ height:5,background:'#f1f5f9',borderRadius:2,overflow:'hidden' }},
            React.createElement('div', { style:{ height:'100%',background:c.pct>=80?'#22c55e':c.pct>=60?'#f59e0b':'#f43f5e',borderRadius:2,width:c.pct+'%',transition:'width 0.5s' }})
          )
        )
      )
    ),
    // Q review
    React.createElement('div', { style:{ margin:'12px 18px 0',background:'#fff',borderRadius:14,padding:'16px',boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }},
      React.createElement('div', { style:{ fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:2,marginBottom:10 }}, 'QUESTION REVIEW'),
      ...qs.map((q,i) => {
        const correct = ans[i]===q.a;
        return React.createElement('div', { key:q.id, style:{ border:'1.5px solid '+(correct?'#dcfce7':'#fff1f2'),borderRadius:10,padding:'10px',marginBottom:8,background:correct?'#f8fffe':'#fffafa' }},
          React.createElement('div', { style:{ display:'flex',gap:8,alignItems:'flex-start' }},
            React.createElement('span', { style:{ minWidth:20,height:20,borderRadius:5,background:correct?'#22c55e':'#f43f5e',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0 }}, correct?'✓':'✗'),
            React.createElement('div', null,
              React.createElement('p', { style:{ fontSize:12,fontWeight:600,color:'#0f172a',lineHeight:1.4,marginBottom:3 }}, q.q),
              !correct&&React.createElement('p',{style:{fontSize:11,color:'#dc2626',marginBottom:2}},'Your: '+(ans[i]!==null?LABELS[ans[i]]+'. '+q.o[ans[i]]:'—')),
              React.createElement('p',{style:{fontSize:11,color:'#059669'}},'✓ '+LABELS[q.a]+'. '+q.o[q.a])
            )
          )
        );
      })
    ),
    // Actions
    React.createElement('div', { style:{ padding:'12px 18px',display:'flex',flexDirection:'column',gap:9 }},
      React.createElement('button', { style:{ width:'100%',background:color,color:'#fff',border:'none',borderRadius:13,padding:'14px',fontSize:14,fontWeight:700 }, onClick: onReshuffle }, '↺ Reshuffle & Retry'),
      React.createElement('button', { style:{ width:'100%',background:'#fff',color:color,border:'1.5px solid '+color,borderRadius:13,padding:'13px',fontSize:14,fontWeight:700 }, onClick: onRetry }, 'Retry Same Questions'),
      React.createElement('button', { style:{ width:'100%',background:'#f8fafc',color:'#475569',border:'1.5px solid #e2e8f0',borderRadius:13,padding:'13px',fontSize:13,fontWeight:600 }, onClick: handleExport }, 'Export Results ↓'),
      React.createElement('button', { style:{ width:'100%',background:'#f8fafc',color:'#475569',border:'1.5px solid #e2e8f0',borderRadius:13,padding:'13px',fontSize:13,fontWeight:600 }, onClick: onHome }, '← All Tests')
    )
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  shell: { maxWidth:430, minHeight:'100vh', margin:'0 auto', background:'#f8fafc', fontFamily:"-apple-system,'DM Sans',sans-serif", position:'relative', overflowX:'hidden' }
};

// ── Boot ──────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
