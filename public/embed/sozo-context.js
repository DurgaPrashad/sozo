/* SOZO context helpers: capture is local until the host explicitly sends it. */
(() => {
  async function captureScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Screen sharing is unavailable in this browser. Upload a map image or share structured route context instead.");
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.srcObject = stream;
    try {
      await video.play();
      if (!video.videoWidth) await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; });
      const width = Math.min(1280, video.videoWidth), height = Math.round(video.videoHeight * width / video.videoWidth);
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Could not capture the selected screen.");
      context.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", 0.78);
    } finally { stream.getTracks().forEach(track => track.stop()); video.srcObject = null; }
  }
  window.SozoContext = Object.freeze({ captureScreen });
})();
