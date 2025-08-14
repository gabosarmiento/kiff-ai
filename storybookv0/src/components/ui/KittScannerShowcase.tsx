import React, { useState } from 'react';
import KittScanner from './KittScanner';

export default function KittScannerShowcase() {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const themeClasses = isDark 
    ? 'bg-gray-900 text-white' 
    : 'bg-gray-50 text-gray-900';

  const cardClasses = isDark
    ? 'bg-gray-800 border-gray-700'
    : 'bg-white border-gray-200';

  const buttonClasses = isDark
    ? 'bg-gray-700 border-gray-600 hover:bg-gray-600'
    : 'bg-gray-100 border-gray-300 hover:bg-gray-200';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${themeClasses}`}>
      {/* Header */}
      <div className="p-8 border-b border-gray-700">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">KITT Scanner Showcase</h1>
            <p className="text-gray-400">
              80s-inspired LED scanner animation for modern UIs
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className={`px-4 py-2 rounded-lg border transition-colors ${buttonClasses}`}
          >
            {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-12">
        {/* Buttons Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Interactive Buttons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Launch Button */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">Launch System</h3>
              <button className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border transition-all hover:scale-105 ${buttonClasses}`}>
                <span className="font-medium">Launch</span>
                <div className="w-24">
                  <KittScanner color="#3895ff" height="4px" />
                </div>
              </button>
            </div>

            {/* Deploy Button */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">Deploy Application</h3>
              <button className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border transition-all hover:scale-105 ${buttonClasses}`}>
                <span className="font-medium">Deploy</span>
                <div className="w-28">
                  <KittScanner color="#10b981" height="4px" />
                </div>
              </button>
            </div>

            {/* Scan Button */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">Security Scan</h3>
              <button className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border transition-all hover:scale-105 ${buttonClasses}`}>
                <span className="font-medium">Scan</span>
                <div className="w-20">
                  <KittScanner color="#f59e0b" height="4px" />
                </div>
              </button>
            </div>

            {/* Alert Button */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">Alert Status</h3>
              <button className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border transition-all hover:scale-105 ${buttonClasses}`}>
                <span className="font-medium">Alert</span>
                <div className="w-24">
                  <KittScanner color="#ef4444" height="4px" duration="0.6s" />
                </div>
              </button>
            </div>

            {/* Process Button */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">Processing</h3>
              <button className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border transition-all hover:scale-105 ${buttonClasses}`}>
                <span className="font-medium">Process</span>
                <div className="w-32">
                  <KittScanner color="#8b5cf6" height="3px" ledSize="5px" />
                </div>
              </button>
            </div>

            {/* Initialize Button */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">Initialize</h3>
              <button className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border transition-all hover:scale-105 ${buttonClasses}`}>
                <span className="font-medium">Initialize</span>
                <div className="w-28">
                  <KittScanner color="#06b6d4" height="5px" ledSize="7px" />
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Cards Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Status Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* System Status Card */}
            <div className={`p-6 rounded-xl border ${cardClasses}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">System Status</h3>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                All systems operational and running smoothly
              </p>
              <div className="space-y-2">
                <div className="text-xs text-gray-400">Scanning for threats...</div>
                <KittScanner color="#10b981" height="3px" />
              </div>
            </div>

            {/* Network Monitor Card */}
            <div className={`p-6 rounded-xl border ${cardClasses}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Network Monitor</h3>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Monitoring network traffic and connections
              </p>
              <div className="space-y-2">
                <div className="text-xs text-gray-400">Active monitoring...</div>
                <KittScanner color="#3895ff" height="4px" duration="1.2s" />
              </div>
            </div>

            {/* Security Alert Card */}
            <div className={`p-6 rounded-xl border ${cardClasses}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Security Alert</h3>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Potential security threat detected
              </p>
              <div className="space-y-2">
                <div className="text-xs text-gray-400">Threat analysis...</div>
                <KittScanner color="#ef4444" height="4px" duration="0.5s" />
              </div>
            </div>

            {/* Data Processing Card */}
            <div className={`p-6 rounded-xl border ${cardClasses}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Data Processing</h3>
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Processing large dataset batch #1247
              </p>
              <div className="space-y-2">
                <div className="text-xs text-gray-400">Processing 73% complete...</div>
                <KittScanner color="#8b5cf6" height="5px" ledSize="8px" />
              </div>
            </div>

            {/* Server Health Card */}
            <div className={`p-6 rounded-xl border ${cardClasses}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Server Health</h3>
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Monitoring server performance metrics
              </p>
              <div className="space-y-2">
                <div className="text-xs text-gray-400">Health check in progress...</div>
                <KittScanner color="#f59e0b" height="3px" ledSize="5px" />
              </div>
            </div>

            {/* AI Analysis Card */}
            <div className={`p-6 rounded-xl border ${cardClasses}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">AI Analysis</h3>
                <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Running machine learning inference
              </p>
              <div className="space-y-2">
                <div className="text-xs text-gray-400">Neural network processing...</div>
                <KittScanner color="#06b6d4" height="4px" duration="0.8s" />
              </div>
            </div>
          </div>
        </section>

        {/* Variations Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Scanner Variations</h2>
          <div className={`p-8 rounded-xl border ${cardClasses}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Speed Variations</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Slow (2s cycle)</div>
                    <div className="w-full">
                      <KittScanner color="#3895ff" duration="2s" />
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Normal (1s cycle)</div>
                    <div className="w-full">
                      <KittScanner color="#3895ff" duration="1s" />
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Fast (0.5s cycle)</div>
                    <div className="w-full">
                      <KittScanner color="#3895ff" duration="0.5s" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-medium">Size Variations</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Thin (2px height)</div>
                    <div className="w-full">
                      <KittScanner color="#10b981" height="2px" ledSize="4px" />
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Normal (4px height)</div>
                    <div className="w-full">
                      <KittScanner color="#10b981" height="4px" ledSize="6px" />
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Thick (8px height)</div>
                    <div className="w-full">
                      <KittScanner color="#10b981" height="8px" ledSize="10px" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Usage Examples */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Usage Examples</h2>
          <div className={`p-6 rounded-xl border ${cardClasses}`}>
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Code Examples</h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-gray-500 mb-2">Basic Usage:</div>
                  <code className="block bg-gray-800 text-green-400 p-3 rounded">
                    {'<KittScanner />'}
                  </code>
                </div>
                
                <div>
                  <div className="text-gray-500 mb-2">Custom Color & Speed:</div>
                  <code className="block bg-gray-800 text-green-400 p-3 rounded">
                    {'<KittScanner color="#ff6b35" duration="0.5s" />'}
                  </code>
                </div>
                
                <div>
                  <div className="text-gray-500 mb-2">In Button:</div>
                  <code className="block bg-gray-800 text-green-400 p-3 rounded">
                    {`<button className="flex items-center gap-2">
  <span>Launch</span>
  <div className="w-24">
    <KittScanner color="#3895ff" />
  </div>
</button>`}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
