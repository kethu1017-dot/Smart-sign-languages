/* Smart Sign Language Communicator - script.js */
let stream = null;
let facingMode = 'user';
let latestGesture = 'Waiting...';
let hands = null;
let running = false;
let cameraSession = 0;
let processing = false;
let uploadedVideoUrl = null;
let uploadAnalyzing = false;
let uploadSession = 0;
let uploadHands = null;
let uploadProcessing = false;
let latestUploadGesture = '';
let lastCameraLabel = '';
let stableFrames = 0;

const signNames = [
  'I','You','Hello','Good','Bad','Yes','No','Please','Thank_You','Sorry',
  'Help','Want','Need','Eat','Drink','Water','Food','Go','Come','Home',
  'School','Friend','Happy','Sad','Understand','My','Your','Name','What','Where',
  'Who','When','Why','How','Can','Cannot','Give','Take','Here','Go_2',
  'Wait','Stop','Start','Open','Close','Today','Tomorrow','Yesterday','Morning','Night'
];
const signImages = {};
signNames.forEach((name, index) => {
  const key = name.replace(/_/g, ' ').toLowerCase();
  const number = String(index + 1).padStart(2, '0');
  signImages[key] = `image/${number}_${name}.png`;
});
const tamil = {
  'I':'நான்','YOU':'நீங்கள்','HELLO':'வணக்கம்','GOOD':'நல்லது',
  'BAD':'கெட்டது','YES':'ஆம்','NO':'இல்லை','PLEASE':'தயவுசெய்து',
  'THANK YOU':'நன்றி','SORRY':'மன்னிக்கவும்','HELP':'உதவி',
  'WANT':'வேண்டும்','NEED':'தேவை','EAT':'சாப்பிடு',
  'DRINK':'குடி','WATER':'தண்ணீர்','FOOD':'உணவு',
  'GO':'போ','COME':'வா','HOME':'வீடு','SCHOOL':'பள்ளி',
  'FRIEND':'நண்பர்','HAPPY':'மகிழ்ச்சி','SAD':'சோகம்',
  'UNDERSTAND':'புரிகிறது','MY':'என்','YOUR':'உங்கள்',
  'NAME':'பெயர்','WHAT':'என்ன','WHERE':'எங்கே','WHO':'யார்',
  'WHEN':'எப்போது','WHY':'ஏன்','HOW':'எப்படி','CAN':'முடியும்',
  'CANNOT':'முடியாது','GIVE':'கொடு','TAKE':'எடு',
  'HERE':'இங்கே','WAIT':'காத்திரு','STOP':'நிறுத்து',
  'START':'தொடங்கு','OPEN':'திற','CLOSE':'மூடு',
  'TODAY':'இன்று','TOMORROW':'நாளை','YESTERDAY':'நேற்று',
  'MORNING':'காலை','NIGHT':'இரவு',
  'I LOVE YOU':'நான் உன்னை நேசிக்கிறேன்'
};
const $ = id => document.getElementById(id);
function put(id, value) { const el = $(id); if (el) el.textContent = value; }
function selectedLanguage(section) {
  const selector = $(section === 'camera' ? 'cameraOutputLang' : section === 'upload' ? 'uploadOutputLang' : 'textOutputLang');
  return selector?.value || $('languageSelect')?.value || 'en';
}
function showPage(id) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  const page = $(id);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav').forEach(nav => nav.classList.remove('active'));
  const index = {home:0,camera:1,upload:2,text:3,textvoice:3,how:4}[id];
  if (index !== undefined) document.querySelectorAll('.nav')[index]?.classList.add('active');
}
function changeLanguage() {
  renderCameraResult(latestGesture === 'Waiting...' ? '' : latestGesture);
  renderUploadResult(latestUploadGesture);
  refreshTextResult();
}
function renderCameraResult(gesture) {
  const name = gesture || 'Waiting for gesture...';
  put('gestureResult', name);
  put('cameraResult', name);
  const translation = gesture && selectedLanguage('camera') === 'ta' ? tamil[gesture] || '' : '';
  put('tamilResult', translation);
  put('cameraTamil', translation);
  put('confidence', gesture ? 'Basic hand-shape match (not model confidence)' : 'Waiting for hand');
}
function setGesture(gesture) {
  if (!gesture) return;
  latestGesture = gesture;
  renderCameraResult(gesture);
}
function createHands(callback) {
  if (typeof Hands === 'undefined') throw new Error('MediaPipe Hands library not loaded.');
  const detector = new Hands({locateFile:file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
  detector.setOptions({maxNumHands:2,modelComplexity:1,minDetectionConfidence:0.6,minTrackingConfidence:0.6});
  detector.onResults(callback);
  return detector;
}
async function startCamera() {
  stopCamera();
  const session = ++cameraSession;
  const video = $('cameraVideo');
  if (!video) return alert('Camera video element not found.');
  if (!navigator.mediaDevices?.getUserMedia) return alert('Camera needs HTTPS or localhost and a supported browser.');
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode},audio:false});
    if (session !== cameraSession) { stream.getTracks().forEach(track => track.stop()); return; }
    video.srcObject = stream;
    await video.play();
    if (session !== cameraSession) return;
    hands = createHands(results);
    running = true;
    put('handStatus','Camera active');
    put('aiStatus','Detecting hand landmarks');
    processVideo(session);
  } catch(error) {
    console.error(error);
    stopCamera();
    alert('Camera could not start. Allow permission, use HTTPS, and check MediaPipe scripts.');
  }
}
function stopCamera() {
  running = false;
  cameraSession++;
  processing = false;
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
  const video = $('cameraVideo');
  if (video) { video.pause(); video.srcObject = null; }
  if (hands) { const old = hands; hands = null; Promise.resolve(old.close?.()).catch(console.error); }
  put('handStatus','Camera off');
  put('aiStatus','Stopped');
}
function switchCamera() {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  if (running) startCamera();
}
async function processVideo(session = cameraSession) {
  if (!running || session !== cameraSession) return;
  const video = $('cameraVideo');
  if (!processing && hands && video?.readyState >= 2) {
    processing = true;
    try { await hands.send({image:video}); }
    catch(error) { console.error('Camera frame error:',error); }
    finally { processing = false; }
  }
  if (running && session === cameraSession) requestAnimationFrame(() => processVideo(session));
}
function extended(l,tip,pip) { return l[tip].y < l[pip].y - 0.015; }

