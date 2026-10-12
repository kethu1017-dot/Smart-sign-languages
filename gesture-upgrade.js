/* SMART SIGN LANGUAGE COMMUNICATOR
   GESTURE UPGRADE
   Camera + Video + Sentence + Tamil/English
*/

const cameraWords = [];
const uploadWords = [];

let cameraLastWord = "";
let uploadLastWord = "";
let cameraCount = 0;
let uploadCount = 0;
let cameraReady = true;
let uploadReady = true;

const gestureWords = [
  "YES",
  "NO",
  "STOP",
  "HELLO",
  "GOOD",
  "BAD",
  "I",
  "YOU",
  "PLEASE",
  "I LOVE YOU"
];

/* BASIC HAND GESTURE RECOGNITION */

function recognizeTenGestures(l) {
  if (!l || l.length < 21) return null;

  const up = (tip, pip) => l[tip].y < l[pip].y - 0.035;

  const index = up(8, 6);
  const middle = up(12, 10);
  const ring = up(16, 14);
  const pinky = up(20, 18);

  const thumb =
    Math.hypot(
      l[4].x - l[17].x,
      l[4].y - l[17].y
    ) >
    Math.hypot(
      l[3].x - l[17].x,
      l[3].y - l[17].y
    ) * 1.15;

  const count =
    [index, middle, ring, pinky].filter(Boolean).length;

  if (count === 0 && thumb) return "YES";

  if (count === 0) return "BAD";

  if (count === 4 && thumb) return "HELLO";

  if (count === 4) return "STOP";

  if (index && middle && !ring && !pinky)
    return "NO";

  if (index && !middle && !ring && !pinky)
    return "YOU";

  if (!index && !middle && !ring && pinky)
    return "I";

  if (index && !middle && !ring && pinky && thumb)
    return "I LOVE YOU";

  if (!index && middle && ring && pinky)
    return "PLEASE";

  if (index && middle && ring && !pinky)
    return "GOOD";

  return null;
}

/* SENTENCE TRANSLATION */

function translateWords(words, section) {
  const lang = selectedLanguage(section);

  if (lang === "ta") {
    return words.map(word => tamil[word] || word).join(" ");
  }

  return words.join(" ");
}

function updateSentence(section) {
  const words =
    section === "camera" ? cameraWords : uploadWords;

  const id =
    section === "camera"
      ? "cameraSentence"
      : "uploadSentence";

  put(id, translateWords(words, section));
}

/* ADD WORD ONLY AFTER STABLE DETECTION */

function addGestureWord(section, word) {
  if (!word || !gestureWords.includes(word)) return;

  const isCamera = section === "camera";
  const words = isCamera ? cameraWords : uploadWords;

  let previous = isCamera ? cameraLastWord : uploadLastWord;
  let count = isCamera ? cameraCount : uploadCount;
  let ready = isCamera ? cameraReady : uploadReady;

  if (word === previous) {
    count++;
  } else {
    previous = word;
    count = 1;
  }

  if (count >= 7 && ready) {
    words.push(word);
    ready = false;
    updateSentence(section);

    if (isCamera) {
      latestGesture = word;
      renderCameraResult(word);
    } else {
      latestUploadGesture = word;
      renderUploadResult(word);
    }
  }

  if (isCamera) {
    cameraLastWord = previous;
    cameraCount = count;
    cameraReady = ready;
  } else {
    uploadLastWord = previous;
    uploadCount = count;
    uploadReady = ready;
  }
}

function resetGestureHold(section) {
  if (section === "camera") {
    cameraLastWord = "";
    cameraCount = 0;
    cameraReady = true;
  } else {
    uploadLastWord = "";
    uploadCount = 0;
    uploadReady = true;
  }
}

/* LIVE CAMERA RESULTS */

const originalCameraResults = results;

results = function(result) {
  if (!running) return;

  drawHandResults(
    result,
    document.getElementById("cameraCanvas")
      ? "cameraCanvas"
      : "drawCanvas",
    "cameraVideo"
  );

  const landmarks = result.multiHandLandmarks || [];

  put(
    "handStatus",
    landmarks.length
      ? "Hand Detection: Detected"
      : "Hand Detection: Not Detected"
  );

  const word = landmarks.length
    ? recognizeTenGestures(landmarks[0])
    : null;

  if (word) {
    addGestureWord("camera", word);
    put("aiStatus", "Gesture Recognition: Active");
  } else {
    resetGestureHold("camera");
    put("aiStatus", "Waiting for gesture");
  }
};

/* VIDEO UPLOAD ANALYSIS */

