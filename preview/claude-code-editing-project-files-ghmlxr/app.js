// RCDD Exam Prep — app.js
// Vanilla React (no JSX, no build step needed)

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ── Config ────────────────────────────────────────────────────────────────────
const LABELS = ['A','B','C','D'];
const STORAGE_KEY = 'rcdd_v3';
// Version is defined in version.js (shared with sw.js) — edit only that file.
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

const BLUE = '#0066cc';
const BLUE_DARK = '#2997ff';

// ── Theme tokens ──────────────────────────────────────────────────────────────
function T(dark) {
  return {
    bg:          dark ? '#1d1d1f' : '#f5f5f7',
    card:        dark ? '#2a2a2c' : '#ffffff',
    cardAlt:     dark ? '#1d1d1f' : '#f5f5f7',
    border:      dark ? '#3a3a3c' : '#e0e0e0',
    borderLight: dark ? '#2a2a2c' : '#f0f0f0',
    text:        dark ? '#ffffff' : '#1d1d1f',
    textSub:     dark ? '#cccccc' : '#333333',
    textMuted:   dark ? '#7a7a7a' : '#7a7a7a',
    pill:        dark ? '#3a3a3c' : '#f5f5f7',
    pillBorder:  dark ? '#3a3a3c' : '#e0e0e0',
    input:       dark ? '#1d1d1f' : '#ffffff',
    inputBorder: dark ? '#3a3a3c' : '#e0e0e0',
    blue:        dark ? BLUE_DARK : BLUE,
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
// Enable offline persistence — Firebase queues writes to IndexedDB when offline
// and syncs automatically when the connection is restored
db.enablePersistence({ synchronizeTabs: false }).catch(() => {});

async function hashPin(pin) {
  const data = new TextEncoder().encode('rcdd:' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function compactAppData(appData) {
  const sessions = {};
  Object.entries(appData.sessions).forEach(([testId, sess]) => {
    if (!sess || testId === 'focus' || testId === 'review' || testId === 'custom' || testId === 'daily') return;
    sessions[testId] = {
      qOrder: sess.questions.map(q => q.id),
      answers: sess.answers,
      confidences: sess.confidences || Array(sess.questions.length).fill(null),
      mode: sess.mode || 'normal'
    };
  });
  return { sessions, history: appData.history, starred: appData.starred, wrongCounts: appData.wrongCounts, confidenceLog: appData.confidenceLog, dailyStats: appData.dailyStats };
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
function AuthScreen({ onSignIn, onSignUp, onGuest, loading, error, dark }) {
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
        el('h1', { style: { fontSize:34, fontWeight:600, color:t.text, margin:0, letterSpacing:'-0.374px', lineHeight:1.1 } }, 'RCDD Exam Prep'),
        el('p', { style: { fontSize:17, color:t.textMuted, marginTop:8, letterSpacing:'-0.374px' } }, 'BICSI · RCDD Exam Prep')
      ),
      el('div', { style: { background:t.card, borderRadius:18, padding:24, border:'1px solid '+t.border } },
        el('div', { style: { display:'flex', background:t.pill, borderRadius:9999, padding:4, marginBottom:24, border:'1px solid '+t.border } },
          [['signin','Sign In'], ['signup','Create Account']].map(([m, label]) =>
            el('button', { key:m, onClick: () => { setMode(m); setPin(''); }, style: { flex:1, padding:'9px 6px', borderRadius:9999, border:'none', fontSize:14, fontWeight:600, letterSpacing:'-0.224px', background: mode===m ? t.card : 'transparent', color: mode===m ? t.text : t.textMuted, boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', cursor:'pointer' } }, label)
          )
        ),
        el('div', { style: { marginBottom:14 } },
          el('label', { style: { fontSize:12, fontWeight:600, color:t.textSub, display:'block', marginBottom:6, letterSpacing:'-0.12px' } }, 'Username'),
          el('input', { type:'text', placeholder: mode==='signin' ? 'Your username' : 'Choose a username', value:username, onChange:e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'')), onKeyDown:e=>e.key==='Enter'&&handleSubmit(), autoCapitalize:'none', autoCorrect:'off', spellCheck:false, style: { width:'100%', padding:'12px 14px', borderRadius:9999, border:'1px solid '+t.inputBorder, fontSize:17, fontFamily:'inherit', outline:'none', background:t.input, color:t.text, boxSizing:'border-box', letterSpacing:'-0.374px' } })
        ),
        el('div', { style: { marginBottom: error ? 14 : 20 } },
          el('label', { style: { fontSize:12, fontWeight:600, color:t.textSub, display:'block', marginBottom:6, letterSpacing:'-0.12px' } }, 'PIN (4–6 digits)'),
          el('input', { type:'password', inputMode:'numeric', placeholder:'••••', maxLength:6, value:pin, onChange:e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6)), onKeyDown:e=>e.key==='Enter'&&handleSubmit(), style: { width:'100%', padding:'12px 14px', borderRadius:9999, border:'1px solid '+t.inputBorder, fontSize:24, fontFamily:'monospace', outline:'none', background:t.input, color:t.text, letterSpacing:8, boxSizing:'border-box' } })
        ),
        error && el('div', { style: { background:'#fff1f2', border:'1px solid #fca5a5', borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:14, color:'#dc2626', fontWeight:600, letterSpacing:'-0.224px' } }, error),
        el('button', { onClick:handleSubmit, disabled:!canSubmit, style: { width:'100%', background: canSubmit ? BLUE : '#99c0f5', color:'#fff', border:'none', borderRadius:9999, padding:'14px', fontSize:17, fontWeight:400, letterSpacing:'-0.374px', cursor: canSubmit ? 'pointer' : 'default' } }, loading ? 'Please wait…' : mode==='signin' ? 'Sign In' : 'Create Account')
      ),
      el('button', { onClick:onGuest, style: { width:'100%', background:'transparent', border:'none', padding:'14px', fontSize:15, color:t.textMuted, cursor:'pointer', letterSpacing:'-0.224px' } }, 'Continue as Guest'),
      el('p', { style: { textAlign:'center', fontSize:10, color:t.textMuted, marginTop:4, opacity:0.6 } }, 'v' + APP_VERSION.major + '.' + APP_VERSION.minor)
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
    el('div', { style: { background:t.card, borderBottom:'1px solid '+t.border, padding:'52px 20px 14px', display:'flex', alignItems:'center', gap:14 } },
      el('button', { onClick:onBack, style: { background:'none', border:'none', fontSize:24, color:t.textSub, lineHeight:1, padding:'0 4px' } }, '‹'),
      el('div', { style: { flex:1 } },
        el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px' } }, 'BICSI · RCDD'),
        el('h1', { style: { fontSize:24, fontWeight:600, color:t.text, letterSpacing:'-0.374px' } }, 'Custom Quiz')
      )
    ),
    el('div', { style: { flex:1, padding:'20px 20px 48px', overflowY:'auto' } },
      el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px', marginBottom:12 } }, 'Include questions where…'),
      el('div', { style: { display:'flex', flexDirection:'column', gap:9, marginBottom:22 } },
        ...filterOpts.map(opt => {
          const active = filters[opt.key];
          return el('button', { key:opt.key, onClick:()=>toggle(opt.key), style: { display:'flex', alignItems:'center', gap:14, background: active ? opt.activeBg : t.card, border:'1px solid '+(active ? opt.activeBorder : t.border), borderRadius:18, padding:'13px 15px', textAlign:'left', cursor:'pointer' } },
            el('div', { style: { width:22, height:22, borderRadius:6, border:'2px solid '+(active ? opt.activeBorder : t.border), background: active ? opt.activeBorder : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 } },
              active && el('span', { style: { color:'#fff', fontSize:13, fontWeight:600, lineHeight:1 } }, '✓')
            ),
            el('div', { style: { flex:1 } },
              el('div', { style: { fontSize:14, fontWeight:600, color: active ? opt.color : t.text, letterSpacing:'-0.224px' } }, opt.label),
              el('div', { style: { fontSize:12, color:t.textMuted, marginTop:2, letterSpacing:'-0.12px' } }, opt.desc)
            )
          );
        })
      ),
      el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px', marginBottom:12 } }, 'Number of questions'),
      el('div', { style: { display:'flex', gap:9, marginBottom:22 } },
        ...[10, 25, 50, 'all'].map(opt =>
          el('button', { key:opt, onClick:()=>setCountOption(opt), style: { flex:1, padding:'10px 4px', borderRadius:9999, border:'1.5px solid '+(countOption===opt ? BLUE : t.border), background: countOption===opt ? BLUE : t.card, color: countOption===opt ? '#fff' : t.text, fontSize:14, fontWeight:400, letterSpacing:'-0.224px', cursor:'pointer' } },
            opt === 'all' ? 'All' : opt
          )
        )
      ),
      anyFilter
        ? el('div', { style: { background:t.cardAlt, border:'1px solid '+t.border, borderRadius:18, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' } },
            el('span', { style: { fontSize:14, fontWeight:400, color:t.textSub, letterSpacing:'-0.224px' } }, 'Questions matched'),
            el('span', { style: { fontSize:22, fontWeight:600, color:t.blue, letterSpacing:'-0.374px' } }, matchingQs.length)
          )
        : el('div', { style: { background:t.cardAlt, border:'1px solid '+t.border, borderRadius:18, padding:'14px 16px', marginBottom:20, textAlign:'center' } },
            el('span', { style: { fontSize:14, color:t.textMuted, letterSpacing:'-0.224px' } }, 'Select at least one filter above')
          ),
      el('button', { onClick:()=>pool.length>0&&onStart(pool), disabled:pool.length===0, style: { width:'100%', background: pool.length>0 ? BLUE : t.pill, color: pool.length>0 ? '#fff' : t.textMuted, border:'none', borderRadius:9999, padding:'14px 22px', fontSize:17, fontWeight:400, letterSpacing:'-0.374px', cursor: pool.length>0 ? 'pointer' : 'default' } },
        pool.length > 0 ? 'Start ' + pool.length + ' Question Quiz' : 'No questions match your filters'
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

  // ── Online/Offline ──
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', dn);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);

  // ── Dark mode ──
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('rcdd_dark') === '1'; } catch(e) { return false; } });
  const toggleDark = useCallback(() => setDark(d => { const n=!d; try{localStorage.setItem('rcdd_dark',n?'1':'0');}catch(e){} return n; }), []);
  const [tablet, setTablet] = useState(() => { try { return localStorage.getItem('rcdd_tablet') === '1'; } catch(e) { return false; } });
  const toggleTablet = useCallback(() => setTablet(tb => { const n=!tb; try{localStorage.setItem('rcdd_tablet',n?'1':'0');}catch(e){} return n; }), []);
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    if (tablet) { root.style.height = '100vh'; root.style.overflow = 'hidden'; }
    else { root.style.height = ''; root.style.overflow = ''; }
  }, [tablet]);

  // ── Auth ──
  const [currentUser, setCurrentUser] = useState(() => { try { return JSON.parse(localStorage.getItem('rcdd_user')) || null; } catch(e) { return null; } });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  // Always false on start — Firestore writes are blocked until server data has been read.
  // localStorage still populates the initial appData render but we never write back
  // until we've confirmed what the server has, preventing stale-device overwrites.
  const [progressLoaded, setProgressLoaded] = useState(false);
  const justLoadedRef = useRef(false);

  const [appData, setAppData] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('rcdd_user'));
      if (user && user.username) {
        const cached = loadUser(user.username);
        if (cached) return { sessions:cached.sessions||{}, history:cached.history||[], starred:cached.starred||[], wrongCounts:cached.wrongCounts||{}, confidenceLog:cached.confidenceLog||{}, dailyStats:cached.dailyStats||{date:'',correct:0} };
      }
    } catch(e) {}
    const saved = load();
    if (!saved) { try { const old=localStorage.getItem('rcdd_v2'); if(old){const p=JSON.parse(old);return{sessions:p.sessions||{},history:p.history||[],starred:p.starred||[],wrongCounts:{},confidenceLog:{}};} } catch(e) {} }
    if (saved) return { sessions:saved.sessions||{}, history:saved.history||[], starred:saved.starred||[], wrongCounts:saved.wrongCounts||{}, confidenceLog:saved.confidenceLog||{}, dailyStats:saved.dailyStats||{date:'',correct:0} };
    return { sessions:{}, history:[], starred:[], wrongCounts:{}, confidenceLog:{}, dailyStats:{date:'',correct:0} };
  });

  useEffect(() => {
    Promise.all(CHAPTER_FILES.map(url => fetch(url).then(r => { if(!r.ok) throw new Error('HTTP '+r.status+' — '+url); return r.json(); })))
      .then(arrays => { setQuestions(arrays.flat()); setLoading(false); })
      .catch(err => { setFetchError(err.message); setLoading(false); });
  }, []);

  const applyServerProgress = useCallback((doc) => {
    if (doc.exists && doc.data().progress) {
      const p = doc.data().progress;
      const qById = {};
      questions.forEach(q => { qById[q.id] = q; });
      justLoadedRef.current = true;
      const serverDaily = p.dailyStats || { date: '', correct: 0 };
      const today = new Date().toDateString();
      setAppData(prev => {
        const localDaily = prev.dailyStats || { date: '', correct: 0 };
        const dailyStats = localDaily.date === today && localDaily.correct > (serverDaily.date === today ? serverDaily.correct : 0)
          ? localDaily : serverDaily;
        const ephemeral = {};
        ['daily', 'focus', 'review', 'custom'].forEach(k => { if (prev.sessions[k]) ephemeral[k] = prev.sessions[k]; });
        return { sessions:{ ...expandSessions(p.sessions||{},qById), ...ephemeral }, history:p.history||[], starred:p.starred||[], wrongCounts:p.wrongCounts||{}, confidenceLog:p.confidenceLog||{}, dailyStats };
      });
    }
  }, [questions]);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [versionErr, setVersionErr] = useState('');
  const syncProgress = useCallback(() => {
    if (!currentUser) return;
    setSyncing(true); setSyncMsg(''); setVersionErr('');
    db.collection('users').doc(currentUser.username).get({ source: 'server' })
      .then(doc => {
        applyServerProgress(doc);
        // Check for a new app version by fetching version.js fresh from the server
        return fetch('/Quiz/version.js?_=' + Date.now(), { cache: 'no-store' })
          .then(r => r.text())
          .then(text => {
            const m = /minor:\s*(\d+)/.exec(text);
            const serverMinor = m ? parseInt(m[1], 10) : null;
            if (serverMinor !== null && serverMinor > APP_VERSION.minor) {
              setSyncMsg('New version! Reloading…');
              setTimeout(() => window.location.reload(), 1200);
            } else {
              setSyncing(false); setSyncMsg('Synced ✓'); setTimeout(() => setSyncMsg(''), 2500);
            }
          })
          .catch(() => { setSyncing(false); setSyncMsg('Synced ✓'); setVersionErr('Version check failed'); setTimeout(() => setVersionErr(''), 4000); });
      })
      .catch(() => { setSyncing(false); setSyncMsg('Sync failed'); setTimeout(() => setSyncMsg(''), 2500); });
  }, [currentUser, applyServerProgress]);

  useEffect(() => {
    if (!currentUser || questions.length === 0) return;
    if (currentUser.isGuest) { setProgressLoaded(true); return; }
    // Force server fetch so we always get the latest data, not the IndexedDB cache
    db.collection('users').doc(currentUser.username).get({ source: 'server' })
      .then(doc => { applyServerProgress(doc); setProgressLoaded(true); })
      .catch(() => { justLoadedRef.current = true; setProgressLoaded(true); });
  }, [currentUser, questions]);

  // Cloud-first sync: write to Firestore with a short debounce.
  // localStorage is also kept in sync so the fast-load cache is never stale.
  useEffect(() => {
    if (!currentUser || !progressLoaded) return;
    if (currentUser.isGuest) return;
    if (justLoadedRef.current) { justLoadedRef.current = false; return; }
    // Always write to localStorage so the startup cache stays current
    saveUser(currentUser.username, appData);
    const compact = compactAppData(appData);
    const timer = setTimeout(() => {
      db.collection('users').doc(currentUser.username).update({ progress: compact }).catch(() => {});
    }, 500);
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
      if (cached) setAppData({ sessions:cached.sessions||{}, history:cached.history||[], starred:cached.starred||[], wrongCounts:cached.wrongCounts||{}, confidenceLog:cached.confidenceLog||{}, dailyStats:cached.dailyStats||{date:'',correct:0} });
      setProgressLoaded(false);
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

  const signInAsGuest = useCallback(() => { setCurrentUser({ username:'guest', isGuest:true }); }, []);

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
      const isCorrect = optIdx === sess.questions[qIdx].a;
      const today = new Date().toDateString();
      const ds = prev.dailyStats || { date: '', correct: 0 };
      const dailyStats = { date: today, correct: (ds.date === today ? ds.correct : 0) + (isCorrect ? 1 : 0) };
      let sessions = { ...prev.sessions, [testId]: { ...sess, answers } };
      if (testId === 'daily') {
        const q = sess.questions[qIdx];
        const chSess = sessions[q.test];
        if (chSess) {
          const ci = chSess.questions.findIndex(cq => cq.id === q.id);
          if (ci !== -1 && chSess.answers[ci] === null) {
            const chAnswers = [...chSess.answers]; chAnswers[ci] = optIdx;
            sessions = { ...sessions, [q.test]: { ...chSess, answers: chAnswers } };
          }
        }
      }
      return { ...prev, sessions, dailyStats };
    });
  }, []);

  const setConfidence = useCallback((testId, qIdx, conf) => {
    setAppData(prev => {
      const sess = prev.sessions[testId]; if (!sess) return prev;
      const confidences = [...(sess.confidences||Array(sess.questions.length).fill(null))]; confidences[qIdx] = conf;
      return { ...prev, sessions: { ...prev.sessions, [testId]: { ...sess, confidences } } };
    });
  }, []);

  const finishTest = useCallback((testId, avgTime) => {
    const sess = appData.sessions[testId]; if (!sess) return;
    const isSpecial = sess.mode==='review' || sess.mode==='focus' || sess.mode==='custom' || sess.mode==='daily';
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
    setAppData(prev=>({...prev,history:[{date:new Date().toISOString(),testId,correct,total:sess.questions.length,pct,avgTime:avgTime||null},...prev.history],wrongCounts:newWC,confidenceLog:newCL}));
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

  const startDailySession = useCallback(() => {
    if (!questions.length) return;
    const existing = appData.sessions['daily'];
    if (existing && existing.answers.some(a => a === null)) {
      setSessionMode('daily'); setActiveTest('daily'); setScreen('test');
      return;
    }
    const newSessions = {};
    const pool = [];
    tests.forEach(t => {
      const sess = appData.sessions[t.id];
      if (sess) {
        const done = sess.answers.filter(a => a !== null).length;
        if (done >= t.questions.length) return;
        sess.questions.forEach((q, i) => { if (sess.answers[i] === null) pool.push(q); });
      } else {
        const qs = spacedShuffle(t.questions);
        newSessions[t.id] = { questions:qs, answers:Array(qs.length).fill(null), confidences:Array(qs.length).fill(null), mode:'normal' };
        qs.forEach(q => pool.push(q));
      }
    });
    const selected = shuffle(pool).slice(0, 100);
    if (!selected.length) return;
    newSessions['daily'] = { questions:selected, answers:Array(selected.length).fill(null), confidences:Array(selected.length).fill(null), mode:'daily' };
    setAppData(prev => ({ ...prev, sessions: { ...prev.sessions, ...newSessions } }));
    setSessionMode('daily'); setActiveTest('daily'); setScreen('test');
  }, [questions, tests, appData.sessions, spacedShuffle]);

  const testStats = useMemo(() => tests.map(t => {
    const sess = appData.sessions[t.id];
    if (!sess) return { testId:t.id, name:t.name, done:0, correct:0, total:t.questions.length, pct:null };
    const done = sess.answers.filter(a=>a!==null).length;
    const correct = sess.questions.filter((q,i)=>sess.answers[i]===q.a&&sess.answers[i]!==null).length;
    return { testId:t.id, name:t.name, done, correct, total:sess.questions.length, pct: done>0?Math.round(correct/done*100):null };
  }), [tests, appData.sessions]);

  const dailyPoolSize = useMemo(() => tests.reduce((sum, t) => {
    const sess = appData.sessions[t.id];
    if (!sess) return sum + t.questions.length;
    const done = sess.answers.filter(a => a !== null).length;
    if (done >= sess.questions.length) return sum;
    return sum + sess.answers.filter(a => a === null).length;
  }, 0), [tests, appData.sessions]);

  const totalAnswered = testStats.reduce((s,ts)=>s+ts.done, 0);
  const totalQs       = testStats.reduce((s,ts)=>s+ts.total, 0);
  const totalCorrect  = testStats.reduce((s,ts)=>s+ts.correct, 0);
  const overallScore  = totalAnswered > 0 ? Math.round(totalCorrect/totalAnswered*100) : null;
  const allTestsDone  = tests.length > 0 && tests.every(t => { const s=appData.sessions[t.id]; return s&&s.answers.every(a=>a!==null); });
  const t = T(dark);

  if (loading || (currentUser && !progressLoaded)) {
    return el('div', { style: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, background:t.bg } },
      el('p', { style: { fontSize:17, color:t.textSub, fontWeight:400, letterSpacing:'-0.374px' } }, loading ? 'Loading RCDD Quiz…' : 'Loading your progress…')
    );
  }
  if (fetchError) {
    return el('div', { style: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, gap:12, background:t.bg } },
      el('p', { style: { fontSize:21, fontWeight:600, color:'#dc2626', textAlign:'center', letterSpacing:'0.231px' } }, 'Could not load questions'),
      el('p', { style: { fontSize:17, color:t.textSub, textAlign:'center', letterSpacing:'-0.374px' } }, 'Check your internet connection and refresh.'),
      el('button', { onClick:()=>window.location.reload(), style: { marginTop:16, background:BLUE, color:'#fff', border:'none', borderRadius:9999, padding:'11px 28px', fontSize:17, fontWeight:400, letterSpacing:'-0.374px' } }, 'Refresh')
    );
  }
  if (!currentUser) return el(AuthScreen, { onSignIn:signIn, onSignUp:signUp, onGuest:signInAsGuest, loading:authLoading, error:authError, dark });

  const session = activeTest ? (appData.sessions[activeTest]||null) : null;

  return el('div', { style: { minHeight:'100vh', background:t.bg, fontFamily:"'SF Pro Text','SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflowX:'hidden' } },
    !isOnline && el('div', { style: { position:'fixed', top:0, left:'50%', transform:'translateX(-50%)', zIndex:100, background:'#1d1d1f', color:'#fff', fontSize:12, fontWeight:400, padding:'5px 14px', borderRadius:'0 0 10px 10px', letterSpacing:'-0.12px' } }, 'Offline — changes will sync when reconnected'),
    el(SideMenu, { open:menuOpen, onClose:()=>setMenuOpen(false), history:appData.history, totalAnswered, totalQs, totalCorrect, overallScore, currentUser, dark, onSignOut:signOut, onSync:syncProgress, syncing, syncMsg, versionErr }),
    screen==='home' && el(HomeScreen, { tests, testStats, overallScore, totalAnswered, totalQs, dailyStats:appData.dailyStats, onSelect:id=>{setSessionMode('normal');setActiveTest(id);getOrCreateSession(id);setScreen('test');}, onMenu:()=>setMenuOpen(true), onReshuffleAll:reshuffleAll, allTestsDone, onFocusSession:startFocusSession, onCustomQuiz:()=>setScreen('custom'), onDailyQuiz:startDailySession, dailyPoolSize, onResetTest:resetTest, dark, onToggleDark:toggleDark, tablet, onToggleTablet:toggleTablet }),
    screen==='custom' && el(CustomQuizScreen, { questions, appData, onStart:startCustomSession, onBack:()=>setScreen('home'), dark }),
    screen==='test' && session && el(TestScreen, { key:activeTest+'_'+(session.mode||'normal'), testId:activeTest, session, starred:appData.starred, wrongCounts:appData.wrongCounts, onAnswer:answer, onConfidence:setConfidence, onStar:toggleStar, onBack:()=>setScreen('home'), onFinish:(avgTime)=>finishTest(activeTest,avgTime), dark, tablet }),
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

  return el('div', { style: { background:t.cardAlt, borderRadius:18, padding:'12px 14px', marginBottom:14, border:'1px solid '+t.border } },
    el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 } },
      el('span', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px' } }, 'Session Chart'),
      el('div', { style: { display:'flex', gap:8 } },
        el('div', { style: { display:'flex', alignItems:'center', gap:3 } },
          el('div', { style: { width:12, height:2, background:BLUE, borderRadius:1 } }),
          el('span', { style: { fontSize:9, color:t.textSub } }, 'Attempted')
        ),
        el('div', { style: { display:'flex', alignItems:'center', gap:3 } },
          el('div', { style: { width:12, height:2, background:'#059669', borderRadius:1 } }),
          el('span', { style: { fontSize:9, color:t.textSub } }, 'Correct')
        ),
        el('div', { style: { display:'flex', alignItems:'center', gap:3 } },
          el('div', { style: { width:12, height:2, background:'#dc2626', borderRadius:1 } }),
          el('span', { style: { fontSize:9, color:t.textSub } }, 'Wrong')
        )
      )
    ),
    el('svg', { width:'100%', viewBox:'0 0 '+W+' '+H, style:{ display:'block', overflow:'visible' } },
      [0, 0.5, 1].map((frac, gi) => el('g', { key:'g'+gi },
        el('line', { x1:PL, y1:yOf(maxVal*frac), x2:W-PR, y2:yOf(maxVal*frac), stroke:t.borderLight, strokeWidth:0.5 }),
        el('text', { x:PL-3, y:yOf(maxVal*frac)+3, textAnchor:'end', fontSize:7, fill:t.textMuted }, String(Math.round(maxVal*frac)))
      )),
      el('polyline', { points:attemptedPts, fill:'none', stroke:BLUE, strokeWidth:1.5, strokeLinejoin:'round', strokeLinecap:'round' }),
      el('polyline', { points:correctPts,   fill:'none', stroke:'#059669', strokeWidth:1.5, strokeLinejoin:'round', strokeLinecap:'round' }),
      el('polyline', { points:wrongPts,     fill:'none', stroke:'#dc2626', strokeWidth:1.5, strokeLinejoin:'round', strokeLinecap:'round' }),
      data.map((d, i) => {
        const x = xOf(i);
        const ya = yOf(d.total);
        const yc = yOf(d.correct);
        const yw = yOf(d.total - d.correct);
        const dateStr = new Date(d.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
        return el('g', { key:'pt'+i },
          el('circle', { cx:x, cy:ya, r:2.5, fill:BLUE }),
          el('circle', { cx:x, cy:yc, r:2.5, fill:'#059669' }),
          el('circle', { cx:x, cy:yw, r:2.5, fill:'#dc2626' }),
          (i===0||i===data.length-1) ? el('text', { x:x, y:H-2, textAnchor:'middle', fontSize:7, fill:t.textMuted }, dateStr) : null
        );
      })
    )
  );
}

// ── Side Menu ─────────────────────────────────────────────────────────────────
function SideMenu({ open, onClose, history, totalAnswered, totalQs, totalCorrect, overallScore, currentUser, dark, onSignOut, onSync, syncing, syncMsg, versionErr }) {
  const t = T(dark);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  const accuracy   = totalAnswered > 0 ? Math.round(totalCorrect/totalAnswered*100) : 0;
  const completion = totalQs > 0 ? Math.round(totalAnswered/totalQs*100) : 0;
  const bestScore  = history.length ? Math.max(...history.map(h=>h.pct)) : null;
  const avgScore   = history.length ? Math.round(history.reduce((s,h)=>s+h.pct,0)/history.length) : null;
  const timedSessions = history.filter(h=>h.avgTime);
  const globalAvgTime = timedSessions.length ? Math.round(timedSessions.reduce((s,h)=>s+h.avgTime,0)/timedSessions.length) : null;

  const stats = [
    { label:'Avg Time', val: globalAvgTime!==null?globalAvgTime+'s':'—', color:'#0284c7' },
    { label:'Accuracy', val: accuracy+'%',                               color:'#059669' },
    { label:'Progress', val: completion+'%',                             color:'#d97706' },
    { label:'Sessions', val: history.length,                             color:'#0891b2' },
    { label:'Best',     val: bestScore!==null?bestScore+'%':'—',         color:'#dc2626' },
    { label:'Average',  val: avgScore!==null?avgScore+'%':'—',           color:'#9333ea' },
  ];

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const daySessions = history.filter(h => new Date(h.date).toDateString() === key);
    const correct = daySessions.reduce((s, h) => s + h.correct, 0);
    const total   = daySessions.reduce((s, h) => s + h.total,   0);
    const pct     = total > 0 ? Math.round(correct / total * 100) : null;
    const timed   = daySessions.filter(h => h.avgTime);
    const avgTime = timed.length ? Math.round(timed.reduce((s, h) => s + h.avgTime, 0) / timed.length) : null;
    return { key, d, correct, total, pct, avgTime };
  });

  return el('div', null,
    open && el('div', { onClick:onClose, style: { position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:40 } }),
    el('div', { style: { position:'fixed', top:0, left:0, height:'100vh', width:288, background:t.card, zIndex:50, overflowY:'auto', transition:'transform 0.28s ease', transform: open?'translateX(0)':'translateX(-100%)', boxShadow:'6px 0 32px rgba(0,0,0,0.18)', paddingBottom:60 } },
      el('div', { style: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'56px 18px 14px', borderBottom:'1px solid '+t.border } },
        el('span', { style: { fontSize:22, fontWeight:600, color:t.text, letterSpacing:'-0.374px' } }, 'Analytics'),
        el('button', { onClick:onClose, style: { background:t.pill, border:'1px solid '+t.border, borderRadius:9999, width:30, height:30, fontSize:14, color:t.textSub } }, '✕')
      ),
      el('div', { style: { padding:'14px 18px 0' } },
        currentUser.isGuest
          ? el('div', { style: { background:t.cardAlt, borderRadius:18, padding:'10px 12px', marginBottom:14, border:'1px solid '+t.border } },
              el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px', marginBottom:6 } }, 'Guest Mode'),
              el('div', { style: { fontSize:13, color:t.textSub, letterSpacing:'-0.224px', marginBottom:10 } }, 'Progress is not saved.'),
              el('button', { onClick:onSignOut, style: { width:'100%', background:BLUE, color:'#fff', border:'none', borderRadius:9999, padding:'8px 14px', fontSize:13, fontWeight:400, cursor:'pointer', letterSpacing:'-0.224px' } }, 'Sign In / Create Account')
            )
          : el('div', null,
              el('div', { style: { display:'flex', alignItems:'center', justifyContent:'space-between', background:t.cardAlt, borderRadius:18, padding:'10px 12px', marginBottom:14, border:'1px solid '+t.border } },
                el('div', null,
                  el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px' } }, 'Signed in as'),
                  el('div', { style: { fontSize:14, fontWeight:600, color:t.text, marginTop:2, letterSpacing:'-0.224px' } }, currentUser.username)
                ),
                el('button', { onClick:onSignOut, style: { background:'#fff1f2', border:'1px solid #fca5a5', borderRadius:9999, padding:'6px 14px', fontSize:12, fontWeight:400, color:'#dc2626', cursor:'pointer', letterSpacing:'-0.12px' } }, 'Sign Out')
              ),
              el('button', {
                onClick: onSync, disabled: syncing,
                style: { width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7, background: syncing ? t.cardAlt : '#f0fdf4', border:'1px solid '+(syncing?t.border:'#86efac'), borderRadius:9999, padding:'9px 12px', fontSize:13, fontWeight:400, letterSpacing:'-0.224px', color: syncing ? t.textMuted : '#16a34a', cursor: syncing ? 'default' : 'pointer', marginBottom:14 }
              },
                syncing ? 'Syncing…' : syncMsg ? syncMsg : 'Sync Progress'
              ),
              versionErr && el('p', { style: { fontSize:12, color:'#dc2626', textAlign:'center', marginTop:-10, marginBottom:10, letterSpacing:'-0.12px' } }, versionErr)
            ),
        el('p', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px', marginBottom:10 } }, 'Overall'),
        el('div', { style: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 } },
          ...stats.map(s => el('div', { key:s.label, style: { background:t.cardAlt, borderRadius:18, padding:'10px 12px', border:'1px solid '+t.border } },
            el('div', { style: { fontSize:20, fontWeight:600, color:s.color, lineHeight:1, letterSpacing:'-0.374px' } }, s.val),
            el('div', { style: { fontSize:12, color:t.textMuted, fontWeight:400, marginTop:3, letterSpacing:'-0.12px' } }, s.label)
          ))
        ),
        el('div', { style: { background:t.cardAlt, borderRadius:18, padding:'12px 14px', marginBottom:14, border:'1px solid '+t.border } },
          el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:6 } },
            el('span', { style: { fontSize:13, color:t.textSub, letterSpacing:'-0.224px' } }, 'Completion'),
            el('span', { style: { fontSize:13, fontWeight:600, color:BLUE, letterSpacing:'-0.224px' } }, totalAnswered+'/'+totalQs)
          ),
          el('div', { style: { height:4, background:t.borderLight, borderRadius:2, overflow:'hidden' } },
            el('div', { style: { height:'100%', background:BLUE, borderRadius:2, width:completion+'%', transition:'width 0.5s' } })
          )
        ),
        el(SessionChart, { history, dark }),
        el('div', null,
          el('p', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px', margin:'14px 0 10px' } }, 'Last 7 Days'),
          ...last7.map(({ key, d, correct, total, pct, avgTime }, i) => {
            const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short' });
            const pctColor = pct === null ? t.textMuted : pct >= 80 ? '#059669' : pct >= 60 ? '#d97706' : '#dc2626';
            return el('div', { key, style: { display:'flex', alignItems:'center', gap:8, paddingBottom:9, borderBottom:'1px solid '+t.border } },
              el('span', { style: { fontSize:13, color: pct===null ? t.textMuted : t.textSub, flex:1, letterSpacing:'-0.224px' } }, label),
              pct === null
                ? el('span', { style: { fontSize:13, color:t.textMuted } }, '—')
                : el('div', { style: { display:'flex', alignItems:'center', gap:6 } },
                    el('span', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px' } }, correct+' / '+total),
                    el('span', { style: { fontSize:13, fontWeight:600, color:pctColor, letterSpacing:'-0.224px', minWidth:34, textAlign:'right' } }, pct+'%'),
                    avgTime && el('span', { style: { fontSize:11, background:dark?'#1d2f3f':'#f0f9ff', color:BLUE, borderRadius:9999, padding:'2px 7px', letterSpacing:'-0.12px' } }, avgTime+'s avg')
                  )
            );
          })
        ),
        el('div', { style: { textAlign:'center', marginTop:20, paddingTop:14, borderTop:'1px solid '+t.border } },
          el('span', { style: { fontSize:12, color:t.textMuted, fontWeight:400, letterSpacing:'-0.12px' } },
            'v' + APP_VERSION.major + '.' + APP_VERSION.minor + '  ·  RCDD Exam Prep'
          )
        )
      )
    )
  );
}

