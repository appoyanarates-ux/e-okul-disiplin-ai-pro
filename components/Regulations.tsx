
import React, { useState } from 'react';
import { Search, BookOpen, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { searchRegulations } from '../services/geminiService';

const Regulations = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const response = await searchRegulations(query);
    setResult(response);
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-screen flex flex-col">
      <div className="text-center mb-8 shrink-0">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
             <Sparkles className="w-4 h-4" /> Yapay Zeka Destekli
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Mevzuat Asistanı</h1>
        <p className="text-slate-500">
            Aşağıdaki resmi kaynakları tarayarak disiplin ve mevzuat sorularınızı yanıtlar.
        </p>
        
        <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
            <a 
                href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=18812&MevzuatTur=7&MevzuatTertip=5" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
                <ExternalLink className="w-3 h-3" /> Ortaöğretim Kurumları Yönetmeliği (Lise)
            </a>
            <a 
                href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=19942&MevzuatTur=7&MevzuatTertip=5" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
                <ExternalLink className="w-3 h-3" /> İlköğretim Kurumları Yönetmeliği (Ortaokul)
            </a>
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-lg border border-slate-100 mb-6 max-w-2xl mx-auto w-full shrink-0">
        <form onSubmit={handleSearch} className="flex items-center">
            <Search className="w-6 h-6 text-slate-400 ml-4" />
            <input 
                type="text" 
                className="flex-1 p-4 outline-none text-lg text-slate-700 placeholder:text-slate-400"
                placeholder="Örn: Kopya çekmenin cezası nedir?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-all font-medium disabled:opacity-50 min-w-[100px] flex justify-center"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sor'}
            </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto">
        {result ? (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 animate-fade-in max-w-4xl mx-auto">
                <div className="flex items-center gap-2 mb-4 text-blue-600 pb-4 border-b border-slate-100">
                    <BookOpen className="w-5 h-5" />
                    <h3 className="font-bold">Mevzuat Analiz Sonucu</h3>
                </div>
                <div className="prose prose-slate max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-sm md:text-base">{result}</pre>
                </div>
            </div>
        ) : (
            !loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 opacity-60 max-w-2xl mx-auto">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                        <span className="font-bold block mb-1 text-slate-700">Örnek Soru:</span>
                        "Okul eşyasına zarar vermenin disiplin cezası nedir?"
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                        <span className="font-bold block mb-1 text-slate-700">Örnek Soru:</span>
                        "Kınama cezası gerektiren davranışlar nelerdir?"
                    </div>
                     <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                        <span className="font-bold block mb-1 text-slate-700">Örnek Soru:</span>
                        "Ortaokulda okul değiştirme cezası hangi durumlarda verilir?"
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                        <span className="font-bold block mb-1 text-slate-700">Örnek Soru:</span>
                        "Disiplin kurulu kimlerden oluşur?"
                    </div>
                </div>
            )
        )}
        
        {loading && (
             <div className="flex flex-col items-center justify-center mt-12 text-slate-400 gap-3">
                 <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                 <p>Mevzuat taranıyor, lütfen bekleyiniz...</p>
             </div>
        )}
      </div>
    </div>
  );
};

export default Regulations;
