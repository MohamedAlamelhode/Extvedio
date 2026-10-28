const videoState = document.querySelector('#video-state');
const videoTime = document.querySelector('#video-time');
const fullscreenButton = document.querySelector('#fullscreen-button');
const subtitleFile = document.querySelector('#subtitle-file');
const message = document.querySelector('#message');
const statusDot = document.querySelector('.status-dot');

let activeTabId;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  const clock = [minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
  return hours > 0 ? `${hours}:${clock}` : clock;
}

function sendToPage(messageData) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(activeTabId, messageData, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error('تعذر الوصول إلى الفيديو في هذه الصفحة.'));
        return;
      }
      resolve(response);
    });
  });
}

async function refreshVideoInfo() {
  try {
    const info = await sendToPage({ type: 'GET_VIDEO_INFO' });
    if (!info?.found) {
      videoState.textContent = 'لم يتم العثور على فيديو في الصفحة.';
      videoTime.textContent = '--:-- / --:--';
      fullscreenButton.disabled = true;
      statusDot.classList.remove('active');
      return;
    }
    videoState.textContent = info.paused ? 'الفيديو جاهز للمشاهدة' : 'الفيديو قيد التشغيل';
    videoTime.textContent = `${formatTime(info.currentTime)} / ${formatTime(info.duration)}`;
    fullscreenButton.disabled = false;
    statusDot.classList.add('active');
  } catch (error) {
    videoState.textContent = error.message;
    videoTime.textContent = '--:-- / --:--';
    fullscreenButton.disabled = true;
    statusDot.classList.remove('active');
  }
}

fullscreenButton.addEventListener('click', async () => {
  try {
    const response = await sendToPage({ type: 'ENTER_FULLSCREEN' });
    if (!response?.ok) message.textContent = response?.error || 'تعذر تشغيل ملء الشاشة.';
  } catch (error) {
    message.textContent = error.message;
  }
});

subtitleFile.addEventListener('change', async () => {
  const file = subtitleFile.files?.[0];
  if (!file) return;
  try {
    const response = await sendToPage({
      type: 'LOAD_ARABIC_SUBTITLES',
      name: file.name,
      text: await file.text()
    });
    message.textContent = response?.ok
      ? 'تم تشغيل الترجمة العربية باتجاه من اليمين إلى اليسار.'
      : response?.error || 'تعذر تحميل ملف الترجمة.';
  } catch (error) {
    message.textContent = error.message;
  } finally {
    subtitleFile.value = '';
  }
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  activeTabId = tabs[0]?.id;
  if (activeTabId === undefined) {
    videoState.textContent = 'تعذر تحديد علامة التبويب الحالية.';
    return;
  }
  refreshVideoInfo();
  window.setInterval(refreshVideoInfo, 1000);
});