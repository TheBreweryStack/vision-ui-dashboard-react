import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ImagePlus, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, parseDateOnly } from '@/lib/utils';
import { Trade } from '@/lib/supabase';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ImportTradesTab } from './ImportTradesTab';

const tradeSchema = z.object({
  ticker: z.string().min(1, 'Ticker is required').max(10),
  trade_type: z.enum(['call', 'put', 'stock']),
  strike_price: z.number().optional(),
  expiration_date: z.date().optional(),
  entry_price: z.number().min(0, 'Entry price is required'),
  entry_date: z.date(),
  entry_time: z.string().optional(),
  exit_price: z.number().optional(),
  exit_date: z.date().optional(),
  exit_time: z.string().optional(),
  quantity: z.number().min(1).default(1),
  fees: z.number().optional(),
  strategy: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['open', 'closed']).default('open'),
});

type TradeFormData = z.infer<typeof tradeSchema>;

interface AddTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (trade: Omit<Trade, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<{ error: Error | null }>;
  editTrade?: Trade | null;
  inline?: boolean;
}

const QUICK_QUANTITIES = [1, 2, 5, 10];

export function AddTradeModal({ open, onOpenChange, onSubmit, editTrade, inline = false }: AddTradeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exitSectionOpen, setExitSectionOpen] = useState(false);
  const [customQuantity, setCustomQuantity] = useState('');
  const [activeTab, setActiveTab] = useState('trade');
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [expirationOpen, setExpirationOpen] = useState(false);
  const [entryDateOpen, setEntryDateOpen] = useState(false);
  const [exitDateOpen, setExitDateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<TradeFormData>({
    resolver: zodResolver(tradeSchema),
    defaultValues: editTrade ? {
      ticker: editTrade.ticker,
      trade_type: editTrade.trade_type as 'call' | 'put' | 'stock',
      strike_price: editTrade.strike_price || undefined,
      expiration_date: editTrade.expiration_date ? parseDateOnly(editTrade.expiration_date) : undefined,
      entry_price: editTrade.entry_price,
      entry_date: editTrade.entry_date ? parseDateOnly(editTrade.entry_date) : new Date(),
      entry_time: editTrade.entry_time || '',
      exit_price: editTrade.exit_price || undefined,
      exit_date: editTrade.exit_date ? parseDateOnly(editTrade.exit_date) : undefined,
      exit_time: editTrade.exit_time || '',
      quantity: editTrade.quantity,
      strategy: editTrade.strategy || '',
      notes: editTrade.notes || '',
      status: editTrade.status as 'open' | 'closed',
    } : {
      ticker: '',
      trade_type: 'call',
      entry_date: new Date(),
      entry_time: format(new Date(), 'HH:mm'),
      quantity: 1,
      status: 'open',
    },
  });

  useEffect(() => {
    if (open) {
      if (editTrade) {
        form.reset({
          ticker: editTrade.ticker,
          trade_type: editTrade.trade_type as 'call' | 'put' | 'stock',
          strike_price: editTrade.strike_price || undefined,
          expiration_date: editTrade.expiration_date ? parseDateOnly(editTrade.expiration_date) : undefined,
          entry_price: editTrade.entry_price,
          entry_date: editTrade.entry_date ? parseDateOnly(editTrade.entry_date) : new Date(),
          entry_time: editTrade.entry_time || '',
          exit_price: editTrade.exit_price || undefined,
          exit_date: editTrade.exit_date ? parseDateOnly(editTrade.exit_date) : undefined,
          exit_time: editTrade.exit_time || '',
          quantity: editTrade.quantity,
          strategy: editTrade.strategy || '',
          notes: editTrade.notes || '',
          status: editTrade.status as 'open' | 'closed',
        });
        setExitSectionOpen(!!editTrade.exit_price);
        setImages(editTrade.images || []);
      } else {
        form.reset({
          ticker: '',
          trade_type: 'call',
          entry_date: new Date(),
          entry_time: format(new Date(), 'HH:mm'),
          quantity: 1,
          status: 'open',
        });
        setExitSectionOpen(false);
        setImages([]);
      }
      setCustomQuantity('');
      setActiveTab('trade');
    }
  }, [open, editTrade, form]);

  const watchEntryPrice = form.watch('entry_price');
  const watchExitPrice = form.watch('exit_price');
  const watchQuantity = form.watch('quantity');
  const watchType = form.watch('trade_type');

  const calculatePnL = () => {
    if (!watchExitPrice || !watchEntryPrice) return null;
    const multiplier = watchType === 'stock' ? 1 : 100;
    const gross = (watchExitPrice - watchEntryPrice) * watchQuantity * multiplier;
    return gross;
  };

  const pnl = calculatePnL();

  const handleSubmit = async (data: TradeFormData) => {
    setIsSubmitting(true);
    try {
      const tradeData = {
        ticker: data.ticker.toUpperCase(),
        trade_type: data.trade_type,
        strike_price: data.strike_price || null,
        expiration_date: data.expiration_date ? format(data.expiration_date, 'yyyy-MM-dd') : null,
        entry_price: data.entry_price,
        entry_date: format(data.entry_date, 'yyyy-MM-dd'),
        entry_time: data.entry_time || null,
        exit_price: data.exit_price || null,
        exit_date: data.exit_date ? format(data.exit_date, 'yyyy-MM-dd') : null,
        exit_time: data.exit_time || null,
        quantity: data.quantity,
        strategy: data.strategy || null,
        notes: data.notes || null,
        status: (data.exit_price ? 'closed' : 'open') as 'open' | 'closed',
        pnl: pnl,
        images: images.length > 0 ? images : null,
      };

      const { error } = await onSubmit(tradeData);
      if (!error) {
        form.reset();
        setImages([]);
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuantitySelect = (qty: number) => {
    form.setValue('quantity', qty);
    setCustomQuantity('');
  };

  const handleCustomQuantityChange = (value: string) => {
    setCustomQuantity(value);
    const num = parseInt(value);
    if (num > 0) {
      form.setValue('quantity', num);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const uploadPromises = Array.from(files).map(async (file) => {
        if (!file.type.startsWith('image/')) {
          toast.error('Please upload image files only');
          return null;
        }

        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image must be less than 5MB');
          return null;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: signedUrlData } = await supabase.storage
          .from('trade-images')
          .createSignedUrl(fileName, 604800);

        return signedUrlData?.signedUrl;
      });

      const results = await Promise.all(uploadPromises);
      const validUrls = results.filter(Boolean) as string[];
      
      if (validUrls.length > 0) {
        setImages(prev => [...prev, ...validUrls]);
        toast.success(`${validUrls.length} image(s) uploaded`);
      }
    } catch (error: unknown) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-4">
            <TabsList className="grid w-full grid-cols-3 h-10">
              <TabsTrigger value="trade" className="text-sm">Trade Details</TabsTrigger>
              <TabsTrigger value="extra" className="text-sm">Strategy & Notes</TabsTrigger>
              <TabsTrigger value="import" className="text-sm">Import Trades</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1">
            <TabsContent value="trade" className="p-4 space-y-4 mt-0">
              {/* Ticker & Type */}
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="ticker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] text-muted-foreground">Ticker</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="AAPL"
                          className="uppercase bg-secondary/50 border-border h-9 text-sm"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trade_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] text-muted-foreground">Type</FormLabel>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          className={cn(
                            'flex-1 h-9 text-xs font-medium transition-all border',
                            field.value === 'call' 
                              ? 'bg-profit text-white border-profit hover:bg-profit/90' 
                              : 'bg-transparent border-border text-muted-foreground hover:bg-secondary/50'
                          )}
                          onClick={() => field.onChange('call')}
                        >
                          Call
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className={cn(
                            'flex-1 h-9 text-xs font-medium transition-all border',
                            field.value === 'put' 
                              ? 'bg-loss text-white border-loss hover:bg-loss/90' 
                              : 'bg-transparent border-border text-muted-foreground hover:bg-secondary/50'
                          )}
                          onClick={() => field.onChange('put')}
                        >
                          Put
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className={cn(
                            'flex-1 h-9 text-xs font-medium transition-all border',
                            field.value === 'stock' 
                              ? 'bg-muted-foreground text-white border-muted-foreground' 
                              : 'bg-transparent border-border text-muted-foreground hover:bg-secondary/50'
                          )}
                          onClick={() => field.onChange('stock')}
                        >
                          Stock
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Strike & Expiration (Options only) */}
              {watchType !== 'stock' && (
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="strike_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] text-muted-foreground">Strike</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="0.00"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              className="bg-secondary/50 border-border h-9 pl-5 text-sm"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expiration_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] text-muted-foreground">Expiration</FormLabel>
                        <Popover open={expirationOpen} onOpenChange={setExpirationOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full justify-start text-left font-normal bg-secondary/50 border-border h-9 text-xs',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className="mr-1 h-3 w-3" />
                                {field.value ? format(field.value, 'MMM d') : 'Pick'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-card border-border pointer-events-auto z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setExpirationOpen(false);
                              }}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Entry Section */}
              <div className="space-y-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <h4 className="text-[10px] font-medium text-primary">Entry</h4>
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="entry_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] text-muted-foreground">Price</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              className="bg-secondary/50 border-border h-9 pl-5 text-sm"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="entry_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] text-muted-foreground">Date</FormLabel>
                        <Popover open={entryDateOpen} onOpenChange={setEntryDateOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full justify-start text-left font-normal bg-secondary/50 border-border h-9 text-xs',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className="mr-1 h-3 w-3" />
                                {field.value ? format(field.value, 'MMM d') : 'Pick'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-card border-border pointer-events-auto z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setEntryDateOpen(false);
                              }}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="entry_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] text-muted-foreground">Time</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            className="bg-secondary/50 border-border h-9 text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] text-muted-foreground">Qty</FormLabel>
                        <div className="flex gap-1">
                          {QUICK_QUANTITIES.map(qty => (
                            <Button
                              key={qty}
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn(
                                'flex-1 h-9 min-w-0 px-1 text-xs',
                                field.value === qty && !customQuantity && 'bg-primary text-primary-foreground border-primary'
                              )}
                              onClick={() => handleQuantitySelect(qty)}
                            >
                              {qty}
                            </Button>
                          ))}
                          <Input
                            type="number"
                            placeholder="..."
                            value={customQuantity}
                            onChange={(e) => handleCustomQuantityChange(e.target.value)}
                            className="w-10 h-9 bg-secondary/50 border-border text-center px-1 text-xs"
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Exit Section (Collapsible) */}
              <Collapsible open={exitSectionOpen} onOpenChange={setExitSectionOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-9 bg-secondary/30 text-xs"
                  >
                    <span className="text-[10px] font-medium">Exit (Optional)</span>
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform",
                      exitSectionOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="space-y-2 p-2.5 rounded-lg bg-secondary/30 border border-border">
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name="exit_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-muted-foreground">Price</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                  className="bg-secondary/50 border-border h-9 pl-5 text-sm"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="exit_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] text-muted-foreground">Date</FormLabel>
                            <Popover open={exitDateOpen} onOpenChange={setExitDateOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      'w-full justify-start text-left font-normal bg-secondary/50 border-border h-9 text-xs',
                                      !field.value && 'text-muted-foreground'
                                    )}
                                  >
                                    <CalendarIcon className="mr-1 h-3 w-3" />
                                    {field.value ? format(field.value, 'MMM d') : 'Pick'}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-card border-border pointer-events-auto z-50" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={(date) => {
                                    field.onChange(date);
                                    setExitDateOpen(false);
                                  }}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="exit_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-muted-foreground">Time</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              className="bg-secondary/50 border-border h-9 text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Fees */}
              <FormField
                control={form.control}
                name="fees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-muted-foreground">Fees (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="bg-secondary/50 border-border h-9 pl-5 text-sm"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="extra" className="p-4 space-y-4 mt-0">
              {/* Strategy */}
              <FormField
                control={form.control}
                name="strategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-muted-foreground">Strategy</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary/50 border-border h-9 text-sm">
                          <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border z-50">
                        <SelectItem value="scalp">Scalp</SelectItem>
                        <SelectItem value="swing">Swing</SelectItem>
                        <SelectItem value="day_trade">Day Trade</SelectItem>
                        <SelectItem value="momentum">Momentum</SelectItem>
                        <SelectItem value="breakout">Breakout</SelectItem>
                        <SelectItem value="reversal">Reversal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] text-muted-foreground">Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Trade notes, observations, lessons learned..."
                        className="bg-secondary/50 border-border min-h-[100px] resize-none text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground">Screenshots</label>
                <div className="flex flex-wrap gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={img} 
                        alt={`Trade screenshot ${idx + 1}`}
                        className="h-16 w-16 object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-loss text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="h-16 w-16 rounded-lg border border-dashed border-border bg-secondary/30 flex items-center justify-center hover:bg-secondary/50 transition-colors"
                  >
                    {isUploadingImage ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <p className="text-[10px] text-muted-foreground">Add screenshots of your trade setup</p>
              </div>
            </TabsContent>

            <TabsContent value="import" className="mt-0">
              <ImportTradesTab onClose={() => onOpenChange(false)} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer - Always visible */}
        <div className="shrink-0 p-4 border-t border-border space-y-3 bg-card">
          {/* P&L Display */}
          {pnl !== null && (
            <div className={cn(
              'p-3 rounded-lg text-center font-semibold',
              pnl >= 0 ? 'bg-profit/10 text-profit border border-profit/20' : 'bg-loss/10 text-loss border border-loss/20'
            )}>
              Est. P&L: {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : editTrade ? 'Update' : 'Save Trade'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );

  if (inline) {
    return formContent;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[95vw] max-w-[500px] p-0 flex flex-col max-h-[90vh] md:max-h-none md:h-auto">
        <DialogHeader className="shrink-0 px-4 py-3 border-b border-border">
          <DialogTitle className="text-foreground">
            {editTrade ? 'Edit Trade' : 'Add Trade'}
          </DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
