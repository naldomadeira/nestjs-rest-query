'use client';

import { Maximize2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

type MermaidProps = {
  chart: string;
};

const Mermaid = ({ chart }: MermaidProps) => {
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let active = true;

    const render = async () => {
      try {
        const { default: mermaid } = await import('mermaid');

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: document.documentElement.classList.contains('dark')
            ? 'dark'
            : 'default',
        });

        const result = await mermaid.render(`dqb-mermaid-${id}`, chart);

        if (!active) {
          return;
        }

        setSvg(result.svg);
        setError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : 'Failed to render Mermaid chart.';
        setError(message);
      }
    };

    render();

    return () => {
      active = false;
    };
  }, [chart, id]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  if (error) {
    return (
      <pre className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 overflow-auto">
        {error}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-lg border bg-fd-card p-4 text-sm text-fd-muted-foreground">
        Rendering Mermaid diagram...
      </div>
    );
  }

  // Mermaid injects inline `style="max-width: Xpx;"` on the SVG element.
  // That inline style takes precedence over Tailwind classes, keeping the SVG
  // at its original small size even inside the fullscreen container.
  // Strip that constraint so the SVG can scale to fill available space.
  const fullscreenSvg = svg.replace(/max-width:\s*[\d.]+px;?\s*/g, '');

  return (
    <>
      <div className="relative my-6 overflow-auto rounded-lg border bg-fd-card p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full">
        <button
          onClick={() => setFullscreen(true)}
          aria-label="Expandir diagrama"
          title="Expandir"
          className="absolute top-2 right-2 rounded-md border bg-fd-background px-2 py-1.5 text-fd-muted-foreground hover:text-fd-foreground transition-colors"
        >
          <Maximize2 size={14} />
        </button>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>

      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-8"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="relative flex w-[90vw] max-h-[88vh] flex-col rounded-xl border bg-fd-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-end border-b px-4 py-2 shrink-0">
              <button
                onClick={() => setFullscreen(false)}
                aria-label="Fechar"
                title="Fechar (ESC)"
                className="rounded-md border bg-fd-background p-1.5 text-fd-muted-foreground hover:text-fd-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* SVG area — scrollable, fills remaining height */}
            <div
              className="overflow-auto p-8 [&_svg]:!w-full [&_svg]:!max-w-none [&_svg]:!h-auto [&_svg]:mx-auto"
              dangerouslySetInnerHTML={{ __html: fullscreenSvg }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Mermaid;
