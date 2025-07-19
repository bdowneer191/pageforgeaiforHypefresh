import { useState, useCallback } from 'react';
import { rewriteToSemanticHtml } from '../services/geminiService.ts';
import { CleaningOptions, ImpactSummary, Recommendation } from '../types.ts';

// Basic minifiers
const minifyCss = (css: string): string => {
  return css
    .replace(/\/\*[\s\S]*?\*\/|[\r\n\t]/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/ ([{:;}]) /g, '$1')
    .replace(/([{:;}]) /g, '$1')
    .replace(/(:) /g, ':')
    .trim();
};

const minifyJs = (js: string): string => {
  // This is a very basic minifier; a real-world app might use a more robust library.
  return js.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').replace(/\s+/g, ' ').trim();
};


const processNode = (node: Node, options: CleaningOptions) => {
    // 1. Strip comments
    if (options.stripComments) {
        if (node.nodeType === Node.COMMENT_NODE) {
            node.parentNode?.removeChild(node);
            return;
        }
    }

    // 2. Collapse whitespace in text nodes
    if (options.collapseWhitespace && node.nodeType === Node.TEXT_NODE && node.textContent) {
        node.textContent = node.textContent.replace(/\s{2,}/g, ' ');
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;

        // 3. Minify inline CSS/JS
        if (options.minifyInlineCSSJS) {
            if (element.tagName === 'STYLE' && element.textContent) {
                element.textContent = minifyCss(element.textContent);
            }
            if (element.tagName === 'SCRIPT' && element.textContent && !element.getAttribute('src')) {
                // Be careful with JSON-LD scripts
                if (element.getAttribute('type') !== 'application/ld+json') {
                    element.textContent = minifyJs(element.textContent);
                }
            }
        }
        
        // 4. Remove empty attributes
        if (options.removeEmptyAttributes) {
            for (const attr of Array.from(element.attributes)) {
                if (attr.value === '') {
                    element.removeAttribute(attr.name);
                }
            }
        }
    }
    
    // Recursively process child nodes
    if (node.hasChildNodes()) {
        Array.from(node.childNodes).forEach(child => processNode(child, options));
    }
};

const processImages = (doc: Document, options: CleaningOptions) => {
    if (!options.lazyLoadImages) return;

    const images = Array.from(doc.querySelectorAll('img'));
    let imagesToSkip = 2; // Skip the first two images to protect LCP

    images.forEach(img => {
        // Add width/height from style attribute if they are missing, crucial for CLS
        if (!img.hasAttribute('width') && img.style.width) {
            const width = parseInt(img.style.width, 10);
            if (!isNaN(width) && width > 0) {
                img.setAttribute('width', width.toString());
            }
        }
        if (!img.hasAttribute('height') && img.style.height) {
            const height = parseInt(img.style.height, 10);
            if (!isNaN(height) && height > 0) {
                img.setAttribute('height', height.toString());
            }
        }

        // "Compromise effects" by removing costly CSS properties for performance.
        if (img.style.filter) img.style.filter = 'none';
        if (img.style.boxShadow) img.style.boxShadow = 'none';
        if (img.style.transform) img.style.transform = 'none';

        // Lazy load all images except the first few (likely LCP)
        if (imagesToSkip > 0) {
             img.setAttribute('loading', 'eager');
             img.setAttribute('fetchpriority', 'high');
             imagesToSkip--;
        } else {
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
        }
    });
};

