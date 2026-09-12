import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  useGetCorridor,
  useGetCorridors,
  useGetDashboardSummary,
  getGetCorridorQueryKey,
  getGetCorridorsQueryKey,
  getGetDashboardSummaryQueryKey,
} from '@workspace/api-client-react';
import type { Corridor } from '@workspace/api-client-react';
import { CSVLink } from 'react-csv';
import {
  Activity,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowUpRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Download,
  FileText,
  Filter,
  Gauge,
  GitCompareArrows,
  Info,
  Layers3,
  MapPinned,
  Menu,
  Moon,
  Network,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const COLORS = {
  teal: '#1a776b',
  amber: '#e9a12b',
  blue: '#357db1',
  red: '#bd5148',
  violet: '#7c6da8',
  slate: '#6f8794',
};

const CATEGORY_OPTIONS = [
  { key: 'cafe_score', label: 'Café', whitespace: 'cafe_whitespace' },
  { key: 'qsr_score', label: 'QSR', whitespace: 'qsr_whitespace' },
  { key: 'fast_casual_score', label: 'Fast Casual', whitespace: 'fast_casual_whitespace' },
  { key: 'fitness_score', label: 'Fitness', whitespace: 'fitness_whitespace' },
  { key: 'beauty_wellness_score', label: 'Beauty & Wellness', whitespace: 'beauty_wellness_whitespace' },
  { key: 'grocery_convenience_score', label: 'Grocery / Convenience', whitespace: 'grocery_convenience_whitespace' },
] as const;

const DIMENSIONS = [
  { key: 'neighborhood_momentum', label: 'Momentum' },
  { key: 'timing_alpha', label: 'Timing alpha' },
  { key: 'halo_strength', label: 'Halo strength' },
  { key: 'shock_resilience', label: 'Shock resilience' },
  { key: 'safety_day', label: 'Day safety' },
  { key: 'qsr_whitespace', label: 'QSR whitespace' },
] as const;

const INTERVAL_OPTIONS = [
  { label: 'Every 5 min', ms: 5 * 60 * 1000 },
  { label: 'Every 15 min', ms: 15 * 60 * 1000 },
  { label: 'Every 1 hour', ms: 60 * 60 * 1000 },
  { label: 'Every 24 hours', ms: 24 * 60 * 60 * 1000 },
];

function score(value: number | undefined) {
  if (value === undefined || value === null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
}

function scoreText(value: number | undefined) {
  return value === undefined || value === null ? '—' : `${score(value).toFixed(0)}`;
}

function average(rows: Corridor[], key: keyof Corridor) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + score(Number(row[key])), 0) / rows.length;
}

function csvRows(rows: Corridor[]) {
  return rows.map((row) => ({
    corridor_name: row.corridor_name,
    district: row.district,
    opportunity_score: score(row.opportunity_score).toFixed(1),
    dominant_audience: row.dominant_audience,
    neighborhood_momentum: score(row.neighborhood_momentum).toFixed(1),
    cafe_whitespace: score(row.cafe_whitespace).toFixed(1),
    qsr_whitespace: score(row.qsr_whitespace).toFixed(1),
    fast_casual_whitespace: score(row.fast_casual_whitespace).toFixed(1),
    fitness_whitespace: score(row.fitness_whitespace).toFixed(1),
    beauty_wellness_whitespace: score(row.beauty_wellness_whitespace).toFixed(1),
    grocery_convenience_whitespace: score(row.grocery_convenience_whitespace).toFixed(1),
  }));
}

function formatTime(timestamp: number) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function scoreTone(value: number) {
  const n = score(value);
  if (n >= 72) return 'high';
  if (n >= 48) return 'mid';
  return 'low';
}

function ExportButton({ data, filename, label = 'Export CSV' }: { data: unknown[]; filename: string; label?: string }) {
  if (!data.length) return null;
  return (
    <CSVLink
      data={data}
      filename={filename}
      className="print-hidden inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
      aria-label={label}
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">CSV</span>
    </CSVLink>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`data-card ${className}`}>{children}</section>;
}

function PanelHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
      <div>
        {eyebrow && <p className="mb-1 font-mono-data text-[10px] uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
        <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">{title}</h2>
        {description && <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'teal',
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  detail: string;
  tone?: 'teal' | 'amber' | 'blue' | 'violet';
}) {
  const toneMap = {
    teal: 'bg-primary/10 text-primary',
    amber: 'bg-accent/15 text-accent-foreground',
    blue: 'bg-[#357db1]/12 text-[#28658f]',
    violet: 'bg-[#7c6da8]/12 text-[#62548d]',
  };
  return (
    <Panel className="relative overflow-hidden p-5 data-card-hover">
      <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full border-[14px] border-primary/5" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-[30px] font-semibold tracking-[-0.06em] text-primary">{value}</p>
          <p className="mt-1 max-w-[190px] text-[11px] leading-4 text-muted-foreground">{detail}</p>
        </div>
        <div className={`rounded-lg p-2 ${toneMap[tone]}`}><Icon className="h-4 w-4" /></div>
      </div>
    </Panel>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function EmptyState({ title, detail, icon: Icon = BarChart3 }: { title: string; detail: string; icon?: typeof BarChart3 }) {
  return (
    <div className="flex min-h-[190px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground"><Icon className="h-5 w-5" /></div>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function HeatBar({ value, compact = false }: { value: number; compact?: boolean }) {
  const n = score(value);
  const background = n >= 70 ? '#e9a12b' : n >= 48 ? '#357db1' : '#9aadb7';
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'min-w-[130px]'}`}>
      <div className={`h-2 flex-1 overflow-hidden rounded-full bg-muted ${compact ? 'max-w-[80px]' : ''}`}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${n}%`, backgroundColor: background }} />
      </div>
      <span className="font-mono-data text-[11px] text-muted-foreground">{n.toFixed(0)}</span>
    </div>
  );
}

