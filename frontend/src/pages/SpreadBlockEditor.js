import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import {
  ChevronLeft, Plus, Trash2, Eye, EyeOff, Save, Loader2,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Type,
  Layers, MousePointer, Info
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const CANVAS_MAX_WIDTH = 780;

const genId = () => `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function SpreadBlockEditor() {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [spreads, setSpreads] = useState([]);
  const [fieldDefs, setFieldDefs] = useState([]);
  const [currentSpreadId, setCurrentSpreadId] = useState(0);
  const [selectedBlockData, setSelectedBlockData] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);

  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const scaleRef = useRef(1);
  const isLoadingRef = useRef(false);

  // ── Initialize Fabric Canvas ──────────────────────────────────────────
  // NOTE: Must depend on `loading` because canvas is not in DOM during loading state
  useEffect(() => {
    if (loading) return; // Canvas not in DOM yet
    if (fabricRef.current) { return; }
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const canvas = new fabric.Canvas(canvasEl, {
      width: CANVAS_MAX_WIDTH,
      height: 520,
      backgroundColor: '#e5e7eb',
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;
    setCanvasReady(true);

    const onSelect = ({ selected }) => {
      if (selected?.[0]?.data) setSelectedBlockData({ ...selected[0].data });
    };
    const onClear = () => setSelectedBlockData(null);
    const onModified = ({ target }) => {
      if (!target?.data) return;
      const s = scaleRef.current;
      const w = (target.width || 200) * (target.scaleX || 1);
      const h = (target.height || 50) * (target.scaleY || 1);
      target.data = {
        ...target.data,
        x: Math.round(target.left / s),
        y: Math.round(target.top / s),
        width: Math.round(w / s),
        height: Math.round(h / s),
        rotation: Math.round(target.angle || 0),
      };
      // Reset scale after baking into width/height
      target.set({ scaleX: 1, scaleY: 1 });
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

  // ── Fetch Template & Spreads ──────────────────────────────────────────
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

  // ── Load Spread to Canvas ─────────────────────────────────────────────
  const applyPreviewText = useCallback((template_text) => {
    return template_text.replace(/\[(\w+)\]/g, (_, key) => {
      const def = fieldDefs.find(f => f.field_key === key);
      return def?.placeholder || `[${key}]`;
    });
  }, [fieldDefs]);

  const loadBlocksToCanvas = useCallback((blocks) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const s = scaleRef.current;

    canvas.getObjects().forEach(obj => canvas.remove(obj));

    blocks.forEach(block => {
      if (block.type !== 'text') return;
      const displayText = isPreview
        ? applyPreviewText(block.text_template || '')
        : (block.text_template || 'New text block');

      const tbox = new fabric.Textbox(displayText, {
        left: (block.x || 0) * s,
        top: (block.y || 0) * s,
        width: (block.width || 200) * s,
        fontSize: Math.max(10, Math.round((block.font_size || 24) * s)),
        fontFamily: block.font_family || 'Helvetica',
        fontWeight: block.font_weight || 'normal',
        fontStyle: block.italic ? 'italic' : 'normal',
        fill: block.color || '#000000',
        textAlign: block.alignment || 'left',
        angle: block.rotation || 0,
        editable: false,
        hasControls: true,
        hasBorders: true,
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

  const loadSpread = useCallback((spreadId) => {
    const canvas = fabricRef.current;
    if (!canvas || isLoadingRef.current) return;

    const spread = spreads.find(s => s.spread_id === spreadId);
    isLoadingRef.current = true;

    canvas.getObjects().forEach(obj => canvas.remove(obj));
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
      if (!img) {
        canvas.renderAll();
        isLoadingRef.current = false;
        return;
      }
      const scale = CANVAS_MAX_WIDTH / img.width;
      const canvasH = Math.round(img.height * scale);
      scaleRef.current = scale;

      canvas.setWidth(CANVAS_MAX_WIDTH);
      canvas.setHeight(canvasH);

      canvas.setBackgroundImage(img, () => {
        canvas.renderAll();
        loadBlocksToCanvas(spread.blocks || []);
        isLoadingRef.current = false;
      }, { scaleX: scale, scaleY: scale, originX: 'left', originY: 'top' });
    }, { crossOrigin: 'anonymous' });
  }, [spreads, loadBlocksToCanvas]);

  useEffect(() => {
    if (canvasReady && spreads.length > 0) {
      loadSpread(currentSpreadId);
    }
  }, [currentSpreadId, spreads, canvasReady, loadSpread]);

  // Re-render when preview toggles
  useEffect(() => {
    if (!canvasReady || spreads.length === 0) return;
    const spread = spreads.find(s => s.spread_id === currentSpreadId);
    if (!spread) return;
    loadBlocksToCanvas(spread.blocks || []);
  }, [isPreview, canvasReady, currentSpreadId, spreads, loadBlocksToCanvas]);

  // ── Add Block ─────────────────────────────────────────────────────────
  const addTextBlock = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const s = scaleRef.current;

    const block = {
      spread_id: currentSpreadId,
      block_id: genId(),
      type: 'text',
      x: Math.round(canvas.width / 2 / s) - 100,
      y: Math.round(canvas.height / 2 / s) - 25,
      width: 200,
      height: 50,
      text_template: 'Enter text or use [field_key]',
      font_family: 'Helvetica',
      font_size: 24,
      font_weight: 'normal',
      italic: false,
      color: '#000000',
      alignment: 'center',
      max_lines: 2,
      overflow_behavior: 'shrink',
      rotation: 0,
      z_index: 1,
      allowed_fields: [],
    };

    const tbox = new fabric.Textbox(block.text_template, {
      left: block.x * s,
      top: block.y * s,
      width: block.width * s,
      fontSize: Math.round(block.font_size * s),
      fontFamily: block.font_family,
      fill: block.color,
      textAlign: block.alignment,
      editable: false,
      borderColor: '#7c3aed',
      cornerColor: '#7c3aed',
      cornerSize: 8,
      transparentCorners: false,
      data: block,
    });

    canvas.add(tbox);
    canvas.setActiveObject(tbox);
    canvas.renderAll();
    setSelectedBlockData({ ...block });
  };

  // ── Delete Selected Block ─────────────────────────────────────────────
  const deleteSelectedBlock = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    canvas.remove(active);
    canvas.renderAll();
    setSelectedBlockData(null);
    toast.success('Block removed');
  };

  // ── Update Block Property ─────────────────────────────────────────────
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
      case 'font_family':
        active.set('fontFamily', value);
        break;
      case 'font_weight':
        active.set('fontWeight', value);
        break;
      case 'italic':
        active.set('fontStyle', value ? 'italic' : 'normal');
        break;
      case 'color':
        active.set('fill', value);
        break;
      case 'alignment':
        active.set('textAlign', value);
        break;
      default: break;
    }

    active.data = { ...active.data, [field]: value };
    canvas.renderAll();
    setSelectedBlockData(prev => ({ ...prev, [field]: value }));
  };

  // ── Save Spread Blocks ────────────────────────────────────────────────
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
        font_size: Math.round((obj.fontSize || 24) / s),
        font_weight: obj.fontWeight || 'normal',
        italic: obj.fontStyle === 'italic',
        color: obj.fill || '#000000',
        alignment: obj.textAlign || 'left',
        max_lines: obj.data.max_lines || 1,
        overflow_behavior: obj.data.overflow_behavior || 'shrink',
        rotation: Math.round(obj.angle || 0),
        z_index: obj.data.z_index || 1,
        allowed_fields: obj.data.allowed_fields || [],
      }));

    try {
      const res = await fetch(
        `${API_URL}/api/admin/templates/${templateId}/spreads/${currentSpreadId}/blocks`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(blocks),
        }
      );
      if (!res.ok) throw new Error('Save failed');

      // Update local spreads state
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

  // ── Helpers ───────────────────────────────────────────────────────────
  const getTokensInText = (text = '') => {
    const matches = text.match(/\[(\w+)\]/g) || [];
    return [...new Set(matches.map(m => m.slice(1, -1)))];
  };

  const isValidToken = (key) => fieldDefs.some(f => f.field_key === key);

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

  const currentSpread = spreads.find(s => s.spread_id === currentSpreadId);
  const totalBlocks = spreads.reduce((acc, s) => acc + (s.blocks?.length || 0), 0);

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden" data-testid="spread-block-editor">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
            data-testid="back-btn"
          >
            <ChevronLeft size={18} />
            <span className="text-sm">Back</span>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">{template?.title || 'Template'}</h1>
            <p className="text-xs text-gray-500">Spread Block Editor · {totalBlocks} blocks total</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreview(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isPreview
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="preview-toggle"
          >
            {isPreview ? <EyeOff size={15} /> : <Eye size={15} />}
            {isPreview ? 'Edit Mode' : 'Preview'}
          </button>

          <button
            onClick={saveBlocks}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-60"
            data-testid="save-blocks-btn"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Page
          </button>
        </div>
      </div>

      {/* ── Main 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Spread List */}
        <div className="w-44 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pages</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {spreads.map(spread => (
              <button
                key={spread.spread_id}
                onClick={() => setCurrentSpreadId(spread.spread_id)}
                className={`w-full rounded-lg border-2 transition-all p-1.5 text-left ${
                  currentSpreadId === spread.spread_id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-100 hover:border-purple-200 hover:bg-gray-50'
                }`}
                data-testid={`spread-${spread.spread_id}`}
              >
                {/* Thumbnail */}
                <div className="w-full aspect-video bg-gray-100 rounded overflow-hidden mb-1">
                  {spread.spread_image_url ? (
                    <img
                      src={`${API_URL}${spread.spread_image_url}`}
                      alt={`Page ${spread.spread_id + 1}`}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Layers size={16} />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Page {spread.spread_id + 1}</span>
                  {(spread.blocks?.length || 0) > 0 && (
                    <span className="text-xs bg-purple-100 text-purple-600 rounded-full px-1.5">
                      {spread.blocks.length}
                    </span>
                  )}
                </div>
              </button>
            ))}

            {spreads.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Layers size={24} className="mx-auto mb-2" />
                <p className="text-xs">No pages yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas Toolbar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={addTextBlock}
              disabled={isPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
              data-testid="add-text-block-btn"
            >
              <Plus size={15} />
              Add Text Block
            </button>

            {selectedBlockData && !isPreview && (
              <button
                onClick={deleteSelectedBlock}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
                data-testid="delete-block-btn"
              >
                <Trash2 size={15} />
                Delete Block
              </button>
            )}

            <div className="flex-1" />
            <p className="text-xs text-gray-400">
              Page {currentSpreadId + 1} of {spreads.length}
              {selectedBlockData && <span className="ml-2 text-purple-600">· Block selected</span>}
            </p>
          </div>

          {/* Canvas Scroll Area */}
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-200">
            <div className="shadow-xl rounded overflow-hidden" data-testid="canvas-container">
              <canvas ref={canvasRef} />
            </div>
          </div>

          {/* Canvas hint */}
          {!isPreview && (
            <div className="bg-white border-t border-gray-100 px-4 py-2 flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
              <MousePointer size={12} />
              Click to select · Drag to move · Handles to resize
            </div>
          )}
        </div>

        {/* Right: Block Config Panel */}
        <div className="w-64 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          {selectedBlockData && !isPreview ? (
            <BlockConfigPanel
              block={selectedBlockData}
              fieldDefs={fieldDefs}
              onUpdate={updateBlockProp}
              onDelete={deleteSelectedBlock}
              getTokensInText={getTokensInText}
              isValidToken={isValidToken}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              {isPreview ? (
                <>
                  <Eye size={32} className="mb-3 text-amber-400" />
                  <p className="text-sm font-medium text-amber-600">Preview Mode</p>
                  <p className="text-xs mt-1">Showing field placeholders replaced with sample values</p>
                </>
              ) : (
                <>
                  <Type size={32} className="mb-3" />
                  <p className="text-sm font-medium text-gray-600">No block selected</p>
                  <p className="text-xs mt-1">Click a block on the canvas or add a new one</p>
                  {fieldDefs.length > 0 && (
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg text-left w-full">
                      <p className="text-xs font-semibold text-purple-700 mb-2">Available tokens:</p>
                      <div className="flex flex-wrap gap-1">
                        {fieldDefs.map(f => (
                          <span key={f.field_key} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-mono">
                            [{f.field_key}]
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Block Config Panel Component ─────────────────────────────────────────────
function BlockConfigPanel({ block, fieldDefs, onUpdate, onDelete, getTokensInText, isValidToken }) {
  const tokens = getTokensInText(block.text_template || '');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Block Settings</p>
        <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{block.block_id}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Text Template */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Text Template
          </label>
          <textarea
            value={block.text_template || ''}
            onChange={e => onUpdate('text_template', e.target.value)}
            rows={3}
            placeholder="Enter text or [field_key]"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
            data-testid="text-template-input"
          />
          <p className="text-xs text-gray-400 mt-1">
            Use [field_key] to insert personalization values
          </p>
        </div>

        {/* Token Validation */}
        {tokens.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Detected Tokens</p>
            <div className="flex flex-wrap gap-1">
              {tokens.map(tok => (
                <span
                  key={tok}
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    isValidToken(tok)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                  title={isValidToken(tok) ? 'Valid field' : 'Field not defined!'}
                >
                  [{tok}] {isValidToken(tok) ? '✓' : '⚠'}
                </span>
              ))}
            </div>
            {tokens.some(t => !isValidToken(t)) && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <Info size={11} />
                Some tokens are not defined in Field Definitions
              </p>
            )}
          </div>
        )}

        {/* Font Family */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Font Family</label>
          <input
            type="text"
            value={block.font_family || 'Helvetica'}
            onChange={e => onUpdate('font_family', e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Helvetica"
            data-testid="font-family-input"
          />
        </div>

        {/* Font Size + Bold/Italic */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Font Size</label>
            <input
              type="number"
              value={block.font_size || 24}
              onChange={e => onUpdate('font_size', Number(e.target.value))}
              min={6}
              max={200}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              data-testid="font-size-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Style</label>
            <div className="flex gap-1">
              <button
                onClick={() => onUpdate('font_weight', block.font_weight === 'bold' ? 'normal' : 'bold')}
                className={`flex-1 py-2 rounded-lg border transition-colors ${
                  block.font_weight === 'bold'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                }`}
                data-testid="bold-toggle"
              >
                <Bold size={14} className="mx-auto" />
              </button>
              <button
                onClick={() => onUpdate('italic', !block.italic)}
                className={`flex-1 py-2 rounded-lg border transition-colors ${
                  block.italic
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                }`}
                data-testid="italic-toggle"
              >
                <Italic size={14} className="mx-auto" />
              </button>
            </div>
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Text Color</label>
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
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Alignment */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Alignment</label>
          <div className="flex gap-1">
            {[
              { value: 'left', icon: AlignLeft },
              { value: 'center', icon: AlignCenter },
              { value: 'right', icon: AlignRight },
            ].map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => onUpdate('alignment', value)}
                className={`flex-1 py-2 rounded-lg border transition-colors ${
                  block.alignment === value
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                }`}
                data-testid={`align-${value}`}
              >
                <Icon size={14} className="mx-auto" />
              </button>
            ))}
          </div>
        </div>

        {/* Position (read-only display) */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Position (px)</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-400">X: </span>
              <span className="text-sm font-mono">{block.x || 0}</span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-400">Y: </span>
              <span className="text-sm font-mono">{block.y || 0}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Delete Block Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 border border-red-200 transition-colors"
          data-testid="delete-block-panel-btn"
        >
          <Trash2 size={14} />
          Delete Block
        </button>
      </div>
    </div>
  );
}

export default SpreadBlockEditor;
