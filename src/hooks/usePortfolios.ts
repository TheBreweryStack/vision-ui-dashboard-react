import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PortfolioCategory = 'stocks' | 'options' | 'dividends' | 'mixed';

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  category: PortfolioCategory;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'activePortfolioId';

export function usePortfolios() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ['portfolios', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('is_archived', false)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Portfolio[];
    },
    enabled: !!user,
  });

  const { data: archivedPortfolios = [] } = useQuery({
    queryKey: ['portfolios-archived', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('is_archived', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Portfolio[];
    },
    enabled: !!user,
  });

  // Initialize activePortfolioId from default portfolio if not set
  useEffect(() => {
    if (portfolios.length === 0) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const stillExists = stored && portfolios.some(p => p.id === stored);
    if (stillExists) {
      setActivePortfolioId(stored);
    } else {
      const defaultPortfolio = portfolios.find(p => p.is_default) || portfolios[0];
      setActivePortfolioId(defaultPortfolio.id);
      localStorage.setItem(STORAGE_KEY, defaultPortfolio.id);
    }
  }, [portfolios]);

  const switchPortfolio = useCallback((id: string) => {
    setActivePortfolioId(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Invalidate data queries so they refetch with new portfolio
    queryClient.invalidateQueries({ queryKey: ['journal-data'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
    queryClient.invalidateQueries({ queryKey: ['deposits'] });
    queryClient.invalidateQueries({ queryKey: ['weekly-balances'] });
    queryClient.invalidateQueries({ queryKey: ['account-settings'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async ({ name, category }: { name: string; category: PortfolioCategory }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('portfolios')
        .insert({ user_id: user.id, name, category })
        .select()
        .single();
      if (error) throw error;
      return data as Portfolio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('portfolios')
        .update({ name })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('portfolios')
        .update({ is_archived: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolios-archived'] });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('portfolios')
        .update({ is_archived: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolios-archived'] });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: PortfolioCategory }) => {
      const { error } = await supabase
        .from('portfolios')
        .update({ category })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('portfolios')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });

  const activePortfolio = portfolios.find(p => p.id === activePortfolioId) || null;

  return {
    portfolios,
    archivedPortfolios,
    activePortfolioId,
    activePortfolio,
    isLoading,
    switchPortfolio,
    createPortfolio: (name: string, category: PortfolioCategory) => createMutation.mutateAsync({ name, category }),
    renamePortfolio: (id: string, name: string) => renameMutation.mutateAsync({ id, name }),
    archivePortfolio: (id: string) => archiveMutation.mutateAsync(id),
    unarchivePortfolio: (id: string) => unarchiveMutation.mutateAsync(id),
    updateCategory: (id: string, category: PortfolioCategory) => updateCategoryMutation.mutateAsync({ id, category }),
    deletePortfolio: (id: string) => deleteMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
  };
}
