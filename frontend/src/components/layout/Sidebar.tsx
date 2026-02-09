import { useState } from 'react';
import { ChevronDown, ChevronRight, Search, Trophy, Wand2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  to?: string;
  children?: SidebarItem[];
}

const sidebarItems: SidebarItem[] = [
  { id: 'search', label: 'Main Feed', icon: <Search size={16} />, to: '/play' },
  {
    id: 'sportsbook',
    label: 'Sportsbook',
    icon: <Trophy size={16} />,
    children: [
      { id: 'football', label: 'Football', icon: <ChevronRight size={16} />, to: '/play' },
      { id: 'track', label: 'Track Ticket', icon: <ChevronRight size={16} />, to: '/play/track' },
    ],
  },
  {
    id: 'ux-lab',
    label: 'Feed Iterations',
    icon: <Wand2 size={16} />,
    children: [
      { id: 'ux-1', label: 'Iteration 1', icon: <ChevronRight size={16} />, to: '/play/1' },
      { id: 'ux-2', label: 'Iteration 2', icon: <ChevronRight size={16} />, to: '/play/2' },
      { id: 'ux-3', label: 'Iteration 3', icon: <ChevronRight size={16} />, to: '/play/3' },
      { id: 'ux-4', label: 'Iteration 4', icon: <ChevronRight size={16} />, to: '/play/4' },
      { id: 'ux-5', label: 'Iteration 5', icon: <ChevronRight size={16} />, to: '/play/5' },
    ],
  },
];

export function Sidebar() {
  const [expandedItems, setExpandedItems] = useState<string[]>(['sportsbook', 'ux-lab']);

  const toggleItem = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const renderItem = (item: SidebarItem, depth = 0) => {
    const isExpanded = expandedItems.includes(item.id);
    const hasChildren = Boolean(item.children?.length);

    return (
      <div key={item.id}>
        <div style={{ paddingLeft: `${16 + depth * 12}px` }}>
          {item.to ? (
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-accent-solid text-accent-text-contrast font-semibold shadow-sm'
                    : 'text-text-muted hover:bg-element-hover-bg hover:text-text-contrast'
                }`
              }
              onClick={() => {
                if (hasChildren) toggleItem(item.id);
              }}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </span>
              {hasChildren ? (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                />
              ) : null}
            </NavLink>
          ) : (
            <button
              onClick={() => hasChildren && toggleItem(item.id)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-text-muted transition-colors hover:bg-element-hover-bg hover:text-text-contrast"
            >
              <span className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </span>
              {hasChildren ? (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                />
              ) : null}
            </button>
          )}
        </div>

        {hasChildren && isExpanded ? (
          <div className="animate-in slide-in-from-top-2 duration-200">
            {item.children?.map((child) => renderItem(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="hidden h-full w-[240px] flex-col overflow-y-auto border-r border-border-subtle bg-element-bg md:flex">
      <div className="py-2">{sidebarItems.map((item) => renderItem(item))}</div>
    </aside>
  );
}
