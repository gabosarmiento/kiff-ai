import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search as SearchIcon, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GroupedOption {
  label: string;
  value: string;
  group?: string;
}

interface OptionGroup {
  group: string;
  options: GroupedOption[];
}

interface SearchableDropdownProps {
  label?: string;
  value: string;
  options: GroupedOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Group options by group label
  const grouped: OptionGroup[] = React.useMemo(() => {
    const map: Record<string, GroupedOption[]> = {};
    options.forEach(opt => {
      const group = opt.group || '';
      if (!map[group]) map[group] = [];
      map[group].push(opt);
    });
    return Object.entries(map).map(([group, opts]) => ({ group, options: opts }));
  }, [options]);

  // Filtered options
  const filtered = grouped.map(g => ({
    group: g.group,
    options: g.options.filter(opt =>
      opt.label.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(g => g.options.length > 0);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setHighlight(h => Math.min(h + 1, filtered.flatMap(g => g.options).length - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setHighlight(h => Math.max(h - 1, 0));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        const flat = filtered.flatMap(g => g.options);
        if (flat[highlight]) {
          onChange(flat[highlight].value);
          setOpen(false);
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, highlight, onChange]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset highlight on open/search
  useEffect(() => { setHighlight(0); }, [open, search]);

  const selected = options.find(opt => opt.value === value);

  return (
    <div className={cn('w-full', className)} ref={ref}>
      {label && <label className="block text-xs font-semibold mb-1">{label}</label>}
      <button
        className="w-full flex items-center justify-between px-3 py-2 rounded border text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        type="button"
      >
        <span className="truncate text-left flex-1">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="w-4 h-4 ml-2" />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-md shadow-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <SearchIcon className="w-4 h-4 text-slate-400" />
            <input
              className="w-full bg-transparent outline-none text-sm"
              placeholder="Search Models..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="max-h-64 overflow-auto py-1" tabIndex={-1} role="listbox">
            {filtered.length === 0 && (
              <li className="px-4 py-2 text-sm text-slate-400">No results</li>
            )}
            {filtered.map((g, gi) => (
              <React.Fragment key={g.group}>
                {g.group && (
                  <li className="px-4 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                    {g.group}
                  </li>
                )}
                {g.options.map((opt, oi) => {
                  const idx = filtered.slice(0, gi).reduce((acc, gg) => acc + gg.options.length, 0) + oi;
                  return (
                    <li
                      key={opt.value}
                      className={cn(
                        'flex items-center px-4 py-2 text-sm cursor-pointer',
                        idx === highlight ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                        opt.value === value && 'font-semibold'
                      )}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => { onChange(opt.value); setOpen(false); }}
                      role="option"
                      aria-selected={opt.value === value}
                    >
                      <span className="flex-1 truncate">{opt.label}</span>
                      {opt.value === value && <Check className="w-4 h-4 text-blue-500 ml-2" />}
                    </li>
                  );
                })}
              </React.Fragment>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
