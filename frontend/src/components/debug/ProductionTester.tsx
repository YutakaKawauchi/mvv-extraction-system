import React, { useState, useRef } from 'react';

interface TestLog {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  data?: any;
}

interface ProductionTesterProps {
  isVisible: boolean;
  onClose: () => void;
}

export const ProductionTester: React.FC<ProductionTesterProps> = ({ isVisible, onClose }) => {
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [scenario, setScenario] = useState<'success' | 'error' | 'timeout' | 'intermittent'>('success');
  const [duration, setDuration] = useState(30000);
  const [progressSteps, setProgressSteps] = useState(6);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (level: TestLog['level'], message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, level, message, data }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const stopTest = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    addLog('warning', 'Test stopped by user');
  };

  const startTest = async () => {
    if (isRunning) {
      stopTest();
      return;
    }

    setIsRunning(true);
    clearLogs();
    
    addLog('info', '🚀 Starting Production Long-Running Mock Test');
    addLog('info', `Scenario: ${scenario}, Duration: ${duration}ms, Steps: ${progressSteps}`);

    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL;
      const API_SECRET = import.meta.env.VITE_API_SECRET;

      if (!API_BASE || !API_SECRET) {
        throw new Error('API configuration missing');
      }

      // Step 1: Start mock task
      addLog('info', '📡 Starting mock task...');
      const startResponse = await fetch(`${API_BASE}/long-running-mock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_SECRET
        },
        body: JSON.stringify({
          scenario,
          duration,
          progressSteps,
          taskType: 'production-ui-test'
        })
      });

      if (!startResponse.ok) {
        throw new Error(`HTTP ${startResponse.status}: ${startResponse.statusText}`);
      }

      const startData = await startResponse.json();
      addLog('success', '✅ Task started successfully');
      addLog('info', `Task ID: ${startData.taskId}`, startData);

      const taskId = startData.taskId;
      if (!taskId) {
        throw new Error('No task ID received');
      }

      // Step 2: Start polling
      addLog('info', '🔄 Starting polling...');
      let pollCount = 0;
      const maxPolls = Math.ceil(duration / 2000) + 10; // +10 for safety margin

      intervalRef.current = setInterval(async () => {
        try {
          pollCount++;
          addLog('info', `📊 Poll ${pollCount}/${maxPolls}`);

          const statusResponse = await fetch(`${API_BASE}/task-status?taskId=${taskId}`, {
            method: 'GET',
            headers: {
              'X-API-Key': API_SECRET
            }
          });

          if (!statusResponse.ok) {
            throw new Error(`Status check failed: ${statusResponse.status}`);
          }

          const statusData = await statusResponse.json();
          const status = statusData?.data?.data?.status;
          const progress = statusData?.data?.data?.progress?.percentage;
          const currentStep = statusData?.data?.data?.progress?.currentStep;

          addLog('info', `📈 Status: ${status}, Progress: ${progress}%, Step: ${currentStep}`);

          // Check completion
          if (status === 'completed') {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsRunning(false);
            addLog('success', '🎉 Test completed successfully!');
            addLog('info', `⏱️ Total polls: ${pollCount}`);
            addLog('info', '📋 Final result', statusData?.data?.data?.result);
            return;
          }

          if (status === 'failed') {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsRunning(false);
            addLog('error', '❌ Task failed');
            addLog('error', 'Error details', statusData?.data?.data?.error);
            return;
          }

          // Timeout check
          if (pollCount >= maxPolls) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsRunning(false);
            addLog('warning', '⏰ Polling timeout reached');
            return;
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          addLog('error', `❌ Poll ${pollCount} error: ${errorMessage}`);
        }
      }, 5000); // 5-second interval (reduced server load)

    } catch (error) {
      setIsRunning(false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog('error', `❌ Test failed: ${errorMessage}`);
      addLog('error', 'Error details', error instanceof Error ? { message: error.message, stack: error.stack } : error);
    }
  };

  const copyLogsToClipboard = async () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}${log.data ? ' | ' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n');

    try {
      await navigator.clipboard.writeText(logText);
      addLog('success', '📋 Logs copied to clipboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog('error', `Failed to copy logs: ${errorMessage}`);
    }
  };

  const getLogColor = (level: TestLog['level']) => {
    switch (level) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-700';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-4/5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">🧪 Production Long-Running Mock Tester</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scenario</label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as any)}
                disabled={isRunning}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="timeout">Timeout</option>
                <option value="intermittent">Intermittent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (ms)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={isRunning}
                className="w-full p-2 border border-gray-300 rounded-md"
                min="5000"
                max="300000"
                step="5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Progress Steps</label>
              <input
                type="number"
                value={progressSteps}
                onChange={(e) => setProgressSteps(Number(e.target.value))}
                disabled={isRunning}
                className="w-full p-2 border border-gray-300 rounded-md"
                min="3"
                max="20"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={startTest}
              disabled={false}
              className={`px-4 py-2 rounded font-medium ${
                isRunning
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:opacity-50`}
            >
              {isRunning ? '⏹️ Stop Test' : '▶️ Start Test'}
            </button>
            <button
              onClick={clearLogs}
              disabled={isRunning}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded font-medium disabled:opacity-50"
            >
              🗑️ Clear Logs
            </button>
            <button
              onClick={copyLogsToClipboard}
              disabled={logs.length === 0}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium disabled:opacity-50"
            >
              📋 Copy Logs
            </button>
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-auto p-4">
          <div className="font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No logs yet. Click "Start Test" to begin.
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`mb-1 ${getLogColor(log.level)}`}>
                  <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                  <span className="font-medium">{log.level.toUpperCase()}:</span>{' '}
                  {log.message}
                  {log.data && (
                    <details className="mt-1 ml-4">
                      <summary className="cursor-pointer text-xs text-gray-500">Show data</summary>
                      <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              Status: {isRunning ? '🔄 Running' : '⏸️ Stopped'} | Logs: {logs.length}
            </span>
            <span className="text-gray-500">
              Environment: {import.meta.env.VITE_ENVIRONMENT || 'development'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};