import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { Download, Copy, Moon, Sun, FileCode } from 'lucide-react';

const defaultDiagram = `graph TD
    A[Start] --> B{Is it complex?}
    B -->|Yes| C[Add more nodes]
    B -->|No| D[Keep it simple]
    C --> E[Review diagram]
    D --> E
    E --> F[Export as SVG]
    F --> G[Done!]`;

function App() {
  const [diagramCode, setDiagramCode] = useState(defaultDiagram);
  const [darkMode, setDarkMode] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const diagramRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: darkMode ? 'dark' : 'default',
      securityLevel: 'loose',
    });
  }, [darkMode]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = setTimeout(() => {
      renderDiagram();
    }, 500);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [diagramCode, darkMode]);

  useEffect(() => {
    renderDiagram();
  }, []);

  const renderDiagram = async () => {
    if (!diagramRef.current) return;

    try {
      setError('');
      diagramRef.current.innerHTML = '';

      const id = `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, diagramCode);
      diagramRef.current.innerHTML = svg;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
      diagramRef.current.innerHTML = '';
    }
  };

  const getSvgContent = (): string | null => {
    if (!diagramRef.current) return null;
    const svgElement = diagramRef.current.querySelector('svg');
    if (!svgElement) return null;

    return new XMLSerializer().serializeToString(svgElement);
  };

  const downloadSvg = () => {
    const svgContent = getSvgContent();
    if (!svgContent) {
      showNotification('No diagram to download', true);
      return;
    }

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

  const copySvgToClipboard = async () => {
    const svgContent = getSvgContent();
    if (!svgContent) {
      showNotification('No diagram to copy', true);
      return;
    }

    try {
      await navigator.clipboard.writeText(svgContent);
      showNotification('SVG code copied to clipboard');
    } catch (err) {
      showNotification('Failed to copy to clipboard', true);
    }
  };

  const showNotification = (message: string, isError = false) => {
    setNotification(message);
    if (isError) {
      setError(message);
    }
    setTimeout(() => {
      setNotification('');
      if (isError) {
        setError('');
      }
    }, 3000);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      darkMode ? 'dark bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <header className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <FileCode className={`w-8 h-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <h1 className={`text-3xl font-bold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Mermaid Diagram Studio
              </h1>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode
                  ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
              }`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Create complex diagrams and export them as SVG
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-semibold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Diagram Code
              </h2>
            </div>

            <textarea
              value={diagramCode}
              onChange={(e) => setDiagramCode(e.target.value)}
              className={`w-full h-[calc(100vh-280px)] min-h-[400px] p-4 rounded-lg font-mono text-sm transition-colors ${
                darkMode
                  ? 'bg-gray-800 text-gray-100 border-gray-700'
                  : 'bg-white text-gray-900 border-gray-300'
              } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Enter your Mermaid diagram code here..."
              spellCheck={false}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-semibold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Preview
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={copySvgToClipboard}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    darkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                  title="Copy SVG to clipboard"
                >
                  <Copy className="w-4 h-4" />
                  Copy SVG
                </button>
                <button
                  onClick={downloadSvg}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    darkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                  title="Download as SVG"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>

            <div
              className={`w-full h-[calc(100vh-280px)] min-h-[400px] rounded-lg border overflow-auto transition-colors ${
                darkMode
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-300'
              } flex items-center justify-center p-4`}
            >
              {error ? (
                <div className="text-red-500 p-4 text-center max-w-md">
                  <p className="font-semibold mb-2">Error rendering diagram:</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : (
                <div ref={diagramRef} className="flex items-center justify-center w-full" />
              )}
            </div>
          </div>
        </div>

        {notification && (
          <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg transition-all ${
            error
              ? 'bg-red-500 text-white'
              : darkMode
              ? 'bg-green-600 text-white'
              : 'bg-green-500 text-white'
          }`}>
            {notification}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
