import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, MessageSquare, Send, Loader2, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

export default function DocumentSummarizer() {
    const [file, setFile] = useState(null);
    const [extractedText, setExtractedText] = useState('');
    const [summaries, setSummaries] = useState(null);
    const [loading, setLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [activeView, setActiveView] = useState('upload');
    const [expandedSummary, setExpandedSummary] = useState('short');
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleFileSelect = async (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        const validTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/jpg'
        ];

        if (!validTypes.includes(selectedFile.type)) {
            setError('Please upload a valid file (PDF, DOC, DOCX, TXT)');
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB');
            return;
        }

        setFile(selectedFile);
        setLoading(true);
        setError('');
        setActiveView('summary');

        try {
            const text = await extractText(selectedFile);
            setExtractedText(text);

            const summaryData = await generateSummaries(text);
            setSummaries(summaryData);
            setChatMessages([{
                role: 'assistant',
                content: 'Hello! I\'ve analyzed your document. Ask me anything about it!'
            }]);
        } catch (err) {
            setError('Error processing document: ' + err.message);
            setActiveView('upload');
            setFile(null);
        } finally {
            setLoading(false);
        }
    };

    const extractText = async (file) => {
        return new Promise(async (resolve, reject) => {
            if (file.type === 'text/plain') {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read text file'));
                reader.readAsText(file);
            } else if (file.type === 'application/pdf') {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await getDocument({ data: arrayBuffer }).promise;
                    let fullText = '';

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }

                    if (!fullText.trim()) {
                        reject(new Error('No text found in PDF (it might be scanned/image-based)'));
                    } else {
                        resolve(fullText);
                    }
                } catch (err) {
                    console.error('PDF extraction error:', err);
                    reject(new Error('Failed to extract text from PDF: ' + err.message));
                }
            } else if (file.type.startsWith('image/')) {
                resolve(`[Image support requires OCR which is not yet implemented. Please upload a PDF or text file.]`);
            } else {
                resolve(`[DOC/DOCX support requires additional libraries not yet installed. Please upload a PDF or text file.]`);
            }
        });
    };

    const generateSummaries = async (text) => {
        try {
            const response = await fetch('http://localhost:3000/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'API request failed');
            }

            const data = await response.json();
            return data;
        } catch (err) {
            console.error('Summary generation error:', err);
            throw new Error('Failed to generate summaries: ' + err.message);
        }
    };

    const handleChat = async () => {
        if (!chatInput.trim() || chatLoading) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setChatLoading(true);

        try {
            const conversationHistory = chatMessages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const messages = [
                {
                    role: 'user',
                    content: `You are a helpful assistant answering questions about this document. Only use information from the document to answer questions.\n\nDocument:\n${extractedText.substring(0, 20000)}`
                },
                {
                    role: 'assistant',
                    content: 'I understand. I will answer questions based only on the document content provided.'
                },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Chat API request failed');
            }

            const data = await response.json();
            const answer = data.content;
            setChatMessages(prev => [...prev, { role: 'assistant', content: answer }]);
        } catch (err) {
            console.error('Chat error:', err);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        } finally {
            setChatLoading(false);
        }
    };

    const resetApp = () => {
        setFile(null);
        setExtractedText('');
        setSummaries(null);
        setChatMessages([]);
        setActiveView('upload');
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-indigo-600 p-2 rounded-lg">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">DocuChat AI</h1>
                                <p className="text-xs text-gray-500">Intelligent Document Analysis</p>
                            </div>
                        </div>
                        {file && (
                            <button
                                onClick={resetApp}
                                className="flex items-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                            >
                                <X className="w-4 h-4" />
                                <span className="hidden sm:inline font-medium">Reset</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Error Message */}
                {error && (
                    <div className="max-w-2xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-800 text-sm">{error}</p>
                    </div>
                )}

                {/* Upload View */}
                {activeView === 'upload' && (
                    <div className="animate-fadeIn">
                        <div className="max-w-2xl mx-auto">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                                    <Sparkles className="w-8 h-8 text-indigo-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-3">
                                    Upload Your Document
                                </h2>
                                <p className="text-gray-600">
                                    Supports PDF, DOC, DOCX, and TXT files
                                </p>
                            </div>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="relative border-2 border-dashed border-indigo-300 rounded-2xl p-12 text-center hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer bg-white shadow-lg"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileSelect}
                                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                                    className="hidden"
                                />
                                <Upload className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                    Click to upload or drag and drop
                                </h3>
                                <p className="text-gray-500 text-sm">Maximum file size: 10MB</p>
                            </div>

                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="text-3xl mb-2">📄</div>
                                    <div className="font-semibold text-gray-900 mb-1">Extract Text</div>
                                    <div className="text-sm text-gray-600">Automatic extraction from any format</div>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="text-3xl mb-2">📝</div>
                                    <div className="font-semibold text-gray-900 mb-1">AI Summaries</div>
                                    <div className="text-sm text-gray-600">Multiple summary formats</div>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="text-3xl mb-2">💬</div>
                                    <div className="font-semibold text-gray-900 mb-1">Smart Chat</div>
                                    <div className="text-sm text-gray-600">Ask questions about content</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary View */}
                {activeView === 'summary' && (
                    <div className="animate-fadeIn">
                        <div className="flex justify-center mb-8">
                            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                                <button
                                    onClick={() => setActiveView('summary')}
                                    className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium transition-all"
                                >
                                    📊 Summary
                                </button>
                                <button
                                    onClick={() => setActiveView('chat')}
                                    className="px-6 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-all"
                                >
                                    💬 Chat
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                                <p className="text-lg text-gray-700 font-medium">Analyzing document...</p>
                                <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                            </div>
                        ) : summaries ? (
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* Short Summary */}
                                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow">
                                    <div className="flex items-center mb-4">
                                        <div className="bg-blue-100 p-2 rounded-lg mr-3">
                                            <span className="text-2xl">📋</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Quick Summary</h3>
                                    </div>
                                    <p className="text-gray-700 leading-relaxed">{summaries.short}</p>
                                </div>

                                {/* Detailed Summary */}
                                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
                                    <button
                                        onClick={() => setExpandedSummary(expandedSummary === 'detailed' ? null : 'detailed')}
                                        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <div className="bg-green-100 p-2 rounded-lg mr-3">
                                                <span className="text-2xl">📖</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900">Detailed Summary</h3>
                                        </div>
                                        {expandedSummary === 'detailed' ?
                                            <ChevronUp className="w-5 h-5 text-gray-500" /> :
                                            <ChevronDown className="w-5 h-5 text-gray-500" />
                                        }
                                    </button>
                                    {expandedSummary === 'detailed' && (
                                        <div className="px-6 pb-6">
                                            <p className="text-gray-700 leading-relaxed">{summaries.detailed}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Key Points */}
                                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow">
                                    <div className="flex items-center mb-4">
                                        <div className="bg-purple-100 p-2 rounded-lg mr-3">
                                            <span className="text-2xl">🎯</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Key Points</h3>
                                    </div>
                                    <ul className="space-y-3">
                                        {summaries.bullets.map((bullet, idx) => (
                                            <li key={idx} className="flex items-start group">
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-3 flex-shrink-0 mt-0.5 group-hover:bg-indigo-700 transition-colors">
                                                    {idx + 1}
                                                </span>
                                                <span className="text-gray-700 pt-1">{bullet}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Key Insights */}
                                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow">
                                    <div className="flex items-center mb-4">
                                        <div className="bg-yellow-100 p-2 rounded-lg mr-3">
                                            <span className="text-2xl">💡</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Key Insights</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {summaries.insights.map((insight, idx) => (
                                            <div key={idx} className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 p-4 rounded-r-lg hover:from-amber-100 hover:to-yellow-100 transition-colors">
                                                <p className="text-gray-800">{insight}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Keywords */}
                                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow">
                                    <div className="flex items-center mb-4">
                                        <div className="bg-pink-100 p-2 rounded-lg mr-3">
                                            <span className="text-2xl">🔑</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Important Keywords</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {summaries.keywords.map((keyword, idx) => (
                                            <span
                                                key={idx}
                                                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                                            >
                                                {keyword}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Chat View */}
                {activeView === 'chat' && (
                    <div className="animate-fadeIn">
                        <div className="flex justify-center mb-8">
                            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                                <button
                                    onClick={() => setActiveView('summary')}
                                    className="px-6 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-all"
                                >
                                    📊 Summary
                                </button>
                                <button
                                    onClick={() => setActiveView('chat')}
                                    className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium transition-all"
                                >
                                    💬 Chat
                                </button>
                            </div>
                        </div>

                        <div className="max-w-4xl mx-auto">
                            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col" style={{ height: '70vh', maxHeight: '600px', minHeight: '400px' }}>
                                {/* Chat Header */}
                                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center space-x-3">
                                    <MessageSquare className="w-6 h-6 text-white" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Chat with Your Document</h3>
                                        <p className="text-xs text-indigo-100">Ask any question about the content</p>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                                    {chatMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideIn`}
                                        >
                                            <div
                                                className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl shadow-sm ${msg.role === 'user'
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-white text-gray-900 border border-gray-200'
                                                    }`}
                                            >
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {chatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl shadow-sm">
                                                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Input */}
                                <div className="border-t border-gray-200 p-4 bg-white">
                                    <div className="flex space-x-3">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleChat();
                                                }
                                            }}
                                            placeholder="Type your question here..."
                                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                            disabled={chatLoading}
                                        />
                                        <button
                                            onClick={handleChat}
                                            disabled={chatLoading || !chatInput.trim()}
                                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-md hover:shadow-lg"
                                        >
                                            <Send className="w-5 h-5" />
                                            <span className="hidden sm:inline font-medium">Send</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
        </div>
    );
}
