let codeReader = null;
let scanning = false;
const scanCooldowns = new Map();
const COOLDOWN_MS = 2000; // 2 seconds cooldown per distinct code

const videoWrapper = document.getElementById('videoWrapper');
const v = document.getElementById('v');
const btn = document.getElementById('btn');
const res = document.getElementById('res');
const err = document.getElementById('err');

let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function beep() {
    try {
        initAudio();
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 pitch beep
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
        console.error('Audio feedback failed:', e);
    }
}

function flashSuccess() {
    videoWrapper.classList.add('flash-success');
    res.classList.add('flash-success');
    setTimeout(() => {
        videoWrapper.classList.remove('flash-success');
        res.classList.remove('flash-success');
    }, 200);
}

async function startScan() {
    err.innerText = '';
    videoWrapper.classList.add('active');
    v.autoplay = true;
    v.playsInline = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        err.innerText = '❌ 浏览器不支持摄像头访问，请使用 HTTPS 或 localhost';
        stopScan();
        return;
    }

    codeReader = new ZXing.BrowserMultiFormatReader();
    scanCooldowns.clear(); // Reset scan cache on startup

    try {
        scanning = true;

        const devices = await codeReader.listVideoInputDevices();
        const deviceId = devices.length ? devices[devices.length - 1].deviceId : undefined;

        await codeReader.decodeFromVideoDevice(
            deviceId,
            v,
            (result) => {
                if (result) {
                    const txt = result.getText();
                    const now = Date.now();
                    
                    // Prevent duplicate scans within the cooldown window
                    if (scanCooldowns.has(txt) && (now - scanCooldowns.get(txt)) < COOLDOWN_MS) {
                        return;
                    }
                    scanCooldowns.set(txt, now);

                    // Continuous feedback: beep sound and green border flash
                    beep();
                    flashSuccess();

                    // Instantly append to the results textarea
                    res.value += txt + '\n';
                    res.scrollTop = res.scrollHeight; // Scroll to view latest result
                }
            }
        );

    } catch (e) {
        console.error(e);
        err.innerText = '❌ 摄像头无法启动（检查 HTTPS / 权限）';
        stopScan();
    }
}

function stopScan() {
    if (codeReader) {
        codeReader.reset();
        codeReader = null;
    }
    videoWrapper.classList.remove('active');
    scanning = false;
    btn.innerText = '开始扫码';
}

btn.addEventListener('click', async () => {
    // Unlock AudioContext via user interaction
    initAudio();

    if (scanning) {
        stopScan();
    } else {
        btn.innerText = '停止扫码';
        await startScan();
    }
});
