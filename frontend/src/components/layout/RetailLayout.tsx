import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearRetailToken } from '../../lib/retailAuth';

export function RetailLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearRetailToken();
    navigate('/retail/login', { replace: true });
  };

  const linkClass = (path: string) =>
    `px-3 py-2 rounded text-sm font-medium ${
      location.pathname === path
        ? 'bg-accent-solid text-accent-text-contrast'
        : 'text-text-muted hover:bg-element-hover-bg hover:text-text-contrast'
    }`;

  return (
    <div className="min-h-screen bg-app-bg text-text-contrast">
      <header className="border-b border-border-subtle bg-element-bg">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Retail POS</h1>
            <span className="rounded bg-element-hover-bg px-2 py-1 text-xs font-semibold text-text-muted">
              RETAIL MODE
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-element-hover-bg hover:text-text-contrast"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1200px] gap-6 px-4 py-4">
        <aside className="hidden w-56 shrink-0 flex-col gap-2 md:flex">
          <Link to="/retail/dashboard" className={linkClass('/retail/dashboard')}>
            Ticket Desk
          </Link>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
