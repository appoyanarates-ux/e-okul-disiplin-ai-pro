
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Menu, Globe, LayoutDashboard, Users, AlertTriangle, Gavel, MoreHorizontal } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import IncidentLog from './components/IncidentLog';
import DecisionAssistant from './components/DecisionAssistant';
import Statistics from './components/Statistics';
import Regulations from './components/Regulations';
import Students from './components/Students';
import MesemManagement from './components/MesemManagement';
import DataExportTool from './components/DataExportTool';
import Settings from './components/Settings';
import HelpBackup from './components/HelpBackup';
import PenaltyCatalog from './components/PenaltyCatalog';
import PenaltyRemoval from './components/PenaltyRemoval';
import About from './components/About';
import { StudentProvider } from './context/StudentContext';
import { SettingsProvider } from './context/SettingsContext';
import { IncidentProvider } from './context/IncidentContext';
import { initPersistenceSync } from './services/persistenceSync';
import { initCloudSync } from './services/cloudSyncService';

import { UpdateNotificationModal } from './components/UpdateNotificationModal';

const App = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    initPersistenceSync();
    initCloudSync();
  }, []);

  return (
    <StudentProvider>
      <IncidentProvider>
        <SettingsProvider>
          <HashRouter>
            <UpdateNotificationModal />
            <div className="flex bg-[#f3f4f6] min-h-screen font-sans">
              {/* Mobile Header */}
              <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-30 shadow-md">
                <div className="font-bold text-lg tracking-tight">e-Okul Disiplin</div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://www.evrakplus.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>evrakplus.com</span>
                  </a>
                  <button 
                    onClick={() => setIsMobileMenuOpen(true)} 
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} /> 
              
              <div className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 transition-all duration-300 w-full min-w-0">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/mesem" element={<MesemManagement />} />
                  <Route path="/incidents" element={<IncidentLog />} />
                  <Route path="/penalties" element={<PenaltyCatalog />} />
                  <Route path="/decisions" element={<DecisionAssistant />} />
                  <Route path="/penalty-removal" element={<PenaltyRemoval />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/export" element={<DataExportTool />} />
                  <Route path="/regulations" element={<Regulations />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/help" element={<HelpBackup />} />
                  <Route path="/about" element={<About />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>

              {/* Mobile Bottom Navigation Bar (Sadece Mobilde Görünür) */}
              <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/90 z-30 flex items-center justify-around px-2 shadow-lg shadow-slate-900/10">
                <NavLink
                  to="/"
                  className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                    isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px]">Panel</span>
                </NavLink>
                <NavLink
                  to="/students"
                  className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                    isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px]">Öğrenci</span>
                </NavLink>
                <NavLink
                  to="/incidents"
                  className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                    isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px]">Olaylar</span>
                </NavLink>
                <NavLink
                  to="/decisions"
                  className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                    isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Gavel className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px]">Karar</span>
                </NavLink>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px]">Menü</span>
                </button>
              </div>
            </div>
          </HashRouter>
        </SettingsProvider>
      </IncidentProvider>
    </StudentProvider>
  );
};

export default App;