function classify(l) {
  if (!l) return null;

  const index = extended(l, 8, 6);
  const middle = extended(l, 12, 10);
  const ring = extended(l, 16, 14);
  const pinky = extended(l, 20, 18);

  const palmSize = Math.hypot(
    l[0].x - l[9].x,
    l[0].y - l[9].y
  );

  if (palmSize < 0.03) return null;

  const thumbRaised =
    (l[4].y < l[2].y - palmSize * 0.3) &&
    (l[4].y < l[3].y);

  const fingersClosed =
    !index && !middle && !ring && !pinky;

  if (fingersClosed && thumbRaised) {
    return "YES";
  }

  if (fingersClosed && !thumbRaised) {
    return null;
  }

  if (index && middle && ring && pinky) {
    return "STOP";
  }

  if (index && middle && !ring && !pinky) {
    return "NO";
  }

  if (index && !middle && !ring && pinky) {
    return "I LOVE YOU";
  }

  return null;
}

function drawHandResults(result, canvasId, videoId) {
  const canvas = $(canvasId), video = $(videoId);
  if (!canvas || !video) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = video.videoWidth || video.clientWidth || 640;
  canvas.height = video.videoHeight || video.clientHeight || 480;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (const landmarks of result.multiHandLandmarks || []) {
    if (typeof drawConnectors === 'function' && typeof HAND_CONNECTIONS !== 'undefined')
      drawConnectors(ctx,landmarks,HAND_CONNECTIONS,{color:'#ffffff',lineWidth:2});
    if (typeof drawLandmarks === 'function')
      drawLandmarks(ctx,landmarks,{color:'#ffdd00',lineWidth:1});
  }
}
function results(result) {
  if (!running) return;
  drawHandResults(result, $('cameraCanvas') ? 'cameraCanvas' : 'drawCanvas', 'cameraVideo');
  const landmarks = result.multiHandLandmarks || [];
  put('handStatus', landmarks.length ? `${landmarks.length} hand(s) detected` : 'No hand detected');
  if (!landmarks.length) { stableFrames = 0; lastCameraLabel = ''; return; }
  const label = classify(landmarks[0]);
  if (label && label === lastCameraLabel) stableFrames++;
  else { lastCameraLabel = label || ''; stableFrames = label ? 1 : 0; }
  if (label && stableFrames >= 5 && label !== latestGesture) setGesture(label);
}
function speakText(text, lang = selectedLanguage('camera')) {
  if (!text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
  speechSynthesis.speak(utterance);
}
function speakResult() { speakDetected(); }
function speakDetected() {
  if (latestGesture === 'Waiting...') return;
  const lang = selectedLanguage('camera');
  speakText(lang === 'ta' ? tamil[latestGesture] || latestGesture : latestGesture, lang);
}
function renderUploadResult(gesture) {
  put('videoResult', gesture || 'Video ready. Click Analyse.');
  put('uploadResult', gesture || 'Video ready. Click Analyse.');
  put('uploadTamil', gesture && selectedLanguage('upload') === 'ta' ? tamil[gesture] || '' : '');
}
function loadVideo(event) { handleVideoUpload(event); }
function handleVideoUpload(event) {
  stopUploadAnalysis();
  const file = event?.target?.files?.[0];
  if (!file) return;
  const video = $('uploadedVideo');
  if (!video) return alert('Uploaded video element not found.');
  if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
  uploadedVideoUrl = URL.createObjectURL(file);
  video.src = uploadedVideoUrl;
  video.load();
  latestUploadGesture = '';
  renderUploadResult('');
}
function stopUploadAnalysis() {
  uploadAnalyzing = false;
  uploadSession++;
  uploadProcessing = false;
  if (uploadHands) { const old = uploadHands; uploadHands = null; Promise.resolve(old.close?.()).catch(console.error); }
}
async function analyseUploadedVideo() {
  const video = $('uploadedVideo');
  if (!video?.src) return alert('Please upload a video first.');
  stopUploadAnalysis();
  const session = ++uploadSession;
  try {
    uploadHands = createHands(result => {
      if (!uploadAnalyzing || session !== uploadSession) return;
      const label = classify(result.multiHandLandmarks?.[0]);
      if (label) { latestUploadGesture = label; renderUploadResult(label); }
    });
    uploadAnalyzing = true;
    latestUploadGesture = '';
    put('uploadResult','Analysing video for basic hand poses...');
    put('videoResult','Analysing video for basic hand poses...');
    video.currentTime = 0;
    await video.play();
    const loop = async () => {
      if (!uploadAnalyzing || session !== uploadSession) return;
      if (video.ended) {
        uploadAnalyzing = false;
        if (!latestUploadGesture) {
          put('uploadResult','No supported basic hand pose detected.');
          put('videoResult','No supported basic hand pose detected.');
        }
        return;
      }
      if (!video.paused && video.readyState >= 2 && !uploadProcessing) {
        uploadProcessing = true;
        try { await uploadHands.send({image:video}); }
        catch(error) { console.error(error); }
        finally { uploadProcessing = false; }
      }
      if (uploadAnalyzing && session === uploadSession) requestAnimationFrame(loop);
    };
    loop();
  } catch(error) {
    console.error(error);
    stopUploadAnalysis();
    put('uploadResult','Could not analyse video. Check MediaPipe Hands library.');
  }
}
function speakUpload() {
  if (!latestUploadGesture) return;
  const lang = selectedLanguage('upload');
  speakText(lang === 'ta' ? tamil[latestUploadGesture] || latestUploadGesture : latestUploadGesture,lang);
}
function textToSign() { convertTextToSign(); }
function convertTextToSign() {
  const input = $('textInput');
  const output = $('signOutput') || $('signImage');
  if (!input || !output) return alert('Text input or sign output element not found.');
  const raw = input.value.toLowerCase().trim();
  if (!raw) {
    if (output.tagName === 'IMG') { output.removeAttribute('src'); output.alt = 'Please enter text'; }
    else output.textContent = 'Please enter some text.';
    put('signWord',''); put('signTamil','');
    return;
  }
  const words = raw.match(/[a-z]+/g) || [];
  const tokens = [];
  for (let i=0;i<words.length;i++) {
    if (words[i] === 'thank' && words[i+1] === 'you') { tokens.push('thank you'); i++; }
    else tokens.push(words[i]);
  }
  const found = tokens.filter(word => signImages[word]);
  const missing = tokens.filter(word => !signImages[word]);
  put('signWord',found.map(word => word.toUpperCase()).join(' '));
  put('signTamil',selectedLanguage('text') === 'ta' ? found.map(word => tamil[word.toUpperCase()] || word).join(' ') : '');
  if (output.tagName === 'IMG') {
    if (found.length) {
      output.src = signImages[found[0]];
      output.alt = found[0] + ' sign';
      output.style.display = 'block';
    } else { output.removeAttribute('src'); output.alt = 'No matching sign image'; }
    put('imageError', missing.length ? `No image for: ${missing.join(', ')}${found.length > 1 ? '. Showing first matched image only.' : ''}` : found.length > 1 ? 'Showing first image only. Use a signOutput container to display all images.' : '');
    return;
  }
  output.replaceChildren();
  for (const word of found) {
    const card = document.createElement('div');
    card.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;margin:10px;gap:6px;vertical-align:top';
    const image = document.createElement('img');
    image.src = signImages[word]; image.alt = word + ' sign';
    image.style.cssText = 'width:150px;max-width:100%;height:auto;border-radius:12px';
    const label = document.createElement('span'); label.textContent = word.toUpperCase();
    card.append(image,label); output.appendChild(card);
  }
  if (missing.length) {
    const note = document.createElement('p');
    note.textContent = `Images not available for: ${missing.join(', ')}`;
    output.appendChild(note);
  }
  if (!found.length && !missing.length) output.textContent = 'Enter an English word from the image list.';
}
function refreshTextResult() { if ($('textInput')?.value.trim()) convertTextToSign(); }
function startVoice() { startVoiceInput(); }
function startVoiceInput() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return alert('Speech recognition is not supported. Try Chrome or Edge.');
  const recognition = new Recognition();
  recognition.lang = selectedLanguage('text') === 'ta' ? 'ta-IN' : 'en-IN';
  recognition.onresult = event => {
    const input = $('textInput');
    if (input) { input.value = event.results[0][0].transcript; convertTextToSign(); }
  };
  recognition.onerror = event => alert('Voice recognition error: ' + event.error);
  recognition.start();
}


