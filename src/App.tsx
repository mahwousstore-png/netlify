import React from 'react';
import { Toaster } from 'react-hot-toast';
import EmployeeBalances from './components/EmployeeBalances';
import Suppliers from './components/Suppliers';

function App() {
  const [currentView, setCurrentView] = React.useState<'suppliers' | 'employees'>('suppliers');

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" reverseOrder={false} />
      
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">نظام إدارة المحوس</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setCurrentView('suppliers')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'suppliers'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                الموردين
              </button>
              <button
                onClick={() => setCurrentView('employees')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'employees'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                عهد الموظفين
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {currentView === 'suppliers' ? <Suppliers /> : <EmployeeBalances />}
      </main>
    </div>
  );
}

export default App;