function SplitRefresh({
  isDark,
  autoRefresh,
  setAutoRefresh,
  interval,
  setInterval,
  onRefresh,
  isFetching,
}: {
  isDark: boolean;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  interval: number;
  setInterval: (value: number) => void;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const controlStyle = { backgroundColor: isDark ? 'rgba(255,255,255,.1)' : 'hsl(210 30% 92%)', color: isDark ? '#d9e1df' : '#3e535e' };
  return (
    <div className="relative print-hidden" ref={dropdownRef}>
      <div className="flex h-8 items-center overflow-hidden rounded-md text-[11px]" style={controlStyle}>
        <button className="flex h-full items-center gap-1.5 px-2.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50" onClick={onRefresh} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <span className="h-4 w-px bg-current opacity-20" />
        <button className="flex h-full items-center px-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setOpen((value) => !value)} aria-label="Refresh settings">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between rounded-md px-2 py-2">
            <div><p className="text-xs font-medium">Auto-refresh</p><p className="text-[10px] text-muted-foreground">Minimum interval: 5 minutes</p></div>
            <button onClick={() => setAutoRefresh(!autoRefresh)} className={`relative h-5 w-9 rounded-full transition-colors ${autoRefresh ? 'bg-primary' : 'bg-muted'}`} aria-label="Toggle auto-refresh">
              <span className={`absolute top-1 h-3 w-3 rounded-full bg-card transition-transform ${autoRefresh ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="my-1 border-t border-border" />
          {INTERVAL_OPTIONS.map((option) => (
            <button key={option.ms} onClick={() => { setInterval(option.ms); setAutoRefresh(true); setOpen(false); }} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted">
              {option.label}
              {interval === option.ms && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({
  isDark,
  setIsDark,
  autoRefresh,
  setAutoRefresh,
  interval,
  setInterval,
  onRefresh,
  isFetching,
  lastRefreshed,
}: {
  isDark: boolean;
  setIsDark: (value: boolean) => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  interval: number;
  setInterval: (value: number) => void;
  onRefresh: () => void;
  isFetching: boolean;
  lastRefreshed: string | null;
}) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const navItems = [
    { label: 'Market cockpit', icon: Gauge, id: 'market' },
    { label: 'Corridor explorer', icon: Network, id: 'explorer' },
    { label: 'Compare board', icon: GitCompareArrows, id: 'compare' },
  ];
  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileMenu(false);
  };
  return (
    <header className="sticky top-0 z-20 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-3 lg:px-7">
        <div className="flex items-center gap-3">
          <button className="rounded-md p-1.5 text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden" onClick={() => setMobileMenu((value) => !value)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 text-left">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Target className="h-4 w-4" /></span>
            <span><span className="block font-display text-[15px] font-semibold tracking-tight">Corridor<span className="text-sidebar-primary">IQ</span></span><span className="hidden font-mono-data text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/55 sm:block">DFW location intelligence</span></span>
          </button>
        </div>
        <nav className={`${mobileMenu ? 'absolute left-3 right-3 top-[58px] flex' : 'hidden'} flex-col gap-1 rounded-lg border border-sidebar-border bg-sidebar p-2 lg:static lg:flex lg:flex-row lg:items-center lg:border-0 lg:bg-transparent lg:p-0`}>
          {navItems.map((item) => (
            <button key={item.id} onClick={() => jump(item.id)} className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"><item.icon className="h-3.5 w-3.5" />{item.label}</button>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <span className="mr-2 hidden items-center gap-1.5 font-mono-data text-[10px] text-sidebar-foreground/55 xl:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#6dc7a6]" />Prototype dataset</span>
          <SplitRefresh isDark={isDark} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} interval={interval} setInterval={setInterval} onRefresh={onRefresh} isFetching={isFetching} />
          <button onClick={() => window.print()} className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground print-hidden" aria-label="Export as PDF"><Printer className="h-3.5 w-3.5" /></button>
          <button onClick={() => setIsDark(!isDark)} className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground print-hidden" aria-label="Toggle dark mode">{isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}</button>
        </div>
      </div>
      {lastRefreshed && <div className="border-t border-sidebar-border/70 px-4 py-1.5 text-right font-mono-data text-[9px] text-sidebar-foreground/45 lg:px-7">Data refreshed {lastRefreshed}</div>}
    </header>
  );
}

function AppDashboard() {
  const [isDark, setIsDark] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [interval, setInterval] = useState(5 * 60 * 1000);
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All districts');
  const [sortKey, setSortKey] = useState<'opportunity_score' | 'neighborhood_momentum' | 'safety_day' | 'cafe_whitespace'>('opportunity_score');
  const [sortDescending, setSortDescending] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCompare, setSelectedCompare] = useState<string[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]['key']>('cafe_score');
  const [showFilters, setShowFilters] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const corridorQuery = useGetCorridors({
    query: {
      queryKey: getGetCorridorsQueryKey(),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchInterval: autoRefresh ? interval : false,
    },
  });
  const summaryQuery = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchInterval: autoRefresh ? interval : false,
    },
  });
  const detailQuery = useGetCorridor(selectedId || '', {
    query: {
      enabled: Boolean(selectedId),
      queryKey: getGetCorridorQueryKey(selectedId || ''),
      staleTime: 5 * 60 * 1000,
    },
  });

  const corridors = corridorQuery.data ?? [];
  const summary = summaryQuery.data;
  const loading = corridorQuery.isLoading || corridorQuery.isFetching || summaryQuery.isLoading || summaryQuery.isFetching;
  const hasError = corridorQuery.isError || summaryQuery.isError;
  const districts = useMemo(() => ['All districts', ...Array.from(new Set(corridors.map((row) => row.district).filter(Boolean))).sort()], [corridors]);
  const filteredCorridors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return corridors
      .filter((row) => districtFilter === 'All districts' || row.district === districtFilter)
      .filter((row) => !query || [row.corridor_name, row.district, row.dominant_audience, row.character, row.form].join(' ').toLowerCase().includes(query))
      .sort((a, b) => {
        const delta = score(Number(b[sortKey])) - score(Number(a[sortKey]));
        return sortDescending ? delta : -delta;
      });
  }, [corridors, districtFilter, search, sortDescending, sortKey]);
  const topCorridors = useMemo(() => [...corridors].sort((a, b) => score(b.opportunity_score) - score(a.opportunity_score)).slice(0, 8), [corridors]);
  const selectedCorridor = corridors.find((row) => row.corridor_id === selectedId) ?? topCorridors[0];
  const profile = detailQuery.data ?? selectedCorridor;
  const compareRows = selectedCompare.map((id) => corridors.find((row) => row.corridor_id === id)).filter(Boolean) as Corridor[];
  const lastRefreshed = formatTime(Math.max(corridorQuery.dataUpdatedAt || 0, summaryQuery.dataUpdatedAt || 0));
  const whitespaceData = CATEGORY_OPTIONS.map((item) => ({ category: item.label, whitespace: Number(average(corridors, item.whitespace as keyof Corridor).toFixed(1)) }));
  const districtsData = useMemo(() => {
    return Array.from(new Set(corridors.map((row) => row.district).filter(Boolean))).map((district) => {
      const rows = corridors.filter((row) => row.district === district);
      return { district, count: rows.length, score: Number(average(rows, 'opportunity_score').toFixed(1)) };
    }).sort((a, b) => b.score - a.score);
  }, [corridors]);
  const gatewayDependency = useMemo(() => {
    const counts = corridors.reduce<Record<string, number>>((all, row) => {
      const label = row.gateway_dependency?.trim() || 'Not specified';
      all[label] = (all[label] || 0) + 1;
      return all;
    }, {});
    return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'Not specified';
  }, [corridors]);
  const profileDaypart = profile ? [
    { label: 'Weekday AM', value: profile.weekday_am },
    { label: 'Midday', value: profile.weekday_midday },
    { label: 'Weekday PM', value: profile.weekday_evening },
    { label: 'Late night', value: profile.late_night },
    { label: 'Weekend day', value: profile.weekend_day },
  ] : [];
  const audienceData = profile ? [
    { label: 'Office routine', value: profile.office_routine },
    { label: 'Hybrid / remote', value: profile.hybrid_remote },
    { label: 'Family household', value: profile.family_household },
    { label: 'Morning commuters', value: profile.morning_commuters },
    { label: 'Car errands', value: profile.car_errands },
    { label: 'Weekend brunch', value: profile.weekend_brunch },
    { label: 'Young social', value: profile.young_social_cohort },
  ] : [];
  const profileWhitespace = profile ? CATEGORY_OPTIONS.map((item) => ({ label: item.label, value: profile[item.whitespace] })).sort((a, b) => score(b.value) - score(a.value)) : [];

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCorridorsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
    ]);
  };
  const selectCompare = (id: string) => {
    setSelectedCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  };
  const jumpToProfile = (id: string) => {
    setSelectedId(id);
    window.setTimeout(() => document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <div className="app-shell min-h-[100dvh] bg-background">
      <Header isDark={isDark} setIsDark={setIsDark} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} interval={interval} setInterval={setInterval} onRefresh={refreshAll} isFetching={loading} lastRefreshed={lastRefreshed} />
      <div className="mx-auto flex max-w-[1680px]">
        <aside className={`${sidebarOpen ? 'flex' : 'hidden'} print-hidden fixed inset-y-[59px] left-0 z-10 w-64 flex-col border-r border-border bg-card p-4 lg:sticky lg:top-[59px] lg:flex lg:h-[calc(100dvh-59px)]`}>
          <div className="mb-5 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between"><span className="font-mono-data text-[10px] uppercase tracking-[.14em] text-primary">Decision cockpit</span><Activity className="h-3.5 w-3.5 text-primary" /></div>
            <p className="text-[11px] leading-5 text-muted-foreground">A grounded read of DFW corridors using the supplied location, audience, whitespace, and resilience fields.</p>
          </div>
          <p className="mb-2 px-2 font-mono-data text-[10px] uppercase tracking-[.14em] text-muted-foreground">Workspace</p>
          {[
            { label: 'Market snapshot', icon: Gauge, id: 'market' },
            { label: 'Opportunity grid', icon: BarChart3, id: 'opportunity' },
            { label: 'Corridor explorer', icon: Layers3, id: 'explorer' },
            { label: 'Compare board', icon: GitCompareArrows, id: 'compare' },
            { label: 'Corridor profile', icon: FileText, id: 'profile' },
          ].map((item) => <button key={item.id} onClick={() => { document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }); setSidebarOpen(false); }} className="mb-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><item.icon className="h-4 w-4" />{item.label}</button>)}
          <div className="mt-auto hidden rounded-lg border border-border bg-muted/50 p-3 lg:block"><div className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="h-4 w-4 text-primary" />Signal discipline</div><p className="mt-2 text-[10px] leading-4 text-muted-foreground">Scores surface evidence from the dataset. They are not revenue forecasts.</p></div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="print-hidden mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground lg:hidden"><SlidersHorizontal className="h-3.5 w-3.5" />Workspace sections</button>

          <section id="market" className="scroll-mt-24">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-[.18em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Dallas–Fort Worth · market read</div>
                <h1 className="font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[.98] tracking-[-.065em]">Make the next corridor<br /><span className="text-primary">legible.</span></h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">A decision cockpit for choosing where a concept belongs next — grounded in observed corridor character, audience behavior, whitespace, and resilience.</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"><MapPinned className="h-4 w-4 text-primary" /><span>District-level intelligence</span><span className="h-1 w-1 rounded-full bg-border" /><span>Prototype dataset</span></div>
            </div>
            {hasError && <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div><p className="font-medium">The market feed is unavailable.</p><p className="mt-1 text-xs text-muted-foreground">Refresh to retry the corridor and dashboard summary endpoints.</p></div><button className="ml-auto rounded-md border border-border px-2 py-1 text-xs hover:bg-muted" onClick={refreshAll}>Retry</button></div>}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {loading ? [1, 2, 3, 4].map((item) => <Panel key={item} className="p-5"><SkeletonBlock className="h-4 w-32" /><SkeletonBlock className="mt-3 h-9 w-24" /><SkeletonBlock className="mt-2 h-3 w-44" /></Panel>) : (
                <>
                  <MetricCard icon={Building2} label="Corridors in view" value={summary ? summary.total_corridors.toLocaleString() : corridors.length ? corridors.length.toString() : '—'} detail="The supplied DFW corridor universe" tone="teal" />
                  <MetricCard icon={Sparkles} label="Average café whitespace" value={summary ? `${score(summary.average_cafe_whitespace).toFixed(1)}` : corridors.length ? average(corridors, 'cafe_whitespace').toFixed(1) : '—'} detail="Room for a café concept, dataset-derived" tone="amber" />
                  <MetricCard icon={Zap} label="Average QSR whitespace" value={summary ? `${score(summary.average_qsr_whitespace).toFixed(1)}` : corridors.length ? average(corridors, 'qsr_whitespace').toFixed(1) : '—'} detail="Whitespace signal across corridors" tone="blue" />
                  <MetricCard icon={TrendingUp} label="Neighborhood momentum" value={summary ? `${score(summary.average_neighborhood_momentum).toFixed(1)}` : corridors.length ? average(corridors, 'neighborhood_momentum').toFixed(1) : '—'} detail="Observed momentum, not projected growth" tone="violet" />
                </>
              )}
            </div>
          </section>

          <section id="opportunity" className="mb-6 scroll-mt-24 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_.65fr]">
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow="01 · signal board" title="Top opportunity corridors" description="Highest Data-Derived Opportunity Score in the current dataset." action={<ExportButton data={csvRows(topCorridors)} filename="corridiq-top-opportunity-corridors.csv" />} />
              <div className="h-[330px] p-3 sm:p-5">
                {loading ? <SkeletonBlock className="h-full w-full" /> : topCorridors.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCorridors} layout="vertical" margin={{ top: 4, right: 14, left: 6, bottom: 0 }}>
                      <CartesianGrid horizontal={false} stroke={isDark ? 'rgba(255,255,255,.08)' : '#e6e3dc'} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: isDark ? '#aebbb7' : '#70818a' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="corridor_name" width={110} tick={{ fontSize: 10, fill: isDark ? '#d5dedb' : '#3f535b' }} axisLine={false} tickLine={false} tickFormatter={(name) => name.length > 17 ? `${name.slice(0, 17)}…` : name} />
                      <Tooltip isAnimationActive={false} cursor={{ fill: isDark ? 'rgba(255,255,255,.05)' : 'rgba(26,119,107,.05)' }} contentStyle={{ borderRadius: 8, border: '1px solid #dcd8ce', fontSize: 12 }} formatter={(value: number) => [`${score(value).toFixed(1)}`, 'Opportunity score']} />
                      <Bar dataKey="opportunity_score" name="Data-Derived Opportunity Score" fill={COLORS.teal} fillOpacity={0.86} radius={[0, 4, 4, 0]} isAnimationActive={false} onClick={(entry: { payload?: Corridor }) => { const row = topCorridors.find((item) => item.corridor_id === entry?.payload?.corridor_id); if (row) jumpToProfile(row.corridor_id); }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="No opportunity signals yet" detail="When corridor records are available, the strongest data-derived signals will appear here." />}
              </div>
              <div className="flex items-center gap-2 border-t border-border/70 px-5 py-3 text-[11px] text-muted-foreground"><Info className="h-3.5 w-3.5 text-primary" />Opportunity Score organizes supplied fields; it does not predict revenue.</div>
            </Panel>
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow="02 · market highlights" title="Executive read" description="Highlights returned by the dashboard summary endpoint." action={<ArrowUpRight className="h-4 w-4 text-muted-foreground" />} />
              <div className="divide-y divide-border/70">
                {loading ? [1, 2, 3, 4].map((item) => <div key={item} className="p-4"><SkeletonBlock className="h-3 w-24" /><SkeletonBlock className="mt-2 h-5 w-44" /></div>) : summary?.highlights?.length ? summary.highlights.slice(0, 5).map((highlight) => (
                  <button key={`${highlight.label}-${highlight.corridor_name}`} onClick={() => { const match = corridors.find((row) => row.corridor_name === highlight.corridor_name); if (match) jumpToProfile(match.corridor_id); }} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/60">
                    <div><p className="font-mono-data text-[10px] uppercase tracking-[.1em] text-muted-foreground">{highlight.label}</p><p className="mt-1 text-sm font-medium">{highlight.corridor_name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{highlight.district}</p></div><span className="font-display text-lg font-semibold text-primary">{highlight.value_label}</span>
                  </button>
                )) : <EmptyState title="No highlights returned" detail="The summary service has not provided executive highlights for this dataset." />}
              </div>
            </Panel>
          </section>

          <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_.95fr]">
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow="03 · whitespace" title="Category whitespace heatmap" description="Higher values indicate more whitespace in the supplied category field." action={<ExportButton data={whitespaceData} filename="corridiq-category-whitespace.csv" />} />
              <div className="p-5">
                {loading ? <SkeletonBlock className="h-[260px] w-full" /> : whitespaceData.length ? <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={whitespaceData} layout="vertical" margin={{ left: 4, right: 18, top: 8, bottom: 8 }}>
                    <CartesianGrid horizontal={false} stroke={isDark ? 'rgba(255,255,255,.08)' : '#e6e3dc'} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: isDark ? '#aebbb7' : '#70818a' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="category" width={115} tick={{ fontSize: 10, fill: isDark ? '#d5dedb' : '#3f535b' }} axisLine={false} tickLine={false} />
                    <Tooltip isAnimationActive={false} contentStyle={{ borderRadius: 8, border: '1px solid #dcd8ce', fontSize: 12 }} formatter={(value: number) => [`${value.toFixed(1)}`, 'Average whitespace']} />
                    <Bar dataKey="whitespace" fill={COLORS.amber} fillOpacity={0.88} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer> : <EmptyState title="Whitespace matrix is empty" detail="No corridor records are available to calculate category whitespace." />}
              </div>
              <div className="flex flex-wrap gap-3 border-t border-border/70 px-5 py-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#e9a12b]" />Higher whitespace</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#357db1]" />Mid signal</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#9aadb7]" />Lower whitespace</span></div>
            </Panel>
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow="04 · concept fit" title="Concept recommendations" description="Ranked from category-specific scores in the corridor fields." action={<ExportButton data={profileWhitespace} filename="corridiq-concept-recommendations.csv" />} />
              <div className="border-b border-border/70 px-5 py-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {CATEGORY_OPTIONS.map((item) => <button key={item.key} onClick={() => setCategory(item.key)} className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] transition-colors ${category === item.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}
                </div>
              </div>
              <div className="divide-y divide-border/70">
                {loading ? [1, 2, 3, 4].map((item) => <div key={item} className="flex items-center gap-3 p-4"><SkeletonBlock className="h-8 w-8 rounded-full" /><SkeletonBlock className="h-4 w-40" /><SkeletonBlock className="ml-auto h-4 w-12" /></div>) : [...corridors].sort((a, b) => score(Number(b[category])) - score(Number(a[category]))).slice(0, 5).map((row, index) => (
                  <button key={row.corridor_id} onClick={() => jumpToProfile(row.corridor_id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/60">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono-data text-[11px] ${index === 0 ? 'bg-accent/20 text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.corridor_name}</span><span className="block truncate text-[11px] text-muted-foreground">{row.district} · {row.dominant_audience}</span></span>
                    <span className="font-mono-data text-sm text-primary">{scoreText(Number(row[category]))}</span><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
                {!loading && !corridors.length && <EmptyState title="No concept fits yet" detail="Load corridor records to rank category-specific opportunity fields." />}
              </div>
            </Panel>
          </section>

          <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_.75fr]">
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow="05 · district lens" title="Intelligence map placeholder" description="A district-based orientation layer for the prototype dataset." action={<ExportButton data={districtsData} filename="corridiq-district-intelligence.csv" />} />
              <div className="relative min-h-[310px] overflow-hidden bg-[#e5e7df] dark:bg-[#18262a]">
                <div className="absolute inset-0 grid-paper opacity-80" />
                <div className="absolute left-[18%] top-[22%] h-32 w-[28%] rotate-[-12deg] border-2 border-primary/30 bg-primary/5" />
                <div className="absolute left-[43%] top-[12%] h-44 w-[30%] rotate-[18deg] border-2 border-[#357db1]/30 bg-[#357db1]/5" />
                <div className="absolute left-[26%] top-[55%] h-28 w-[42%] rotate-[6deg] border-2 border-accent/40 bg-accent/10" />
                <div className="absolute left-[58%] top-[52%] h-24 w-[24%] rotate-[-25deg] border-2 border-[#7c6da8]/35 bg-[#7c6da8]/10" />
                <div className="absolute inset-0 flex items-center justify-center"><div className="max-w-xs rounded-lg border border-border/80 bg-card/90 p-4 text-center backdrop-blur-sm"><MapPinned className="mx-auto mb-2 h-5 w-5 text-primary" /><p className="text-xs font-semibold">District signal map</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Precise coordinates are not included in this prototype dataset. Use district labels for orientation, not site selection.</p></div></div>
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
                  {districtsData.slice(0, 7).map((item, index) => <button key={item.district} onClick={() => setDistrictFilter(item.district)} className="rounded-md border border-border/80 bg-card/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur-sm hover:border-primary hover:text-foreground">{item.district} <span className="font-mono-data text-primary">{item.score.toFixed(0)}</span></button>)}
                </div>
              </div>
            </Panel>
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow="06 · operating context" title="Market character" description="How the available corridors are distributed by structural level and object form." />
              <div className="p-5">
                {loading ? <div className="space-y-4"><SkeletonBlock className="h-7 w-full" /><SkeletonBlock className="h-7 w-4/5" /><SkeletonBlock className="h-7 w-3/5" /></div> : corridors.length ? <div className="space-y-5">
                  <div><div className="mb-2 flex justify-between text-[11px]"><span className="text-muted-foreground">Average safety signal</span><span className="font-mono-data text-primary">{summary ? score(summary.average_safety).toFixed(1) : average(corridors, 'safety_day').toFixed(1)}</span></div><HeatBar value={summary?.average_safety ?? average(corridors, 'safety_day')} /></div>
                  <div><div className="mb-2 flex justify-between text-[11px]"><span className="text-muted-foreground">Average resilience</span><span className="font-mono-data text-primary">{average(corridors, 'shock_resilience').toFixed(1)}</span></div><HeatBar value={average(corridors, 'shock_resilience')} /></div>
                  <div><div className="mb-2 flex justify-between text-[11px]"><span className="text-muted-foreground">Most common gateway dependency</span><span className="max-w-[150px] truncate text-right font-mono-data text-primary">{gatewayDependency}</span></div><p className="text-[11px] leading-5 text-muted-foreground">Gateway dependency is preserved as a supplied categorical field and should be read alongside corridor form and character, not as a standalone demand forecast.</p></div>
                  <div className="flex items-center gap-2 rounded-md bg-muted/70 p-3 text-[11px] leading-4 text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" />Use these signals to frame diligence questions, not to skip them.</div>
                </div> : <EmptyState title="No operating context" detail="Market character will populate from corridor fields." />}
              </div>
            </Panel>
          </section>

          <section id="explorer" className="mb-6 scroll-mt-24">
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow="07 · dataset explorer" title="Corridor explorer" description="Search, filter, sort, shortlist. Every row traces back to the supplied corridor fields." action={<div className="flex items-center gap-2"><ExportButton data={csvRows(filteredCorridors)} filename="corridiq-corridor-explorer.csv" /><button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"><Filter className="h-3.5 w-3.5" />Filters</button></div>} />
              <div className="flex flex-wrap items-end gap-3 border-b border-border/70 bg-muted/20 px-5 py-4">
                <label className="min-w-[220px] flex-1"><span className="mb-1.5 block font-mono-data text-[10px] uppercase tracking-[.12em] text-muted-foreground">Search corridors</span><span className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, district, audience, character…" className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/10" /></span></label>
                <label className="w-full sm:w-[170px]"><span className="mb-1.5 block font-mono-data text-[10px] uppercase tracking-[.12em] text-muted-foreground">District</span><select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none focus:border-primary">{districts.map((district) => <option key={district}>{district}</option>)}</select></label>
                <label className="w-full sm:w-[185px]"><span className="mb-1.5 block font-mono-data text-[10px] uppercase tracking-[.12em] text-muted-foreground">Sort by</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs outline-none focus:border-primary"><option value="opportunity_score">Opportunity score</option><option value="neighborhood_momentum">Neighborhood momentum</option><option value="safety_day">Day safety</option><option value="cafe_whitespace">Café whitespace</option></select></label>
                <button className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setSortDescending(!sortDescending)}>{sortDescending ? <ArrowDownWideNarrow className="h-3.5 w-3.5" /> : <ArrowUpNarrowWide className="h-3.5 w-3.5" />}{sortDescending ? 'High first' : 'Low first'}</button>
              </div>
              {showFilters && <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-5 py-3 text-[11px] text-muted-foreground"><span className="mr-1 font-medium text-foreground">Shortlist tips:</span><span className="rounded bg-muted px-2 py-1">Select up to 4 rows to compare</span><span className="rounded bg-muted px-2 py-1">Click a corridor for its profile</span><button onClick={() => { setSearch(''); setDistrictFilter('All districts'); }} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"><X className="h-3 w-3" />Clear filters</button></div>}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[890px] text-left">
                  <thead className="bg-muted/45 font-mono-data text-[10px] uppercase tracking-[.08em] text-muted-foreground"><tr><th className="w-12 px-5 py-3">Pick</th><th className="px-3 py-3">Corridor</th><th className="px-3 py-3">District</th><th className="px-3 py-3">Audience / form</th><th className="px-3 py-3">Opportunity</th><th className="px-3 py-3">Momentum</th><th className="px-3 py-3">Whitespace</th><th className="w-14 px-5 py-3" /></tr></thead>
                  <tbody className="divide-y divide-border/60">
                    {loading ? [1, 2, 3, 4, 5].map((item) => <tr key={item}><td colSpan={8} className="px-5 py-3"><SkeletonBlock className="h-8 w-full" /></td></tr>) : filteredCorridors.map((row) => {
                      const picked = selectedCompare.includes(row.corridor_id);
                      return <tr key={row.corridor_id} className={`group transition-colors hover:bg-muted/50 ${selectedId === row.corridor_id ? 'bg-primary/5' : ''}`}>
                        <td className="px-5 py-3"><button onClick={() => selectCompare(row.corridor_id)} className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${picked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary'}`} aria-label={`Compare ${row.corridor_name}`}>{picked && <Check className="h-3.5 w-3.5" />}</button></td>
                        <td className="px-3 py-3"><button className="text-left" onClick={() => jumpToProfile(row.corridor_id)}><span className="block text-sm font-medium group-hover:text-primary">{row.corridor_name}</span><span className="mt-0.5 block font-mono-data text-[10px] text-muted-foreground">{row.corridor_id}</span></button></td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{row.district}</td>
                        <td className="max-w-[185px] px-3 py-3"><span className="block truncate text-xs">{row.dominant_audience || '—'}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{row.form || row.character || '—'}</span></td>
                        <td className="px-3 py-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${scoreTone(row.opportunity_score) === 'high' ? 'bg-accent' : scoreTone(row.opportunity_score) === 'mid' ? 'bg-[#357db1]' : 'bg-slate-300'}`} /><span className="font-mono-data text-xs font-medium text-primary">{scoreText(row.opportunity_score)}</span></div></td>
                        <td className="px-3 py-3"><HeatBar value={row.neighborhood_momentum} compact /></td>
                        <td className="px-3 py-3"><span className="font-mono-data text-xs text-muted-foreground">{score(row.cafe_whitespace).toFixed(0)} / {score(row.qsr_whitespace).toFixed(0)}</span><span className="block text-[10px] text-muted-foreground">Café · QSR</span></td>
                        <td className="px-5 py-3"><button onClick={() => jumpToProfile(row.corridor_id)} className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label={`Open ${row.corridor_name} profile`}><ArrowUpRight className="h-4 w-4" /></button></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
                {!loading && !filteredCorridors.length && <EmptyState title="No corridors match these filters" detail="Try a broader search or clear the district filter to return to the full dataset." icon={Search} />}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-5 py-3 text-[11px] text-muted-foreground"><span>Showing <strong className="text-foreground">{filteredCorridors.length}</strong> of {corridors.length} corridor records</span><span className="font-mono-data">Scores normalized to 0–100 for display</span></div>
            </Panel>
          </section>

          {selectedCompare.length >= 2 && <section id="compare" className="mb-6 scroll-mt-24">
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow="08 · decision frame" title="Compare board" description={`Side-by-side view of ${compareRows.length} shortlisted corridors. Select up to 4 in the explorer.`} action={<div className="flex items-center gap-2"><ExportButton data={compareRows.map((row) => Object.fromEntries(DIMENSIONS.map((dim) => [dim.label, score(Number(row[dim.key]))])))} filename="corridiq-corridor-comparison.csv" /><button onClick={() => setSelectedCompare([])} className="print-hidden text-[11px] text-muted-foreground hover:text-foreground">Clear shortlist</button></div>} />
              <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-[1.15fr_.85fr]">
                <div className="h-[340px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={DIMENSIONS.map((dimension) => ({ dimension: dimension.label, ...Object.fromEntries(compareRows.map((row) => [row.corridor_id, score(Number(row[dimension.key]))])) }))}>
                      <PolarGrid stroke={isDark ? 'rgba(255,255,255,.12)' : '#dedbd3'} />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: isDark ? '#d5dedb' : '#52646b' }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: isDark ? '#9aa9a5' : '#86949a' }} />
                      {compareRows.map((row, index) => <Radar key={row.corridor_id} name={row.corridor_name} dataKey={row.corridor_id} stroke={[COLORS.teal, COLORS.amber, COLORS.blue, COLORS.violet][index]} fill={[COLORS.teal, COLORS.amber, COLORS.blue, COLORS.violet][index]} fillOpacity={0.13} strokeWidth={2} isAnimationActive={false} />)}
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip isAnimationActive={false} contentStyle={{ borderRadius: 8, border: '1px solid #dcd8ce', fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {compareRows.map((row, index) => <button key={row.corridor_id} onClick={() => jumpToProfile(row.corridor_id)} className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{row.corridor_name}</p><p className="mt-1 text-[11px] text-muted-foreground">{row.district} · {row.dominant_audience}</p></div><span className="font-mono-data text-lg text-primary">{scoreText(row.opportunity_score)}</span></div><div className="mt-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: [COLORS.teal, COLORS.amber, COLORS.blue, COLORS.violet][index] }} /><span className="text-[10px] text-muted-foreground">Data-Derived Opportunity Score</span><ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" /></div></button>)}
                </div>
              </div>
            </Panel>
          </section>}

          <section id="profile" className="scroll-mt-24">
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow="09 · corridor profile" title={profile ? profile.corridor_name : 'Corridor profile'} description={profile ? `${profile.district} · ${profile.level || 'Corridor'} · ${profile.object_form || profile.form || 'structural form not specified'}` : 'Select any corridor in the explorer to open its profile.'} action={profile ? <button onClick={() => selectCompare(profile.corridor_id)} className={`print-hidden inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] ${selectedCompare.includes(profile.corridor_id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}><GitCompareArrows className="h-3.5 w-3.5" />{selectedCompare.includes(profile.corridor_id) ? 'Shortlisted' : 'Compare'}</button> : undefined} />
              {!profile ? <EmptyState title="Choose a corridor to inspect" detail="The profile brings behavioral, daypart, audience, whitespace, and resilience fields into one evidence panel." icon={FileText} /> : (
                <>
                  <div className="grid grid-cols-2 gap-px bg-border/70 sm:grid-cols-4">
                    <div className="bg-card p-4"><p className="font-mono-data text-[10px] uppercase tracking-[.1em] text-muted-foreground">Opportunity</p><p className="mt-1 font-display text-2xl font-semibold text-primary">{scoreText(profile.opportunity_score)}</p><p className="mt-1 text-[10px] text-muted-foreground">Data-derived, not predictive</p></div>
                    <div className="bg-card p-4"><p className="font-mono-data text-[10px] uppercase tracking-[.1em] text-muted-foreground">Audience</p><p className="mt-2 truncate text-sm font-medium">{profile.dominant_audience || '—'}</p><p className="mt-1 text-[10px] text-muted-foreground">Dominant audience field</p></div>
                    <div className="bg-card p-4"><p className="font-mono-data text-[10px] uppercase tracking-[.1em] text-muted-foreground">Character</p><p className="mt-2 truncate text-sm font-medium">{profile.character || '—'}</p><p className="mt-1 text-[10px] text-muted-foreground">{profile.form || 'Supplied corridor form'}</p></div>
                    <div className="bg-card p-4"><p className="font-mono-data text-[10px] uppercase tracking-[.1em] text-muted-foreground">Resilience</p><p className="mt-1 font-display text-2xl font-semibold text-primary">{scoreText(profile.shock_resilience)}</p><p className="mt-1 text-[10px] text-muted-foreground">Shock resilience field</p></div>
                  </div>
                  {detailQuery.isFetching && <div className="border-b border-border/70 px-5 py-2 text-[11px] text-muted-foreground">Refreshing corridor detail…</div>}
                  <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-2">
                    <Panel className="overflow-hidden">
                      <PanelHeader title="Behavior & daypart" description="Observed daypart fields for this corridor." action={<ExportButton data={profileDaypart.map((row) => ({ dimension: row.label, value: score(row.value).toFixed(1) }))} filename="corridiq-daypart-profile.csv" />} />
                      <div className="h-[245px] p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={profileDaypart} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}><CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,.08)' : '#e6e3dc'} /><XAxis dataKey="label" tick={{ fontSize: 9, fill: isDark ? '#b7c5c1' : '#70818a' }} interval={0} angle={-18} textAnchor="end" height={45} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: isDark ? '#b7c5c1' : '#70818a' }} axisLine={false} tickLine={false} /><Tooltip isAnimationActive={false} formatter={(value: number) => [score(value).toFixed(1), 'Signal']} contentStyle={{ borderRadius: 8, border: '1px solid #dcd8ce', fontSize: 11 }} /><Bar dataKey="value" fill={COLORS.teal} fillOpacity={0.86} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
                    </Panel>
                    <Panel className="overflow-hidden">
                      <PanelHeader title="Audience composition" description="Relative audience fields supplied for the corridor." action={<ExportButton data={audienceData.map((row) => ({ audience_signal: row.label, value: score(row.value).toFixed(1) }))} filename="corridiq-audience-profile.csv" />} />
                      <div className="space-y-3 p-5">{audienceData.map((row) => <div key={row.label}><div className="mb-1 flex justify-between text-[11px]"><span>{row.label}</span><span className="font-mono-data text-muted-foreground">{scoreText(row.value)}</span></div><HeatBar value={row.value} /></div>)}</div>
                    </Panel>
                    <Panel className="overflow-hidden">
                      <PanelHeader title="Whitespace by concept" description="Category fields for this corridor, ranked high to low." action={<ExportButton data={profileWhitespace.map((row) => ({ concept: row.label, whitespace: score(row.value).toFixed(1) }))} filename="corridiq-profile-whitespace.csv" />} />
                      <div className="space-y-3 p-5">{profileWhitespace.map((row) => <div key={row.label}><div className="mb-1 flex justify-between text-[11px]"><span>{row.label}</span><span className="font-mono-data text-muted-foreground">{scoreText(row.value)}</span></div><HeatBar value={row.value} /></div>)}</div>
                    </Panel>
                    <Panel className="overflow-hidden">
                      <PanelHeader title="Risk & resilience context" description="Read these fields as diligence prompts, not predictions." action={<ExportButton data={[{ corridor: profile.corridor_name, shock_resilience: score(profile.shock_resilience), seasonality_amplitude: score(profile.seasonality_amplitude), event_dependency: score(profile.event_dependency), development_dependency: score(profile.development_dependency), path_of_travel_friction: score(profile.path_of_travel_friction), chain_dominance: score(profile.chain_dominance) }]} filename="corridiq-risk-resilience.csv" />} />
                      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">{[
                        ['Shock resilience', profile.shock_resilience],
                        ['Seasonality amplitude', profile.seasonality_amplitude],
                        ['Event dependency', profile.event_dependency],
                        ['Development dependency', profile.development_dependency],
                        ['Travel friction', profile.path_of_travel_friction],
                        ['Chain dominance', profile.chain_dominance],
                      ].map(([label, value]) => <div key={label as string} className="rounded-md border border-border bg-muted/30 p-3"><p className="text-[10px] leading-4 text-muted-foreground">{label as string}</p><p className="mt-1 font-mono-data text-sm text-primary">{scoreText(value as number)}</p></div>)}</div>
                      <div className="mx-5 mb-5 flex items-start gap-2 rounded-md border border-accent/30 bg-accent/10 p-3 text-[11px] leading-5 text-muted-foreground"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-foreground" /><span>Resilience, seasonality, event, development, friction, and chain fields describe the corridor context available here. Validate with site-level diligence before committing capital.</span></div>
                    </Panel>
                  </div>
                </>
              )}
            </Panel>
          </section>
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5 text-[10px] text-muted-foreground"><span className="font-mono-data uppercase tracking-[.13em]">CorridorIQ · DFW decision cockpit</span><span>All opportunity language is data-derived and grounded in the supplied prototype fields.</span></footer>
        </main>
      </div>
    </div>
  );
}

function Router() {
  return <Switch><Route path="/" component={AppDashboard} /><Route component={() => <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-center"><div><p className="font-display text-2xl font-semibold">Page not found</p><p className="mt-2 text-sm text-muted-foreground">Return to the CorridorIQ cockpit.</p></div></div>} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;