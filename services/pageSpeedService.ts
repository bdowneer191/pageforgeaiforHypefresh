

const runPageSpeedForStrategy = async (apiKey: string, pageUrl: string, strategy: 'mobile' | 'desktop') => {
  if (!apiKey) {
      throw new Error("Google API Key has not been provided. Please add it in the configuration section.");
  }
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(pageUrl)}&key=${apiKey}&strategy=${strategy}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`;
  
  const response = await fetch(apiUrl);
  if (!response.ok) {
      const errorData = await response.json();
      const message = errorData?.error?.message || `Failed to fetch PageSpeed data for ${strategy}. Status: ${response.status}. Please check your URL and API Key.`;
      throw new Error(message);
  }
  return response.json();
};

export const fetchPageSpeedReport = async (apiKey: string, url: string) => {
    try {
        const [mobile, desktop] = await Promise.all([
            runPageSpeedForStrategy(apiKey, url, 'mobile'),
            runPageSpeedForStrategy(apiKey, url, 'desktop')
        ]);
        return { mobile, desktop };
    } catch (error) {
        console.error("Error fetching PageSpeed report:", error);
        // Re-throw the error so the component's UI can handle it
        throw error;
    }
};