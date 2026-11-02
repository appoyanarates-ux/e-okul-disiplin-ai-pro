import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  FileText, 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Check, 
  Loader2,
  FileCheck
} from 'lucide-react';
import { DocumentDefinition } from '../services/documentEngine';
import { generateDocxBlob, generateDocxBuffer } from '../services/docxGenerator';

interface DocumentViewerModalProps {
  document: DocumentDefinition;
  isOpen: boolean;
  onClose: () => void;
}



export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document: docDef,
  isOpen,
  onClose
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(docDef.orientation || 'portrait');
  const [marginSize, setMarginSize] = useState<'normal' | 'narrow' | 'wide'>('normal');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLandscape = orientation === 'landscape';

  const marginPaddingClass = 
    marginSize === 'narrow' ? 'p-6' : 
    marginSize === 'wide' ? 'p-14' : 'p-10';

  const handlePrint = async () => {
    if (window.electronAPI) {
      try {
        await window.electronAPI.printDirect({
          landscape: isLandscape,
          pageSize: 'A4'
        });
      } catch (err) {
        console.warn('Electron print fallback to window.print', err);
        window.print();
      }
    } else {
      window.print();
    }
  };

  const handleSavePdf = async () => {
    setIsExportingPdf(true);
    setStatusMessage('PDF oluşturuluyor...');
    try {
      if (window.electronAPI) {
        // Use Chromium webContents.printToPDF via IPC
        const result = await window.electronAPI.printToPdf({
          landscape: isLandscape,
          pageSize: 'A4',
          saveDialog: true,
          defaultPath: `${docDef.title.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]/g, '_')}.pdf`,
          title: 'PDF Olarak Kaydet'
        });

        if (result.success && result.filePath) {
          setStatusMessage(`PDF başarıyla kaydedildi: ${result.filePath}`);
          setTimeout(() => setStatusMessage(null), 4000);
        } else if (result.canceled) {
          setStatusMessage(null);
        } else if (result.error) {
          alert('PDF kaydedilirken hata oluştu: ' + result.error);
        }
      } else {
        // Web fallback: trigger browser print dialog to save as PDF
        window.print();
        setStatusMessage(null);
      }
    } catch (err: any) {
      alert('PDF oluşturulamadı: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadDocx = async () => {
    setIsExportingDocx(true);
    setStatusMessage('Word (.docx) belgesi hazırlanıyor...');
    try {
      const activeDocDef = { ...docDef, orientation };
      const filename = `${docDef.title.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]/g, '_')}.docx`;

      if (window.electronAPI) {
        // In Electron, generate buffer and let user pick path with native dialog
        const buffer = await generateDocxBuffer(activeDocDef);
        const result = await window.electronAPI.saveFile({
          defaultPath: filename,
          filters: [{ name: 'Microsoft Word Belgesi (*.docx)', extensions: ['docx'] }],
          data: buffer
        });

        if (result.success && result.filePath) {
          setStatusMessage(`Word belgesi kaydedildi: ${result.filePath}`);
          setTimeout(() => setStatusMessage(null), 4000);
        } else if (!result.canceled && result.error) {
          alert('Dosya kaydedilemedi: ' + result.error);
        }
      } else {
        // In browser, create blob and trigger download
        const blob = await generateDocxBlob(activeDocDef);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatusMessage('Word belgesi indirildi.');
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err: any) {
      alert('Word belgesi oluşturulamadı: ' + err.message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-between overflow-hidden animate-fade-in">
      {/* Top Action Bar (Hidden during print) */}
      <div className="w-full bg-slate-900 border-b border-slate-800 text-white px-6 py-3 flex items-center justify-between shrink-0 shadow-xl print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-md shadow-blue-900/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              {docDef.title}
              <span className="text-[10px] bg-slate-800 text-blue-400 px-2 py-0.5 rounded border border-slate-700">
                A4 {isLandscape ? 'Yatay' : 'Dikey'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {docDef.institutionName.split('\n')[0]} • By Abdullah Yanarateş
            </p>
          </div>
        </div>

        {/* Toolbar Center Controls */}
        <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded hover:bg-slate-700 text-slate-200 transition-colors"
            title="Sayfa Yönü (Dikey / Yatay)"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-400" />
            <span>{isLandscape ? 'Yatay' : 'Dikey'}</span>
          </button>

          <div className="h-4 w-px bg-slate-700" />

          {/* Margins */}
          <select
            value={marginSize}
            onChange={(e) => setMarginSize(e.target.value as any)}
            className="bg-transparent text-xs text-slate-300 font-medium px-2 py-1 focus:outline-none cursor-pointer"
            title="Kenar Boşluğu"
          >
            <option value="normal" className="bg-slate-900">Normal Kenar (20mm)</option>
            <option value="narrow" className="bg-slate-900">Dar Kenar (12mm)</option>
            <option value="wide" className="bg-slate-900">Geniş Kenar (25mm)</option>
          </select>

          <div className="h-4 w-px bg-slate-700" />

          {/* Zoom Controls */}
          <button
            onClick={() => setZoom(prev => Math.max(60, prev - 10))}
            className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-700"
            title="Küçült"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-400 px-1">{zoom}%</span>
          <button
            onClick={() => setZoom(prev => Math.min(150, prev + 10))}
            className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-700"
            title="Büyüt"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5">
          {statusMessage && (
            <span className="text-xs text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {statusMessage}
            </span>
          )}

          <button
            onClick={handleDownloadDocx}
            disabled={isExportingDocx}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
            title="Gerçek Microsoft Word .docx dosyası indir"
          >
            {isExportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
            <span>Word (.docx) İndir</span>
          </button>

          <button
            onClick={handleSavePdf}
            disabled={isExportingPdf}
            className="flex items-center gap-2 px-3.5 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
            title="Chromium kalitesinde PDF olarak kaydet"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>PDF Kaydet</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
            title="Yazıcıdan Doğrudan Yazdır"
          >
            <Printer className="w-4 h-4" />
            <span>Yazdır</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Document Paper Container (Scrollable) */}
      <div className="flex-1 w-full overflow-y-auto p-8 flex justify-center bg-slate-950/40 custom-scrollbar">
        <div 
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          className="transition-transform duration-150"
        >
          {/* Authentic Printable A4 Paper */}
          <div 
            id="printable-document-root"
            className={`bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300 relative transition-all duration-200 ${marginPaddingClass} ${
              isLandscape 
                ? 'w-[297mm] min-h-[210mm]' 
                : 'w-[210mm] min-h-[297mm]'
            }`}
            style={{
              fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
              color: '#000000'
            }}
          >
            {/* Institution Header */}
            <div className="text-center mb-5 pb-2">
              <div className="font-bold text-sm tracking-wide leading-tight whitespace-pre-line text-slate-900 uppercase">
                {docDef.institutionName}
              </div>
              {docDef.academicYear && (
                <div className="text-xs text-slate-600 italic mt-0.5">
                  {docDef.academicYear}
                </div>
              )}
            </div>

            {/* Document Title & Subtitle */}
            <div className="text-center mb-6">
              <h1 className="font-bold text-base tracking-wide uppercase text-slate-900">
                {docDef.title}
              </h1>
              {docDef.subtitle && (
                <p className="text-xs text-slate-600 italic mt-0.5">
                  {docDef.subtitle}
                </p>
              )}
            </div>

            {/* Document Code and Date Header Bar */}
            {(docDef.code || docDef.date) && (
              <div className="flex justify-between items-center border-b-2 border-slate-900 pb-1.5 mb-5 text-xs font-semibold text-slate-800">
                <span>{docDef.code ? `Sayı / Kod: ${docDef.code}` : ''}</span>
                <span>{docDef.date ? `Tarih: ${docDef.date}` : ''}</span>
              </div>
            )}

            {/* Document Content Sections */}
            <div className="space-y-4 text-xs leading-relaxed">
              {docDef.sections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  {section.title && (
                    <h2 className="font-bold text-xs uppercase tracking-wider text-blue-950 border-b border-slate-300 pb-1">
                      {section.title}
                    </h2>
                  )}

                  {section.type === 'paragraph' && section.text && (
                    <div 
                      className={`text-justify whitespace-pre-line text-slate-900 leading-normal ${section.bold ? 'font-bold' : ''}`}
                      style={{ textAlign: section.align || 'justify' }}
                    >
                      {section.text}
                    </div>
                  )}

                  {section.type === 'keyValueGrid' && section.items && (
                    <div className="border border-slate-300 rounded overflow-hidden">
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          {Array.from({ length: Math.ceil(section.items.length / 2) }).map((_, rIdx) => {
                            const item1 = section.items![rIdx * 2];
                            const item2 = section.items![rIdx * 2 + 1];
                            return (
                              <tr key={rIdx} className="border-b border-slate-200 last:border-b-0">
                                <td className="w-1/4 bg-slate-50 font-bold p-2 text-slate-700 border-r border-slate-200">
                                  {item1.label}
                                </td>
                                <td className="w-1/4 p-2 text-slate-900 border-r border-slate-200">
                                  {item1.value || '-'}
                                </td>
                                <td className="w-1/4 bg-slate-50 font-bold p-2 text-slate-700 border-r border-slate-200">
                                  {item2 ? item2.label : ''}
                                </td>
                                <td className="w-1/4 p-2 text-slate-900">
                                  {item2 ? (item2.value || '-') : ''}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {section.type === 'table' && section.headers && section.rows && (
                    <div className="border border-slate-300 rounded overflow-hidden my-3">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-200 border-b border-slate-300 font-bold text-slate-900">
                            {section.headers.map((h, hIdx) => (
                              <th 
                                key={hIdx} 
                                className="p-1.5 text-left border-r border-slate-300 last:border-r-0"
                                style={{ width: section.colWidths?.[hIdx] ? `${section.colWidths[hIdx]}%` : 'auto' }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.map((row, rIdx) => (
                            <tr key={rIdx} className={`border-b border-slate-200 last:border-b-0 ${rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-1.5 border-r border-slate-200 last:border-r-0 align-top">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {section.type === 'bulletList' && section.bullets && (
                    <ul className="list-disc pl-5 space-y-1 text-slate-800">
                      {section.bullets.map((b, bIdx) => (
                        <li key={bIdx}>{b}</li>
                      ))}
                    </ul>
                  )}

                  {section.type === 'notice' && section.text && (
                    <div className="p-3 bg-blue-50 border-l-4 border-blue-700 text-blue-950 text-xs italic rounded-r">
                      {section.text}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Signature Area */}
            {docDef.signatures && docDef.signatures.length > 0 && (
              <div className="mt-12 pt-6 signature-block avoid-break">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
                  {docDef.signatures.map((sig, sIdx) => (
                    <div key={sIdx} className="space-y-1">
                      <div className="font-bold text-xs text-slate-900 uppercase">
                        {sig.title}
                      </div>
                      <div className="h-14 flex items-center justify-center text-xs italic text-slate-400">
                        (İmza / Mühür)
                      </div>
                      <div className="text-xs font-semibold text-slate-900">
                        {sig.name || 'Yetkili'}
                      </div>
                      {sig.duty && (
                        <div className="text-[10px] text-slate-600">
                          {sig.duty}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Line */}
            <div className="absolute bottom-4 left-10 right-10 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
              <span>{docDef.footerNote || "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"}</span>
              <span>Resmi Belge Çıktısı</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewerModal;
