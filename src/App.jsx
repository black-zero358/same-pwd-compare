import React, { useState, useMemo, useRef } from 'react';
import { Upload, Search, ShieldCheck, AlertCircle, Key, User, Globe, Folder, FileText, Eye, EyeOff, Layers, CheckCircle } from 'lucide-react';

// 健壮的本地 CSV 解析器
// 能够正确处理字段内包含逗号、换行符以及双引号转义的情况
function parseCSV(text) {
  const result = [];
  let row = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        // 处理转义的双引号 ""
        currentValue += '"';
        i++;
      } else {
        // 切换引号状态
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // 字段结束
      row.push(currentValue);
      currentValue = '';
    } else if (char === '\n' && !inQuotes) {
      // 行结束
      row.push(currentValue);
      result.push(row);
      row = [];
      currentValue = '';
    } else if (char === '\r' && !inQuotes) {
      // 忽略 \r，如果是 \r\n 则在下一个 \n 处理，否则按行结束处理
      if (text[i + 1] !== '\n') {
        row.push(currentValue);
        result.push(row);
        row = [];
        currentValue = '';
      }
    } else {
      currentValue += char;
    }
  }

  // 添加最后剩余的数据
  if (currentValue !== '' || text[text.length - 1] === ',') {
    row.push(currentValue);
  }
  if (row.length > 0) {
    result.push(row);
  }

  return result;
}

