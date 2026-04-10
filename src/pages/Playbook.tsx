import React, { useState, useMemo } from 'react';
import { useNotes } from '@/hooks/useNotes';
import { useNoteTaskCounts } from '@/hooks/useNoteTaskCounts';
import { Note } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { NoteDetailSheet } from '@/components/notes/NoteDetailSheet';
import { TickerLogo } from '@/components/common/TickerLogo';
import { QuickTaskAdd } from '@/components/notes/QuickTaskAdd';
import { 
  Plus, Search, Pin, PinOff, Trash2, Edit, FileText, 
  TrendingUp, Lightbulb, Calendar, Newspaper, Loader2, CheckSquare 
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'general', label: 'General', icon: FileText },
  { value: 'research', label: 'Research', icon: TrendingUp },
  { value: 'strategy', label: 'Strategy', icon: Lightbulb },
  { value: 'earnings', label: 'Earnings', icon: Calendar },
  { value: 'news', label: 'News', icon: Newspaper },
] as const;

const Playbook: React.FC = () => {
  const { notes, pinnedNotes, unpinnedNotes, isLoading, addNote, updateNote, deleteNote, togglePin, refetch } = useNotes();
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  // Get task counts for all notes
  const noteIds = useMemo(() => notes.map(n => n.id), [notes]);
  const { taskCounts, refetch: refetchTaskCounts } = useNoteTaskCounts(noteIds);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [ticker, setTicker] = useState('');

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('general');
    setTicker('');
    setEditNote(null);
  };

  const openModal = (note?: Note) => {
    if (note) {
      // Edit existing note - use modal
      setEditNote(note);
      setTitle(note.title);
      setContent(note.content || '');
      setCategory(note.category);
      setTicker(note.ticker || '');
      setShowModal(true);
    }
  };

  // Create new note and open full editor immediately
  const handleNewNote = async () => {
    setIsSaving(true);
    try {
      const result = await addNote({ 
        title: 'Untitled Note', 
        content: '', 
        category: 'general', 
        ticker: null, 
        is_pinned: false 
      });
      
      await refetch();
      
      // Find the newly created note and open detail sheet
      if (result && result.data) {
        setSelectedNote(result.data);
        setShowDetailSheet(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openNoteDetail = (note: Note) => {
    setSelectedNote(note);
    setShowDetailSheet(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    
    setIsSaving(true);
    
    try {
      if (editNote) {
        await updateNote(editNote.id, { title, content, category, ticker: ticker.trim().toUpperCase() || null });
        setShowModal(false);
        resetForm();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      await deleteNote(id);
    }
  };

  const handleSheetSave = async (note: Note, updates: Partial<Note>) => {
    await updateNote(note.id, updates);
    // Update the selected note to reflect changes
    setSelectedNote(prev => prev ? { ...prev, ...updates } : null);
  };

  // Filter notes
  const filterNotes = (noteList: Note[]) => {
    return noteList.filter(note => {
      const matchesSearch = 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.ticker || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || note.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  };

  const filteredPinned = filterNotes(pinnedNotes);
  const filteredUnpinned = filterNotes(unpinnedNotes);

  const getCategoryIcon = (cat: string) => {
    const found = CATEGORIES.find(c => c.value === cat);
    return found ? found.icon : FileText;
  };

  const NoteCard = ({ note }: { note: Note }) => {
    const CategoryIcon = getCategoryIcon(note.category);
    const counts = taskCounts[note.id];
    const hasIncompleteTasks = counts && counts.incomplete > 0;
    
    return (
      <div 
        className="content-card group hover:border-primary/30 transition-all cursor-pointer"
        onClick={() => openNoteDetail(note)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {note.ticker ? (
              <TickerLogo symbol={note.ticker} size="sm" />
            ) : (
              <CategoryIcon className="h-4 w-4 text-muted-foreground" />
            )}
            <Badge variant="outline" className="text-xs capitalize">
              {note.category}
            </Badge>
            {note.is_pinned && (
              <Pin className="h-3 w-3 text-primary fill-primary" />
            )}
            {/* Task count badge */}
            {counts && counts.total > 0 && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs gap-1",
                  hasIncompleteTasks 
                    ? "text-amber-500 border-amber-500/30 bg-amber-500/10" 
                    : "text-profit border-profit/30 bg-profit/10"
                )}
              >
                <CheckSquare className="h-3 w-3" />
                {hasIncompleteTasks 
                  ? `${counts.incomplete}/${counts.total}`
                  : <span>✓ {counts.total}</span>
                }
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Quick task add button */}
            <QuickTaskAdd noteId={note.id} onTaskAdded={refetchTaskCounts} />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                togglePin(note.id, !note.is_pinned);
              }}
            >
              {note.is_pinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                openModal(note);
              }}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-loss hover:text-loss"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(note.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{note.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{note.content}</p>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {format(new Date(note.created_at || new Date()), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in pt-2 md:pt-0">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Playbook</h1>
          <p className="page-subtitle hidden sm:block">Your trading knowledge base with ideas & research</p>
        </div>
        <Button 
          size="sm"
          onClick={handleNewNote}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 h-9"
        >
          {isSaving ? <Loader2 className="h-4 w-4 md:mr-2 animate-spin" /> : <Plus className="h-4 w-4 md:mr-2" />}
          <span className="hidden md:inline">New Note</span>
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[180px] bg-secondary/50 border-border/50">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pinned Notes */}
      {filteredPinned.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Pin className="h-3.5 w-3.5" />
            Pinned
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPinned.map(note => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}

      {/* All Notes */}
      <div>
        {filteredPinned.length > 0 && (
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            All Notes
          </h2>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredUnpinned.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUnpinned.map(note => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className="content-card text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || filterCategory !== 'all' 
                ? 'No notes match your search'
                : 'No notes yet. Create your first note!'}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editNote ? 'Edit Note' : 'New Note'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title..."
                className="bg-secondary/50 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note..."
                rows={6}
                className="bg-secondary/50 border-border/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticker">Ticker</Label>
                <Input
                  id="ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="AAPL"
                  className="bg-secondary/50 border-border/50 uppercase"
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
              disabled={!title.trim() || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editNote ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Detail Sheet */}
      <NoteDetailSheet
        note={selectedNote}
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        onSave={handleSheetSave}
        onDelete={handleDelete}
        onTogglePin={(id, isPinned) => togglePin(id, isPinned)}
      />
    </div>
  );
};

export default Playbook;