// ── Home Screen ───────────────────────────────────────────────────────────────
const DAILY_TARGET = 100;
function HomeScreen({ tests, testStats, overallScore, totalAnswered, totalQs, dailyStats, onSelect, onMenu, onReshuffleAll, allTestsDone, onFocusSession, onCustomQuiz, onDailyQuiz, dailyPoolSize, onResetTest, dark, onToggleDark, tablet, onToggleTablet }) {
  const t = T(dark);
  const pct = totalQs > 0 ? Math.round(totalAnswered/totalQs*100) : 0;
  const [resetConfirm, setResetConfirm] = useState(null);

  const today = new Date().toDateString();
  const todayCorrect = (dailyStats && dailyStats.date === today) ? dailyStats.correct : 0;
  const dailyPct = Math.min(Math.round(todayCorrect/DAILY_TARGET*100), 100);
  const dailyDone = todayCorrect >= DAILY_TARGET;

  return el('div', { style: { minHeight:'100vh', background:t.bg, display:'flex', flexDirection:'column' } },
    el('div', { style: { background:t.card, borderBottom:'1px solid '+t.border, padding:'52px 20px 14px', display:'flex', alignItems:'center', gap:14 } },
      el('button', { onClick:onMenu, style: { background:'none', border:'none', padding:4, display:'flex', flexDirection:'column', gap:5 } },
        el('span', { style: { display:'block', width:22, height:2.5, background:t.text, borderRadius:2 } }),
        el('span', { style: { display:'block', width:22, height:2.5, background:t.text, borderRadius:2 } }),
        el('span', { style: { display:'block', width:22, height:2.5, background:t.text, borderRadius:2 } })
      ),
      el('div', { style: { flex:1 } },
        el('div', { style: { fontSize:12, fontWeight:400, color:t.textMuted, letterSpacing:'-0.12px' } }, 'BICSI · RCDD'),
        el('h1', { style: { fontSize:24, fontWeight:600, color:t.text, letterSpacing:'-0.374px' } }, 'Practice Test')
      ),
      el('button', { onClick:onToggleDark, title: dark?'Switch to light':'Switch to dark', style: { background:t.pill, border:'1px solid '+t.border, borderRadius:9999, width:38, height:38, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, lineHeight:1 } }, dark ? '☀' : '☽'),
      el('div', { style: { textAlign:'right' } },
        el('div', { style: { fontSize:24, fontWeight:600, color:t.blue, lineHeight:1, letterSpacing:'-0.374px' } }, overallScore!==null?overallScore+'%':'—'),
        el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px' } }, 'score')
      )
    ),
    el('div', { style: { padding:'12px 20px 10px', background:t.card } },
      el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:5 } },
        el('span', { style: { fontSize:14, color:t.textSub, letterSpacing:'-0.224px' } }, 'Overall Progress'),
        el('span', { style: { fontSize:14, fontWeight:600, color:t.blue, letterSpacing:'-0.224px' } }, totalAnswered+' / '+totalQs)
      ),
      el('div', { style: { height:4, background:t.borderLight, borderRadius:2, overflow:'hidden', marginBottom:10 } },
        el('div', { style: { height:'100%', background:BLUE, borderRadius:2, width:pct+'%' } })
      ),
      el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:5 } },
        el('span', { style: { fontSize:14, color:t.textSub, letterSpacing:'-0.224px' } }, dailyDone ? 'Daily Target Complete' : 'Daily Target'),
        el('span', { style: { fontSize:14, fontWeight:600, color:'#059669', letterSpacing:'-0.224px' } }, todayCorrect+' / '+DAILY_TARGET)
      ),
      el('div', { style: { height:4, background:t.borderLight, borderRadius:2, overflow:'hidden' } },
        el('div', { style: { height:'100%', background:'#059669', borderRadius:2, width:dailyPct+'%', transition:'width 0.5s' } })
      )
    ),
    el('div', { style: { flex:1, padding:'16px 20px', overflowY:'auto' } },
      el('div', { style: { display:'flex', gap:10, marginBottom:8 } },
        el('button', { onClick:onCustomQuiz, style: { flex:1, background:BLUE, color:'#fff', border:'none', borderRadius:9999, padding:'11px 22px', fontSize:14, fontWeight:400, letterSpacing:'-0.224px', display:'flex', alignItems:'center', justifyContent:'center', gap:7, cursor:'pointer' } }, 'Custom Quiz'),
        allTestsDone && el('button', { onClick:onFocusSession, style: { flex:1, background:BLUE, color:'#fff', border:'none', borderRadius:9999, padding:'11px 22px', fontSize:14, fontWeight:400, letterSpacing:'-0.224px', display:'flex', alignItems:'center', justifyContent:'center', gap:7, cursor:'pointer' } }, 'Focus Session')
      ),
      dailyPoolSize > 0 && el('button', { onClick:onDailyQuiz, style: { width:'100%', background:'transparent', border:'1px solid '+BLUE, borderRadius:9999, padding:'11px 22px', fontSize:14, fontWeight:400, color:BLUE, letterSpacing:'-0.224px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginBottom:14 } },
        'Daily Quiz'
      ),
      dailyPoolSize === 0 && el('div', { style: { marginBottom:14 } }),
      el('div', { style: { fontSize:12, fontWeight:400, color:t.textMuted, letterSpacing:'-0.12px', marginBottom:12 } }, 'Select a Test'),
      ...tests.map(test => {
        const ts = testStats.find(x=>x.testId===test.id)||{done:0,correct:0,total:test.questions.length,pct:null};
        const totalQsInChapter = test.questions.length;
        const isComplete = ts.done===totalQsInChapter && ts.done>0;
        const fillPct = totalQsInChapter>0 ? (ts.done/totalQsInChapter*100) : 0;
        const isConfirming = resetConfirm===test.id;
        const scorePctColor = ts.pct!==null ? (ts.pct>=80?'#059669':ts.pct>=60?'#d97706':'#dc2626') : t.border;
        return el('div', { key:test.id, style: { marginBottom:9, position:'relative' } },
          el('button', { onClick:()=>{ if(!isConfirming) onSelect(test.id); }, style: { width:'100%', background:t.card, border:'1px solid '+t.border, borderRadius:18, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, textAlign:'left', opacity:isConfirming?0.5:1, cursor:'pointer', borderLeft:'4px solid '+(isComplete?t.blue:'transparent') } },
            el('div', { style: { width:38, height:38, borderRadius:11, background:t.cardAlt, color:t.text, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:600, flexShrink:0, letterSpacing:'-0.224px' } }, test.id),
            el('div', { style: { flex:1, minWidth:0 } },
              el('div', { style: { display:'flex', alignItems:'center', gap:6, marginBottom:2 } },
                el('span', { style: { fontSize:14, fontWeight:600, color:t.text, letterSpacing:'-0.224px' } }, test.name)
              ),
              el('div', { style: { fontSize:12, color:t.textMuted, marginBottom:5, letterSpacing:'-0.12px' } }, ts.done+'/'+totalQsInChapter+' questions'),
              el('div', { style: { height:3, background:t.borderLight, borderRadius:2, overflow:'hidden' } },
                el('div', { style: { height:'100%', background:t.blue, borderRadius:2, width:fillPct+'%' } })
              )
            ),
            el('div', { style: { textAlign:'right', flexShrink:0 } },
              ts.pct!==null
                ? el('div', { style: { fontSize:17, fontWeight:600, color:scorePctColor, lineHeight:1, letterSpacing:'-0.374px' } }, ts.pct+'%')
                : el('div', { style: { fontSize:13, color:t.border, lineHeight:1 } }, '—')
            ),
            el('button', { onClick:e=>{ e.stopPropagation(); setResetConfirm(test.id); }, style: { background:'none', border:'none', fontSize:16, color:t.textMuted, padding:'4px', flexShrink:0, lineHeight:1 }, title:'Reset this test' }, '↺'),
            !isConfirming && el('span', { style: { fontSize:20, color:t.border } }, '›')
          ),
          isConfirming && el('div', { style: { position:'absolute', bottom:-1, left:0, right:0, background:t.card, border:'1px solid #fca5a5', borderRadius:'0 0 18px 18px', padding:'8px 14px', display:'flex', alignItems:'center', gap:8, zIndex:2 } },
            el('span', { style: { fontSize:14, fontWeight:400, color:t.text, flex:1, letterSpacing:'-0.224px' } }, 'Reset this test?'),
            el('button', { onClick:()=>{ onResetTest(test.id); setResetConfirm(null); }, style: { background:'#dc2626', color:'#fff', border:'none', borderRadius:9999, padding:'5px 14px', fontSize:13, fontWeight:400 } }, 'Reset'),
            el('button', { onClick:()=>setResetConfirm(null), style: { background:'transparent', color:t.textSub, border:'1px solid '+t.border, borderRadius:9999, padding:'5px 12px', fontSize:13, fontWeight:400 } }, 'Cancel')
          )
        );
      }),
      el('button', { onClick:onReshuffleAll, style: { width:'100%', background:'transparent', border:'1px solid '+t.border, borderRadius:9999, padding:'11px 22px', fontSize:14, fontWeight:400, color:t.textSub, letterSpacing:'-0.224px', marginTop:4, cursor:'pointer' } }, 'Reshuffle All Tests')
    )
  );
}

