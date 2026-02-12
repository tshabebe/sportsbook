import { Menu, Plus, User } from 'lucide-react';
import {
  Menu as AriaMenu,
  MenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useWalletProfile } from '../../hooks/useWallet';
import { formatCurrency } from '../../config/currency';
import logo from '../../assets/logo.png';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data } = useWalletProfile();
  const navigate = useNavigate();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle bg-element-bg px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Main menu" onPress={onMenuClick}>
          <Menu size={20} />
        </Button>
        <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-text-contrast">{formatCurrency(data?.balance ?? 0)}</span>
        <Button variant="solid" size="sm" className="h-8 w-8 !px-0 rounded-full" aria-label="Top up">
          <Plus size={18} />
        </Button>

        <MenuTrigger>
          <Button variant="solid" size="sm" className="h-8 w-8 !px-0 rounded-full" aria-label="Account menu">
            <User size={18} />
          </Button>
          <Popover className="rounded-lg border border-border-subtle bg-element-bg p-1 shadow-lg data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95">
            <AriaMenu
              aria-label="Account actions"
              className="min-w-44 outline-none"
              onAction={(key) => {
                if (key === 'track') navigate('/play/track');
                if (key === 'retail') navigate('/retail/login');
              }}
            >
              <MenuItem id="track" className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg">
                Track Ticket
              </MenuItem>
              <MenuItem id="retail" className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg">
                Retail Desk
              </MenuItem>
            </AriaMenu>
          </Popover>
        </MenuTrigger>
      </div>
    </header>
  );
}
