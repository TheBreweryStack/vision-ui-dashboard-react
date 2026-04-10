import { useState } from 'react';
import { format, isToday, isPast } from 'date-fns';
import { parseDateOnly } from '@/lib/utils';
import { formatTimeWithTimezone } from '@/lib/timeFormatting';
import { useAccountSettings } from '@/hooks/useAccountSettings';
import { Plus, Trash2, Calendar, Clock, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNoteTasks } from '@/hooks/useNoteTasks';
import { cn } from '@/lib/utils';

interface NoteTasksSectionProps {
  noteId: string;
}

export const NoteTasksSection = ({ noteId }: NoteTasksSectionProps) => {
  const { tasks, isLoading, addTask, toggleComplete, deleteTask } = useNoteTasks(noteId);
  const { settings } = useAccountSettings();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState<Date | undefined>();
  const [newReminderTime, setNewReminderTime] = useState('');
  const [newPriority, setNewPriority] = useState('medium');

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;

    // Pass reminder_time as HH:mm string - the hook will combine with due_date
    await addTask({
      title: newTitle.trim(),
      due_date: newDueDate ? format(newDueDate, 'yyyy-MM-dd') : null,
      reminder_time: newReminderTime || null,
      priority: newPriority,
    });

    // Reset form
    setNewTitle('');
    setNewDueDate(undefined);
    setNewReminderTime('');
    setNewPriority('medium');
    setShowAddForm(false);
  };

  const getDueDateColor = (dueDateStr: string | null | undefined) => {
    if (!dueDateStr) return 'text-muted-foreground';
    
    try {
      // Extract just the date portion (YYYY-MM-DD) to avoid timezone shift
      const dateOnly = dueDateStr.split('T')[0].split(' ')[0];
      const dueDate = parseDateOnly(dateOnly);
      if (isPast(dueDate) && !isToday(dueDate)) return 'text-destructive';
      if (isToday(dueDate)) return 'text-amber-500';
      return 'text-muted-foreground';
    } catch {
      return 'text-muted-foreground';
    }
  };

  const formatDueDate = (dueDateStr: string | null | undefined) => {
    if (!dueDateStr) return null;
    
    try {
      // Extract just the date portion (YYYY-MM-DD) to avoid timezone shift
      const dateOnly = dueDateStr.split('T')[0].split(' ')[0];
      const dueDate = parseDateOnly(dateOnly);
      if (isToday(dueDate)) return 'Today';
      return format(dueDate, 'MMM d');
    } catch {
      return dueDateStr;
    }
  };

  const formatReminderTime = (dueAtStr: string | null | undefined) => {
    if (!dueAtStr) return null;
    
    try {
      // Use timezone-aware formatting with user's timezone
      return formatTimeWithTimezone(dueAtStr, {
        userTimezone: settings?.timezone || undefined,
        showTimezone: true,
      });
    } catch {
      return null;
    }
  };

  const incompleteTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  return (
    <div className="rounded-lg bg-secondary/30 border border-border/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Tasks</span>
          {tasks.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({incompleteTasks.length} remaining)
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-7 px-2"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <div className="mb-3 p-3 rounded-md bg-background/50 border border-border/30 space-y-3">
          <Input
            placeholder="Task title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTitle.trim()) handleAddTask();
              if (e.key === 'Escape') setShowAddForm(false);
            }}
          />
          
          <div className="flex flex-wrap gap-2">
            {/* Due Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {newDueDate ? format(newDueDate, 'MMM d') : 'Due date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={newDueDate}
                  onSelect={setNewDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Reminder Time (only if due date set) */}
            {newDueDate && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <Input
                  type="time"
                  value={newReminderTime}
                  onChange={(e) => setNewReminderTime(e.target.value)}
                  className="h-7 w-24 text-xs"
                  placeholder="Time"
                />
              </div>
            )}

            {/* Priority */}
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
              className="h-7"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddTask}
              disabled={!newTitle.trim()}
              className="h-7"
            >
              Add Task
            </Button>
          </div>
        </div>
      )}

      {/* Task List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-2">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          No tasks yet. Add action items for this entry.
        </div>
      ) : (
        <div className="space-y-1">
          {/* Incomplete Tasks */}
          {incompleteTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-background/50 group"
            >
              <Checkbox
                checked={task.is_completed}
                onCheckedChange={() => toggleComplete(task.id, task.is_completed)}
                className="h-4 w-4"
              />
              <span className="flex-1 text-sm truncate">{task.title}</span>
              
              {task.due_date && (
                <span className={cn('text-xs flex items-center gap-1', getDueDateColor(task.due_date))}>
                  <Calendar className="h-3 w-3" />
                  {formatDueDate(task.due_date)}
                  {formatReminderTime(task.due_at) && (
                    <span className="text-muted-foreground">
                      {formatReminderTime(task.due_at)}
                    </span>
                  )}
                </span>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteTask(task.id)}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground pt-2 pb-1">
                Completed ({completedTasks.length})
              </div>
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-background/50 group opacity-60"
                >
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => toggleComplete(task.id, task.is_completed)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 text-sm truncate line-through">{task.title}</span>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTask(task.id)}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
