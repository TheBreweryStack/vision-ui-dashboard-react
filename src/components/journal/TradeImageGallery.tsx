import { useState, useRef } from 'react';
import { Image as ImageIcon, X, Upload, Loader2, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface TradeImageGalleryProps {
  images: string[];
  tradeId: string;
  onImagesChange: (images: string[]) => void;
  editable?: boolean;
}

export function TradeImageGallery({ 
  images, 
  tradeId, 
  onImagesChange, 
  editable = true 
}: TradeImageGalleryProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images per trade');
      return;
    }

    setIsUploading(true);
    const newImages: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
          continue;
        }

        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${tradeId}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('trade-images')
          .upload(fileName, file);

        if (error) {
          logger.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get signed URL (private bucket)
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from('trade-images')
          .createSignedUrl(data.path, 604800); // 7 days expiry

        if (urlError || !signedUrlData) {
          logger.error('Signed URL error:', urlError);
          toast.error(`Failed to get URL for ${file.name}`);
          continue;
        }

        newImages.push(signedUrlData.signedUrl);
      }

      if (newImages.length > 0) {
        const updatedImages = [...images, ...newImages];
        onImagesChange(updatedImages);
        toast.success(`${newImages.length} image${newImages.length > 1 ? 's' : ''} uploaded`);
      }
    } catch (error) {
      logger.error('Upload error:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async (imageUrl: string) => {
    try {
      // Extract path from URL
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/trade-images\/(.+)$/);
      
      if (pathMatch) {
        await supabase.storage
          .from('trade-images')
          .remove([pathMatch[1]]);
      }

      const updatedImages = images.filter(img => img !== imageUrl);
      onImagesChange(updatedImages);
      toast.success('Image removed');
    } catch (error) {
      logger.error('Remove error:', error);
      toast.error('Failed to remove image');
    }
  };

  if (images.length === 0 && !editable) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          SCREENSHOTS ({images.length}/5)
        </p>
        {editable && images.length < 5 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-8"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-3 w-3 mr-1" />
                Add
              </>
            )}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((imageUrl, index) => (
            <div
              key={index}
              className="relative aspect-video rounded-lg overflow-hidden border border-border group cursor-pointer"
              onClick={() => setPreviewImage(imageUrl)}
            >
              <img
                src={imageUrl}
                alt={`Trade screenshot ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="h-5 w-5" />
              </div>
              {editable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(imageUrl);
                  }}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-loss/80"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : editable ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-8 w-8" />
          <span className="text-sm">Click to upload screenshots</span>
          <span className="text-xs">PNG, JPG up to 5MB</span>
        </button>
      ) : null}

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl bg-card border-border p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img
              src={previewImage}
              alt="Trade screenshot preview"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}