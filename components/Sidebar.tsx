
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, AlertTriangle, Gavel, BarChart3, 
  BookOpen, Settings, ChevronDown, ChevronRight, LifeBuoy, Scale, Info, Wifi, WifiOff, AlertCircle, RotateCcw, X,
  Briefcase, FileSpreadsheet
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useStudents } from '../context/StudentContext';

interface MenuItem {
  title: string;
  icon: React.ElementType;
  path?: string;
  children?: { title: string; path: string }[];
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
  const location = useLocation();
  const { apiKey } = useSettings();
  const { students } = useStudents();
  const mesemCount = students.filter(s => s.isMesem || (s.grade && s.grade.toUpperCase().includes('MES'))).length;
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['decisions']);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleMenu = (key: string) => {
    setExpandedMenus(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname + location.search === path || location.pathname.startsWith(path.split('?')[0]); 
  };

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  const getStatusDisplay = () => {
    if (!isOnline) {
      return {
        text: 'Çevrimdışı Mod',
        colorClass: 'bg-red-900/30 text-red-500',
        icon: <WifiOff className="w-3 h-3" />
      };
    }
    if (!apiKey || apiKey.trim() === '') {
      return {
        text: 'AI Pasif (Anahtar Gerekli)',
        colorClass: 'bg-orange-900/30 text-orange-400',
        icon: <AlertCircle className="w-3 h-3" />
      };
    }
    return {
      text: 'Çevrimiçi (AI Aktif)',
      colorClass: 'bg-emerald-900/30 text-emerald-500',
      icon: <Wifi className="w-3 h-3" />
    };
  };

  const status = getStatusDisplay();

  const menuItems: { key: string; items: MenuItem }[] = [
    {
      key: 'dashboard',
      items: {
        title: 'Kontrol Paneli',
        icon: LayoutDashboard,
        path: '/'
      }
    },
    {
      key: 'students',
      items: {
        title: 'Öğrenci İşlemleri',
        icon: Users,
        path: '/students'
      }
    },
    {
      key: 'mesem',
      items: {
        title: 'MESEM Yönetimi',
        icon: Briefcase,
        path: '/mesem'
      }
    },
    {
      key: 'incidents',
      items: {
        title: 'Olaylar',
        icon: AlertTriangle,
        path: '/incidents'
      }
    },
    {
      key: 'penalties',
      items: {
        title: 'Disiplin Cezaları',
        icon: Scale,
        path: '/penalties'
      }
    },
    {
      key: 'decisions',
      items: {
        title: 'Karar ve Evrak',
        icon: Gavel,
        children: [
          { title: '1. AI Analiz', path: '/decisions?tab=analysis' },
          { title: '2. Toplantı Yönetimi', path: '/decisions?tab=meeting' },
          { title: '3. Tutanak & Formlar', path: '/decisions?tab=forms' },
          { title: '4. Karar ve Tebligat', path: '/decisions?tab=decision' },
          { title: 'Ceza Silme/İade', path: '/penalty-removal' },
        ]
      }
    },
    {
      key: 'statistics',
      items: {
        title: 'İstatistikler',
        icon: BarChart3,
        path: '/statistics'
      }
    },
    {
      key: 'export',
      items: {
        title: 'Rapor & Dışa Aktar',
        icon: FileSpreadsheet,
        path: '/export'
      }
    },
    {
      key: 'regulations',
      items: {
        title: 'Mevzuat Asistanı',
        icon: BookOpen,
        path: '/regulations'
      }
    }
  ];

  const bottomMenuItems: { key: string; items: MenuItem }[] = [
     {
      key: 'settings',
      items: {
        title: 'Ayarlar',
        icon: Settings,
        path: '/settings'
      }
    },
    {
      key: 'help',
      items: {
        title: 'Yardım',
        icon: LifeBuoy,
        path: '/help'
      }
    }
  ];

  const renderMenuItem = (menu: { key: string; items: MenuItem }) => {
    const isExpanded = expandedMenus.includes(menu.key);
    const hasChildren = menu.items.children && menu.items.children.length > 0;
    const isParentActive = hasChildren && menu.items.children?.some(c => isActive(c.path));
    const isDirectActive = !hasChildren && menu.items.path && isActive(menu.items.path);

    return (
      <div key={menu.key} className="mb-1">
        {hasChildren ? (
          <button
            onClick={() => toggleMenu(menu.key)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
              isParentActive ? 'bg-blue-900/40 text-blue-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <menu.items.icon className={`w-5 h-5 ${isParentActive ? 'text-blue-400' : 'text-slate-500'}`} />
              <span>{menu.items.title}</span>
            </div>
            {isExpanded ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
          </button>
        ) : (
          <Link
            to={menu.items.path!}
            onClick={handleLinkClick}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
              isDirectActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <menu.items.icon className={`w-5 h-5 ${isDirectActive ? 'text-blue-200' : 'text-slate-500'}`} />
              <span>{menu.items.title}</span>
            </div>
            {menu.key === 'mesem' && mesemCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isDirectActive ? 'bg-white text-blue-900' : 'bg-slate-800 text-blue-300 border border-slate-700'
              }`}>
                {mesemCount}
              </span>
            )}
          </Link>
        )}

        {/* Submenu */}
        {hasChildren && isExpanded && (
          <div className="mt-1 ml-4 pl-4 border-l border-slate-700/50 space-y-1">
            {menu.items.children?.map((child) => (
              <Link
                key={child.path}
                to={child.path}
                onClick={handleLinkClick}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive(child.path)
                    ? 'text-blue-400 bg-blue-900/20 font-medium'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {child.title === 'Ceza Silme/İade' ? (
                   <span className="flex items-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5" /> {child.title}
                   </span>
                ) : child.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <div className={`w-64 bg-slate-900 h-screen fixed left-0 top-0 flex flex-col shadow-2xl z-50 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <Link to="/" onClick={handleLinkClick} className="flex items-center gap-3 group">
            <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">
              <Gavel className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-100 tracking-tight leading-tight">e-Okul Disiplin</h1>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Yönetim Paneli</p>
            </div>
          </Link>
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu List */}
        <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <div className="space-y-1">
            <p className="px-3 text-xs font-bold text-slate-600 uppercase mb-2 tracking-wider">Genel</p>
            {menuItems.map(renderMenuItem)}
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-1">
            <p className="px-3 text-xs font-bold text-slate-600 uppercase mb-2 tracking-wider">Sistem</p>
            {bottomMenuItems.map(renderMenuItem)}
             
            <Link
              to="/about"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                 isActive('/about') 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Info className="w-5 h-5 text-slate-500" />
              <span>Hakkında</span>
            </Link>
          </div>
        </div>

        {/* User Info / Footer */}
        <div className="bg-slate-950 border-t border-slate-800">
           <div className={`px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider ${status.colorClass}`}>
              {status.icon}
              {status.text}
           </div>
           <div className="p-3.5 border-t border-slate-900/80 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                 AY
              </div>
              <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-slate-200 truncate">By Abdullah Yanarateş</p>
                  <p className="text-[10px] text-slate-400 truncate">E-Okul Disiplin AI Pro v1.1.5</p>
              </div>
           </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
