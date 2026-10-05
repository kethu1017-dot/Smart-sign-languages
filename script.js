let currentStream = null;
let facingMode = "user";
let latestGesture = "Waiting...";
let hands = null;
let cameraRunning = false;

const gestureTamil = {
    "HELLO": "வணக்கம்",
    "YES": "ஆம்",
    "NO": "இல்லை",
    "THANK YOU": "நன்றி",
    "HELP": "உதவி",
    "I LOVE YOU": "நான் உன்னை நேசிக்கிறேன்",
    "PLEASE": "தயவு செய்து",
    "MORE": "இன்னும்",
    "STOP": "நிறுத்து",
    "ALL DONE": "முடிந்தது",
    "GOOD": "நல்லது",
    "BAD": "மோசம்",
    "LOVE": "அன்பு",
    "FRIEND": "நண்பர்",
    "FAMILY": "குடும்பம்",
    "MOTHER": "அம்மா",
    "FATHER": "அப்பா",
    "BROTHER": "சகோதரன்",
    "SISTER": "சகோதரி",
    "BOY": "சிறுவன்",
    "GIRL": "சிறுமி",
    "EAT": "சாப்பிடு",
    "DRINK": "குடி",
    "WATER": "தண்ணீர்",
    "FOOD": "உணவு",
    "HOME": "வீடு",
    "SCHOOL": "பள்ளி",
    "COLLEGE": "கல்லூரி",
    "UNDERSTAND": "புரிந்துகொள்",
    "WAIT": "காத்திரு"
};

const signSymbols = {
    "hello": "🫡",
    "yes": "👊",
    "no": "🤏",
    "thank you": "🙏",
    "help": "🆘",
    "i love you": "🤟",
    "please": "🙏",
    "more": "🤲",
    "stop": "✋",
    "all done": "🙌",
    "good": "👍",
    "bad": "👎",
    "love": "❤️",
    "friend": "🤝",
    "family": "👨‍👩‍👧",
    "mother": "👩",
    "father": "👨",
    "brother": "👦",
    "sister": "👧",
    "boy": "👦",
    "girl": "👧",
    "eat": "🍴",
    "drink": "🥤",
    "water": "💧",
    "food": "🍽️",
    "home": "🏠",
    "school": "🏫",
    "college": "🎓",
    "understand": "💡",
    "wait": "⏳"
};

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
    document.getElementById(pageId).classList.add("active-page");

    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    const buttons = document.querySelectorAll(".nav-btn");
    const names = ["home", "camera", "upload", "text"];
    const index = names.indexOf(pageId);
    if (index >= 0 && buttons[index]) buttons[index].classList.add("active");
}

function changeLanguage() {
    const lang = document.getElementById("languageSelect").value;
    const result = document.getElementById("tamilResult");
    if (lang === "ta" && latestGesture !== "Waiting...") {
        result.innerText = gestureTamil[latestGesture] || latestGesture;
    } else {
        result.innerText = "";
    }
}

async function startCamera() {
    try {
        stopCamera();

        currentStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: false
        });

        const video = document.getElementById("cameraVideo");
        video.srcObject = currentStream;
        await video.play();

        cameraRunning = true;
        document.getElementById("handStatus").innerText = "Active";
        document.getElementById("aiStatus").innerText = "Running";

        initHands();
        processVideo();
    } catch (error) {
        alert("Camera permission is required.");
        console.error(error);
    }
}

function stopCamera() {
    cameraRunning = false;

    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    const video = document.getElementById("cameraVideo");
    video.srcObject = null;

    document.getElementById("handStatus").innerText = "Ready";
    document.getElementById("aiStatus").innerText = "Ready";
}

function switchCamera() {
    facingMode = facingMode === "user" ? "environment" : "user";
    if (cameraRunning) startCamera();
}

