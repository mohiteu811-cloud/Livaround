'use client';

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Download } from 'lucide-react';

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  subtitle?: string;
  instructions?: string;
}

export function QRCodeModal({ open, onClose, url, title, subtitle, instructions }: QRCodeModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: white; }
          .card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; text-align: center; max-width: 320px; }
          .card h2 { margin: 16px 0 4px; font-size: 18px; color: #1e293b; }
          .card p { margin: 0 0 8px; font-size: 13px; color: #64748b; }
          .card .instructions { font-size: 11px; color: #94a3b8; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          svg { display: block; margin: 0 auto; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.onload = () => { win.print(); };
  }

  function handleDownload() {
    const svg = printRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    canvas.width = 400;
    canvas.height = 400;
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 0, 0, 400, 400);
        const link = document.createElement('a');
        link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-100">QR Code</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* QR Preview */}
        <div className="p-6 flex flex-col items-center gap-4">
          <div ref={printRef} className="card bg-white rounded-2xl p-6 text-center">
            <QRCodeSVG
              value={url}
              size={200}
              level="H"
              includeMargin={false}
              style={{ borderRadius: 8 }}
            />
            <h2 style={{ margin: '16px 0 4px', fontSize: 16, color: '#1e293b', fontFamily: 'system-ui' }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748b', fontFamily: 'system-ui' }}>
                {subtitle}
              </p>
            )}
            {instructions && (
              <p className="instructions" style={{ fontSize: 10, color: '#94a3b8', marginTop: 10, borderTop: '1px solid #e2e8f0', paddingTop: 10, fontFamily: 'system-ui' }}>
                {instructions}
              </p>
            )}
          </div>

          <p className="text-xs text-slate-600 text-center max-w-xs break-all">{url}</p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Printer size={15} /> Print
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-semibold transition-colors"
          >
            <Download size={15} /> Save PNG
          </button>
        </div>
      </div>
    </div>
  );
}
