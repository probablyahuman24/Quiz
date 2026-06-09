// RCDD Quiz Bank — app.js
// Vanilla React (no JSX, no build step needed)

const { useState, useEffect, useCallback, useMemo } = React;

// ── Config ────────────────────────────────────────────────────────────────────
const LABELS = ['A','B','C','D'];
const STORAGE_KEY = 'rcdd_v2';
const QUESTIONS_URL = 'questions.json';

const COLORS = {
  1:'#7c3aed', 2:'#0284c7', 3:'#059669', 4:'#d97706',
  5:'#dc2626', 6:'#0891b2', 7:'#65a30d', 8:'#9333ea',
  9:'#0f766e', 10:'#be185d'
};
const LIGHTS = {
  1:'#f5f3ff', 2:'#f0f9ff', 3:'#ecfdf5', 4:'#fffbeb',
  5:'#fef2f2', 6:'#ecfeff', 7:'#f7fee7', 8:'#faf5ff',
  9:'#f0fdfa', 10:'#fdf2f8'
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}
function load() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function el(type, props, ...children) {
  return React.createElement(type, props, ...children);
}

// ── Root App ──────────────────────────────────────────────────────────────────
function App() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [screen, setScreen] = useState('home');
  const [activeTest, setActiveTest] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [appData, setAppData] = useState(() => {
    const saved = load();
    return saved || { sessions: {}, history: [], starred: [] };
  });

  // Persist on every change
  useEffect(() => { save(appData); }, [appData]);

  // Fetch questions
  useEffect(() => {
    fetch(QUESTIONS_URL + '?v=' + Date.now())
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        setQuestions(data);
        document.getElementById('loading').style.display = 'none';
        setLoading(false);
      })
      .catch(err => {
        setFetchError(err.message);
        document.getElementById('loading').style.display = 'none';
        setLoading(false);
      });
  }, []);

  // Group questions by test
  const tests = useMemo(() => {
    const map = {};
    questions.forEach(q => {
      if (!map[q.test]) map[q.test] = { id: q.test, name: q.testName, questions: [] };
      map[q.test].questions.push(q);
    });
    return Object.values(map).sort((a, b) => a.id - b.id);
  }, [questions]);

  // Session management
  const getOrCreateSession = useCallback((testId) => {
    if (appData.sessions[testId]) return appData.sessions[testId];
    const t = tests.find(x => x.id === testId);
    if (!t) return null;
    const qs = shuffle(t.questions);
    const sess = { questions: qs, answers: Array(qs.length).fill(null) };
    setAppData(prev => ({ ...prev, sessions: { ...prev.sessions, [testId]: sess } }));
    return sess;
  }, [appData.sessions, tests]);

  const answer = useCallback((testId, qIdx, optIdx) => {
    setAppData(prev => {
      const sess = prev.sessions[testId];
      if (!sess || sess.answers[qIdx] !== null) return prev;
      const answers = [...sess.answers];
      answers[qIdx] = optIdx;
      return { ...prev, sessions: { ...prev.sessions, [testId]: { ...sess, answers } } };
    });
  }, []);

  const finishTest = useCallback((testId) => {
    const sess = appData.sessions[testId];
    if (!sess) return;
    const correct = sess.questions.filter((q, i) => sess.answers[i] === q.a).length;
    const pct = Math.round(correct / sess.questions.length * 100);
    const entry = { date: new Date().toISOString(), testId, correct, total: sess.questions.length, pct };
    setAppData(prev => ({ ...prev, history: [entry, ...prev.history] }));
    setScreen('result');
  }, [appData.sessions]);

  const reshuffleTest = useCallback((testId) => {
    const t = tests.find(x => x.id === testId);
    if (!t) return;
    const qs = shuffle(t.questions);
    setAppData(prev => ({ ...prev, sessions: { ...prev.sessions, [testId]: { questions: qs, answers: Array(qs.length).fill(null) } } }));
    setScreen('test');
  }, [tests]);

  const retryTest = useCallback((testId) => {
    setAppData(prev => {
      const sess = prev.sessions[testId];
      if (!sess) return prev;
      return { ...prev, sessions: { ...prev.sessions, [testId]: { ...sess, answers: Array(sess.questions.length).fill(null) } } };
    });
    setScreen('test');
  }, []);

  const toggleStar = useCallback((qId) => {
    setAppData(prev => ({
      ...prev,
      starred: prev.starred.includes(qId) ? prev.starred.filter(s => s !== qId) : [...prev.starred, qId]
    }));
  }, []);

  const reshuffleAll = useCallback(() => {
    const sessions = {};
    tests.forEach(t => {
      const qs = shuffle(t.questions);
      sessions[t.id] = { questions: qs, answers: Array(qs.length).fill(null) };
    });
    setAppData(prev => ({ ...prev, sessions }));
  }, [tests]);

  // Computed stats
  const testStats = useMemo(() => tests.map(t => {
    const sess = appData.sessions[t.id];
    if (!sess) return { testId: t.id, name: t.name, done: 0, correct: 0, total: t.questions.length, pct: null };
    const done = sess.answers.filter(a => a !== null).length;
    const correct = sess.questions.filter((q, i) => sess.answers[i] === q.a && sess.answers[i] !== null).length;
    return { testId: t.id, name: t.name, done, correct, total: sess.questions.length, pct: done > 0 ? Math.round(correct / done * 100) : null };
  }), [tests, appData.sessions]);

  const totalAnswered = testStats.reduce((s, ts) => s + ts.done, 0);
  const totalQs = testStats.reduce((s, ts) => s + ts.total, 0);
  const totalCorrect = testStats.reduce((s, ts) => s + ts.correct, 0);
  const overallScore = totalAnswered > 0 ? Math.round(totalCorrect / totalAnswered * 100) : null;

  if (loading) return null;

  if (fetchError) {
    return el('div', { style: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, gap:12, background:'#f8fafc' } },
      el('div', { style: { fontSize:48 } }, '⚠️'),
      el('p', { style: { fontSize:15, fontWeight:700, color:'#dc2626', textAlign:'center' } }, 'Could not load questions'),
      el('p', { style: { fontSize:13, color:'#64748b', textAlign:'center' } }, 'Check your internet connection and refresh the page.'),
      el('button', { onClick: () => window.location.reload(), style: { marginTop:16, background:'#6366f1', color:'#fff', border:'none', borderRadius:12, padding:'12px 32px', fontSize:15, fontWeight:700 } }, 'Refresh')
    );
  }

  const session = activeTest ? (appData.sessions[activeTest] || getOrCreateSession(activeTest)) : null;

  return el('div', { style: { maxWidth:430, margin:'0 auto', minHeight:'100vh', background:'#f8fafc', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflowX:'hidden' } },
    el(SideMenu, { open: menuOpen, onClose: () => setMenuOpen(false), testStats, history: appData.history, totalAnswered, totalQs, totalCorrect, overallScore }),
    screen === 'home' && el(HomeScreen, { tests, testStats, overallScore, totalAnswered, totalQs, onSelect: id => { setActiveTest(id); getOrCreateSession(id); setScreen('test'); }, onMenu: () => setMenuOpen(true), onReshuffleAll: reshuffleAll }),
    screen === 'test' && session && el(TestScreen, { testId: activeTest, session, starred: appData.starred, onAnswer: answer, onStar: toggleStar, onBack: () => setScreen('home'), onFinish: () => finishTest(activeTest) }),
    screen === 'result' && session && el(ResultScreen, { testId: activeTest, session, onBack: () => setScreen('test'), onRetry: () => retryTest(activeTest), onReshuffle: () => reshuffleTest(activeTest), onHome: () => setScreen('home') })
  );
}