function initHands() {
    if (typeof Hands === "undefined") {
        document.getElementById("aiStatus").innerText = "MediaPipe unavailable";
        return;
    }

    hands = new Hands({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandsResults);
}

async function processVideo() {
    if (!cameraRunning || !hands) return;

    const video = document.getElementById("cameraVideo");

    if (video.readyState >= 2) {
        try {
            await hands.send({ image: video });
        } catch (e) {
            console.error(e);
        }
    }

    requestAnimationFrame(processVideo);
}

function onHandsResults(results) {
    const canvas = document.getElementById("cameraCanvas");
    const video = document.getElementById("cameraVideo");
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        document.getElementById("handStatus").innerText = "Detected";

        results.multiHandLandmarks.forEach(landmarks => {
            if (typeof drawConnectors !== "undefined") {
                drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: "#ffffff", lineWidth: 2 });
                drawLandmarks(ctx, landmarks, { color: "#ffdd00", lineWidth: 1 });
            }
        });

        const gesture = classifyGesture(results.multiHandLandmarks[0]);
        if (gesture) setGestureResult(gesture);
    } else {
        document.getElementById("handStatus").innerText = "Waiting";
    }
}

function fingerExtended(lm, tip, pip) {
    return lm[tip].y < lm[pip].y;
}

function classifyGesture(lm) {
    if (!lm || lm.length < 21) return null;

    const index = fingerExtended(lm, 8, 6);
    const middle = fingerExtended(lm, 12, 10);
    const ring = fingerExtended(lm, 16, 14);
    const pinky = fingerExtended(lm, 20, 18);

    const allOpen = index && middle && ring && pinky;
    const fist = !index && !middle && !ring && !pinky;

    if (fist) return "YES";
    if (allOpen) return "STOP";

    if (index && middle && !ring && !pinky) {
        return "NO";
    }

    if (index && middle && ring && pinky) {
        return "STOP";
    }

    // I LOVE YOU approximation: index + pinky extended, middle/ring folded
    if (index && !middle && !ring && pinky) {
        return "I LOVE YOU";
    }

    return null;
}

function setGestureResult(gesture) {
    latestGesture = gesture;
    document.getElementById("gestureResult").innerText = gesture;

    const lang = document.getElementById("languageSelect").value;
    document.getElementById("tamilResult").innerText =
        lang === "ta" ? (gestureTamil[gesture] || "") : "";

    document.getElementById("aiStatus").innerText = "Recognized";
}

function speakResult() {
    const lang = document.getElementById("languageSelect").value;
    const text = lang === "ta"
        ? (gestureTamil[latestGesture] || latestGesture)
        : latestGesture;

    speakText(text);
}

function speakText(text) {
    if (!text || text.trim() === "") return;

    if (!("speechSynthesis" in window)) {
        alert("Speech synthesis is not supported in this browser.");
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang =
        document.getElementById("languageSelect").value === "ta"
            ? "ta-IN"
            : "en-IN";

    window.speechSynthesis.speak(utterance);
}

function captureTraining() {
    const word = document.getElementById("trainWord").value;
    const key = "sign_training_" + word;

    const profile = {
        word: word,
        capturedAt: new Date().toISOString(),
        note: "Browser-side training profile placeholder"
    };

    localStorage.setItem(key, JSON.stringify(profile));
    document.getElementById("trainingStatus").innerText =
        word + " training profile saved in this browser.";
}

function resetTraining() {
    Object.keys(localStorage)
        .filter(k => k.startsWith("sign_training_"))
        .forEach(k => localStorage.removeItem(k));

    document.getElementById("trainingStatus").innerText =
        "Training profiles reset.";
}

function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const video = document.getElementById("uploadedVideo");
    video.src = URL.createObjectURL(file);

    document.getElementById("videoResult").innerText =
        "Video loaded. Browser-side video recognition is ready for AI model integration.";
}

function textToSign() {
    const text = document.getElementById("textInput").value.trim().toLowerCase();

    if (!text) {
        document.getElementById("signOutput").innerText =
            "Please enter some text.";
        return;
    }

    const words = text.split(/\s+/);
    const output = words.map(word => {
        const clean = word.replace(/[^a-z]/g, "");
        return signSymbols[clean] || "🤟";
    }).join(" ");

    document.getElementById("signOutput").innerText = output;
}

function startVoiceInput() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Voice recognition is not supported in this browser.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang =
        document.getElementById("languageSelect").value === "ta"
            ? "ta-IN"
            : "en-IN";

    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
        document.getElementById("textInput").value =
            event.results[0][0].transcript;
    };

    recognition.onerror = event => {
        console.error("Speech recognition error:", event.error);
    };

    recognition.start();
}

// Simple backend health check
fetch("/api/health")
    .then(response => response.json())
    .then(data => console.log("Backend:", data.status))
    .catch(() => console.log("Backend health check unavailable"));
