import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { useTheme } from './lib/theme';
import { APP_INFO, APP_VERSION } from './lib/app-info';
import { sourceManifest } from './lib/data';
import AppMark from './components/AppMark';
import Home from './pages/Home';
import NewTemplate from './pages/NewTemplate';
import Projects from './pages/Projects';
import Review from './pages/Review';
import Explorer from './pages/Explorer';
import Docs from './pages/Docs';
import About from './pages/About';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/new', label: 'New Template' },
  { path: '/projects', label: 'Projects' },
  { path: '/explorer', label: 'Patterns' },
  { path: '/docs', label: 'Docs' },
  { path: '/about', label: 'About' },
];

export default function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="logo" title={APP_INFO.tagline}>
          <span className="logo-icon" aria-hidden="true">
            <AppMark className="logo-mark" />
          </span>
          <span className="logo-text">
            <span className="logo-name">{APP_INFO.name}</span>
            <span className="logo-tagline">{APP_INFO.tagline}</span>
          </span>
        </Link>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '\u{1F319}' : '\u{2600}'}
          </button>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewTemplate />} />
          <Route path="/new/:projectId" element={<NewTemplate />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/review/:projectId" element={<Review />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <div className="app-footer-brand">
          <span className="app-footer-name">{APP_INFO.name}</span>
          <span className="badge badge-version" title={`Build: ${APP_INFO.buildLabel}`}>
            {APP_VERSION}
          </span>
        </div>
        <p className="app-footer-tagline">{APP_INFO.tagline}</p>
        <p className="app-footer-meta">
          &copy; {APP_INFO.organisation} &mdash; Authored by{' '}
          <span className="app-footer-author">{APP_INFO.author}</span> &mdash; Evidence synced{' '}
          {sourceManifest.evidenceSyncDate}
        </p>
      </footer>
    </div>
  );
}
