// RCDD Quiz Bank — app.js
// Vanilla React (no JSX, no build step needed)

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ── Config ────────────────────────────────────────────────────────────────────
const LABELS = ['A','B','C','D'];
const STORAGE_KEY = 'rcdd_v3';
const CHAPTER_FILES = [
  'data/chapter01 principles of transmission.json',
  'data/chapter02 electromagnetic compatibility.json',
  'data/chapter03 network design.json',
  'data/chapter04 telecommunications spaces.json',
  'data/chapter05 backbone distribution systems.json',
  'data/chapter06 horizontal distribution systems.json',
  'data/chapter07 ict cables and connecting hardware.json',
  'data/chapter08 fire protection and firestopping.json',
  'data/chapter09 telecommunications grounding and bonding.json',
  'data/chapter10 power distribution.json',
  'data/chapter11 telecommunications administration.json',
  'data/chapter12 field testing structured cabling.json',
  'data/chapter13 outside plant osp.json',
  'data/chapter14 audiovisual systems.json',
  'data/chapter15 intelligent building systems.json',
  'data/chapter16 wireless networks.json',
  'data/chapter17 electronic access control.json',
  'data/chapter18 data centers.json',
  'data/chapter19 health care.json',
  'data/chapter20 residential cabling systems.json',
  'data/chapter21 project administration.json',
  'data/chapter22 special design considerations.json',
];

const COLORS = {
  1:'#7c3aed', 2:'#0284c7', 3:'#059669', 4:'#d97706',
  5:'#dc2626', 6:'#0891b2', 7:'#65a30d', 8:'#9333ea',
  9:'#0f766e', 10:'#be185d', 11:'#b45309', 12:'#1d4ed8',
  13:'#0f766e', 14:'#7c3aed', 15:'#c2410c', 16:'#0369a1',
  17:'#4f46e5', 18:'#b91c1c', 19:'#047857', 20:'#9333ea',
  21:'#0284c7', 22:'#d97706',
  focus:'#6366f1', review:'#e11d48', custom:'#0891b2'
};
const LIGHTS = {
  1:'#f5f3ff', 2:'#f0f9ff', 3:'#ecfdf5', 4:'#fffbeb',
  5:'#fef2f2', 6:'#ecfeff', 7:'#f7fee7', 8:'#faf5ff',
  9:'#f0fdfa', 10:'#fdf2f8', 11:'#fef3c7', 12:'#eff6ff',
  13:'#f0fdfa', 14:'#f5f3ff', 15:'#fff7ed', 16:'#f0f9ff',
  17:'#eef2ff', 18:'#fef2f2', 19:'#ecfdf5', 20:'#faf5ff',
  21:'#f0f9ff', 22:'#fffbeb',
  focus:'#eef2ff', review:'#fff1f2', custom:'#ecfeff'
};

