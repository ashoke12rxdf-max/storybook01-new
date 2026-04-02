import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Copy, Lock, Unlock, Code, Share2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const PublishPanel = ({ storybook, onUpdate }) => {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePasswordToggle = async (enabled) => {
    if (enabled && !password) {
      toast.error('Please enter a password first');
      return;
    }

    setSaving(true);
    try {
      await api.updateStorybook(storybook.id, {
        passwordProtected: enabled,
        password: enabled ? password : null
      });
      toast.success(enabled ? 'Password protection enabled' : 'Password protection disabled');
      onUpdate();
    } catch (error) {
      toast.error('Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/view/${storybook.slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Share link copied!');
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(storybook.embedCode);
    toast.success('Embed code copied!');
  };

  return (
    <div className="w-72 border-l border-magical-moon/30 bg-white/50 backdrop-blur-xl overflow-y-auto" data-testid="publish-panel">
      <div className="p-6 space-y-6">
        <div>
          <h3 className="font-serif text-xl text-magical-ink mb-4">
            Share & Publish
          </h3>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-sans text-magical-ink">Customer Share Link</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={`/view/${storybook.slug}`}
              className="text-xs bg-white/50 border-magical-moon/20"
              data-testid="share-link-input"
            />
            <Button
              onClick={copyShareLink}
              size="sm"
              variant="outline"
              className="border-magical-moon/20"
              data-testid="copy-share-link-button"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-magical-plum">
            Share this link with your customer
          </p>
        </div>

        <div className="border-t border-magical-moon/20 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {storybook.passwordProtected ? (
                <Lock className="w-4 h-4 text-magical-rose" />
              ) : (
                <Unlock className="w-4 h-4 text-magical-plum" />
              )}
              <Label className="text-sm font-sans text-magical-ink">Password Protect</Label>
            </div>
            <Switch
              checked={storybook.passwordProtected}
              onCheckedChange={handlePasswordToggle}
              disabled={saving}
              data-testid="password-protect-switch"
            />
          </div>

          {!storybook.passwordProtected && (
            <div>
              <Label className="text-sm font-sans text-magical-ink mb-2 block">Set Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="bg-white/50 border-magical-moon/20"
                data-testid="password-input"
              />
              <Button
                onClick={() => handlePasswordToggle(true)}
                disabled={!password || saving}
                size="sm"
                className="w-full mt-2 bg-magical-ink text-magical-cream rounded-full"
                data-testid="set-password-button"
              >
                {saving ? 'Saving...' : 'Set Password'}
              </Button>
            </div>
          )}

          {storybook.passwordProtected && (
            <div className="bg-magical-rose/10 border border-magical-rose/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-magical-rose mt-0.5" />
                <div>
                  <p className="text-xs font-sans font-medium text-magical-ink">Protected</p>
                  <p className="text-xs text-magical-plum mt-1">
                    Customers need a password to view
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-magical-moon/20 pt-4 space-y-3">
          <Label className="text-sm font-sans text-magical-ink flex items-center gap-2">
            <Code className="w-4 h-4" />
            Admin-Only Embed Code
          </Label>
          <div className="bg-magical-ink/5 border border-magical-moon/20 rounded-lg p-3">
            <code className="text-xs text-magical-plum break-all font-mono">
              {storybook.embedCode}
            </code>
          </div>
          <Button
            onClick={copyEmbedCode}
            size="sm"
            variant="outline"
            className="w-full border-magical-moon/20 rounded-full"
            data-testid="copy-embed-button"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Embed Code
          </Button>
          <p className="text-xs text-magical-plum">
            Only visible to you as admin
          </p>
        </div>

        <div className="border-t border-magical-moon/20 pt-4">
          <div className="bg-magical-teal/10 border border-magical-teal/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Share2 className="w-4 h-4 text-magical-teal" />
              <span className="text-sm font-sans font-medium text-magical-ink">Ready to Share</span>
            </div>
            <p className="text-xs text-magical-plum">
              Views: {storybook.viewCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublishPanel;
