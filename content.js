(() => {
  const subtitleTracks = new WeakMap();

  function getVideo() {
    const videos = [...document.querySelectorAll('video')].filter((video) => {
      const bounds = video.getBoundingClientRect();
      const style = window.getComputedStyle(video);
      return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    return videos.sort((first, second) => {
      const firstBounds = first.getBoundingClientRect();
      const secondBounds = second.getBoundingClientRect();
      return secondBounds.width * secondBounds.height - firstBounds.width * firstBounds.height;
    })[0];
  }

  function formatVtt(text, filename) {
    const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    if (!normalized) throw new Error('ملف الترجمة فارغ.');
    if (/\.vtt$/i.test(filename) || /^WEBVTT(?:\s|$)/i.test(normalized)) {
      return normalized.startsWith('WEBVTT') ? normalized : `WEBVTT\n\n${normalized}`;
    }
    return `WEBVTT\n\n${normalized.replace(/(\d{2}:\d{2}:\d{2}),([\d]{3})/g, '$1.$2').replace(/(\d{2}:\d{2}),([\d]{3})/g, '$1.$2')}`;
  }

  function installCaptionStyles() {
    if (document.querySelector('#arabic-video-cue-style')) return;
    const style = document.createElement('style');
    style.id = 'arabic-video-cue-style';
    style.textContent = `
      video:fullscreen {
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        object-fit: contain !important;
        background: #000 !important;
      }
      video::cue {
        direction: rtl;
        unicode-bidi: plaintext;
        text-align: center;
        font-family: sans-serif;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function loadSubtitles(video, filename, text) {
    const vtt = formatVtt(text, filename);
    const previousTrack = subtitleTracks.get(video);
    if (previousTrack) {
      URL.revokeObjectURL(previousTrack.url);
      previousTrack.element.remove();
    }
    const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt;charset=utf-8' }));
    const track = document.createElement('track');
    track.kind = 'captions';
    track.label = 'العربية';
    track.srclang = 'ar';
    track.default = true;
    track.src = url;
    video.appendChild(track);
    track.track.mode = 'showing';
    subtitleTracks.set(video, { element: track, url });
    installCaptionStyles();
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_VIDEO_INFO') {
      const video = getVideo();
      sendResponse(video ? {
        found: true,
        currentTime: video.currentTime,
        duration: video.duration,
        paused: video.paused
      } : { found: false });
      return;
    }
    if (request.type === 'ENTER_FULLSCREEN') {
      const video = getVideo();
      if (!video) {
        sendResponse({ ok: false, error: 'لم يتم العثور على فيديو في الصفحة.' });
        return;
      }
      installCaptionStyles();
      if (!video.requestFullscreen) {
        sendResponse({ ok: false, error: 'ملء الشاشة غير مدعوم لهذا الفيديو.' });
        return;
      }
      video.requestFullscreen().then(() => sendResponse({ ok: true })).catch(() => {
        sendResponse({ ok: false, error: 'تعذر تشغيل ملء الشاشة.' });
      });
      return true;
    }
    if (request.type === 'LOAD_ARABIC_SUBTITLES') {
      const video = getVideo();
      if (!video) {
        sendResponse({ ok: false, error: 'لم يتم العثور على فيديو في الصفحة.' });
        return;
      }
      try {
        loadSubtitles(video, request.name, request.text);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || 'صيغة ملف الترجمة غير صالحة.' });
      }
    }
  });
})();