// ── Theme tokens ──────────────────────────────────────────────────────────────
function T(dark) {
  return {
    bg:          dark ? '#0f172a' : '#f8fafc',
    card:        dark ? '#1e293b' : '#ffffff',
    cardAlt:     dark ? '#0f172a' : '#f8fafc',
    border:      dark ? '#334155' : '#e2e8f0',
    borderLight: dark ? '#1e293b' : '#f1f5f9',
    text:        dark ? '#f1f5f9' : '#0f172a',
    textSub:     dark ? '#94a3b8' : '#475569',
    textMuted:   dark ? '#64748b' : '#94a3b8',
    pill:        dark ? '#1e293b' : '#f1f5f9',
    pillBorder:  dark ? '#334155' : '#e2e8f0',
    input:       dark ? '#0f172a' : '#f8fafc',
    inputBorder: dark ? '#334155' : '#e2e8f0',
  };
}

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
function saveUser(username, data) {
  try { localStorage.setItem(STORAGE_KEY + '_' + username, JSON.stringify(data)); } catch(e) {}
}
function loadUser(username) {
  try { const r = localStorage.getItem(STORAGE_KEY + '_' + username); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function el(type, props, ...children) {
  return React.createElement(type, props, ...children);
}

// ── Firebase ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAfamSetZvn7D1eylX07uZo8tOpB8pB4M4",
  authDomain: "rcdd-quiz.firebaseapp.com",
  projectId: "rcdd-quiz",
  storageBucket: "rcdd-quiz.firebasestorage.app",
  messagingSenderId: "310905770336",
  appId: "1:310905770336:web:3b8eec2bc9475a86874e05"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

async function hashPin(pin) {
  const data = new TextEncoder().encode('rcdd:' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function compactAppData(appData) {
  const sessions = {};
  Object.entries(appData.sessions).forEach(([testId, sess]) => {
    if (!sess || testId === 'focus' || testId === 'review' || testId === 'custom') return;
    sessions[testId] = {
      qOrder: sess.questions.map(q => q.id),
      answers: sess.answers,
      confidences: sess.confidences || Array(sess.questions.length).fill(null),
      mode: sess.mode || 'normal'
    };
  });
  return { sessions, history: appData.history, starred: appData.starred, wrongCounts: appData.wrongCounts, confidenceLog: appData.confidenceLog };
}

function expandSessions(compactSessions, questionsById) {
  const sessions = {};
  Object.entries(compactSessions).forEach(([testId, cs]) => {
    if (!cs || !cs.qOrder) return;
    const questions = cs.qOrder.map(id => questionsById[id]).filter(Boolean);
    if (!questions.length) return;
    sessions[testId] = {
      questions,
      answers: cs.answers,
      confidences: cs.confidences || Array(questions.length).fill(null),
      mode: cs.mode || 'normal'
    };
  });
  return sessions;
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onSignIn, onSignUp, loading, error, dark }) {
  const t = T(dark);
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');

  const canSubmit = username.trim().length >= 2 && pin.length >= 4 && !loading;
  const handleSubmit = () => {
    if (!canSubmit) return;
    if (mode === 'signin') onSignIn(username.trim(), pin);
    else onSignUp(username.trim(), pin);
  };

  return el('div', { style: { minHeight:'100vh', background:t.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 } },
    el('div', { style: { width:'100%', maxWidth:360 } },
      el('div', { style: { textAlign:'center', marginBottom:32 } },
        el('div', { style: { fontSize:52, marginBottom:10, lineHeight:1 } }, '💡'),
        el('h1', { style: { fontSize:26, fontWeight:800, color:t.text, margin:0 } }, 'RCDD Quiz Bank'),
        el('p', { style: { fontSize:13, color:t.textMuted, marginTop:6 } }, 'BICSI · RCDD Exam Prep')
      ),
      el('div', { style: { background:t.card, borderRadius:20, padding:24, boxShadow:'0 4px 24px rgba(0,0,0,0.12)' } },
        el('div', { style: { display:'flex', background:t.pill, borderRadius:12, padding:4, marginBottom:24 } },
          [['signin','Sign In'], ['signup','Create Account']].map(([m, label]) =>
            el('button', { key:m, onClick: () => { setMode(m); setPin(''); }, style: { flex:1, padding:'9px 6px', borderRadius:9, border:'none', fontSize:13, fontWeight:700, background: mode===m ? t.card : 'transparent', color: mode===m ? t.text : t.textMuted, boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,0.12)' : 'none', cursor:'pointer' } }, label)
          )
        ),
        el('div', { style: { marginBottom:14 } },
          el('label', { style: { fontSize:11, fontWeight:700, color:t.textSub, display:'block', marginBottom:6, letterSpacing:1 } }, 'USERNAME'),
          el('input', { type:'text', placeholder: mode==='signin' ? 'Your username' : 'Choose a username', value:username, onChange:e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'')), onKeyDown:e=>e.key==='Enter'&&handleSubmit(), autoCapitalize:'none', autoCorrect:'off', spellCheck:false, style: { width:'100%', padding:'12px 14px', borderRadius:11, border:'1.5px solid '+t.inputBorder, fontSize:15, fontFamily:'inherit', outline:'none', background:t.input, color:t.text, boxSizing:'border-box' } })
        ),
        el('div', { style: { marginBottom: error ? 14 : 20 } },
          el('label', { style: { fontSize:11, fontWeight:700, color:t.textSub, display:'block', marginBottom:6, letterSpacing:1 } }, 'PIN (4–6 digits)'),
          el('input', { type:'password', inputMode:'numeric', placeholder:'••••', maxLength:6, value:pin, onChange:e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6)), onKeyDown:e=>e.key==='Enter'&&handleSubmit(), style: { width:'100%', padding:'12px 14px', borderRadius:11, border:'1.5px solid '+t.inputBorder, fontSize:24, fontFamily:'monospace', outline:'none', background:t.input, color:t.text, letterSpacing:8, boxSizing:'border-box' } })
        ),
        error && el('div', { style: { background:'#fff1f2', border:'1px solid #fca5a5', borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#dc2626', fontWeight:600 } }, error),
        el('button', { onClick:handleSubmit, disabled:!canSubmit, style: { width:'100%', background: canSubmit ? '#7c3aed' : '#c4b5fd', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:700, cursor: canSubmit ? 'pointer' : 'default' } }, loading ? 'Please wait…' : mode==='signin' ? 'Sign In →' : 'Create Account →')
      ),
      el('p', { style: { textAlign:'center', fontSize:12, color:t.textMuted, marginTop:20 } }, 'Progress is saved to the cloud')
    )
  );
}

// ── Custom Quiz Screen ────────────────────────────────────────────────────────
function CustomQuizScreen({ questions, appData, onStart, onBack, dark }) {
  const t = T(dark);
  const [filters, setFilters] = useState({ wrong:false, starred:false, unsure:false, guessing:false, sure:false });
  const [countOption, setCountOption] = useState(25);

  const toggle = key => setFilters(f => ({ ...f, [key]: !f[key] }));
  const anyFilter = Object.values(filters).some(Boolean);

  const matchingQs = useMemo(() => {
    if (!anyFilter) return [];
    return questions.filter(q => {
      if (filters.wrong   && (appData.wrongCounts[q.id] || 0) > 0) return true;
      if (filters.starred && appData.starred.includes(q.id)) return true;
      const conf = appData.confidenceLog[q.id];
      if (filters.unsure   && conf && conf.conf === 'unsure')   return true;
      if (filters.guessing && conf && conf.conf === 'guessing') return true;
      if (filters.sure     && conf && conf.conf === 'sure' && !conf.correct) return true;
      return false;
    });
  }, [questions, appData, filters]);

  const pool = useMemo(() => {
    if (!anyFilter || !matchingQs.length) return [];
    const s = shuffle(matchingQs);
    return countOption === 'all' ? s : s.slice(0, countOption);
  }, [matchingQs, countOption, anyFilter]);

  const filterOpts = [
    { key:'wrong',    label:'Wrong answers',   desc:'Got wrong at least once',              color:'#dc2626', activeBg: dark?'#3b0d0d':'#fff1f2', activeBorder:'#f43f5e' },
    { key:'starred',  label:'Starred',         desc:'Questions you marked with a star',      color:'#d97706', activeBg: dark?'#3b2a0d':'#fffbeb', activeBorder:'#f59e0b' },
    { key:'unsure',   label:'Unsure',          desc:'Tagged as Unsure during a quiz',        color:'#d97706', activeBg: dark?'#3b2a0d':'#fffbeb', activeBorder:'#f59e0b' },
    { key:'guessing', label:'Guessing',        desc:'You were just guessing on these',       color:'#dc2626', activeBg: dark?'#3b0d0d':'#fff1f2', activeBorder:'#f43f5e' },
    { key:'sure',     label:'Sure but wrong',  desc:'Confident but incorrect — danger gaps', color:'#7c3aed', activeBg: dark?'#1e1035':'#f5f3ff', activeBorder:'#7c3aed' },
  ];

  return el('div', { style: { minHeight:'100vh', background:t.bg, display:'flex', flexDirection:'column' } },
    el('div', { style: { background:t.card, borderBottom:'1px solid '+t.borderLight, padding:'52px 20px 14px', display:'flex', alignItems:'center', gap:14 } },
      el('button', { onClick:onBack, style: { background:'none', border:'none', fontSize:24, color:t.textSub, lineHeight:1, padding:'0 4px' } }, '‹'),
      el('div', { style: { flex:1 } },
        el('div', { style: { fontSize:10, fontWeight:700, color:t.textMuted, letterSpacing:2 } }, 'BICSI · RCDD'),
        el('h1', { style: { fontSize:22, fontWeight:800, color:t.text } }, 'Custom Quiz')
      )
    ),
    el('div', { style: { flex:1, padding:'20px 20px 48px', overflowY:'auto' } },
      el('div', { style: { fontSize:10, fontWeight:700, color:t.textMuted, letterSpacing:2, marginBottom:12 } }, 'INCLUDE QUESTIONS WHERE…'),
      el('div', { style: { display:'flex', flexDirection:'column', gap:9, marginBottom:22 } },
        ...filterOpts.map(opt => {
          const active = filters[opt.key];
          return el('button', { key:opt.key, onClick:()=>toggle(opt.key), style: { display:'flex', alignItems:'center', gap:14, background: active ? opt.activeBg : t.card, border:'1.5px solid '+(active ? opt.activeBorder : t.border), borderRadius:13, padding:'13px 15px', textAlign:'left', cursor:'pointer' } },
            el('div', { style: { width:22, height:22, borderRadius:6, border:'2px solid '+(active ? opt.activeBorder : t.border), background: active ? opt.activeBorder : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 } },
              active && el('span', { style: { color:'#fff', fontSize:13, fontWeight:800, lineHeight:1 } }, '✓')
            ),
            el('div', { style: { flex:1 } },
              el('div', { style: { fontSize:14, fontWeight:700, color: active ? opt.color : t.text } }, opt.label),
              el('div', { style: { fontSize:11, color:t.textMuted, marginTop:2 } }, opt.desc)
            )
          );
        })
      ),
      el('div', { style: { fontSize:10, fontWeight:700, color:t.textMuted, letterSpacing:2, marginBottom:12 } }, 'NUMBER OF QUESTIONS'),
      el('div', { style: { display:'flex', gap:9, marginBottom:22 } },
        ...[10, 25, 50, 'all'].map(opt =>
          el('button', { key:opt, onClick:()=>setCountOption(opt), style: { flex:1, padding:'10px 4px', borderRadius:11, border:'1.5px solid '+(countOption===opt ? '#7c3aed' : t.border), background: countOption===opt ? '#7c3aed' : t.card, color: countOption===opt ? '#fff' : t.text, fontSize:13, fontWeight:700, cursor:'pointer' } },
            opt === 'all' ? 'All' : opt
          )
        )
      ),
      anyFilter
        ? el('div', { style: { background:t.cardAlt, border:'1px solid '+t.border, borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' } },
            el('span', { style: { fontSize:14, fontWeight:600, color:t.textSub } }, 'Questions matched'),
            el('span', { style: { fontSize:22, fontWeight:800, color:'#7c3aed' } }, matchingQs.length)
          )
        : el('div', { style: { background:t.cardAlt, border:'1px solid '+t.border, borderRadius:12, padding:'14px 16px', marginBottom:20, textAlign:'center' } },
            el('span', { style: { fontSize:13, color:t.textMuted } }, 'Select at least one filter above')
          ),
      el('button', { onClick:()=>pool.length>0&&onStart(pool), disabled:pool.length===0, style: { width:'100%', background: pool.length>0 ? 'linear-gradient(135deg,#0891b2,#0284c7)' : t.pill, color: pool.length>0 ? '#fff' : t.textMuted, border:'none', borderRadius:13, padding:'14px', fontSize:15, fontWeight:700, cursor: pool.length>0 ? 'pointer' : 'default', boxShadow: pool.length>0 ? '0 4px 14px rgba(8,145,178,0.3)' : 'none' } },
        pool.length > 0 ? 'Start ' + pool.length + ' Question Quiz →' : 'No questions match your filters'
      )
    )
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
function App() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [screen, setScreen] = useState('home');
  const [activeTest, setActiveTest] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionMode, setSessionMode] = useState('normal');

  // ── Dark mode ──
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('rcdd_dark') === '1'; } catch(e) { return false; } });
  const toggleDark = useCallback(() => setDark(d => { const n=!d; try{localStorage.setItem('rcdd_dark',n?'1':'0');}catch(e){} return n; }), []);

  // ── Auth ──
  const [currentUser, setCurrentUser] = useState(() => { try { return JSON.parse(localStorage.getItem('rcdd_user')) || null; } catch(e) { return null; } });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [progressLoaded, setProgressLoaded] = useState(() => {
    try { const user = JSON.parse(localStorage.getItem('rcdd_user')); return user ? !!localStorage.getItem(STORAGE_KEY+'_'+user.username) : false; } catch(e) { return false; }
  });
  const justLoadedRef = useRef(false);

  const [appData, setAppData] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('rcdd_user'));
      if (user && user.username) {
        const cached = loadUser(user.username);
        if (cached) return { sessions:cached.sessions||{}, history:cached.history||[], starred:cached.starred||[], wrongCounts:cached.wrongCounts||{}, confidenceLog:cached.confidenceLog||{} };
      }
    } catch(e) {}
    const saved = load();
    if (!saved) { try { const old=localStorage.getItem('rcdd_v2'); if(old){const p=JSON.parse(old);return{sessions:p.sessions||{},history:p.history||[],starred:p.starred||[],wrongCounts:{},confidenceLog:{}};} } catch(e) {} }
    if (saved) return { sessions:saved.sessions||{}, history:saved.history||[], starred:saved.starred||[], wrongCounts:saved.wrongCounts||{}, confidenceLog:saved.confidenceLog||{} };
    return { sessions:{}, history:[], starred:[], wrongCounts:{}, confidenceLog:{} };
  });

  useEffect(() => { save(appData); if (currentUser) saveUser(currentUser.username, appData); }, [appData, currentUser]);

  useEffect(() => {
    Promise.all(CHAPTER_FILES.map(url => fetch(url).then(r => { if(!r.ok) throw new Error('HTTP '+r.status+' — '+url); return r.json(); })))
      .then(arrays => { setQuestions(arrays.flat()); setLoading(false); })
      .catch(err => { setFetchError(err.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!currentUser || questions.length === 0) return;
    db.collection('users').doc(currentUser.username).get()
      .then(doc => {
        if (doc.exists && doc.data().progress) {
          const p = doc.data().progress;
          const qById = {};
          questions.forEach(q => { qById[q.id] = q; });
          justLoadedRef.current = true;
          setAppData({ sessions:expandSessions(p.sessions||{},qById), history:p.history||[], starred:p.starred||[], wrongCounts:p.wrongCounts||{}, confidenceLog:p.confidenceLog||{} });
        }
        setProgressLoaded(true);
      })
      .catch(() => setProgressLoaded(true));
  }, [currentUser, questions]);

  useEffect(() => {
    if (!currentUser || !progressLoaded) return;
    if (justLoadedRef.current) { justLoadedRef.current = false; return; }
    const timer = setTimeout(() => { db.collection('users').doc(currentUser.username).update({ progress: compactAppData(appData) }).catch(()=>{}); }, 2000);
    return () => clearTimeout(timer);
  }, [appData, currentUser, progressLoaded]);

  const signIn = useCallback(async (username, pin) => {
    setAuthLoading(true); setAuthError('');
    try {
      const doc = await db.collection('users').doc(username).get();
      if (!doc.exists) { setAuthError('Username not found. Create an account?'); return; }
      const h = await hashPin(pin);
      if (doc.data().pin !== h) { setAuthError('Incorrect PIN. Try again.'); return; }
      const user = { username };
      localStorage.setItem('rcdd_user', JSON.stringify(user));
      const cached = loadUser(username);
      if (cached) { setAppData({ sessions:cached.sessions||{}, history:cached.history||[], starred:cached.starred||[], wrongCounts:cached.wrongCounts||{}, confidenceLog:cached.confidenceLog||{} }); setProgressLoaded(true); }
      else { setProgressLoaded(false); }
      setCurrentUser(user);
    } catch(e) { setAuthError('Connection error. Check your internet.'); }
    finally { setAuthLoading(false); }
  }, []);

  const signUp = useCallback(async (username, pin) => {
    setAuthLoading(true); setAuthError('');
    try {
      const doc = await db.collection('users').doc(username).get();
      if (doc.exists) { setAuthError('Username already taken. Try another.'); return; }
      const h = await hashPin(pin);
      await db.collection('users').doc(username).set({ pin:h, createdAt:firebase.firestore.FieldValue.serverTimestamp(), progress:null });
      const user = { username };
      localStorage.setItem('rcdd_user', JSON.stringify(user));
      setProgressLoaded(true);
      setCurrentUser(user);
    } catch(e) { setAuthError('Connection error. Check your internet.'); }
    finally { setAuthLoading(false); }
  }, []);

  const signOut = useCallback(() => { localStorage.removeItem('rcdd_user'); setCurrentUser(null); setProgressLoaded(false); setScreen('home'); setActiveTest(null); setMenuOpen(false); }, []);

  const spacedShuffle = useCallback((qs) => {
    const priority = qs.filter(q => (appData.wrongCounts[q.id]||0) >= 1);
    const normal   = qs.filter(q => (appData.wrongCounts[q.id]||0) < 1);
    return [...shuffle(priority), ...shuffle(normal)];
  }, [appData.wrongCounts]);

  const tests = useMemo(() => {
    const map = {};
    questions.forEach(q => { const id=q.test; if(!map[id]) map[id]={id,name:q.testName||'Test '+id,questions:[]}; map[id].questions.push(q); });
    return Object.values(map).sort((a,b) => a.id-b.id);
  }, [questions]);

  // Extend any saved session shorter than its chapter (handles stale sessions
  // and future question bank additions automatically)
  useEffect(() => {
    if (!progressLoaded || tests.length === 0) return;
    setAppData(prev => {
      const updates = {};
      tests.forEach(chapter => {
        const existing = prev.sessions[chapter.id];
        if (!existing || existing.questions.length >= chapter.questions.length) return;
        const seenIds = new Set(existing.questions.map(q => q.id));
        const missing = chapter.questions.filter(q => !seenIds.has(q.id));
        updates[chapter.id] = {
          ...existing,
          questions:   [...existing.questions, ...missing],
          answers:     [...existing.answers, ...Array(missing.length).fill(null)],
          confidences: [...(existing.confidences||Array(existing.questions.length).fill(null)), ...Array(missing.length).fill(null)],
        };
      });
      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, sessions: { ...prev.sessions, ...updates } };
    });
  }, [tests, progressLoaded]);

  const getOrCreateSession = useCallback((testId) => {
    const chapter = tests.find(x => x.id === testId);
    if (!chapter) return;
    const existing = appData.sessions[testId];
    if (existing) {
      if (existing.questions.length < chapter.questions.length) {
        const seenIds = new Set(existing.questions.map(q => q.id));
        const missing = spacedShuffle(chapter.questions.filter(q => !seenIds.has(q.id)));
        const questions   = [...existing.questions, ...missing];
        const answers     = [...existing.answers, ...Array(missing.length).fill(null)];
        const confidences = [...(existing.confidences||Array(existing.questions.length).fill(null)), ...Array(missing.length).fill(null)];
        setAppData(prev => ({ ...prev, sessions: { ...prev.sessions, [testId]: { ...existing, questions, answers, confidences } } }));
      }
      return;
    }
    const qs = spacedShuffle(chapter.questions);
    setAppData(prev => ({ ...prev, sessions: { ...prev.sessions, [testId]: { questions:qs, answers:Array(qs.length).fill(null), confidences:Array(qs.length).fill(null), mode:'normal' } } }));
  }, [appData.sessions, tests, spacedShuffle]);

  const answer = useCallback((testId, qIdx, optIdx) => {
    setAppData(prev => {
      const sess = prev.sessions[testId];
      if (!sess || sess.answers[qIdx] !== null) return prev;
      const answers = [...sess.answers]; answers[qIdx] = optIdx;
      return { ...prev, sessions: { ...prev.sessions, [testId]: { ...sess, answers } } };
    });
  }, []);

  const setConfidence = useCallback((testId, qIdx, conf) => {
    setAppData(prev => {
      const sess = prev.sessions[testId]; if (!sess) return prev;
      const confidences = [...(sess.confidences||Array(sess.questions.length).fill(null))]; confidences[qIdx] = conf;
      return { ...prev, sessions: { ...prev.sessions, [testId]: { ...sess, confidences } } };
    });
  }, []);

  const finishTest = useCallback((testId) => {
    const sess = appData.sessions[testId]; if (!sess) return;
    const isSpecial = sess.mode==='review' || sess.mode==='focus' || sess.mode==='custom';
    const newWC = { ...appData.wrongCounts };
    const newCL = { ...appData.confidenceLog };
    sess.questions.forEach((q,i) => {
      const correct = sess.answers[i] === q.a;
      const conf = sess.confidences ? sess.confidences[i] : null;
      if (!correct && sess.answers[i]!==null) newWC[q.id] = (newWC[q.id]||0)+1;
      else if (correct && !isSpecial && newWC[q.id]) newWC[q.id] = Math.max(0, newWC[q.id]-1);
      newCL[q.id] = { conf, correct, testId };
    });
    if (isSpecial) { setAppData(prev=>({...prev,wrongCounts:newWC,confidenceLog:newCL})); setScreen('result'); return; }
    const correct = sess.questions.filter((q,i)=>sess.answers[i]===q.a).length;
    const pct = Math.round(correct/sess.questions.length*100);
    setAppData(prev=>({...prev,history:[{date:new Date().toISOString(),testId,correct,total:sess.questions.length,pct},...prev.history],wrongCounts:newWC,confidenceLog:newCL}));
    setScreen('result');
  }, [appData]);

  const reshuffleTest = useCallback((testId) => {
    const t = tests.find(x=>x.id===testId); if(!t) return;
    const qs = spacedShuffle(t.questions);
    setAppData(prev=>({...prev,sessions:{...prev.sessions,[testId]:{questions:qs,answers:Array(qs.length).fill(null),confidences:Array(qs.length).fill(null),mode:'normal'}}}));
    setScreen('test');
  }, [tests, spacedShuffle]);

  const retryTest = useCallback((testId) => {
    setAppData(prev => { const sess=prev.sessions[testId]; if(!sess) return prev; return {...prev,sessions:{...prev.sessions,[testId]:{...sess,answers:Array(sess.questions.length).fill(null),confidences:Array(sess.questions.length).fill(null)}}}; });
    setScreen('test');
  }, []);

  const resetTest = useCallback((testId) => { setAppData(prev => { const s={...prev.sessions}; delete s[testId]; return {...prev,sessions:s}; }); }, []);

  const toggleStar = useCallback((qId) => { setAppData(prev=>({...prev,starred:prev.starred.includes(qId)?prev.starred.filter(s=>s!==qId):[...prev.starred,qId]})); }, []);

  const reshuffleAll = useCallback(() => {
    const sessions = {};
    tests.forEach(t => { const qs=spacedShuffle(t.questions); sessions[t.id]={questions:qs,answers:Array(qs.length).fill(null),confidences:Array(qs.length).fill(null),mode:'normal'}; });
    setAppData(prev=>({...prev,sessions}));
  }, [tests, spacedShuffle]);

  const startFocusSession = useCallback(() => {
    if (!questions.length) return;
    const chapStats = {};
    tests.forEach(t => {
      const sess = appData.sessions[t.id]; if(!sess) return;
      sess.questions.forEach((q,i) => {
        const ch = q.chapter||'General';
        if (!chapStats[ch]) chapStats[ch]={correct:0,total:0,questions:[]};
        chapStats[ch].total++;
        if (sess.answers[i]===q.a) chapStats[ch].correct++;
        if (sess.answers[i]!==null && sess.answers[i]!==q.a) chapStats[ch].questions.push(q);
      });
    });
    const sorted = Object.entries(chapStats).filter(([,v])=>v.questions.length>0).sort(([,a],[,b])=>(a.correct/Math.max(a.total,1))-(b.correct/Math.max(b.total,1)));
    let fqs = [];
    for (const [,v] of sorted) { fqs=fqs.concat(v.questions); if(fqs.length>=10) break; }
    if (fqs.length<10) { const extra=questions.filter(q=>!fqs.find(fq=>fq.id===q.id)).sort((a,b)=>(appData.wrongCounts[b.id]||0)-(appData.wrongCounts[a.id]||0)).slice(0,10-fqs.length); fqs=fqs.concat(extra); }
    fqs = fqs.slice(0,10);
    const sess={questions:fqs,answers:Array(fqs.length).fill(null),confidences:Array(fqs.length).fill(null),mode:'focus'};
    setAppData(prev=>({...prev,sessions:{...prev.sessions,focus:sess}}));
    setSessionMode('focus'); setActiveTest('focus'); setScreen('test');
  }, [questions, tests, appData]);

  const startCustomSession = useCallback((pool) => {
    const sess={questions:pool,answers:Array(pool.length).fill(null),confidences:Array(pool.length).fill(null),mode:'custom'};
    setAppData(prev=>({...prev,sessions:{...prev.sessions,custom:sess}}));
    setSessionMode('custom'); setActiveTest('custom'); setScreen('test');
  }, []);

  const testStats = useMemo(() => tests.map(t => {
    const sess = appData.sessions[t.id];
    if (!sess) return { testId:t.id, name:t.name, done:0, correct:0, total:t.questions.length, pct:null };
    const done = sess.answers.filter(a=>a!==null).length;
    const correct = sess.questions.filter((q,i)=>sess.answers[i]===q.a&&sess.answers[i]!==null).length;
    return { testId:t.id, name:t.name, done, correct, total:sess.questions.length, pct: done>0?Math.round(correct/done*100):null };
  }), [tests, appData.sessions]);

  const totalAnswered = testStats.reduce((s,ts)=>s+ts.done, 0);
  const totalQs       = testStats.reduce((s,ts)=>s+ts.total, 0);
  const totalCorrect  = testStats.reduce((s,ts)=>s+ts.correct, 0);
  const overallScore  = totalAnswered > 0 ? Math.round(totalCorrect/totalAnswered*100) : null;
  const allTestsDone  = tests.length > 0 && tests.every(t => { const s=appData.sessions[t.id]; return s&&s.answers.every(a=>a!==null); });
  const t = T(dark);

  if (loading || (currentUser && !progressLoaded)) {
    return el('div', { style: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, background:t.bg } },
      el('div', { style: { fontSize:48, lineHeight:1 } }, '💡'),
      el('p', { style: { fontSize:16, color:t.textSub, fontWeight:600 } }, loading ? 'Loading RCDD Quiz…' : 'Loading your progress…')
    );
  }
  if (fetchError) {
    return el('div', { style: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, gap:12, background:t.bg } },
      el('div', { style: { fontSize:48 } }, '⚠️'),
      el('p', { style: { fontSize:15, fontWeight:700, color:'#dc2626', textAlign:'center' } }, 'Could not load questions'),
      el('p', { style: { fontSize:13, color:t.textSub, textAlign:'center' } }, 'Check your internet connection and refresh.'),
      el('button', { onClick:()=>window.location.reload(), style: { marginTop:16, background:'#6366f1', color:'#fff', border:'none', borderRadius:12, padding:'12px 32px', fontSize:15, fontWeight:700 } }, 'Refresh')
    );
  }
  if (!currentUser) return el(AuthScreen, { onSignIn:signIn, onSignUp:signUp, loading:authLoading, error:authError, dark });

  const session = activeTest ? (appData.sessions[activeTest]||null) : null;

  return el('div', { style: { maxWidth:430, margin:'0 auto', minHeight:'100vh', background:t.bg, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflowX:'hidden' } },
    el(SideMenu, { open:menuOpen, onClose:()=>setMenuOpen(false), history:appData.history, totalAnswered, totalQs, totalCorrect, overallScore, currentUser, dark, onSignOut:signOut }),
    screen==='home' && el(HomeScreen, { tests, testStats, overallScore, totalAnswered, totalQs, history:appData.history, onSelect:id=>{setSessionMode('normal');setActiveTest(id);getOrCreateSession(id);setScreen('test');}, onMenu:()=>setMenuOpen(true), onReshuffleAll:reshuffleAll, allTestsDone, onFocusSession:startFocusSession, onCustomQuiz:()=>setScreen('custom'), onResetTest:resetTest, dark, onToggleDark:toggleDark }),
    screen==='custom' && el(CustomQuizScreen, { questions, appData, onStart:startCustomSession, onBack:()=>setScreen('home'), dark }),
    screen==='test' && session && el(TestScreen, { key:activeTest+'_'+(session.mode||'normal'), testId:activeTest, session, starred:appData.starred, wrongCounts:appData.wrongCounts, onAnswer:answer, onConfidence:setConfidence, onStar:toggleStar, onBack:()=>setScreen('home'), onFinish:()=>finishTest(activeTest), dark }),
    screen==='result' && session && el(ResultScreen, { testId:activeTest, session, onBack:()=>setScreen('test'), onRetry:()=>retryTest(activeTest), onReshuffle:()=>reshuffleTest(activeTest), onHome:()=>setScreen('home'), dark })
  );
}

