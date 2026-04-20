import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = isAdmin ? (
    <>
      <Link to="/admin" style={s.navLink} onClick={() => setMenuOpen(false)}>Dashboard</Link>
      <Link to="/admin/events" style={s.navLink} onClick={() => setMenuOpen(false)}>Events</Link>
      <Link to="/admin/players" style={s.navLink} onClick={() => setMenuOpen(false)}>Players</Link>
      <Link to="/admin/settings/email" style={s.navLink} onClick={() => setMenuOpen(false)}>Settings</Link>
    </>
  ) : (
    <>
      <Link to="/events" style={s.navLink} onClick={() => setMenuOpen(false)}>Events</Link>
      <Link to="/my-decks" style={s.navLink} onClick={() => setMenuOpen(false)}>My Decks</Link>
      <Link to="/stats" style={s.navLink} onClick={() => setMenuOpen(false)}>My Stats</Link>
      <Link to="/change-password" style={s.navLink} onClick={() => setMenuOpen(false)}>Change Password</Link>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1a1a2e' }}>
      <nav style={s.nav}>
        <Link to={isAdmin ? '/admin' : '/events'} style={s.brand}>MTG Event Tracker</Link>

        {isMobile ? (
          <button style={s.hamburger} onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            <span style={s.bar} />
            <span style={s.bar} />
            <span style={s.bar} />
          </button>
        ) : (
          <div style={s.navLinks}>
            {navLinks}
            <span style={s.username}>{user?.username}</span>
            <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>
          </div>
        )}
      </nav>

      {isMobile && menuOpen && (
        <div style={s.mobileMenu}>
          {navLinks}
          <span style={{ ...s.username, padding: '12px 0', borderTop: '1px solid #334155' }}>{user?.username}</span>
          <button onClick={handleLogout} style={s.mobileLogoutBtn}>Logout</button>
        </div>
      )}

      <main style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', height: '56px', backgroundColor: '#16213e', borderBottom: '2px solid #a855f7', position: 'sticky', top: 0, zIndex: 100 },
  brand: { color: '#a855f7', textDecoration: 'none', fontWeight: 'bold', fontSize: '16px', whiteSpace: 'nowrap' },
  navLinks: { display: 'flex', alignItems: 'center', gap: '16px' },
  navLink: { color: '#e2e8f0', textDecoration: 'none', fontSize: '14px', padding: '4px 0' },
  username: { color: '#a855f7', fontSize: '14px' },
  logoutBtn: { background: 'transparent', border: '1px solid #a855f7', color: '#a855f7', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  hamburger: { background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px' },
  bar: { display: 'block', width: '22px', height: '2px', backgroundColor: '#a855f7', borderRadius: '2px' },
  mobileMenu: { backgroundColor: '#16213e', borderBottom: '1px solid #334155', padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  mobileLogoutBtn: { background: 'transparent', border: '1px solid #a855f7', color: '#a855f7', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', marginTop: '8px', textAlign: 'center' },
};