export default function App() {
  const [data, setData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [searchPassword, setSearchPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // 处理文件上传
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    handleFileFromObject(file);
  };

  // 触发隐藏的文件输入框
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // 使用 useMemo 缓存匹配结果，提高性能
  const matchedEntries = useMemo(() => {
    if (!searchPassword || data.length === 0) return [];
    
    // 完全匹配密码
    return data.filter((item) => item.login_password === searchPassword);
  }, [data, searchPassword]);

  // 新增：缓存重用密码分析结果
  const reusedPasswords = useMemo(() => {
    if (data.length === 0) return [];
    
    const groups = {};
    data.forEach((item) => {
      const pwd = item.login_password;
      // 忽略空密码
      if (!pwd || pwd.trim() === '') return; 
      
      if (!groups[pwd]) {
        groups[pwd] = [];
      }
      groups[pwd].push(item);
    });

    // 筛选出使用次数大于 1 的密码，并按使用次数降序排列
    return Object.entries(groups)
      .filter(([_, entries]) => entries.length > 1)
      .map(([pwd, entries]) => ({ password: pwd, count: entries.length, entries }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  // 标签页状态与可见密码状态
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'analyze'
  const [visibleReused, setVisibleReused] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);

  // 切换单个重用密码的明暗文显示
  const toggleVisibleReused = (pwd) => {
    setVisibleReused(prev => {
      const next = new Set(prev);
      if (next.has(pwd)) next.delete(pwd);
      else next.add(pwd);
      return next;
    });
  };

  // 全部显示 / 全部隐藏重用密码
  const allReusedVisible = reusedPasswords.length > 0 && reusedPasswords.every(g => visibleReused.has(g.password));
  const toggleAllReusedVisible = () => {
    if (allReusedVisible) {
      setVisibleReused(new Set());
    } else {
      setVisibleReused(new Set(reusedPasswords.map(g => g.password)));
    }
  };

  // 拖拽上传处理
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    handleFileFromObject(file);
  };

  // 抽取文件处理逻辑，供上传和拖拽共用
  const handleFileFromObject = (file) => {
    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedRows = parseCSV(text);

        if (parsedRows.length < 2) {
          throw new Error('CSV 文件似乎为空或格式不正确。');
        }

        const headers = parsedRows[0].map((h) => h.trim().toLowerCase());

        if (!headers.includes('login_password')) {
          throw new Error('未找到名为 "login_password" 的列。请确保上传的是正确的导出文件。');
        }

        const jsonData = parsedRows.slice(1).map((row) => {
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = row[index] || '';
          });
          return rowData;
        });

        const validData = jsonData.filter(item =>
          Object.values(item).some(val => val.trim() !== '')
        );

        setData(validData);
      } catch (err) {
        setError(err.message);
        setData([]);
      }
    };

    reader.onerror = () => {
      setError('读取文件时出错。');
    };

    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* 头部标题区 */}
        <header className="text-center space-y-2 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center justify-center gap-3">
            <Key className="w-8 h-8 text-indigo-600" />
            密码同源匹配工具
          </h1>
          <p className="text-gray-500">上传您的密码库 CSV 导出文件，精确查找使用了相同密码的所有账号</p>
        </header>

        {/* 隐私与安全声明 */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800">
            <p className="font-semibold text-emerald-900">完全本地处理，保障隐私安全</p>
            <p>您的 CSV 文件和输入内容仅在您当前的浏览器内存中进行处理。没有任何数据会被上传、记录或发送到网络。您甚至可以断开网络连接使用此工具。</p>
          </div>
        </div>

        {/* 主操作区（分栏或单栏排列） */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-6 md:p-8 space-y-8">
            
            {/* 步骤 1: 上传文件 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-800 w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                上传密码库 (CSV)
              </h2>
              
              <div 
                onClick={triggerFileInput}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3 transition-colors ${
                  isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-500 hover:bg-indigo-50'
                }`}
              >
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                {fileName ? (
                  <>
                    <FileText className="w-10 h-10 text-indigo-600" />
                    <p className="text-indigo-900 font-medium">已加载: {fileName}</p>
                    <p className="text-sm text-gray-500">共读取到 {data.length} 条有效记录。点击或拖拽重新上传。</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-400" />
                    <p className="text-gray-700 font-medium">点击或拖拽 CSV 文件到此处</p>
                    <p className="text-sm text-amber-600 font-medium">目前仅支持 BitWarden CSV 导出格式文件</p>
                  </>
                )}
              </div>

              {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* 步骤 2: 查找与分析 */}
          <div className={`space-y-4 ${data.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${data.length > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'}`}>2</span>
                {activeTab === 'search' ? '输入要匹配的密码' : '密码重用情况'}
              </h2>
              
              {data.length > 0 && (
                <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                  <button 
                    onClick={() => setActiveTab('search')} 
                    className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors ${activeTab === 'search' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Search className="w-4 h-4" /> 搜索特定密码
                  </button>
                  <button 
                    onClick={() => setActiveTab('analyze')} 
                    className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors ${activeTab === 'analyze' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Layers className="w-4 h-4" /> 自动分析重用
                  </button>
                </div>
              )}
            </div>
            
            {activeTab === 'search' && (
              <div className="relative max-w-lg animate-in fade-in duration-300">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm outline-none transition-shadow"
                  placeholder="输入密码以寻找完全匹配的条目..."
                  value={searchPassword}
                  onChange={(e) => setSearchPassword(e.target.value)}
                  disabled={data.length === 0}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            )}

            {activeTab === 'analyze' && (
              <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-xl flex items-start gap-3 border border-blue-100 animate-in fade-in duration-300">
                 <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                 <div className="flex-1">
                   <p className="font-medium text-blue-900 mb-1">自动分析结果</p>
                   <p>已扫描您的整个密码库，找出所有被多次使用的相同密码。共发现 <strong className="text-blue-700">{reusedPasswords.length}</strong> 组重用密码。</p>
                 </div>
                 {reusedPasswords.length > 0 && (
                   <button
                     onClick={toggleAllReusedVisible}
                     className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors flex-shrink-0"
                     title={allReusedVisible ? '隐藏所有密码' : '显示所有密码'}
                   >
                     {allReusedVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                     {allReusedVisible ? '隐藏全部' : '显示全部'}
                   </button>
                 )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 匹配结果展示区 */}
      {activeTab === 'search' && searchPassword && data.length > 0 && (
        <div className="space-y-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-gray-800">
              匹配结果 <span className="text-indigo-600 ml-2 bg-indigo-100 px-3 py-1 rounded-full text-sm">{matchedEntries.length} 条</span>
            </h3>
            
            {matchedEntries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchedEntries.map((item, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-gray-900 truncate pr-2" title={item.name || '未命名条目'}>
                        {item.name || '未命名条目'}
                      </h4>
                      {item.folder && (
                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md max-w-[100px] truncate" title={item.folder}>
                          <Folder className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{item.folder}</span>
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      {item.login_username && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate" title={item.login_username}>{item.login_username}</span>
                        </div>
                      )}
                      
                      {item.login_uri && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <a 
                            href={item.login_uri.startsWith('http') ? item.login_uri : `https://${item.login_uri}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline truncate"
                            title={item.login_uri}
                          >
                            {item.login_uri}
                          </a>
                        </div>
                      )}

                      {(!item.login_username && !item.login_uri) && (
                        <p className="text-gray-400 italic">无用户名或网址信息</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>在当前密码库中，未找到使用该密码的条目。</p>
            </div>
          )}
        </div>
      )}

      {/* 自动分析重用结果展示区 */}
      {activeTab === 'analyze' && data.length > 0 && (
        <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {reusedPasswords.length > 0 ? (
            <div className="space-y-5">
              {reusedPasswords.map((group, groupIdx) => (
                <div key={groupIdx} className="bg-white border border-rose-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-rose-50 border-b border-rose-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-rose-100 text-rose-700 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                        {group.count}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-800 font-medium text-lg">
                            {visibleReused.has(group.password) ? group.password : '••••••••••••'}
                          </span>
                          <button 
                            onClick={() => toggleVisibleReused(group.password)} 
                            className="text-gray-500 hover:text-indigo-600 transition-colors p-1"
                            title={visibleReused.has(group.password) ? "隐藏密码" : "显示密码"}
                          >
                            {visibleReused.has(group.password) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-sm text-rose-600 mt-0.5">该密码在以下 {group.count} 个条目中被重复使用</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.entries.map((item, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-indigo-300 transition-colors">
                          <h4 className="font-bold text-gray-900 truncate mb-2 text-sm" title={item.name || '未命名条目'}>
                            {item.name || '未命名条目'}
                          </h4>
                          <div className="space-y-1.5 text-xs text-gray-600">
                            {item.login_username && (
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="truncate" title={item.login_username}>{item.login_username}</span>
                              </div>
                            )}
                            {item.login_uri && (
                              <div className="flex items-center gap-2">
                                <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="truncate" title={item.login_uri}>{item.login_uri}</span>
                              </div>
                            )}
                            {item.folder && (
                              <div className="flex items-center gap-2">
                                <Folder className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="truncate" title={item.folder}>{item.folder}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-emerald-200 rounded-xl p-10 text-center shadow-sm">
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-emerald-800 mb-2">太棒了！密码习惯非常健康</h3>
              <p className="text-emerald-600">在您的密码库中，没有发现任何被重复使用的密码。请继续保持！</p>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
}
