"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc" | null;

export interface SortState<K extends string = string> {
    key: K | null;
    dir: SortDir;
}

interface SortableThProps<K extends string> {
    label: string;
    sortKey: K;
    sort: SortState<K>;
    onSort: (key: K) => void;
    className?: string;
    align?: "left" | "right";
}

export function SortableTh<K extends string>({ label, sortKey, sort, onSort, className = "", align = "left" }: SortableThProps<K>) {
    const active = sort.key === sortKey && sort.dir !== null;
    const dir = active ? sort.dir : null;
    return (
        <th className={className}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={`flex items-center gap-1.5 uppercase font-black tracking-widest text-[10px] transition-colors ${
                    active ? "text-primary" : "text-text-main/40 hover:text-text-main/70"
                } ${align === "right" ? "ml-auto" : ""}`}
            >
                <span>{label}</span>
                {dir === "asc" ? (
                    <ChevronUp size={12} strokeWidth={3} />
                ) : dir === "desc" ? (
                    <ChevronDown size={12} strokeWidth={3} />
                ) : (
                    <ChevronsUpDown size={12} strokeWidth={2.5} className="opacity-50" />
                )}
            </button>
        </th>
    );
}

export function nextSortDir(current: SortDir): SortDir {
    if (current === null) return "asc";
    if (current === "asc") return "desc";
    return null;
}

export function compareValues(a: any, b: any): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    const sa = String(a).toLowerCase();
    const sb = String(b).toLowerCase();
    return sa < sb ? -1 : sa > sb ? 1 : 0;
}