// ── Session Chart ─────────────────────────────────────────────────────────────
function SessionChart({ history, dark }) {
  const t = T(dark);
  const data = history.slice(0, 10).reverse();
  if (data.length < 2) return null;

  const W = 240, H = 118;
  const PL = 26, PR = 6, PT = 18, PB = 20;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const maxVal = Math.max(...data.map(d => d.total), 1);

  const xOf = i => PL + (i / (data.length - 1)) * innerW;
  const yOf = v => PT + innerH - (v / maxVal) * innerH;

  const attemptedPts = data.map((d, i) => xOf(i) + ',' + yOf(d.total)).join(' ');
  const correctPts   = data.map((d, i) => xOf(i) + ',' + yOf(d.correct)).join(' ');
  const wrongPts     = data.map((d, i) => xOf(i) + ',' + yOf(d.total - d.correct)).join(' ');

  return el('div', { style: { background:t.cardAlt, borderRadius:12, padding:'12px 14px', marginBottom:14, border:'1px solid '+t.borderLight } },
    el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 } },
      el('span', { style: { fontSize:9, fontWeight:700, color:t.textMuted, letterSpacing:2 } }, 'SESSION CHART'),
      el('div', { style: { display:'flex', gap:8 } },
        el('div', { style: { display:'flex', alignItems:'center', gap:3 } },
          el('div', { style: { width:12, height:2, background:'#7c3aed', borderRadius:1 } }),
          el('span', { style: { fontSize:8, color:t.textSub } }, 'Attempted')
        ),
        el('div', { style: { display:'flex', alignItems:'center', gap:3 } },
          el('div', { style: { width:12, height:2, background:'#059669', borderRadius:1 } }),
          el('span', { style: { fontSize:8, color:t.textSub } }, 'Correct')
        ),
        el('div', { style: { display:'flex', alignItems:'center', gap:3 } },
          el('div', { style: { width:12, height:2, background:'#dc2626', borderRadius:1 } }),
          el('span', { style: { fontSize:8, color:t.textSub } }, 'Wrong')
        )
      )
    ),
    el('svg', { width:'100%', viewBox:'0 0 '+W+' '+H, style:{ display:'block', overflow:'visible' } },
      [0, 0.5, 1].map((frac, gi) => el('g', { key:'g'+gi },
        el('line', { x1:PL, y1:yOf(maxVal*frac), x2:W-PR, y2:yOf(maxVal*frac), stroke:t.borderLight, strokeWidth:0.5 }),
        el('text', { x:PL-3, y:yOf(maxVal*frac)+3, textAnchor:'end', fontSize:7, fill:t.textMuted }, String(Math.round(maxVal*frac)))
      )),
      el('polyline', { points:attemptedPts, fill:'none', stroke:'#7c3aed', strokeWidth:1.5, strokeLinejoin:'round', strokeLinecap:'round' }),
      el('polyline', { points:correctPts,   fill:'none', stroke:'#059669', strokeWidth:1.5, strokeLinejoin:'round', strokeLinecap:'round' }),
      el('polyline', { points:wrongPts,     fill:'none', stroke:'#dc2626', strokeWidth:1.5, strokeLinejoin:'round', strokeLinecap:'round' }),
      data.map((d, i) => {
        const x = xOf(i);
        const ya = yOf(d.total);
        const yc = yOf(d.correct);
        const yw = yOf(d.total - d.correct);
        const dateStr = new Date(d.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
        return el('g', { key:'pt'+i },
          el('circle', { cx:x, cy:ya, r:2.5, fill:'#7c3aed' }),
          el('circle', { cx:x, cy:yc, r:2.5, fill:'#059669' }),
          el('circle', { cx:x, cy:yw, r:2.5, fill:'#dc2626' }),
          (i===0||i===data.length-1) ? el('text', { x:x, y:H-2, textAnchor:'middle', fontSize:7, fill:t.textMuted }, dateStr) : null
        );
      })
    )
  );
}

