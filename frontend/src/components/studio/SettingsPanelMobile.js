import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ONE_PAGE_EFFECTS, TWO_PAGE_EFFECTS, NAVIGATION_STYLES } from '@/lib/effects';
import { BUILT_IN_SOUNDS } from '@/lib/sounds';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

const SettingsPanelMobile = ({ settings, updateSettings }) => {
  const [expandedSections, setExpandedSections] = useState({
    effects: false,
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
    <div className="w-full md:w-80 md:border-r border-magical-moon/30 bg-white/80 backdrop-blur-xl overflow-y-auto">
      <div className="p-4 md:p-6 space-y-3 md:space-y-4">
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
              <Label className="text-sm font-sans text-magical-ink font-medium">One-Page Effect</Label>
              <Select 
                value={settings.onePageEffect} 
                onValueChange={(value) => updateSettings('onePageEffect', value)}
              >
                <SelectTrigger className="mt-2 h-12">
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

            <div>
              <Label className="text-sm font-sans text-magical-ink font-medium">Two-Page Effect</Label>
              <Select 
                value={settings.twoPageEffect} 
                onValueChange={(value) => updateSettings('twoPageEffect', value)}
              >
                <SelectTrigger className="mt-2 h-12">
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
            </div>

            <div>
              <Label className="text-sm font-sans text-magical-ink font-medium">Mobile Effect</Label>
              <Select 
                value={settings.mobilePreferredEffect} 
                onValueChange={(value) => updateSettings('mobilePreferredEffect', value)}
              >
                <SelectTrigger className="mt-2 h-12">
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
            <div className="flex items-center justify-between py-2">
              <Label className="text-sm font-sans text-magical-ink font-medium">Enable Sound</Label>
              <Switch
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => updateSettings('soundEnabled', checked)}
              />
            </div>

            {settings.soundEnabled && (
              <>
                <div>
                  <Label className="text-sm font-sans text-magical-ink font-medium">Sound Effect</Label>
                  <Select 
                    value={settings.defaultSound} 
                    onValueChange={(value) => updateSettings('defaultSound', value)}
                  >
                    <SelectTrigger className="mt-2 h-12">
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
                </div>

                <div>
                  <Label className="text-sm font-sans text-magical-ink font-medium mb-3 block">
                    Volume: {Math.round(settings.soundVolume * 100)}%
                  </Label>
                  <Slider
                    value={[settings.soundVolume * 100]}
                    onValueChange={([value]) => updateSettings('soundVolume', value / 100)}
                    max={100}
                    step={5}
                    className="mt-2"
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
              <Label className="text-sm font-sans text-magical-ink font-medium">Style</Label>
              <Select 
                value={settings.navLayout} 
                onValueChange={(value) => updateSettings('navLayout', value)}
              >
                <SelectTrigger className="mt-2 h-12">
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
            </div>

            <div className="flex items-center justify-between py-2">
              <Label className="text-sm font-sans text-magical-ink font-medium">Show Page Numbers</Label>
              <Switch
                checked={settings.showPageNumbers}
                onCheckedChange={(checked) => updateSettings('showPageNumbers', checked)}
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
            <div className="flex items-center justify-between py-2">
              <Label className="text-sm font-sans text-magical-ink font-medium">Rounded Corners</Label>
              <Switch
                checked={settings.roundedCorners}
                onCheckedChange={(checked) => updateSettings('roundedCorners', checked)}
              />
            </div>

            {settings.roundedCorners && (
              <div>
                <Label className="text-sm font-sans text-magical-ink font-medium mb-3 block">
                  Corner Radius: {settings.cornerRadius}px
                </Label>
                <Slider
                  value={[settings.cornerRadius]}
                  onValueChange={([value]) => updateSettings('cornerRadius', value)}
                  max={32}
                  step={2}
                  className="mt-2"
                />
              </div>
            )}

            <div>
              <Label className="text-sm font-sans text-magical-ink font-medium">Theme</Label>
              <Select 
                value={settings.themePreset} 
                onValueChange={(value) => updateSettings('themePreset', value)}
              >
                <SelectTrigger className="mt-2 h-12">
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
              <Label className="text-sm font-sans text-magical-ink font-medium">Navigation Appearance</Label>
              <Select 
                value={settings.toolbarStyle} 
                onValueChange={(value) => updateSettings('toolbarStyle', value)}
              >
                <SelectTrigger className="mt-2 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Glass">Glass</SelectItem>
                  <SelectItem value="Solid Dark">Solid Dark</SelectItem>
                  <SelectItem value="Soft Light">Soft Light</SelectItem>
                  <SelectItem value="Invisible Minimal">Invisible Minimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

const Section = ({ title, expanded, onToggle, children }) => {
  return (
    <div className="border border-magical-moon/20 rounded-xl overflow-hidden bg-white/50 shadow-sm">
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-magical-cream/50 transition-colors active:bg-magical-cream"
      >
        <span className="font-sans font-semibold text-magical-ink text-base">{title}</span>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-magical-plum" />
        ) : (
          <ChevronRight className="w-5 h-5 text-magical-plum" />
        )}
      </button>
      {expanded && (
        <div className="px-4 py-4 border-t border-magical-moon/20 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

export default SettingsPanelMobile;
