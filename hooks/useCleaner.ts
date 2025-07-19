
import { useState, useCallback } from 'react';
import { rewriteToSemanticHtml } from '../services/geminiService.ts';
import { CleaningOptions, ImpactSummary, Recommendation } from '../types.ts';

const processEmbeds = (doc: Document) => {
    // --- NORMALIZATION PASS ---
    // Convert modern WordPress embed blocks into standard formats that our lazy-loader can understand.
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

    // --- LAZY-LOADING PASS ---

    // YouTube - Updated to use data-src for compatibility with the new lazy script
    doc.querySelectorAll('iframe[src*="youtube.com/embed/"], iframe[src*="youtube-nocookie.com/embed/"]').forEach(iframe => {
        const src = iframe.getAttribute('src');
        if (!src) return;
        const videoIdMatch = src.match(/embed\/([^?&/]+)/);
        if (!videoIdMatch?.[1]) return;
        const videoId = videoIdMatch[1];
        
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-youtube-embed';
        placeholder.setAttribute('data-src', src); // Set data-src for the new script
        
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
    });
};

const lazyLoadScript = '<script id="pageforge-lazy-loader">(function(){"use strict";if(window.pageforgeLazyLoaderInitialized)return;window.pageforgeLazyLoaderInitialized=!0;function e(e,t,c){const d=document.getElementById(e);if(d)return void(c&&c());const n=document.createElement("script");n.id=e,n.src=t,n.async=!0,c&&(n.onload=c),document.head.appendChild(n)}function t(t){if(t.matches(".lazy-youtube-embed")){const c=t.getAttribute("data-src");if(!c)return;const d=document.createElement("iframe"),n=new URL(c.startsWith("//")?`https:${c}`:c);return n.searchParams.set("autoplay","1"),n.searchParams.set("rel","0"),d.setAttribute("src",n.toString()),d.setAttribute("frameborder","0"),d.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"),d.setAttribute("allowfullscreen",""),d.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:8px;",t.innerHTML="",void t.appendChild(d)}const c=t.parentNode;if(!c)return;let d,n,o,r,a;if(t.matches(".lazy-tweet-facade"))d="tweet",n="data-tweet-html",o="twitter-wjs",r="https://platform.twitter.com/widgets.js",a=()=>window.twttr&&window.twttr.widgets&&window.twttr.widgets.load(c);else if(t.matches(".lazy-instagram-embed"))d="instagram",n="data-insta-html",o="instagram-embed-script",r="https://www.instagram.com/embed.js",a=()=>window.instgrm&&window.instgrm.Embeds.process();else{if(!t.matches(".lazy-tiktok-facade"))return;d="tiktok",n="data-tiktok-html",o="tiktok-embed-script",r="https://www.tiktok.com/embed.js",a=null}if(!d)return;const i=t.getAttribute(n);if(!i)return;try{const s=decodeURIComponent(escape(window.atob(i))),l=document.createElement("div");l.innerHTML=s;const m=l.firstChild;m&&(c.replaceChild(m,t),r&&e(o,r,a))}catch(t){console.error("Error restoring embed for "+d,t)}}document.addEventListener("click",function(c){const e=c.target.closest(".lazy-youtube-embed, .lazy-instagram-embed, .lazy-tweet-facade, .lazy-tiktok-facade");e&&t(e)},!1)})();</script>';

