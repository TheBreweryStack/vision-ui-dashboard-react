import React, { useState } from 'react';
import { TrendingUp, Target, DollarSign, Layers, Plus, ChevronDown, Check, Pencil, Trash2, EyeOff, RotateCcw } from 'lucide-react';
import { usePortfolios, PortfolioCategory } from '@/hooks/usePortfolios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CreatePortfolioModal } from './CreatePortfolioModal';

const CATEGORY_CONFIG: Record<PortfolioCategory, { icon: React.ElementType; label: string; color: string }> = {
  stocks: { icon: TrendingUp, label: 'Stocks', color: 'text-profit' },
  options: { icon: Target, label: 'Options', color: 'text-primary' },
  dividends: { icon: DollarSign, label: 'Dividends', color: 'text-yellow-500' },
  mixed: { icon: Layers, label: 'Mixed', color: 'text-muted-foreground' },
};

interface PortfolioSwitcherProps {
  compact?: boolean;
}

export function PortfolioSwitcher({ compact = false }: PortfolioSwitcherProps) {
  const { portfolios, archivedPortfolios, activePortfolio, switchPortfolio, renamePortfolio, deletePortfolio, archivePortfolio, unarchivePortfolio } = usePortfolios();
  const [open, setOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await renamePortfolio(id, renameValue.trim());
      toast.success('Portfolio renamed');
      setRenamingId(null);
      setRenameValue('');
    } catch {
      toast.error('Failed to rename portfolio');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePortfolio(deleteTarget.id);
      toast.success(`Portfolio "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete portfolio');
    }
  };

  const handleArchive = async (id: string, name: string) => {
    try {
      await archivePortfolio(id);
      toast.success(`"${name}" hidden`);
    } catch {
      toast.error('Failed to hide portfolio');
    }
  };

  const handleUnarchive = async (id: string, name: string) => {
    try {
      await unarchivePortfolio(id);
      toast.success(`"${name}" restored`);
    } catch {
      toast.error('Failed to restore portfolio');
    }
  };

  if (!activePortfolio) return null;

  const ActiveIcon = CATEGORY_CONFIG[activePortfolio.category]?.icon || Layers;
  const activeColor = CATEGORY_CONFIG[activePortfolio.category]?.color || 'text-muted-foreground';

  return (
    <>
      <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRenamingId(null); } }}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={compact ? 'sm' : 'default'}
            className={cn('btn-glass border-0 gap-1.5', compact && 'h-8 px-2 text-xs')}
          >
            <ActiveIcon className={cn('h-3.5 w-3.5', activeColor)} />
            <span className="truncate max-w-[120px]">{activePortfolio.name}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {portfolios.map((p) => {
            const config = CATEGORY_CONFIG[p.category] || CATEGORY_CONFIG.mixed;
            const Icon = config.icon;

            if (renamingId === p.id) {
              return (
                <div key={p.id} className="p-2 flex gap-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-8 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(p.id); if (e.key === 'Escape') setRenamingId(null); }}
                  />
                  <Button size="sm" className="h-8 px-2 text-xs" onClick={() => handleRename(p.id)} disabled={!renameValue.trim()}>
                    Save
                  </Button>
                </div>
              );
            }

            return (
              <DropdownMenuItem
                key={p.id}
                onClick={() => { switchPortfolio(p.id); setOpen(false); }}
                className="flex items-center gap-2 group"
              >
                <Icon className={cn('h-4 w-4 shrink-0', config.color)} />
                <span className="flex-1 truncate">{p.name}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{config.label}</Badge>
                {p.id === activePortfolio.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                <div
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="p-1 rounded hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameValue(p.name);
                      setRenamingId(p.id);
                    }}
                    title="Rename"
                    aria-label={`Rename ${p.name}`}
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  {!p.is_default && (
                    <>
                      <button
                        className="p-1 rounded hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(p.id, p.name);
                          setOpen(false);
                        }}
                        title="Hide"
                        aria-label={`Hide ${p.name}`}
                      >
                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-destructive/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: p.id, name: p.name });
                          setOpen(false);
                        }}
                        title="Delete"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}

          {/* Archived portfolios */}
          {archivedPortfolios.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground py-1">
                      <EyeOff className="h-3 w-3" />
                      <span className="flex-1 text-left">Hidden ({archivedPortfolios.length})</span>
                      <ChevronDown className={cn('h-3 w-3 transition-transform', archivedOpen && 'rotate-180')} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-1">
                    {archivedPortfolios.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground/60 rounded hover:bg-accent/30">
                        <span className="flex-1 truncate">{p.name}</span>
                        <button
                          className="p-1 rounded hover:bg-accent"
                          onClick={() => { handleUnarchive(p.id, p.name); setOpen(false); }}
                          title="Restore"
                          aria-label={`Restore ${p.name}`}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => { setOpen(false); setShowCreateModal(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Portfolio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Portfolio</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This will permanently remove the portfolio. Trades assigned to it will become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreatePortfolioModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </>
  );
}
