import { useRef, useEffect, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

/** Electron API exposed via preload.js */
interface ElectronAPI {
  createTerminal: (options?: { cols?: number; rows?: number; cwd?: string }) => Promise<number>;
  writeTerminal: (id: number, data: string) => void;
  resizeTerminal: (id: number, cols: number, rows: number) => void;
  killTerminal: (id: number) => void;
  onTerminalData: (cb: (payload: { id: number; data: string }) => void) => () => void;
  onTerminalExit: (cb: (payload: { id: number; exitCode: number }) => void) => () => void;
  platform: string;
  isDesktop: boolean;
  getProjectRoot: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const isDesktop = () => !!window.electronAPI?.isDesktop;

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termIdRef = useRef<number | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create xterm instance
    const xterm = new XTerm({
      fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: true,
      theme: {
        background: '#0c0c14',
        foreground: '#e4e4ef',
        cursor: '#e4e4ef',
        cursorAccent: '#0c0c14',
        selectionBackground: '#3a3a5e80',
        black: '#1a1a2e',
        red: '#ff4444',
        green: '#44ff44',
        yellow: '#ffff44',
        blue: '#4488ff',
        magenta: '#ff44ff',
        cyan: '#44ffff',
        white: '#e4e4ef',
        brightBlack: '#4a4a6e',
        brightRed: '#ff6666',
        brightGreen: '#66ff66',
        brightYellow: '#ffff66',
        brightBlue: '#66aaff',
        brightMagenta: '#ff66ff',
        brightCyan: '#66ffff',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitRef.current = fitAddon;

    // Fix scroll: global CSS (touch-action: none, overscroll-behavior: none)
    // blocks xterm's native viewport scroll. Handle wheel manually.
    const container = containerRef.current;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const lines = Math.round(e.deltaY / 20);
      xterm.scrollLines(lines);
    };
    container.addEventListener('wheel', onWheel, { passive: false });

    if (isDesktop()) {
      // Connect to real PTY via Electron IPC
      const api = window.electronAPI!;

      api.createTerminal({
        cols: xterm.cols,
        rows: xterm.rows,
      }).then((id) => {
        termIdRef.current = id;
        setConnected(true);

        // Send user input to PTY
        xterm.onData((data) => {
          api.writeTerminal(id, data);
        });

        // Handle resize
        xterm.onResize(({ cols, rows }) => {
          api.resizeTerminal(id, cols, rows);
        });
      });

      // Receive PTY output
      const removeDataListener = api.onTerminalData(({ id, data }) => {
        if (id === termIdRef.current) {
          xterm.write(data);
        }
      });

      const removeExitListener = api.onTerminalExit(({ id, exitCode }) => {
        if (id === termIdRef.current) {
          xterm.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`);
          setConnected(false);
        }
      });

      // Resize observer
      const ro = new ResizeObserver(() => {
        fitAddon.fit();
      });
      ro.observe(containerRef.current);

      return () => {
        container.removeEventListener('wheel', onWheel);
        removeDataListener();
        removeExitListener();
        ro.disconnect();
        if (termIdRef.current !== null) {
          api.killTerminal(termIdRef.current);
        }
        xterm.dispose();
      };
    } else {
      // Browser mode — show welcome message, no real terminal
      xterm.writeln('\x1b[1;36m  Problocks Terminal\x1b[0m');
      xterm.writeln('');
      xterm.writeln('\x1b[90m  This terminal is available in the desktop app.\x1b[0m');
      xterm.writeln('\x1b[90m  Download Problocks Studio to use Claude Code here.\x1b[0m');
      xterm.writeln('');
      xterm.writeln('\x1b[33m  $ claude --dangerously-skip-permissions\x1b[0m');
      xterm.writeln('\x1b[90m  ↑ Run this in the desktop app to start building with AI\x1b[0m');
      xterm.writeln('');

      const ro = new ResizeObserver(() => fitAddon.fit());
      ro.observe(containerRef.current);

      return () => {
        container.removeEventListener('wheel', onWheel);
        ro.disconnect();
        xterm.dispose();
      };
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 h-7 bg-zinc-900/90 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Terminal</span>
          {isDesktop() && (
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-zinc-600'}`} />
          )}
        </div>
        <div className="flex items-center gap-1">
          {isDesktop() && connected && (
            <button
              onClick={() => {
                const api = window.electronAPI;
                if (api && termIdRef.current !== null) {
                  const cmd = 'claude --dangerously-skip-permissions\n';
                  api.writeTerminal(termIdRef.current, cmd);
                }
              }}
              className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 hover:text-purple-300 px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
            >
              Launch Claude
            </button>
          )}
        </div>
      </div>
      {/* Terminal content */}
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
