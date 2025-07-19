
import { useState, useCallback } from 'react';
import { rewriteToSemanticHtml } from '../services/geminiService.ts';
import { CleaningOptions, ImpactSummary, Recommendation } from '../types.ts';

const processEmbeds = (doc: Document, actionLog: string[]) => {
    let embedsFound = 0;
    // --- NORMALIZATION PASS ---
    doc.querySelectorAll('figure.wp-block-embed-twitter').forEach(figure => {
        const wrapper = figure.querySelector('.wp-block-embed__wrapper');
        const url = wrapper?.textContent?.trim();
        if (url && url.includes('twitter.com')) {
            const tweetBlockquote = doc.createElement('blockquote');
            tweetBlockquote.className = 'twitter-tweet';
            const tweetLink = doc.createElement('a');
            tweetLink.href = url;
            tweetBlockquote.appendChild(tweetLink);
            figure.parentNode?.replaceChild(tweetBlockquote, figure);
        }
    });
    
    doc.querySelectorAll('figure.wp-block-embed-youtube').forEach(figure => {
        const wrapper = figure.querySelector('.wp-block-embed__wrapper');
        const urlString = wrapper?.textContent?.trim();
        if (!urlString) return;

        let videoId = '';
        try {
            const url = new URL(urlString);
            if (url.hostname.includes('youtu.be')) {
                videoId = url.pathname.slice(1);
            } else if (url.hostname.includes('youtube.com')) {
                videoId = url.searchParams.get('v') || '';
            }
        } catch (e) {
            const match = urlString.match(/(?:v=|vi\/|embed\/|\.be\/)([a-zA-Z0-9_-]{11})/);
            if (match) videoId = match[1];
        }

        if (!videoId) return;

        const iframe = doc.createElement('iframe');
        iframe.setAttribute('src', `https://www.youtube.com/embed/${videoId}`);
        iframe.setAttribute('width', '560');
        iframe.setAttribute('height', '315');
        iframe.setAttribute('title', 'YouTube video player');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        
        figure.parentNode?.replaceChild(iframe, figure);
    });
    
    doc.querySelectorAll('figure.wp-block-embed-reddit').forEach(figure => {
        const wrapper = figure.querySelector('.wp-block-embed__wrapper');
        const blockquote = wrapper?.querySelector('blockquote.reddit-card');
        if (blockquote) {
            figure.parentNode?.replaceChild(blockquote.cloneNode(true), figure);
        }
    });

    // --- LAZY-LOADING PASS ---

    // YouTube
    doc.querySelectorAll('iframe[src*="youtube.com/embed/"], iframe[src*="youtube-nocookie.com/embed/"]').forEach(iframe => {
        const src = iframe.getAttribute('src');
        if (!src) return;
        const videoIdMatch = src.match(/embed\/([^?&/]+)/);
        if (!videoIdMatch?.[1]) return;
        const videoId = videoIdMatch[1];
        
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-youtube-embed';
        placeholder.setAttribute('data-src', src);
        
        const width = iframe.getAttribute('width') || '560';
        const height = iframe.getAttribute('height') || '315';

        Object.assign(placeholder.style, {
            position: 'relative',
            cursor: 'pointer',
            width: '100%',
            maxWidth: `${width}px`,
            aspectRatio: `${width} / ${height}`,
            backgroundImage: `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '8px',
            overflow: 'hidden',
            margin: '1rem auto'
        });

        placeholder.innerHTML = `<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);"><svg style="width:68px;height:48px;filter:drop-shadow(0 0 5px rgba(0,0,0,0.5));" viewBox="0 0 68 48"><path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path><path d="M 45,24 27,14 27,34" fill="#fff"></path></svg></div>`;
        iframe.parentNode?.replaceChild(placeholder, iframe);
        embedsFound++;
    });

    // Twitter
    doc.querySelectorAll('blockquote.twitter-tweet').forEach(tweet => {
        const nextSibling = tweet.nextElementSibling;
        if (nextSibling instanceof HTMLScriptElement && nextSibling.src.includes('platform.twitter.com')) {
            nextSibling.remove();
        }

        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-tweet-facade';

        const tweetText = tweet.querySelector('p')?.textContent || 'A tweet from X.';
        const authorMatch = (tweet.textContent || '').match(/— (.*?) \(@/);
        const authorName = authorMatch ? authorMatch[1] : 'X User';
        
        Object.assign(placeholder.style, {
            border: '1px solid #374151', borderRadius: '12px', padding: '16px', cursor: 'pointer',
            backgroundColor: '#1a202c', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif',
            fontSize: '15px', lineHeight: '1.4', maxWidth: '550px', margin: '1rem auto'
        });
        
        placeholder.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 12px; pointer-events: none;">
            <div style="width: 48px; height: 48px; background-color: #374151; border-radius: 9999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px;">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style="width: 24px; height: 24px; color: #e5e7eb;"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>
            </div>
            <div>
              <strong style="font-weight: bold; color: #fff;">${authorName}</strong>
              <div style="color: #8899a6;">View on X</div>
            </div>
          </div>
          <p style="margin: 0 0 16px 0; color: #e5e7eb; pointer-events: none;">${tweetText.length > 150 ? tweetText.substring(0, 150) + '…' : tweetText}</p>
          <div style="text-align: center; padding: 10px; border: 1px solid #374151; border-radius: 9999px; font-weight: bold; color: #fff; pointer-events: none;">
            Load Tweet
          </div>
        `;
        const tweetHtml = btoa(unescape(encodeURIComponent(tweet.outerHTML)));
        placeholder.setAttribute('data-tweet-html', tweetHtml);
        tweet.parentNode?.replaceChild(placeholder, tweet);
        embedsFound++;
    });

    // Instagram
    doc.querySelectorAll('blockquote.instagram-media').forEach(insta => {
        const nextSibling = insta.nextElementSibling;
        if (nextSibling instanceof HTMLScriptElement && nextSibling.src.includes('instagram.com/embed.js')) {
            nextSibling.remove();
        }
        
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-instagram-embed';
        
        const instaHtml = btoa(unescape(encodeURIComponent(insta.outerHTML)));
        placeholder.setAttribute('data-insta-html', instaHtml);
        
        Object.assign(placeholder.style, {
            position: 'relative', cursor: 'pointer', width: '100%', maxWidth: '540px',
            margin: '1rem auto', border: '1px solid #374151', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            aspectRatio: '1/1.2', backgroundColor: '#1a202c', color: '#e5e7eb', fontFamily: 'sans-serif'
        });
        
        placeholder.innerHTML = `<div style="pointer-events: none;"><svg style="width:32px;height:32px;margin-right:10px;display:inline-block;vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> Load Instagram Post</div>`;
        insta.parentNode?.replaceChild(placeholder, insta);
        embedsFound++;
    });

    // TikTok
    doc.querySelectorAll('blockquote.tiktok-embed').forEach(tiktok => {
        const nextSibling = tiktok.nextElementSibling;
        if (nextSibling instanceof HTMLScriptElement && nextSibling.src.includes('tiktok.com/embed.js')) {
            nextSibling.remove();
        }

        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-tiktok-facade';
        Object.assign(placeholder.style, {
            border: '1px solid #374151', borderRadius: '12px', padding: '16px', cursor: 'pointer',
            backgroundColor: '#1a202c', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif',
            fontSize: '15px', lineHeight: '1.4', maxWidth: '325px', margin: '1rem auto'
        });

        placeholder.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 12px; pointer-events: none;">
                <img src="https://sf16-website-login.dl.tiktokcdn.com/obj/tiktok_web_login_static/tiktok/site/static/images/logo-dark.svg" alt="TikTok" style="height: 28px; filter: brightness(0) invert(1);">
            </div>
            <p style="margin: 0 0 16px 0; color: #e5e7eb; pointer-events: none;">A video from TikTok.</p>
            <div style="text-align: center; padding: 10px; border: 1px solid #374151; border-radius: 9999px; font-weight: bold; color: #fff; pointer-events: none;">
                Load TikTok Video
            </div>
        `;
        const tiktokHtml = btoa(unescape(encodeURIComponent(tiktok.outerHTML)));
        placeholder.setAttribute('data-tiktok-html', tiktokHtml);
        tiktok.parentNode?.replaceChild(placeholder, tiktok);
        embedsFound++;
    });
    
    // Reddit
    doc.querySelectorAll('blockquote.reddit-card, iframe[src*="reddit.com/embed"]').forEach(card => {
        const nextSibling = card.nextElementSibling;
        if (nextSibling instanceof HTMLScriptElement && nextSibling.src.includes('embed.reddit.com')) {
            nextSibling.remove();
        }
        
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-reddit-embed';
        
        Object.assign(placeholder.style, {
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px',
            cursor: 'pointer',
            backgroundColor: '#1a202c',
            color: '#e5e7eb',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '15px',
            maxWidth: '550px',
            margin: '1rem auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '112px'
        });
        
        placeholder.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 48px; height: 48px; color: #ff4500; margin-bottom: 12px;"><path d="M12.0001 21.6001C17.3026 21.6001 21.6001 17.3026 21.6001 12.0001C21.6001 6.69757 17.3026 2.40002 12.0001 2.40002C6.69757 2.40002 2.40002 6.69757 2.40002 12.0001C2.40002 17.3026 6.69757 21.6001 12.0001 21.6001ZM12.0001 19.2001C8.02952 19.2001 4.80002 15.9706 4.80002 12.0001C4.80002 8.02952 8.02952 4.80002 12.0001 4.80002C15.9706 4.80002 19.2001 8.02952 19.2001 12.0001C19.2001 15.9706 15.9706 19.2001 12.0001 19.2001ZM12.0001 11.5201C11.1669 11.5201 10.4688 11.1235 10.012 10.4668C9.93922 10.356 9.80942 10.3013 9.67562 10.3341L7.75122 10.8241C7.62772 10.8543 7.53032 10.9631 7.51992 11.0906C7.50952 11.218 7.59002 11.3342 7.71212 11.3592L9.63652 11.8492C10.0384 12.8258 10.9416 13.5201 12.0001 13.5201C13.0585 13.5201 13.9617 12.8258 14.3636 11.8492L16.288 11.3592C16.4101 11.3342 16.4906 11.218 16.4802 11.0906C16.4698 10.9631 16.3724 10.8543 16.2489 10.8241L14.3245 10.3341C14.1907 10.3013 14.0609 10.356 13.9881 10.4668C13.5313 11.1235 12.8332 11.5201 12.0001 11.5201ZM8.40002 8.76002C8.99522 8.76002 9.48002 8.27522 9.48002 7.68002C9.48002 7.08482 8.99522 6.60002 8.40002 6.60002C7.80482 6.60002 7.32002 7.08482 7.32002 7.68002C7.32002 8.27522 7.80482 8.76002 8.40002 8.76002ZM15.6001 8.76002C16.1953 8.76002 16.6801 8.27522 16.6801 7.68002C16.6801 7.08482 16.1953 6.60002 15.6001 6.60002C15.0049 6.60002 14.5201 7.08482 14.5201 7.68002C14.5201 8.27522 15.0049 8.76002 15.6001 8.76002ZM14.4553 15.1118C14.2237 14.7891 13.8823 14.5715 13.5013 14.4981C12.8713 14.3781 11.1298 14.3781 10.4998 14.4981C10.1188 14.5715 9.77742 14.7891 9.54492 15.1118C9.32472 15.4184 9.25542 15.7981 9.35622 16.1558C9.45702 16.5134 9.71802 16.8122 10.0717 16.9634C10.8718 17.3018 13.1283 17.3018 13.9284 16.9634C14.2821 16.8122 14.5431 16.5134 14.6439 16.1558C14.7447 15.7981 14.6754 15.4184 14.4553 15.1118Z" /></svg><strong style="font-weight: bold; color: #fff;">Load Reddit Post</strong></div>`;
    
        const cardHtml = btoa(unescape(encodeURIComponent(card.outerHTML)));
        placeholder.setAttribute('data-reddit-html', cardHtml);
        card.parentNode?.replaceChild(placeholder, card);
        embedsFound++;
    });
    if (embedsFound > 0) {
      actionLog.push(`Created lazy-load facades for ${embedsFound} social media embed(s).`);
    }
};

const lazyLoadScript = `<script id="pageforge-lazy-loader">(function(){"use strict";if(window.pageforgeLazyLoaderInitialized)return;window.pageforgeLazyLoaderInitialized=!0;function e(e,t,c){const d=document.getElementById(e);if(d)return void(c&&c());const n=document.createElement("script");n.id=e,n.src=t,n.async=!0,c&&(n.onload=c),document.head.appendChild(n)}function t(t){if(t.matches(".lazy-youtube-embed")){const c=t.getAttribute("data-src");if(!c)return;const d=document.createElement("iframe"),n=new URL(c.startsWith("//")?("https:"+c):c);n.searchParams.set("autoplay","1"),n.searchParams.set("rel","0"),d.setAttribute("src",n.toString()),d.setAttribute("frameborder","0"),d.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"),d.setAttribute("allowfullscreen",""),d.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:8px;",t.innerHTML="",t.appendChild(d);return}const c=t.parentNode;if(!c)return;let d,n,o,r,a;if(t.matches(".lazy-tweet-facade"))d="tweet",n="data-tweet-html",o="twitter-wjs",r="https://platform.twitter.com/widgets.js",a=()=>window.twttr&&window.twttr.widgets&&window.twttr.widgets.load(c);else if(t.matches(".lazy-instagram-embed"))d="instagram",n="data-insta-html",o="instagram-embed-script",r="https://www.instagram.com/embed.js",a=()=>window.instgrm&&window.instgrm.Embeds.process();else if(t.matches(".lazy-tiktok-facade"))d="tiktok",n="data-tiktok-html",o="tiktok-embed-script",r="https://www.tiktok.com/embed.js",a=null;else if(t.matches(".lazy-reddit-embed"))d="reddit",n="data-reddit-html",o="reddit-widgets-js",r="https://embed.reddit.com/widgets.js",a=null;else return;if(!d)return;const i=t.getAttribute(n);if(!i)return;try{const s=decodeURIComponent(escape(window.atob(i))),l=document.createElement("div");l.innerHTML=s;const m=l.firstChild;m&&(c.replaceChild(m,t),r&&e(o,r,a))}catch(t){console.error("Error restoring embed for "+d,t)}}document.addEventListener("click",function(c){const e=c.target.closest(".lazy-youtube-embed, .lazy-instagram-embed, .lazy-tweet-facade, .lazy-tiktok-facade, .lazy-reddit-embed");e&&t(e)},!1)})();</script>`;

export const useCleaner = () => {
  const [isCleaning, setIsCleaning] = useState(false);

  const cleanHtml = useCallback(async (
      html: string, 
      options: CleaningOptions, 
      recommendations: Recommendation[] | null
  ): Promise<{ cleanedHtml: string, summary: ImpactSummary, effectiveOptions: CleaningOptions }> => {
    setIsCleaning(true);
    const actionLog: string[] = [];

    let effectiveOptions = { ...options };
    if (recommendations) {
        let appliedAICount = 0;
        recommendations.forEach(rec => {
            const title = rec.title.toLowerCase();
            if (title.includes('lazy load images') && !effectiveOptions.lazyLoadImages) { effectiveOptions.lazyLoadImages = true; appliedAICount++; }
            if (title.includes('lazy load') && (title.includes('video') || title.includes('embed')) && !effectiveOptions.lazyLoadEmbeds) { effectiveOptions.lazyLoadEmbeds = true; appliedAICount++; }
            if (title.includes('defer') && title.includes('javascript') && !effectiveOptions.deferScripts) { effectiveOptions.deferScripts = true; appliedAICount++; }
            if (title.includes('optimize') && title.includes('css') && !effectiveOptions.optimizeCssLoading) { effectiveOptions.optimizeCssLoading = true; appliedAICount++; }
            if (title.includes('font') && !effectiveOptions.optimizeFontLoading) { effectiveOptions.optimizeFontLoading = true; appliedAICount++; }
            if ((title.includes('image format') || title.includes('webp')) && !effectiveOptions.optimizeImages) { effectiveOptions.optimizeImages = true; appliedAICount++; }
        });
        if(appliedAICount > 0) actionLog.push(`Applied ${appliedAICount} AI recommendation(s).`);
    }

    const originalBytes = new TextEncoder().encode(html).length;
    
    // Pre-emptive removal of old loader scripts
    const preCleanedHtml = html.replace(/<script[^>]*>[\s\S]*?lazy-youtube-embed[\s\S]*?<\/script>/g, '');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(preCleanedHtml, 'text/html');

    if (effectiveOptions.semanticRewrite) {
        const count = doc.querySelectorAll('b, i').length;
        if (count > 0) {
            rewriteToSemanticHtml(doc);
            actionLog.push(`Rewrote ${count} tag(s) to semantic HTML5.`);
        }
    }
    
    const originalNodeCount = doc.getElementsByTagName('*').length;
    let hasLazyEmbeds = false;
    
    if (effectiveOptions.lazyLoadEmbeds) {
        processEmbeds(doc, actionLog);
        if (doc.querySelector('.lazy-youtube-embed, .lazy-tweet-facade, .lazy-instagram-embed, .lazy-tiktok-facade, .lazy-reddit-embed')) {
            hasLazyEmbeds = true;
        }
    }

    if (effectiveOptions.lazyLoadImages) {
        const images = doc.querySelectorAll('img');
        let lazyLoadedCount = 0;
        images.forEach((img, index) => {
            if (index < 2) {
                img.setAttribute('loading', 'eager');
                img.setAttribute('fetchpriority', 'high');
            } else {
                if(img.getAttribute('loading') !== 'lazy') {
                    img.setAttribute('loading', 'lazy');
                    lazyLoadedCount++;
                }
                img.setAttribute('decoding', 'async');
            }
        });
        if (lazyLoadedCount > 0) actionLog.push(`Lazy-loaded ${lazyLoadedCount} image(s).`);
    }

    if (effectiveOptions.optimizeImages) {
        let webpCount = 0;
        let sizedCount = 0;
        const cdnHosts = ['i0.wp.com', 'i1.wp.com', 'i2.wp.com', 'i3.wp.com', 'cloudinary.com', 'imgix.net'];
        
        doc.querySelectorAll('img').forEach(img => {
            // Add width/height from filename (e.g., image-1024x768.jpg)
            if (!img.hasAttribute('width') && !img.hasAttribute('height')) {
                const match = img.src.match(/-(\d+)[xX](\d+)\.(jpg|jpeg|png|webp)/);
                if (match && match[1] && match[2]) {
                    img.setAttribute('width', match[1]);
                    img.setAttribute('height', match[2]);
                    sizedCount++;
                }
            }

            // Convert to WebP via CDN
            let src = img.getAttribute('src');
            if (!src || src.includes('.svg') || src.startsWith('data:')) return;
    
            try {
                const url = new URL(src);
                if (cdnHosts.some(host => url.hostname.includes(host))) {
                    if(!url.searchParams.has('format')) {
                        url.searchParams.set('format', 'webp');
                        img.setAttribute('src', url.toString());
                        webpCount++;
                    }
                }
            } catch (e) {
                // Ignore invalid URLs
            }
        });
        if (sizedCount > 0) actionLog.push(`Added dimensions to ${sizedCount} image(s) to prevent layout shift.`);
        if (webpCount > 0) actionLog.push(`Converted ${webpCount} image(s) to WebP format.`);
    }
    
    if (effectiveOptions.deferScripts) {
        let deferCount = 0;
        doc.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            if (src && (src.toLowerCase().includes('jquery') || src.includes('pageforge-lazy-loader'))) return;
            if (!script.hasAttribute('defer') && !script.hasAttribute('async')) {
                 script.setAttribute('defer', '');
                 deferCount++;
            }
        });
        if (deferCount > 0) actionLog.push(`Deferred ${deferCount} non-essential script(s).`);
    }

    if (effectiveOptions.optimizeFontLoading) {
        let fontCount = 0;
        doc.querySelectorAll('link[href*="fonts.googleapis.com/css"]').forEach(link => {
            try {
                const href = link.getAttribute('href');
                if (!href) return;
                const url = new URL(href, 'https://example.com');
                 if (!url.searchParams.has('display')) {
                    url.searchParams.set('display', 'swap');
                    link.setAttribute('href', url.toString().replace('https://example.com', ''));
                    fontCount++;
                }
            } catch(e) { console.error("Could not parse font URL", e)}
        });
        if (fontCount > 0) actionLog.push(`Optimized ${fontCount} Google Font file(s).`);
    }
    
    if (effectiveOptions.addPrefetchHints) {
        const processedOrigins = new Set<string>();
        let hintCount = 0;
        doc.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').forEach(link => {
            const href = link.getAttribute('href');
            try {
                if (!href) return;
                const url = new URL(href);
                if (!processedOrigins.has(url.origin)) {
                    const preconnect = doc.createElement('link');
                    preconnect.rel = 'preconnect';
                    preconnect.href = url.origin;
                    if (url.origin.includes('gstatic')) {
                        preconnect.setAttribute('crossorigin', '');
                    }
                    doc.head.prepend(preconnect);
                    processedOrigins.add(url.origin);
                    hintCount++;
                }
            } catch (e) { console.warn('Could not parse URL for prefetch hint:', href, e); }
        });
        if(hintCount > 0) actionLog.push(`Added ${hintCount} preconnect hint(s) for faster connections.`);
    }

    if (effectiveOptions.optimizeCssLoading) {
        let cssCount = 0;
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(stylesheet => {
            if (stylesheet.getAttribute('href')?.includes('fonts.googleapis.com')) return;
            stylesheet.setAttribute('media', 'print');
            stylesheet.setAttribute('onload', "this.onload=null;this.media='all'");
            const noscript = doc.createElement('noscript');
            const fallbackLink = stylesheet.cloneNode(true) as HTMLLinkElement;
            fallbackLink.removeAttribute('media');
            fallbackLink.removeAttribute('onload');
            noscript.appendChild(fallbackLink);
            stylesheet.parentNode?.insertBefore(noscript, stylesheet.nextSibling);
            cssCount++;
        });
        if(cssCount > 0) actionLog.push(`Deferred ${cssCount} stylesheet(s).`);
    }

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ALL);
    const nodesToRemove: Node[] = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!effectiveOptions.lazyLoadEmbeds && effectiveOptions.preserveIframes && node.nodeName.toLowerCase() === 'iframe') continue;
      if (effectiveOptions.preserveLinks && node.nodeName.toLowerCase() === 'a') continue;
      if (effectiveOptions.preserveShortcodes && node.nodeType === Node.TEXT_NODE && /\[.*?\]/.test(node.textContent || '')) continue;
      
      if (effectiveOptions.stripComments && node.nodeType === Node.COMMENT_NODE) {
        nodesToRemove.push(node);
      }
      if (effectiveOptions.removeEmptyAttributes && node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const attrsToRemove: string[] = [];
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          if (attr.value.trim() === '') attrsToRemove.push(attr.name);
        }
        attrsToRemove.forEach(attrName => element.removeAttribute(attrName));
      }
    }

    if (nodesToRemove.length > 0) {
        actionLog.push(`Removed ${nodesToRemove.length} unnecessary HTML comment(s).`);
    }
    nodesToRemove.forEach(node => {
        node.parentNode?.removeChild(node);
    });

    let finalHtml = `<!DOCTYPE html>\n` + doc.documentElement.outerHTML;

    if (effectiveOptions.minifyInlineCSSJS) {
      finalHtml = finalHtml.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
        const minifiedCss = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(\r\n|\n|\r)/gm, "").replace(/\s+/g, ' ').trim();
        return `<style>${minifiedCss}</style>`;
      });
      finalHtml = finalHtml.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, js) => {
        if (match.includes('src=') || match.includes('pageforge-lazy-loader')) return match;
        const minifiedJs = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '').replace(/\s+/g, ' ').trim();
        return `<script>${minifiedJs}</script>`;
      });
    }

    if (effectiveOptions.collapseWhitespace) {
        finalHtml = finalHtml.replace(/>\s+</g, '><').trim();
    }
    
    if (hasLazyEmbeds && !finalHtml.includes('id="pageforge-lazy-loader"')) {
        finalHtml += lazyLoadScript;
    }

    const cleanedBytes = new TextEncoder().encode(finalHtml).length;
    const finalDocForCount = parser.parseFromString(finalHtml, 'text/html');
    const cleanedNodeCount = finalDocForCount.querySelectorAll('*').length;
    const nodesRemoved = Math.max(0, originalNodeCount - cleanedNodeCount);
    const bytesSaved = Math.max(0, originalBytes - cleanedBytes);

    if(bytesSaved > 0) {
        actionLog.push(`Minified content, saving ${bytesSaved} bytes.`);
    }

    const summary: ImpactSummary = {
        originalBytes,
        cleanedBytes,
        bytesSaved,
        nodesRemoved,
        estimatedSpeedGain: originalBytes > 0 ? `${((bytesSaved / originalBytes) * 100).toFixed(1)}% size reduction` : '0.0% size reduction',
        actionLog
    };
    
    setIsCleaning(false);
    return { cleanedHtml: finalHtml, summary, effectiveOptions };
  }, []);

  return { isCleaning, cleanHtml };
};
