import React, { useState, useEffect } from 'react';
import { useReminders } from '@/hooks/useReminders';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Reminder } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { TickerLogo } from '@/components/common/TickerLogo';
import { 
  Plus, Bell, Clock, AlertCircle, CheckCircle2, 
  Trash2, Edit, Calendar, Loader2, BellRing, BellOff,
  AlarmClock, DollarSign, TrendingUp, TrendingDown
} from 'lucide-react';
import { format, parseISO, isPast, isToday, addMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';


interface PriceAlert {
  id: string;
  alert_type: string;
  threshold: number | null;
  is_active: boolean;
  watchlist_item_id: string;
  ticker?: string;
  created_at: string;
}

const Alerts: React.FC = () => {
  const { user } = useAuth();
  const { 
    groupedReminders, 
    isLoading: remindersLoading, 
    addReminder, 
    updateReminder, 
    deleteReminder, 
    toggleComplete 
  } = useReminders();
  
  
  const [activeTab, setActiveTab] = useState('reminders');
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reminder form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [ticker, setTicker] = useState('');
  

  // Fetch price alerts
  useEffect(() => {
    const fetchPriceAlerts = async () => {
      if (!user) return;
      
      setAlertsLoading(true);
      try {
        // Fetch alerts with watchlist item info
        const { data: alerts, error } = await supabase
          .from('alerts')
          .select(`
            *,
            watchlist_items!inner(ticker)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const formattedAlerts = alerts?.map(alert => ({
          ...alert,
          ticker: (alert.watchlist_items as { ticker?: string } | null)?.ticker
        })) || [];
        
        setPriceAlerts(formattedAlerts);
      } catch (error) {
        logger.error('Error fetching price alerts:', error);
      } finally {
        setAlertsLoading(false);
      }
    };

    fetchPriceAlerts();
  }, [user]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate(format(new Date(), 'yyyy-MM-dd'));
    setDueTime('09:30');
    setPriority('medium');
    setTicker('');
    setEditReminder(null);
  };

  const openModal = (reminder?: Reminder) => {
    if (reminder) {
      setEditReminder(reminder);
      setTitle(reminder.title);
      setDescription(reminder.description || '');
      setDueDate(reminder.due_date || format(new Date(), 'yyyy-MM-dd'));
      setDueTime(reminder.reminder_time || '09:30');
      setPriority(reminder.priority);
      setTicker(reminder.ticker || '');
      
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate) return;
    
    
    setIsSaving(true);
    try {
      const data = {
        title,
        description: description || null,
        due_date: dueDate,
        reminder_time: dueTime || null,
        priority,
        ticker: ticker.toUpperCase() || null,
        is_completed: false,
      };

      if (editReminder) {
        await updateReminder(editReminder.id, data);
      } else {
        await addReminder(data);
        
      }
      setShowModal(false);
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this reminder?')) {
      await deleteReminder(id);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm('Delete this price alert?')) return;
    
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      
      setPriceAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alert deleted');
    } catch (error) {
      toast.error('Failed to delete alert');
    }
  };

  const handleToggleAlert = async (alert: PriceAlert) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_active: !alert.is_active })
        .eq('id', alert.id);

      if (error) throw error;
      
      setPriceAlerts(prev => prev.map(a => 
        a.id === alert.id ? { ...a, is_active: !a.is_active } : a
      ));
      toast.success(alert.is_active ? 'Alert disabled' : 'Alert enabled');
    } catch (error) {
      toast.error('Failed to update alert');
    }
  };

  const handleSnooze = async (reminder: Reminder, minutes: number) => {
    const now = new Date();
    const newTime = addMinutes(now, minutes);
    
    await updateReminder(reminder.id, {
      due_date: format(newTime, 'yyyy-MM-dd'),
      reminder_time: format(newTime, 'HH:mm'),
    });
    
    toast.success(`Snoozed for ${minutes} minutes`);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'badge-priority-high';
      case 'medium': return 'badge-priority-medium';
      default: return 'badge-priority-low';
    }
  };

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => {
    const isOverdue = isPast(parseISO(reminder.due_date)) && !isToday(parseISO(reminder.due_date));
    
    return (
      <div className={cn(
        "content-card group hover:border-primary/30 transition-all",
        reminder.is_completed && "opacity-60"
      )}>
        <div className="flex items-start gap-3">
          <Checkbox
            checked={reminder.is_completed}
            onCheckedChange={(checked) => toggleComplete(reminder.id, checked as boolean)}
            className="mt-1"
          />
          {reminder.ticker && (
            <TickerLogo symbol={reminder.ticker} size="md" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className={cn(
                  "font-semibold text-foreground",
                  reminder.is_completed && "line-through text-muted-foreground"
                )}>
                  {reminder.title}
                </h3>
                {reminder.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {reminder.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {!reminder.is_completed && isOverdue && (
                  <Select onValueChange={(v) => handleSnooze(reminder, parseInt(v))}>
                    <SelectTrigger className="w-auto h-7 px-2 bg-secondary/50 border-border/50">
                      <AlarmClock className="h-3.5 w-3.5" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">Snooze 15 min</SelectItem>
                      <SelectItem value="30">Snooze 30 min</SelectItem>
                      <SelectItem value="60">Snooze 1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openModal(reminder)}
                  aria-label="Edit"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-loss hover:text-loss"
                  onClick={() => handleDelete(reminder.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge className={cn("text-[10px]", getPriorityColor(reminder.priority))}>
                {reminder.priority}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(reminder.due_date || new Date().toISOString()), 'MMM d')}
                {reminder.reminder_time && ` at ${reminder.reminder_time}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ title, icon: Icon, items, color }: { 
    title: string; 
    icon: React.ComponentType<{ className?: string }>; 
    items: Reminder[];
    color?: string;
  }) => {
    if (items.length === 0) return null;
    
    return (
      <div className="space-y-3">
        <h2 className={cn(
          "text-sm font-semibold uppercase tracking-wider flex items-center gap-2",
          color || "text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
          {title}
          <span className="text-xs font-normal">({items.length})</span>
        </h2>
        <div className="space-y-2">
          {items.map(r => <ReminderCard key={r.id} reminder={r} />)}
        </div>
      </div>
    );
  };

  const allReminders = [
    ...groupedReminders.overdue,
    ...groupedReminders.today,
    ...groupedReminders.tomorrow,
    ...groupedReminders.thisWeek,
    ...groupedReminders.later,
  ].filter(r => !r.is_completed);

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle hidden sm:block">Manage your reminders and price alerts</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'reminders' && (
            <Button 
              size="sm"
              onClick={() => openModal()} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 h-9"
            >
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Add Reminder</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-xs grid-cols-2 bg-secondary/50">
          <TabsTrigger value="reminders" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Reminders
          </TabsTrigger>
          <TabsTrigger value="price-alerts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Price Alerts
          </TabsTrigger>
        </TabsList>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="mt-6 space-y-6">
          {remindersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Section 
                title="Overdue" 
                icon={AlertCircle} 
                items={groupedReminders.overdue} 
                color="text-loss"
              />
              <Section 
                title="Today" 
                icon={Clock} 
                items={groupedReminders.today} 
                color="text-primary"
              />
              <Section 
                title="Tomorrow" 
                icon={Bell} 
                items={groupedReminders.tomorrow} 
              />
              <Section 
                title="This Week" 
                icon={Calendar} 
                items={groupedReminders.thisWeek} 
              />
              <Section 
                title="Later" 
                icon={Calendar} 
                items={groupedReminders.later} 
              />
              <Section 
                title="Completed" 
                icon={CheckCircle2} 
                items={groupedReminders.completed} 
              />

              {Object.values(groupedReminders).every(arr => arr.length === 0) && (
                <div className="content-card text-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending reminders</p>
                  <Button 
                    onClick={() => openModal()} 
                    className="mt-4 bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Reminder
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Price Alerts Tab */}
        <TabsContent value="price-alerts" className="mt-6 space-y-4">
          {alertsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : priceAlerts.length > 0 ? (
            <div className="space-y-3">
              {priceAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={cn(
                    "content-card flex items-center justify-between",
                    !alert.is_active && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {alert.ticker && <TickerLogo symbol={alert.ticker} size="md" />}
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {alert.ticker || 'Unknown'}
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          alert.is_active ? "bg-primary/10 text-primary border-primary/30" : "bg-muted"
                        )}>
                          {alert.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        {alert.alert_type === 'price_above' && (
                          <>
                            <TrendingUp className="h-3 w-3" />
                            Alert when above ${alert.threshold}
                          </>
                        )}
                        {alert.alert_type === 'price_below' && (
                          <>
                            <TrendingDown className="h-3 w-3" />
                            Alert when below ${alert.threshold}
                          </>
                        )}
                        {alert.alert_type === 'percent_change' && (
                          <>
                            <DollarSign className="h-3 w-3" />
                            Alert at {alert.threshold}% change
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={alert.is_active}
                      onCheckedChange={() => handleToggleAlert(alert)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-loss hover:text-loss"
                      onClick={() => handleDeleteAlert(alert.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="content-card text-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No price alerts set</p>
              <p className="text-sm text-muted-foreground mt-2">
                Add tickers to your watchlist and set price alerts there
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Reminder Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editReminder ? 'Edit Reminder' : 'New Reminder'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Reminder title..."
                className="bg-secondary/50 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                rows={3}
                className="bg-secondary/50 border-border/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueTime">Time</Label>
                <Input
                  id="dueTime"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticker">Ticker (optional)</Label>
                <Input
                  id="ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="AAPL"
                  className="bg-secondary/50 border-border/50"
                />
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!title.trim() || !dueDate || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editReminder ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alerts;
