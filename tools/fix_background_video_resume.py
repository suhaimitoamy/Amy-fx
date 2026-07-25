from pathlib import Path

path = Path("app/src/main/assets/apps/journal/background-video.js")
text = path.read_text(encoding="utf-8")
old = '''      pauseOtherVideos(video);
      await video.play().catch(() => {});
      window.Android.stopBackgroundVideo();
      preparedSources.delete(nativeState.sourceKey);
      activeVideo = video;
      activeItem = findItemForVideo(video);
      updateStatus(video, "Dilanjutkan di aplikasi");'''
new = '''      pauseOtherVideos(video);
      let resumedInWebView = false;
      try {
        await video.play();
        resumedInWebView = true;
      } catch {
        try { window.Android.resumeBackgroundVideo(); } catch {}
        updateStatus(video, "Tetap diputar di latar belakang");
      }
      if (!resumedInWebView) return;
      window.Android.stopBackgroundVideo();
      preparedSources.delete(nativeState.sourceKey);
      activeVideo = video;
      activeItem = findItemForVideo(video);
      updateStatus(video, "Dilanjutkan di aplikasi");'''
count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected one resume block, found {count}")
path.write_text(text.replace(old, new), encoding="utf-8")
