/**
 * camera.js
 * ---------
 * Handles browser camera access and waits until
 * the video stream is actually ready before capture.
 */

(function () {

  let activeStream = null;

  function isSupported() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
  }

  async function start(videoEl) {

    if (!isSupported()) {
      throw new Error("Camera API not supported in this browser.");
    }

    const constraints = {
      video: {
        facingMode: {
          ideal: "environment"
        }
      },
      audio: false
    };

    activeStream =
      await navigator.mediaDevices.getUserMedia(constraints);

    videoEl.srcObject = activeStream;
    videoEl.muted = true;
    videoEl.playsInline = true;

    await videoEl.play();

    // Wait until the browser has actual video data.
    if (
      videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      videoEl.videoWidth === 0 ||
      videoEl.videoHeight === 0
    ) {

      await new Promise((resolve, reject) => {

        let finished = false;

        function cleanup() {
          videoEl.removeEventListener("loadedmetadata", onReady);
          videoEl.removeEventListener("canplay", onReady);
          videoEl.removeEventListener("playing", onReady);
        }

        function onReady() {

          if (finished) return;

          if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {

            finished = true;
            cleanup();
            resolve();

          }
        }

        videoEl.addEventListener(
          "loadedmetadata",
          onReady
        );

        videoEl.addEventListener(
          "canplay",
          onReady
        );

        videoEl.addEventListener(
          "playing",
          onReady
        );

        // Safety timeout
        setTimeout(() => {

          if (finished) return;

          if (
            videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            videoEl.videoWidth > 0 &&
            videoEl.videoHeight > 0
          ) {

            finished = true;
            cleanup();
            resolve();

          } else {

            finished = true;
            cleanup();
            reject(
              new Error("Camera stream did not become ready.")
            );

          }

        }, 5000);

      });
    }

    return true;
  }


  function stop() {

    if (activeStream) {

      activeStream
        .getTracks()
        .forEach((track) => track.stop());

      activeStream = null;
    }
  }


  function isReady(videoEl) {

    return (
      videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      videoEl.videoWidth > 0 &&
      videoEl.videoHeight > 0
    );
  }


  function capture(videoEl, canvasEl) {

    if (!isReady(videoEl)) {
      throw new Error("Camera video is not ready.");
    }

    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;

    canvasEl.width = width;
    canvasEl.height = height;

    const ctx = canvasEl.getContext("2d");

    ctx.drawImage(
      videoEl,
      0,
      0,
      width,
      height
    );

    return canvasEl;
  }


  window.SmartChefCamera = {
    isSupported,
    start,
    stop,
    isReady,
    capture
  };

})();