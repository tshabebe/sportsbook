import { useState } from 'react';
import {
  Cell,
  Column,
  Row,
  Tab,
  Table,
  TableBody,
  TableHeader,
  TabList,
  Tabs,
} from 'react-aria-components';
import { Trophy } from 'lucide-react';
import { formatCurrency } from '../config/currency';

export interface LeaderboardEntry {
  id: string;
  rank: number;
  player: string;
  numberOfWins: number;
  amount: string;
}

const leaderboardAmount = formatCurrency(7500);
const mockData: LeaderboardEntry[] = [
  { id: '1', rank: 1, player: 'Player', numberOfWins: 27165, amount: leaderboardAmount },
  { id: '2', rank: 2, player: 'Player', numberOfWins: 27165, amount: leaderboardAmount },
  { id: '3', rank: 3, player: 'Player', numberOfWins: 27165, amount: leaderboardAmount },
  { id: '4', rank: 4, player: 'Player', numberOfWins: 27165, amount: leaderboardAmount },
  { id: '5', rank: 5, player: 'Player', numberOfWins: 27165, amount: leaderboardAmount },
  { id: '6', rank: 6, player: 'Player', numberOfWins: 27165, amount: leaderboardAmount },
  { id: '7', rank: 7, player: 'Player', numberOfWins: 27165, amount: leaderboardAmount },
  { id: '8', rank: 8, player: 'Username', numberOfWins: 27165, amount: leaderboardAmount },
  { id: '9', rank: 9, player: 'Username', numberOfWins: 27165, amount: leaderboardAmount },
  { id: '10', rank: 10, player: 'Username', numberOfWins: 27165, amount: leaderboardAmount },
];

export function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'all-time' | 'today' | 'this-week' | 'this-month'>('all-time');

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-element-bg">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <Trophy size={20} className="text-accent-solid" />
        <h2 className="font-semibold text-text-contrast">Leaderboard</h2>
      </div>

      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as typeof activeTab)}>
        <TabList aria-label="Leaderboard range" className="flex border-b border-border-subtle">
          <Tab
            id="all-time"
            className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-muted outline-none transition data-[selected]:border-accent-solid data-[selected]:text-accent-solid"
          >
            All Time
          </Tab>
          <Tab
            id="today"
            className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-muted outline-none transition data-[selected]:border-accent-solid data-[selected]:text-accent-solid"
          >
            Today
          </Tab>
          <Tab
            id="this-week"
            className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-muted outline-none transition data-[selected]:border-accent-solid data-[selected]:text-accent-solid"
          >
            This Week
          </Tab>
          <Tab
            id="this-month"
            className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-muted outline-none transition data-[selected]:border-accent-solid data-[selected]:text-accent-solid"
          >
            This Month
          </Tab>
        </TabList>
      </Tabs>

      <div className="overflow-x-auto">
        <Table aria-label="Top winners table" className="w-full text-left">
          <TableHeader className="bg-element-hover-bg/50">
            <Column isRowHeader className="px-4 py-3 text-sm font-medium text-text-muted">
              Rank
            </Column>
            <Column className="px-4 py-3 text-sm font-medium text-text-muted">Player</Column>
            <Column className="px-4 py-3 text-sm font-medium text-text-muted">Number of wins</Column>
            <Column className="px-4 py-3 text-sm font-medium text-text-muted">Amount</Column>
          </TableHeader>
          <TableBody items={mockData}>
            {(item) => (
              <Row className="border-b border-border-subtle transition-colors last:border-0 hover:bg-element-hover-bg">
                <Cell className="px-4 py-3 text-sm text-text-contrast">
                  <div className="flex items-center gap-2">
                    {item.rank <= 3 && <Trophy size={16} className="text-accent-solid" />}
                    <span className={item.rank <= 3 ? 'font-bold text-text-contrast' : 'text-text-contrast'}>
                      #{item.rank}
                    </span>
                  </div>
                </Cell>
                <Cell className="px-4 py-3 text-sm text-text-contrast">{item.player}</Cell>
                <Cell className="px-4 py-3 text-sm text-text-contrast">{item.numberOfWins.toLocaleString()}</Cell>
                <Cell className="px-4 py-3 text-sm text-text-contrast">{item.amount}</Cell>
              </Row>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
