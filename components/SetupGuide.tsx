
import React, { useState } from 'react';
import Icon from './Icon.tsx';

const SetupGuide = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-800">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 text-lg font-semibold text-left text-yellow-300"
                aria-expanded={isOpen}
                aria-controls="setup-guide-content"
            >
                <span>Setup Guide & API Keys</span>
                <Icon name="chevronDown" className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
                id="setup-guide-content"
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px]' : 'max-h-0'}`}
            >
                <div className="p-6 border-t border-gray-800 text-gray-400 text-sm space-y-6">
                    <div>
                        <h4 className="font-semibold text-gray-300 text-base mb-2">How It Works</h4>
                        <p className="mb-3">
                            This tool uses Google's services to analyze your site and AI to provide recommendations. You'll need API keys for these services. The app also requires a Netlify Access Token to securely save your session history to your Netlify user profile.
                        </p>
                        
                        <h5 className="font-semibold text-red-400 mt-4">Required: Netlify Personal Access Token (For Saving History)</h5>
                        <p className="mb-2 text-xs text-red-300/80">This token is required for the app to save and load your session history. It acts as a password, allowing the app to securely access your user data on Netlify.</p>
                        <ol className="list-decimal list-inside space-y-2 mt-1">
                            <li>Go to your Netlify <a href="https://app.netlify.com/user/applications" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">User Settings {'>'} Applications</a> page.</li>
                            <li>Under "Personal access tokens", click "New access token".</li>
                            <li>Give it a description (e.g., "PageForge AI Key") and click "Generate token". Copy the token.</li>
                            <li>Go to your <strong className="text-yellow-300">Netlify Site's Deploy settings</strong>: <code className="text-xs p-1 bg-gray-700 rounded">Site configuration {'>'} Build & deploy {'>'} Environment variables</code>.</li>
                            <li>Click "Add a variable", set the Key to <code className="text-xs p-1 bg-gray-700 rounded">NETLIFY_ACCESS_TOKEN</code>, paste your token in the Value field, and save.</li>
                        </ol>

                        <h5 className="font-semibold text-gray-300 mt-6">PageSpeed Insights API Key</h5>
                        <ol className="list-decimal list-inside space-y-2 mt-1">
                            <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Cloud Credentials page</a>.</li>
                            <li>Click "+ CREATE CREDENTIALS" at the top and select "API key". Copy the new key.</li>
                            <li><strong className="text-yellow-300">Important:</strong> You must enable the API. Visit the <a href="https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">PageSpeed Insights API Library</a> and click "Enable".</li>
                            <li>Paste the key into the app's "PageSpeed API Key" field.</li>
                        </ol>

                        <h5 className="font-semibold text-gray-300 mt-4">Gemini API Key (Optional)</h5>
                        <ol className="list-decimal list-inside space-y-2 mt-1">
                            <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.</li>
                            <li>Click "Create API key" and copy the generated key.</li>
                            <li>Paste the key into the app's "Gemini API Key" field for AI features.</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupGuide;