// ── Side Menu ─────────────────────────────────────────────────────────────────
function SideMenu({ open, onClose, testStats, history, totalAnswered, totalQs, totalCorrect, overallScore }) {
  const accuracy = totalAnswered > 0 ? Math.round(totalCorrect / totalAnswered * 100) : 0;
  const completion = totalQs > 0 ? Math.round(totalAnswered / totalQs * 100) : 0;
  const bestScore = history.length ? Math.max(...history.map(h => h.pct)) : null;
  const avgScore = history.length ? Math.round(history.reduce((s, h) => s + h.pct, 0) / history.length) : null;

  const stats = [
    { label:'Score', val: overallScore !== null ? overallScore + '%' : '—', color:'#7c3aed' },
    { label:'Accuracy', val: accuracy + '%', color:'#059669' },
    { label:'Progress', val: completion + '%', color:'#d97706' },
    { label:'Sessions', val: history.length, color:'#0891b2' },
    { label:'Best', val: bestScore !== null ? bestScore + '%' : '—', color:'#dc2626' },
    { label:'Average', val: avgScore !== null ? avgScore + '%' : '—', color:'#9333ea' },
  ];

  return el('div', null,
    open && el('div', { onClick: onClose, style: { position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', zIndex:40 } }),
    el('div', { style: { position:'fixed', top:0, left:0, height:'100vh', width:288, background:'#fff', zIndex:50, overflowY:'auto', transition:'transform 0.28s ease', transform: open ? 'translateX(0)' : 'translateX(-100%)', boxShadow:'6px 0 32px rgba(0,0,0,0.12)', paddingBottom:60 } },
      el('div', { style: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'56px 18px 14px', borderBottom:'1px solid #f1f5f9' } },
        el('span', { style: { fontSize:20, fontWeight:800, color:'#0f172a' } }, 'Analytics'),
        el('button', { onClick: onClose, style: { background:'#f1f5f9', border:'none', borderRadius:8, width:30, height:30, fontSize:14, color:'#64748b' } }, '✕')
      ),
      el('div', { style: { padding:'16px 18px 0' } },
        el('p', { style: { fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:2, marginBottom:10 } }, 'OVERALL'),
        el('div', { style: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 } },
          ...stats.map(s =>
            el('div', { key: s.label, style: { background:'#f8fafc', borderRadius:10, padding:'10px 12px', border:'1px solid #f1f5f9' } },
              el('div', { style: { fontSize:20, fontWeight:800, color:s.color, lineHeight:1 } }, s.val),
              el('div', { style: { fontSize:10, color:'#94a3b8', fontWeight:600, marginTop:3 } }, s.label)
            )
          )
        ),
        // Overall progress bar
        el('div', { style: { background:'#f8fafc', borderRadius:12, padding:'12px 14px', marginBottom:14 } },
          el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:6 } },
            el('span', { style: { fontSize:11, fontWeight:600, color:'#475569' } }, 'Completion'),
            el('span', { style: { fontSize:11, fontWeight:700, color:'#7c3aed' } }, totalAnswered + '/' + totalQs)
          ),
          el('div', { style: { height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden' } },
            el('div', { style: { height:'100%', background:'linear-gradient(90deg,#7c3aed,#a855f7)', borderRadius:3, width: completion + '%', transition:'width 0.5s' } })
          )
        ),
        // Per-test breakdown
        el('p', { style: { fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:2, marginBottom:10 } }, 'TEST BREAKDOWN'),
        ...testStats.map(ts =>
          el('div', { key: ts.testId, style: { marginBottom:10 } },
            el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:4 } },
              el('span', { style: { fontSize:11, fontWeight:600, color:'#334155' } }, ts.name),
              el('span', { style: { fontSize:11, fontWeight:700, color: ts.pct === null ? '#cbd5e1' : ts.pct >= 80 ? '#059669' : ts.pct >= 60 ? '#d97706' : '#dc2626' } }, ts.pct !== null ? ts.pct + '%' : '—')
            ),
            el('div', { style: { height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' } },
              el('div', { style: { height:'100%', background: COLORS[ts.testId] || '#6366f1', borderRadius:2, width: (ts.pct || 0) + '%', transition:'width 0.4s' } })
            )
          )
        ),
        // Session history
        history.length > 0 && el('div', null,
          el('p', { style: { fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:2, margin:'14px 0 10px' } }, 'RECENT SESSIONS'),
          ...history.slice(0, 10).map((h, i) =>
            el('div', { key: i, style: { display:'flex', alignItems:'center', gap:8, paddingBottom:9, borderBottom:'1px solid #f8fafc' } },
              el('div', { style: { width:8, height:8, borderRadius:'50%', background: COLORS[h.testId] || '#6366f1', flexShrink:0 } }),
              el('span', { style: { fontSize:11, color:'#475569', flex:1 } }, 'Test ' + h.testId),
              el('span', { style: { fontSize:11, fontWeight:700, color: h.pct >= 80 ? '#059669' : h.pct >= 60 ? '#d97706' : '#dc2626' } }, h.pct + '%'),
              el('span', { style: { fontSize:10, color:'#94a3b8' } }, new Date(h.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }))
            )
          )
        )
      )
    )
  );
}