export const useCleaner = () => {
  const [isCleaning, setIsCleaning] = useState(false);

  const cleanHtml = useCallback(async (
      apiKey: string, 
      html: string, 
      options: CleaningOptions, 
      recommendations: Recommendation[] | null
  ): Promise<{ cleanedHtml: string, summary: ImpactSummary, effectiveOptions: CleaningOptions }> => {
    setIsCleaning(true);

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
    
    let processedHtml = html;
    if (effectiveOptions.semanticRewrite && apiKey) {
        processedHtml = await rewriteToSemanticHtml(apiKey, processedHtml);
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml, 'text/html');

    // **CRITICAL FIX**: Pre-emptively remove any old, conflicting lazy-load scripts.
    doc.querySelectorAll('script').forEach(script => {
      if (!script.src && (script.textContent?.includes('lazy-tweet-facade') || script.textContent?.includes('lazy-youtube-embed'))) {
        if (script.id !== 'pageforge-lazy-loader') {
            const parent = script.parentNode;
            // Also remove the invalid wrapping <p> tag if it exists and is otherwise empty.
            if (parent?.nodeName === 'P' && parent.textContent?.trim() === script.textContent?.trim()) {
                parent.parentNode?.removeChild(parent);
            } else {
                parent?.removeChild(script);
            }
        }
      }
    });
    
    const originalNodeCount = doc.getElementsByTagName('*').length;
    let hasLazyEmbeds = false;
    
    if (effectiveOptions.lazyLoadEmbeds) {
        processEmbeds(doc);
        if (doc.querySelector('.lazy-youtube-embed, .lazy-tweet-facade, .lazy-instagram-embed, .lazy-tiktok-facade')) {
            hasLazyEmbeds = true;
        }
    }

    if (effectiveOptions.lazyLoadImages) {
        const images = doc.querySelectorAll('img');
        images.forEach((img, index) => {
            if (index < 2) { // Eager load first two images for LCP
                img.setAttribute('loading', 'eager');
                img.setAttribute('fetchpriority', 'high');
            } else {
                img.setAttribute('loading', 'lazy');
                img.setAttribute('decoding', 'async');
            }
        });
    }
    
    if (effectiveOptions.deferScripts) {
        doc.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            // Do not defer jQuery or the lazy loader itself if it's somehow external
            if (src && (src.toLowerCase().includes('jquery') || src.includes('pageforge-lazy-loader'))) return;
            if (!script.hasAttribute('defer') && !script.hasAttribute('async')) {
                 script.setAttribute('defer', '');
            }
        });
    }

    if (effectiveOptions.optimizeFontLoading) {
        doc.querySelectorAll('link[href*="fonts.googleapis.com/css"]').forEach(link => {
            try {
                const href = link.getAttribute('href');
                if (!href) return;
                const url = new URL(href, 'https://example.com');
                 if (!url.searchParams.has('display')) {
                    url.searchParams.set('display', 'swap');
                    link.setAttribute('href', url.toString().replace('https://example.com', ''));
                }
            } catch(e) { console.error("Could not parse font URL", e)}
        });
    }
    
    if (effectiveOptions.addPrefetchHints) {
        const processedOrigins = new Set<string>();
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
                }
            } catch (e) { console.warn('Could not parse URL for prefetch hint:', href, e); }
        });
    }

    if (effectiveOptions.optimizeCssLoading) {
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
        });
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

    nodesToRemove.forEach(node => {
        node.parentNode?.removeChild(node);
    });

    let finalHtml = doc.body.innerHTML;

    if (effectiveOptions.minifyInlineCSSJS) {
      finalHtml = finalHtml.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
        const minifiedCss = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(\r\n|\n|\r)/gm, "").replace(/\s+/g, ' ').trim();
        return `<style>${minifiedCss}</style>`;
      });
      finalHtml = finalHtml.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, js) => {
        if (match.includes('src=') || match.includes('pageforge-lazy-loader')) return match; // Keep src scripts and our lazy loader
        const minifiedJs = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '').replace(/\s+/g, ' ').trim();
        return `<script>${minifiedJs}</script>`;
      });
    }

    if (effectiveOptions.collapseWhitespace) {
        finalHtml = finalHtml.replace(/>\s+</g, '><').trim();
    }
    
    if (hasLazyEmbeds && !doc.querySelector('#pageforge-lazy-loader')) {
        finalHtml += lazyLoadScript;
    }

    const cleanedBytes = new TextEncoder().encode(finalHtml).length;
    const finalDocForCount = parser.parseFromString(finalHtml, 'text/html');
    const cleanedNodeCount = finalDocForCount.querySelectorAll('*').length;
    const nodesRemoved = Math.max(0, originalNodeCount - cleanedNodeCount);
    const bytesSaved = Math.max(0, originalBytes - cleanedBytes);

    const summary: ImpactSummary = {
        originalBytes,
        cleanedBytes,
        bytesSaved,
        nodesRemoved,
        estimatedSpeedGain: originalBytes > 0 ? `${((bytesSaved / originalBytes) * 100).toFixed(1)}% size reduction` : '0.0% size reduction',
    };
    
    setIsCleaning(false);
    return { cleanedHtml: finalHtml, summary, effectiveOptions };
  }, []);

  return { isCleaning, cleanHtml };
};
