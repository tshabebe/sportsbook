import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearRetailToken } from '../../lib/retailAuth';

export function RetailLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = new URLSearchParams(location.search).get('tab') === 'data' ? 'data' : 'work';

  const handleLogout = () => {
    clearRetailToken();
    navigate('/retail/login', { replace: true });
  };

  const tabClass = (tab: 'work' | 'data') =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition ${
      currentTab === tab
        ? 'bg-accent-solid text-accent-text-contrast'
        : 'text-text-muted hover:bg-element-hover-bg hover:text-text-contrast'
    }`;

  return (
    <div className="min-h-screen bg-app-bg text-text-contrast">
      <div className="mx-auto flex max-w-[1200px] gap-4 px-3 py-4 md:gap-6 md:px-4">
        <aside className="h-fit w-28 shrink-0 self-start rounded-xl border border-border-subtle bg-element-bg p-2 md:w-44">
          <div className="space-y-1">
            <Link to="/retail/dashboard?tab=work" className={tabClass('work')}>
              Work
            </Link>
            <Link to="/retail/dashboard?tab=data" className={tabClass('data')}>
              Data
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium text-text-muted transition hover:bg-element-hover-bg hover:text-text-contrast"
          >
            Logout
          </button>
        </aside>

        <main className="min-w-0 flex-1">
          <div key={`${location.pathname}${location.search}`} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
