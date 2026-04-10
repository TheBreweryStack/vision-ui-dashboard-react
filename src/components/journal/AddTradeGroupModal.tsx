import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ImagePlus, X, Loader2, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
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
  quantity: z.number().min(1).default(1),
  fees: z.number().optional(),
  strategy: z.string().optional(),
  notes: z.string().optional(),
});

type TradeFormData = z.infer<typeof tradeSchema>;

interface AddTradeGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    ticker: string;
    trade_type: string;
    strike_price?: number | null;
    expiration_date?: string | null;
    entry_date: string;
    entry_time?: string | null;
    quantity: number;
    price: number;
    strategy?: string | null;
    notes?: string | null;
    images?: string[] | null;
  }) => Promise<{ data: unknown; error: Error | null }>;
}

const QUICK_QUANTITIES = [1, 2, 5, 10];

export function AddTradeGroupModal({ open, onOpenChange, onSubmit }: AddTradeGroupModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customQuantity, setCustomQuantity] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [expirationOpen, setExpirationOpen] = useState(false);
  const [entryDateOpen, setEntryDateOpen] = useState(false);
  const [exitDateOpen, setExitDateOpen] = useState(false);
  const [exitSectionOpen, setExitSectionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('trade');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<TradeFormData>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      ticker: '',
      trade_type: 'call',
      entry_date: new Date(),
      entry_time: format(new Date(), 'HH:mm'),
      quantity: 1,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        ticker: '',
        trade_type: 'call',
        entry_date: new Date(),
        entry_time: format(new Date(), 'HH:mm'),
        quantity: 1,
      });
      setCustomQuantity('');
      setImages([]);
      setActiveTab('trade');
      setExitSectionOpen(false);
    }
  }, [open, form]);

  const watchType = form.watch('trade_type');

  const handleSubmit = async (data: TradeFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await onSubmit({
        ticker: data.ticker.toUpperCase(),
        trade_type: data.trade_type,
        strike_price: data.strike_price || null,
        expiration_date: data.expiration_date ? format(data.expiration_date, 'yyyy-MM-dd') : null,
        entry_date: format(data.entry_date, 'yyyy-MM-dd'),
        entry_time: data.entry_time || null,
        quantity: data.quantity,
        price: data.entry_price,
        strategy: data.strategy || null,
        notes: data.notes || null,
        images: images.length > 0 ? images : null,
      });
      
      if (!error) {
        toast.success('Trade added successfully!');
        form.reset();
        setImages([]);
        onOpenChange(false);
      } else {
        toast.error('Failed to add trade');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col bg-card border-border p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="text-foreground">Add New Trade</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-3 h-10">
              <TabsTrigger value="trade" className="text-sm">Trade</TabsTrigger>
              <TabsTrigger value="extra" className="text-sm">Notes</TabsTrigger>
              <TabsTrigger value="import" className="text-sm">Import</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="trade" className="mt-0 h-full">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
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

                    <FormField
                      control={form.control}
                      name="entry_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-muted-foreground">Time (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              value={field.value || ''}
                              className="bg-secondary/50 border-border h-9 text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Quantity */}
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] text-muted-foreground">Quantity</FormLabel>
                        <div className="flex gap-1.5">
                          {QUICK_QUANTITIES.map((qty) => (
                            <Button
                              key={qty}
                              type="button"
                              size="sm"
                              className={cn(
                                'flex-1 h-8 text-xs font-medium transition-all border',
                                field.value === qty && !customQuantity
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-transparent border-border text-muted-foreground hover:bg-secondary/50'
                              )}
                              onClick={() => handleQuantitySelect(qty)}
                            >
                              {qty}
                            </Button>
                          ))}
                          <Input
                            type="number"
                            min="1"
                            placeholder="Other"
                            value={customQuantity}
                            onChange={(e) => handleCustomQuantityChange(e.target.value)}
                            className="w-16 h-8 text-xs text-center bg-secondary/50 border-border"
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Save Trade'
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="extra" className="mt-0 h-full">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
                  {/* Strategy */}
                  <FormField
                    control={form.control}
                    name="strategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] text-muted-foreground">Strategy</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., Momentum, Earnings play, Scalp"
                            className="bg-secondary/50 border-border h-9 text-sm"
                          />
                        </FormControl>
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
                            placeholder="Trade notes, reasoning, lessons learned..."
                            className="bg-secondary/50 border-border text-sm min-h-[100px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <FormLabel className="text-[10px] text-muted-foreground">Screenshots</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {images.map((url, index) => (
                        <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-background/80 rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-colors"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <ImagePlus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Trade'
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="import" className="mt-0 h-full">
              <ImportTradesTab onClose={() => onOpenChange(false)} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}