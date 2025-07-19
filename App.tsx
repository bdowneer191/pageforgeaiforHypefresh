



import React, { useState, useCallback, useMemo, useEffect } from 'react';
import netlifyIdentity from 'netlify-identity-widget';
import Icon from './components/Icon.tsx';
import SetupGuide from './components/SetupGuide.tsx';
import SessionLog from './components/SessionLog.tsx';
import SessionTimer from './components/SessionTimer.tsx';
import { useCleaner } from './hooks/useCleaner.ts';
import { generateOptimizationPlan, generateComparisonAnalysis } from './services/geminiService.ts';
import { fetchPageSpeedReport } from './services/pageSpeedService.ts';
import { Recommendation, Session, ImpactSummary } from './types.ts';


const initialOptions = {
  stripComments: true,
  collapseWhitespace: true,
  minifyInlineCSSJS: true,
  removeEmptyAttributes: true,
  preserveIframes: true,
  preserveLinks: true,
  preserveShortcodes: true,
  lazyLoadEmbeds: true,
  lazyLoadImages: true,
  optimizeImages: true,
  convertToAvif: false, // Default to WebP, AVIF is opt-in
  addResponsiveSrcset: true,
  optimizeSvgs: true,
  semanticRewrite: false,
  optimizeCssLoading: false, // Default false, as it can be risky but powerful
  optimizeFontLoading: true,
  addPrefetchHints: true,
  deferScripts: true,
};

const Step = ({ number, title, children }) => (
    <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
        <h2 className="text-xl font-semibold mb-4 text-blue-300">
            <span className="bg-blue-500 text-gray-950 rounded-full h-8 w-8 inline-flex items-center justify-center font-bold mr-3">{number}</span>
            {title}
        </h2>
        <div className="pl-11">{children}</div>
    </div>
);

const ScoreCircle = ({ score, size = 60 }) => {
    const scoreValue = score ? Math.round(score * 100) : 0;
    const getScoreColor = (s) => {
        if (s >= 90) return { main: 'text-green-400', trail: 'text-green-900' };
        if (s >= 50) return { main: 'text-yellow-400', trail: 'text-yellow-900' };
        return { main: 'text-red-400', trail: 'text-red-900' };
    };
    const { main, trail } = getScoreColor(scoreValue);
    const radius = size / 2 - 4;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (scoreValue / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="absolute" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle className={`transform -rotate-90 origin-center ${trail}`} strokeWidth="4" stroke="currentColor" fill="transparent" r={radius} cx={size/2} cy={size/2} />
                <circle
                    className={`transform -rotate-90 origin-center transition-all duration-1000 ease-out ${main}`}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size/2}
                    cy={size/2}
                />
            </svg>
            <span className={`text-lg font-bold ${main}`}>{scoreValue}</span>
        </div>
    );
};

