import { Outlet, useNavigate } from 'react-router-dom';
import { clearAdminToken } from '../../lib/adminAuth';

export function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAdminToken();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-app-bg text-text-contrast">
      <header className="border-b border-border-subtle bg-element-bg">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Admin Console</h1>
            <span className="rounded bg-element-hover-bg px-2 py-1 text-xs font-semibold text-text-muted">
              ADMIN MODE
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

      <main className="mx-auto max-w-[1280px] px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
