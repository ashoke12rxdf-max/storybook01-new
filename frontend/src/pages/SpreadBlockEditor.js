import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import {
  ChevronLeft, Plus, Trash2, Eye, EyeOff, Save, Loader2,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Type,
  Layers, MousePointer, Info, X, ZoomIn, Download, RefreshCw,
  ChevronUp, ChevronDown, Settings
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const CANVAS_MAX_WIDTH = 780;
const FIELD_TYPES = ['text', 'textarea', 'image', 'date', 'select'];
const SYSTEM_FONTS = [
  'Helvetica', 'Arial', 'Times New Roman', 'Courier New', 'Georgia',
  'Verdana', 'Trebuchet MS', 'Impact', 'Garamond', 'Palatino Linotype',
];

const genId = () => `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// ── Main Component ─────────────────────────────────────────────────────────────
function SpreadBlockEditor() {
  const { templateId } = useParams();
  const navigate = useNavigate();

  // Core state
  const [template, setTemplate] = useState(null);
  const [spreads, setSpreads] = useState([]);
  const [fieldDefs, setFieldDefs] = useState([]);
  const [currentSpreadId, setCurrentSpreadId] = useState(0);
  const [selectedBlockData, setSelectedBlockData] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);

  // Custom fonts from assets library
  const [availableFonts, setAvailableFonts] = useState([]);

  // Right panel
  const [rightTab, setRightTab] = useState('block'); // 'block' | 'fields'
  const [quickDefineKey, setQuickDefineKey] = useState(null); // pre-fill key in Fields tab

  // Preview modal
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  // Fabric refs
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const scaleRef = useRef(1);
  const isLoadingRef = useRef(false);

  // ── Init Fabric Canvas ───────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_MAX_WIDTH,
      height: 520,
      backgroundColor: '#e5e7eb',
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;
    setCanvasReady(true);

    const onSelect = ({ selected }) => {
      if (selected?.[0]?.data) {
        setSelectedBlockData({ ...selected[0].data });
        setRightTab('block');
      }
    };
    const onClear = () => setSelectedBlockData(null);
    const onModified = ({ target }) => {
      if (!target?.data) return;
      const s = scaleRef.current;
      const w = (target.width || 200) * (target.scaleX || 1);
      const h = (target.height || 50) * (target.scaleY || 1);
      target.set({ scaleX: 1, scaleY: 1 });
      target.data = {
        ...target.data,
        x: Math.round(target.left / s),
        y: Math.round(target.top / s),
        width: Math.round(w / s),
        height: Math.round(h / s),
        rotation: Math.round(target.angle || 0),
      };
      setSelectedBlockData({ ...target.data });
    };

    canvas.on('selection:created', onSelect);
    canvas.on('selection:updated', onSelect);
    canvas.on('selection:cleared', onClear);
    canvas.on('object:modified', onModified);

    return () => {
      canvas.off('selection:created', onSelect);
      canvas.off('selection:updated', onSelect);
      canvas.off('selection:cleared', onClear);
      canvas.off('object:modified', onModified);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load Template + Spreads ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [spreadsRes, tplRes] = await Promise.all([
          fetch(`${API_URL}/api/admin/templates/${templateId}/spreads`),
          fetch(`${API_URL}/api/templates/${templateId}`),
        ]);
        const spreadsData = await spreadsRes.json();
        const tplData = await tplRes.json();
        setSpreads(spreadsData.spreads || []);
        setTemplate(tplData);
        setFieldDefs(tplData.field_definitions || []);
      } catch {
        toast.error('Failed to load template');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [templateId]);

  // ── Load Custom Fonts ────────────────────────────────────────────────────────
  useEffect(() => {
    const loadFonts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/assets/fonts`);
        const data = await res.json();
        const fonts = data.fonts || [];

        // Register each font so Fabric.js canvas can render it
        await Promise.all(fonts.map(async (font) => {
          try {
            const ff = new FontFace(font.name, `url(${API_URL}${font.publicUrl})`);
            const loaded = await ff.load();
            document.fonts.add(loaded);
          } catch (e) {
            console.warn(`Font load failed: ${font.name}`, e);
          }
        }));

        setAvailableFonts(fonts);

        // Re-render canvas once fonts are ready (so custom-font blocks display correctly)
        if (fabricRef.current) fabricRef.current.requestRenderAll();
      } catch (e) {
        console.warn('Failed to fetch custom fonts:', e);
      }
    };
    loadFonts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Preview text helper ──────────────────────────────────────────────────────
  const applyPreviewText = useCallback((tmpl = '') =>
    tmpl.replace(/\[(\w+)\]/g, (_, key) => {
      const def = fieldDefs.find(f => f.field_key === key);
      return def?.placeholder || `«${key}»`;
    }), [fieldDefs]);

  // ── Load blocks onto canvas ──────────────────────────────────────────────────
  const loadBlocksToCanvas = useCallback((blocks) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const s = scaleRef.current;
    canvas.getObjects().forEach(o => canvas.remove(o));

    blocks.forEach(block => {
      if (block.type !== 'text') return;
      const displayText = isPreview
        ? applyPreviewText(block.text_template || '')
        : (block.text_template || 'New text block');

      const tbox = new fabric.Textbox(displayText, {
        left: (block.x || 0) * s,
        top: (block.y || 0) * s,
        width: Math.max(40, (block.width || 200) * s),
        fontSize: Math.max(8, Math.round((block.font_size || 24) * s)),
        fontFamily: block.font_family || 'Helvetica',
        fontWeight: block.font_weight || 'normal',
        fontStyle: block.italic ? 'italic' : 'normal',
        fill: block.color || '#000000',
        textAlign: block.alignment || 'left',
        angle: block.rotation || 0,
        charSpacing: block.letter_spacing || 0,
        lineHeight: block.line_height || 1.2,
        editable: false,
        borderColor: '#7c3aed',
        cornerColor: '#7c3aed',
        cornerSize: 8,
        transparentCorners: false,
        data: { ...block },
      });
      canvas.add(tbox);
    });
    canvas.renderAll();
  }, [isPreview, applyPreviewText]);

  // ── Load spread image + blocks ───────────────────────────────────────────────
  const loadSpread = useCallback((spreadId) => {
    const canvas = fabricRef.current;
    if (!canvas || isLoadingRef.current) return;

    const spread = spreads.find(s => s.spread_id === spreadId);
    isLoadingRef.current = true;

    canvas.getObjects().forEach(o => canvas.remove(o));
    canvas.setBackgroundImage(null, () => {});

    if (!spread?.spread_image_url) {
      canvas.setWidth(CANVAS_MAX_WIDTH);
      canvas.setHeight(520);
      canvas.backgroundColor = '#e5e7eb';
      scaleRef.current = 1;
      canvas.renderAll();
      loadBlocksToCanvas(spread?.blocks || []);
      isLoadingRef.current = false;
      return;
    }

    const url = `${API_URL}${spread.spread_image_url}`;
    fabric.Image.fromURL(url, (img) => {
      if (!img) { canvas.renderAll(); isLoadingRef.current = false; return; }
      const scale = CANVAS_MAX_WIDTH / img.width;
      scaleRef.current = scale;
      canvas.setWidth(CANVAS_MAX_WIDTH);
      canvas.setHeight(Math.round(img.height * scale));
      canvas.setBackgroundImage(img, () => {
        canvas.renderAll();
        loadBlocksToCanvas(spread.blocks || []);
        isLoadingRef.current = false;
      }, { scaleX: scale, scaleY: scale, originX: 'left', originY: 'top' });
    }, { crossOrigin: 'anonymous' });
  }, [spreads, loadBlocksToCanvas]);

  useEffect(() => {
    if (canvasReady && spreads.length > 0) loadSpread(currentSpreadId);
  }, [currentSpreadId, spreads, canvasReady, loadSpread]);

  useEffect(() => {
    if (!canvasReady || spreads.length === 0) return;
    const spread = spreads.find(s => s.spread_id === currentSpreadId);
    if (spread) loadBlocksToCanvas(spread.blocks || []);
  }, [isPreview, canvasReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add Text Block ───────────────────────────────────────────────────────────
  const addTextBlock = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const s = scaleRef.current;
    const block = {
      spread_id: currentSpreadId,
      block_id: genId(),
      type: 'text',
      x: Math.round(canvas.width / 2 / s) - 100,
      y: Math.round(canvas.height / 2 / s) - 20,
      width: 200, height: 50,
      text_template: 'Enter text or use [field_key]',
      font_family: 'Helvetica', font_size: 24,
      font_weight: 'normal', italic: false,
      font_id: null, font_url: null,
      color: '#000000', alignment: 'center',
      letter_spacing: 0, line_height: 1.2,
      max_lines: 2, overflow_behavior: 'shrink',
      rotation: 0, z_index: 1, allowed_fields: [],
    };
    const tbox = new fabric.Textbox(block.text_template, {
      left: block.x * s, top: block.y * s,
      width: block.width * s,
      fontSize: Math.round(block.font_size * s),
      fontFamily: block.font_family, fill: block.color,
      textAlign: block.alignment,
      charSpacing: block.letter_spacing,
      lineHeight: block.line_height,
      editable: false,
      borderColor: '#7c3aed', cornerColor: '#7c3aed',
      cornerSize: 8, transparentCorners: false,
      data: block,
    });
    canvas.add(tbox);
    canvas.setActiveObject(tbox);
    canvas.renderAll();
    setSelectedBlockData({ ...block });
    setRightTab('block');
  };

  // ── Delete Selected Block ────────────────────────────────────────────────────
  const deleteSelected = () => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active) return;
    canvas.remove(active);
    canvas.renderAll();
    setSelectedBlockData(null);
    toast.success('Block removed');
  };

  // ── Update Block Property ────────────────────────────────────────────────────
  const updateBlockProp = (field, value) => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active?.data) return;
    const s = scaleRef.current;
    switch (field) {
      case 'text_template':
        active.set('text', isPreview ? applyPreviewText(value) : value);
        break;
      case 'font_size':
        active.set('fontSize', Math.max(6, Math.round(Number(value) * s)));
        break;
      case 'font_family': active.set('fontFamily', value); break;
      case 'font_weight': active.set('fontWeight', value); break;
      case 'italic': active.set('fontStyle', value ? 'italic' : 'normal'); break;
      case 'color': active.set('fill', value); break;
      case 'alignment': active.set('textAlign', value); break;
      case 'letter_spacing': active.set('charSpacing', Number(value) || 0); break;
      case 'line_height': active.set('lineHeight', Math.max(0.5, Number(value) || 1.2)); break;
      default: break;
    }
    active.data = { ...active.data, [field]: value };
    canvas.renderAll();
    setSelectedBlockData(prev => ({ ...prev, [field]: value }));
  };

  // ── Update Font Selection (sets font_family + font_id + font_url atomically) ─
  const updateFontSelection = (fontData) => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active?.data) return;
    active.set('fontFamily', fontData.font_family);
    const updates = {
      font_family: fontData.font_family,
      font_id: fontData.font_id || null,
      font_url: fontData.font_url || null,
    };
    active.data = { ...active.data, ...updates };
    canvas.renderAll();
    setSelectedBlockData(prev => ({ ...prev, ...updates }));
  };

  // ── Save Field Definitions ───────────────────────────────────────────────────
  const saveFieldDefs = async (newDefs) => {
    try {
      const res = await fetch(`${API_URL}/api/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_definitions: newDefs }),
      });
      if (!res.ok) throw new Error('Save failed');
      setFieldDefs(newDefs);
      toast.success('Fields saved');
    } catch {
      toast.error('Failed to save fields');
    }
  };

  // ── Save Spread Blocks ───────────────────────────────────────────────────────
  const saveBlocks = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setSaving(true);
    const s = scaleRef.current;
    const blocks = canvas.getObjects()
      .filter(obj => obj.data?.block_id)
      .map(obj => ({
        spread_id: currentSpreadId,
        block_id: obj.data.block_id,
        type: obj.data.type || 'text',
        x: Math.round(obj.left / s),
        y: Math.round(obj.top / s),
        width: Math.round(obj.width / s),
        height: Math.round((obj.height * (obj.scaleY || 1)) / s),
        text_template: obj.data.text_template || obj.text || '',
        font_family: obj.fontFamily || 'Helvetica',
        font_id: obj.data.font_id || null,
        font_url: obj.data.font_url || null,
        font_size: Math.round((obj.fontSize || 24) / s),
        font_weight: obj.fontWeight || 'normal',
        italic: obj.fontStyle === 'italic',
        color: obj.fill || '#000000',
        alignment: obj.textAlign || 'left',
        letter_spacing: obj.charSpacing || 0,
        line_height: obj.lineHeight || 1.2,
        max_lines: obj.data.max_lines || 1,
        overflow_behavior: obj.data.overflow_behavior || 'shrink',
        rotation: Math.round(obj.angle || 0),
        z_index: obj.data.z_index || 1,
        allowed_fields: obj.data.allowed_fields || [],
      }));
    try {
      const res = await fetch(
        `${API_URL}/api/admin/templates/${templateId}/spreads/${currentSpreadId}/blocks`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(blocks) }
      );
      if (!res.ok) throw new Error();
      setSpreads(prev => prev.map(s =>
        s.spread_id === currentSpreadId ? { ...s, blocks } : s
      ));
      toast.success(`Saved ${blocks.length} block${blocks.length !== 1 ? 's' : ''} for page ${currentSpreadId + 1}`);
    } catch {
      toast.error('Failed to save blocks');
    } finally {
      setSaving(false);
    }
  };

  // ── Full Preview ─────────────────────────────────────────────────────────────
  const showFullPreview = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setGeneratingPreview(true);

    // Temporarily apply preview text to all blocks
    const backups = [];
    canvas.getObjects().forEach(obj => {
      if (obj.data?.text_template) {
        backups.push({ obj, text: obj.text });
        obj.set('text', applyPreviewText(obj.data.text_template));
      }
    });
    canvas.renderAll();

    // Capture at 2× resolution
    setTimeout(() => {
      const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.9, multiplier: 2 });
      setPreviewDataUrl(dataUrl);
      setShowPreviewModal(true);
      setGeneratingPreview(false);

      // Restore edit text if not in preview mode
      if (!isPreview) {
        backups.forEach(({ obj, text }) => obj.set('text', text));
        canvas.renderAll();
      }
    }, 80);
  };

  // ── Quick Define from Block Config ───────────────────────────────────────────
  const handleQuickDefine = (key) => {
    setQuickDefineKey(key);
    setRightTab('fields');
  };

  const getTokensInText = (text = '') =>
    [...new Set((text.match(/\[(\w+)\]/g) || []).map(m => m.slice(1, -1)))];

  const isValidToken = (key) => fieldDefs.some(f => f.field_key === key);

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading editor...</p>
        </div>
      </div>
    );
  }

  const totalBlocks = spreads.reduce((acc, s) => acc + (s.blocks?.length || 0), 0);

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden" data-testid="spread-block-editor">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors"
            data-testid="back-btn"
          >
            <ChevronLeft size={18} />
            <span className="text-sm">Back</span>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <h1 className="font-semibold text-gray-900 text-sm leading-tight">{template?.title || 'Template'}</h1>
            <p className="text-xs text-gray-400">
              Spread Editor · {totalBlocks} blocks · {fieldDefs.length} fields
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Full Preview */}
          <button
            onClick={showFullPreview}
            disabled={generatingPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
            data-testid="full-preview-btn"
            title="See how this page looks to your customer"
          >
            {generatingPreview
              ? <Loader2 size={14} className="animate-spin" />
              : <ZoomIn size={14} />}
            Full Preview
          </button>

          {/* Edit/Preview toggle */}
          <button
            onClick={() => setIsPreview(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isPreview
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="preview-toggle"
          >
            {isPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {isPreview ? 'Edit Mode' : 'Preview'}
          </button>

          <button
            onClick={saveBlocks}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-60"
            data-testid="save-blocks-btn"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Page
          </button>
        </div>
      </div>

      {/* ── Main 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Spread List */}
        <div className="w-40 bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pages</p>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {spreads.map(spread => (
              <button
                key={spread.spread_id}
                onClick={() => setCurrentSpreadId(spread.spread_id)}
                className={`w-full rounded-lg border-2 transition-all p-1 text-left ${
                  currentSpreadId === spread.spread_id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-100 hover:border-purple-200 hover:bg-gray-50'
                }`}
                data-testid={`spread-${spread.spread_id}`}
              >
                <div className="w-full aspect-video bg-gray-100 rounded overflow-hidden mb-1">
                  {spread.spread_image_url ? (
                    <img
                      src={`${API_URL}${spread.spread_image_url}`}
                      alt={`Page ${spread.spread_id + 1}`}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Layers size={14} className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-medium text-gray-600">pg {spread.spread_id + 1}</span>
                  {(spread.blocks?.length || 0) > 0 && (
                    <span className="text-xs bg-purple-100 text-purple-600 rounded-full px-1">
                      {spread.blocks.length}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {spreads.length === 0 && (
              <div className="text-center py-6 text-gray-300">
                <Layers size={20} className="mx-auto mb-1" />
                <p className="text-xs">No pages</p>
              </div>
            )}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <button
              onClick={addTextBlock}
              disabled={isPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
              data-testid="add-text-block-btn"
            >
              <Plus size={14} />
              Add Text Block
            </button>
            {selectedBlockData && !isPreview && (
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 border border-red-200 transition-colors"
                data-testid="delete-block-btn"
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}
            <div className="flex-1" />
            <span className="text-xs text-gray-400">
              Page {currentSpreadId + 1} / {spreads.length}
              {selectedBlockData && <span className="ml-2 text-purple-500">· block selected</span>}
            </span>
          </div>

          {/* Canvas scroll area */}
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-200">
            <div className="shadow-xl rounded overflow-hidden" data-testid="canvas-container">
              <canvas ref={canvasRef} />
            </div>
          </div>

          {/* Hint bar */}
          {!isPreview && (
            <div className="bg-white border-t border-gray-100 px-4 py-1.5 flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
              <MousePointer size={11} />
              Click to select · Drag to move · Handles to resize
            </div>
          )}
        </div>

        {/* Right: Block Config + Field Definitions */}
        <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
          {/* Tab headers */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setRightTab('block')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                rightTab === 'block'
                  ? 'border-purple-600 text-purple-700 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid="tab-block"
            >
              <Type size={13} />
              Block
              {selectedBlockData && (
                <span className="w-2 h-2 rounded-full bg-purple-500" />
              )}
            </button>
            <button
              onClick={() => setRightTab('fields')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                rightTab === 'fields'
                  ? 'border-purple-600 text-purple-700 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid="tab-fields"
            >
              <Settings size={13} />
              Fields
              {fieldDefs.length > 0 && (
                <span className="ml-0.5 text-xs bg-purple-100 text-purple-700 px-1.5 rounded-full">
                  {fieldDefs.length}
                </span>
              )}
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'block' ? (
              selectedBlockData ? (
                <BlockConfigPanel
                  block={selectedBlockData}
                  fieldDefs={fieldDefs}
                  availableFonts={availableFonts}
                  onUpdate={updateBlockProp}
                  onFontSelect={updateFontSelection}
                  onDelete={deleteSelected}
                  onQuickDefine={handleQuickDefine}
                  getTokensInText={getTokensInText}
                  isValidToken={isValidToken}
                />
              ) : (
                <EmptyBlockState
                  fieldDefs={fieldDefs}
                  onSwitchToFields={() => setRightTab('fields')}
                />
              )
            ) : (
              <FieldDefinitionsPanel
                fieldDefs={fieldDefs}
                onSave={saveFieldDefs}
                defaultKey={quickDefineKey}
                onClearDefaultKey={() => setQuickDefineKey(null)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Full Preview Modal ── */}
      {showPreviewModal && (
        <PreviewModal
          dataUrl={previewDataUrl}
          spreadId={currentSpreadId}
          onClose={() => { setShowPreviewModal(false); setPreviewDataUrl(null); }}
          onRefresh={showFullPreview}
        />
      )}
    </div>
  );
}

// ── Empty Block State ──────────────────────────────────────────────────────────
function EmptyBlockState({ fieldDefs, onSwitchToFields }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-5 text-center text-gray-400">
      <Type size={28} className="mb-2 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">No block selected</p>
      <p className="text-xs mt-1 mb-4">Click a block on the canvas or add one with the toolbar</p>

      {fieldDefs.length > 0 ? (
        <div className="w-full text-left p-3 bg-purple-50 rounded-lg">
          <p className="text-xs font-semibold text-purple-700 mb-2">Available tokens:</p>
          <div className="flex flex-wrap gap-1">
            {fieldDefs.map(f => (
              <span key={f.field_key} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-mono">
                [{f.field_key}]
              </span>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={onSwitchToFields}
          className="text-xs text-purple-600 hover:underline flex items-center gap-1"
        >
          <Plus size={12} />
          Define personalization fields
        </button>
      )}
    </div>
  );
}

// ── Block Config Panel ─────────────────────────────────────────────────────────
function BlockConfigPanel({ block, fieldDefs, availableFonts, onUpdate, onFontSelect, onDelete, onQuickDefine, getTokensInText, isValidToken }) {
  const tokens = getTokensInText(block.text_template || '');

  // Build unified font option list: system + custom uploads
  const fontOptions = [
    ...SYSTEM_FONTS.map(f => ({ label: f, font_family: f, font_id: null, font_url: null, isCustom: false })),
    ...availableFonts.map(f => ({ label: f.name, font_family: f.name, font_id: f.id, font_url: f.publicUrl, isCustom: true })),
  ];
  const currentFontFamily = block.font_family || 'Helvetica';

  const handleFontChange = (e) => {
    const selected = fontOptions.find(o => o.font_family === e.target.value);
    if (selected) onFontSelect(selected);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* Text Template */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Text Template
          </label>
          <textarea
            value={block.text_template || ''}
            onChange={e => onUpdate('text_template', e.target.value)}
            rows={3}
            placeholder="Hello [dad_name], meet [son_name]!"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
            data-testid="text-template-input"
          />
          <p className="text-xs text-gray-400 mt-1">Use [field_key] for personalization values</p>
        </div>

        {/* Token Validation */}
        {tokens.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Detected Tokens</p>
            <div className="space-y-1">
              {tokens.map(tok => (
                <div key={tok} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                    isValidToken(tok) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    [{tok}] {isValidToken(tok) ? '✓' : '⚠'}
                  </span>
                  {!isValidToken(tok) && (
                    <button
                      onClick={() => onQuickDefine(tok)}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-0.5 ml-2"
                      data-testid={`define-token-${tok}`}
                    >
                      <Plus size={11} />
                      Define
                    </button>
                  )}
                </div>
              ))}
            </div>
            {tokens.some(t => !isValidToken(t)) && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <Info size={11} />
                Undefined tokens won't appear in buyer's form
              </p>
            )}
          </div>
        )}

        {/* Font Family — dropdown merging system + custom fonts */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Font Family</label>
          <select
            value={currentFontFamily}
            onChange={handleFontChange}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
            data-testid="font-family-select"
            style={{ fontFamily: currentFontFamily }}
          >
            <optgroup label="System Fonts">
              {SYSTEM_FONTS.map(f => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </optgroup>
            {availableFonts.length > 0 && (
              <optgroup label="Uploaded Fonts">
                {availableFonts.map(f => (
                  <option key={f.id} value={f.name} style={{ fontFamily: f.name }}>{f.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          {block.font_id && (
            <p className="text-xs text-purple-600 mt-0.5 flex items-center gap-1">
              <Type size={10} /> Custom font active
            </p>
          )}
        </div>

        {/* Font Size + Style */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Size (pt)</label>
            <input
              type="number"
              value={block.font_size || 24}
              onChange={e => onUpdate('font_size', Number(e.target.value))}
              min={6} max={200}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              data-testid="font-size-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Style</label>
            <div className="flex gap-1">
              {[
                { prop: 'font_weight', val: block.font_weight === 'bold' ? 'normal' : 'bold', active: block.font_weight === 'bold', Icon: Bold, tid: 'bold-toggle' },
                { prop: 'italic', val: !block.italic, active: block.italic, Icon: Italic, tid: 'italic-toggle' }
              ].map(({ prop, val, active, Icon, tid }) => (
                <button
                  key={tid}
                  onClick={() => onUpdate(prop, val)}
                  className={`flex-1 py-2 rounded-lg border transition-colors ${
                    active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                  }`}
                  data-testid={tid}
                >
                  <Icon size={13} className="mx-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Letter Spacing + Line Height */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Letter Spacing
            </label>
            <input
              type="number"
              value={block.letter_spacing ?? 0}
              onChange={e => onUpdate('letter_spacing', Number(e.target.value))}
              min={-200} max={800} step={10}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              data-testid="letter-spacing-input"
            />
            <p className="text-xs text-gray-400 mt-0.5">‰ of font size</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Line Height
            </label>
            <input
              type="number"
              value={block.line_height ?? 1.2}
              onChange={e => onUpdate('line_height', Number(e.target.value))}
              min={0.5} max={4.0} step={0.1}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              data-testid="line-height-input"
            />
            <p className="text-xs text-gray-400 mt-0.5">multiplier</p>
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={block.color || '#000000'}
              onChange={e => onUpdate('color', e.target.value)}
              className="w-9 h-9 rounded cursor-pointer border border-gray-200"
              data-testid="color-input"
            />
            <input
              type="text"
              value={block.color || '#000000'}
              onChange={e => onUpdate('color', e.target.value)}
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg font-mono focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Alignment */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alignment</label>
          <div className="flex gap-1">
            {[
              { v: 'left', Icon: AlignLeft, tid: 'align-left' },
              { v: 'center', Icon: AlignCenter, tid: 'align-center' },
              { v: 'right', Icon: AlignRight, tid: 'align-right' },
            ].map(({ v, Icon, tid }) => (
              <button
                key={v}
                onClick={() => onUpdate('alignment', v)}
                className={`flex-1 py-2 rounded-lg border transition-colors ${
                  block.alignment === v
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                }`}
                data-testid={tid}
              >
                <Icon size={13} className="mx-auto" />
              </button>
            ))}
          </div>
        </div>

        {/* Position read-only */}
        <div className="grid grid-cols-2 gap-2">
          {[['X', block.x || 0], ['Y', block.y || 0]].map(([label, val]) => (
            <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-400">{label}: </span>
              <span className="text-sm font-mono">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 border border-red-200 transition-colors"
          data-testid="delete-block-panel-btn"
        >
          <Trash2 size={13} />
          Delete Block
        </button>
      </div>
    </div>
  );
}

// ── Field Definitions Panel (in Spread Editor) ────────────────────────────────
function FieldDefinitionsPanel({ fieldDefs, onSave, defaultKey, onClearDefaultKey }) {
  const [fields, setFields] = useState(fieldDefs);
  const [showForm, setShowForm] = useState(!!defaultKey);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(() => emptyForm(defaultKey));
  const [saving, setSaving] = useState(false);

  function emptyForm(key = '') {
    return { field_key: key || '', label: '', type: 'text', required: true, placeholder: '', help_text: '', max_length: '', options: '' };
  }

  // If a quick-define key arrives from parent, open form pre-filled
  useEffect(() => {
    if (defaultKey) {
      setForm(emptyForm(defaultKey));
      setEditIdx(null);
      setShowForm(true);
      onClearDefaultKey();
    }
  }, [defaultKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep in sync when parent fieldDefs change (e.g. initial load)
  useEffect(() => {
    setFields(fieldDefs);
  }, [fieldDefs]);

  const openEdit = (idx) => {
    const f = fields[idx];
    setForm({ ...f, max_length: f.max_length ? String(f.max_length) : '', options: (f.options || []).join(', ') });
    setEditIdx(idx);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.field_key.trim()) { toast.error('Field key required'); return; }
    if (!form.label.trim()) { toast.error('Label required'); return; }
    if (/\s/.test(form.field_key)) { toast.error('Field key cannot have spaces'); return; }

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

    let updated;
    if (editIdx !== null) {
      updated = fields.map((f, i) => i === editIdx ? newField : f);
    } else {
      if (fields.some(f => f.field_key === newField.field_key)) {
        toast.error(`Key "${newField.field_key}" already exists`);
        return;
      }
      updated = [...fields, newField];
    }

    setSaving(true);
    try {
      await onSave(updated);
      setFields(updated);
      setShowForm(false);
      setEditIdx(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (idx) => {
    const updated = fields.filter((_, i) => i !== idx);
    await onSave(updated);
    setFields(updated);
  };

  const moveField = (idx, dir) => {
    const arr = [...fields];
    const t = idx + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[idx], arr[t]] = [arr[t], arr[idx]];
    setFields(arr);
    onSave(arr);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Info banner */}
        <div className="mx-3 mt-3 p-2.5 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-800">
          Fields defined here appear in the buyer's personalization form.
          Use <span className="font-mono bg-purple-100 px-1 rounded">[field_key]</span> in text blocks above.
        </div>

        {/* Field list */}
        <div className="px-3 pt-3 space-y-1.5">
          {fields.map((field, idx) => (
            <div
              key={field.field_key}
              className="flex items-start gap-1.5 p-2.5 bg-gray-50 border border-gray-200 rounded-lg"
              data-testid={`field-${field.field_key}`}
            >
              {/* Reorder */}
              <div className="flex flex-col mt-0.5">
                <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 p-0.5">
                  <ChevronUp size={12} />
                </button>
                <button onClick={() => moveField(idx, fields.length - 1)} disabled={idx === fields.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 p-0.5">
                  <ChevronDown size={12} />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-mono text-xs font-bold text-gray-800">[{field.field_key}]</span>
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{field.type}</span>
                  {field.required && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">req</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{field.label}</p>
                {field.placeholder && (
                  <p className="text-xs text-gray-400 truncate">"{field.placeholder}"</p>
                )}
              </div>

              <div className="flex gap-0.5 flex-shrink-0">
                <button onClick={() => openEdit(idx)} className="p-1 text-gray-400 hover:text-purple-600 rounded">
                  <Settings size={12} />
                </button>
                <button onClick={() => deleteField(idx)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}

          {fields.length === 0 && !showForm && (
            <div className="text-center py-6 text-gray-400">
              <Layers size={24} className="mx-auto mb-2 text-gray-300" />
              <p className="text-xs">No fields defined yet</p>
            </div>
          )}
        </div>

        {/* Inline Add / Edit Form */}
        {showForm && (
          <div className="mx-3 mt-3 p-3 border-2 border-purple-200 rounded-lg bg-purple-50 space-y-2.5">
            <p className="text-xs font-bold text-gray-700">
              {editIdx !== null ? 'Edit Field' : 'New Field'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600 font-medium">Key *</label>
                <input
                  value={form.field_key}
                  onChange={e => setForm(p => ({ ...p, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="dad_name"
                  disabled={editIdx !== null}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs border border-gray-300 rounded font-mono focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100"
                  data-testid="field-key-input"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium">Label *</label>
                <input
                  value={form.label}
                  onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="Father's Name"
                  className="w-full mt-0.5 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
                  data-testid="field-label-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600 font-medium">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
                  data-testid="field-type-select"
                >
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.required}
                    onChange={e => setForm(p => ({ ...p, required: e.target.checked }))}
                    className="w-3.5 h-3.5 text-purple-600 rounded"
                  />
                  <span className="text-xs text-gray-600 font-medium">Required</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium">Placeholder</label>
              <input
                value={form.placeholder}
                onChange={e => setForm(p => ({ ...p, placeholder: e.target.value }))}
                placeholder="e.g. Enter dad's name..."
                className="w-full mt-0.5 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {form.type === 'select' && (
              <div>
                <label className="text-xs text-gray-600 font-medium">Options (comma-sep)</label>
                <input
                  value={form.options}
                  onChange={e => setForm(p => ({ ...p, options: e.target.value }))}
                  placeholder="Option 1, Option 2"
                  className="w-full mt-0.5 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                data-testid="save-field-btn"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                {editIdx !== null ? 'Update' : 'Add Field'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditIdx(null); }}
                className="px-3 py-1.5 text-gray-600 text-xs rounded hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer: Add button */}
      {!showForm && (
        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={() => { setForm(emptyForm()); setEditIdx(null); setShowForm(true); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 text-xs font-medium transition-colors"
            data-testid="add-field-btn"
          >
            <Plus size={13} />
            Add New Field
          </button>
        </div>
      )}
    </div>
  );
}

// ── Full Preview Modal ────────────────────────────────────────────────────────
function PreviewModal({ dataUrl, spreadId, onClose, onRefresh }) {
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `spread-${spreadId + 1}-preview.jpg`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="font-semibold text-gray-900">Page {spreadId + 1} — Live Preview</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Showing how text blocks will appear to your customer (with sample values)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              title="Refresh preview"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 border border-blue-200 transition-colors"
            >
              <Download size={14} />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview image */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-gray-100">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`Page ${spreadId + 1} preview`}
              className="max-w-full max-h-full rounded-lg shadow-xl"
              style={{ imageRendering: 'auto' }}
            />
          ) : (
            <div className="text-center text-gray-400">
              <Loader2 size={32} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">Generating preview...</p>
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-5 py-2.5 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            Sample values from field placeholders are shown. Actual customer values will be used when generating the storybook.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SpreadBlockEditor;