const processEmbeds = (doc: Document, options: CleaningOptions) => {
    if (!options.lazyLoadEmbeds) return;

    let youtubeFound = false;
    doc.querySelectorAll('iframe[src*="youtube.com/embed/"], iframe[src*="youtube-nocookie.com/embed/"]').forEach(iframe => {
        const src = iframe.getAttribute('src');
        if (!src) return;

        const url = new URL(src);
        const videoId = url.pathname.split('/').pop();
        if (!videoId) return;

        youtubeFound = true;
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-youtube-facade';
        placeholder.setAttribute('data-videoid', videoId);
        
        const width = iframe.getAttribute('width') || '560';
        const height = iframe.getAttribute('height') || '315';
        placeholder.style.width = '100%';
        placeholder.style.aspectRatio = `${width} / ${height}`;
        placeholder.style.maxWidth = `${width}px`;

        placeholder.innerHTML = `<img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="Video Thumbnail" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"><div class="play-button"></div>`;
        
        iframe.parentNode?.replaceChild(placeholder, iframe);
    });

    let twitterFound = false;
    doc.querySelectorAll('blockquote.twitter-tweet').forEach(tweetQuote => {
        const tweetLink = tweetQuote.querySelector('a[href*="/status/"]');
        if (!tweetLink) return;

        twitterFound = true;
        const tweetUrl = tweetLink.getAttribute('href');
        if (!tweetUrl) return;

        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-twitter-facade';
        placeholder.setAttribute('data-tweet-url', tweetUrl);
        
        const twitterIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px; margin: 0 auto 8px; color: #38bdf8;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
        placeholder.innerHTML = `<div style="pointer-events: none;">${twitterIconSvg}<p style="font-size: 14px; margin: 0; font-weight: 500; color: #d1d5db;">Load Tweet</p><p style="font-size: 12px; color: #6b7280; margin: 4px 0 0;">Click to view this tweet</p></div>`;
        tweetQuote.parentNode?.replaceChild(placeholder, tweetQuote);
    });

    let instagramFound = false;
    doc.querySelectorAll('blockquote.instagram-media').forEach(igQuote => {
        const postLink = igQuote.getAttribute('data-instgrm-permalink');
        if (!postLink) return;

        instagramFound = true;
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-instagram-facade';
        placeholder.setAttribute('data-post-url', postLink);
        
        const igIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 32px; height: 32px; margin: 0 auto 8px;"><defs><radialGradient id="ig-grad" r="150%" cx="30%" cy="107%"><stop stop-color="#fdf497" offset="0"/><stop stop-color="#fd5949" offset="0.45"/><stop stop-color="#d6249f" offset="0.6"/><stop stop-color="#285AEB" offset="0.9"/></radialGradient></defs><path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.011 3.584-.069 4.85c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.252-.148-4.771-1.691-4.919-4.919-.058-1.265-.069-1.645-.069-4.85s.011-3.584.069-4.85c.149-3.225 1.664-4.771 4.919-4.919C8.356 2.175 8.741 2.163 12 2.163m0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072s3.667-.014 4.947-.072c4.358-.2 6.78-2.618 6.98-6.98.059-1.281.073-1.689.073-4.948s-.014-3.667-.072-4.947c-.2-4.358-2.618-6.78-6.98-6.98C8.334 0.014 7.941 0 4.692 0H12zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"/></svg>`;
        placeholder.innerHTML = `<div style="pointer-events: none;">${igIconSvg}<p style="font-size: 14px; margin: 0; font-weight: 500; color: #d1d5db;">View on Instagram</p><p style="font-size: 12px; color: #6b7280; margin: 4px 0 0;">Click to load this post</p></div>`;
        igQuote.parentNode?.replaceChild(placeholder, igQuote);
    });

    let tiktokFound = false;
    doc.querySelectorAll('blockquote.tiktok-embed').forEach(tkQuote => {
        const citeUrl = tkQuote.getAttribute('cite');
        const videoId = tkQuote.getAttribute('data-video-id');
        if (!citeUrl || !videoId) return;

        tiktokFound = true;
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-tiktok-facade';
        placeholder.setAttribute('data-cite-url', citeUrl);
        placeholder.setAttribute('data-video-id', videoId);
        
        const tkIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" style="width: 28px; height: 28px; margin: 0 auto 8px; color: #6b7280;"><path d="M448 209.9a210.1 210.1 0 01-122.8-39.3V349.4A162.6 162.6 0 11185 188.3V277.2a74.6 74.6 0 1052.2 71.2V209.9a210.1 210.1 0 01122.8-39.3z" fill="#25f4ee"/><path d="M448 209.9a210.1 210.1 0 01-122.8-39.3V349.4A162.6 162.6 0 11185 188.3V277.2a74.6 74.6 0 1052.2 71.2V209.9a210.1 210.1 0 01122.8-39.3zM325.2 170.6V0h-81v277.2a74.6 74.6 0 1052.2 71.2V209.9a210.1 210.1 0 01-122.8-39.3V0h-81v188.3A162.6 162.6 0 110 349.4 162.6 162.6 0 01185 188.3V0h81v170.6a210.1 210.1 0 0181.4 39.3z" fill="#ff0050"/></svg>`;
        placeholder.innerHTML = `<div style="pointer-events: none;">${tkIconSvg}<p style="font-size: 14px; margin: 0; font-weight: 500; color: #d1d5db;">View on TikTok</p><p style="font-size: 12px; color: #6b7280; margin: 4px 0 0;">Click to load this video</p></div>`;
        tkQuote.parentNode?.replaceChild(placeholder, tkQuote);
    });
    
    // Remove original embed scripts if we've replaced their blockquotes
    if (twitterFound) doc.querySelectorAll('script[src*="platform.twitter.com/widgets.js"]').forEach(s => s.remove());
    if (instagramFound) doc.querySelectorAll('script[src*="instagram.com/embed.js"]').forEach(s => s.remove());
    if (tiktokFound) doc.querySelectorAll('script[src*="tiktok.com/embed.js"]').forEach(s => s.remove());

    const hasFacades = youtubeFound || twitterFound || instagramFound || tiktokFound;
    
    if (hasFacades && !doc.querySelector('#pageforge-facade-script')) {
        const facadeScript = doc.createElement('script');
        facadeScript.id = 'pageforge-facade-script';
        facadeScript.textContent = `
            // Injected by PageForge AI for lazy loading embeds
            function loadScript(src, id, callback) {
                const existingScript = document.getElementById(id);
                if (existingScript) {
                    if (callback) callback();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.id = id;
                script.async = true;
                script.onload = callback;
                document.head.appendChild(script);
            }

            document.addEventListener('click', function(event) {
                const target = event.target.closest('.lazy-youtube-facade, .lazy-twitter-facade, .lazy-instagram-facade, .lazy-tiktok-facade');
                if (!target) return;

                if (target.matches('.lazy-youtube-facade') && !target.dataset.loaded) {
                    target.dataset.loaded = 'true';
                    const videoId = target.dataset.videoid;
                    const iframe = document.createElement('iframe');
                    iframe.setAttribute('src', 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0');
                    iframe.setAttribute('frameborder', '0');
                    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
                    iframe.setAttribute('allowfullscreen', '');
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    target.innerHTML = '';
                    target.style.aspectRatio = 'auto';
                    target.appendChild(iframe);
                }
                
                else if (target.matches('.lazy-twitter-facade') && !target.dataset.loading) {
                    target.dataset.loading = 'true';
                    const tweetUrl = target.dataset.tweetUrl;
                    if (!tweetUrl) return;
                    target.style.cursor = 'default';
                    target.innerHTML = '<p style="font-size: 14px; color: #9ca3af; text-align: center;">Loading Tweet...</p>';
                    
                    const renderTweet = () => {
                        if (window.twttr && window.twttr.widgets) {
                            const tweetContainer = document.createElement('div');
                            tweetContainer.innerHTML = '<blockquote class="twitter-tweet" data-dnt="true"><a href="' + tweetUrl + '"></a></blockquote>';
                            target.innerHTML = '';
                            target.style.cssText = 'border: none; padding: 0; background-color: transparent;';
                            target.appendChild(tweetContainer);
                            window.twttr.widgets.load(target);
                        }
                    };
                    loadScript('https://platform.twitter.com/widgets.js', 'twitter-wjs', renderTweet);
                }

                else if (target.matches('.lazy-instagram-facade') && !target.dataset.loading) {
                    target.dataset.loading = 'true';
                    const postUrl = target.dataset.postUrl;
                    if (!postUrl) return;
                    target.style.cursor = 'default';
                    target.innerHTML = '<p style="font-size: 14px; color: #9ca3af; text-align: center;">Loading Instagram Post...</p>';

                    const renderInstagram = () => {
                        if (window.instgrm) {
                            const embedContainer = document.createElement('div');
                            const blockquote = document.createElement('blockquote');
                            blockquote.className = 'instagram-media';
                            blockquote.setAttribute('data-instgrm-permalink', postUrl);
                            blockquote.setAttribute('data-instgrm-version', '14');
                            embedContainer.appendChild(blockquote);
                            target.innerHTML = '';
                            target.style.cssText = 'border: none; padding: 0; background-color: transparent;';
                            target.appendChild(embedContainer);
                            window.instgrm.Embeds.process();
                        }
                    };
                    loadScript('https://www.instagram.com/embed.js', 'instagram-wjs', renderInstagram);
                }

                else if (target.matches('.lazy-tiktok-facade') && !target.dataset.loading) {
                    target.dataset.loading = 'true';
                    const citeUrl = target.dataset.citeUrl;
                    const videoId = target.dataset.videoId;
                    if (!citeUrl || !videoId) return;

                    target.style.cursor = 'default';
                    target.innerHTML = '<p style="font-size: 14px; color: #9ca3af; text-align: center;">Loading TikTok...</p>';
                    
                    const blockquote = document.createElement('blockquote');
                    blockquote.className = 'tiktok-embed';
                    blockquote.setAttribute('cite', citeUrl);
                    blockquote.setAttribute('data-video-id', videoId);
                    blockquote.style.cssText = 'max-width: 605px; min-width: 325px; margin: 1rem auto;';
                    blockquote.innerHTML = '<section><a target="_blank" href="' + citeUrl + '">Watch video on TikTok</a></section>';
                    
                    target.innerHTML = '';
                    target.style.cssText = 'border: none; padding: 0; background-color: transparent;';
                    target.appendChild(blockquote);
                    
                    loadScript('https://www.tiktok.com/embed.js', 'tiktok-wjs');
                }
            });
        `;
        doc.body.appendChild(facadeScript);

        const facadeStyles = doc.createElement('style');
        facadeStyles.id = 'pageforge-facade-style';
        facadeStyles.textContent = `
            .lazy-youtube-facade { position: relative; cursor: pointer; background-color: #000; margin: 1rem auto; border-radius: 8px; overflow: hidden; }
            .lazy-youtube-facade .play-button { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 68px; height: 48px; background: rgba(0,0,0,0.6); border-radius: 10px; pointer-events: none; }
            .lazy-youtube-facade .play-button::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-40%, -50%); border-style: solid; border-width: 12px 0 12px 20px; border-color: transparent transparent transparent white; }
            .lazy-youtube-facade:hover .play-button { background: rgba(255,0,0,0.8); }
            .lazy-twitter-facade, .lazy-instagram-facade, .lazy-tiktok-facade { border: 1px solid #374151; border-radius: 12px; padding: 16px; background-color: #1f2937; color: #9ca3af; min-height: 120px; display: flex; align-items: center; justify-content: center; text-align: center; cursor: pointer; font-family: sans-serif; margin: 1rem auto; transition: background-color 0.2s; max-width: 540px; }
            .lazy-twitter-facade:hover, .lazy-instagram-facade:hover, .lazy-tiktok-facade:hover { background-color: #374151; }
        `;
        doc.body.appendChild(facadeStyles);
    }
};

