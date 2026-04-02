import { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Music, 
  Type, 
  Upload, 
  Trash2, 
  Play, 
  Square, 
  Copy, 
  Check,
  ExternalLink,
  Loader2,
  Volume2,
  FileAudio,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

function Settings() {
  const [activeTab, setActiveTab] = useState('assets');
  const [assetsSubTab, setAssetsSubTab] = useState('fonts');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <SettingsIcon className="w-7 h-7" />
          Settings
        </h1>
        <p className="text-gray-600 mt-1">Manage your assets and integrations</p>
      </div>

      {/* Settings Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-3 font-medium transition-all border-b-2 -mb-px ${
            activeTab === 'assets'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Assets Library
        </button>
        <button
          onClick={() => setActiveTab('polar')}
          className={`px-4 py-3 font-medium transition-all border-b-2 -mb-px ${
            activeTab === 'polar'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Polar Credentials
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'assets' && (
        <AssetsLibrary 
          subTab={assetsSubTab} 
          onSubTabChange={setAssetsSubTab} 
        />
      )}
      {activeTab === 'polar' && <PolarCredentials />}
    </div>
  );
}


// ==================== ASSETS LIBRARY ====================

function AssetsLibrary({ subTab, onSubTabChange }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => onSubTabChange('fonts')}
          className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${
            subTab === 'fonts'
              ? 'bg-white text-purple-600 border-b-2 border-purple-600 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Type size={18} />
          Fonts
        </button>
        <button
          onClick={() => onSubTabChange('sounds')}
          className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${
            subTab === 'sounds'
              ? 'bg-white text-purple-600 border-b-2 border-purple-600 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Music size={18} />
          Sound Effects
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {subTab === 'fonts' && <FontsTab />}
        {subTab === 'sounds' && <SoundsTab />}
      </div>
    </div>
  );
}


// ==================== FONTS TAB ====================

function FontsTab() {
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFonts();
  }, []);

  const loadFonts = async () => {
    try {
      const data = await api.getFonts();
      setFonts(data.fonts || []);
    } catch (error) {
      toast.error('Failed to load fonts');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error(`Invalid format. Allowed: ${validExtensions.join(', ')}`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
      await api.uploadFont(file);
      setUploadProgress(100);
      toast.success('Font uploaded successfully');
      loadFonts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload font');
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fontId, fontName) => {
    if (!confirm(`Delete font "${fontName}"?`)) return;

    try {
      await api.deleteFont(fontId);
      toast.success('Font deleted');
      loadFonts();
    } catch (error) {
      toast.error('Failed to delete font');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Upload Section */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          onChange={handleUpload}
          className="hidden"
          disabled={uploading}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? 'Uploading...' : 'Upload Font'}
        </button>
        
        {uploading && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">{uploadProgress}%</p>
          </div>
        )}
        
        <p className="text-sm text-gray-500 mt-2">
          Supported formats: .ttf, .otf, .woff, .woff2
        </p>
      </div>

      {/* Fonts List */}
      {fonts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Type className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No fonts uploaded yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload your first custom font</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fonts.map(font => (
            <FontItem key={font.id} font={font} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}


function FontItem({ font, onDelete }) {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
  const fontUrl = `${backendUrl}${font.publicUrl}`;

  // Load font dynamically
  useEffect(() => {
    const fontFace = new FontFace(font.name, `url(${fontUrl})`);
    fontFace.load().then(loadedFont => {
      document.fonts.add(loadedFont);
    }).catch(err => {
      console.error('Failed to load font:', err);
    });
  }, [font.name, fontUrl]);

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-200 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <Type className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{font.name}</p>
          <p 
            className="text-2xl mt-1 text-gray-600"
            style={{ fontFamily: font.name }}
          >
            Aa Bb Cc 123
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 mr-2">
          {(font.fileSize / 1024).toFixed(1)} KB
        </span>
        <button
          onClick={() => onDelete(font.id, font.name)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete font"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


// ==================== SOUNDS TAB ====================

function SoundsTab() {
  const [sounds, setSounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadSounds();
  }, []);

  const loadSounds = async () => {
    try {
      const data = await api.getSounds();
      setSounds(data.sounds || []);
    } catch (error) {
      toast.error('Failed to load sounds');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validExtensions = ['.mp3', '.wav'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error(`Invalid format. Allowed: ${validExtensions.join(', ')}`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
      await api.uploadSound(file);
      setUploadProgress(100);
      toast.success('Sound uploaded successfully');
      loadSounds();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload sound');
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (soundId, soundName) => {
    if (!confirm(`Delete sound "${soundName}"?`)) return;

    try {
      await api.deleteSound(soundId);
      toast.success('Sound deleted');
      loadSounds();
    } catch (error) {
      toast.error('Failed to delete sound');
    }
  };

  const togglePlay = (sound) => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const soundUrl = `${backendUrl}${sound.publicUrl}`;

    if (playingId === sound.id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingId(null);
    } else {
      // Play new sound
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(soundUrl);
      audioRef.current.onended = () => setPlayingId(null);
      audioRef.current.play();
      setPlayingId(sound.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Upload Section */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav"
          onChange={handleUpload}
          className="hidden"
          disabled={uploading}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? 'Uploading...' : 'Upload Sound'}
        </button>
        
        {uploading && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">{uploadProgress}%</p>
          </div>
        )}
        
        <p className="text-sm text-gray-500 mt-2">
          Supported formats: .mp3, .wav
        </p>
      </div>

      {/* Sounds List */}
      {sounds.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <FileAudio className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No sounds uploaded yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload your first sound effect</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sounds.map(sound => (
            <SoundItem 
              key={sound.id} 
              sound={sound} 
              isPlaying={playingId === sound.id}
              onTogglePlay={() => togglePlay(sound)}
              onDelete={handleDelete} 
            />
          ))}
        </div>
      )}
    </div>
  );
}


function SoundItem({ sound, isPlaying, onTogglePlay, onDelete }) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-200 transition-colors">
      <div className="flex items-center gap-4">
        <button
          onClick={onTogglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isPlaying 
              ? 'bg-purple-600 text-white' 
              : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
          }`}
        >
          {isPlaying ? (
            <Square className="w-4 h-4" fill="currentColor" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
          )}
        </button>
        <div>
          <p className="font-medium text-gray-900">{sound.name}</p>
          <p className="text-sm text-gray-500">
            {sound.extension.toUpperCase()} • {(sound.fileSize / 1024).toFixed(1)} KB
          </p>
        </div>
      </div>
      <button
        onClick={() => onDelete(sound.id, sound.name)}
        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Delete sound"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}


// ==================== POLAR CREDENTIALS ====================

function PolarCredentials() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testForm, setTestForm] = useState({
    productSlug: 'Demo',
    requestedName: '',
    customerEmail: '',
    customerName: '',
    password: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getPolarSettings();
      setSettings(data);
    } catch (error) {
      toast.error('Failed to load Polar settings');
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(settings.webhookUrl);
    setCopied(true);
    toast.success('Webhook URL copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestWebhook = async () => {
    if (!testForm.requestedName || !testForm.customerEmail) {
      toast.error('Please fill in required fields (Requested Name and Customer Email)');
      return;
    }
    
    setTesting(true);
    try {
      const result = await api.simulatePolarWebhook(testForm);
      if (result.success) {
        toast.success(`Test order created! Status: ${result.order?.status}`);
      } else {
        toast.error(result.error || 'Test failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Test webhook failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          Polar.sh Webhook Integration
        </h2>
        <p className="text-gray-600 mt-1">
          Connect your Polar.sh account to automatically process orders
        </p>
      </div>

      {/* Webhook URL */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Webhook URL
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 font-mono text-sm text-gray-800 overflow-x-auto">
            {settings?.webhookUrl}
          </div>
          <button
            onClick={copyWebhookUrl}
            className="flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="mb-6">
        <div className={`p-4 rounded-lg border ${
          settings?.secretConfigured 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            {settings?.secretConfigured ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
            <span className={`font-medium ${
              settings?.secretConfigured ? 'text-green-700' : 'text-yellow-700'
            }`}>
              Webhook Secret
            </span>
          </div>
          <p className={`text-sm mt-1 ${
            settings?.secretConfigured ? 'text-green-600' : 'text-yellow-600'
          }`}>
            {settings?.secretConfigured ? 'Configured' : 'Not configured - add POLAR_WEBHOOK_SECRET to backend/.env'}
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">Setup Instructions</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          {settings?.instructions?.map((instruction, i) => (
            <li key={i}>{instruction}</li>
          ))}
        </ol>
      </div>

      {/* Required Fields Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-amber-900 mb-2">Required Fields in Polar</h3>
        <div className="text-sm text-amber-800 space-y-2">
          <p><strong>Product Metadata:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><code className="bg-amber-100 px-1 rounded">product_slug</code> - Must match your template's Product Slug</li>
          </ul>
          <p className="mt-2"><strong>Checkout Custom Fields:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li><code className="bg-amber-100 px-1 rounded">requested_name</code> - The name to personalize (required)</li>
            <li><code className="bg-amber-100 px-1 rounded">password</code> - Optional password protection</li>
          </ul>
        </div>
      </div>

      {/* Test Webhook */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="font-medium text-gray-900 mb-4">Test Webhook</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Slug *
            </label>
            <input
              type="text"
              value={testForm.productSlug}
              onChange={(e) => setTestForm({...testForm, productSlug: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Demo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requested Name *
            </label>
            <input
              type="text"
              value={testForm.requestedName}
              onChange={(e) => setTestForm({...testForm, requestedName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Child's Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Email *
            </label>
            <input
              type="email"
              value={testForm.customerEmail}
              onChange={(e) => setTestForm({...testForm, customerEmail: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="customer@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password (optional)
            </label>
            <input
              type="text"
              value={testForm.password}
              onChange={(e) => setTestForm({...testForm, password: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Optional password"
            />
          </div>
        </div>
        <button
          onClick={handleTestWebhook}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Test Webhook
            </>
          )}
        </button>
      </div>
    </div>
  );
}


export default Settings;