// ── Home Screen ───────────────────────────────────────────────────────────────
function HomeScreen({ tests, testStats, overallScore, totalAnswered, totalQs, onSelect, onMenu, onReshuffleAll }) {
  const pct = totalQs > 0 ? Math.round(totalAnswered / totalQs * 100) : 0;
  return el('div', { style: { minHeight:'100vh', background:'#f8fafc', display:'flex', flexDirection:'column' } },
    // Header
    el('div', { style: { background:'#fff', borderBottom:'1px solid #f1f5f9', padding:'52px 20px 14px', display:'flex', alignItems:'center', gap:14 } },
      el('button', { onClick: onMenu, style: { background:'none', border:'none', padding:4, display:'flex', flexDirection:'column', gap:5 } },
        el('span', { style: { display:'block', width:20, height:2, background:'#1e293b', borderRadius:2 } }),
        el('span', { style: { display:'block', width:20, height:2, background:'#1e293b', borderRadius:2 } }),
        el('span', { style: { display:'block', width:20, height:2, background:'#1e293b', borderRadius:2 } })
      ),
      el('div', { style: { flex:1 } },
        el('div', { style: { fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:2 } }, 'BICSI · RCDD'),
        el('h1', { style: { fontSize:22, fontWeight:800, color:'#0f172a' } }, 'Quiz Bank')
      ),
      el('div', { style: { textAlign:'right' } },
        el('div', { style: { fontSize:24, fontWeight:800, color:'#7c3aed', lineHeight:1 } }, overallScore !== null ? overallScore + '%' : '—'),
        el('div', { style: { fontSize:10, color:'#94a3b8' } }, 'score')
      )
    ),
    // Progress
    el('div', { style: { padding:'12px 20px 8px', background:'#fff' } },
      el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:5 } },
        el('span', { style: { fontSize:11, color:'#64748b' } }, 'Overall Progress'),
        el('span', { style: { fontSize:11, fontWeight:700, color:'#7c3aed' } }, totalAnswered + ' / ' + totalQs)
      ),
      el('div', { style: { height:5, background:'#f1f5f9', borderRadius:3, overflow:'hidden' } },
        el('div', { style: { height:'100%', background:'linear-gradient(90deg,#7c3aed,#a855f7)', borderRadius:3, width: pct + '%' } })
      )
    ),
    // Test list
    el('div', { style: { flex:1, padding:'16px 20px', overflowY:'auto' } },
      el('div', { style: { fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:2, marginBottom:12 } }, 'SELECT A TEST'),
      ...tests.map(t => {
        const ts = testStats.find(x => x.testId === t.id) || { done:0, correct:0, total:t.questions.length, pct:null };
        const color = COLORS[t.id] || '#6366f1';
        const light = LIGHTS[t.id] || '#f5f3ff';
        const isComplete = ts.done === ts.total && ts.done > 0;
        const fillPct = ts.total > 0 ? (ts.done / ts.total * 100) : 0;
        return el('button', { key: t.id, onClick: () => onSelect(t.id), style: { width:'100%', background:'#fff', border:'1.5px solid ' + (isComplete ? color + '60' : '#e2e8f0'), borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, marginBottom:9, textAlign:'left' } },
          el('div', { style: { width:38, height:38, borderRadius:11, background:light, color:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, flexShrink:0 } }, t.id),
          el('div', { style: { flex:1, minWidth:0 } },
            el('div', { style: { display:'flex', alignItems:'center', gap:6, marginBottom:2 } },
              el('span', { style: { fontSize:13, fontWeight:700, color:'#0f172a' } }, t.name),
              isComplete && el('span', { style: { fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20, background:light, color:color } }, '✓ Done')
            ),
            el('div', { style: { fontSize:11, color:'#94a3b8', marginBottom:5 } }, t.questions.length + ' questions'),
            el('div', { style: { height:3, background:'#f1f5f9', borderRadius:2, overflow:'hidden' } },
              el('div', { style: { height:'100%', background:color, borderRadius:2, width: fillPct + '%' } })
            )
          ),
          el('div', { style: { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:1 } },
            ts.pct !== null
              ? el('span', { style: { fontSize:17, fontWeight:800, color:color } }, ts.pct + '%')
              : el('span', { style: { fontSize:13, color:'#e2e8f0' } }, '—')
          ),
          el('span', { style: { fontSize:20, color:'#cbd5e1' } }, '›')
        );
      }),
      el('button', { onClick: onReshuffleAll, style: { width:'100%', background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:12, padding:'12px', fontSize:13, fontWeight:600, color:'#64748b', marginTop:4 } }, '↺ Reshuffle All Tests')
    )
  );
}

