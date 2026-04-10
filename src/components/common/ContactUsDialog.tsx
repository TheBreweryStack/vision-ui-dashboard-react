import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Send, Loader2, AlertTriangle, Lightbulb, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface ContactUsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RequestType = 'support' | 'product_idea' | 'urgent';

export function ContactUsDialog({ open, onOpenChange }: ContactUsDialogProps) {
  const { user, profile } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('support');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !body.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('contact-support', {
        body: { subject, body, requestType },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(data?.message || 'Your message has been sent!');
      onOpenChange(false);
      
      // Reset form
      setSubject('');
      setBody('');
      setRequestType('support');
    } catch (error: unknown) {
      logger.error('Error:', error);
      toast.error(error.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestTypes = [
    {
      value: 'support' as const,
      label: 'Support',
      description: 'Having an issue or need help',
      icon: HelpCircle,
      color: 'text-primary',
    },
    {
      value: 'product_idea' as const,
      label: 'Product Idea',
      description: 'Suggest a new feature',
      icon: Lightbulb,
      color: 'text-yellow-500',
    },
    {
      value: 'urgent' as const,
      label: 'Urgent',
      description: 'Critical issue or bug',
      icon: AlertTriangle,
      color: 'text-loss',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact Us</DialogTitle>
          <DialogDescription>
            We're here to help. Let us know what's on your mind.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Request Type */}
          <div className="space-y-2">
            <Label>What type of request is this?</Label>
            <RadioGroup
              value={requestType}
              onValueChange={(v) => setRequestType(v as RequestType)}
              className="grid grid-cols-3 gap-2"
            >
              {requestTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <label
                    key={type.value}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-colors",
                      requestType === type.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value={type.value} className="sr-only" />
                    <Icon className={cn("h-5 w-5", type.color)} />
                    <span className="text-xs font-medium">{type.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Brief summary of your request"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Describe your issue or idea in detail..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              required
            />
          </div>

          {/* User info display */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <p>Sending as: <span className="font-medium text-foreground">{profile?.display_name || user?.email}</span></p>
            <p>Email: <span className="font-medium text-foreground">{user?.email}</span></p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
