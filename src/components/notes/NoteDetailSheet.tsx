import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Note, supabase } from '@/lib/supabase';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Save, Trash2, Share2, Pin, Bold, Italic, Heading2, List, 
  Eye, Plus, Image, Link, X, Check, Loader2, ExternalLink, Bell
} from 'lucide-react';
import { TickerLogo } from '@/components/common/TickerLogo';
import { NoteTasksSection } from '@/components/notes/NoteTasksSection';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

// Link Preview interface with AI summary
interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  summary?: string;
  url: string;
}

interface NoteDetailSheetProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (note: Note, updates: Partial<Note>) => Promise<void>;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'research', label: 'Research' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'news', label: 'News' },
] as const;

export const NoteDetailSheet: React.FC<NoteDetailSheetProps> = ({
  note,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onTogglePin,
}) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Note['category']>('general');
  const [ticker, setTicker] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreview>>({});
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fetchedLinksRef = useRef<Set<string>>(new Set());

  // Load note data
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content || '');
      setCategory(note.category);
      setTicker(note.ticker || '');
      setImages(note.images || []);
      setLinks(note.links || []);
      setLinkPreviews({});
      fetchedLinksRef.current = new Set();
      setIsSaved(true);
    }
  }, [note]);

  // Fetch link previews with AI summaries
  useEffect(() => {
    const fetchPreviews = async () => {
      for (const link of links) {
        if (fetchedLinksRef.current.has(link)) continue;
        fetchedLinksRef.current.add(link);

        try {
          // Set initial preview with just the hostname
          setLinkPreviews(prev => ({
            ...prev,
            [link]: { url: link, title: new URL(link).hostname }
          }));

          // Call edge function for full preview with AI summary
          const { data, error } = await supabase.functions.invoke('link-preview', {
            body: { url: link }
          });

          if (!error && data) {
            setLinkPreviews(prev => ({
              ...prev,
              [link]: {
                url: link,
                title: data.title || new URL(link).hostname,
                description: data.description,
                image: data.image,
                summary: data.summary,
              }
            }));
          }
        } catch (err) {
          // Ignore errors for invalid URLs
          logger.error('Link preview error:', err);
        }
      }
    };

    if (links.length > 0) {
      fetchPreviews();
    }
  }, [links]);

  // Auto-save with debounce
  const handleAutoSave = useCallback(async () => {
    if (!note || isSaved) return;
    
    setIsSaving(true);
    try {
      await onSave(note, { 
        title, 
        content, 
        category, 
        ticker: ticker.trim().toUpperCase() || null,
        images,
        links
      });
      setIsSaved(true);
    } catch (error) {
      logger.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [note, title, content, category, ticker, images, links, isSaved, onSave]);

  // Debounced auto-save
  useEffect(() => {
    if (isSaved) return;
    
    const timer = setTimeout(() => {
      handleAutoSave();
    }, 1500);

    return () => clearTimeout(timer);
  }, [title, content, category, ticker, images, links, handleAutoSave, isSaved]);

  const markUnsaved = () => setIsSaved(false);

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = document.getElementById('note-content') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selected + after + content.substring(end);
    setContent(newContent);
    markUnsaved();
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const addImage = () => {
    if (newImageUrl.trim()) {
      setImages(prev => [...prev, newImageUrl.trim()]);
      setNewImageUrl('');
      markUnsaved();
    }
  };

  const addLink = () => {
    if (newLinkUrl.trim()) {
      setLinks(prev => [...prev, newLinkUrl.trim()]);
      setNewLinkUrl('');
      markUnsaved();
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    markUnsaved();
  };

  const removeLink = (index: number) => {
    const removedUrl = links[index];
    setLinks(prev => prev.filter((_, i) => i !== index));
    setLinkPreviews(prev => {
      const next = { ...prev };
      delete next[removedUrl];
      return next;
    });
    markUnsaved();
  };

  const handleManualSave = async () => {
    if (!note) return;
    setIsSaving(true);
    try {
      await onSave(note, { 
        title, 
        content, 
        category, 
        ticker: ticker.trim().toUpperCase() || null,
        images,
        links
      });
      setIsSaved(true);
    } catch (error) {
      logger.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!note) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" hideCloseButton className="w-full sm:max-w-2xl bg-card border-border p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border flex-shrink-0">
          <SheetDescription className="sr-only">Edit note details, content, and manage attachments</SheetDescription>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base">Note Details</SheetTitle>
              {isSaved ? (
                <Badge variant="outline" className="text-profit border-profit/30 bg-profit/10">
                  <Check className="h-3 w-3 mr-1" />
                  Saved
                </Badge>
              ) : isSaving ? (
                <Badge variant="outline" className="text-primary border-primary/30">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleManualSave} title="Save">
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Share">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onTogglePin(note.id, !note.is_pinned)}
                title={note.is_pinned ? "Unpin" : "Pin"}
              >
                <Pin className={cn("h-4 w-4", note.is_pinned && "fill-current text-primary")} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-loss hover:text-loss hover:bg-loss/10"
                onClick={() => {
                  if (confirm('Delete this note?')) {
                    onDelete(note.id);
                    onOpenChange(false);
                  }
                }}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); markUnsaved(); }}
            placeholder="Note title..."
            className="text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
          />

          {/* Category & Ticker */}
          <div className="flex items-center gap-2">
            <Select value={category} onValueChange={(v: Note['category']) => { setCategory(v); markUnsaved(); }}>
              <SelectTrigger className="w-[130px] h-8 bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={ticker}
              onChange={(e) => { setTicker(e.target.value); markUnsaved(); }}
              placeholder="AAPL"
              className="h-8 bg-secondary/50 border-border/50 w-[100px] uppercase"
            />
            {ticker && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/watchlist?ticker=${ticker.toUpperCase()}`);
                }}
                title="View on Watchlist"
              >
                <Bell className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Alerts</span>
              </Button>
            )}
          </div>

          {/* Editor Toolbar */}
          <div className="flex items-center gap-1 p-2 rounded-lg bg-secondary/30 border border-border/50">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => insertMarkdown('**', '**')}
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => insertMarkdown('*', '*')}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => insertMarkdown('## ')}
              title="Heading"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => insertMarkdown('- ')}
              title="List"
            >
              <List className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            <Button 
              variant={showPreview ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          </div>

          {/* Content Editor */}
          {showPreview ? (
            <div className="min-h-[200px] p-4 rounded-lg bg-secondary/30 border border-border/50 prose prose-invert prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(
                  content
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                    .replace(/^- (.*$)/gm, '<li>$1</li>')
                    .replace(/\n/g, '<br />')
                )
              }} />
            </div>
          ) : (
            <div className="space-y-1">
              <textarea
                id="note-content"
                value={content}
                onChange={(e) => { setContent(e.target.value); markUnsaved(); }}
                placeholder="Write your note..."
                className="w-full min-h-[200px] p-4 rounded-lg bg-secondary/30 border border-border/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Supports Markdown: **bold**, *italic*, ## heading, - lists
              </p>
            </div>
          )}

          {/* Images Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Images</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7">
                Upload
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="h-8 bg-secondary/50 border-border/50 flex-1"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addImage}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {images.length === 0 ? (
              <p className="text-sm text-muted-foreground">No images attached</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="h-16 w-16 object-cover rounded" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 bg-loss text-white opacity-0 group-hover:opacity-100"
                      onClick={() => removeImage(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Links Section with Previews */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Links</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLink()}
                placeholder="Add a link..."
                className="h-8 bg-secondary/50 border-border/50 flex-1"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addLink}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">No links attached</p>
            ) : (
              <div className="space-y-2">
                {links.map((url, i) => {
                  const preview = linkPreviews[url];
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50 group">
                      {preview?.image && (
                        <img 
                          src={preview.image} 
                          alt="" 
                          className="w-16 h-16 rounded object-cover flex-shrink-0"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-1">
                          {preview?.title || url}
                        </p>
                        {/* AI-generated summary */}
                        {preview?.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 bg-primary/5 p-1.5 rounded border-l-2 border-primary/30">
                            {preview.summary}
                          </p>
                        )}
                        {/* Fallback to description if no AI summary */}
                        {!preview?.summary && preview?.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {preview.description}
                          </p>
                        )}
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {new URL(url).hostname}
                        </a>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeLink(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          {/* Tasks Section */}
          <NoteTasksSection noteId={note.id} />

          {/* Metadata */}
          <div className="pt-4 border-t border-border/50 space-y-1">
            <p className="text-xs text-muted-foreground">
              Created: {format(new Date(note.created_at || new Date()), 'MMM d, yyyy \'at\' h:mm a')}
            </p>
            {note.updated_at && (
              <p className="text-xs text-muted-foreground">
                Updated: {format(new Date(note.updated_at), 'MMM d, yyyy \'at\' h:mm a')}
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};