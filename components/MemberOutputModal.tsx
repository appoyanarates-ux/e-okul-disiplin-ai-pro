import React, { useEffect, useState } from 'react';
import { Lock, LogIn, ShieldAlert, X, ExternalLink } from 'lucide-react';
import { getMemberLoginUrl } from '../services/bridge';

export const MemberOutputModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [actionName, setActionName] = useState('Döküman çıktısı');
  const [loginUrl, setLoginUrl] = useState('https://www.evrakplus.com/giris');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setActionName(detail.actionName || 'Döküman çıktısı (Yazdır / PDF / Word)');
      setLoginUrl(detail.loginUrl || getMemberLoginUrl());
      setOpen(true);
    };
    window.addEventListener('member-output-blocked', handler);
    return () => window.removeEventListener('member-output-blocked', handler);
  }, []);

  if (!open) return null;

  const handleGoToLogin = () => {
    window.location.href = loginUrl;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 p-5 text-white relative">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3.5 right-3.5 p-1 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Döküman Çıktısı Sadece Üyelere Özeldir</h3>
              <p className="text-xs text-amber-100 mt-0.5">evrakplus.com Üyelik Doğrulaması</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4 text-sm text-slate-700">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 leading-relaxed">
              <strong className="block mb-1">{actionName} için üye girişi gereklidir.</strong>
              Programı inceleyebilir ve veri girişi yapabilirsiniz; ancak resmi evrak, tutanak, kurul kararı ve rapor çıktısı (Yazıcı, PDF, Word, Excel) yalnızca <strong>evrakplus.com</strong> üyeleri tarafından alınabilir.
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Giriş yaptıktan sonra programa otomatik olarak geri dönecek ve tüm evrak çıktılarını sınırsız şekilde alabileceksiniz.
          </p>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Kapat
          </button>
          <button
            onClick={handleGoToLogin}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>evrakplus.com Giriş Yap</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberOutputModal;
