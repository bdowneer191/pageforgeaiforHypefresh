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

    // YouTube - Fixed implementation with proper facade
    doc.querySelectorAll('iframe[src*="youtube.com/embed/"], iframe[src*="youtube-nocookie.com/embed/"]').forEach(iframe => {
        const src = iframe.getAttribute('src');
        if (!src) return;
        const videoIdMatch = src.match(/embed\/([^?&/]+)/);
        if (!videoIdMatch?.[1]) return;
        const videoId = videoIdMatch[1];
        
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-youtube-facade';
        placeholder.setAttribute('data-video-id', videoId);
        placeholder.setAttribute('data-original-src', src);
        
        const width = iframe.getAttribute('width') || '560';
        const height = iframe.getAttribute('height') || '315';

        Object.assign(placeholder.style, {
            position: 'relative',
            cursor: 'pointer',
            width: '100%',
            maxWidth: `${width}px`,
            aspectRatio: `${width} / ${height}`,
            backgroundImage: `url(https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '12px',
            overflow: 'hidden',
            margin: '1rem auto',
            border: '1px solid #374151',
            backgroundColor: '#000'
        });

        placeholder.innerHTML = `
            <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);pointer-events:none;">
                <div style="display:flex;flex-direction:column;align-items:center;color:#fff;">
                    <svg style="width:68px;height:48px;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.8));margin-bottom:12px;" viewBox="0 0 68 48">
                        <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path>
                        <path d="M 45,24 27,14 27,34" fill="#fff"></path>
                    </svg>
                    <div style="text-align:center;padding:8px 16px;background:rgba(0,0,0,0.7);border-radius:20px;font-size:14px;font-weight:500;border:1px solid rgba(255,255,255,0.2);">
                        Load YouTube Video
                    </div>
                </div>
            </div>
        `;
        iframe.parentNode?.replaceChild(placeholder, iframe);
        embedsFound++;
    });

    // Twitter - Enhanced facade
    doc.querySelectorAll('blockquote.twitter-tweet').forEach(tweet => {
        const nextSibling = tweet.nextElementSibling;
        if (nextSibling instanceof HTMLScriptElement && nextSibling.src.includes('platform.twitter.com')) {
            nextSibling.remove();
        }

        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-tweet-facade';

        const tweetText = tweet.querySelector('p')?.textContent || 'A post from X.';
        const authorMatch = (tweet.textContent || '').match(/— (.*?) \(@/);
        const authorName = authorMatch ? authorMatch[1] : 'X User';
        
        Object.assign(placeholder.style, {
            border: '1px solid #2f3349',
            borderRadius: '16px',
            padding: '20px',
            cursor: 'pointer',
            backgroundColor: '#16181c',
            color: '#e7e9ea',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            fontSize: '15px',
            lineHeight: '1.4',
            maxWidth: '550px',
            margin: '1rem auto',
            transition: 'all 0.2s ease',
            position: 'relative'
        });
        
        placeholder.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 12px; pointer-events: none;">
            <div style="width: 48px; height: 48px; background: linear-gradient(45deg, #1d9bf0, #1a8cd8); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px;">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="white" style="width: 20px; height: 20px;"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>
            </div>
            <div>
              <div style="font-weight: 700; color: #e7e9ea; font-size: 15px;">${authorName}</div>
              <div style="color: #71767b; font-size: 14px; margin-top: 1px;">@${authorName.toLowerCase().replace(/\s/g, '')}</div>
            </div>
          </div>
          <p style="margin: 0 0 16px 0; color: #e7e9ea; pointer-events: none; white-space: pre-wrap;">${tweetText.length > 200 ? tweetText.substring(0, 200) + '…' : tweetText}</p>
          <div style="text-align: center; padding: 12px 24px; background: #1d9bf0; border-radius: 50px; font-weight: 700; color: white; pointer-events: none; transition: background-color 0.2s;">
            Load X Post
          </div>
          <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; border-radius: 18px; background: linear-gradient(45deg, #1d9bf0, #1a8cd8); opacity: 0; transition: opacity 0.2s; pointer-events: none; z-index: -1;" class="hover-glow"></div>
        `;
        
        const tweetHtml = btoa(unescape(encodeURIComponent(tweet.outerHTML)));
        placeholder.setAttribute('data-tweet-html', tweetHtml);
        tweet.parentNode?.replaceChild(placeholder, tweet);
        embedsFound++;
    });

    // Instagram - Enhanced facade
    doc.querySelectorAll('blockquote.instagram-media').forEach(insta => {
        const nextSibling = insta.nextElementSibling;
        if (nextSibling instanceof HTMLScriptElement && nextSibling.src.includes('instagram.com/embed.js')) {
            nextSibling.remove();
        }
        
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-instagram-facade';
        
        const instaHtml = btoa(unescape(encodeURIComponent(insta.outerHTML)));
        placeholder.setAttribute('data-insta-html', instaHtml);
        
        Object.assign(placeholder.style, {
            position: 'relative',
            cursor: 'pointer',
            width: '100%',
            maxWidth: '540px',
            margin: '1rem auto',
            border: '1px solid #dbdbdb',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            aspectRatio: '1/1.1',
            background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            color: 'white',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            transition: 'transform 0.2s ease'
        });
        
        placeholder.innerHTML = `
            <div style="pointer-events: none; text-align: center;">
                <svg style="width:48px;height:48px;margin-bottom:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
                <div style="font-size:18px;font-weight:600;margin-bottom:8px;">Instagram Post</div>
                <div style="padding:10px 20px;background:rgba(255,255,255,0.2);border-radius:25px;font-weight:500;backdrop-filter:blur(10px);">
                    Load Content
                </div>
            </div>
        `;
        insta.parentNode?.replaceChild(placeholder, insta);
        embedsFound++;
    });

    // TikTok - New enhanced implementation
    doc.querySelectorAll('blockquote.tiktok-embed').forEach(tiktok => {
        const nextSibling = tiktok.nextElementSibling;
        if (nextSibling instanceof HTMLScriptElement && nextSibling.src.includes('tiktok.com/embed.js')) {
            nextSibling.remove();
        }

        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-tiktok-facade';
        
        Object.assign(placeholder.style, {
            border: '2px solid #25f4ee',
            borderRadius: '16px',
            padding: '20px',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
            color: '#ffffff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '15px',
            lineHeight: '1.4',
            maxWidth: '325px',
            margin: '1rem auto',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
        });

        const tiktokText = tiktok.textContent?.trim() || '';
        const captionMatch = tiktokText.match(/@[\w.]+ (.*?)(?= - |$)/);
        const caption = captionMatch ? captionMatch[1] : 'TikTok video';
        const authorMatch = tiktokText.match(/@([\w.]+)/);
        const author = authorMatch ? authorMatch[1] : 'tiktokuser';

        placeholder.innerHTML = `
            <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(45deg, #25f4ee, #fe2c55);opacity:0.1;"></div>
            <div style="position:relative;z-index:1;pointer-events:none;">
                <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                    <div style="width:40px;height:40px;background:#25f4ee;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-right:12px;">
                        <svg style="width:24px;height:24px;color:#000;" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                        </svg>
                    </div>
                    <div style="text-align:left;">
                        <div style="font-weight:700;font-size:16px;margin-bottom:2px;">@${author}</div>
                        <div style="color:#25f4ee;font-size:14px;">TikTok Video</div>
                    </div>
                </div>
                <p style="margin: 0 0 20px 0; color: #ffffff; font-size:14px; opacity:0.9;">${caption.length > 80 ? caption.substring(0, 80) + '…' : caption}</p>
                <div style="padding: 12px 24px; background: linear-gradient(135deg, #25f4ee, #fe2c55); border-radius: 25px; font-weight: 700; color: #000; display: inline-block;">
                    ▶ Load Video
                </div>
            </div>
        `;
        const tiktokHtml = btoa(unescape(encodeURIComponent(tiktok.outerHTML)));
        placeholder.setAttribute('data-tiktok-html', tiktokHtml);
        tiktok.parentNode?.replaceChild(placeholder, tiktok);
        embedsFound++;
    });
    
    // Reddit - Enhanced implementation
    doc.querySelectorAll('blockquote.reddit-card, iframe[src*="reddit.com/embed"]').forEach(card => {
        const nextSibling = card.nextElementSibling;
        if (nextSibling instanceof HTMLScriptElement && nextSibling.src.includes('embed.reddit.com')) {
            nextSibling.remove();
        }
        
        const placeholder = doc.createElement('div');
        placeholder.className = 'lazy-reddit-facade';
        
        Object.assign(placeholder.style, {
            border: '1px solid #343536',
            borderRadius: '12px',
            padding: '20px',
            cursor: 'pointer',
            backgroundColor: '#1a1a1b',
            color: '#d7dadc',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            maxWidth: '550px',
            margin: '1rem auto',
            position: 'relative',
            transition: 'all 0.2s ease'
        });

        const redditText = card.textContent?.trim() || '';
        const titleMatch = redditText.match(/r\/\w+.*?(?=submitted|Posted)/);
        const title = titleMatch ? titleMatch[0] : 'Reddit Post';
        const subredditMatch = redditText.match(/r\/(\w+)/);
        const subreddit = subredditMatch ? subredditMatch[1] : 'reddit';
        
        placeholder.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 16px; pointer-events: none;">
                <div style="width: 40px; height: 40px; background: #ff4500; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" style="width: 20px; height: 20px;">
                        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                    </svg>
                </div>
                <div>
                    <div style="font-weight: 700; color: #d7dadc; font-size: 15px;">r/${subreddit}</div>
                    <div style="color: #818384; font-size: 12px;">Reddit Post</div>
                </div>
            </div>
            <p style="margin: 0 0 16px 0; color: #d7dadc; pointer-events: none; font-weight: 500;">${title.length > 120 ? title.substring(0, 120) + '…' : title}</p>
            <div style="text-align: center; padding: 10px 20px; background: #ff4500; border-radius: 20px; font-weight: 700; color: white; pointer-events: none; transition: background-color 0.2s;">
                Load Reddit Post
            </div>
        `;
    
        const cardHtml = btoa(unescape(encodeURIComponent(card.outerHTML)));
        placeholder.setAttribute('data-reddit-html', cardHtml);
        card.parentNode?.replaceChild(placeholder, card);
        embedsFound++;
    });
    
    if (embedsFound > 0) {
      actionLog.push(`Created lazy-load facades for ${embedsFound} social media embed(s).`);
    }
};

const lazyLoadScript = `<script id="pageforge-lazy-loader">(function(){"use strict";if(window.pageforgeLazyLoaderInitialized)return;window.pageforgeLazyLoaderInitialized=!0;function e(e,t,c){const d=document.getElementById(e);if(d)return void(c&&c());const n=document.createElement("script");n.id=e,n.src=t,n.async=!0,c&&(n.onload=c),document.head.appendChild(n)}function addHoverEffects(){document.querySelectorAll('.lazy-tweet-facade').forEach(el=>{el.addEventListener('mouseenter',()=>{el.style.borderColor='#1d9bf0';el.style.transform='translateY(-2px)';el.style.boxShadow='0 8px 25px rgba(29,155,240,0.15)';const glow=el.querySelector('.hover-glow');if(glow)glow.style.opacity='0.1';});el.addEventListener('mouseleave',()=>{el.style.borderColor='#2f3349';el.style.transform='translateY(0)';el.style.boxShadow='none';const glow=el.querySelector('.hover-glow');if(glow)glow.style.opacity='0';});});document.querySelectorAll('.lazy-instagram-facade').forEach(el=>{el.addEventListener('mouseenter',()=>{el.style.transform='scale(1.02)';el.style.boxShadow='0 10px 30px rgba(240,148,51,0.2)';});el.addEventListener('mouseleave',()=>{el.style.transform='scale(1)';el.style.boxShadow='none';});});document.querySelectorAll('.lazy-tiktok-facade').forEach(el=>{el.addEventListener('mouseenter',()=>{el.style.borderColor='#fe2c55';el.style.transform='translateY(-3px) scale(1.02)';el.style.boxShadow='0 10px 30px rgba(254,44,85,0.2)';});el.addEventListener('mouseleave',()=>{el.style.borderColor='#25f4ee';el.style.transform='translateY(0) scale(1)';el.style.boxShadow='none';});});document.querySelectorAll('.lazy-reddit-facade').forEach(el=>{el.addEventListener('mouseenter',()=>{el.style.borderColor='#ff4500';el.style.transform='translateY(-2px)';el.style.boxShadow='0 8px 25px rgba(255,69,0,0.15)';});el.addEventListener('mouseleave',()=>{el.style.borderColor='#343536';el.style.transform='translateY(0)';el.style.boxShadow='none';});});document.querySelectorAll('.lazy-youtube-facade').forEach(el=>{el.addEventListener('mouseenter',()=>{el.style.transform='scale(1.02)';el.style.boxShadow='0 10px 30px rgba(255,0,0,0.2)';});el.addEventListener('mouseleave',()=>{el.style.transform='scale(1)';el.style.boxShadow='none';});});}function t(t){if(t.matches(".lazy-youtube-facade")){const videoId=t.getAttribute('data-video-id');const originalSrc=t.getAttribute('data-original-src');if(!videoId||!originalSrc)return;const d=document.createElement("iframe");const n=new URL(originalSrc.startsWith("//")?("https:"+originalSrc):originalSrc);n.searchParams.set("autoplay","1");n.searchParams.set("rel","0");d.setAttribute("src",n.toString());d.setAttribute("frameborder","0");d.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");d.setAttribute("allowfullscreen","");d.style.cssText="width:100%;height:100%;border-radius:12px;";const wrapper=document.createElement('div');wrapper.style.cssText="position:relative;width:100%;max-width:"+t.style.maxWidth+";aspect-ratio:"+t.style.aspectRatio+";margin:1rem auto;";wrapper.appendChild(d);t.parentNode?.replaceChild(wrapper,t);return}const c=t.parentNode;if(!c)return;let d,n,o,r,a;if(t.matches(".lazy-tweet-facade"))d="tweet",n="data-tweet-html",o="twitter-wjs",r="https://platform.twitter.com/widgets.js",a=()=>window.twttr&&window.twttr.widgets&&window.twttr.widgets.load(c);else if(t.matches(".lazy-instagram-facade"))d="instagram",n="data-insta-html",o="instagram-embed-script",r="https://www.instagram.com/embed.js",a=()=>window.instgrm&&window.instgrm.Embeds.process();else if(t.matches(".lazy-tiktok-facade"))d="tiktok",n="data-tiktok-html",o="tiktok-embed-script",r="https://www.tiktok.com/embed.js",a=null;else if(t.matches(".lazy-reddit-facade"))d="reddit",n="data-reddit-html",o="reddit-widgets-js",r="https://embed.reddit.com/widgets.js",a=null;else return;if(!d)return;const i=t.getAttribute(n);if(!i)return;try{const s=decodeURIComponent(escape(window.atob(i))),l=document.createElement("div");l.innerHTML=s;const m=l.firstChild;m&&(c.replaceChild(m,t),r&&e(o,r,a))}catch(error){console.error("Error loading social media embed:",error)}}document.addEventListener("click",function(e){const target=e.target.closest(".lazy-youtube-facade, .lazy-tweet-facade, .lazy-instagram-facade, .lazy-tiktok-facade, .lazy-reddit-facade");target&&t(target)});document.addEventListener("DOMContentLoaded",addHoverEffects);addHoverEffects()})();</script>`;


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
    const preCleanedHtml = html.replace(/<script[^>]*>[\s\S]*?(lazy-youtube-embed|pageforge-lazy-loader)[\s\S]*?<\/script>/g, '');
    
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
        if (doc.querySelector('.lazy-youtube-facade, .lazy-tweet-facade, .lazy-instagram-facade, .lazy-tiktok-facade, .lazy-reddit-facade')) {
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
            if (!img.hasAttribute('width') && !img.hasAttribute('height')) {
                const match = img.src.match(/-(\d+)[xX](\d+)\.(jpg|jpeg|png|webp|gif)/);
                if (match && match[1] && match[2]) {
                    img.setAttribute('width', match[1]);
                    img.setAttribute('height', match[2]);
                    sizedCount++;
                }
            }

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
        doc.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com/css"]').forEach(link => {
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
        doc.querySelectorAll('link[href]').forEach(link => {
            try {
                const href = link.getAttribute('href');
                if (!href) return;
                const url = new URL(href);
                if (!processedOrigins.has(url.origin) && (url.protocol === 'http:' || url.protocol === 'https:')) {
                    if(doc.querySelector(`link[rel="preconnect"][href="${url.origin}"]`)) return;
                    
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
            } catch (e) { /* ignore invalid urls */ }
        });
        if(hintCount > 0) actionLog.push(`Added ${hintCount} preconnect hint(s) for faster connections.`);
    }

    if (effectiveOptions.optimizeCssLoading) {
        let cssCount = 0;
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(stylesheet => {
            if (stylesheet.getAttribute('href')?.includes('fonts.googleapis.com')) return;
            if (stylesheet.getAttribute('media') === 'print') return;
            
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
      let cssMinified = false;
      let jsMinified = false;
      finalHtml = finalHtml.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (match, p1, css) => {
        const minifiedCss = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(\r\n|\n|\r)/gm, "").replace(/\s+/g, ' ').trim();
        if(css.length > minifiedCss.length) cssMinified = true;
        return `<style${p1}>${minifiedCss}</style>`;
      });
      finalHtml = finalHtml.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, p1, js) => {
        if (match.includes('src=') || match.includes('pageforge-lazy-loader')) return match;
        const minifiedJs = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '').replace(/\s+/g, ' ').trim();
        if(js.length > minifiedJs.length) jsMinified = true;
        return `<script${p1}>${minifiedJs}</script>`;
      });
      if(cssMinified) actionLog.push('Minified inline CSS.');
      if(jsMinified) actionLog.push('Minified inline JS.');
    }

    if (effectiveOptions.collapseWhitespace) {
        finalHtml = finalHtml.replace(/>\s+</g, '><').trim();
    }
    
    if (hasLazyEmbeds && !finalHtml.includes('id="pageforge-lazy-loader"')) {
        finalHtml = finalHtml.replace('</body>', `${lazyLoadScript}</body>`);
    }

    const cleanedBytes = new TextEncoder().encode(finalHtml).length;
    const finalDocForCount = parser.parseFromString(finalHtml, 'text/html');
    const cleanedNodeCount = finalDocForCount.querySelectorAll('*').length;
    const nodesRemoved = Math.max(0, originalNodeCount - cleanedNodeCount);
    const bytesSaved = Math.max(0, originalBytes - cleanedBytes);

    if(bytesSaved > 0 && !actionLog.some(l => l.includes('Minified'))) {
        actionLog.push(`Reduced whitespace and performed other minor minifications.`);
    }

    const summary: ImpactSummary = {
        originalBytes,
        cleanedBytes,
        bytesSaved,
        nodesRemoved,
        estimatedSpeedGain: originalBytes > 0 ? `${((bytesSaved / originalBytes) * 100).toFixed(1)}% size reduction` : '0.0% size reduction',
        actionLog: actionLog.length > 0 ? actionLog : ['No applicable optimizations found for the selected options.']
    };
    
    setIsCleaning(false);
    return { cleanedHtml: finalHtml, summary, effectiveOptions };
  }, []);

  return { isCleaning, cleanHtml };
};
