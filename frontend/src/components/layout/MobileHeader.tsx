import { Battery, Menu, Signal, User, Wifi } from 'lucide-react';
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

export function MobileHeader() {
  const { data } = useWalletProfile();
  const navigate = useNavigate();

  return (
    <header className="flex flex-col border-b border-border-subtle bg-element-bg md:hidden">
      <div className="flex items-center justify-between px-4 py-1 text-[10px] text-text-muted">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <Signal size={10} />
          <Wifi size={10} />
          <Battery size={10} />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Menu size={20} className="text-text-contrast" />
          <img src={logo} alt="Logo" className="h-22 w-auto object-contain" />
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-element-hover-bg p-1 pl-2">
          <span className="text-xs font-medium text-text-contrast">{formatCurrency(data?.balance ?? 0)}</span>
          <Button variant="solid" size="sm" className="h-6 w-6 !px-0 rounded-md" aria-label="Top up">
            <span className="text-lg leading-none">+</span>
          </Button>
          <MenuTrigger>
            <Button variant="outline" size="sm" className="h-6 w-6 !px-0 rounded-md" aria-label="User menu">
              <User size={12} />
            </Button>
            <Popover className="rounded-lg border border-border-subtle bg-element-bg p-1 shadow-lg data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95">
              <AriaMenu
                aria-label="Mobile account actions"
                className="min-w-40 outline-none"
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
      </div>
    </header>
  );
}
