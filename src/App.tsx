import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import mermaid from 'mermaid';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage, StringStream } from '@codemirror/language';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';
import {
  Moon,
  Sun,
  FileCode,
  Trash2,
  RotateCcw,
  Layout,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Circle,
  Clipboard,
  Search,
  Share2,
  Undo2,
  Redo2,
  X,
  Cog,
  Scan,
  Network,
  ArrowRightLeft,
  Boxes,
  CircleDot,
  Database,
  Calendar,
  Download,
  Check,
  Command
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

const templates = {
  flowchart: {
    name: 'Flowchart',
    desc: 'Processes, workflows & decision trees',
    icon: 'Network',
    code: `graph TD
    A[Start] --> B{Is it complex?}
    B -->|Yes| C[Add more nodes]
    B -->|No| D[Keep it simple]
    C --> E[Review diagram]
    D --> E
    E --> F[Export as SVG]
    F --> G[Done!]`
  },
  sequence: {
    name: 'Sequence Diagram',
    desc: 'Message interactions between actors',
    icon: 'ArrowRightLeft',
    code: `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts <br/>prevail!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!`
  },
  class: {
    name: 'Class Diagram',
    desc: 'Structure of object-oriented systems',
    icon: 'Boxes',
    code: `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
    class Fish{
        -int sizeInFeet
        -canEat()
    }
    class Zebra{
        +bool is_wild
        +run()
    }`
  },
  state: {
    name: 'State Diagram',
    desc: 'Dynamic lifecycle states & transitions',
    icon: 'CircleDot',
    code: `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`
  },
  er: {
    name: 'ER Diagram',
    desc: 'Database tables, columns & relations',
    icon: 'Database',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses`
  },
  gantt: {
    name: 'Gantt Chart',
    desc: 'Project schedules, tasks & milestones',
    icon: 'Calendar',
    code: `gantt
    title A Gantt Diagram
    dateFormat  YYYY-MM-DD
    section Section
    A task           :a1, 2023-01-01, 30d
    Another task     :after a1  , 20d
    section Another
    Task in Another  :2023-01-12  , 12d
    another task      : 24d`
  }
};

const templateIcons: Record<string, any> = {
  Network,
  ArrowRightLeft,
  Boxes,
  CircleDot,
  Database,
  Calendar,
};


type RenderState = 'idle' | 'rendering' | 'ready' | 'error';
type ImageSizeMode = 'auto' | 'width' | 'height';
type ExportTheme = 'current' | 'light' | 'dark';

const STORAGE_KEY = 'mermaid-editor-code';

const encodeHash = (code: string) => '#code=' + btoa(unescape(encodeURIComponent(code)));
const decodeHash = (): string | null => {
  const m = window.location.hash.match(/code=([^&]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(escape(atob(m[1])));
  } catch {
    return null;
  }
};

const getFileName = (extension: string) => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `mermaid-diagram-${stamp}.${extension}`;
};

// Detect the diagram type from the first non-empty line.
const detectType = (code: string): string => {
  const first = code.trim().split('\n').find((l) => l.trim().length) || '';
  const map: Record<string, string> = {
    'graph': 'Flowchart', 'flowchart': 'Flowchart',
    'sequence': 'Sequence', 'sequencediagram': 'Sequence',
    'class': 'Class', 'classdiagram': 'Class',
    'state': 'State', 'statediagram': 'State',
    'er': 'ER', 'erdiagram': 'ER',
    'gantt': 'Gantt', 'journey': 'Journey',
    'pie': 'Pie', 'mindmap': 'Mindmap', 'timeline': 'Timeline',
  };
  const key = first.split(/[\s{]/)[0].toLowerCase().replace(/[^a-z]/g, '');
  return map[key] || 'Diagram';
};

// Minimal mermaid tokenizer for syntax highlighting.
const mermaidLanguage = StreamLanguage.define({
  token(stream: StringStream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^\/\/.*/)) return 'comment';
    if (stream.match(/^#.*/)) return 'comment';
    if (stream.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram-v2|erDiagram|gantt|journey|pie|mindmap|timeline|gitGraph)/)) return 'keyword';
    if (stream.match(/^(participant|actor|note|loop|alt|opt|par|rect|section|subgraph|end|class|click|style|link|title|dateFormat|axisFormat)/)) return 'keyword';
    if (stream.match(/^["'].*["']/)) return 'string';
    if (stream.match(/^[A-Za-z_][\w-]*/)) return 'variableName';
    if (stream.match(/^[{}[\]()]/)) return 'brace';
    if (stream.match(/^(-->|---|->>|-->>|-\.->|==>|-\.-)/)) return 'operator';
    stream.next();
    return null;
  }
});

const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--accent)', fontWeight: '600' },
  { tag: t.comment, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: t.string, color: '#10b981' },
  { tag: t.operator, color: '#f59e0b' },
  { tag: t.variableName, color: 'var(--text)' },
  { tag: t.brace, color: 'var(--text-muted)' },
]);

const mermaidTheme = (dark: boolean) =>
  EditorView.theme(
    {
      '&': { backgroundColor: 'transparent', color: 'var(--text)', height: '100%' },
      '.cm-content': { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '13px', caretColor: 'var(--accent)' },
      '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)' },
      '.cm-activeLine': { backgroundColor: 'rgb(127 127 127 / 0.08)' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent' },
      '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'rgb(99 102 241 / 0.25)' },
      '.cm-scroller': { overflow: 'auto' },
    },
    { dark }
  );

function App() {
  const initialCode = useMemo(() => decodeHash() || (() => {
    try { return localStorage.getItem(STORAGE_KEY) || templates.flowchart.code; }
    catch { return templates.flowchart.code; }
  })(), []);

  const [diagramCode, setDiagramCode] = useState(initialCode);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mermaid-dark-mode') === 'true');
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [renderState, setRenderState] = useState<RenderState>('idle');
  const [isMermaidReady, setIsMermaidReady] = useState(false);
  const [imageSizeMode, setImageSizeMode] = useState<ImageSizeMode>('auto');
  const [imageSize, setImageSize] = useState(1080);
  const [gridOn, setGridOn] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportTheme, setExportTheme] = useState<ExportTheme>('current');
  const [configOpen, setConfigOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [editorFlex, setEditorFlex] = useState(1);
  const [mermaidConfig, setMermaidConfig] = useState({ theme: 'default', fontFamily: 'Inter, system-ui, sans-serif', securityLevel: 'loose' });

  const diagramRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<any>();
  const notificationTimeoutRef = useRef<any>();
  const transformRef = useRef<any>(null);
  const isUndoRedo = useRef(false);
  const draggingRef = useRef(false);

  const effectiveExportDark = exportTheme === 'dark' || (exportTheme === 'current' && darkMode);

  // ---- History-aware code setter ----
  const pushHistory = useCallback((next: string, prev: string) => {
    if (next === prev) return;
    setPast((p) => [...p, prev]);
    setFuture([]);
  }, []);

  const updateCode = useCallback((next: string) => {
    setDiagramCode((prev) => {
      if (!isUndoRedo.current) pushHistory(next, prev);
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setDiagramCode(() => { isUndoRedo.current = true; setTimeout(() => (isUndoRedo.current = false), 0); return prev; });
      setFuture((f) => [diagramCode, ...f]);
      return p.slice(0, -1);
    });
  }, [diagramCode]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setDiagramCode(() => { isUndoRedo.current = true; setTimeout(() => (isUndoRedo.current = false), 0); return next; });
      setPast((p) => [...p, diagramCode]);
      return f.slice(1);
    });
  }, [diagramCode]);

  // ---- Mermaid init ----
  useEffect(() => {
    localStorage.setItem('mermaid-dark-mode', darkMode.toString());
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: darkMode ? 'dark' : (mermaidConfig.theme as any),
        securityLevel: mermaidConfig.securityLevel as any,
        fontFamily: mermaidConfig.fontFamily,
        themeVariables: { primaryColor: '#6366f1', lineColor: darkMode ? '#9ca3af' : '#4b5563' },
      });
      setIsMermaidReady(true);
      renderDiagram();
    } catch (err) {
      console.error('Mermaid init error:', err);
      setError('Failed to initialize Mermaid');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode, mermaidConfig]);

  // ---- Render on code change ----
  useEffect(() => {
    if (!isMermaidReady) return;
    try { localStorage.setItem(STORAGE_KEY, diagramCode); } catch (e) {}
    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    if (diagramCode.trim()) {
      setRenderState('rendering');
      renderTimeoutRef.current = setTimeout(() => renderDiagram(), 400);
    } else {
      if (diagramRef.current) diagramRef.current.innerHTML = '';
      setRenderState('idle');
    }
    return () => { if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramCode, isMermaidReady]);

  const renderDiagram = async () => {
    if (!diagramRef.current || !diagramCode.trim()) {
      if (diagramRef.current) diagramRef.current.innerHTML = '';
      setRenderState('idle');
      return;
    }
    try {
      setError('');
      const id = `mermaid-render-${Math.random().toString(36).substring(2, 9)}`;
      const { svg } = await mermaid.render(id, diagramCode);
      if (diagramRef.current) {
        diagramRef.current.innerHTML = svg;
        const svgElement = diagramRef.current.querySelector('svg');
        if (svgElement) {
          svgElement.removeAttribute('width');
          svgElement.removeAttribute('height');
          svgElement.style.width = '100%';
          svgElement.style.height = 'auto';
          svgElement.style.maxWidth = '100%';
          svgElement.style.display = 'block';
        }
      }
      setRenderState('ready');
    } catch (err) {
      console.error('Render error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
      setRenderState('error');
    }
  };

  const getSvgElement = (): SVGSVGElement | null => diagramRef.current?.querySelector('svg') || null;

  const showNotification = (message: string) => {
    setNotification(message);
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => setNotification(''), 3000);
  };

  // ---- Export helpers ----
  const getBase64Svg = (svg?: SVGSVGElement, width?: number, height?: number): string => {
    const isDark = effectiveExportDark;
    let el = svg ? (svg.cloneNode(true) as SVGSVGElement) : getSvgElement();
    if (!el) return '';
    el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    el.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const viewBox = el.viewBox?.baseVal;
    const vbW = viewBox && viewBox.width > 0 ? viewBox.width : (el.width?.baseVal.value || width || 800);
    const vbH = viewBox && viewBox.height > 0 ? viewBox.height : (el.height?.baseVal.value || height || 600);
    if (width) el.setAttribute('width', `${width}px`);
    if (height) el.setAttribute('height', `${height}px`);
    const bg = isDark ? '#0c0c0e' : '#ffffff';
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
    rect.setAttribute('width', String(vbW)); rect.setAttribute('height', String(vbH));
    rect.setAttribute('fill', bg);
    el.insertBefore(rect, el.firstChild);
    const svgString = el.outerHTML.split('<br>').join('<br/>').replace(/<img([^>]*)>/g, (_m: string, g: string) => `<img ${g} />`);
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
  };

  const computeCanvasSize = (svg: SVGSVGElement) => {
    const box = svg.getBoundingClientRect();
    const viewBox = svg.viewBox?.baseVal;
    const cw = viewBox && viewBox.width > 0 ? viewBox.width : box.width;
    const ch = viewBox && viewBox.height > 0 ? viewBox.height : box.height;
    if (imageSizeMode === 'width') { const r = ch / cw; return { w: imageSize, h: Math.round(imageSize * r) }; }
    if (imageSizeMode === 'height') { const r = cw / ch; return { w: Math.round(imageSize * r), h: imageSize }; }
    return { w: Math.round(cw * 2), h: Math.round(ch * 2) };
  };

  const drawToCanvas = (svgElement: SVGSVGElement): Promise<HTMLCanvasElement> =>
    new Promise((resolve, reject) => {
      const { w, h } = computeCanvasSize(svgElement);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));
      ctx.fillStyle = effectiveExportDark ? '#0c0c0e' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas); };
      img.onerror = () => reject(new Error('Failed to rasterize SVG'));
      img.src = getBase64Svg(svgElement, canvas.width, canvas.height);
    });

  const downloadPng = async () => {
    const svgElement = getSvgElement();
    if (!svgElement) return;
    setExporting(true);
    try {
      const canvas = await drawToCanvas(svgElement);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      a.download = getFileName('png');
      document.body.appendChild(a); a.click(); a.remove();
      showNotification('PNG downloaded');
    } catch (err) { console.error(err); showNotification('PNG export failed'); }
    finally { setExporting(false); }
  };

  const copyPng = async () => {
    const svgElement = getSvgElement();
    if (!svgElement || !('ClipboardItem' in window)) return;
    setExporting(true);
    try {
      const canvas = await drawToCanvas(svgElement);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Empty blob');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showNotification('PNG copied to clipboard');
    } catch (err) { console.error(err); showNotification('Copy failed'); }
    finally { setExporting(false); }
  };

  const downloadSvg = () => {
    const svgElement = getSvgElement();
    if (!svgElement) return;
    try {
      const isDark = effectiveExportDark;
      let el = svgElement.cloneNode(true) as SVGSVGElement;
      el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      el.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      const viewBox = el.viewBox?.baseVal;
      const vbW = viewBox && viewBox.width > 0 ? viewBox.width : (el.width?.baseVal.value || 800);
      const vbH = viewBox && viewBox.height > 0 ? viewBox.height : (el.height?.baseVal.value || 600);
      const bg = isDark ? '#0c0c0e' : '#ffffff';
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
      rect.setAttribute('width', String(vbW)); rect.setAttribute('height', String(vbH));
      rect.setAttribute('fill', bg);
      el.insertBefore(rect, el.firstChild);

      const svgString = el.outerHTML.split('<br>').join('<br/>').replace(/<img([^>]*)>/g, (_m: string, g: string) => `<img ${g} />`);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFileName('svg');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotification('SVG downloaded');
    } catch (err) {
      console.error(err);
      showNotification('SVG export failed');
    }
  };

  const copyShareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${encodeHash(diagramCode)}`;
    try {
      await navigator.clipboard.writeText(url);
      showNotification('Share link copied');
    } catch { showNotification('Copy failed'); }
  };

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); return; }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); downloadPng(); return; }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); setDarkMode((d) => !d); return; }
      if (mod && e.key === 'Enter') { e.preventDefault(); renderDiagram(); return; }
      if (e.key === 'Escape' && paletteOpen) setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, paletteOpen]);

  // ---- Resizable divider ----
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const main = (e.currentTarget as HTMLElement).closest('main');
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !main) return;
      const rect = main.getBoundingClientRect();
      const sidebar = 256;
      const x = ev.clientX - rect.left - sidebar;
      const ratio = Math.min(0.75, Math.max(0.2, x / (rect.width - sidebar)));
      setEditorFlex(ratio / (1 - ratio));
    };
    const onUp = () => { draggingRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const statusMeta: Record<RenderState, { label: string; color: string }> = {
    idle: { label: 'Empty', color: 'var(--text-muted)' },
    rendering: { label: 'Rendering', color: 'var(--warning)' },
    ready: { label: 'Ready', color: 'var(--success)' },
    error: { label: 'Error', color: 'var(--error)' },
  };

  const diagramType = detectType(diagramCode);

  // ---- Command palette items ----
  const paletteIconMap: Record<string, any> = {
    Network,
    ArrowRightLeft,
    Boxes,
    CircleDot,
    Database,
    Calendar,
    Download,
    FileCode,
    Clipboard,
    Share2,
    Sun,
    Moon,
    Layout,
    RotateCcw,
    Trash2,
    Undo2,
    Redo2,
  };

  const paletteItems = useMemo(() => {
    const tmpls = Object.entries(templates).map(([key, tpl]) => ({
      id: `tpl-${key}`,
      label: `Insert: ${tpl.name}`,
      hint: 'Template',
      icon: tpl.icon,
      action: () => updateCode(tpl.code),
    }));
    const acts = [
      { id: 'act-png', label: 'Download PNG', hint: 'Export', icon: 'Download', action: () => downloadPng() },
      { id: 'act-svg', label: 'Download SVG', hint: 'Export', icon: 'FileCode', action: () => downloadSvg() },
      { id: 'act-copy', label: 'Copy PNG to clipboard', hint: 'Export', icon: 'Clipboard', action: () => copyPng() },
      { id: 'act-share', label: 'Copy share link', hint: 'Share', icon: 'Share2', action: () => copyShareLink() },
      { id: 'act-dark', label: darkMode ? 'Switch to light mode' : 'Switch to dark mode', hint: 'View', icon: darkMode ? 'Sun' : 'Moon', action: () => setDarkMode((d) => !d) },
      { id: 'act-grid', label: gridOn ? 'Hide grid' : 'Show grid', hint: 'View', icon: 'Layout', action: () => setGridOn((v) => !v) },
      { id: 'act-reset', label: 'Reset to Flowchart template', hint: 'Edit', icon: 'RotateCcw', action: () => updateCode(templates.flowchart.code) },
      { id: 'act-clear', label: 'Clear editor', hint: 'Edit', icon: 'Trash2', action: () => updateCode('') },
      { id: 'act-undo', label: 'Undo', hint: 'Edit', icon: 'Undo2', action: () => undo() },
      { id: 'act-redo', label: 'Redo', hint: 'Edit', icon: 'Redo2', action: () => redo() },
    ];
    return [...tmpls, ...acts];
  }, [darkMode, gridOn, undo, redo]);

  const filteredPalette = paletteItems.filter((i) =>
    i.label.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden transition-colors" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <a href="#editor" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--accent)] focus:text-white">
        Skip to editor
      </a>

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b shrink-0" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: 'var(--accent-subtle)' }}>
            <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="leading-none">
            <h1 className="text-lg font-bold tracking-tight">Mermaid Studio</h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Design diagrams with code</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setPaletteOpen(true)} aria-label="Open command palette" className="btn-press hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-all duration-155">
            <Search className="w-3.5 h-3.5" /> <span>Search</span>
            <kbd className="px-1.5 py-0.5 rounded border text-[10px] border-[var(--border)] flex items-center gap-0.5 font-sans"><Command className="w-2.5 h-2.5" />K</kbd>
          </button>
          <button onClick={copyShareLink} aria-label="Copy share link" className="btn-press p-2 rounded-xl border bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-all duration-155">
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={undo} disabled={!past.length} aria-label="Undo" className="btn-press p-2 rounded-xl border disabled:opacity-40 bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-all duration-155">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={!future.length} aria-label="Redo" className="btn-press p-2 rounded-xl border disabled:opacity-40 bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-all duration-155">
            <Redo2 className="w-4 h-4" />
          </button>
          <button onClick={() => setGridOn((v) => !v)} aria-pressed={gridOn} aria-label="Toggle grid" className={`btn-press p-2 rounded-xl border bg-transparent transition-all duration-155 ${gridOn ? 'text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-subtle)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'}`}>
            <Layout className="w-4 h-4" />
          </button>
          <button onClick={() => setConfigOpen((o) => !o)} aria-label="Mermaid config" aria-expanded={configOpen} className={`btn-press p-2 rounded-xl border bg-transparent transition-all duration-155 ${configOpen ? 'text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-subtle)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'}`}>
            <Cog className="w-4 h-4" />
          </button>
          <button onClick={() => setDarkMode((d) => !d)} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} className="btn-press p-2 rounded-xl border bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-all duration-155">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Config popover */}
      {configOpen && (
        <div className="absolute top-16 right-4 z-50 w-80 p-5 rounded-2xl border shadow-2xl bg-[var(--surface)] border-[var(--border)] animate-scale-up" role="dialog" aria-label="Mermaid configuration">
          <div className="flex items-center justify-between mb-4 border-b pb-2 border-[var(--border)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">Configuration</span>
            <button onClick={() => setConfigOpen(false)} aria-label="Close" className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-all"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Theme</label>
              <select value={mermaidConfig.theme} onChange={(e) => setMermaidConfig((c) => ({ ...c, theme: e.target.value }))} className="w-full px-3 py-2 rounded-xl border text-xs focus:ring-2 focus:ring-[var(--accent-ring)] focus:outline-none transition-all duration-150 border-[var(--border)] bg-[var(--bg)] text-[var(--text)]">
                <option value="default">Default</option>
                <option value="neutral">Neutral</option>
                <option value="forest">Forest</option>
                <option value="dark">Dark</option>
                <option value="base">Base</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Font family</label>
              <input value={mermaidConfig.fontFamily} onChange={(e) => setMermaidConfig((c) => ({ ...c, fontFamily: e.target.value }))} className="w-full px-3 py-2 rounded-xl border text-xs focus:ring-2 focus:ring-[var(--accent-ring)] focus:outline-none transition-all duration-150 border-[var(--border)] bg-[var(--bg)] text-[var(--text)]" placeholder="e.g. Inter, sans-serif" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Security level</label>
              <select value={mermaidConfig.securityLevel} onChange={(e) => setMermaidConfig((c) => ({ ...c, securityLevel: e.target.value }))} className="w-full px-3 py-2 rounded-xl border text-xs focus:ring-2 focus:ring-[var(--accent-ring)] focus:outline-none transition-all duration-150 border-[var(--border)] bg-[var(--bg)] text-[var(--text)]">
                <option value="loose">Loose (recommended)</option>
                <option value="strict">Strict</option>
                <option value="antiscript">Anti-script</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r overflow-y-auto hidden md:flex flex-col shrink-0 transition-colors" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <Layout className="w-3.5 h-3.5" /> Diagrams
            </div>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {Object.entries(templates).map(([key, template]) => {
              const active = diagramCode === template.code;
              const Icon = templateIcons[template.icon] || FileCode;
              return (
                <button key={key} onClick={() => updateCode(template.code)} aria-current={active ? 'true' : undefined} className="sidebar-btn btn-press group">
                  <div className="p-1.5 rounded-lg border transition-all duration-150 shrink-0" style={active ? { background: 'var(--surface)', borderColor: 'transparent', color: 'var(--accent)' } : { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="font-semibold text-xs text-[var(--text)] truncate">{template.name}</div>
                    <div className="text-[10px] mt-0.5 text-[var(--text-muted)] truncate">{template.desc}</div>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${active ? 'translate-x-1 opacity-100 text-[var(--accent)]' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 text-[var(--text-muted)]'}`} />
                </button>
              );
            })}
          </div>
        </aside>

        {/* Editor Area */}
        <section id="editor" className="flex flex-col min-w-0 border-r" style={{ flexGrow: editorFlex }}>
          <div className="h-12 flex items-center justify-between px-4 border-b shrink-0 bg-[var(--surface-2)] border-[var(--border)]">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Editor · {diagramType}</span>
            <div className="flex gap-1.5">
              <button onClick={() => { if (confirm('Reset to template?')) updateCode(templates.flowchart.code); }} aria-label="Reset to template" className="btn-press p-1.5 rounded-lg border bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all duration-155"><RotateCcw className="w-4 h-4" /></button>
              <button onClick={() => { if (confirm('Clear the editor?')) updateCode(''); }} aria-label="Clear editor" className="btn-press p-1.5 rounded-lg border bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--error)] hover:border-[var(--error)] transition-all duration-155"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodeMirror
              value={diagramCode}
              onChange={updateCode}
              extensions={[mermaidLanguage, syntaxHighlighting(highlightStyle), EditorView.lineWrapping]}
              theme={mermaidTheme(darkMode)}
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, autocompletion: false }}
              aria-label="Mermaid diagram source code"
              style={{ height: '100%', fontSize: 13 }}
            />
          </div>
        </section>

        {/* Resize handle */}
        <div onMouseDown={startDrag} role="separator" aria-orientation="vertical" aria-label="Resize editor and preview" className="w-1.5 cursor-col-resize shrink-0 transition-colors hover:bg-[var(--accent)]" style={{ background: 'var(--border)' }} />

        {/* Preview Area */}
        <section className="flex-[1.5] flex flex-col min-w-0 transition-colors" style={{ background: 'var(--surface-2)' }}>
          <div className="h-12 flex items-center justify-between px-4 border-b shrink-0 gap-3 flex-wrap bg-[var(--surface)] border-[var(--border)]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Preview</span>
              <span className="info-badge" style={{ background: 'var(--surface-2)', color: statusMeta[renderState].color }}>
                <Circle className={`w-2 h-2 ${renderState === 'rendering' ? 'status-dot-pulse' : ''}`} style={{ fill: statusMeta[renderState].color, color: statusMeta[renderState].color }} />
                {statusMeta[renderState].label}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Export theme toggle */}
              <div className="segmented-control shrink-0">
                {(['current', 'light', 'dark'] as ExportTheme[]).map((mode) => (
                  <button key={mode} onClick={() => setExportTheme(mode)} aria-pressed={exportTheme === mode} className="segmented-control-btn btn-press">{mode === 'current' ? 'UI theme' : mode}</button>
                ))}
              </div>
              
              {/* Size mode selector */}
              <div className="segmented-control shrink-0">
                {(['auto', 'width', 'height'] as ImageSizeMode[]).map((mode) => (
                  <button key={mode} onClick={() => setImageSizeMode(mode)} aria-pressed={imageSizeMode === mode} className="segmented-control-btn btn-press">{mode}</button>
                ))}
              </div>
              
              {imageSizeMode !== 'auto' && (
                <div className="flex items-center gap-1.5 bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl shrink-0">
                  <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Size</span>
                  <input type="number" min={3} max={10000} value={imageSize} onChange={(e) => setImageSize(Number(e.target.value) || 1080)} aria-label="Export image size in pixels" className="w-14 bg-transparent text-[11px] font-bold focus:outline-none text-[var(--text)] text-center animate-slide-in" />
                  <span className="text-[9px] text-[var(--text-muted)] font-semibold">px</span>
                </div>
              )}

              {/* Unified Export Group */}
              <div className="flex items-center gap-1 border border-[var(--border)] rounded-xl p-0.5 bg-[var(--surface)] shrink-0">
                <button onClick={downloadPng} disabled={!diagramCode.trim() || exporting} className="btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[var(--surface-2)] text-[var(--text)] transition-colors disabled:opacity-40">
                  {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PNG
                </button>
                <button onClick={downloadSvg} disabled={!diagramCode.trim()} className="btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[var(--surface-2)] text-[var(--text)] transition-colors disabled:opacity-40">
                  <FileCode className="w-3.5 h-3.5" /> SVG
                </button>
                <div className="w-[1px] h-4 bg-[var(--border)] mx-0.5" />
                <button onClick={copyPng} disabled={!diagramCode.trim() || exporting || !('ClipboardItem' in window)} aria-label="Copy PNG to clipboard" title="Copy PNG" className="btn-press p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-40">
                  <Clipboard className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className={`flex-1 relative overflow-hidden flex items-center justify-center p-8 ${gridOn ? 'grid-bg' : ''}`}>
            {error && (
              <div className="absolute top-4 inset-x-4 z-50 p-4 rounded-2xl flex items-start gap-3 border shadow-xl bg-[var(--surface)] border-[var(--error)] animate-slide-in" role="alert">
                <div className="p-1 rounded-lg bg-[var(--error-subtle)] text-[var(--error)] animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                </div>
                <div className="flex-1 text-xs font-semibold leading-relaxed text-[var(--text)] break-words pt-0.5">{error}</div>
              </div>
            )}

            {renderState === 'idle' && !error && (
              <div className="flex flex-col items-center gap-4 text-center max-w-xs animate-slide-in" style={{ color: 'var(--text-muted)' }}>
                <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-md text-[var(--text-muted)]"><FileCode className="w-8 h-8" /></div>
                <div>
                  <p className="text-sm font-bold text-[var(--text)]">No diagram yet</p>
                  <p className="text-xs leading-relaxed mt-1.5 text-[var(--text-muted)]">Start typing Mermaid syntax or pick a template to see your diagram render here.</p>
                </div>
              </div>
            )}

            {renderState === 'rendering' && (
              <div className="flex items-center gap-2 text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 rounded-2xl shadow-md animate-slide-in">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                <span className="text-xs font-bold">Rendering…</span>
              </div>
            )}

            <TransformWrapper initialScale={1} centerOnInit minScale={0.2} maxScale={5} ref={transformRef}>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 rounded-2xl border shadow-xl bg-[var(--surface)] border-[var(--border)]">
                    {[
                      { icon: ZoomIn, label: 'Zoom in', fn: zoomIn },
                      { icon: ZoomOut, label: 'Zoom out', fn: zoomOut },
                      { icon: Scan, label: 'Fit to screen', fn: resetTransform },
                      { icon: Maximize, label: 'Actual size', fn: () => resetTransform() },
                    ].map(({ icon: Icon, label, fn }) => (
                      <button key={label} onClick={() => fn()} aria-label={label} className="btn-press p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors">
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                    <div className="p-12 min-w-full min-h-full flex items-center justify-center">
                      <div ref={diagramRef} className="canvas-sheet p-8 md:p-12 flex items-center justify-center cursor-move transition-all duration-300" />
                    </div>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </section>
      </main>

      {/* Footer hint */}
      <footer className="h-9 hidden sm:flex items-center justify-between px-6 border-t text-xs shrink-0 bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] font-medium">
        <span className="flex items-center gap-1">
          Edits autosave locally · 
          <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[10px] flex items-center gap-0.5 font-sans"><Command className="w-2.5 h-2.5" />Z</kbd> undo · 
          <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[10px] flex items-center gap-0.5 font-sans"><Command className="w-2.5 h-2.5" />K</kbd> palette
        </span>
        <span>PNG {exportTheme === 'current' ? 'as UI' : exportTheme} · {imageSizeMode === 'auto' ? '2×' : `${imageSize}px ${imageSizeMode}`}</span>
      </footer>

      {/* Command palette */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true" aria-label="Command palette">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[4px] animate-fade-in" onClick={() => setPaletteOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden bg-[var(--surface)] border-[var(--border)] animate-scale-up">
            <div className="flex items-center gap-2 px-4 border-b border-[var(--border)]">
              <Search className="w-4 h-4 text-[var(--text-muted)]" />
              <input autoFocus value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} placeholder="Type a command or template…" className="flex-1 py-3 bg-transparent outline-none text-xs font-medium text-[var(--text)]" />
              <kbd className="px-1.5 py-0.5 rounded border text-[10px] border-[var(--border)] text-[var(--text-muted)]">Esc</kbd>
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {filteredPalette.map((item) => {
                const IconComponent = paletteIconMap[item.icon] || Sparkles;
                return (
                  <li key={item.id}>
                    <button onClick={() => { item.action(); setPaletteOpen(false); setPaletteQuery(''); }} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-left transition-colors hover:bg-[var(--surface-2)] text-[var(--text)] group">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent-subtle)] transition-colors">
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold">{item.label}</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]">{item.hint}</span>
                    </button>
                  </li>
                );
              })}
              {filteredPalette.length === 0 && <li className="px-3 py-6 text-center text-xs font-semibold text-[var(--text-muted)]">No results found</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-in">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border bg-[var(--surface)] border-[var(--border)] text-[var(--text)]" role="status" aria-live="polite">
            <div className="p-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
              <Check className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold">{notification}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