const PageSpeedScores = ({ report, comparisonReport = null }) => {
    if (!report) return null;
    
    const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
    const getCategoryName = (id) => id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const renderScores = (data, compareData = null) => {
      return categories.map(catId => {
        const category = data?.lighthouseResult.categories[catId];
        if (!category) return null;
        const compareCategory = compareData?.lighthouseResult.categories[catId];
        const scoreDiff = compareCategory ? Math.round(compareCategory.score * 100) - Math.round(category.score * 100) : null;
        
        return (
          <div key={catId} className="text-center p-2 bg-gray-850 rounded-lg flex flex-col items-center justify-start h-full">
            <p className="text-xs font-semibold text-gray-400 mb-2 h-8 flex items-center text-center justify-center">{getCategoryName(category.title)}</p>
            <div className="flex-grow flex items-center justify-center w-full">
                <div className="flex items-center justify-around w-full">
                    <div className="flex flex-col items-center">
                         <span className="text-xs text-gray-500 mb-1">{compareCategory ? 'Before' : 'Score'}</span>
                        <ScoreCircle score={category.score} size={50} />
                    </div>
                    {compareCategory && (
                        <>
                            <span className="text-gray-500 text-xl font-light">&rarr;</span>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">After</span>
                                <ScoreCircle score={compareCategory.score} size={50} />
                            </div>
                        </>
                    )}
                </div>
            </div>
            {compareCategory && scoreDiff !== null && (
              <div className="mt-2 text-center">
                  <span className={`text-base font-bold ${scoreDiff > 0 ? 'text-green-400' : scoreDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
                  </span>
                  <span className="text-xs text-gray-500"> points</span>
              </div>
            )}
            {!compareCategory && <div className="h-6 mt-2" />}
          </div>
        );
      });
    };

    return (
        <div className="mt-4 space-y-4">
            <div>
                <h3 className="font-semibold text-gray-300 mb-2">Mobile Scores {comparisonReport && <span className="text-sm font-normal text-gray-500">(Before vs. After)</span>}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {renderScores(report.mobile, comparisonReport?.mobile)}
                </div>
            </div>
            <div>
                <h3 className="font-semibold text-gray-300 mb-2">Desktop Scores {comparisonReport && <span className="text-sm font-normal text-gray-500">(Before vs. After)</span>}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {renderScores(report.desktop, comparisonReport?.desktop)}
                </div>
            </div>
        </div>
    );
};

const LoginScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 text-center">
      <div>
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 animate-glow">PageForge AI</h1>
        <p className="text-lg text-gray-300 mt-2 mb-8">Full Performance Analysis & Speed Boost</p>
        <button
          onClick={() => netlifyIdentity.open()}
          className="inline-flex items-center justify-center gap-3 py-3 px-6 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transform hover:scale-105"
        >
          <Icon name="github" className="w-6 h-6" />
          Login / Sign Up
        </button>
      </div>
    </div>
);

const CheckboxOption = ({ name, checked, onChange, label, description, isRecommended = false, isRisky = false, disabled = false }) => (
    <label className={`flex items-start space-x-3 p-2 rounded-md hover:bg-gray-800 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <input 
            type="checkbox" 
            name={name} 
            checked={checked} 
            onChange={onChange} 
            disabled={disabled}
            className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 mt-1"
        />
        <div>
            <span className="text-gray-300 text-sm">
                {label}
                {isRecommended && <span className="ml-2 text-xs text-green-400 font-medium">(Recommended)</span>}
                {isRisky && <span className="ml-2 text-xs text-yellow-400 font-medium">(Use with caution)</span>}
            </span>
            {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
    </label>
);


const App = () => {
  const [user, setUser] = useState(netlifyIdentity.currentUser());
  const [url, setUrl] = useState('');
  const [pageSpeedApiKey, setPageSpeedApiKey] = useState(() => localStorage.getItem('googlePageSpeedApiKey') || '');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
  
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [pageSpeedBefore, setPageSpeedBefore] = useState(null);
  const [pageSpeedAfter, setPageSpeedAfter] = useState(null);
  const [optimizationPlan, setOptimizationPlan] = useState<Recommendation[] | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [comparisonAnalysis, setComparisonAnalysis] = useState(null);
  const [apiError, setApiError] = useState('');
  const [sessionLoadError, setSessionLoadError] = useState('');

  const [originalHtml, setOriginalHtml] = useState('');
  const [cleanedHtml, setCleanedHtml] = useState('');
  const [options, setOptions] = useState(initialOptions);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const { isCleaning, cleanHtml } = useCleaner();
  const [aiAppliedNotification, setAiAppliedNotification] = useState('');
  
  const [currentSession, setCurrentSession] = useState<{ url: string; startTime: string; } | null>(null);
  const [sessionLog, setSessionLog] = useState<Session[]>([]);

  useEffect(() => {
    const handleLogin = (user) => {
        setUser(user);
        netlifyIdentity.close();
    };
    const handleLogout = () => {
        setUser(null);
        setSessionLog([]); // Clear session data on logout
    };

    netlifyIdentity.on('login', handleLogin);
    netlifyIdentity.on('logout', handleLogout);
    netlifyIdentity.init();

    return () => {
        netlifyIdentity.off('login', handleLogin);
        netlifyIdentity.off('logout', handleLogout);
    };
  }, []);

  useEffect(() => {
    if (!user) {
        setSessionLog([]);
        return;
    }

    const fetchSessionData = async () => {
        setSessionLoadError('');
        try {
            const token = await (user as any).jwt();
            const response = await fetch('/.netlify/functions/sessions', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to fetch session data.' }));
                throw new Error(errorData.message);
            }
            const data = await response.json();
            setSessionLog(data);
        } catch (error: any) {
            console.error("Failed to load session data:", error);
            setSessionLoadError(`Could not load history: ${error.message}`);
        }
    };

    fetchSessionData();
  }, [user]);
  
  useEffect(() => {
    localStorage.setItem('googlePageSpeedApiKey', pageSpeedApiKey);
  }, [pageSpeedApiKey]);
  
  useEffect(() => {
    localStorage.setItem('geminiApiKey', geminiApiKey);
  }, [geminiApiKey]);


  const handleMeasure = async () => {
    if (!url) { setApiError('Please enter a URL to measure.'); return; }
    if (!pageSpeedApiKey) { setApiError('Please enter your PageSpeed API Key to measure speed.'); return; }
    
    setIsMeasuring(true);
    setApiError('');
    setSessionLoadError('');

    if (!pageSpeedBefore) {
        setOptimizationPlan(null);
        setComparisonAnalysis(null);
        setPageSpeedAfter(null);
        setCurrentSession({ url, startTime: new Date().toISOString() });
        setOriginalHtml('');
        setCleanedHtml('');
        setImpact(null);
        setOptions(initialOptions);
    }
    
    try {
        const newReport = await fetchPageSpeedReport(pageSpeedApiKey, url);

        if (pageSpeedBefore) {
            setPageSpeedAfter(newReport);
            if(currentSession && user) {
                const endTime = new Date();
                const duration = (endTime.getTime() - new Date(currentSession.startTime).getTime()) / 1000;
                
                const getScore = (report, strategy) => report?.[strategy]?.lighthouseResult?.categories?.performance?.score ?? 0;

                const completedSession: Omit<Session, 'id'> = {
                    url: currentSession.url,
                    startTime: currentSession.startTime,
                    endTime: endTime.toISOString(),
                    duration,
                    beforeScores: {
                        mobile: getScore(pageSpeedBefore, 'mobile'),
                        desktop: getScore(pageSpeedBefore, 'desktop'),
                    },
                    afterScores: {
                        mobile: getScore(newReport, 'mobile'),
                        desktop: getScore(newReport, 'desktop'),
                    },
                    userId: user.id,
                    userEmail: user.email,
                };

                
                const token = await (user as any).jwt();
                const response = await fetch('/.netlify/functions/sessions', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}` 
                    },
                    body: JSON.stringify(completedSession)
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'The server returned an unexpected error. Check Netlify function logs for details.' }));
                    throw new Error(errorData.message ? `Could not save session: ${errorData.message}` : 'Could not save session due to a server error.');
                }

                const savedSession = await response.json();
                setSessionLog(prevLog => [savedSession, ...prevLog].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
                
                setCurrentSession(null);
                
                setIsGeneratingPlan(true);
                const analysis = await generateComparisonAnalysis(geminiApiKey, pageSpeedBefore, newReport);
                setComparisonAnalysis(analysis);
            }

        } else {
            setPageSpeedBefore(newReport);
            setIsGeneratingPlan(true);
            const plan = await generateOptimizationPlan(geminiApiKey, newReport);
            setOptimizationPlan(plan);
        }
    } catch (error: any) {
        console.error("Error during measurement process:", error);
        let message = error.message;
        if (message && message.includes('API has not been used')) {
            message = 'API Error: The PageSpeed Insights API has not been enabled for your key\'s project. Please follow the setup guide to fix this.';
        }
        setApiError(message);
        setCurrentSession(null);
    } finally {
        setIsMeasuring(false);
        setIsGeneratingPlan(false);
    }
  };

  const handleOptionChange = (e) => {
    const { name, checked } = e.target;
    setOptions(prev => ({ ...prev, [name]: checked }));
  };

  const handleClean = useCallback(async () => {
    if (!originalHtml || isCleaning) return;
    
    setApiError('');
    setCleanedHtml('');
    setImpact(null);

    const { cleanedHtml: resultHtml, summary, effectiveOptions } = await cleanHtml(originalHtml, options, optimizationPlan);
    
    setCleanedHtml(resultHtml);
    setImpact(summary);
    setOptions(effectiveOptions);

    if (summary.actionLog.some(log => log.includes('AI recommendation'))) {
        setAiAppliedNotification('AI recommendations have been automatically applied!');
        setTimeout(() => setAiAppliedNotification(''), 4000);
    }
  }, [originalHtml, options, cleanHtml, isCleaning, optimizationPlan]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(cleanedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const downloadHtml = () => {
      const blob = new Blob([cleanedHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cleaned-post.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };
  
  const formattedBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const impactMetrics = useMemo(() => ([
      { label: 'Bytes Saved', value: impact ? formattedBytes(impact.bytesSaved) : '-', color: 'text-green-400' },
      { label: 'Size Reduction', value: impact?.originalBytes ? `${((impact.bytesSaved / impact.originalBytes) * 100).toFixed(1)}%` : '-', color: 'text-green-400' },
      { label: 'Nodes Removed', value: impact?.nodesRemoved || '-', color: 'text-yellow-400' },
  ]), [impact]);

  const isCleaningLocked = !pageSpeedBefore;

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen text-white bg-gray-950 p-4 sm:p-6 lg:p-8 font-sans flex flex-col">
      <div className="max-w-7xl mx-auto w-full">
        <header className="mb-8 relative">
          <div className="text-center">
             <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">PageForge AI</h1>
            <p className="text-lg text-gray-300 mt-2">Full Performance Analysis & Speed Boost</p>
            <p className="text-gray-400 mt-1">Prod by <span className="font-semibold text-teal-300">Nion</span></p>
          </div>
          <div className="absolute top-0 right-0 flex items-center gap-3 p-2 bg-gray-900/80 border border-gray-800 rounded-full">
            <img src={user.user_metadata?.avatar_url} alt={user.user_metadata?.full_name || user.email} className="w-8 h-8 rounded-full" />
            <span className="text-sm font-medium text-gray-300 hidden sm:inline">{user.user_metadata?.full_name || user.email}</span>
            <button 
                onClick={() => netlifyIdentity.logout()} 
                className="text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-red-500/50 rounded-full px-3 py-1 transition-colors duration-200"
                title="Logout"
            >
                Logout
            </button>
            </div>
        </header>
        
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col gap-6">
            <div className="mb-2">
              <SetupGuide />
            </div>
            <div className="mb-2">
              <SessionLog sessions={sessionLog} setSessions={setSessionLog} user={user} />
              {sessionLoadError && <p className="mt-2 text-sm text-red-400 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">{sessionLoadError}</p>}
            </div>
            <Step number="1" title="Measure Your Page Speed">
                {currentSession && <SessionTimer startTime={currentSession.startTime} />}
                <p className="text-sm text-gray-400 mb-3">Enter the full URL of your blog post to get a baseline performance report.</p>
                 <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium text-gray-400 mb-1 block">Gemini API Key</label>
                        <input
                            type="password"
                            value={geminiApiKey}
                            onChange={e => setGeminiApiKey(e.target.value)}
                            placeholder="Enter your Gemini API Key for AI features"
                            className="w-full p-3 pl-4 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-mono transition-colors"
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                       <label className="text-sm font-medium text-gray-400 mb-1 block">PageSpeed API Key</label>
                        <input
                            type="password"
                            value={pageSpeedApiKey}
                            onChange={e => setPageSpeedApiKey(e.target.value)}
                            placeholder="Enter your PageSpeed API Key"
                            className="w-full p-3 pl-4 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-mono transition-colors"
                            autoComplete="new-password"
                        />
                    </div>
                    <div className="flex gap-2">
                        <input type="url" value={url} onChange={e => { setUrl(e.target.value); setPageSpeedBefore(null); }} placeholder="https://your-website.com/your-post" className="flex-grow p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-mono transition-colors"/>
                        <button onClick={handleMeasure} disabled={isMeasuring || !url || !pageSpeedApiKey} className="flex items-center justify-center gap-2 w-48 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-all duration-200">
                          {isMeasuring ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Icon name="magic" className="w-5 h-5" />}
                          {pageSpeedBefore ? 'Compare Speed' : 'Measure Speed'}
                        </button>
                    </div>
                </div>
                {apiError && <p className="mt-2 text-sm text-red-400 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">{apiError}</p>}
                {isMeasuring && <p className="text-sm text-center text-gray-400 mt-4">Measuring page speed... this can take up to a minute.</p>}
                <PageSpeedScores report={pageSpeedBefore} comparisonReport={pageSpeedAfter} />
            </Step>

            {(optimizationPlan || comparisonAnalysis || isGeneratingPlan) && (
                <Step number="2" title={comparisonAnalysis ? "Comparison Analysis" : "AI Optimization Plan"}>
                   {isGeneratingPlan && <p className="text-sm text-center text-gray-400">Generating AI analysis...</p>}
                    {optimizationPlan && !comparisonAnalysis && (
                         <div className="space-y-3">
                            {optimizationPlan.map((item, i) => (
                                <div key={i} className="p-3 bg-gray-850 rounded-lg">
                                    <h3 className="font-semibold text-gray-300 flex items-center gap-2">{item.title} <span className={`text-xs px-2 py-0.5 rounded-full ${item.priority === 'High' ? 'bg-red-500' : item.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`}>{item.priority}</span></h3>
                                    <p className="text-sm text-gray-400">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {comparisonAnalysis && (
                        <div className="space-y-4">
                            <div>
                               <h3 className="font-semibold text-gray-300 mb-1">Summary</h3>
                               <p className="text-sm text-gray-400 p-3 bg-gray-850 rounded-lg">{comparisonAnalysis.summary}</p>
                            </div>
                            <div>
                               <h3 className="font-semibold text-green-400 mb-1">Improvements</h3>
                               <ul className="list-disc list-inside text-sm text-gray-400 space-y-1 p-3 bg-gray-850 rounded-lg">
                                  {comparisonAnalysis.improvements.map((item,i) => <li key={i}>{item}</li>)}
                               </ul>
                            </div>
                            {comparisonAnalysis.regressions?.length > 0 && (
                                <div>
                                   <h3 className="font-semibold text-yellow-400 mb-1">Regressions</h3>
                                   <ul className="list-disc list-inside text-sm text-gray-400 space-y-1 p-3 bg-gray-850 rounded-lg">
                                      {comparisonAnalysis.regressions.map((item,i) => <li key={i}>{item}</li>)}
                                   </ul>
                                </div>
                            )}
                            <div>
                               <h3 className="font-semibold text-teal-300 mb-1">Final Recommendations</h3>
                               <div className="space-y-2">
                                  {comparisonAnalysis.finalRecommendations.map((rec,i) => <div key={i} className="p-3 bg-gray-850 rounded-lg"><h4 className="font-semibold text-gray-300">{rec.title}</h4><p className="text-sm text-gray-400">{rec.description}</p></div>)}
                               </div>
                            </div>
                        </div>
                    )}
                </Step>
            )}
          </div>

          <div className="relative">
             {isCleaningLocked && (
                <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl border border-gray-800">
                    <Icon name="lock" className="w-12 h-12 text-yellow-400" />
                    <p className="mt-4 font-semibold text-lg text-gray-300">Complete Step 1 to Unlock</p>
                    <p className="text-gray-400">Measure your page speed to activate optimization.</p>
                </div>
            )}
            <div className={`flex flex-col gap-6 ${isCleaningLocked ? 'opacity-40 pointer-events-none' : ''}`}>
                <Step number="3" title="Clean Your Post HTML">
                    <p className="text-sm text-gray-400 mb-3">Paste your post's HTML (from the 'Text' or 'Code' editor) below to apply automated cleaning and optimizations.</p>
                    <textarea value={originalHtml} onChange={(e) => setOriginalHtml(e.target.value)} placeholder="Paste the full 'Text' view code of your WP post here..." className="w-full h-48 p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-mono transition-colors"/>
                    
                    {aiAppliedNotification && (
                        <div className="mt-3 text-sm text-center p-2 bg-green-900/50 border border-green-800 text-green-300 rounded-lg transition-opacity duration-300">
                            {aiAppliedNotification}
                        </div>
                    )}

                    <div className="mt-4 space-y-3">
                        <h4 className="font-semibold text-gray-400 text-sm">Basic Cleanup</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                            <CheckboxOption name="stripComments" label="Strip HTML Comments" checked={options.stripComments} onChange={handleOptionChange} description="Removes <!-- comments -->."/>
                            <CheckboxOption name="collapseWhitespace" label="Collapse Whitespace" checked={options.collapseWhitespace} onChange={handleOptionChange} description="Removes extra spaces."/>
                            <CheckboxOption name="minifyInlineCSSJS" label="Minify Inline CSS/JS" checked={options.minifyInlineCSSJS} onChange={handleOptionChange} description="Minifies code in <style>, <script>."/>
                            <CheckboxOption name="removeEmptyAttributes" label="Remove Empty Attributes" checked={options.removeEmptyAttributes} onChange={handleOptionChange} description="Removes attributes with no value."/>
                        </div>

                        <h4 className="font-semibold text-gray-400 text-sm pt-2">Preservation</h4>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                            <CheckboxOption name="preserveIframes" label="Preserve iFrames" checked={options.preserveIframes} onChange={handleOptionChange} description="Keeps all <iframe> tags untouched."/>
                            <CheckboxOption name="preserveLinks" label="Preserve Links" checked={options.preserveLinks} onChange={handleOptionChange} description="Keeps all <a> tags untouched."/>
                            <CheckboxOption name="preserveShortcodes" label="Preserve Shortcodes" checked={options.preserveShortcodes} onChange={handleOptionChange} description="Keeps WordPress [shortcodes] safe."/>
                        </div>

                        <h4 className="font-semibold text-green-300 text-sm pt-2">Performance Optimizations</h4>
                         <div className="space-y-1">
                            <CheckboxOption name="lazyLoadImages" label="Lazy Load Images" checked={options.lazyLoadImages} onChange={handleOptionChange} isRecommended description="Loads images on scroll. First image is loaded eagerly for LCP."/>
                            <CheckboxOption name="lazyLoadEmbeds" label="Lazy Load Embeds" checked={options.lazyLoadEmbeds} onChange={handleOptionChange} isRecommended description="Replaces YouTube, etc., with facades that load on click."/>
                            <CheckboxOption name="optimizeFontLoading" label="Optimize Font Loading" checked={options.optimizeFontLoading} onChange={handleOptionChange} isRecommended description="Adds 'display=swap' to Google Fonts to prevent invisible text."/>
                            <CheckboxOption name="addPrefetchHints" label="Add Preconnect Hints" checked={options.addPrefetchHints} onChange={handleOptionChange} isRecommended description="Speeds up connection to domains like Google Fonts."/>
                            <CheckboxOption name="deferScripts" label="Defer Non-Essential JavaScript" checked={options.deferScripts} onChange={handleOptionChange} isRecommended description="Prevents JavaScript from blocking page rendering."/>
                            <CheckboxOption name="optimizeCssLoading" label="Optimize CSS Delivery" checked={options.optimizeCssLoading} onChange={handleOptionChange} isRisky description="Defers non-critical CSS. May cause Flash of Unstyled Content."/>
                            
                            <h5 className="font-semibold text-teal-300 text-sm pt-3">Advanced Image Optimizations</h5>
                            <CheckboxOption 
                                name="optimizeImages" 
                                label="Convert Images to Next-Gen Formats" 
                                checked={options.optimizeImages} 
                                onChange={handleOptionChange} 
                                isRecommended 
                                description="Converts images to WebP or AVIF on supported CDNs (e.g., Jetpack, Cloudinary)."
                            />
                            <CheckboxOption 
                                name="convertToAvif" 
                                label="Prefer AVIF over WebP" 
                                checked={options.convertToAvif} 
                                onChange={handleOptionChange}
                                disabled={!options.optimizeImages}
                                description="AVIF offers superior compression but has slightly less browser support."
                            />
                            <CheckboxOption 
                                name="addResponsiveSrcset" 
                                label="Generate Responsive Srcset" 
                                checked={options.addResponsiveSrcset} 
                                onChange={handleOptionChange} 
                                isRecommended 
                                description="Adds srcset and sizes attributes to prevent loading oversized images on small screens."
                            />
                             <CheckboxOption 
                                name="optimizeSvgs" 
                                label="Minify Inline SVGs" 
                                checked={options.optimizeSvgs} 
                                onChange={handleOptionChange} 
                                description="Removes unnecessary data and comments from inline SVG code."
                            />
                        </div>
                        
                        <h4 className="font-semibold text-yellow-300 text-sm pt-2">Advanced (AI)</h4>
                         <div className="space-y-1">
                            <CheckboxOption 
                                name="semanticRewrite" 
                                label="HTML5 Semantic Rewrite" 
                                checked={options.semanticRewrite} 
                                onChange={handleOptionChange} 
                                description="Rewrites old <b>/<i> tags to modern <strong>/<em>. Does not require an API key."
                            />
                        </div>
                    </div>


                    <button onClick={handleClean} disabled={!originalHtml || isCleaning} className="w-full mt-6 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-all duration-200">
                      {isCleaning ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Icon name="magic" className="w-5 h-5" />}
                      Clean & Optimize
                    </button>
                </Step>
                
                {cleanedHtml && impact && (
                    <Step number="4" title="Get Cleaned Code & Compare">
                        <p className="text-sm text-gray-400 mb-3">Your cleaned HTML is ready. Copy it and replace the code in your post editor. Then, click "Compare Speed" in Step 1 to see the results.</p>
                        <div className="relative">
                            <textarea readOnly value={cleanedHtml} className="w-full h-48 p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm font-mono transition-colors" />
                            <div className="absolute top-2 right-2 flex gap-2">
                                <button onClick={copyToClipboard} title="Copy to Clipboard" className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                                    <Icon name={copied ? 'clipboard' : 'clipboard'} className="w-5 h-5" />
                                 </button>
                                <button onClick={downloadHtml} title="Download HTML File" className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                                    <Icon name="download" className="w-5 h-5" />
                                </button>
                            </div>
                            {copied && <span className="absolute top-12 right-2 text-xs bg-green-500 text-white px-2 py-1 rounded">Copied!</span>}
                        </div>
                        
                        <h3 className="font-semibold mt-4 mb-2 text-green-300">Optimization Impact</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-gray-850 rounded-lg">
                            {impactMetrics.map(metric => (
                                <div key={metric.label} className="text-center">
                                    <p className="text-xs text-gray-400">{metric.label}</p>
                                    <p className={`text-xl font-bold ${metric.color}`}>{metric.value}</p>
                                </div>
                            ))}
                        </div>
                        {impact.actionLog && impact.actionLog.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold text-gray-400 text-sm">Actions Performed:</h4>
                                <ul className="list-disc list-inside text-sm text-gray-400 space-y-1 mt-2 p-3 bg-gray-850 rounded-lg">
                                    {impact.actionLog.map((log, i) => <li key={i}>{log}</li>)}
                                </ul>
                            </div>
                        )}
                    </Step>
                )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
