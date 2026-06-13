/* ft-app.jsx — root: device chooser, global theme state + the circular
   view-transition theme reveal. Mounts MobileApp / DesktopApp. */
const { useState: aUseState, useEffect: aUseEffect, useRef: aUseRef } = React;

function Stage({ frameW, frameH, children }) {
  const [scale, setScale] = aUseState(1);
  aUseEffect(() => {
    const f = () => setScale(Math.min(1, (window.innerWidth - 32) / frameW, (window.innerHeight - 104) / frameH));
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, [frameW, frameH]);
  return (
    <div style={{ width: frameW * scale, height: frameH * scale }}>
      <div style={{ width: frameW, height: frameH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}

function App() {
  const [mode, setMode] = aUseState('dark');
  const [device, setDevice] = aUseState('mobile');

  aUseEffect(() => { document.documentElement.dataset.theme = mode; }, []);

  const toggleTheme = (e) => {
    const next = mode === 'dark' ? 'light' : 'dark';
    const x = (e && e.clientX) || window.innerWidth - 60;
    const y = (e && e.clientY) || 60;
    const end = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const apply = () => { ReactDOM.flushSync(() => setMode(next)); document.documentElement.dataset.theme = next; };
    if (!document.startViewTransition) { apply(); return; }
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 640, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  };

  return (
    <div className="ft" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* chooser bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'center', padding: '16px 16px 10px' }}>
        <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 8px 8px 18px', borderRadius: 999, boxShadow: 'var(--shadow-2)' }}>
          <span className="serif" style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>Mehta Family</span>
          <span className="mono" style={{ fontSize: 9.5, letterSpacing: '.16em', color: 'var(--mute)', textTransform: 'uppercase', borderLeft: '1px solid var(--line)', paddingLeft: 14 }}>reimagined</span>
          <Segmented size="sm" value={device} onChange={setDevice} icons={{ mobile: 'user', desktop: 'grid' }} options={[['mobile', 'Mobile'], ['desktop', 'Desktop']]} />
          <ThemeToggle mode={mode} onToggle={toggleTheme} tone="glass" />
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '4px 16px 28px' }}>
        <div key={device} className="anim-scaleIn">
          {device === 'mobile'
            ? <Stage frameW={400} frameH={862}><MobileApp mode={mode} toggleTheme={toggleTheme} /></Stage>
            : <Stage frameW={1200} frameH={760}><DesktopApp mode={mode} toggleTheme={toggleTheme} /></Stage>}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