analyseUploadedVideo = async function() {
  const video = document.getElementById("uploadedVideo");

  if (!video || !video.src) {
    alert("Please upload a video first.");
    return;
  }

  stopUploadAnalysis();

  uploadWords.length = 0;
  resetGestureHold("upload");
  updateSentence("upload");

  const session = ++uploadSession;

  try {
    uploadHands = createHands(result => {
      if (!uploadAnalyzing || session !== uploadSession) return;

      const landmarks = result.multiHandLandmarks || [];

      const word = landmarks.length
        ? recognizeTenGestures(landmarks[0])
        : null;

      if (word) {
        addGestureWord("upload", word);
      } else {
        resetGestureHold("upload");
      }
    });

    uploadAnalyzing = true;
    latestUploadGesture = "";

    put("uploadResult", "Analysing video...");
    put("videoResult", "Analysing video...");

    video.currentTime = 0;
    await video.play();

    const loop = async () => {
      if (!uploadAnalyzing || session !== uploadSession) return;

      if (video.ended) {
        uploadAnalyzing = false;

        if (!uploadWords.length) {
          put("uploadResult", "No supported gesture detected.");
          put("videoResult", "No supported gesture detected.");
        }

        return;
      }

      if (
        !video.paused &&
        video.readyState >= 2 &&
        !uploadProcessing
      ) {
        uploadProcessing = true;

        try {
          await uploadHands.send({ image: video });
        } catch (error) {
          console.error(error);
        } finally {
          uploadProcessing = false;
        }
      }

      if (uploadAnalyzing && session === uploadSession) {
        requestAnimationFrame(loop);
      }
    };

    loop();
  } catch (error) {
    console.error(error);
    stopUploadAnalysis();
    put("uploadResult", "Video analysis failed.");
  }
};

/* ENGLISH / TAMIL TEXT AND VOICE */

const originalChangeLanguage = changeLanguage;

changeLanguage = function() {
  originalChangeLanguage();
  updateSentence("camera");
  updateSentence("upload");
};

speakDetected = function() {
  const lang = selectedLanguage("camera");
  const words = cameraWords.length
    ? translateWords(cameraWords, "camera")
    : latestGesture === "Waiting..."
      ? ""
      : lang === "ta"
        ? tamil[latestGesture] || latestGesture
        : latestGesture;

  speakText(words, lang);
};

speakResult = function() {
  speakDetected();
};

speakUpload = function() {
  const lang = selectedLanguage("upload");
  const words = uploadWords.length
    ? translateWords(uploadWords, "upload")
    : latestUploadGesture
      ? lang === "ta"
        ? tamil[latestUploadGesture] || latestUploadGesture
        : latestUploadGesture
      : "";

  speakText(words, lang);
};

/* CLEAR BUTTONS */

function clearCamera() {
  cameraWords.length = 0;
  resetGestureHold("camera");
  latestGesture = "Waiting...";

  renderCameraResult("");
  updateSentence("camera");

  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function clearUpload() {
  stopUploadAnalysis();

  const video = document.getElementById("uploadedVideo");
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  const input = document.getElementById("videoInput");
  if (input) input.value = "";

  if (uploadedVideoUrl) {
    URL.revokeObjectURL(uploadedVideoUrl);
    uploadedVideoUrl = null;
  }

  uploadWords.length = 0;
  resetGestureHold("upload");
  latestUploadGesture = "";

  put("videoResult", "No video selected.");
  put("uploadResult", "No video selected.");
  put("uploadTamil", "");
  updateSentence("upload");

  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function clearText() {
  const input = document.getElementById("textInput");
  if (input) input.value = "";

  const output = document.getElementById("signOutput");
  if (output) {
    output.textContent = "Your sign output will appear here.";
  }

  put("signWord", "");
  put("signTamil", "");
  put("imageError", "");

  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

/* FACE AND BODY DETECTION */

let faceDetector = null;
let bodyDetector = null;
let detectionBusy = false;
let detectionToken = 0;

async function startFaceBodyDetection() {
  const token = ++detectionToken;

  if (typeof FaceMesh === "undefined" ||
      typeof Pose === "undefined") {
    put("faceStatus", "Face Detection: Library unavailable");
    put("bodyStatus", "Body Detection: Library unavailable");
    return;
  }

  faceDetector = new FaceMesh({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  faceDetector.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceDetector.onResults(result => {
    put(
      "faceStatus",
      result.multiFaceLandmarks?.length
        ? "Face Detection: Detected"
        : "Face Detection: Not Detected"
    );
  });

  bodyDetector = new Pose({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });

  bodyDetector.setOptions({
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  bodyDetector.onResults(result => {
    put(
      "bodyStatus",
      result.poseLandmarks
        ? "Body Detection: Detected"
        : "Body Detection: Not Detected"
    );
  });

  const loop = async () => {
    if (!running || token !== detectionToken) return;

    const video = document.getElementById("cameraVideo");

    if (video?.readyState >= 2 && !detectionBusy) {
      detectionBusy = true;

      try {
        if (faceDetector) await faceDetector.send({ image: video });
        if (bodyDetector) await bodyDetector.send({ image: video });
      } catch (error) {
        console.error("Face/body detection:", error);
      } finally {
        detectionBusy = false;
      }
    }

    if (running && token === detectionToken) {
      setTimeout(loop, 200);
    }
  };

  loop();
}

const originalStartCamera = startCamera;

startCamera = async function() {
  await originalStartCamera();

  if (running) {
    startFaceBodyDetection();
  }
};

const originalStopCamera = stopCamera;

stopCamera = function() {
  detectionToken++;
  originalStopCamera();

  const oldFace = faceDetector;
  const oldBody = bodyDetector;

  faceDetector = null;
  bodyDetector = null;

  if (oldFace) Promise.resolve(oldFace.close()).catch(console.error);
  if (oldBody) Promise.resolve(oldBody.close()).catch(console.error);

  put("faceStatus", "Face Detection: Camera off");
  put("bodyStatus", "Body Detection: Camera off");
};

/* REMOVE CONFIDENCE DISPLAY */

const confidenceElement = document.getElementById("confidence");
if (confidenceElement) confidenceElement.remove();
