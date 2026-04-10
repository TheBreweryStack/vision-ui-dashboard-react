import React, { useState, useEffect } from 'react';
import { supabase, Announcement } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Megaphone, Plus, Trash2, Edit2, Pin, PinOff, 
  Loader2, AlertTriangle, Clock, ArrowLeft
} from 'lucide-react';
import { format, parseISO, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AnnouncementModal } from './AnnouncementModal';
import { logger } from '@/lib/logger';

interface AnnouncementsTabProps {
  onBack?: () => void;
}

export function AnnouncementsTab({ onBack }: AnnouncementsTabProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAnnouncement, setEditAnnouncement] = useState<Announcement | null>(null);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      logger.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleOpenModal = (ann?: Announcement) => {
    setEditAnnouncement(ann || null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditAnnouncement(null);
  };

  const handleSave = (saved: Announcement) => {
    if (editAnnouncement) {
      setAnnouncements(prev => prev.map(a => a.id === saved.id ? saved : a));
    } else {
      setAnnouncements(prev => [saved, ...prev]);
    }
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success('Announcement deleted');
    } catch (error) {
      logger.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    }
  };

  const handleTogglePin = async (ann: Announcement) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_pinned: !ann.is_pinned })
        .eq('id', ann.id);

      if (error) throw error;

      setAnnouncements(prev => prev.map(a => 
        a.id === ann.id ? { ...a, is_pinned: !ann.is_pinned } : a
      ));
      toast.success(ann.is_pinned ? 'Announcement unpinned' : 'Announcement pinned');
    } catch (error) {
      logger.error('Error toggling pin:', error);
      toast.error('Failed to update announcement');
    }
  };

  const isExpired = (ann: Announcement) => {
    if (!ann.expires_at) return false;
    return isBefore(parseISO(ann.expires_at), new Date());
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Urgent';
      case 'medium': return 'High';
      default: return 'Normal';
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-loss/10 text-loss border-loss/30';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">Announcements</h2>
              <p className="text-sm text-muted-foreground">Manage and view platform announcements</p>
            </div>
          </div>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          New Announcement
        </Button>
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No announcements yet</p>
          <p className="text-sm">Create your first announcement to notify users</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => {
            const expired = isExpired(ann);
            
            return (
              <div
                key={ann.id}
                className={cn(
                  "p-4 rounded-xl border transition-colors",
                  expired 
                    ? "bg-loss/5 border-loss/30" 
                    : "bg-card border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Badges Row */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <AlertTriangle className={cn(
                        "h-4 w-4",
                        expired ? "text-loss" : "text-muted-foreground"
                      )} />
                      
                      {expired && (
                        <Badge variant="outline" className="bg-loss/10 text-loss border-loss/30 text-[10px]">
                          Expired
                        </Badge>
                      )}
                      
                      {ann.is_pinned && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                          <Pin className="h-2.5 w-2.5 mr-1" />
                          Pinned
                        </Badge>
                      )}
                      
                      <Badge variant="outline" className={cn("text-[10px]", getPriorityStyle(ann.priority))}>
                        {getPriorityLabel(ann.priority)}
                      </Badge>
                    </div>

                    {/* Title & Content */}
                    <h3 className="font-semibold text-foreground mb-1">{ann.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{ann.content}</p>

                    {/* Dates */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Created {ann.created_at ? format(parseISO(ann.created_at), 'MMM d, yyyy h:mm a') : '-'}
                      </span>
                      {ann.expires_at && (
                        <span className={cn(
                          "flex items-center gap-1",
                          expired ? "text-loss" : "text-muted-foreground"
                        )}>
                          <Clock className="h-3 w-3" />
                          {expired ? 'Expired' : 'Expires'} {format(parseISO(ann.expires_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleOpenModal(ann)}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        ann.is_pinned ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => handleTogglePin(ann)}
                      title={ann.is_pinned ? "Unpin" : "Pin"}
                      aria-label={ann.is_pinned ? "Unpin" : "Pin"}
                    >
                      {ann.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-loss hover:text-loss/80"
                      onClick={() => handleDelete(ann.id)}
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Announcement Modal */}
      <AnnouncementModal
        open={showModal}
        onOpenChange={setShowModal}
        announcement={editAnnouncement}
        onSave={handleSave}
      />
    </div>
  );
}
