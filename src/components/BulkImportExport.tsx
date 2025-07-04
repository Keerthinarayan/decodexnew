import React, { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Question } from '../types/game';

interface BulkImportExportProps {
  questions: Question[];
  onImport: (questions: any[]) => Promise<void>;
  onClose: () => void;
}

const BulkImportExport: React.FC<BulkImportExportProps> = ({ questions, onImport, onClose }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importData, setImportData] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');

  const handleExportJSON = () => {
    const exportData = questions.map(q => ({
      title: q.title,
      question: q.question,
      answer: q.answer,
      hint: q.hint || '',
      type: q.type,
      mediaUrl: q.mediaUrl || '',
      points: q.points,
      category: q.category,
      explanation: q.explanation || '',
      isActive: q.isActive
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decodex-questions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Title', 'Question', 'Answer', 'Hint', 'Type', 'Media URL', 'Points', 'Category', 'Explanation', 'Active'];
    const rows = questions.map(q => [
      q.title,
      q.question,
      q.answer,
      q.hint || '',
      q.type,
      q.mediaUrl || '',
      q.points.toString(),
      q.category,
      q.explanation || '',
      q.isActive.toString()
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decodex-questions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      setImportStatus('error');
      setImportMessage('Please provide data to import');
      return;
    }

    setImportStatus('processing');
    setImportMessage('Processing import...');

    try {
      let parsedData;
      
      // Try to parse as JSON first
      try {
        parsedData = JSON.parse(importData);
      } catch {
        // Try to parse as CSV
        const lines = importData.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        parsedData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.replace(/"/g, '').trim());
          const obj: any = {};
          
          headers.forEach((header, index) => {
            const value = values[index] || '';
            switch (header.toLowerCase()) {
              case 'title':
                obj.question = value; // Use as question text
                break;
              case 'question':
                obj.question = value;
                break;
              case 'answer':
                obj.correctAnswer = value;
                break;
              case 'hint':
                obj.hint = value;
                break;
              case 'type':
                obj.type = value || 'text';
                break;
              case 'media url':
              case 'mediaurl':
                obj.mediaUrl = value;
                break;
              case 'points':
                obj.points = parseInt(value) || 100;
                break;
              case 'category':
                obj.category = value;
                break;
              case 'explanation':
                obj.explanation = value;
                break;
              case 'active':
                obj.isActive = value.toLowerCase() === 'true';
                break;
            }
          });
          
          return obj;
        });
      }

      // Validate data structure
      if (!Array.isArray(parsedData)) {
        throw new Error('Data must be an array of questions');
      }

      const validQuestions = parsedData.filter(q => 
        q.question && q.correctAnswer && q.category
      );

      if (validQuestions.length === 0) {
        throw new Error('No valid questions found. Each question must have at least: question, answer, and category');
      }

      await onImport(validQuestions);
      
      setImportStatus('success');
      setImportMessage(`Successfully imported ${validQuestions.length} questions`);
      
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      setImportStatus('error');
      setImportMessage(error instanceof Error ? error.message : 'Import failed');
    }
  };

  const sampleData = [
    {
      question: "What is the frequency of a signal with period 0.1 seconds?",
      correctAnswer: "10 Hz",
      hint: "Frequency = 1/Period",
      type: "text",
      mediaUrl: "",
      points: 100,
      category: "Signal Processing",
      explanation: "Frequency is the reciprocal of period: f = 1/T = 1/0.1 = 10 Hz",
      isActive: true
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900/90 border border-blue-400/30 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Bulk Import/Export Questions</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${
              activeTab === 'import'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Import
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${
              activeTab === 'export'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Export
          </button>
        </div>

        {activeTab === 'import' && (
          <div className="space-y-6">
            <div>
              <label className="block text-white font-semibold mb-2">
                Import Data (JSON or CSV)
              </label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="w-full h-64 bg-gray-800/50 border border-gray-600 rounded-lg p-4 text-white font-mono text-sm resize-none focus:outline-none focus:border-blue-400"
                placeholder="Paste your JSON or CSV data here..."
              />
            </div>

            {/* Status Message */}
            {importStatus !== 'idle' && (
              <div className={`p-4 rounded-lg border ${
                importStatus === 'success' ? 'bg-green-900/50 border-green-500' :
                importStatus === 'error' ? 'bg-red-900/50 border-red-500' :
                'bg-blue-900/50 border-blue-500'
              }`}>
                <div className="flex items-center space-x-2">
                  {importStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                  {importStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                  {importStatus === 'processing' && <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
                  <span className={`${
                    importStatus === 'success' ? 'text-green-300' :
                    importStatus === 'error' ? 'text-red-300' :
                    'text-blue-300'
                  }`}>
                    {importMessage}
                  </span>
                </div>
              </div>
            )}

            {/* Sample Data */}
            <div className="bg-gray-800/30 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2">Sample JSON Format:</h4>
              <pre className="text-gray-300 text-xs overflow-x-auto">
                {JSON.stringify(sampleData, null, 2)}
              </pre>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleImport}
                disabled={importStatus === 'processing'}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                <Upload className="w-5 h-5" />
                <span>{importStatus === 'processing' ? 'Importing...' : 'Import Questions'}</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="bg-gray-800/30 rounded-lg p-6">
              <h4 className="text-white font-semibold mb-4">Export Current Questions</h4>
              <p className="text-gray-300 mb-6">
                Export all {questions.length} questions in your preferred format.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center justify-center space-x-3 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg font-semibold transition-colors duration-200"
                >
                  <FileText className="w-5 h-5" />
                  <span>Export as JSON</span>
                </button>
                
                <button
                  onClick={handleExportCSV}
                  className="flex items-center justify-center space-x-3 bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-lg font-semibold transition-colors duration-200"
                >
                  <FileText className="w-5 h-5" />
                  <span>Export as CSV</span>
                </button>
              </div>
            </div>

            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
              <h5 className="text-blue-300 font-semibold mb-2">Export Information</h5>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• JSON format preserves all data types and structure</li>
                <li>• CSV format is compatible with Excel and Google Sheets</li>
                <li>• Exported files include all question metadata</li>
                <li>• Files are named with current date for organization</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkImportExport;