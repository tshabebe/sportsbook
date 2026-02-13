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
    <div className="flex min-h-screen justify-center bg-app-bg text-text-contrast">
      <div className="flex w-full max-w-[1200px] gap-4 px-3 py-4 md:gap-6 md:px-4">
        <aside className="flex h-fit w-28 shrink-0 self-start flex-col gap-3 rounded-xl border border-border-subtle bg-element-bg p-2 md:w-44">
          <div className="flex flex-col gap-1">
            <Link to="/retail/dashboard?tab=work" className={tabClass('work')}>
              Work
            </Link>
            <Link to="/retail/dashboard?tab=data" className={tabClass('data')}>
              Data
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium text-text-muted transition hover:bg-element-hover-bg hover:text-text-contrast"
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
