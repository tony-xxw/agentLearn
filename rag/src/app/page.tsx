"use client";

import React, { useState, useRef } from "react";
import { 
  Bot, 
  Upload, 
  Database, 
  Trash2, 
  Send, 
  FileText, 
  X,
  Loader2
} from "lucide-react";

export default function Home() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [inputValue, setInputValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // Knowledge base modal state
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [documents, setDocuments] = useState<Array<any>>([]);
  const [totalDocs, setTotalDocs] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const quickTags = [
    "推荐一款降噪耳机",
    "人体工学椅 V2 多少钱？",
    "七天无理由退货的条件是什么？",
    "数码产品保修期多久？"
  ];

  // 1. 上传文件逻辑
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        alert(`文件上传成功！处理了 ${data.chunks} 个文本块。`);
      } else {
        alert(`上传失败: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("上传请求发生错误");
    } finally {
      setIsUploading(false);
      // 清空 input，允许重复上传同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 2. 查看知识库逻辑
  const handleViewKnowledgeBase = async () => {
    setShowDocsModal(true);
    setIsLoadingDocs(true);
    try {
      const res = await fetch("/api/documents?page=1&pageSize=50");
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
        setTotalDocs(data.total || 0);
      } else {
        alert(`获取文档失败: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("获取文档请求发生错误");
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // 3. 重置知识库逻辑
  const handleResetKnowledgeBase = async () => {
    if (!confirm("确定要重置并清空知识库吗？此操作不可恢复。")) return;

    setIsResetting(true);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert("知识库已成功重置。");
        setDocuments([]);
        setTotalDocs(0);
      } else {
        alert(`重置失败: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("重置请求发生错误");
    } finally {
      setIsResetting(false);
    }
  };

  // 4. 发送消息逻辑 (UI mock)
  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    setMessages([...messages, { role: "user", content: inputValue }]);
    setInputValue("");
    
    // TODO: 调用 /api/chat 接口
    // 暂时模拟回复
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "这是一个模拟回复。后续可以接入真实的 /api/chat 接口进行 RAG 对话。" 
      }]);
    }, 1000);
  };

  const handleTagClick = (tag: string) => {
    setInputValue(tag);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-2 shrink-0">
        <Bot className="text-blue-600" size={24} />
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">睿智商城智能客服</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 max-w-[1400px] mx-auto w-full h-[calc(100vh-73px)]">
        
        {/* Left Sidebar */}
        <aside className="w-full md:w-80 flex flex-col gap-6 shrink-0">
          
          {/* Upload Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Upload size={18} className="text-slate-500" /> 
              Upload Profile
            </h2>
            
            <div className="relative">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                disabled={isUploading}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2.5 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100 cursor-pointer disabled:opacity-50" 
              />
              {isUploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                  <Loader2 className="animate-spin text-blue-500" size={20} />
                </div>
              )}
            </div>

            <button 
              onClick={handleViewKnowledgeBase}
              className="w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-700 py-2.5 rounded-xl hover:bg-slate-100 transition font-medium text-sm border border-slate-200"
            >
              <Database size={16} className="text-slate-500" /> 
              View Knowledge Base
            </button>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
            <h2 className="font-bold text-red-500 flex items-center gap-2">
              <Trash2 size={18} /> 
              Danger Zone
            </h2>
            
            <button 
              onClick={handleResetKnowledgeBase}
              disabled={isResetting}
              className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2.5 rounded-xl hover:bg-red-100 transition font-medium text-sm disabled:opacity-50"
            >
              {isResetting ? <Loader2 className="animate-spin" size={16} /> : null}
              Reset Knowledge Base
            </button>
          </div>
        </aside>

        {/* Chat Area */}
        <section className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                <FileText size={48} className="mb-6 text-slate-200" strokeWidth={1.5} />
                <p className="text-lg mb-2 font-medium flex items-center gap-2">
                  👋 您好，我是睿智商城的智能客服。请问有什么可以帮您？
                </p>
                <p className="text-sm text-slate-400">您可以问我：这款耳机有降噪吗？怎么退货？</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                      msg.role === 'user' 
                        ? 'bg-blue-500 text-white rounded-tr-sm' 
                        : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            {/* Tags */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              {quickTags.map(tag => (
                <button 
                  key={tag} 
                  onClick={() => handleTagClick(tag)}
                  className="whitespace-nowrap px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-600 hover:bg-slate-100 transition"
                >
                  {tag}
                </button>
              ))}
            </div>
            
            {/* Input Box */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-white border border-slate-300 rounded-full pl-6 pr-2 py-2 focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-400 transition-all">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question about the AI Shop..." 
                className="flex-1 outline-none bg-transparent text-slate-700 placeholder:text-slate-400" 
              />
              <button 
                type="submit"
                disabled={!inputValue.trim()}
                className="bg-blue-500 text-white p-2.5 rounded-full hover:bg-blue-600 transition disabled:opacity-50 disabled:hover:bg-blue-500"
              >
                <Send size={18} className="ml-0.5" />
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Documents Modal */}
      {showDocsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Database size={18} className="text-slate-500"/>
                知识库文档 ({totalDocs})
              </h3>
              <button onClick={() => setShowDocsModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingDocs ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center text-slate-500 py-10">
                  知识库中暂无文档。
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {documents.map((doc, idx) => (
                    <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-slate-800 line-clamp-1">{doc.filename || "Unknown"}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : ""}
                        </p>
                      </div>
                      <div className="text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full shrink-0">
                        {doc.chunks || 0} 块
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