// ── Timer Row ─────────────────────────────────────────────────────────────────
function TimerRow({ timerSec, timerRunning, color, t, onToggle }) {
  const tc = timerSec > 30 ? color : timerSec > 15 ? '#d97706' : '#dc2626';
  const pct = (timerSec / 60) * 100;
  const label = '0:' + String(timerSec).padStart(2, '0');
  const icon = timerRunning ? '‖' : (timerSec <= 0 ? '↺' : '▶');
  return el('button', { onClick: onToggle, style: { margin:'8px 18px 0', background:t.card, border:'1px solid '+tc+'55', borderRadius:18, padding:'7px 14px', display:'flex', alignItems:'center', gap:10, width:'calc(100% - 36px)', cursor:'pointer' } },
    el('span', { style: { fontSize:15, color:tc, lineHeight:1 } }, icon),
    el('span', { style: { fontSize:14, fontWeight:600, color:tc, fontVariantNumeric:'tabular-nums', minWidth:32, letterSpacing:'-0.224px' } }, label),
    el('div', { style: { flex:1, height:4, background:t.borderLight, borderRadius:2, overflow:'hidden' } },
      el('div', { style: { height:'100%', width:pct+'%', background:tc, borderRadius:2, transition:'width 1s linear, background 0.3s' } })
    )
  );
}

