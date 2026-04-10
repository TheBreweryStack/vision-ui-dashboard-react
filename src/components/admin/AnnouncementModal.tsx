import React, { useState, useEffect } from 'react';
import { supabase, Announcement } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon, Pin, PinOff, Trash2, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface AnnouncementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: Announcement | null;
  onSave: (announcement: Announcement) => void;
}

export function AnnouncementModal({ open, onOpenChange, announcement, onSave }: AnnouncementModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low');
  const [isPinned, setIsPinned] = useState(false);
  
  // Schedule state
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState('');
  
  // Expiration state
  const [expiresDate, setExpiresDate] = useState<Date | undefined>();
  const [expiresTime, setExpiresTime] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title);
      setContent(announcement.content);
      setPriority((announcement.priority as 'low' | 'medium' | 'high') || 'low');
      setIsPinned(announcement.is_pinned || false);
      
      if (announcement.scheduled_at) {
        const scheduledDate = parseISO(announcement.scheduled_at);
        setScheduleDate(scheduledDate);
        setScheduleTime(format(scheduledDate, 'HH:mm'));
      } else {
        setScheduleDate(undefined);
        setScheduleTime('');
      }
      
      if (announcement.expires_at) {
        const expiresDateParsed = parseISO(announcement.expires_at);
        setExpiresDate(expiresDateParsed);
        setExpiresTime(format(expiresDateParsed, 'HH:mm'));
      } else {
        setExpiresDate(undefined);
        setExpiresTime('');
      }
    } else {
      // Reset form for new announcement
      setTitle('');
      setContent('');
      setPriority('low');
      setIsPinned(false);
      setScheduleDate(undefined);
      setScheduleTime('');
      setExpiresDate(undefined);
      setExpiresTime('');
    }
  }, [announcement, open]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('Not authenticated');

      // Build scheduled_at datetime
      let scheduled_at: string | null = null;
      if (scheduleDate) {
        const time = scheduleTime || '09:00';
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledDateTime = new Date(scheduleDate);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
        scheduled_at = scheduledDateTime.toISOString();
      }

      // Build expires_at datetime
      let expires_at: string | null = null;
      if (expiresDate) {
        const time = expiresTime || '23:59';
        const [hours, minutes] = time.split(':').map(Number);
        const expiresDateTime = new Date(expiresDate);
        expiresDateTime.setHours(hours, minutes, 0, 0);
        expires_at = expiresDateTime.toISOString();
      }

      const announcementData = {
        title: title.trim(),
        content: content.trim(),
        priority,
        is_pinned: isPinned,
        scheduled_at,
        expires_at,
        user_id: authData.user.id,
      };

      if (announcement) {
        // Update existing
        const { data, error } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', announcement.id)
          .select()
          .single();

        if (error) throw error;
        
        onSave(data);
        toast.success('Announcement updated');
      } else {
        // Create new
        const { data, error } = await supabase
          .from('announcements')
          .insert(announcementData)
          .select()
          .single();

        if (error) throw error;
        
        onSave(data);
        toast.success('Announcement published');
      }
      
      onOpenChange(false);
    } catch (error) {
      logger.error('Error saving announcement:', error);
      toast.error('Failed to save announcement');
    } finally {
      setIsSaving(false);
    }
  };

  const clearSchedule = () => {
    setScheduleDate(undefined);
    setScheduleTime('');
  };

  const clearExpires = () => {
    setExpiresDate(undefined);
    setExpiresTime('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {announcement ? 'Edit Announcement' : 'Create Announcement'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {announcement ? 'Update the announcement details' : 'Create a new announcement for all users'}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
              className="bg-secondary/50 border-border/50 focus:border-primary"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement..."
              rows={4}
              className="bg-secondary/50 border-border/50 focus:border-primary resize-none"
            />
          </div>

          {/* Priority & Pin */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: 'low' | 'medium' | 'high') => setPriority(v)}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Normal</SelectItem>
                  <SelectItem value="medium">High</SelectItem>
                  <SelectItem value="high">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pin to top</Label>
              <Button
                type="button"
                variant={isPinned ? "default" : "outline"}
                className={cn(
                  "w-full justify-start",
                  isPinned ? "bg-primary hover:bg-primary/90" : "bg-secondary/50 border-border/50"
                )}
                onClick={() => setIsPinned(!isPinned)}
              >
                {isPinned ? <Pin className="h-4 w-4 mr-2" /> : <PinOff className="h-4 w-4 mr-2" />}
                {isPinned ? 'Pinned' : 'Not Pinned'}
              </Button>
            </div>
          </div>

          {/* Schedule (optional) */}
          <div className="space-y-2">
            <Label>Schedule (optional)</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal bg-secondary/50 border-border/50",
                      !scheduleDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleDate ? format(scheduleDate, 'MMMM do, yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              {scheduleDate && (
                <>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-[130px] pl-10 bg-secondary/50 border-border/50"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-loss hover:text-loss/80"
                    onClick={clearSchedule}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            {scheduleDate && scheduleTime && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Will be published on {format(scheduleDate, 'MMM d, yyyy')} at {scheduleTime}
              </p>
            )}
          </div>

          {/* Expires (optional) */}
          <div className="space-y-2">
            <Label>Expires (optional)</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal bg-secondary/50 border-border/50",
                      !expiresDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiresDate ? format(expiresDate, 'MMMM do, yyyy') : 'Pick expiration date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                  <Calendar
                    mode="single"
                    selected={expiresDate}
                    onSelect={setExpiresDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              {expiresDate && (
                <>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={expiresTime}
                      onChange={(e) => setExpiresTime(e.target.value)}
                      className="w-[130px] pl-10 bg-secondary/50 border-border/50"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-loss hover:text-loss/80"
                    onClick={clearExpires}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            {expiresDate && expiresTime && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Will disappear on {format(expiresDate, 'MMM d, yyyy')} at {expiresTime}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <Button
          onClick={handleSave}
          disabled={!title.trim() || !content.trim() || isSaving}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {announcement ? 'Update Announcement' : 'Publish Announcement'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