/* FULL ENGLISH / TAMIL WEBSITE TRANSLATION */

const websiteTranslations = {
  en: {
    "AI Based Communication System": "AI Based Communication System",
    "🏠 Home": "🏠 Home",
    "📷 Live Camera": "📷 Live Camera",
    "🎥 Video Upload": "🎥 Video Upload",
    "💬 Text / Voice": "💬 Text / Voice",
    "⚡ AI POWERED": "⚡ AI POWERED",
    "AI POWERED": "AI POWERED",
    "Breaking communication barriers with AI-powered sign language recognition.": "Breaking communication barriers with AI-powered sign language recognition.",
    "Detect": "Detect",
    "Recognize": "Recognize",
    "Communicate": "Communicate",
    "Start Communication →": "Start Communication →",
    "Communication Modes": "Communication Modes",
    "Live Camera Detection": "Live Camera Detection",
    "Detect supported hand gestures using your camera.": "Detect supported hand gestures using your camera.",
    "Video Upload": "Video Upload",
    "Upload a gesture video and analyse hand movements.": "Upload a gesture video and analyse hand movements.",
    "Text / Voice": "Text / Voice",
    "Convert text or voice into sign images.": "Convert text or voice into sign images.",
    "Sign Language → AI Recognition → Text → Voice": "Sign Language → AI Recognition → Text → Voice",
    "📷 Live Camera Detection": "📷 Live Camera Detection",
    "Show a supported hand gesture in front of your camera.": "Show a supported hand gesture in front of your camera.",
    "📷 Start Camera": "📷 Start Camera",
    "⏹ Stop Camera": "⏹ Stop Camera",
    "🔄 Switch Camera": "🔄 Switch Camera",
    "Detected Gesture": "Detected Gesture",
    "Waiting...": "Waiting...",
    "Confidence: --": "Confidence: --",
    "Camera off": "Camera off",
    "Waiting": "Waiting",
    "🔊 Play Voice": "🔊 Play Voice",
    "🎥 Video Upload": "🎥 Video Upload",
    "Upload a sign-language video for basic hand gesture analysis.": "Upload a sign-language video for basic hand gesture analysis.",
    "🔍 Analyse Video": "🔍 Analyse Video",
    "⏹ Stop Analysis": "⏹ Stop Analysis",
    "Recognition Result": "Recognition Result",
    "No video selected.": "No video selected.",
    "💬 Text / Voice": "💬 Text / Voice",
    "Enter English words or use voice input to display corresponding sign images.": "Enter English words or use voice input to display corresponding sign images.",
    "🤟 Convert to Sign": "🤟 Convert to Sign",
    "🎤 Voice Input": "🎤 Voice Input",
    "🔊 Speak": "🔊 Speak",
    "Sign Output": "Sign Output",
    "Your sign output will appear here.": "Your sign output will appear here.",
    "Smart Sign Language Communicator © 2026": "Smart Sign Language Communicator © 2026"
  },

  ta: {
    "AI Based Communication System": "செயற்கை நுண்ணறிவு அடிப்படையிலான தொடர்பு அமைப்பு",
    "🏠 Home": "🏠 முகப்பு",
    "📷 Live Camera": "📷 நேரடி கேமரா",
    "🎥 Video Upload": "🎥 காணொளி பதிவேற்றம்",
    "💬 Text / Voice": "💬 உரை / குரல்",
    "⚡ AI POWERED": "⚡ செயற்கை நுண்ணறிவு",
    "AI POWERED": "செயற்கை நுண்ணறிவு",
    "Breaking communication barriers with AI-powered sign language recognition.": "செயற்கை நுண்ணறிவு மூலம் சைகை மொழியை அறிந்து தொடர்புத் தடைகளை நீக்குதல்.",
    "Detect": "கண்டறிதல்",
    "Recognize": "அடையாளம் காணுதல்",
    "Communicate": "தொடர்பு கொள்ளுதல்",
    "Start Communication →": "தொடர்பைத் தொடங்கு →",
    "Communication Modes": "தொடர்பு முறைகள்",
    "Live Camera Detection": "நேரடி கேமரா கண்டறிதல்",
    "Detect supported hand gestures using your camera.": "கேமரா மூலம் ஆதரிக்கப்படும் கைச் சைகைகளைக் கண்டறியவும்.",
    "Video Upload": "காணொளி பதிவேற்றம்",
    "Upload a gesture video and analyse hand movements.": "சைகை காணொளியைப் பதிவேற்றி கை அசைவுகளைப் பகுப்பாய்வு செய்யவும்.",
    "Text / Voice": "உரை / குரல்",
    "Convert text or voice into sign images.": "உரை அல்லது குரலைச் சைகைப் படங்களாக மாற்றவும்.",
    "Sign Language → AI Recognition → Text → Voice": "சைகை மொழி → AI அடையாளம் காணுதல் → உரை → குரல்",
    "📷 Live Camera Detection": "📷 நேரடி கேமரா கண்டறிதல்",
    "Show a supported hand gesture in front of your camera.": "கேமரா முன் ஆதரிக்கப்படும் கைச் சைகையைக் காட்டவும்.",
    "📷 Start Camera": "📷 கேமராவைத் தொடங்கு",
    "⏹ Stop Camera": "⏹ கேமராவை நிறுத்து",
    "🔄 Switch Camera": "🔄 கேமராவை மாற்று",
    "Detected Gesture": "கண்டறியப்பட்ட சைகை",
    "Waiting...": "காத்திருக்கிறது...",
    "Confidence: --": "நம்பகத்தன்மை: --",
    "Camera off": "கேமரா அணைக்கப்பட்டுள்ளது",
    "Waiting": "காத்திருக்கிறது",
    "🔊 Play Voice": "🔊 குரலில் கேட்க",
    "🎥 Video Upload": "🎥 காணொளி பதிவேற்றம்",
    "Upload a sign-language video for basic hand gesture analysis.": "கைச் சைகைகளைப் பகுப்பாய்வு செய்ய காணொளியைப் பதிவேற்றவும்.",
    "🔍 Analyse Video": "🔍 காணொளியைப் பகுப்பாய்வு செய்",
    "⏹ Stop Analysis": "⏹ பகுப்பாய்வை நிறுத்து",
    "Recognition Result": "அடையாளம் காணப்பட்ட முடிவு",
    "No video selected.": "காணொளி தேர்ந்தெடுக்கப்படவில்லை.",
    "💬 Text / Voice": "💬 உரை / குரல்",
    "Enter English words or use voice input to display corresponding sign images.": "சைகைப் படங்களைக் காண ஆங்கில வார்த்தைகளை உள்ளிடவும் அல்லது குரலைப் பயன்படுத்தவும்.",
    "🤟 Convert to Sign": "🤟 சைகையாக மாற்று",
    "🎤 Voice Input": "🎤 குரல் உள்ளீடு",
    "🔊 Speak": "🔊 பேசு",
    "Sign Output": "சைகை வெளியீடு",
    "Your sign output will appear here.": "உங்கள் சைகை வெளியீடு இங்கே தோன்றும்.",
    "Smart Sign Language Communicator © 2026": "ஸ்மார்ட் சைகை மொழி தொடர்பாளர் © 2026"
  }
};

