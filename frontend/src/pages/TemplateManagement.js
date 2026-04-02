import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Settings, Eye, Trash2, Check, X, Play, Square, Volume2, Type, Palette, BookOpen, Plus, GripVertical, ChevronUp, ChevronDown, Layers } from 'lucide-react';
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
  const navigate = useNavigate();
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
            {(template.spread_blocks?.length || 0) > 0 && (
              <>
                <span>•</span>
                <span className="text-blue-600 font-medium">{template.spread_blocks.length} spread blocks</span>
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
            onClick={() => navigate(`/admin/templates/${template.id}/spread-editor`)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Spread Layout"
            data-testid={`spread-editor-btn-${template.id}`}
          >
            <Layers size={20} />
          </button>

          <button
            onClick={() => onViewDetails(template)}
            className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Template Settings"
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
  const [fieldDefinitions, setFieldDefinitions] = useState(template.field_definitions || []);
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
  const [activeTab, setActiveTab] = useState('mapping'); // 'mapping' | 'fields' | 'styling'
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
          stylingDefaults,
          field_definitions: fieldDefinitions
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
            onClick={() => setActiveTab('fields')}
            className={`px-4 py-3 font-medium transition-all border-b-2 -mb-px ${
              activeTab === 'fields'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers size={18} />
              Field Definitions
              {fieldDefinitions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                  {fieldDefinitions.length}
                </span>
              )}
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

          {activeTab === 'fields' && (
            <FieldDefinitionsEditor
              fieldDefinitions={fieldDefinitions}
              onChange={setFieldDefinitions}
            />
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

// ── Field Definitions Editor ──────────────────────────────────────────────────
const FIELD_TYPES = ['text', 'textarea', 'image', 'date', 'select'];

function FieldDefinitionsEditor({ fieldDefinitions, onChange }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState(newFieldForm());

  function newFieldForm() {
    return {
      field_key: '',
      label: '',
      type: 'text',
      required: true,
      placeholder: '',
      help_text: '',
      max_length: '',
      options: '',
    };
  }

  const openAdd = () => {
    setForm(newFieldForm());
    setEditIndex(null);
    setShowAddForm(true);
  };

  const openEdit = (idx) => {
    const f = fieldDefinitions[idx];
    setForm({
      ...f,
      max_length: f.max_length ? String(f.max_length) : '',
      options: (f.options || []).join(', '),
    });
    setEditIndex(idx);
    setShowAddForm(true);
  };

  const handleSaveField = () => {
    if (!form.field_key.trim()) {
      toast.error('Field key is required');
      return;
    }
    if (!form.label.trim()) {
      toast.error('Label is required');
      return;
    }
    // Validate no spaces in field_key
    if (/\s/.test(form.field_key)) {
      toast.error('Field key cannot contain spaces');
      return;
    }

    const newField = {
      field_key: form.field_key.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      label: form.label,
      type: form.type,
      required: form.required,
      placeholder: form.placeholder,
      help_text: form.help_text,
      max_length: form.max_length ? parseInt(form.max_length) : null,
      options: form.type === 'select' ? form.options.split(',').map(o => o.trim()).filter(Boolean) : [],
      validation_regex: null,
    };

    if (editIndex !== null) {
      const updated = [...fieldDefinitions];
      updated[editIndex] = newField;
      onChange(updated);
    } else {
      // Check duplicate key
      if (fieldDefinitions.some(f => f.field_key === newField.field_key)) {
        toast.error(`Field key "${newField.field_key}" already exists`);
        return;
      }
      onChange([...fieldDefinitions, newField]);
    }

    setShowAddForm(false);
  };

  const deleteField = (idx) => {
    onChange(fieldDefinitions.filter((_, i) => i !== idx));
  };

  const moveField = (idx, dir) => {
    const arr = [...fieldDefinitions];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onChange(arr);
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-900">
          <strong>Field Definitions</strong> — Define the form fields customers will fill out to personalize their storybook.
          Use these field keys as <span className="font-mono bg-purple-100 px-1 rounded">[field_key]</span> tokens in Spread Blocks.
        </p>
      </div>

      {/* Field List */}
      {fieldDefinitions.length > 0 ? (
        <div className="space-y-2">
          {fieldDefinitions.map((field, idx) => (
            <div
              key={field.field_key}
              className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
              data-testid={`field-def-${field.field_key}`}
            >
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveField(idx, -1)}
                  disabled={idx === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => moveField(idx, 1)}
                  disabled={idx === fieldDefinitions.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-gray-900">{field.field_key}</span>
                  <span className="text-xs text-gray-500">{field.label}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{field.type}</span>
                  {field.required && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">required</span>
                  )}
                </div>
                {field.placeholder && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">Placeholder: {field.placeholder}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(idx)}
                  className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                  title="Edit"
                >
                  <Settings size={15} />
                </button>
                <button
                  onClick={() => deleteField(idx)}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showAddForm && (
          <div className="text-center py-8 text-gray-400">
            <Layers size={32} className="mx-auto mb-2" />
            <p className="text-sm">No field definitions yet</p>
            <p className="text-xs mt-1">Add fields for customers to personalize their storybook</p>
          </div>
        )
      )}

      {/* Add Field Form */}
      {showAddForm && (
        <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50 space-y-3">
          <h4 className="font-semibold text-gray-900 text-sm">
            {editIndex !== null ? 'Edit Field' : 'New Field Definition'}
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Field Key *</label>
              <input
                type="text"
                value={form.field_key}
                onChange={e => setForm(p => ({ ...p, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                placeholder="dad_name"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                data-testid="field-key-input"
                disabled={editIndex !== null}
              />
              <p className="text-xs text-gray-400 mt-0.5">Used as [field_key] token</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Label *</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                placeholder="Father's Name"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="field-label-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="field-type-select"
              >
                {FIELD_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max Length</label>
              <input
                type="number"
                value={form.max_length}
                onChange={e => setForm(p => ({ ...p, max_length: e.target.value }))}
                placeholder="50"
                min={1}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={e => setForm(p => ({ ...p, required: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded"
                  data-testid="field-required-check"
                />
                <span className="text-sm font-medium text-gray-700">Required</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Placeholder</label>
              <input
                type="text"
                value={form.placeholder}
                onChange={e => setForm(p => ({ ...p, placeholder: e.target.value }))}
                placeholder="e.g. Enter dad's name"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Help Text</label>
              <input
                type="text"
                value={form.help_text}
                onChange={e => setForm(p => ({ ...p, help_text: e.target.value }))}
                placeholder="Shown below the input"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {form.type === 'select' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Options (comma-separated)</label>
              <input
                type="text"
                value={form.options}
                onChange={e => setForm(p => ({ ...p, options: e.target.value }))}
                placeholder="Option 1, Option 2, Option 3"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSaveField}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors font-medium"
              data-testid="save-field-def-btn"
            >
              {editIndex !== null ? 'Update Field' : 'Add Field'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!showAddForm && (
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors w-full justify-center text-sm font-medium"
          data-testid="add-field-def-btn"
        >
          <Plus size={16} />
          Add Field Definition
        </button>
      )}
    </div>
  );
}

export default TemplateManagement;