const optimizeLoading = (doc: Document, options: CleaningOptions) => {
    if (options.optimizeFontLoading) {
        doc.querySelectorAll('link[href*="fonts.googleapis.com/css"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                const url = new URL(href, 'https://example.com');
                if (!url.searchParams.has('display')) {
                    url.searchParams.append('display', 'swap');
                    link.setAttribute('href', url.href);
                }
            }
        });
    }

    if (options.addPrefetchHints) {
        const domains = new Set<string>();
        doc.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                try {
                    const url = new URL(href);
                    domains.add(url.origin);
                } catch (e) {
                    console.warn('Could not parse URL for prefetch hint:', href, e);
                }
            }
        });

        domains.forEach(domain => {
            if (!doc.querySelector(`link[rel="preconnect"][href="${domain}"]`)) {
                const preconnect = doc.createElement('link');
                preconnect.rel = 'preconnect';
                preconnect.href = domain;
                doc.head.prepend(preconnect);
            }
        });
    }

    if (options.deferScripts) {
        doc.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            // Avoid deferring critical scripts like jQuery or navigation handlers
            if (src && src.toLowerCase().includes('jquery')) {
                return;
            }
            if (!script.hasAttribute('defer') && !script.hasAttribute('async') && !script.textContent?.includes('wp-block-navigation-link')) {
                 script.setAttribute('defer', '');
            }
        });
    }

    if (options.optimizeCssLoading) {
        const criticalKeywords = [
            'body', 'font', '@font-face', 'h1', 'h2', 'h3', 'header', 'nav', 'menu', 'hero', 'logo', 'button', 'input', 
            'above-the-fold', 'main-content', 'entry-header', 'featured-image', 'post-title', 'site-header', 
            'main-navigation', 'grid', 'flex', 'container', 'wrapper', 'wp-block', 'elementor', 'critical', 'style',
            'navbar', 'primary', 'footer-widgets'
        ];
        const keywordRegex = new RegExp(criticalKeywords.join('|'), 'i');

        const stylesheets: (HTMLLinkElement | HTMLStyleElement)[] = Array.from(doc.querySelectorAll('link[rel="stylesheet"], style'));

        stylesheets.forEach(sheet => {
            if (sheet.id === 'pageforge-facade-style') return;
            
            const isGoogleFont = sheet.tagName === 'LINK' && sheet.getAttribute('href')?.includes('fonts.googleapis.com');
            if (isGoogleFont) return;

            let content = '';
            if (sheet.tagName === 'STYLE') {
                content = sheet.textContent || '';
            } else if (sheet.tagName === 'LINK') {
                // In a browser environment, we can't read external stylesheet content directly.
                // The regex will apply to the URL, which might catch some cases like `.../critical-styles.css`
                content = sheet.getAttribute('href') || '';
            }

            if (!keywordRegex.test(content)) {
                sheet.setAttribute('media', 'print');
                sheet.setAttribute('onload', "this.media='all'");

                // Add noscript fallback for links
                if (sheet.tagName === 'LINK') {
                    const noscript = doc.createElement('noscript');
                    const newLink = sheet.cloneNode() as HTMLLinkElement;
                    newLink.removeAttribute('media');
                    newLink.removeAttribute('onload');
                    noscript.appendChild(newLink);
                    sheet.parentNode?.insertBefore(noscript, sheet.nextSibling);
                }
            }
        });
    }
};


