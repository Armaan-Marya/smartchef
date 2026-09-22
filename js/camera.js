/**
 * camera.js
 * ---------
 * Wraps the browser's MediaDevices.getUserMedia() API (the "advanced
 * technology" named in the Task 7.3HD proposal) so the rest of the app
 * doesn't need to know about streams, tracks or permissions directly.
 *
 * Exposes a small SmartChefCamera object on window with:
 *   - isSupported()      -> boolean
 *   - start(videoEl)     -> Promise<void>   starts the camera into <video>
 *   - stop()             -> void            stops all tracks (privacy: we
 *                                            never keep the camera running
 *                                            longer than the user needs it)
 *   - capture(videoEl, canvasEl) -> HTMLCanvasElement  grabs a still frame
 */
(function () {
  let activeStream = null;

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async function start(videoEl) {
    if (!isSupported()) {
      throw new Error("Camera API not supported in this browser.");
    }
    // Ask for a rear-facing camera first (better for photographing
    // ingredients on a bench); browsers that don't support facingMode
    // simply ignore the hint and fall back to any available camera.
    const constraints = {
      video: { facingMode: { ideal: "environment" } },
      audio: false
    };

    activeStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = activeStream;
    await videoEl.play();
  }

  function stop() {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
  }

  function capture(videoEl, canvasEl) {
    const width = videoEl.videoWidth || 480;
    const height = videoEl.videoHeight || 480;
    canvasEl.width = width;
    canvasEl.height = height;
    const ctx = canvasEl.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, width, height);
    return canvasEl;
  }

  window.SmartChefCamera = { isSupported, start, stop, capture };
})();
