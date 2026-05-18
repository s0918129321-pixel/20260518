import DeviceDetector from "https://esm.sh/device-detector-js@2.2.10";

const mpHands = window;
const drawingUtils = window;
const controls = window;

// 遊戲狀態控制
let userScore = 0;
let botScore = 0;
let lastGesture = 'None';
let gestureStableCount = 0;
let isGameLocked = false; 
const GESTURE_THRESHOLD = 15; // 需要連續 15 幀偵測到相同手勢才觸發

const choices = ['Rock', 'Paper', 'Scissors'];
const emojiMap = { 
  'Rock': '✊ 石頭', 
  'Paper': '🖐️ 布', 
  'Scissors': '✌️ 剪刀', 
  'Continue': '☝️ 繼續 (比1)',
  'End': '👍 重置 (讚)',
  'None': '等待偵測...' 
};

// 取得 HTML 元素
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const gameStatusEl = document.getElementById('gameStatus');
const botChoiceEl = document.getElementById('botChoice');
const userScoreEl = document.getElementById('userScore');
const botScoreEl = document.getElementById('botScore');

/**
 * 手勢判斷邏輯
 * 比較手指末端 (Tip) 與指節 (MCP) 的 Y 座標
 */
function getHandSign(landmarks) {
    // MediaPipe 座標系中，Y 越小代表越高
    // 大拇指判斷：Tip(4) 座標小於 IP(3) 時視為翹起
    const thumbOpen = landmarks[4].y < landmarks[3].y;
    const indexOpen = landmarks[8].y < landmarks[6].y;
    const middleOpen = landmarks[12].y < landmarks[10].y;
    const ringOpen = landmarks[16].y < landmarks[14].y;
    const pinkyOpen = landmarks[20].y < landmarks[18].y;

    const openCount = [indexOpen, middleOpen, ringOpen, pinkyOpen].filter(Boolean).length;

    // 石頭：四指握拳且大拇指沒翹起
    if (openCount === 0 && !thumbOpen) return 'Rock';
    // 比 1 (繼續)：只有食指伸直
    if (openCount === 1 && indexOpen) return 'Continue';
    // 比讚 (結束/重置)：四指握拳且大拇指翹起
    if (openCount === 0 && thumbOpen) return 'End';

    if (openCount >= 4) return 'Paper';
    if (openCount === 2 && indexOpen && middleOpen) return 'Scissors';
    return 'None';
}

/**
 * 執行遊戲勝負邏輯
 */
function playGame(userSign) {
    if (isGameLocked || userSign === 'None') return;
    isGameLocked = true;

    const botIdx = Math.floor(Math.random() * 3);
    const botSign = choices[botIdx];
    
    botChoiceEl.innerText = `電腦出：${emojiMap[botSign]}`;
    
    if (userSign === botSign) {
        gameStatusEl.innerText = "平手！";
        gameStatusEl.className = "game-status draw";
    } else if (
        (userSign === 'Rock' && botSign === 'Scissors') ||
        (userSign === 'Paper' && botSign === 'Rock') ||
        (userSign === 'Scissors' && botSign === 'Paper')
    ) {
        gameStatusEl.innerText = "你贏了！🎉";
        gameStatusEl.className = "game-status win";
        userScore++;
        userScoreEl.innerText = userScore;
    } else {
        gameStatusEl.innerText = "你輸了... 😢";
        gameStatusEl.className = "game-status lose";
        botScore++;
        botScoreEl.innerText = botScore;
    }

    // 2 秒後重置，準備下一輪
    setTimeout(() => {
        isGameLocked = false;
        // 提示使用者可以使用手勢繼續
        gameStatusEl.innerText = "請比 ☝️ (1) 繼續，或比 🖐️ 出拳";
        gameStatusEl.className = "game-status";
        botChoiceEl.innerText = "電腦等待中";
    }, 2000);
}

function onResults(results) {
    document.body.classList.add('loaded');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
            // 繪製骨架
            drawingUtils.drawConnectors(canvasCtx, landmarks, mpHands.HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 5});
            drawingUtils.drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 2});

            // 處理手勢
            const currentGesture = getHandSign(landmarks);
            if (!isGameLocked) {
                if (currentGesture !== 'None' && currentGesture === lastGesture) {
                    gestureStableCount++;
                    if (gestureStableCount >= GESTURE_THRESHOLD) {
                        playGame(currentGesture);
                        gestureStableCount = 0;
                    }
                } else {
                    gestureStableCount = 0;
                }
                lastGesture = currentGesture;

                // 在 Canvas 上顯示即時預覽
                canvasCtx.font = "30px Arial";
                canvasCtx.fillStyle = "yellow";
                canvasCtx.fillText(`目前偵測: ${emojiMap[currentGesture]}`, 20, 50);
            }
        }
    }
    canvasCtx.restore();
}

// 產生 QR Code 的功能
function generateQRCode() {
    const qrcodeContainer = document.getElementById("qrcode");
    // 取得當前網址
    let currentURL = window.location.href;
    
    // 如果你在本機開發 (127.0.0.1)，記得要換成你的區域網路 IP (如 192.168.x.x) 手機才連得到
    if (currentURL.includes("127.0.0.1") || currentURL.includes("localhost")) {
        console.warn("提醒：目前的網址是本地端，手機可能無法直接訪問。請使用區域網路 IP。");
    }

    new QRCode(qrcodeContainer, {
        text: currentURL,
        width: 128,
        height: 128,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

const hands = new Hands({
    locateFile: (file) => `<https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}>`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 1280,
    height: 720
});
camera.start();

// 初始化 QR Code
generateQRCode();
