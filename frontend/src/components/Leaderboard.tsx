import { useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
    type SortingState,
} from "@tanstack/react-table";
import { Trophy } from "lucide-react";
import { cn } from "../lib/utils";

export interface LeaderboardEntry {
    rank: number;
    player: string;
    numberOfWins: number;
    amount: string;
}

const columnHelper = createColumnHelper<LeaderboardEntry>();

const columns = [
    columnHelper.accessor("rank", {
        header: "Rank",
        cell: (info) => (
            <div className="flex items-center gap-2">
                {info.getValue() <= 3 && <Trophy size={16} className="text-accent-solid" />}
                <span className={info.getValue() <= 3 ? "text-text-contrast font-bold" : "text-text-contrast"}>
                    #{info.getValue()}
                </span>
            </div>
        ),
    }),
    columnHelper.accessor("player", {
        header: "Player",
        cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("numberOfWins", {
        header: "Number of wins",
        cell: (info) => info.getValue().toLocaleString(),
    }),
    columnHelper.accessor("amount", {
        header: "Amount",
        cell: (info) => info.getValue(),
    }),
];

const mockData: LeaderboardEntry[] = [
    { rank: 1, player: "Player", numberOfWins: 27165, amount: "7,500.00€" },
    { rank: 2, player: "Player", numberOfWins: 27165, amount: "7,500.00€" },
    { rank: 3, player: "Player", numberOfWins: 27165, amount: "7,500.00€" },
    { rank: 4, player: "Player", numberOfWins: 27165, amount: "7,500.00€" },
    { rank: 5, player: "Player", numberOfWins: 27165, amount: "7,500.00€" },
    { rank: 6, player: "Player", numberOfWins: 27165, amount: "7,500.00€" },
    { rank: 7, player: "Player", numberOfWins: 27165, amount: "7,500.00€" },
    { rank: 8, player: "Username", numberOfWins: 27165, amount: "7,500.00€" },
    { rank: 9, player: "Username", numberOfWins: 27165, amount: "7,500.00€" },
    { rank: 10, player: "Username", numberOfWins: 27165, amount: "7,500.00€" },
];

export function Leaderboard() {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [activeTab, setActiveTab] = useState<"all-time" | "today" | "this-week" | "this-month">("all-time");

    const table = useReactTable({
        data: mockData,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <div className="bg-element-bg rounded-lg overflow-hidden border border-border-subtle flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
                <Trophy size={20} className="text-accent-solid" />
                <h2 className="text-text-contrast font-semibold">Leaderboard</h2>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border-subtle">
                {(
                    [
                        { key: "all-time", label: "All Time" },
                        { key: "today", label: "Today" },
                        { key: "this-week", label: "This Week" },
                        { key: "this-month", label: "This Month" },
                    ] as const
                ).map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                            "px-4 py-2 text-sm font-medium transition-colors border-b-2 outline-none",
                            activeTab === tab.key
                                ? "text-accent-solid border-accent-solid bg-element-hover-bg/20"
                                : "text-text-muted border-transparent hover:text-text-contrast hover:bg-element-hover-bg"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-element-hover-bg/50">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-4 py-3 text-text-muted text-sm font-medium"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map((row) => (
                            <tr
                                key={row.id}
                                className="border-b last:border-0 border-border-subtle hover:bg-element-hover-bg transition-colors"
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="px-4 py-3 text-text-contrast text-sm">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
