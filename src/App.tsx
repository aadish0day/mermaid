import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { 
  Download, 
  Copy, 
  Moon, 
  Sun, 
  FileCode, 
  Trash2, 
  RotateCcw, 
  Image as ImageIcon, 
  Layout, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

const templates = {
  flowchart: {
    name: 'Flowchart',
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
    name: 'Sequence',
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
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses`
  },
  gantt: {
    name: 'Gantt Chart',
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

const STORAGE_KEY = 'mermaid-editor-code';

function App() {
  const [diagramCode, setDiagramCode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved || templates.flowchart.code;
    } catch (e) {
      return templates.flowchart.code;
    }
  });
  
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('mermaid-dark-mode');
    return saved === 'true';
  });

  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [isMermaidReady, setIsMermaidReady] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<any>();

  useEffect(() => {
    localStorage.setItem('mermaid-dark-mode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: darkMode ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'Inter, system-ui, sans-serif',
        themeVariables: {
          primaryColor: '#3b82f6',
          lineColor: darkMode ? '#9ca3af' : '#4b5563',
        }
      });
      setIsMermaidReady(true);
      renderDiagram();
    } catch (err) {
      console.error('Mermaid init error:', err);
      setError('Failed to initialize Mermaid');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!isMermaidReady) return;

    try {
      localStorage.setItem(STORAGE_KEY, diagramCode);
    } catch (e) {}
    
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = setTimeout(() => {
      renderDiagram();
    }, 400);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [diagramCode, isMermaidReady]);

  const renderDiagram = async () => {
    if (!diagramRef.current || !diagramCode.trim()) {
      if (diagramRef.current) diagramRef.current.innerHTML = '';
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
          svgElement.style.maxWidth = '100%';
          svgElement.style.height = 'auto';
          svgElement.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Render error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
    }
  };

  const getSvgElement = (): SVGSVGElement | null => {
    return diagramRef.current?.querySelector('svg') || null;
  };

  const downloadSvg = () => {
    const svgElement = getSvgElement();
    if (!svgElement) return;
    const svgContent = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mermaid-diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('SVG downloaded successfully');
  };

  const downloadPng = () => {
    const svgElement = getSvgElement();
    if (!svgElement) return;

    const canvas = document.createElement('canvas');
    const svgRect = svgElement.getBoundingClientRect();
    const scale = 2;
    canvas.width = svgRect.width * scale;
    canvas.height = svgRect.height * scale;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = darkMode ? '#030712' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `mermaid-diagram-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('PNG downloaded successfully');
    };
    img.src = url;
  };

  const copySvg = async () => {
    const svgElement = getSvgElement();
    if (!svgElement) return;
    try {
      const svgContent = new XMLSerializer().serializeToString(svgElement);
      await navigator.clipboard.writeText(svgContent);
      showNotification('SVG copied to clipboard');
    } catch (err) {}
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`h-16 flex items-center justify-between px-6 border-b shrink-0 transition-colors ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Mermaid Studio</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            className={`p-2 rounded-xl transition-all ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border border-gray-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`w-64 border-r overflow-y-auto hidden md:flex flex-col shrink-0 transition-colors ${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
              <Layout className="w-4 h-4" />
              Templates
            </div>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {Object.entries(templates).map(([key, template]) => (
              <button
                key={key}
                onClick={() => setDiagramCode(template.code)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                  diagramCode === template.code 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : darkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-100' : 'hover:bg-gray-100 text-gray-600 hover:text-blue-600'
                }`}
              >
                {template.name}
                <ChevronRight className={`w-4 h-4 transition-transform ${diagramCode === template.code ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}`} />
              </button>
            ))}
          </div>
        </aside>

        {/* Editor Area */}
        <section className="flex-1 flex flex-col min-w-0 border-r border-gray-800/0 md:border-r-0">
          <div className={`h-12 flex items-center justify-between px-4 border-b transition-colors shrink-0 ${darkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Editor</span>
            <div className="flex gap-1">
              <button onClick={() => { if(confirm('Reset?')) setDiagramCode(templates.flowchart.code); }} className="p-1.5 hover:text-blue-500 transition-colors"><RotateCcw className="w-4 h-4" /></button>
              <button onClick={() => { if(confirm('Clear?')) setDiagramCode(''); }} className="p-1.5 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <textarea
            value={diagramCode}
            onChange={(e) => setDiagramCode(e.target.value)}
            spellCheck={false}
            className={`flex-1 p-6 font-mono text-[13px] leading-relaxed resize-none focus:outline-none transition-colors ${darkMode ? 'bg-gray-950 text-blue-100 placeholder-gray-800' : 'bg-white text-gray-800 placeholder-gray-300'}`}
            placeholder="Type your Mermaid diagram here..."
          />
        </section>

        {/* Preview Area */}
        <section className={`flex-[1.5] flex flex-col min-w-0 transition-colors ${darkMode ? 'bg-gray-900/30' : 'bg-gray-100/30'}`}>
          <div className={`h-12 flex items-center justify-between px-4 border-b border-l transition-colors shrink-0 ${darkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Preview</span>
            <div className="flex gap-2">
              <button onClick={copySvg} className={`p-1.5 rounded-lg border transition-all ${darkMode ? 'hover:bg-gray-800 border-gray-700' : 'hover:bg-white border-gray-200 shadow-sm'}`} title="Copy SVG"><Copy className="w-4 h-4" /></button>
              <button onClick={downloadSvg} className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"><Download className="w-3.5 h-3.5" /> SVG</button>
              <button onClick={downloadPng} className="flex items-center gap-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all"><ImageIcon className="w-3.5 h-3.5" /> PNG</button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8 border-l border-gray-800/20">
            {error && (
              <div className="absolute top-4 inset-x-4 z-50 p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-start gap-3">
                  <div className="bg-red-500 p-1 rounded-full shrink-0"><Trash2 className="w-3 h-3 text-white" /></div>
                  <div className="text-sm font-medium text-red-500 break-words">{error}</div>
                </div>
              </div>
            )}

            <TransformWrapper initialScale={1} centerOnInit minScale={0.2} maxScale={5}>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2">
                    <button onClick={() => zoomIn()} className={`p-2.5 rounded-xl border shadow-xl transition-all ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600'}`}><ZoomIn className="w-5 h-5" /></button>
                    <button onClick={() => zoomOut()} className={`p-2.5 rounded-xl border shadow-xl transition-all ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600'}`}><ZoomOut className="w-5 h-5" /></button>
                    <button onClick={() => resetTransform()} className={`p-2.5 rounded-xl border shadow-xl transition-all ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600'}`}><Maximize className="w-5 h-5" /></button>
                  </div>
                  
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                    <div ref={diagramRef} className="p-12 flex items-center justify-center cursor-move" />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </section>
      </main>

      {/* Notifications */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border ${darkMode ? 'bg-gray-800 border-gray-700 text-blue-400' : 'bg-white border-blue-100 text-blue-600'}`}>
            <Sparkles className="w-4 h-4" />
            <p className="text-sm font-bold tracking-tight">{notification}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
