import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { parseISO, isAfter, isBefore } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  is_pinned: boolean;
  scheduled_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements_public')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter by scheduled_at and expires_at
      const now = new Date();
      const activeAnnouncements = (data || []).filter((ann) => {
        if (ann.scheduled_at) {
          const scheduledDate = parseISO(ann.scheduled_at);
          if (isAfter(scheduledDate, now)) return false;
        }

        if (ann.expires_at) {
          const expiresDate = parseISO(ann.expires_at);
          if (isBefore(expiresDate, now)) return false;
        }

        return true;
      });

      return activeAnnouncements as Announcement[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - announcements rarely change
  });
}
