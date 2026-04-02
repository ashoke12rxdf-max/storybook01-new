import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Save, Menu, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SettingsPanelMobile from '@/components/studio/SettingsPanelMobile';
import PreviewCanvas from '@/components/studio/PreviewCanvas';
import PublishPanel from '@/components/studio/PublishPanel';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const PreviewStudio = () => {
  const { storybookId } = useParams();
  const navigate = useNavigate();
  const [storybook, setStorybook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadStorybook = useCallback(async () => {
    try {
      const data = await api.getStorybook(storybookId);
      setStorybook(data);
      setSettings(data.settings);
    } catch (error) {
      toast.error('Failed to load storybook');
      navigate('/admin/dashboard');
    } finally {
      setLoading(false);
    }
  }, [storybookId, navigate]);

  useEffect(() => {
    loadStorybook();
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [loadStorybook]);

  const handleSave = async (newStatus = null) => {
    setSaving(true);
    try {
      const updateData = {
        settings: settings,
      };
      if (newStatus) {
        updateData.status = newStatus;
      }
      
      await api.updateStorybook(storybookId, updateData);
      toast.success(newStatus === 'published' ? 'Storybook published!' : 'Changes saved');
      
      if (newStatus) {
        await loadStorybook();
      }
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-magical-cream flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-magical-plum border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-magical-ink font-serif text-lg">Loading studio...</p>
        </div>
      </div>
    );
  }

  if (!storybook || !settings) {
    return null;
  }

  // Mobile layout: Single column with preview first
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-magical-cream">
        <header className="border-b border-magical-moon/30 bg-white/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
          <Button
            onClick={() => navigate('/admin/dashboard')}
            variant="ghost"
            size="sm"
            className="text-magical-plum hover:text-magical-ink p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <h2 className="font-serif text-lg text-magical-ink truncate max-w-[50%]">
            {storybook.title}
          </h2>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-magical-ink p-2">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md p-4 bg-white">
              <div className="space-y-3">
                <h3 className="font-serif text-xl text-magical-ink mb-4">Editor Menu</h3>
                <Button
                  onClick={() => {
                    handleSave();
                    setMobileMenuOpen(false);
                  }}
                  disabled={saving}
                  variant="outline"
                  className="w-full justify-start border-magical-moon/20 h-12"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  onClick={() => {
                    handleSave('published');
                    setMobileMenuOpen(false);
                  }}
                  disabled={saving}
                  className="w-full justify-start bg-magical-ink text-magical-cream hover:bg-magical-plum h-12"
                >
                  {storybook.status === 'published' ? 'Update' : 'Publish'}
                </Button>
                <Button
                  onClick={() => {
                    navigate('/admin/dashboard');
                  }}
                  variant="ghost"
                  className="w-full justify-start text-magical-plum h-12"
                >
                  <X className="w-4 h-4 mr-2" />
                  Exit Studio
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <div className="flex-1 overflow-y-auto pb-20">
          {/* Preview section - First and prominent */}
          <div className="bg-magical-ink p-4 min-h-[50vh] flex items-center justify-center">
            <div className="text-center">
              <Eye className="w-8 h-8 text-magical-cream mx-auto mb-2 opacity-50" />
              <p className="text-magical-cream/70 text-sm font-sans">Live Preview</p>
              <PreviewCanvas 
                storybook={storybook}
                settings={settings}
              />
            </div>
          </div>

          {/* Settings section - Collapsible accordions */}
          <div className="p-4">
            <SettingsPanelMobile 
              settings={settings} 
              updateSettings={updateSettings}
            />
          </div>

          {/* Sharing section */}
          <div className="px-4 pb-4">
            <PublishPanel 
              storybook={storybook}
              onUpdate={loadStorybook}
            />
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout: 3-panel
  return (
    <div className="h-screen flex flex-col bg-magical-cream">
      <header className="border-b border-magical-moon/30 bg-white/90 backdrop-blur-sm px-6 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/admin/dashboard')}
            variant="ghost"
            size="sm"
            className="text-magical-plum hover:text-magical-ink"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <div className="border-l border-magical-moon h-6" />
          <div>
            <h2 className="font-serif text-lg text-magical-ink">
              {storybook.title}
            </h2>
            <p className="text-xs text-magical-plum">
              {storybook.spreadCount} spreads · {storybook.orientation}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-sans ${
            storybook.status === 'published' 
              ? 'bg-magical-teal text-white' 
              : 'bg-magical-moon text-magical-ink'
          }`}>
            {storybook.status}
          </span>
          
          <Button
            onClick={() => handleSave()}
            disabled={saving}
            variant="outline"
            size="sm"
            className="border-magical-moon/20 rounded-full"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>

          <Button
            onClick={() => handleSave('published')}
            disabled={saving}
            className="bg-magical-ink text-magical-cream hover:bg-magical-plum rounded-full"
          >
            {storybook.status === 'published' ? 'Update' : 'Publish'}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <SettingsPanelMobile 
          settings={settings} 
          updateSettings={updateSettings}
        />

        <div className="flex-1 flex items-center justify-center bg-magical-ink p-8 overflow-auto">
          <PreviewCanvas 
            storybook={storybook}
            settings={settings}
          />
        </div>

        <PublishPanel 
          storybook={storybook}
          onUpdate={loadStorybook}
        />
      </div>
    </div>
  );
};

export default PreviewStudio;
