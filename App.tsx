
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Menu, Globe } from 'lucide-react';
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
              
              <div className="flex-1 lg:ml-64 pt-16 lg:pt-0 transition-all duration-300 w-full">
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
            </div>
          </HashRouter>
        </SettingsProvider>
      </IncidentProvider>
    </StudentProvider>
  );
};

export default App;
