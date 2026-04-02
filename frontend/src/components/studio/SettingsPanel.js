import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ONE_PAGE_EFFECTS, TWO_PAGE_EFFECTS, NAVIGATION_STYLES } from '@/lib/effects';
import { BUILT_IN_SOUNDS } from '@/lib/sounds';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

const SettingsPanel = ({ settings, updateSettings }) => {
  const [expandedSections, setExpandedSections] = useState({
    effects: true,
    sound: false,
    navigation: false,
    styling: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="w-80 border-r border-magical-moon/30 bg-white/80 backdrop-blur-xl overflow-y-auto" data-testid="settings-panel">
      <div className="p-6 space-y-4">
        <h3 className="font-serif text-xl text-magical-ink mb-4">
          Customize Flipbook
        </h3>

        <Section 
          title="Flip Effects" 
          expanded={expandedSections.effects}
          onToggle={() => toggleSection('effects')}
        >
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-sans text-magical-ink">One-Page Effect</Label>
              <Select 
                value={settings.onePageEffect} 
                onValueChange={(value) => updateSettings('onePageEffect', value)}
              >
                <SelectTrigger className="mt-1" data-testid="one-page-effect-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONE_PAGE_EFFECTS.map(effect => (
                    <SelectItem key={effect.id} value={effect.id}>
                      {effect.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-magical-plum mt-1">
                {ONE_PAGE_EFFECTS.find(e => e.id === settings.onePageEffect)?.description}
              </p>
            </div>

            <div>
              <Label className="text-sm font-sans text-magical-ink">Two-Page Effect</Label>
              <Select 
                value={settings.twoPageEffect} 
                onValueChange={(value) => updateSettings('twoPageEffect', value)}
              >
                <SelectTrigger className="mt-1" data-testid="two-page-effect-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TWO_PAGE_EFFECTS.map(effect => (
                    <SelectItem key={effect.id} value={effect.id}>
                      {effect.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-magical-plum mt-1">
                {TWO_PAGE_EFFECTS.find(e => e.id === settings.twoPageEffect)?.description}
              </p>
            </div>

            <div>
              <Label className="text-sm font-sans text-magical-ink">Mobile Preferred</Label>
              <Select 
                value={settings.mobilePreferredEffect} 
                onValueChange={(value) => updateSettings('mobilePreferredEffect', value)}
              >
                <SelectTrigger className="mt-1" data-testid="mobile-effect-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONE_PAGE_EFFECTS.map(effect => (
                    <SelectItem key={effect.id} value={effect.id}>
                      {effect.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section 
          title="Sound" 
          expanded={expandedSections.sound}
          onToggle={() => toggleSection('sound')}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-sans text-magical-ink">Enable Sound</Label>
              <Switch
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => updateSettings('soundEnabled', checked)}
                data-testid="sound-enabled-switch"
              />
            </div>

            {settings.soundEnabled && (
              <>
                <div>
                  <Label className="text-sm font-sans text-magical-ink">Default Sound</Label>
                  <Select 
                    value={settings.defaultSound} 
                    onValueChange={(value) => updateSettings('defaultSound', value)}
                  >
                    <SelectTrigger className="mt-1" data-testid="default-sound-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(BUILT_IN_SOUNDS).map(soundName => (
                        <SelectItem key={soundName} value={soundName}>
                          {soundName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-magical-plum mt-1">
                    {BUILT_IN_SOUNDS[settings.defaultSound]?.description}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-sans text-magical-ink">
                    Volume: {Math.round(settings.soundVolume * 100)}%
                  </Label>
                  <Slider
                    value={[settings.soundVolume * 100]}
                    onValueChange={([value]) => updateSettings('soundVolume', value / 100)}
                    max={100}
                    step={5}
                    className="mt-2"
                    data-testid="sound-volume-slider"
                  />
                </div>
              </>
            )}
          </div>
        </Section>

        <Section 
          title="Navigation" 
          expanded={expandedSections.navigation}
          onToggle={() => toggleSection('navigation')}
        >
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-sans text-magical-ink">Navigation Style</Label>
              <Select 
                value={settings.navLayout} 
                onValueChange={(value) => updateSettings('navLayout', value)}
              >
                <SelectTrigger className="mt-1" data-testid="nav-layout-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NAVIGATION_STYLES.map(style => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-magical-plum mt-1">
                {NAVIGATION_STYLES.find(s => s.id === settings.navLayout)?.description}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-sans text-magical-ink">Show Thumbnails</Label>
              <Switch
                checked={settings.showThumbnails}
                onCheckedChange={(checked) => updateSettings('showThumbnails', checked)}
                data-testid="show-thumbnails-switch"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-sans text-magical-ink">Show Page Numbers</Label>
              <Switch
                checked={settings.showPageNumbers}
                onCheckedChange={(checked) => updateSettings('showPageNumbers', checked)}
                data-testid="show-page-numbers-switch"
              />
            </div>
          </div>
        </Section>

        <Section 
          title="Styling" 
          expanded={expandedSections.styling}
          onToggle={() => toggleSection('styling')}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-sans text-magical-ink">Rounded Corners</Label>
              <Switch
                checked={settings.roundedCorners}
                onCheckedChange={(checked) => updateSettings('roundedCorners', checked)}
                data-testid="rounded-corners-switch"
              />
            </div>

            {settings.roundedCorners && (
              <div>
                <Label className="text-sm font-sans text-magical-ink">
                  Corner Radius: {settings.cornerRadius}px
                </Label>
                <Slider
                  value={[settings.cornerRadius]}
                  onValueChange={([value]) => updateSettings('cornerRadius', value)}
                  max={32}
                  step={2}
                  className="mt-2"
                  data-testid="corner-radius-slider"
                />
              </div>
            )}

            <div>
              <Label className="text-sm font-sans text-magical-ink">Theme Preset</Label>
              <Select 
                value={settings.themePreset} 
                onValueChange={(value) => updateSettings('themePreset', value)}
              >
                <SelectTrigger className="mt-1" data-testid="theme-preset-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Warm Cream">Warm Cream</SelectItem>
                  <SelectItem value="Midnight Navy">Midnight Navy</SelectItem>
                  <SelectItem value="Soft Plum">Soft Plum</SelectItem>
                  <SelectItem value="Mist Gray">Mist Gray</SelectItem>
                  <SelectItem value="Blush Beige">Blush Beige</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-sans text-magical-ink">Navigation Appearance</Label>
              <Select 
                value={settings.toolbarStyle} 
                onValueChange={(value) => updateSettings('toolbarStyle', value)}
              >
                <SelectTrigger className="mt-1" data-testid="toolbar-style-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Glass">Glass (Translucent blur)</SelectItem>
                  <SelectItem value="Solid Dark">Solid Dark</SelectItem>
                  <SelectItem value="Soft Light">Soft Light</SelectItem>
                  <SelectItem value="Invisible Minimal">Invisible Minimal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-magical-plum mt-1">
                Controls the visual style of navigation toolbar
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

const Section = ({ title, expanded, onToggle, children }) => {
  return (
    <div className="border border-magical-moon/20 rounded-xl overflow-hidden bg-white/50">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-magical-cream/50 transition-colors"
        data-testid={`section-toggle-${title.toLowerCase().replace(' ', '-')}`}
      >
        <span className="font-sans font-medium text-magical-ink">{title}</span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-magical-plum" />
        ) : (
          <ChevronRight className="w-4 h-4 text-magical-plum" />
        )}
      </button>
      {expanded && (
        <div className="px-4 py-3 border-t border-magical-moon/20">
          {children}
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
