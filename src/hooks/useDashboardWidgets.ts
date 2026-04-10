import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSettings } from './useAccountSettings';
import type ReactGridLayout from 'react-grid-layout';
import {
  Wallet,
  LineChart,
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  FileStack,
  LayoutGrid,
  Trophy,
  Table2,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export type LayoutItem = ReactGridLayout.Layout;
export type Layouts = { [breakpoint: string]: LayoutItem[] };

export interface WidgetMeta {
  id: string;
  label: string;
  icon: LucideIcon;
  category: 'stat' | 'card';
  description: string;
  defaultSize: { w: number; h: number };
}

export const ALL_WIDGETS: WidgetMeta[] = [
  { id: 'total-assets', label: 'Total Assets', icon: Wallet, category: 'card', description: 'Balance with portfolio distribution bar', defaultSize: { w: 6, h: 4 } },
  { id: 'total-investments', label: 'Total Investments', icon: LineChart, category: 'card', description: 'Performance area chart over time', defaultSize: { w: 6, h: 4 } },
  { id: 'weekly-goal', label: 'Weekly Goal', icon: Target, category: 'card', description: 'Coffee cup progress toward weekly P&L goal', defaultSize: { w: 4, h: 4 } },
  { id: 'total-pnl', label: 'Total P&L', icon: DollarSign, category: 'stat', description: 'All-time profit & loss', defaultSize: { w: 3, h: 2 } },
  { id: 'win-rate', label: 'Win Rate', icon: Target, category: 'stat', description: 'Percentage of winning trades', defaultSize: { w: 3, h: 2 } },
  { id: 'positions-count', label: 'Positions', icon: BarChart3, category: 'stat', description: 'Total number of positions taken', defaultSize: { w: 3, h: 2 } },
  { id: 'avg-win', label: 'Avg Win', icon: TrendingUp, category: 'stat', description: 'Average profit per winning trade', defaultSize: { w: 3, h: 2 } },
  { id: 'avg-loss', label: 'Avg Loss', icon: TrendingDown, category: 'stat', description: 'Average loss per losing trade', defaultSize: { w: 3, h: 2 } },
  { id: 'open-count', label: 'Open', icon: Activity, category: 'stat', description: 'Number of currently open positions', defaultSize: { w: 4, h: 2 } },
  { id: 'open-positions', label: 'Open Positions', icon: Activity, category: 'card', description: 'Currently open trade positions', defaultSize: { w: 4, h: 4 } },
  { id: 'recent-trades', label: 'Recent Trades', icon: LayoutGrid, category: 'card', description: 'Latest closed and open trades', defaultSize: { w: 8, h: 4 } },
  { id: 'playbook-tasks', label: 'Playbook Tasks', icon: FileStack, category: 'card', description: 'Upcoming tasks from your playbook notes', defaultSize: { w: 4, h: 3 } },
  { id: 'total-profits', label: 'Total Profits', icon: Trophy, category: 'card', description: 'Total realized P&L with YTD breakdown', defaultSize: { w: 4, h: 3 } },
  { id: 'asset-performance', label: 'Asset Performance', icon: Table2, category: 'card', description: 'Table of top open positions by allocation', defaultSize: { w: 6, h: 4 } },
  { id: 'performance-chart', label: 'Performance Chart', icon: LineChart, category: 'card', description: 'Standalone cumulative P&L chart', defaultSize: { w: 6, h: 4 } },
];

const WIDGET_MAP = new Map(ALL_WIDGETS.map(w => [w.id, w]));

function buildDefaultLayout(): LayoutItem[] {
  return [
    { i: 'total-assets',      x: 0, y: 0, w: 8, h: 3 },
    { i: 'weekly-goal',       x: 8, y: 0, w: 4, h: 3 },
    { i: 'total-investments', x: 0, y: 3, w: 12, h: 5 },
    { i: 'recent-trades',     x: 0, y: 8, w: 4, h: 5 },
    { i: 'open-positions',    x: 4, y: 8, w: 4, h: 5 },
    { i: 'playbook-tasks',    x: 8, y: 8, w: 4, h: 5 },
  ];
}

function buildSmallLayout(lgLayout: LayoutItem[]): LayoutItem[] {
  let y = 0;
  return lgLayout.map(item => {
    const result: LayoutItem = { ...item, x: 0, w: 4, y };
    y += item.h;
    return result;
  });
}

function buildMdLayout(lgLayout: LayoutItem[]): LayoutItem[] {
  let y = 0;
  let x = 0;
  const result: LayoutItem[] = [];
  for (const item of lgLayout) {
    const w = Math.min(item.w, 8);
    if (x + w > 8) {
      x = 0;
      y = result.length > 0 ? Math.max(...result.map(r => r.y + r.h)) : 0;
    }
    result.push({ ...item, x, w, y });
    x += w;
  }
  return result;
}

function deriveLayouts(lgLayout: LayoutItem[]): Layouts {
  return {
    lg: lgLayout,
    md: buildMdLayout(lgLayout),
    sm: buildSmallLayout(lgLayout),
  };
}

export function useDashboardWidgets() {
  const { user } = useAuth();
  const { settings, updateSettings } = useAccountSettings();

  const initialLayout = useMemo(() => {
    if (settings?.dashboard_layout) {
      try {
        const saved = settings.dashboard_layout as LayoutItem[];
        if (Array.isArray(saved) && saved.length > 0 && saved[0].i) return saved;
      } catch (e) {
        console.warn('[DashboardWidgets] Failed to parse saved layout, using default:', e);
      }
    }
    return buildDefaultLayout();
  }, [settings?.dashboard_layout]);

  const [savedLayout, setSavedLayout] = useState<LayoutItem[]>(initialLayout);
  const [isEditing, setIsEditing] = useState(false);
  const [draftLayout, setDraftLayout] = useState<LayoutItem[]>(initialLayout);

  // Sync when settings load
  useMemo(() => {
    if (!isEditing) {
      setSavedLayout(initialLayout);
      setDraftLayout(initialLayout);
    }
  }, [initialLayout]);

  const activeLayout = isEditing ? draftLayout : savedLayout;
  const layouts = useMemo(() => deriveLayouts(activeLayout), [activeLayout]);

  const enabledWidgets = useMemo(() => activeLayout.map(l => l.i), [activeLayout]);

  const isDirty = useMemo(() => {
    if (!isEditing) return false;
    return JSON.stringify(draftLayout) !== JSON.stringify(savedLayout);
  }, [isEditing, draftLayout, savedLayout]);

  const startEditing = useCallback(() => {
    setDraftLayout([...savedLayout]);
    setIsEditing(true);
  }, [savedLayout]);

  const cancelEditing = useCallback(() => {
    setDraftLayout(savedLayout);
    setIsEditing(false);
  }, [savedLayout]);

  const saveLayout = useCallback(async () => {
    setSavedLayout(draftLayout);
    setIsEditing(false);
    await updateSettings({ dashboard_layout: draftLayout as Record<string, unknown> });
  }, [draftLayout, updateSettings]);

  const onLayoutChange = useCallback((layout: LayoutItem[], allLayouts: Layouts) => {
    if (!isEditing) return;
    if (allLayouts.lg) {
      setDraftLayout(allLayouts.lg);
    } else {
      setDraftLayout(layout);
    }
  }, [isEditing]);

  const addWidget = useCallback((id: string) => {
    if (draftLayout.find(l => l.i === id)) return;
    const meta = WIDGET_MAP.get(id);
    const { w, h } = meta?.defaultSize || { w: 4, h: 3 };
    setDraftLayout(prev => [...prev, { i: id, x: 0, y: Infinity, w, h }]);
  }, [draftLayout]);

  const removeWidget = useCallback((id: string) => {
    setDraftLayout(prev => prev.filter(l => l.i !== id));
  }, []);

  const resetToDefault = useCallback(() => {
    setDraftLayout(buildDefaultLayout());
  }, []);

  const availableWidgets = useMemo(() => {
    return ALL_WIDGETS.filter(w => !enabledWidgets.includes(w.id));
  }, [enabledWidgets]);

  const enabledWidgetMetas = useMemo(() => {
    return enabledWidgets
      .map(id => WIDGET_MAP.get(id))
      .filter(Boolean) as WidgetMeta[];
  }, [enabledWidgets]);

  return {
    enabledWidgets,
    enabledWidgetMetas,
    availableWidgets,
    layouts,
    addWidget,
    removeWidget,
    resetToDefault,
    isEditing,
    isDirty,
    startEditing,
    cancelEditing,
    saveLayout,
    onLayoutChange,
  };
}