// ── Test Screen ───────────────────────────────────────────────────────────────
function TestScreen({ testId, session, starred, wrongCounts, onAnswer, onConfidence, onStar, onBack, onFinish, dark, tablet }) {
  const t = T(dark);
  const [qIdx, setQIdx] = useState(() => {
    const first = session.answers.findIndex(a => a === null);
    return first === -1 ? 0 : first;
  });
  const [showJump, setShowJump] = useState(false);
  const [timerSec, setTimerSec] = useState(60);
  const [timerRunning, setTimerRunning] = useState(true);
  const timingsRef = useRef([]);
  const [eliminated, setEliminated] = useState(new Set());

  const color = t.blue;
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
  const sessionLabel = session.mode==='focus'?'🎯 FOCUS SESSION':session.mode==='review'?'✗ REVIEW MODE':session.mode==='custom'?'✦ CUSTOM QUIZ':session.mode==='daily'?'◆ DAILY QUIZ':'TEST '+testId;

  useEffect(() => { setTimerSec(60); setTimerRunning(!isAnswered); setEliminated(new Set()); }, [qIdx]);
  useEffect(() => { if (isAnswered) setTimerRunning(false); }, [isAnswered]);
  useEffect(() => {
    if (!timerRunning || timerSec <= 0) return;
    const id = setTimeout(() => setTimerSec(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [timerRunning, timerSec]);

  return el('div', { style: { minHeight:'100vh', background:t.bg, display:'flex', flexDirection:'column' } },
    el('div', { style: { background:t.card, borderBottom:'1px solid '+t.border, padding:'52px 14px 10px', display:'flex', alignItems:'center', gap:10 } },
      el('button', { onClick:onBack, style: { background:'none', border:'none', fontSize:24, color:t.textSub, lineHeight:1, padding:'0 4px' } }, '‹'),
      el('div', { style: { flex:1 } },
        el('div', { style: { fontSize:12, fontWeight:400, color:t.textMuted, letterSpacing:'-0.12px' } }, sessionLabel),
        el('div', { style: { fontSize:14, fontWeight:400, color:t.textSub, letterSpacing:'-0.224px' } }, q.testName||q.chapter||'')
      ),
      el('button', { onClick:()=>setShowJump(s=>!s), style: { background:showJump?t.blue:'transparent', border:'1px solid '+(showJump?t.blue:t.border), borderRadius:9999, padding:'5px 14px', fontSize:12, fontWeight:400, letterSpacing:'-0.12px', color:showJump?'#fff':t.textSub } }, showJump?'Close':doneCount+'/'+qs.length)
    ),
    showJump && el('div', { style: { background:t.cardAlt, padding:'12px 16px 10px', borderBottom:'1px solid '+t.border } },
      el('div', { style: { display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 } },
        ...qs.map((qq,i) => {
          const done=ans[i]!==null, correct=done&&ans[i]===qq.a, isCurr=i===qIdx;
          return el('button', { key:qq.id, onClick:()=>{setQIdx(i);setShowJump(false);}, style: { width:34, height:30, borderRadius:7, border:'1.5px solid '+(isCurr?color:starred.includes(qq.id)?'#f59e0b':correct?'#059669':done?'#dc2626':t.border), background:isCurr?color:correct?'#ecfdf5':done?'#fef2f2':t.card, color:isCurr?'#fff':correct?'#059669':done?'#dc2626':t.textSub, fontSize:10, fontWeight:600 } }, i+1);
        })
      ),
      el('div', { style: { display:'flex', gap:12, flexWrap:'wrap' } },
        ...[ ['#ecfdf5','#059669','Correct'], ['#fef2f2','#dc2626','Wrong'], [t.card,t.border,'Not yet'] ].map(([bg,br,lbl]) =>
          el('div', { key:lbl, style:{ display:'flex', alignItems:'center', gap:4 } },
            el('div', { style:{ width:9, height:9, borderRadius:2, background:bg, border:'1.5px solid '+br } }),
            el('span', { style:{ fontSize:10, color:t.textSub, letterSpacing:'-0.12px' } }, lbl)
          )
        )
      )
    ),
    el('div', { style: { height:3, background:t.borderLight } },
      el('div', { style: { height:'100%', background:color, width:progress+'%', transition:'width 0.4s', borderRadius:'0 2px 2px 0' } })
    ),
    el(TimerRow, { timerSec, timerRunning, color:t.blue, t, onToggle: () => {
      if (timerSec <= 0) { setTimerSec(60); setTimerRunning(true); }
      else setTimerRunning(r => !r);
    }}),
    el('div', { style: { margin:'10px 18px 0', background:t.card, borderRadius:18, padding:'16px', border:'1px solid '+t.border } },
      el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 } },
        el('div', { style: { display:'flex', alignItems:'center', gap:8 } },
          el('span', { style: { fontSize:12, fontWeight:400, color:t.textMuted, letterSpacing:'-0.12px' } }, 'Q'+(qIdx+1)+' of '+qs.length),
          wrongCount>0 && el('span', { style: { fontSize:11, fontWeight:600, background:'#fff1f2', color:'#dc2626', borderRadius:9999, padding:'2px 9px', letterSpacing:'-0.12px' } }, wrongCount+'x wrong')
        ),
        el('button', { onClick:()=>onStar(q.id), style: { background:'none', border:'none', fontSize:20, color:starred.includes(q.id)?'#f59e0b':t.border, padding:0 } }, starred.includes(q.id)?'★':'☆')
      ),
      el('p', { style: { fontSize:17, fontWeight:400, color:t.text, lineHeight:1.47, letterSpacing:'-0.374px' } }, q.q)
    ),
    !isAnswered && el('div', { style: { margin:'10px 18px 0' } },
      el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px', marginBottom:6 } }, 'How confident are you?'),
      el('div', { style: { display:'flex', gap:7 } },
        [['Sure','#059669','#ecfdf5'],['Unsure','#d97706','#fffbeb'],['Guessing','#dc2626','#fef2f2']].map(([label,tc,bg]) =>
          el('button', { key:label, onClick:()=>onConfidence(testId,qIdx,label.toLowerCase()), style: { flex:1, padding:'8px 4px', borderRadius:9999, border:'1.5px solid '+(confs[qIdx]===label.toLowerCase()?tc:t.border), background:confs[qIdx]===label.toLowerCase()?bg:t.card, color:confs[qIdx]===label.toLowerCase()?tc:t.textMuted, fontSize:13, fontWeight:400, letterSpacing:'-0.224px' } }, label)
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
        const isElim = !isAnswered && eliminated.has(i);
        return el('div', { key:i, style: { display:'flex', alignItems:'stretch', gap:8 } },
          el('div', { style: { flex:1, minWidth:0 } },
            el('button', { onClick:()=>{ if(!isAnswered){ timingsRef.current[qIdx]=Math.max(1,60-timerSec); onAnswer(testId,qIdx,i); } }, style: { display:'flex', alignItems:'center', gap:10, border:'1px solid '+border, borderRadius:12, padding:'12px', textAlign:'left', width:'100%', background:bg, color:col, opacity: isElim ? 0.4 : 1 } },
              el('span', { style: { minWidth:24, height:24, borderRadius:6, background:lbg, color:lc, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 } }, LABELS[i]),
              el('span', { style: { fontSize:15, lineHeight:1.47, flex:1, textDecoration: isElim ? 'line-through' : 'none', letterSpacing:'-0.224px' } }, opt),
              isAnswered && i===q.a && el('span', { style: { marginLeft:'auto', fontSize:14 } }, '✓'),
              isAnswered && i===selected && i!==q.a && el('span', { style: { marginLeft:'auto', fontSize:14 } }, '✗')
            )
          ),
          !isAnswered && el('button', { onClick: () => setEliminated(prev => { const s=new Set(prev); s.has(i)?s.delete(i):s.add(i); return s; }), style: { background:'none', border:'none', color:isElim?'#dc2626':t.textMuted, fontSize:18, padding:'0 6px', display:'flex', alignItems:'center', flexShrink:0 } }, isElim ? '✕' : '⊘')
        );
      })
    ),
    isAnswered && el('div', { style: { margin:'12px 18px 0', background:t.card, borderRadius:18, padding:'13px', border:'1px solid '+t.border } },
      el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:5 } },
        el('span', { style: { fontSize:14, fontWeight:600, color:selected===q.a?'#059669':'#dc2626', letterSpacing:'-0.224px' } }, selected===q.a?'Correct':'Incorrect'),
        el('span', { style: { fontSize:13, color:t.textMuted, letterSpacing:'-0.224px' } }, 'Answer: '+LABELS[q.a])
      ),
      confs[qIdx] && el('div', { style: { marginBottom:6, display:'flex', gap:6, alignItems:'center' } },
        el('span', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px' } }, 'Confidence:'),
        el('span', { style: { fontSize:12, fontWeight:600, padding:'2px 9px', borderRadius:9999, letterSpacing:'-0.12px', background:confs[qIdx]==='sure'?'#ecfdf5':confs[qIdx]==='unsure'?'#fffbeb':'#fef2f2', color:confs[qIdx]==='sure'?'#059669':confs[qIdx]==='unsure'?'#d97706':'#dc2626' } }, confs[qIdx].charAt(0).toUpperCase()+confs[qIdx].slice(1)),
        selected!==q.a && confs[qIdx]==='sure' && el('span', { style: { fontSize:12, fontWeight:600, color:'#dc2626', background:'#fff1f2', borderRadius:9999, padding:'2px 9px', letterSpacing:'-0.12px' } }, 'Danger Gap')
      ),
      el('p', { style: { fontSize:14, color:t.textSub, lineHeight:1.47, letterSpacing:'-0.224px' } }, q.w)
    ),
    isAnswered && q.k && q.k.length > 0 && el('div', { style: { margin:'8px 18px 0', background:dark?'#252527':'#f5f5f7', borderRadius:18, padding:'13px', border:'1px solid '+t.border } },
      el('div', { style: { fontSize:12, fontWeight:600, color:t.blue, letterSpacing:'-0.12px', marginBottom:8 } }, 'Key Concepts'),
      el('div', { style: { display:'flex', flexDirection:'column', gap:7 } },
        ...q.k.map((concept, ci) => el('div', { key:ci, style: { display:'flex', gap:8, alignItems:'flex-start' } },
          el('span', { style: { color:t.blue, fontWeight:600, fontSize:13, flexShrink:0, lineHeight:1.5 } }, '•'),
          el('p', { style: { fontSize:14, color:t.text, lineHeight:1.47, margin:0, letterSpacing:'-0.224px' } }, concept)
        ))
      )
    ),
    el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px 44px', marginTop:'auto' } },
      el('button', { onClick:()=>qIdx>0&&setQIdx(i=>i-1), disabled:qIdx===0, style: { background:'transparent', border:'1px solid '+t.border, borderRadius:9999, padding:'9px 20px', fontSize:14, fontWeight:400, letterSpacing:'-0.224px', color:t.textSub, opacity:qIdx===0?0.35:1 } }, '← Prev'),
      allDone
        ? el('button', { onClick:()=>{ const v=timingsRef.current.filter(x=>x!=null); onFinish(v.length?Math.round(v.reduce((s,x)=>s+x,0)/v.length):null); }, style: { background:color, color:'#fff', border:'none', borderRadius:9999, padding:'10px 24px', fontSize:14, fontWeight:400, letterSpacing:'-0.224px' } }, 'Finish')
        : isAnswered && qIdx<qs.length-1
          ? el('button', { onClick:()=>setQIdx(i=>i+1), style: { background:color, color:'#fff', border:'none', borderRadius:9999, padding:'10px 24px', fontSize:14, fontWeight:400, letterSpacing:'-0.224px' } }, 'Next')
          : el('div')
    )
  );

}

// ── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({ testId, session, onBack, onRetry, onReshuffle, onHome, dark }) {
  const t = T(dark);
  const isSpecial = testId==='focus'||testId==='review'||testId==='custom'||testId==='daily';
  const color = t.blue;
  const light = dark ? t.blue+'22' : '#e8f0fb';
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
        ? el('div', { style: { fontSize:14, fontWeight:600, color:t.textMuted, marginBottom:8, letterSpacing:'-0.224px' } }, testId==='focus'?'Focus Session':testId==='custom'?'Custom Quiz':testId==='daily'?'Daily Quiz':'Review Mode')
        : el('div', { style: { width:44, height:44, borderRadius:11, background:t.blue+'18', color:t.blue, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:600, marginBottom:8, letterSpacing:'-0.374px' } }, testId),
      el('div', { style: { fontSize:56, fontWeight:600, color:t.text, lineHeight:1.07, letterSpacing:'-0.28px' } }, pct, el('span', { style: { fontSize:24 } }, '%')),
      el('div', { style: { fontSize:17, fontWeight:400, color:grade.color, marginTop:6, letterSpacing:'-0.374px' } }, grade.label.replace(/\s[\S]+$/, '')),
      el('div', { style: { fontSize:14, color:t.textSub, marginTop:4, letterSpacing:'-0.224px' } }, score+' of '+qs.length+' correct')
    ),
    (dangerGaps.length>0||wrongGuessing.length>0) && el('div', { style: { margin:'14px 18px 0', background:t.card, borderRadius:18, padding:'16px', border:'1px solid '+t.border } },
      el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px', marginBottom:12 } }, 'Confidence Analysis'),
      dangerGaps.length>0 && el('div', { style: { marginBottom:10, background:'#fff1f2', borderRadius:12, padding:'10px 12px', border:'1px solid #fca5a5' } },
        el('div', { style: { fontSize:14, fontWeight:600, color:'#dc2626', marginBottom:6, letterSpacing:'-0.224px' } }, 'Danger Gaps — Wrong but Sure ('+dangerGaps.length+')'),
        el('div', { style: { fontSize:13, color:'#7a7a7a', marginBottom:8, letterSpacing:'-0.224px' } }, 'You were confident but incorrect. These need attention.'),
        ...dangerGaps.map(q=>el('div', { key:q.id, style: { fontSize:13, color:'#7f1d1d', padding:'4px 0', borderTop:'1px solid #fee2e2', letterSpacing:'-0.224px' } }, '• '+q.q.substring(0,60)+(q.q.length>60?'…':'')))
      ),
      wrongGuessing.length>0 && el('div', { style: { background:'#fef3c7', borderRadius:12, padding:'10px 12px', border:'1px solid #fde68a' } },
        el('div', { style: { fontSize:14, fontWeight:600, color:'#92400e', marginBottom:6, letterSpacing:'-0.224px' } }, 'Wrong while Guessing ('+wrongGuessing.length+')'),
        el('div', { style: { fontSize:13, color:'#92400e', marginBottom:4, letterSpacing:'-0.224px' } }, 'You knew you were uncertain — review these to build confidence.'),
        ...wrongGuessing.map(q=>el('div', { key:q.id, style: { fontSize:13, color:'#78350f', padding:'3px 0', letterSpacing:'-0.224px' } }, '• '+q.q.substring(0,60)+(q.q.length>60?'…':'')))
      )
    ),
    el('div', { style: { margin:'14px 18px 0', background:t.card, borderRadius:18, padding:'16px', border:'1px solid '+t.border } },
      el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px', marginBottom:12 } }, 'Topic Breakdown'),
      ...chapters.map(c => el('div', { key:c.ch, style: { marginBottom:10 } },
        el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:4 } },
          el('span', { style: { fontSize:14, fontWeight:400, color:t.textSub, letterSpacing:'-0.224px' } }, c.ch),
          el('span', { style: { fontSize:14, fontWeight:600, color:c.pct>=80?'#059669':c.pct>=60?'#d97706':'#dc2626', letterSpacing:'-0.224px' } }, c.pct+'%')
        ),
        el('div', { style: { height:4, background:t.borderLight, borderRadius:2, overflow:'hidden' } },
          el('div', { style: { height:'100%', background:c.pct>=80?'#059669':c.pct>=60?'#d97706':'#dc2626', borderRadius:2, width:c.pct+'%', transition:'width 0.5s' } })
        )
      ))
    ),
    el('div', { style: { margin:'14px 18px 0', background:t.card, borderRadius:18, padding:'16px', border:'1px solid '+t.border } },
      el('div', { style: { fontSize:12, color:t.textMuted, letterSpacing:'-0.12px', marginBottom:10 } }, 'Question Review'),
      ...qs.map((q,i) => {
        const correct=ans[i]===q.a, conf=confs[i], isDangerGap=!correct&&conf==='sure';
        return el('div', { key:q.id, style: { border:'1px solid '+(isDangerGap?'#fca5a5':correct?(dark?'#2a4a2a':'#e0f0e0'):(dark?'#4a2a2a':'#f5e0e0')), borderRadius:12, padding:'10px', marginBottom:8, background:isDangerGap?(dark?'#3b0d0d':'#fff5f5'):correct?(dark?'#1a2e1a':'#f8fef8'):(dark?'#2d0a0a':'#fef8f8') } },
          el('div', { style: { display:'flex', gap:8 } },
            el('span', { style: { minWidth:20, height:20, borderRadius:5, background:correct?'#059669':'#dc2626', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600, flexShrink:0, marginTop:1 } }, correct?'✓':'✗'),
            el('div', null,
              el('p', { style: { fontSize:13, fontWeight:400, color:t.text, lineHeight:1.47, marginBottom:3, letterSpacing:'-0.224px' } }, q.q),
              conf && el('span', { style: { fontSize:11, fontWeight:600, padding:'1px 8px', borderRadius:9999, marginBottom:4, display:'inline-block', letterSpacing:'-0.12px', background:conf==='sure'?'#ecfdf5':conf==='guessing'?'#fef2f2':'#fffbeb', color:conf==='sure'?'#059669':conf==='guessing'?'#dc2626':'#d97706' } }, conf.charAt(0).toUpperCase()+conf.slice(1)),
              isDangerGap && el('span', { style: { fontSize:11, fontWeight:600, padding:'1px 8px', borderRadius:9999, background:'#fee2e2', color:'#dc2626', marginLeft:4, letterSpacing:'-0.12px' } }, 'Danger Gap'),
              !correct && el('p', { style: { fontSize:12, color:'#dc2626', marginBottom:2, marginTop:3, letterSpacing:'-0.12px' } }, 'Your answer: '+(ans[i]!==null?LABELS[ans[i]]+'. '+q.o[ans[i]]:'—')),
              el('p', { style: { fontSize:12, color:'#059669', letterSpacing:'-0.12px' } }, 'Correct: '+LABELS[q.a]+'. '+q.o[q.a])
            )
          )
        );
      })
    ),
    el('div', { style: { padding:'12px 18px', display:'flex', flexDirection:'column', gap:9 } },
      !isSpecial && el('button', { onClick:onReshuffle, style: { width:'100%', background:color, color:'#fff', border:'none', borderRadius:9999, padding:'14px 22px', fontSize:17, fontWeight:400, letterSpacing:'-0.374px' } }, 'Reshuffle & Retry'),
      el('button', { onClick:onHome, style: { width:'100%', background:'transparent', color:t.textSub, border:'1px solid '+t.border, borderRadius:9999, padding:'13px 22px', fontSize:14, fontWeight:400, letterSpacing:'-0.224px' } }, 'All Tests')
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
