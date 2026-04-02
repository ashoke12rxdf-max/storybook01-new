import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Settings, Eye, Trash2, Check, X, Play, Square, Volume2, Type, Palette, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function TemplateManagement({ standalone = true }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showFieldMapper, setShowFieldMapper] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/templates`);
      const data = await response.json();
      setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    const title = prompt('Enter template title:');
    if (!title) return;

    const productSlug = prompt('Enter product slug (e.g., "lunas-adventure"):');
    if (!productSlug) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('productSlug', productSlug);
    formData.append('description', '');

    try {
      const response = await fetch(`${API_URL}/api/templates/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const template = await response.json();
      toast.success('Template uploaded successfully!');
      fetchTemplates();
      setSelectedTemplate(template);
      setShowFieldMapper(true);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.message || 'Failed to upload template');
    } finally {
      setUploading(false);
    }
  };

  const updateTemplateStatus = async (templateId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Status update failed');
      }

      toast.success(`Template ${newStatus}`);
      fetchTemplates();
    } catch (error) {
      console.error('Status update failed:', error);
      toast.error(error.message);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!confirm('Delete this template?')) return;

    try {
      const response = await fetch(`${API_URL}/api/templates/${templateId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Delete failed');
      }

      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      inactive: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      archived: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || colors.draft;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header - only show if standalone */}
      {standalone && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Template Management</h1>
            </div>
            <label className="cursor-pointer px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
              <Upload size={20} />
              {uploading ? 'Uploading...' : 'Upload Template'}
              <input
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}

      {/* Header for embedded mode */}
      {!standalone && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Template Management</h1>
            <label className="cursor-pointer px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
              <Upload size={20} />
              {uploading ? 'Uploading...' : 'Upload Template'}
              <input
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">No templates yet</p>
            <p className="text-gray-500 text-sm mt-2">Upload a fillable PDF to get started</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onStatusChange={updateTemplateStatus}
                onDelete={deleteTemplate}
                onViewDetails={(t) => {
                  setSelectedTemplate(t);
                  setShowFieldMapper(true);
                }}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        )}
      </div>

      {/* Field Mapper Modal */}
      {showFieldMapper && selectedTemplate && (
        <FieldMapperModal
          template={selectedTemplate}
          onClose={() => {
            setShowFieldMapper(false);
            setSelectedTemplate(null);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
}

function TemplateCard({ template, onStatusChange, onDelete, onViewDetails, getStatusBadge }) {
  const styling = template.stylingDefaults || {};
  const requiresPersonalization = (template.field_definitions?.length || 0) > 0;
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-gray-900">{template.title}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(template.status)}`}>
              {template.status.toUpperCase()}
            </span>
            {requiresPersonalization && (
              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-purple-100 text-purple-800 border-purple-200">
                PERSONALIZATION
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Product: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{template.productSlug}</span>
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            <span>{template.pageCount} pages</span>
            <span>•</span>
            <span>{template.fillableFields?.length || 0} fillable fields</span>
            <span>•</span>
            <span>{template.fieldMappings?.length || 0} fields mapped</span>
            {requiresPersonalization && (
              <>
                <span>•</span>
                <span className="text-purple-600 font-medium">{template.field_definitions?.length || 0} personalization fields</span>
              </>
            )}
          </div>
          
          {/* Styling Summary Card */}
          {(styling.fontName || styling.soundName || styling.flippingEffect || styling.themePreset) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {styling.fontName && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                  <Type size={12} />
                  {styling.fontName}
                </span>
              )}
              {styling.soundName && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  <Volume2 size={12} />
                  {styling.soundName}
                </span>
              )}
              {styling.flippingEffect && styling.flippingEffect !== 'StoryParallax' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                  <BookOpen size={12} />
                  {styling.flippingEffect}
                </span>
              )}
              {styling.themePreset && styling.themePreset !== 'Warm Cream' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs">
                  <Palette size={12} />
                  {styling.themePreset}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetails(template)}
            className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="View & Map Fields"
          >
            <Settings size={20} />
          </button>

          {template.status !== 'active' && (
            <button
              onClick={() => onStatusChange(template.id, 'active')}
              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Activate"
            >
              <Check size={20} />
            </button>
          )}

          {template.status === 'active' && (
            <button
              onClick={() => onStatusChange(template.id, 'inactive')}
              className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
              title="Deactivate"
            >
              <X size={20} />
            </button>
          )}

          {template.status !== 'active' && (
            <button
              onClick={() => onDelete(template.id)}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldMapperModal({ template, onClose }) {
  const [fieldMappings, setFieldMappings] = useState(template.fieldMappings || []);
  const [stylingDefaults, setStylingDefaults] = useState(template.stylingDefaults || {
    fontId: null,
    fontName: null,
    fontUrl: null,
    soundId: null,
    soundName: null,
    soundUrl: null,
    flippingEffect: 'StoryParallax',
    themePreset: 'Warm Cream',
    accentColor: '#C9A86A'
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('mapping'); // 'mapping' | 'styling'
  const [fonts, setFonts] = useState([]);
  const [sounds, setSounds] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [playingSound, setPlayingSound] = useState(null);
  const audioRef = useRef(null);

  // Load fonts and sounds
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const [fontsData, soundsData] = await Promise.all([
          api.getFonts(),
          api.getSounds()
        ]);
        setFonts(fontsData.fonts || []);
        setSounds(soundsData.sounds || []);
      } catch (error) {
        console.error('Failed to load assets:', error);
      } finally {
        setLoadingAssets(false);
      }
    };
    loadAssets();
  }, []);

  const toggleFieldMapping = (fieldName) => {
    const existing = fieldMappings.find(m => m.pdfFieldName === fieldName);
    if (existing) {
      setFieldMappings(fieldMappings.filter(m => m.pdfFieldName !== fieldName));
    } else {
      setFieldMappings([...fieldMappings, {
        pdfFieldName: fieldName,
        variableType: 'requestedName',
        fallbackValue: ''
      }]);
    }
  };

  const handleFontChange = (fontId) => {
    if (!fontId) {
      setStylingDefaults(prev => ({
        ...prev,
        fontId: null,
        fontName: null,
        fontUrl: null
      }));
    } else {
      const font = fonts.find(f => f.id === fontId);
      if (font) {
        setStylingDefaults(prev => ({
          ...prev,
          fontId: font.id,
          fontName: font.name,
          fontUrl: `${API_URL}${font.publicUrl}`
        }));
      }
    }
  };

  const handleSoundChange = (soundId) => {
    if (!soundId) {
      setStylingDefaults(prev => ({
        ...prev,
        soundId: null,
        soundName: null,
        soundUrl: null
      }));
    } else {
      const sound = sounds.find(s => s.id === soundId);
      if (sound) {
        setStylingDefaults(prev => ({
          ...prev,
          soundId: sound.id,
          soundName: sound.name,
          soundUrl: `${API_URL}${sound.publicUrl}`
        }));
      }
    }
  };

  const playSound = (sound) => {
    const soundUrl = `${API_URL}${sound.publicUrl}`;
    
    if (playingSound === sound.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingSound(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(soundUrl);
      audioRef.current.onended = () => setPlayingSound(null);
      audioRef.current.play();
      setPlayingSound(sound.id);
    }
  };

  const saveMappings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fieldMappings,
          stylingDefaults 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save');
      }

      toast.success('Template settings saved!');
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const isMapped = (fieldName) => fieldMappings.some(m => m.pdfFieldName === fieldName);

  const flippingEffects = [
    { id: 'StoryParallax', name: 'Story Parallax', description: 'Elegant page turn with depth' },
    { id: 'HardcoverClassic', name: 'Hardcover Classic', description: 'Traditional book flip' },
    { id: 'MagazineSlide', name: 'Magazine Slide', description: 'Smooth slide transition' },
    { id: 'SoftFade', name: 'Soft Fade', description: 'Gentle crossfade' },
    { id: 'None', name: 'None', description: 'Simple page change' }
  ];

  const themePresets = [
    { id: 'Warm Cream', name: 'Warm Cream', color: '#F5F0E6' },
    { id: 'Pure White', name: 'Pure White', color: '#FFFFFF' },
    { id: 'Soft Gray', name: 'Soft Gray', color: '#F3F4F6' },
    { id: 'Night Mode', name: 'Night Mode', color: '#1F2937' },
    { id: 'Sepia', name: 'Sepia', color: '#F4ECD8' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Template Settings</h2>
          <p className="text-sm text-gray-600 mt-1">{template.title}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('mapping')}
            className={`px-4 py-3 font-medium transition-all border-b-2 -mb-px ${
              activeTab === 'mapping'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText size={18} />
              Field Mapping
            </div>
          </button>
          <button
            onClick={() => setActiveTab('styling')}
            className={`px-4 py-3 font-medium transition-all border-b-2 -mb-px ${
              activeTab === 'styling'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Palette size={18} />
              Default Styling
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'mapping' && (
            <>
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Click fields</strong> to map them to <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">requestedName</span>
                    <br />
                    Mapped fields will be filled with the customer's personalization name.
                  </p>
                </div>
              </div>

              {template.fillableFields && template.fillableFields.length > 0 ? (
                <div className="space-y-3">
                  {template.fillableFields.map((field, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleFieldMapping(field.fieldName)}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        isMapped(field.fieldName)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-gray-900">
                              {field.fieldName}
                            </span>
                            {isMapped(field.fieldName) && (
                              <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                                Mapped to requestedName
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Page {field.pageNumber} • {field.fieldType}
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isMapped(field.fieldName)
                            ? 'border-green-500 bg-green-500'
                            : 'border-gray-300'
                        }`}>
                          {isMapped(field.fieldName) && (
                            <Check size={16} className="text-white" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No fillable fields detected in this PDF
                </div>
              )}

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Summary:</strong> {fieldMappings.length} of {template.fillableFields?.length || 0} fields mapped
                </p>
              </div>
            </>
          )}

          {activeTab === 'styling' && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-purple-900">
                  <strong>Default Styling</strong> — These settings will be automatically applied to all storybooks generated from this template.
                </p>
              </div>

              {/* Font Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Type size={16} />
                    Font Style
                  </div>
                </label>
                {loadingAssets ? (
                  <div className="h-10 bg-gray-100 rounded-lg animate-pulse"></div>
                ) : (
                  <select
                    value={stylingDefaults.fontId || ''}
                    onChange={(e) => handleFontChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">System Default (Helvetica)</option>
                    {fonts.map(font => (
                      <option key={font.id} value={font.id}>{font.name}</option>
                    ))}
                  </select>
                )}
                {stylingDefaults.fontName && (
                  <p className="text-sm text-gray-500 mt-1">
                    Selected: <strong>{stylingDefaults.fontName}</strong>
                  </p>
                )}
                {fonts.length === 0 && !loadingAssets && (
                  <p className="text-xs text-gray-400 mt-1">
                    No custom fonts uploaded. Go to Settings → Assets Library to add fonts.
                  </p>
                )}
              </div>

              {/* Sound Effect Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} />
                    Page Turn Sound Effect
                  </div>
                </label>
                {loadingAssets ? (
                  <div className="h-10 bg-gray-100 rounded-lg animate-pulse"></div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={stylingDefaults.soundId || ''}
                      onChange={(e) => handleSoundChange(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">No Sound</option>
                      {sounds.map(sound => (
                        <option key={sound.id} value={sound.id}>{sound.name}</option>
                      ))}
                    </select>
                    {stylingDefaults.soundId && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const sound = sounds.find(s => s.id === stylingDefaults.soundId);
                            if (sound) playSound(sound);
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            playingSound === stylingDefaults.soundId
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {playingSound === stylingDefaults.soundId ? (
                            <>
                              <Square size={14} fill="currentColor" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Play size={14} fill="currentColor" />
                              Preview
                            </>
                          )}
                        </button>
                        <span className="text-sm text-gray-500">{stylingDefaults.soundName}</span>
                      </div>
                    )}
                  </div>
                )}
                {sounds.length === 0 && !loadingAssets && (
                  <p className="text-xs text-gray-400 mt-1">
                    No sounds uploaded. Go to Settings → Assets Library to add sound effects.
                  </p>
                )}
              </div>

              {/* Flipping Effect */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} />
                    Flipping Effect
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {flippingEffects.map(effect => (
                    <button
                      key={effect.id}
                      onClick={() => setStylingDefaults(prev => ({ ...prev, flippingEffect: effect.id }))}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        stylingDefaults.flippingEffect === effect.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-200'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{effect.name}</p>
                      <p className="text-xs text-gray-500">{effect.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Preset */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Palette size={16} />
                    Theme Preset
                  </div>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {themePresets.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setStylingDefaults(prev => ({ ...prev, themePreset: theme.id }))}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        stylingDefaults.themePreset === theme.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-200'
                      }`}
                    >
                      <div 
                        className="w-8 h-8 rounded-full mx-auto mb-2 border border-gray-300"
                        style={{ backgroundColor: theme.color }}
                      />
                      <p className="text-sm font-medium text-gray-900">{theme.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Styling Summary */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Styling Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">Font:</div>
                  <div className="text-gray-900">{stylingDefaults.fontName || 'System Default'}</div>
                  <div className="text-gray-600">Sound:</div>
                  <div className="text-gray-900">{stylingDefaults.soundName || 'None'}</div>
                  <div className="text-gray-600">Flip Effect:</div>
                  <div className="text-gray-900">{flippingEffects.find(e => e.id === stylingDefaults.flippingEffect)?.name || 'Story Parallax'}</div>
                  <div className="text-gray-600">Theme:</div>
                  <div className="text-gray-900">{stylingDefaults.themePreset || 'Warm Cream'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveMappings}
            disabled={saving}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateManagement;