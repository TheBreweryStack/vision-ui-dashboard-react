import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Upload, Save, RotateCcw, Loader2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAppSettings, TwoFAEnforcement } from '@/hooks/useAppSettings';
import { logger } from '@/lib/logger';

interface AppSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ColorSetting {
  label: string;
  key: string;
  defaultValue: string;
}

const colorSettings: ColorSetting[] = [
  { label: 'Primary / Accent Color', key: 'primary', defaultValue: '142 70% 45%' },
  { label: 'Main Text Color', key: 'foreground', defaultValue: '220 15% 95%' },
  { label: 'Secondary Text Color', key: 'muted-foreground', defaultValue: '220 10% 55%' },
  { label: 'Profit / Success Color', key: 'profit', defaultValue: '142 70% 45%' },
  { label: 'Loss / Error Color', key: 'loss', defaultValue: '0 72% 51%' },
  { label: 'Background Color', key: 'background', defaultValue: '220 25% 6%' },
  { label: 'Card / Panel Color', key: 'card', defaultValue: '0 0% 100%' },
];

const TWOFA_OPTIONS: { value: TwoFAEnforcement; label: string; description: string }[] = [
  { value: 'disabled', label: 'Disabled', description: '2FA feature hidden from users' },
  { value: 'optional', label: 'Optional', description: 'Users can choose to enable 2FA' },
  { value: 'prompted', label: 'Strongly Prompted', description: 'Banner encourages users to set up 2FA' },
  { value: 'mandatory', label: 'Mandatory', description: 'Users must set up 2FA to access the app' },
];

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({ open, onOpenChange }) => {
  const { settings: appSettings, refetch: refetchAppSettings } = useAppSettings();
  
  const [appName, setAppName] = useState('TraderCafé');
  const [appDescription, setAppDescription] = useState('Your personal trading journal and market analysis platform');
  const [showLogoInSidebar, setShowLogoInSidebar] = useState(true);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [twofaEnforcement, setTwofaEnforcement] = useState<TwoFAEnforcement>('optional');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing settings when modal opens
  useEffect(() => {
    if (open && appSettings) {
      setAppName(appSettings.app_name || 'TraderCafé');
      setAppDescription(appSettings.app_description || 'Your personal trading journal and market analysis platform');
      setShowLogoInSidebar(appSettings.show_logo ?? true);
      setTwofaEnforcement(appSettings.twofa_enforcement || 'optional');
    }
  }, [open, appSettings]);

  const handleColorChange = (key: string, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setColors({});
    setAppName('TraderCafé');
    setAppDescription('Your personal trading journal and market analysis platform');
    setTwofaEnforcement('optional');
    toast.success('Settings reset to defaults');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // First check if a settings row exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      const settingsData = {
        app_name: appName,
        app_description: appDescription,
        show_logo: showLogoInSidebar,
        twofa_enforcement: twofaEnforcement,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing row
        const { error } = await supabase
          .from('app_settings')
          .update(settingsData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new row
        const { error } = await supabase
          .from('app_settings')
          .insert(settingsData);

        if (error) throw error;
      }

      refetchAppSettings();
      toast.success('Settings saved successfully');
      onOpenChange(false);
    } catch (error: unknown) {
      logger.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const parseHSL = (hsl: string): { h: number; s: number; l: number } => {
    const parts = hsl.split(' ').map(p => parseFloat(p));
    return { h: parts[0] || 0, s: parts[1] || 0, l: parts[2] || 0 };
  };

  const formatHSL = (h: number, s: number, l: number): string => {
    return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            App Settings
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Customize your app's branding and appearance.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Branding Section */}
          <div className="content-card">
            <h3 className="text-sm font-semibold text-foreground mb-1">Branding</h3>
            <p className="text-xs text-muted-foreground mb-4">Update your app's name, description, and logo.</p>

            <div className="space-y-4">
              {/* Logo */}
              <div className="flex items-start gap-4">
                <div>
                  <Label className="text-xs">App Logo</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg bg-secondary/50 flex items-center justify-center border border-border/50 overflow-hidden">
                      <img src="/app-icon.png" alt="App Logo" className="h-full w-full object-cover" />
                    </div>
                    <Button variant="outline" size="sm" className="btn-glass border-border/50">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">PNG, SVG, or JPG, max 2MB. Any size works.</p>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs">Show logo in sidebar</Label>
                  <Switch
                    checked={showLogoInSidebar}
                    onCheckedChange={setShowLogoInSidebar}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>

              {/* App Name */}
              <div className="space-y-2">
                <Label htmlFor="appName">App Name</Label>
                <Input
                  id="appName"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>

              {/* App Description */}
              <div className="space-y-2">
                <Label htmlFor="appDescription">App Description</Label>
                <Textarea
                  id="appDescription"
                  value={appDescription}
                  onChange={(e) => setAppDescription(e.target.value)}
                  className="bg-secondary/50 border-border/50 resize-none"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Security Settings */}
          <div className="content-card">
            <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security Settings
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Control security features for all users.</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twofaEnforcement">Two-Factor Authentication Policy</Label>
                <Select value={twofaEnforcement} onValueChange={(value) => setTwofaEnforcement(value as TwoFAEnforcement)}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select 2FA policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {TWOFA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {twofaEnforcement === 'disabled' && 'Two-factor authentication will be completely hidden from users.'}
                  {twofaEnforcement === 'optional' && 'Users can choose to enable 2FA from their Settings page.'}
                  {twofaEnforcement === 'prompted' && 'Users will see a persistent banner encouraging them to set up 2FA.'}
                  {twofaEnforcement === 'mandatory' && 'Users must set up 2FA before they can access the app.'}
                </p>
              </div>
            </div>
          </div>

          <Separator />
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Color Customization
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customize all colors used throughout the app
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetToDefaults}
                className="btn-glass border-border/50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {colorSettings.map(setting => {
                const currentValue = colors[setting.key] || setting.defaultValue;
                const parsed = parseHSL(currentValue);
                
                return (
                  <div key={setting.key} className="space-y-2">
                    <Label className="text-xs">{setting.label}</Label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-9 w-9 rounded-lg border border-border/50 shrink-0"
                        style={{ backgroundColor: `hsl(${currentValue})` }}
                      />
                      <div 
                        className="h-9 w-9 rounded-lg border border-border/50 shrink-0 bg-card"
                        style={{ 
                          backgroundColor: setting.key.includes('foreground') 
                            ? 'hsl(var(--background))' 
                            : 'transparent'
                        }}
                      >
                        <div 
                          className="h-full w-full rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ color: `hsl(${currentValue})` }}
                        >
                          Aa
                        </div>
                      </div>
                      <Input
                        value={currentValue}
                        onChange={(e) => handleColorChange(setting.key, e.target.value)}
                        placeholder="142 70% 45%"
                        className="bg-secondary/50 border-border/50 text-sm font-mono"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90"
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
