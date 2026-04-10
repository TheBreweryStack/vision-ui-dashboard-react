import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface QuickTaskAddProps {
  noteId: string;
  onTaskAdded?: () => void;
}

export const QuickTaskAdd = ({ noteId, onTaskAdded }: QuickTaskAddProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useAuth();

  const handleAddTask = async () => {
    if (!title.trim() || !user) return;

    setIsAdding(true);
    try {
      // Set due_at to end of day (23:59) in user's timezone for date-only tasks
      const dueAt = dueDate 
        ? new Date(`${format(dueDate, 'yyyy-MM-dd')}T23:59:00`).toISOString()
        : null;

      const { error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          note_id: noteId,
          title: title.trim(),
          due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
          due_at: dueAt,
          priority: 'medium',
          is_completed: false,
        });

      if (error) throw error;

      toast.success('Task added');
      setTitle('');
      setDueDate(undefined);
      setIsOpen(false);
      onTaskAdded?.();
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          title="Add task"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-3" 
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quick Add Task</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          
          <Input
            placeholder="Task title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) handleAddTask();
              if (e.key === 'Escape') setIsOpen(false);
            }}
          />
          
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  {dueDate ? format(dueDate, 'MMM d') : 'Due date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button
              size="sm"
              className="h-7"
              onClick={handleAddTask}
              disabled={!title.trim() || isAdding}
            >
              Add
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