// Store original English text
const translationNodes = [];

function setupWebsiteTranslation() {
  const selectors = [
    "header .brand p",
    "aside .nav",
    ".hero small",
    ".hero p",
    ".hero .chips span",
    ".hero button",
    "#home > h2",
    ".cards h3",
    ".cards p",
    ".flow",
    "#camera > h2",
    "#camera > p",
    "#camera .action-buttons button",
    "#camera .result h3",
    "#camera .result button",
    "#upload > h2",
    "#upload > p",
    "#upload .action-buttons button",
    "#upload .result h3",
    "#text > h2",
    "#text > p",
    "#text .action-buttons button",
    "#text .result h3",
    "footer"
  ];

  document.querySelectorAll(selectors.join(",")).forEach(el => {
    translationNodes.push({
      element: el,
      english: el.textContent.trim()
    });
  });
}

function applyWebsiteLanguage() {
  const lang = document.getElementById("languageSelect").value;
  const dictionary = websiteTranslations[lang] || websiteTranslations.en;

  translationNodes.forEach(item => {
    item.element.textContent =
      dictionary[item.english] || item.english;
  });

  const input = document.getElementById("textInput");

  if (input) {
    input.placeholder = lang === "ta"
      ? "உங்கள் செய்தியை இங்கே உள்ளிடவும்..."
      : "Type your message here...";
  }

  document.documentElement.lang = lang;
}

// Keep existing changeLanguage functionality
const previousChangeLanguage =
  typeof changeLanguage === "function"
    ? changeLanguage
    : null;

changeLanguage = function() {
  if (previousChangeLanguage) {
    previousChangeLanguage();
  }

  applyWebsiteLanguage();
};

setupWebsiteTranslation();
applyWebsiteLanguage();