// ── Side Menu ─────────────────────────────────────────────────────────────────
function SideMenu({ open, onClose, history, totalAnswered, totalQs, totalCorrect, overallScore, currentUser, dark, onSignOut }) {
  const t = T(dark);
  const accuracy   = totalAnswered > 0 ? Math.round(totalCorrect/totalAnswered*100) : 0;
  const completion = totalQs > 0 ? Math.round(totalAnswered/totalQs*100) : 0;
  const bestScore  = history.length ? Math.max(...history.map(h=>h.pct)) : null;
  const avgScore   = history.length ? Math.round(history.reduce((s,h)=>s+h.pct,0)/history.length) : null;

  const stats = [
    { label:'Score',    val: overallScore!==null?overallScore+'%':'—', color:'#7c3aed' },
    { label:'Accuracy', val: accuracy+'%',                              color:'#059669' },
    { label:'Progress', val: completion+'%',                            color:'#d97706' },
    { label:'Sessions', val: history.length,                            color:'#0891b2' },
    { label:'Best',     val: bestScore!==null?bestScore+'%':'—',        color:'#dc2626' },
    { label:'Average',  val: avgScore!==null?avgScore+'%':'—',          color:'#9333ea' },
  ];

  return el('div', null,
    open && el('div', { onClick:onClose, style: { position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:40 } }),
    el('div', { style: { position:'fixed', top:0, left:0, height:'100vh', width:288, background:t.card, zIndex:50, overflowY:'auto', transition:'transform 0.28s ease', transform: open?'translateX(0)':'translateX(-100%)', boxShadow:'6px 0 32px rgba(0,0,0,0.18)', paddingBottom:60 } },
      el('div', { style: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'56px 18px 14px', borderBottom:'1px solid '+t.borderLight } },
        el('span', { style: { fontSize:20, fontWeight:800, color:t.text } }, 'Analytics'),
        el('button', { onClick:onClose, style: { background:t.pill, border:'none', borderRadius:8, width:30, height:30, fontSize:14, color:t.textSub } }, '✕')
      ),
      el('div', { style: { padding:'14px 18px 0' } },
        el('div', { style: { display:'flex', alignItems:'center', justifyContent:'space-between', background:t.cardAlt, borderRadius:12, padding:'10px 12px', marginBottom:14, border:'1px solid '+t.borderLight } },
          el('div', null,
            el('div', { style: { fontSize:9, fontWeight:700, color:t.textMuted, letterSpacing:2 } }, 'SIGNED IN AS'),
            el('div', { style: { fontSize:14, fontWeight:700, color:t.text, marginTop:2 } }, currentUser.username)
          ),
          el('button', { onClick:onSignOut, style: { background:'#fff1f2', border:'1px solid #fca5a5', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:700, color:'#dc2626', cursor:'pointer' } }, 'Sign Out')
        ),
        el('p', { style: { fontSize:9, fontWeight:700, color:t.textMuted, letterSpacing:2, marginBottom:10 } }, 'OVERALL'),
        el('div', { style: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 } },
          ...stats.map(s => el('div', { key:s.label, style: { background:t.cardAlt, borderRadius:10, padding:'10px 12px', border:'1px solid '+t.borderLight } },
            el('div', { style: { fontSize:20, fontWeight:800, color:s.color, lineHeight:1 } }, s.val),
            el('div', { style: { fontSize:10, color:t.textMuted, fontWeight:600, marginTop:3 } }, s.label)
          ))
        ),
        el('div', { style: { background:t.cardAlt, borderRadius:12, padding:'12px 14px', marginBottom:14 } },
          el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:6 } },
            el('span', { style: { fontSize:11, fontWeight:600, color:t.textSub } }, 'Completion'),
            el('span', { style: { fontSize:11, fontWeight:700, color:'#7c3aed' } }, totalAnswered+'/'+totalQs)
          ),
          el('div', { style: { height:6, background:t.borderLight, borderRadius:3, overflow:'hidden' } },
            el('div', { style: { height:'100%', background:'linear-gradient(90deg,#7c3aed,#a855f7)', borderRadius:3, width:completion+'%', transition:'width 0.5s' } })
          )
        ),
        el(SessionChart, { history, dark }),
        history.length > 0 && el('div', null,
          el('p', { style: { fontSize:9, fontWeight:700, color:t.textMuted, letterSpacing:2, margin:'14px 0 10px' } }, 'RECENT SESSIONS'),
          ...history.slice(0,5).map(h => el('div', { key:h.date+'_'+h.testId, style: { display:'flex', alignItems:'center', gap:8, paddingBottom:9, borderBottom:'1px solid '+t.borderLight } },
            el('div', { style: { width:8, height:8, borderRadius:'50%', background:COLORS[h.testId]||'#6366f1', flexShrink:0 } }),
            el('span', { style: { fontSize:11, color:t.textSub, flex:1 } }, 'Test '+h.testId),
            el('span', { style: { fontSize:11, fontWeight:700, color: h.pct>=80?'#059669':h.pct>=60?'#d97706':'#dc2626' } }, h.pct+'%'),
            el('span', { style: { fontSize:10, color:t.textMuted } }, new Date(h.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}))
          ))
        )
      )
    )
  );
}

