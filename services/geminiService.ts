

import { GoogleGenAI, Type } from "@google/genai";

export const generateOptimizationPlan = async (apiKey: string, pageSpeedReport: any) => {
  if (!apiKey) {
    return [{ title: 'Missing API Key', description: 'Please provide a Gemini API key to generate an AI optimization plan.', priority: 'High' }];
  }
  const ai = new GoogleGenAI({ apiKey });

  const relevantData = {
      categories: pageSpeedReport.mobile.lighthouseResult.categories,
      audits: pageSpeedReport.mobile.lighthouseResult.audits,
  };

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a world-class web performance engineer specializing in WordPress and Core Web Vitals. Analyze this mobile PageSpeed Insights report. Create an extremely aggressive, high-impact, prioritized plan. Assume the user is willing to make significant changes for maximum speed. Focus on surgically eliminating render-blocking resources, optimizing the Critical Rendering Path, and crushing LCP, FID, and CLS scores. Be very specific (e.g., 'Use Perfmatters or a code snippet to disable these specific scripts on these pages,' 'Generate Critical CSS for your homepage and inline it, then load the main stylesheet asynchronously'). The goal is a perfect or near-perfect score. Provide a JSON array of objects with "title", "description", and "priority" ('High', 'Medium', 'Low'). Report: ${JSON.stringify(relevantData)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING }
              },
              required: ['title', 'description', 'priority']
            }
          }
        }
    });
    
    return JSON.parse(response.text.trim());

  } catch (error) {
    console.error("Error generating optimization plan:", error);
    return [{ title: 'Error', description: 'Failed to generate an AI optimization plan. The AI service may be temporarily unavailable or the API key is invalid.', priority: 'High' }];
  }
};


export const generateComparisonAnalysis = async (apiKey: string, reportBefore: any, reportAfter: any) => {
  if (!apiKey) {
    return null;
  }
  const ai = new GoogleGenAI({ apiKey });

  const relevantBefore = {
    categories: reportBefore.mobile.lighthouseResult.categories,
    metrics: reportBefore.mobile.lighthouseResult.audits['metrics'].details.items[0],
  };
  const relevantAfter = {
    categories: reportAfter.mobile.lighthouseResult.categories,
    metrics: reportAfter.mobile.lighthouseResult.audits['metrics'].details.items[0],
  };

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a world-class web performance expert. Compare these 'before' and 'after' mobile PageSpeed reports. 1. Summarize key improvements and regressions. 2. **Crucially, if the score improvement is small or negative, provide a detailed, technical hypothesis as to why (e.g., 'The initial optimizations were successful, but a third-party marketing script (e.g., GTM, Facebook Pixel) introduced new render-blocking requests on the second run, negating the gains. Investigate script loading with your browser's performance profiler.').** 3. Be encouraging but realistic. 4. Provide 2 final high-impact recommendations for further optimization. Respond with a JSON object containing "summary" (string), "improvements" (array of strings), "regressions" (array of strings), and "finalRecommendations" (array of {title, description}). Before: ${JSON.stringify(relevantBefore)}. After: ${JSON.stringify(relevantAfter)}.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
              regressions: { type: Type.ARRAY, items: { type: Type.STRING } },
              finalRecommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                  }
                }
              }
            },
            required: ['summary', 'improvements', 'regressions', 'finalRecommendations']
          }
        }
    });
    
    return JSON.parse(response.text.trim());

  } catch (error) {
    console.error("Error generating comparison analysis:", error);
    return null;
  }
};


export const rewriteToSemanticHtml = async (apiKey: string, html: string) => {
  if (!apiKey) {
    console.warn("Semantic rewrite skipped: Gemini API key not provided.");
    return html;
  }
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are an expert HTML developer. Rewrite the following HTML to use modern, semantic HTML5 tags. For example, convert <b> to <strong> and <i> to <em>. Ensure the structure and content remain identical. Preserve all <iframe>, <script>, <blockquote class="twitter-tweet">, <blockquote class="instagram-media">, and <blockquote class="tiktok-embed"> tags as they are. Do not add any explanation or surrounding text, only return the cleaned HTML code. Here is the HTML:\n\n${html}`;

  try {
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error rewriting to semantic HTML:", error);
    return html; // Return original HTML on error
  }
};