export const useCleaner = () => {
    const [isCleaning, setIsCleaning] = useState(false);

    const cleanHtml = useCallback(async (
        geminiApiKey: string,
        html: string,
        options: CleaningOptions,
        recommendations: Recommendation[] | null
    ): Promise<{ cleanedHtml: string, summary: ImpactSummary, effectiveOptions: CleaningOptions }> => {
        setIsCleaning(true);

        try {
            let effectiveOptions = { ...options };
            if (recommendations) {
                recommendations.forEach(rec => {
                    const title = rec.title.toLowerCase();
                    if (title.includes('lazy load images')) effectiveOptions.lazyLoadImages = true;
                    if (title.includes('lazy load') && (title.includes('video') || title.includes('embed'))) effectiveOptions.lazyLoadEmbeds = true;
                    if (title.includes('defer') && title.includes('javascript')) effectiveOptions.deferScripts = true;
                    if (title.includes('optimize') && title.includes('css')) effectiveOptions.optimizeCssLoading = true;
                    if (title.includes('font')) effectiveOptions.optimizeFontLoading = true;
                });
            }

            const originalBytes = new TextEncoder().encode(html).length;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const originalNodeCount = doc.querySelectorAll('*').length;

            // Run all cleaning and optimization passes
            processNode(doc.body, effectiveOptions);
            processImages(doc, effectiveOptions);
            processEmbeds(doc, effectiveOptions);
            optimizeLoading(doc, effectiveOptions);

            let finalHtml = doc.body.innerHTML;

            // AI-powered rewrite is the last step
            if (effectiveOptions.semanticRewrite && geminiApiKey) {
                finalHtml = await rewriteToSemanticHtml(geminiApiKey, finalHtml);
            }

            const cleanedBytes = new TextEncoder().encode(finalHtml).length;
            const finalDoc = parser.parseFromString(finalHtml, 'text/html');
            const cleanedNodeCount = finalDoc.querySelectorAll('*').length;
            
            const summary: ImpactSummary = {
                originalBytes,
                cleanedBytes,
                bytesSaved: Math.max(0, originalBytes - cleanedBytes),
                nodesRemoved: Math.max(0, originalNodeCount - cleanedNodeCount),
                estimatedSpeedGain: `${((Math.max(0, originalBytes - cleanedBytes) / originalBytes) * 100).toFixed(1)}% size reduction`,
            };

            return { cleanedHtml: finalHtml, summary, effectiveOptions };
        } catch (error) {
            console.error("Error during HTML cleaning:", error);
            // Return original HTML in case of error
            return {
                cleanedHtml: html,
                summary: { originalBytes: 0, cleanedBytes: 0, bytesSaved: 0, nodesRemoved: 0, estimatedSpeedGain: 'Error' },
                effectiveOptions: options
            };
        } finally {
            setIsCleaning(false);
        }
    }, []);

    return { isCleaning, cleanHtml };
};