// ── Home Screen ───────────────────────────────────────────────────────────────
const DAILY_TARGET = 50;
function HomeScreen({ tests, testStats, overallScore, totalAnswered, totalQs, history, onSelect, onMenu, onReshuffleAll, allTestsDone, onFocusSession, onCustomQuiz, onResetTest, dark, onToggleDark }) {
  const t = T(dark);
  const pct = totalQs > 0 ? Math.round(totalAnswered/totalQs*100) : 0;
  const [resetConfirm, setResetConfirm] = useState(null);

  const today = new Date().toDateString();
  const todayCorrect = history.filter(h => new Date(h.date).toDateString() === today).reduce((s,h) => s+h.correct, 0);
  const dailyPct = Math.min(Math.round(todayCorrect/DAILY_TARGET*100), 100);
  const dailyDone = todayCorrect >= DAILY_TARGET;

  return el('div', { style: { minHeight:'100vh', background:t.bg, display:'flex', flexDirection:'column' } },
    el('div', { style: { background:t.card, borderBottom:'1px solid '+t.borderLight, padding:'52px 20px 14px', display:'flex', alignItems:'center', gap:14 } },
      el('button', { onClick:onMenu, style: { background:'none', border:'none', padding:4, display:'flex', flexDirection:'column', gap:5 } },
        el('span', { style: { display:'block', width:20, height:2, background:t.text, borderRadius:2 } }),
        el('span', { style: { display:'block', width:20, height:2, background:t.text, borderRadius:2 } }),
        el('span', { style: { display:'block', width:20, height:2, background:t.text, borderRadius:2 } })
      ),
      el('div', { style: { flex:1 } },
        el('div', { style: { fontSize:10, fontWeight:700, color:t.textMuted, letterSpacing:2 } }, 'BICSI · RCDD'),
        el('h1', { style: { fontSize:22, fontWeight:800, color:t.text } }, 'Practice Test')
      ),
      el('button', { onClick:onToggleDark, title: dark?'Light mode':'Dark mode', style: { background:t.pill, border:'1px solid '+t.border, borderRadius:10, width:36, height:36, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 } }, dark ? '☀️' : '🌙'),
      el('div', { style: { textAlign:'right' } },
        el('div', { style: { fontSize:24, fontWeight:800, color:'#7c3aed', lineHeight:1 } }, overallScore!==null?overallScore+'%':'—'),
        el('div', { style: { fontSize:10, color:t.textMuted } }, 'score')
      )
    ),
    el('div', { style: { padding:'12px 20px 10px', background:t.card } },
      el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:5 } },
        el('span', { style: { fontSize:11, color:t.textSub } }, 'Overall Progress'),
        el('span', { style: { fontSize:11, fontWeight:700, color:'#7c3aed' } }, totalAnswered+' / '+totalQs)
      ),
      el('div', { style: { height:5, background:t.borderLight, borderRadius:3, overflow:'hidden', marginBottom:10 } },
        el('div', { style: { height:'100%', background:'linear-gradient(90deg,#7c3aed,#a855f7)', borderRadius:3, width:pct+'%' } })
      ),
      el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:5 } },
        el('span', { style: { fontSize:11, color:t.textSub } }, dailyDone ? '🎯 Daily Target Complete!' : 'Daily Target'),
        el('span', { style: { fontSize:11, fontWeight:700, color: dailyDone?'#059669':'#16a34a' } }, todayCorrect+' / '+DAILY_TARGET+' correct')
      ),
      el('div', { style: { height:5, background:t.borderLight, borderRadius:3, overflow:'hidden' } },
        el('div', { style: { height:'100%', background: dailyDone?'linear-gradient(90deg,#059669,#34d399)':'linear-gradient(90deg,#16a34a,#4ade80)', borderRadius:3, width:dailyPct+'%', transition:'width 0.5s' } })
      )
    ),
    el('div', { style: { flex:1, padding:'16px 20px', overflowY:'auto' } },
      el('div', { style: { display:'flex', gap:10, marginBottom:14 } },
        el('button', { onClick:onCustomQuiz, style: { flex:1, background:'linear-gradient(135deg,#0891b2,#0284c7)', color:'#fff', border:'none', borderRadius:14, padding:'13px 10px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:7, boxShadow:'0 4px 14px rgba(8,145,178,0.3)', cursor:'pointer' } }, '✦ Custom Quiz'),
        allTestsDone && el('button', { onClick:onFocusSession, style: { flex:1, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:14, padding:'13px 10px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:7, boxShadow:'0 4px 14px rgba(99,102,241,0.3)', cursor:'pointer' } }, '🎯 Focus Session')
      ),
      el('div', { style: { fontSize:10, fontWeight:700, color:t.textMuted, letterSpacing:2, marginBottom:12 } }, 'SELECT A TEST'),
      ...tests.map(test => {
        const ts = testStats.find(x=>x.testId===test.id)||{done:0,correct:0,total:test.questions.length,pct:null};
        const color = COLORS[test.id]||'#6366f1';
        const light = dark ? color+'22' : (LIGHTS[test.id]||'#f5f3ff');
        const totalQsInChapter = test.questions.length;
        const isComplete = ts.done===totalQsInChapter && ts.done>0;
        const fillPct = totalQsInChapter>0 ? (ts.done/totalQsInChapter*100) : 0;
        const isConfirming = resetConfirm===test.id;
        return el('div', { key:test.id, style: { marginBottom:9, position:'relative' } },
          el('button', { onClick:()=>{ if(!isConfirming) onSelect(test.id); }, style: { width:'100%', background:t.card, border:'1.5px solid '+(isComplete?color+'60':t.border), borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, textAlign:'left', opacity:isConfirming?0.5:1, cursor:'pointer' } },
            el('div', { style: { width:38, height:38, borderRadius:11, background:light, color:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, flexShrink:0 } }, test.id),
            el('div', { style: { flex:1, minWidth:0 } },
              el('div', { style: { display:'flex', alignItems:'center', gap:6, marginBottom:2 } },
                el('span', { style: { fontSize:13, fontWeight:700, color:t.text } }, test.name),
                isComplete && el('span', { style: { fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20, background:light, color:color } }, '✓ Done')
              ),
              el('div', { style: { fontSize:11, color:t.textMuted, marginBottom:5 } }, ts.done+'/'+totalQsInChapter+' questions'),
              el('div', { style: { height:3, background:t.borderLight, borderRadius:2, overflow:'hidden' } },
                el('div', { style: { height:'100%', background:color, borderRadius:2, width:fillPct+'%' } })
              )
            ),
            el('div', { style: { textAlign:'right', flexShrink:0 } },
              ts.pct!==null
                ? el('div', { style: { fontSize:17, fontWeight:800, color:color, lineHeight:1 } }, ts.pct+'%')
                : el('div', { style: { fontSize:13, color:t.border, lineHeight:1 } }, '—')
            ),
            el('button', { onClick:e=>{ e.stopPropagation(); setResetConfirm(test.id); }, style: { background:'none', border:'none', fontSize:16, color:t.textMuted, padding:'4px', flexShrink:0, lineHeight:1 }, title:'Reset this test' }, '↺'),
            !isConfirming && el('span', { style: { fontSize:20, color:t.border } }, '›')
          ),
          isConfirming && el('div', { style: { position:'absolute', bottom:-1, left:0, right:0, background:t.card, border:'1.5px solid #f43f5e', borderRadius:'0 0 14px 14px', padding:'8px 14px', display:'flex', alignItems:'center', gap:8, zIndex:2 } },
            el('span', { style: { fontSize:12, fontWeight:600, color:t.text, flex:1 } }, 'Reset this test?'),
            el('button', { onClick:()=>{ onResetTest(test.id); setResetConfirm(null); }, style: { background:'#f43f5e', color:'#fff', border:'none', borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:700 } }, 'Yes'),
            el('button', { onClick:()=>setResetConfirm(null), style: { background:t.cardAlt, color:t.textSub, border:'1.5px solid '+t.border, borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:600 } }, 'No')
          )
        );
      }),
      el('button', { onClick:onReshuffleAll, style: { width:'100%', background:t.cardAlt, border:'1.5px solid '+t.border, borderRadius:12, padding:'12px', fontSize:13, fontWeight:600, color:t.textSub, marginTop:4, cursor:'pointer' } }, '↺ Reshuffle All Tests')
    )
  );
}

// ── Test Screen ───────────────────────────────────────────────────────────────
function TestScreen({ testId, session, starred, wrongCounts, onAnswer, onConfidence, onStar, onBack, onFinish, dark }) {
  const t = T(dark);
  const [qIdx, setQIdx] = useState(() => {
    const first = session.answers.findIndex(a => a === null);
    return first === -1 ? 0 : first;
  });
  const [showJump, setShowJump] = useState(false);

  const color = COLORS[testId]||'#6366f1';
  const light = dark ? color+'22' : (LIGHTS[testId]||'#f5f3ff');
  const qs = session.questions;
  const ans = session.answers;
  const confs = session.confidences||Array(qs.length).fill(null);
  const q = qs[qIdx];
  const isAnswered = ans[qIdx]!==null;
  const selected = ans[qIdx];
  const allDone = ans.every(a=>a!==null);
  const doneCount = ans.filter(a=>a!==null).length;
  const progress = ((qIdx+1)/qs.length)*100;
  const wrongCount = wrongCounts[q.id]||0;
  const sessionLabel = session.mode==='focus'?'🎯 FOCUS SESSION':session.mode==='review'?'✗ REVIEW MODE':session.mode==='custom'?'✦ CUSTOM QUIZ':'TEST '+testId;

  return el('div', { style: { minHeight:'100vh', background:t.bg, display:'flex', flexDirection:'column' } },
    el('div', { style: { background:t.card, borderBottom:'2px solid '+color+'22', padding:'52px 14px 10px', display:'flex', alignItems:'center', gap:10 } },
      el('button', { onClick:onBack, style: { background:'none', border:'none', fontSize:24, color:t.textSub, lineHeight:1, padding:'0 4px' } }, '‹'),
      el('div', { style: { flex:1 } },
        el('div', { style: { fontSize:10, fontWeight:700, color:color, letterSpacing:1.5 } }, sessionLabel),
        el('div', { style: { fontSize:12, fontWeight:600, color:t.textSub } }, q.testName||q.chapter||'')
      ),
      el('button', { onClick:()=>setShowJump(s=>!s), style: { background:showJump?color:t.cardAlt, border:'1.5px solid '+color, borderRadius:9, padding:'5px 12px', fontSize:12, fontWeight:700, color:showJump?'#fff':color } }, showJump?'✕':'⊞ '+doneCount+'/'+qs.length)
    ),
    showJump && el('div', { style: { background:light, padding:'12px 16px 10px', borderBottom:'1px solid '+color+'20' } },
      el('div', { style: { display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 } },
        ...qs.map((qq,i) => {
          const done=ans[i]!==null, correct=done&&ans[i]===qq.a, isCurr=i===qIdx;
          return el('button', { key:qq.id, onClick:()=>{setQIdx(i);setShowJump(false);}, style: { width:34, height:30, borderRadius:7, border:'2px solid '+(isCurr?color:starred.includes(qq.id)?'#f59e0b':correct?'#22c55e':done?'#f43f5e':t.border), background:isCurr?color:correct?'#dcfce7':done?'#fff1f2':t.card, color:isCurr?'#fff':correct?'#166634':done?'#9f1239':t.textSub, fontSize:10, fontWeight:700 } }, i+1);
        })
      ),
      el('div', { style: { display:'flex', gap:12, flexWrap:'wrap' } },
        ...[ ['#dcfce7','#22c55e','Correct'], ['#fff1f2','#f43f5e','Wrong'], [t.card,t.border,'Not yet'] ].map(([bg,br,lbl]) =>
          el('div', { key:lbl, style:{ display:'flex', alignItems:'center', gap:4 } },
            el('div', { style:{ width:9, height:9, borderRadius:2, background:bg, border:'1.5px solid '+br } }),
            el('span', { style:{ fontSize:9, color:t.textSub } }, lbl)
          )
        )
      )
    ),
    el('div', { style: { height:3, background:t.borderLight } },
      el('div', { style: { height:'100%', background:color, width:progress+'%', transition:'width 0.4s', borderRadius:'0 2px 2px 0' } })
    ),
    el('div', { style: { margin:'16px 18px 0', background:t.card, borderRadius:14, padding:'16px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)' } },
      el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 } },
        el('div', { style: { display:'flex', alignItems:'center', gap:8 } },
          el('span', { style: { fontSize:10, fontWeight:700, color:color, letterSpacing:1.5 } }, 'Q'+(qIdx+1)+' OF '+qs.length),
          wrongCount>0 && el('span', { style: { fontSize:9, fontWeight:700, background:'#fff1f2', color:'#dc2626', borderRadius:10, padding:'2px 7px' } }, '✗ '+wrongCount+'x wrong')
        ),
        el('button', { onClick:()=>onStar(q.id), style: { background:'none', border:'none', fontSize:20, color:starred.includes(q.id)?'#f59e0b':t.border, padding:0 } }, starred.includes(q.id)?'★':'☆')
      ),
      el('p', { style: { fontSize:15, fontWeight:600, color:t.text, lineHeight:1.55 } }, q.q)
    ),
    !isAnswered && el('div', { style: { margin:'10px 18px 0' } },
      el('div', { style: { fontSize:9, fontWeight:700, color:t.textMuted, letterSpacing:1.5, marginBottom:6 } }, 'HOW CONFIDENT ARE YOU?'),
      el('div', { style: { display:'flex', gap:7 } },
        [['Sure','#059669','#ecfdf5'],['Unsure','#d97706','#fffbeb'],['Guessing','#dc2626','#fef2f2']].map(([label,tc,bg]) =>
          el('button', { key:label, onClick:()=>onConfidence(testId,qIdx,label.toLowerCase()), style: { flex:1, padding:'8px 4px', borderRadius:9, border:'1.5px solid '+(confs[qIdx]===label.toLowerCase()?tc:t.border), background:confs[qIdx]===label.toLowerCase()?bg:t.card, color:confs[qIdx]===label.toLowerCase()?tc:t.textMuted, fontSize:11, fontWeight:700 } }, label)
        )
      )
    ),
    el('div', { style: { padding:'12px 18px 0', display:'flex', flexDirection:'column', gap:8 } },
      ...q.o.map((opt,i) => {
        let bg=t.card, border=t.border, col=t.text, lbg=t.pill, lc=t.textSub;
        if (isAnswered) {
          if (i===q.a)                        { bg='#f0fdf4'; border='#22c55e'; col='#166534'; lbg='#22c55e'; lc='#fff'; }
          else if (i===selected && i!==q.a)   { bg='#fff1f2'; border='#f43f5e'; col='#9f1239'; lbg='#f43f5e'; lc='#fff'; }
          else { bg=dark?'#0f172a':'#fafafa'; border=t.borderLight; col=dark?'#475569':'#b0bec5'; lbg=t.borderLight; lc=dark?'#475569':'#b0bec5'; }
        }
        return el('button', { key:i, onClick:()=>!isAnswered&&onAnswer(testId,qIdx,i), style: { display:'flex', alignItems:'center', gap:10, border:'1.5px solid '+border, borderRadius:11, padding:'12px', textAlign:'left', width:'100%', background:bg, color:col } },
          el('span', { style: { minWidth:24, height:24, borderRadius:6, background:lbg, color:lc, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 } }, LABELS[i]),
          el('span', { style: { fontSize:13.5, lineHeight:1.4, flex:1 } }, opt),
          isAnswered && i===q.a && el('span', { style: { marginLeft:'auto', fontSize:14 } }, '✓'),
          isAnswered && i===selected && i!==q.a && el('span', { style: { marginLeft:'auto', fontSize:14 } }, '✗')
        );
      })
    ),
    isAnswered && el('div', { style: { margin:'12px 18px 0', background:t.card, borderRadius:12, padding:'13px', border:'1px solid '+t.border } },
      el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:5 } },
        el('span', { style: { fontSize:12, fontWeight:700, color:selected===q.a?'#16a34a':'#dc2626' } }, selected===q.a?'Correct ✓':'Incorrect ✗'),
        el('span', { style: { fontSize:11, color:t.textMuted } }, 'Answer: '+LABELS[q.a])
      ),
      confs[qIdx] && el('div', { style: { marginBottom:6, display:'flex', gap:6, alignItems:'center' } },
        el('span', { style: { fontSize:10, fontWeight:700, color:t.textMuted } }, 'You were:'),
        el('span', { style: { fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:20, background:confs[qIdx]==='sure'?'#ecfdf5':confs[qIdx]==='unsure'?'#fffbeb':'#fef2f2', color:confs[qIdx]==='sure'?'#059669':confs[qIdx]==='unsure'?'#d97706':'#dc2626' } }, confs[qIdx].charAt(0).toUpperCase()+confs[qIdx].slice(1)),
        selected!==q.a && confs[qIdx]==='sure' && el('span', { style: { fontSize:10, fontWeight:700, color:'#dc2626', background:'#fff1f2', borderRadius:20, padding:'2px 9px' } }, '⚠️ Danger Gap')
      ),
      el('p', { style: { fontSize:12.5, color:t.textSub, lineHeight:1.6 } }, q.w)
    ),
    el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px 44px', marginTop:'auto' } },
      el('button', { onClick:()=>qIdx>0&&setQIdx(i=>i-1), disabled:qIdx===0, style: { background:t.cardAlt, border:'1.5px solid '+t.border, borderRadius:10, padding:'9px 16px', fontSize:13, fontWeight:600, color:t.textSub, opacity:qIdx===0?0.35:1 } }, '‹ Prev'),
      allDone
        ? el('button', { onClick:onFinish, style: { background:color, color:'#fff', border:'none', borderRadius:11, padding:'10px 22px', fontSize:14, fontWeight:700, boxShadow:'0 4px 14px '+color+'40' } }, 'Finish →')
        : isAnswered && qIdx<qs.length-1
          ? el('button', { onClick:()=>setQIdx(i=>i+1), style: { background:color, color:'#fff', border:'none', borderRadius:11, padding:'10px 22px', fontSize:14, fontWeight:700 } }, 'Next →')
          : el('div')
    )
  );
}

// ── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({ testId, session, onBack, onRetry, onReshuffle, onHome, dark }) {
  const t = T(dark);
  const isSpecial = testId==='focus'||testId==='review'||testId==='custom';
  const color = COLORS[testId]||'#6366f1';
  const light = dark ? color+'22' : (LIGHTS[testId]||'#f5f3ff');
  const qs = session.questions;
  const ans = session.answers;
  const confs = session.confidences||Array(qs.length).fill(null);
  const score = qs.filter((q,i)=>ans[i]===q.a).length;
  const pct = Math.round(score/qs.length*100);
  const grade = pct>=80 ? { label:'Excellent 🎯', color:'#059669', bg:dark?'#052e16':'#f0fdf4' }
    : pct>=60 ? { label:'Good 👍', color:'#d97706', bg:dark?'#431407':'#fffbeb' }
    : { label:'Keep Going 📚', color:'#dc2626', bg:dark?'#450a0a':'#fff1f2' };

  const dangerGaps   = qs.filter((q,i)=>ans[i]!==q.a&&confs[i]==='sure');
  const wrongGuessing = qs.filter((q,i)=>ans[i]!==q.a&&confs[i]==='guessing');

  const chapMap = {};
  qs.forEach((q,i) => {
    const ch=q.chapter||'General';
    if (!chapMap[ch]) chapMap[ch]={correct:0,total:0};
    chapMap[ch].total++;
    if (ans[i]===q.a) chapMap[ch].correct++;
  });
  const chapters = Object.entries(chapMap).map(([ch,v])=>({ch,pct:Math.round(v.correct/v.total*100),correct:v.correct,total:v.total})).sort((a,b)=>a.pct-b.pct);

  return el('div', { style: { minHeight:'100vh', background:t.bg, overflowY:'auto', paddingBottom:48 } },
    el('div', { style: { background:grade.bg, padding:'52px 20px 22px', display:'flex', flexDirection:'column', alignItems:'center', borderRadius:'0 0 22px 22px', position:'relative' } },
      el('button', { onClick:onBack, style: { position:'absolute', top:52, left:16, background:'none', border:'none', fontSize:24, color:t.textSub } }, '‹'),
      isSpecial
        ? el('div', { style: { fontSize:13, fontWeight:800, color:color, marginBottom:8 } }, testId==='focus'?'🎯 Focus Session':testId==='custom'?'✦ Custom Quiz':'✗ Review Mode')
        : el('div', { style: { width:44, height:44, borderRadius:12, background:light, color:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, marginBottom:8 } }, testId),
      el('div', { style: { fontSize:54, fontWeight:800, color:t.text, lineHeight:1 } }, pct, el('span', { style: { fontSize:20 } }, '%')),
      el('div', { style: { fontSize:14, fontWeight:700, color:grade.color, marginTop:3 } }, grade.label),
      el('div', { style: { fontSize:12, color:t.textSub, marginTop:4 } }, score+' of '+qs.length+' correct')
    ),
    (dangerGaps.length>0||wrongGuessing.length>0) && el('div', { style: { margin:'14px 18px 0', background:t.card, borderRadius:14, padding:'16px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)' } },
      el('div', { style: { fontSize:10, fontWeight:700, color:t.textMuted, letterSpacing:2, marginBottom:12 } }, 'CONFIDENCE ANALYSIS'),
      dangerGaps.length>0 && el('div', { style: { marginBottom:10, background:'#fff1f2', borderRadius:10, padding:'10px 12px', border:'1px solid #fca5a5' } },
        el('div', { style: { fontSize:11, fontWeight:700, color:'#dc2626', marginBottom:6 } }, '⚠️ Danger Gaps — Wrong but SURE ('+dangerGaps.length+')'),
        el('div', { style: { fontSize:10, color:'#94a3b8', marginBottom:8 } }, 'You were confident but incorrect. These need immediate attention.'),
        ...dangerGaps.map(q=>el('div', { key:q.id, style: { fontSize:11, color:'#7f1d1d', padding:'4px 0', borderTop:'1px solid #fee2e2' } }, '• '+q.q.substring(0,60)+(q.q.length>60?'…':'')))
      ),
      wrongGuessing.length>0 && el('div', { style: { background:'#fef3c7', borderRadius:10, padding:'10px 12px', border:'1px solid #fde68a' } },
        el('div', { style: { fontSize:11, fontWeight:700, color:'#92400e', marginBottom:6 } }, '🤔 Wrong while Guessing ('+wrongGuessing.length+')'),
        el('div', { style: { fontSize:10, color:'#92400e', marginBottom:4 } }, 'You knew you were uncertain — review these to build confidence.'),
        ...wrongGuessing.map(q=>el('div', { key:q.id, style: { fontSize:11, color:'#78350f', padding:'3px 0' } }, '• '+q.q.substring(0,60)+(q.q.length>60?'…':'')))
      )
    ),
    el('div', { style: { margin:'14px 18px 0', background:t.card, borderRadius:14, padding:'16px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)' } },
      el('div', { style: { fontSize:10, fontWeight:700, color:t.textMuted, letterSpacing:2, marginBottom:12 } }, 'TOPIC BREAKDOWN'),
      ...chapters.map(c => el('div', { key:c.ch, style: { marginBottom:10 } },
        el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:4 } },
          el('span', { style: { fontSize:12, fontWeight:600, color:t.textSub } }, c.ch),
          el('span', { style: { fontSize:12, fontWeight:700, color:c.pct>=80?'#059669':c.pct>=60?'#d97706':'#dc2626' } }, c.pct+'%')
        ),
        el('div', { style: { height:5, background:t.borderLight, borderRadius:2, overflow:'hidden' } },
          el('div', { style: { height:'100%', background:c.pct>=80?'#22c55e':c.pct>=60?'#f59e0b':'#f43f5e', borderRadius:2, width:c.pct+'%', transition:'width 0.5s' } })
        )
      ))
    ),
    el('div', { style: { margin:'14px 18px 0', background:t.card, borderRadius:14, padding:'16px', boxShadow:'0 1px 6px rgba(0,0,0,0.08)' } },
      el('div', { style: { fontSize:10, fontWeight:700, color:t.textMuted, letterSpacing:2, marginBottom:10 } }, 'QUESTION REVIEW'),
      ...qs.map((q,i) => {
        const correct=ans[i]===q.a, conf=confs[i], isDangerGap=!correct&&conf==='sure';
        return el('div', { key:q.id, style: { border:'1.5px solid '+(isDangerGap?'#fca5a5':correct?(dark?'#166534':'#dcfce7'):(dark?'#6b1325':'#fff1f2')), borderRadius:10, padding:'10px', marginBottom:8, background:isDangerGap?(dark?'#3b0d0d':'#fff5f5'):correct?(dark?'#052e16':'#f8fffe'):(dark?'#2d0a0a':'#fffafa') } },
          el('div', { style: { display:'flex', gap:8 } },
            el('span', { style: { minWidth:20, height:20, borderRadius:5, background:correct?'#22c55e':'#f43f5e', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0, marginTop:1 } }, correct?'✓':'✗'),
            el('div', null,
              el('p', { style: { fontSize:12, fontWeight:600, color:t.text, lineHeight:1.4, marginBottom:3 } }, q.q),
              conf && el('span', { style: { fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:10, marginBottom:4, display:'inline-block', background:conf==='sure'?'#ecfdf5':conf==='guessing'?'#fef2f2':'#fffbeb', color:conf==='sure'?'#059669':conf==='guessing'?'#dc2626':'#d97706' } }, conf.charAt(0).toUpperCase()+conf.slice(1)),
              isDangerGap && el('span', { style: { fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:10, background:'#fee2e2', color:'#dc2626', marginLeft:4 } }, '⚠️ Danger Gap'),
              !correct && el('p', { style: { fontSize:11, color:'#dc2626', marginBottom:2, marginTop:3 } }, 'Your: '+(ans[i]!==null?LABELS[ans[i]]+'. '+q.o[ans[i]]:'—')),
              el('p', { style: { fontSize:11, color:'#059669' } }, '✓ '+LABELS[q.a]+'. '+q.o[q.a])
            )
          )
        );
      })
    ),
    el('div', { style: { padding:'12px 18px', display:'flex', flexDirection:'column', gap:9 } },
      !isSpecial && el('button', { onClick:onReshuffle, style: { width:'100%', background:color, color:'#fff', border:'none', borderRadius:13, padding:'14px', fontSize:14, fontWeight:700 } }, '↺ Reshuffle & Retry'),
      !isSpecial && el('button', { onClick:onRetry, style: { width:'100%', background:t.card, color:color, border:'1.5px solid '+color, borderRadius:13, padding:'13px', fontSize:14, fontWeight:700 } }, 'Retry Same Questions'),
      el('button', { onClick:onHome, style: { width:'100%', background:t.cardAlt, color:t.textSub, border:'1.5px solid '+t.border, borderRadius:13, padding:'13px', fontSize:13, fontWeight:600 } }, '← All Tests')
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