// ── Test Screen ───────────────────────────────────────────────────────────────
function TestScreen({ testId, session, starred, onAnswer, onStar, onBack, onFinish }) {
  const [qIdx, setQIdx] = useState(0);
  const [showJump, setShowJump] = useState(false);

  const color = COLORS[testId] || '#6366f1';
  const light = LIGHTS[testId] || '#f5f3ff';
  const qs = session.questions;
  const ans = session.answers;
  const q = qs[qIdx];
  const isAnswered = ans[qIdx] !== null;
  const selected = ans[qIdx];
  const allDone = ans.every(a => a !== null);
  const doneCount = ans.filter(a => a !== null).length;
  const progress = ((qIdx + 1) / qs.length) * 100;

  return el('div', { style: { minHeight:'100vh', background:'#f8fafc', display:'flex', flexDirection:'column' } },
    // Header
    el('div', { style: { background:'#fff', borderBottom:'2px solid ' + color + '22', padding:'52px 14px 10px', display:'flex', alignItems:'center', gap:10 } },
      el('button', { onClick: onBack, style: { background:'none', border:'none', fontSize:24, color:'#64748b', lineHeight:1, padding:'0 4px' } }, '‹'),
      el('div', { style: { flex:1 } },
        el('div', { style: { fontSize:10, fontWeight:700, color:color, letterSpacing:1.5 } }, 'TEST ' + testId),
        el('div', { style: { fontSize:12, fontWeight:600, color:'#475569' } }, q.testName)
      ),
      el('button', { onClick: () => setShowJump(s => !s), style: { background: showJump ? color : '#f8fafc', border:'1.5px solid ' + color, borderRadius:9, padding:'5px 12px', fontSize:12, fontWeight:700, color: showJump ? '#fff' : color } },
        showJump ? '✕' : '⊞ ' + doneCount + '/' + qs.length
      )
    ),
    // Jump grid
    showJump && el('div', { style: { background:light, padding:'12px 16px 10px', borderBottom:'1px solid ' + color + '20' } },
      el('div', { style: { display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 } },
        ...qs.map((qq, i) => {
          const done = ans[i] !== null, correct = done && ans[i] === qq.a, isCurr = i === qIdx;
          return el('button', { key: qq.id, onClick: () => { setQIdx(i); setShowJump(false); }, style: { width:34, height:30, borderRadius:7, border:'2px solid ' + (isCurr ? color : starred.includes(qq.id) ? '#f59e0b' : correct ? '#22c55e' : done ? '#f43f5e' : '#e2e8f0'), background: isCurr ? color : correct ? '#dcfce7' : done ? '#fff1f2' : '#fff', color: isCurr ? '#fff' : correct ? '#166534' : done ? '#9f1239' : '#64748b', fontSize:10, fontWeight:700 } }, i + 1);
        })
      ),
      el('div', { style: { display:'flex', gap:12, flexWrap:'wrap' } },
        ...[ ['#dcfce7','#22c55e','Correct'], ['#fff1f2','#f43f5e','Wrong'], ['#fff','#e2e8f0','Not yet'] ].map(([bg,br,lbl]) =>
          el('div', { key:lbl, style:{ display:'flex', alignItems:'center', gap:4 } },
            el('div', { style:{ width:9, height:9, borderRadius:2, background:bg, border:'1.5px solid '+br } }),
            el('span', { style:{ fontSize:9, color:'#64748b' } }, lbl)
          )
        )
      )
    ),
    // Progress bar
    el('div', { style: { height:3, background:'#f1f5f9' } },
      el('div', { style: { height:'100%', background:color, width:progress+'%', transition:'width 0.4s', borderRadius:'0 2px 2px 0' } })
    ),
    // Question
    el('div', { style: { margin:'16px 18px 0', background:'#fff', borderRadius:14, padding:'16px', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' } },
      el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 } },
        el('span', { style: { fontSize:10, fontWeight:700, color:color, letterSpacing:1.5 } }, 'Q' + (qIdx+1) + ' OF ' + qs.length),
        el('button', { onClick: () => onStar(q.id), style: { background:'none', border:'none', fontSize:20, color: starred.includes(q.id) ? '#f59e0b' : '#cbd5e1', padding:0 } }, starred.includes(q.id) ? '★' : '☆')
      ),
      el('p', { style: { fontSize:15, fontWeight:600, color:'#0f172a', lineHeight:1.55 } }, q.q)
    ),
    // Options
    el('div', { style: { padding:'12px 18px 0', display:'flex', flexDirection:'column', gap:8 } },
      ...q.o.map((opt, i) => {
        let bg='#fff', border='#e2e8f0', col='#1e293b', lbg='#f1f5f9', lc='#64748b';
        if (isAnswered) {
          if (i === q.a) { bg='#f0fdf4'; border='#22c55e'; col='#166534'; lbg='#22c55e'; lc='#fff'; }
          else if (i === selected && i !== q.a) { bg='#fff1f2'; border='#f43f5e'; col='#9f1239'; lbg='#f43f5e'; lc='#fff'; }
          else { bg='#fafafa'; border='#f1f5f9'; col='#b0bec5'; lbg='#f1f5f9'; lc='#b0bec5'; }
        }
        return el('button', { key:i, onClick: () => onAnswer(testId, qIdx, i), style: { display:'flex', alignItems:'center', gap:10, border:'1.5px solid '+border, borderRadius:11, padding:'12px', textAlign:'left', width:'100%', background:bg, color:col } },
          el('span', { style: { minWidth:24, height:24, borderRadius:6, background:lbg, color:lc, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 } }, LABELS[i]),
          el('span', { style: { fontSize:13.5, lineHeight:1.4, flex:1 } }, opt),
          isAnswered && i === q.a && el('span', { style: { marginLeft:'auto', fontSize:14 } }, '✓'),
          isAnswered && i === selected && i !== q.a && el('span', { style: { marginLeft:'auto', fontSize:14 } }, '✗')
        );
      })
    ),
    // Explanation
    isAnswered && el('div', { style: { margin:'12px 18px 0', background:'#fff', borderRadius:12, padding:'13px', border:'1px solid #e2e8f0' } },
      el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:5 } },
        el('span', { style: { fontSize:12, fontWeight:700, color: selected === q.a ? '#16a34a' : '#dc2626' } }, selected === q.a ? 'Correct ✓' : 'Incorrect ✗'),
        el('span', { style: { fontSize:11, color:'#94a3b8' } }, 'Answer: ' + LABELS[q.a])
      ),
      el('p', { style: { fontSize:12.5, color:'#475569', lineHeight:1.6 } }, q.w)
    ),
    // Navigation
    el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px 44px', marginTop:'auto' } },
      el('button', { onClick: () => qIdx > 0 && setQIdx(q => q-1), disabled: qIdx === 0, style: { background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:10, padding:'9px 16px', fontSize:13, fontWeight:600, color:'#64748b', opacity: qIdx === 0 ? 0.35 : 1 } }, '‹ Prev'),
      allDone
        ? el('button', { onClick: onFinish, style: { background:color, color:'#fff', border:'none', borderRadius:11, padding:'10px 22px', fontSize:14, fontWeight:700, boxShadow:'0 4px 14px '+color+'40' } }, 'Finish →')
        : isAnswered && qIdx < qs.length - 1
          ? el('button', { onClick: () => setQIdx(q => q+1), style: { background:color, color:'#fff', border:'none', borderRadius:11, padding:'10px 22px', fontSize:14, fontWeight:700 } }, 'Next →')
          : el('div')
    )
  );
}

// ── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({ testId, session, onBack, onRetry, onReshuffle, onHome }) {
  const color = COLORS[testId] || '#6366f1';
  const light = LIGHTS[testId] || '#f5f3ff';
  const qs = session.questions;
  const ans = session.answers;
  const score = qs.filter((q, i) => ans[i] === q.a).length;
  const pct = Math.round(score / qs.length * 100);
  const grade = pct >= 80 ? { label:'Excellent 🎯', color:'#059669', bg:'#f0fdf4' }
    : pct >= 60 ? { label:'Good 👍', color:'#d97706', bg:'#fffbeb' }
    : { label:'Keep Going 📚', color:'#dc2626', bg:'#fff1f2' };

  // Chapter breakdown
  const chapMap = {};
  qs.forEach((q, i) => {
    const ch = q.chapter || 'General';
    if (!chapMap[ch]) chapMap[ch] = { correct:0, total:0 };
    chapMap[ch].total++;
    if (ans[i] === q.a) chapMap[ch].correct++;
  });
  const chapters = Object.entries(chapMap)
    .map(([ch, v]) => ({ ch, pct: Math.round(v.correct/v.total*100), correct:v.correct, total:v.total }))
    .sort((a, b) => a.pct - b.pct);

  const exportResults = () => {
    const lines = [
      'RCDD QUIZ — Test ' + testId + ' (' + qs[0].testName + ')',
      'Date: ' + new Date().toLocaleDateString() + '   Score: ' + score + '/' + qs.length + ' (' + pct + '%)',
      '',
      '── BREAKDOWN ──',
      ...chapters.map(c => c.ch + ': ' + c.correct + '/' + c.total + ' (' + c.pct + '%)'),
      '',
      '── QUESTIONS ──',
      ...qs.map((q, i) => [
        'Q' + (i+1) + ': ' + q.q,
        'Your answer: ' + (ans[i] !== null ? LABELS[ans[i]] + '. ' + q.o[ans[i]] : '—') + ' ' + (ans[i] === q.a ? '✓' : '✗'),
        ans[i] !== q.a ? 'Correct: ' + LABELS[q.a] + '. ' + q.o[q.a] : '',
        'Why: ' + q.w, ''
      ].filter(Boolean).join('\n'))
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines], { type:'text/plain' }));
    a.download = 'RCDD_Test' + testId + '_' + new Date().toISOString().slice(0,10) + '.txt';
    a.click();
  };

  return el('div', { style: { minHeight:'100vh', background:'#f8fafc', overflowY:'auto', paddingBottom:48 } },
    // Hero
    el('div', { style: { background:grade.bg, padding:'52px 20px 22px', display:'flex', flexDirection:'column', alignItems:'center', borderRadius:'0 0 22px 22px', position:'relative' } },
      el('button', { onClick: onBack, style: { position:'absolute', top:52, left:16, background:'none', border:'none', fontSize:24, color:'#64748b' } }, '‹'),
      el('div', { style: { width:44, height:44, borderRadius:12, background:light, color:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, marginBottom:8 } }, testId),
      el('div', { style: { fontSize:54, fontWeight:800, color:'#0f172a', lineHeight:1 } }, pct, el('span', { style: { fontSize:20 } }, '%')),
      el('div', { style: { fontSize:14, fontWeight:700, color:grade.color, marginTop:3 } }, grade.label),
      el('div', { style: { fontSize:12, color:'#64748b', marginTop:4 } }, score + ' of ' + qs.length + ' correct')
    ),
    // Chapter breakdown
    el('div', { style: { margin:'14px 18px 0', background:'#fff', borderRadius:14, padding:'16px', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' } },
      el('div', { style: { fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:2, marginBottom:12 } }, 'TOPIC BREAKDOWN'),
      ...chapters.map(c =>
        el('div', { key:c.ch, style: { marginBottom:10 } },
          el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:4 } },
            el('span', { style: { fontSize:12, fontWeight:600, color:'#334155' } }, c.ch),
            el('span', { style: { fontSize:12, fontWeight:700, color: c.pct>=80?'#059669':c.pct>=60?'#d97706':'#dc2626' } }, c.pct + '%')
          ),
          el('div', { style: { height:5, background:'#f1f5f9', borderRadius:2, overflow:'hidden' } },
            el('div', { style: { height:'100%', background: c.pct>=80?'#22c55e':c.pct>=60?'#f59e0b':'#f43f5e', borderRadius:2, width:c.pct+'%', transition:'width 0.5s' } })
          )
        )
      )
    ),
    // Question review
    el('div', { style: { margin:'12px 18px 0', background:'#fff', borderRadius:14, padding:'16px', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' } },
      el('div', { style: { fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:2, marginBottom:10 } }, 'QUESTION REVIEW'),
      ...qs.map((q, i) => {
        const correct = ans[i] === q.a;
        return el('div', { key:q.id, style: { border:'1.5px solid '+(correct?'#dcfce7':'#fff1f2'), borderRadius:10, padding:'10px', marginBottom:8, background:correct?'#f8fffe':'#fffafa' } },
          el('div', { style: { display:'flex', gap:8 } },
            el('span', { style: { minWidth:20, height:20, borderRadius:5, background:correct?'#22c55e':'#f43f5e', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0, marginTop:1 } }, correct?'✓':'✗'),
            el('div', null,
              el('p', { style: { fontSize:12, fontWeight:600, color:'#0f172a', lineHeight:1.4, marginBottom:3 } }, q.q),
              !correct && el('p', { style: { fontSize:11, color:'#dc2626', marginBottom:2 } }, 'Your: ' + (ans[i]!==null ? LABELS[ans[i]]+'. '+q.o[ans[i]] : '—')),
              el('p', { style: { fontSize:11, color:'#059669' } }, '✓ ' + LABELS[q.a] + '. ' + q.o[q.a])
            )
          )
        );
      })
    ),
    // Action buttons
    el('div', { style: { padding:'12px 18px', display:'flex', flexDirection:'column', gap:9 } },
      el('button', { onClick: onReshuffle, style: { width:'100%', background:color, color:'#fff', border:'none', borderRadius:13, padding:'14px', fontSize:14, fontWeight:700 } }, '↺ Reshuffle & Retry'),
      el('button', { onClick: onRetry, style: { width:'100%', background:'#fff', color:color, border:'1.5px solid '+color, borderRadius:13, padding:'13px', fontSize:14, fontWeight:700 } }, 'Retry Same Questions'),
      el('button', { onClick: exportResults, style: { width:'100%', background:'#f8fafc', color:'#475569', border:'1.5px solid #e2e8f0', borderRadius:13, padding:'13px', fontSize:13, fontWeight:600 } }, 'Export Results ↓'),
      el('button', { onClick: onHome, style: { width:'100%', background:'#f8fafc', color:'#475569', border:'1.5px solid #e2e8f0', borderRadius:13, padding:'13px', fontSize:13, fontWeight:600 } }, '← All Tests')
    )
  );
}

// ── Boot ──────────────────────────────────────────────────────────────────────
try {
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
} catch(e) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'flex';
  document.getElementById('error-msg').textContent = 'Boot error: ' + e.message;
}
