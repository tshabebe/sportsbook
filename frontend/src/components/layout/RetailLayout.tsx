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
        ? 'bg-[#1f3b2c] text-[#9be8b3]'
        : 'text-[#d2d7e0] hover:bg-[#1d2230]'
    }`;

  return (
    <div className="min-h-screen bg-[#0f131a] text-[#f1f5f9]">
      <header className="border-b border-[#263041] bg-[#121824]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Retail POS</h1>
            <span className="rounded bg-[#1f3b2c] px-2 py-1 text-xs font-semibold text-[#9be8b3]">
              RETAIL MODE
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded border border-[#3b475d] px-3 py-1.5 text-xs font-medium text-[#d2d7e0] hover:bg-[#1d2230]"
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

