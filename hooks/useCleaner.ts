

import { useState, useCallback } from 'react';
import { rewriteToSemanticHtml } from '../services/geminiService.ts';
import { CleaningOptions } from '../types.ts';

const processEmbeds = (doc) => {
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

    // --- LAZY-LOADING PASS ---

    // YouTube
    const youtubeIframes = doc.querySelectorAll('iframe[src*="youtube.com/embed/"], iframe[src*="youtube-nocookie.com/embed/"]');
    youtubeIframes.forEach(iframe => {
        const src = iframe.getAttribute('src');
        if (!src) return;
        const videoIdMatch = src.match(/embed\/([^?&/]+)/);
        if (!videoIdMatch?.[1]) return;
        const videoId = videoIdMatch[1];

        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-youtube-embed';
        placeholder.setAttribute('data-src', src);
        
        Object.assign(placeholder.style, {
            position: 'relative',
            cursor: 'pointer',
            width: iframe.getAttribute('width') ? `${iframe.getAttribute('width')}px` : '100%',
            maxWidth: '100%',
            aspectRatio: '16/9',
            backgroundImage: `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '8px',
            overflow: 'hidden'
        });

        placeholder.innerHTML = `<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);"><svg style="width:68px;height:48px;filter:drop-shadow(0 0 5px rgba(0,0,0,0.5));" viewBox="0 0 68 48"><path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path><path d="M 45,24 27,14 27,34" fill="#fff"></path></svg></div>`;
        iframe.parentNode?.replaceChild(placeholder, iframe);
    });

    // Twitter
    doc.querySelectorAll('blockquote.twitter-tweet').forEach(tweet => {
        let nextSibling = tweet.nextElementSibling;
        if (nextSibling?.tagName === 'SCRIPT' && nextSibling.src.includes('platform.twitter.com')) {
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
        let nextSibling = insta.nextElementSibling;
        if (nextSibling?.tagName === 'SCRIPT' && nextSibling.src.includes('instagram.com/embed.js')) {
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
        let nextSibling = tiktok.nextElementSibling;
        if (nextSibling?.tagName === 'SCRIPT' && nextSibling.src.includes('tiktok.com/embed.js')) {
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

const lazyLoadScript = `<script>(function(){"use strict";function e(t,c,o){const n=document.getElementById(t);if(n)return void(o&&o());const d=document.createElement("script");d.id=t,d.src=c,d.async=!0,o&&(d.onload=o),document.head.appendChild(d)}function t(t){if(t.matches(".lazy-youtube-embed")){const c=t.getAttribute("data-src");if(!c)return;const o=document.createElement("iframe");return o.setAttribute("src",c+"?autoplay=1"),o.setAttribute("frameborder","0"),o.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"),o.setAttribute("allowfullscreen",""),o.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;",t.innerHTML="",void t.appendChild(o)}let c,o,n,d,r;if(t.matches(".lazy-tweet-facade"))c="tweet",o="data-tweet-html",n="twitter-wjs",d="https://platform.twitter.com/widgets.js",r=()=>window.twttr&&window.twttr.widgets&&window.twttr.widgets.load(t.parentNode);else if(t.matches(".lazy-instagram-embed"))c="instagram",o="data-insta-html",n="instagram-embed-script",d="https://www.instagram.com/embed.js",r=()=>window.instgrm&&window.instgrm.Embeds.process();else{if(!t.matches(".lazy-tiktok-facade"))return;c="tiktok",o="data-tiktok-html",n="tiktok-embed-script",d="https://www.tiktok.com/embed.js"}if(!c)return;const a=t.getAttribute(o);if(!a)return;try{const i=decodeURIComponent(escape(window.atob(a))),s=document.createElement("div");s.innerHTML=i;const l=s.firstChild;l&&(t.parentNode.replaceChild(l,t),d&&e(n,d,r))}catch(e){console.error("Error restoring embed for "+c,e)}}document.addEventListener("click",function(e){const c=e.target.closest(".lazy-youtube-embed, .lazy-instagram-embed, .lazy-tweet-facade, .lazy-tiktok-facade");c&&t(c)},!1)})();</script>`;

export const useCleaner = () => {
  const [isCleaning, setIsCleaning] = useState(false);

  const cleanHtml = useCallback(async (html: string, options: CleaningOptions, apiKey: string) => {
    setIsCleaning(true);
    let nodesRemovedCount = 0;
    const originalBytes = new TextEncoder().encode(html).length;
    
    let processedHtml = html;
    if (options.semanticRewrite) {
        processedHtml = await rewriteToSemanticHtml(apiKey, processedHtml);
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml, 'text/html');
    const originalNodeCount = doc.getElementsByTagName('*').length;
    let hasLazyEmbeds = false;
    let headTagsToAdd = '';
    const processedOrigins = new Set<string>();

    if (options.lazyLoadEmbeds) {
        processEmbeds(doc);
        if (doc.querySelector('.lazy-youtube-embed, .lazy-tweet-facade, .lazy-instagram-embed, .lazy-tiktok-facade')) {
            hasLazyEmbeds = true;
        }
    }

    if (options.lazyLoadImages) {
        const images = doc.querySelectorAll('img:not([loading="lazy"])');
        images.forEach((img, index) => {
            if (index === 0) {
                img.setAttribute('fetchpriority', 'high');
            } else {
                img.setAttribute('loading', 'lazy');
            }
            img.setAttribute('decoding', 'async');
        });
    }

    if (options.optimizeFontLoading || options.addPrefetchHints) {
        doc.querySelectorAll('link[href*="fonts.googleapis.com/css"]').forEach(link => {
            const googleApiOrigin = 'https://fonts.googleapis.com';
            const gstaticOrigin = 'https://fonts.gstatic.com';

            if (options.addPrefetchHints) {
                if (!processedOrigins.has(googleApiOrigin)) {
                    headTagsToAdd += `<link rel="preconnect" href="${googleApiOrigin}">\n`;
                    processedOrigins.add(googleApiOrigin);
                }
                if (!processedOrigins.has(gstaticOrigin)) {
                    headTagsToAdd += `<link rel="preconnect" href="${gstaticOrigin}" crossorigin>\n`;
                    processedOrigins.add(gstaticOrigin);
                }
            }

            if (options.optimizeFontLoading) {
                try {
                    const url = new URL(link.getAttribute('href')!, 'https://example.com');
                     if (!url.searchParams.has('display')) {
                        url.searchParams.set('display', 'swap');
                        link.setAttribute('href', url.href.replace('https://example.com', ''));
                    }
                } catch(e) { console.error("Could not parse font URL", e)}
            }
        });
    }

    if (options.optimizeCssLoading) {
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
      if (!options.lazyLoadEmbeds && options.preserveIframes && node.nodeName.toLowerCase() === 'iframe') continue;
      if (options.preserveLinks && node.nodeName.toLowerCase() === 'a') continue;
      if (options.preserveShortcodes && node.nodeType === Node.TEXT_NODE && /\[.*?\]/.test(node.textContent || '')) continue;
      
      if (options.stripComments && node.nodeType === Node.COMMENT_NODE) {
        nodesToRemove.push(node);
      }
      if (options.removeEmptyAttributes && node.nodeType === Node.ELEMENT_NODE) {
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
        nodesRemovedCount++;
    });

    let finalHtml = new XMLSerializer().serializeToString(doc.body).replace(/^<body[^>]*>|<\/body>$/g, '');

    if (headTagsToAdd) {
        finalHtml = headTagsToAdd.trim() + '\n\n' + finalHtml;
    }

    if (options.minifyInlineCSSJS) {
      finalHtml = finalHtml.replace(/<style.*?>([\s\S]*?)<\/style>/gi, (match, css) => {
        const minifiedCss = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
        return `<style>${minifiedCss}</style>`;
      });
      finalHtml = finalHtml.replace(/<script.*?>([\s\S]*?)<\/script>/gi, (match, js) => {
        if (match.includes('src=')) return match;
        const minifiedJs = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '').replace(/\s+/g, ' ').trim();
        return `<script>${minifiedJs}</script>`;
      });
    }

    if (options.collapseWhitespace) {
        finalHtml = finalHtml.replace(/>\s+</g, '><').trim();
    }
    
    if (hasLazyEmbeds) {
        finalHtml += lazyLoadScript;
    }

    const cleanedBytes = new TextEncoder().encode(finalHtml).length;
    const cleanedNodeCount = new DOMParser().parseFromString(finalHtml, 'text/html').getElementsByTagName('*').length;
    nodesRemovedCount += (originalNodeCount - cleanedNodeCount);

    const bytesSaved = originalBytes - cleanedBytes;
    const estimatedSpeedGain = (bytesSaved / 1024 / 10).toFixed(2);

    const summary = {
        originalBytes,
        cleanedBytes,
        bytesSaved,
        nodesRemoved: nodesRemovedCount > 0 ? nodesRemovedCount : 0,
        estimatedSpeedGain: estimatedSpeedGain,
    };
    
    setIsCleaning(false);
    return { cleanedHtml: finalHtml, summary };
  }, []);

  return { isCleaning, cleanHtml };
};
