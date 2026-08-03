import re
import sys

def patch_app_js():
    with open('/root/Amy-fx/app/src/main/assets/apps/journal/app.js', 'r') as f:
        content = f.read()

    # Add bgVideoState and helper functions
    helpers = """
window.bgVideoState = { allowBackground: true, loop: true, activeItemId: null, nativeUriCache: {} };

async function ensureNativeVideoUri(item) {
    if (!window.Android?.playVideo) return null;
    if (bgVideoState.nativeUriCache[item.id]) return bgVideoState.nativeUriCache[item.id];
    
    let uri = "";
    const source = await getFullscreenFeedSource(item);
    if (!source) return null;
    
    if (source.startsWith("blob:")) {
        const record = await getFileRecord(item.fileId);
        if (record && record.blob) {
            window.Android.startVideoTransfer(item.id);
            const CHUNK_SIZE = 1024 * 512;
            for (let i = 0; i < record.blob.size; i += CHUNK_SIZE) {
                const chunk = record.blob.slice(i, i + CHUNK_SIZE);
                await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const b64 = reader.result.split(',')[1];
                        if (window.Android) window.Android.appendVideoChunk(item.id, b64);
                        resolve();
                    };
                    reader.readAsDataURL(chunk);
                });
            }
            if (window.Android) uri = window.Android.finishVideoTransfer(item.id);
        }
    } else {
        uri = source;
    }
    bgVideoState.nativeUriCache[item.id] = uri;
    return uri;
}

function stopNativeVideoIfPlaying(videoId) {
    if (window.Android?.getBackgroundVideoId) {
        if (window.Android.getBackgroundVideoId() === videoId) {
            window.Android.stopVideo();
        }
    }
}
"""
    if "window.bgVideoState =" not in content:
        content = content.replace("function setupVideoCompletionTracking", helpers + "\nfunction setupVideoCompletionTracking")

    # Patch closeFullscreenViewer
    old_close = """function closeFullscreenViewer() {
  const media = dom.fullscreenStage.querySelector("video, audio");
  if (media) media.pause();"""
    
    new_close = """function closeFullscreenViewer() {
  const media = dom.fullscreenStage.querySelector("video, audio");
  if (media && !media.paused && bgVideoState.allowBackground && state.activeFullscreenItem && window.Android?.playVideo) {
      const item = state.activeFullscreenItem;
      ensureNativeVideoUri(item).then(uri => {
          if (uri) window.Android.playVideo(item.id, uri, item.title || "Video", Math.floor(media.currentTime * 1000), bgVideoState.loop);
      });
  } else if (media && window.Android?.stopVideo) {
      window.Android.stopVideo();
  }
  if (media) media.pause();"""
    
    content = content.replace(old_close, new_close)

    # Patch visibilitychange
    vis_change = """  document.addEventListener('visibilitychange',function(){
    if(!document.hidden){"""
    
    new_vis_change = """  document.addEventListener('visibilitychange',function(){
    if (document.hidden) {
        const activeVideo = document.querySelector('.fullscreen-video-feed video');
        if (activeVideo && !activeVideo.paused && bgVideoState.allowBackground && state.activeFullscreenItem && window.Android?.playVideo) {
            const item = state.activeFullscreenItem;
            ensureNativeVideoUri(item).then(uri => {
                if (uri) window.Android.playVideo(item.id, uri, item.title || "Video", Math.floor(activeVideo.currentTime * 1000), bgVideoState.loop);
            });
            activeVideo.pause();
            activeVideo.dataset.wasPlaying = "true";
        }
    } else {
        const activeVideo = document.querySelector('.fullscreen-video-feed video');
        if (activeVideo && activeVideo.dataset.wasPlaying === "true" && window.Android?.getBackgroundVideoId) {
            if (window.Android.getBackgroundVideoId() === state.activeFullscreenItem?.id) {
                const pos = window.Android.getVideoPosition() / 1000;
                activeVideo.currentTime = pos;
                activeVideo.play().catch(()=>{});
                window.Android.stopVideo();
            }
            activeVideo.dataset.wasPlaying = "false";
        }
    }
    if(!document.hidden){"""
    
    content = content.replace(vis_change, new_vis_change)

    # Patch renderVideoFeed to use custom controls
    old_render = """      const video = document.createElement("video");
      video.className = "fullscreen-video feed-video";
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = source;
      setupVideoCompletionTracking(video, videoItem);
      panel.append(video);"""
      
    new_render = """      const video = document.createElement("video");
      video.className = "fullscreen-video feed-video";
      video.controls = false;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = source;
      video.loop = bgVideoState.loop;
      setupVideoCompletionTracking(video, videoItem);
      
      const controls = document.createElement("div");
      controls.className = "custom-video-controls";
      controls.innerHTML = `
        <button class="v-play-btn">▶</button>
        <span class="v-time">0:00</span>
        <input type="range" class="v-seek" min="0" max="100" value="0" />
        <span class="v-duration">0:00</span>
        <button class="v-loop-btn" style="color: ${bgVideoState.loop ? '#39ff88' : '#fff'}">🔁</button>
        <button class="v-bg-btn" style="color: ${bgVideoState.allowBackground ? '#39ff88' : '#fff'}">📱</button>
        <button class="v-stop-btn">🛑</button>
      `;
      
      const playBtn = controls.querySelector('.v-play-btn');
      const seek = controls.querySelector('.v-seek');
      const timeStr = controls.querySelector('.v-time');
      const durStr = controls.querySelector('.v-duration');
      const loopBtn = controls.querySelector('.v-loop-btn');
      const bgBtn = controls.querySelector('.v-bg-btn');
      const stopBtn = controls.querySelector('.v-stop-btn');
      
      const formatTime = (s) => {
          if(isNaN(s)) return "0:00";
          const m = Math.floor(s/60);
          const sec = Math.floor(s%60).toString().padStart(2,'0');
          return `${m}:${sec}`;
      };
      
      video.addEventListener('timeupdate', () => {
          if (video.duration) {
              seek.value = (video.currentTime / video.duration) * 100;
              timeStr.textContent = formatTime(video.currentTime);
          }
      });
      video.addEventListener('loadedmetadata', () => {
          durStr.textContent = formatTime(video.duration);
          // Check if native is playing this video
          if (window.Android?.getBackgroundVideoId) {
              if (window.Android.getBackgroundVideoId() === videoItem.id && window.Android.getVideoStatus() !== "idle") {
                  video.currentTime = window.Android.getVideoPosition() / 1000;
                  if (window.Android.getVideoStatus() === "playing") video.play().catch(()=>{});
                  window.Android.stopVideo();
              }
          }
      });
      video.addEventListener('play', () => { playBtn.textContent = '⏸'; ensureNativeVideoUri(videoItem); });
      video.addEventListener('pause', () => { playBtn.textContent = '▶'; });
      
      playBtn.onclick = () => video.paused ? video.play() : video.pause();
      seek.oninput = (e) => { video.currentTime = (e.target.value / 100) * (video.duration||0); };
      
      loopBtn.onclick = () => {
          bgVideoState.loop = !bgVideoState.loop;
          video.loop = bgVideoState.loop;
          loopBtn.style.color = bgVideoState.loop ? '#39ff88' : '#fff';
      };
      
      bgBtn.onclick = () => {
          bgVideoState.allowBackground = !bgVideoState.allowBackground;
          bgBtn.style.color = bgVideoState.allowBackground ? '#39ff88' : '#fff';
      };
      
      stopBtn.onclick = () => {
          video.pause();
          video.currentTime = 0;
          if (window.Android?.stopVideo) window.Android.stopVideo();
          closeFullscreenViewer();
      };
      
      panel.append(video);
      panel.append(controls);"""
      
    content = content.replace(old_render, new_render)

    with open('/root/Amy-fx/app/src/main/assets/apps/journal/app.js', 'w') as f:
        f.write(content)
        
    print("app.js patched successfully")

if __name__ == '__main__':
    patch_app_js()
