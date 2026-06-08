document.addEventListener('DOMContentLoaded', () => {
    const handle = document.getElementById('handle');
    const spinButton = document.getElementById('spin-button');
    const chute = document.getElementById('chute');
    const modal = document.getElementById('result-modal');
    const globeContainer = document.querySelector('.cylinder-body');
    const video = document.getElementById('video');
    const enableCameraBtn = document.getElementById('enable-camera');
    const takePhotoBtn = document.getElementById('take-photo');
    const uploadPhotoInput = document.getElementById('upload-photo');
    const triggerUploadBtn = document.getElementById('trigger-upload');
    const facePreview = document.getElementById('face-preview');
    const capturedFaceImg = document.getElementById('captured-face');
    const videoContainer = document.querySelector('.video-container');
    const loadingStatus = document.getElementById('loading-status');

    const startEmotionBtn = document.getElementById('start-emotion');
    const stopEmotionBtn = document.getElementById('stop-emotion');
    const captureEmotionBtn = document.getElementById('capture-emotion');
    const rescanEmotionBtn = document.getElementById('rescan-emotion');
    const emotionWebcamContainer = document.getElementById('webcam-container');
    const capturedEmotionText = document.getElementById('captured-emotion-text');
    const capturedEmotionDisplay = document.getElementById('captured-emotion-display');
    const emotionCaptureCanvas = document.getElementById('emotion-capture-canvas');
    const capturedEmotionResult = document.getElementById('captured-emotion-result');

    const musicToggleBtn = document.getElementById('music-toggle');
    const bgm = document.getElementById('bgm');
    const cdDisc = document.getElementById('cd-disc');

    let segmenter;
    let capturedFaceDataUrl = null;
    let isSpinning = false;
    let isMusicPlaying = false;
    let emotionModel, emotionWebcam, maxPredictions;
    let isEmotionScanning = false;
    let emotionAnimationFrame;
    let lastPredictions = [];

    const positiveMessages = [
        "너의 미래는 밝게 빛나고 있어!", "오늘의 한 걸음이 위대한 내일이 될 거야.", "너는 이미 충분히 멋진 사람이야.",
        "네가 가는 길이 곧 정답이 될 거야.", "작은 노력이 모여 찬란한 꽃을 피울 거야.", "네 안의 무한한 가능성을 믿어봐!",
        "세상은 너의 도전을 기다리고 있어.", "지금의 시련은 너를 더 단단하게 만들 거야.", "너를 응원하는 우주의 기운을 느껴봐!",
        "포기하지 않는 너의 모습이 가장 아름다워.", "기적은 네가 믿는 순간 시작될 거야.", "너는 사랑받기 위해 태어난 소중한 존재야."
    ];

    // --- Music ---
    musicToggleBtn.addEventListener('click', () => {
        if (isMusicPlaying) {
            bgm.pause();
            cdDisc.classList.remove('spinning');
            musicToggleBtn.textContent = 'PLAY';
        } else {
            bgm.play().catch(e => console.error(e));
            cdDisc.classList.add('spinning');
            musicToggleBtn.textContent = 'STOP';
        }
        isMusicPlaying = !isMusicPlaying;
    });

    // --- AI Model ---
    async function loadModel() {
        try {
            const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
            const segmenterConfig = {
                runtime: 'mediapipe',
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation',
                modelType: 'general'
            };
            segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
            loadingStatus.style.display = 'none';
            enableCameraBtn.disabled = false;
            triggerUploadBtn.disabled = false;
        } catch (error) {
            loadingStatus.textContent = "AI 모델 로딩 실패!";
        }
    }

    async function processImageSource(sourceElement) {
        if (!segmenter) { alert("AI 모델이 아직 로딩 중입니다."); return null; }
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        const scale = 0.5;
        tempCanvas.width = (sourceElement.videoWidth || sourceElement.width) * scale;
        tempCanvas.height = (sourceElement.videoHeight || sourceElement.height) * scale;
        ctx.drawImage(sourceElement, 0, 0, tempCanvas.width, tempCanvas.height);
        try {
            const segmentation = await segmenter.segmentPeople(tempCanvas);
            if (segmentation.length === 0) { alert("사진에서 사람을 찾지 못했습니다."); return null; }
            const personMask = await bodySegmentation.toBinaryMask(segmentation, {r:0,g:0,b:0,a:255}, {r:0,g:0,b:0,a:0});
            const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageData.data;
            const maskData = personMask.data;
            for (let i = 0; i < data.length; i += 4) { if (maskData[i+3] === 0) data[i+3] = 0; }
            ctx.putImageData(imageData, 0, 0);
            return tempCanvas.toDataURL('image/png');
        } catch (error) {
            alert("이미지 처리 중 오류가 발생했습니다."); return null;
        }
    }

    function updateFace(imageDataUrl) {
        if (!imageDataUrl) return;
        capturedFaceDataUrl = imageDataUrl;
        capturedFaceImg.src = capturedFaceDataUrl;
        capturedFaceImg.style.display = 'block';
        facePreview.style.display = 'none';
        predictCapturedFace(imageDataUrl);
        createSpheres();
    }

    // --- 레이더 차트 그리기 ---
    function drawRadar(predictions, webcamCanvas) {
        const radarCanvas = document.getElementById('radar-canvas');
        if (!radarCanvas) return;
        const radarCtx = radarCanvas.getContext('2d');
        if (!radarCtx || !predictions.length) return;

        const size = radarCanvas.width;
        const cx = size / 2;
        const cy = size / 2;
        const maxR = size * 0.33;
        const labelR = size * 0.46;
        const n = predictions.length;

        radarCtx.clearRect(0, 0, size, size);

        // 웹캠 원형 클리핑
        if (webcamCanvas) {
            radarCtx.save();
            radarCtx.beginPath();
            radarCtx.arc(cx, cy, maxR, 0, Math.PI * 2);
            radarCtx.clip();
            radarCtx.drawImage(webcamCanvas, cx - maxR, cy - maxR, maxR * 2, maxR * 2);
            radarCtx.restore();
        }

        // 동심원
        [0.33, 0.66, 1.0].forEach(ratio => {
            radarCtx.beginPath();
            radarCtx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
            radarCtx.strokeStyle = ratio === 1.0 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)';
            radarCtx.lineWidth = ratio === 1.0 ? 1.5 : 1;
            radarCtx.setLineDash(ratio === 1.0 ? [] : [3, 4]);
            radarCtx.stroke();
            radarCtx.setLineDash([]);
        });

        // 축 + 라벨
        predictions.forEach((p, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * maxR;
            const y = cy + Math.sin(angle) * maxR;
            const lx = cx + Math.cos(angle) * labelR;
            const ly = cy + Math.sin(angle) * labelR;

            radarCtx.beginPath();
            radarCtx.moveTo(cx, cy);
            radarCtx.lineTo(x, y);
            radarCtx.strokeStyle = 'rgba(0,0,0,0.25)';
            radarCtx.lineWidth = 1;
            radarCtx.stroke();

            radarCtx.font = '9px "Press Start 2P", cursive';
            radarCtx.fillStyle = '#222222';
            radarCtx.textAlign = 'center';
            radarCtx.textBaseline = 'middle';
            radarCtx.fillText(p.className, lx, ly);
        });

        // 데이터 별 모양
        radarCtx.beginPath();
        predictions.forEach((p, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const r = maxR * p.probability;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) radarCtx.moveTo(x, y);
            else radarCtx.lineTo(x, y);
        });
        radarCtx.closePath();
        radarCtx.fillStyle = 'rgba(0,0,0,0.15)';
        radarCtx.fill();
        radarCtx.strokeStyle = 'rgba(0,0,0,0.7)';
        radarCtx.lineWidth = 1.5;
        radarCtx.stroke();
    }

    // --- Emotion Detection ---
    const EMOTION_URL = "https://teachablemachine.withgoogle.com/models/oDqoAdBWt/";

    async function initEmotion() {
        try {
            startEmotionBtn.disabled = true;
            startEmotionBtn.textContent = "LOADING...";

            if (!emotionModel) {
                emotionModel = await tmImage.load(EMOTION_URL + "model.json", EMOTION_URL + "metadata.json");
            }
            maxPredictions = emotionModel.getTotalClasses();

            emotionWebcam = new tmImage.Webcam(300, 300, true);
            await emotionWebcam.setup();
            await emotionWebcam.play();

            isEmotionScanning = true;

            // 웹캠 캔버스 숨김 (레이더에 직접 그림)
            emotionWebcamContainer.innerHTML = "";
            emotionWebcamContainer.style.display = 'none';

            const radarCanvas = document.getElementById('radar-canvas');
            if (radarCanvas) radarCanvas.style.display = 'block';

            capturedEmotionDisplay.style.display = 'none';
            startEmotionBtn.style.display = 'none';
            stopEmotionBtn.style.display = 'inline-block';
            captureEmotionBtn.style.display = 'inline-block';

            emotionAnimationFrame = window.requestAnimationFrame(emotionLoop);

        } catch (error) {
            console.error("Emotion init error:", error);
            alert("감정 분석 모델을 로드하는 데 실패했습니다.");
            startEmotionBtn.disabled = false;
            startEmotionBtn.textContent = "SCAN ON";
        }
    }

    function stopEmotion() {
        isEmotionScanning = false;
        if (emotionAnimationFrame) window.cancelAnimationFrame(emotionAnimationFrame);
        if (emotionWebcam) emotionWebcam.stop();

        const radarCanvas = document.getElementById('radar-canvas');
        if (radarCanvas) {
            radarCanvas.style.display = 'none';
            const ctx = radarCanvas.getContext('2d');
            ctx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);
        }

        capturedEmotionDisplay.style.display = 'none';
        startEmotionBtn.style.display = 'inline-block';
        startEmotionBtn.disabled = false;
        startEmotionBtn.textContent = "SCAN ON";
        stopEmotionBtn.style.display = 'none';
        captureEmotionBtn.style.display = 'none';
    }

    async function emotionLoop() {
        if (!isEmotionScanning) return;
        emotionWebcam.update();
        try {
            const prediction = await emotionModel.predict(emotionWebcam.canvas);
            lastPredictions = prediction;
            drawRadar(prediction, emotionWebcam.canvas);
        } catch(e) {
            console.error("Predict error:", e);
        }
        emotionAnimationFrame = window.requestAnimationFrame(emotionLoop);
    }

    async function captureEmotion() {
        if (!lastPredictions.length) return;

        isEmotionScanning = false;
        if (emotionAnimationFrame) window.cancelAnimationFrame(emotionAnimationFrame);

        const radarCanvas = document.getElementById('radar-canvas');

        // 레이더 결과를 캡처 캔버스에 복사
        const ctx = emotionCaptureCanvas.getContext('2d');
        emotionCaptureCanvas.width = radarCanvas.width;
        emotionCaptureCanvas.height = radarCanvas.height;
        ctx.drawImage(radarCanvas, 0, 0);

        let topPrediction = { className: "", probability: 0 };
        lastPredictions.forEach(p => { if (p.probability > topPrediction.probability) topPrediction = p; });
        capturedEmotionResult.textContent = topPrediction.className;

        if (radarCanvas) radarCanvas.style.display = 'none';
        captureEmotionBtn.style.display = 'none';
        capturedEmotionDisplay.style.display = 'block';
    }

    function rescanEmotion() {
        capturedEmotionDisplay.style.display = 'none';
        const radarCanvas = document.getElementById('radar-canvas');
        if (radarCanvas) radarCanvas.style.display = 'block';
        isEmotionScanning = true;
        captureEmotionBtn.style.display = 'inline-block';
        emotionAnimationFrame = window.requestAnimationFrame(emotionLoop);
    }

    async function predictCapturedFace(imageDataUrl) {
        if (!emotionModel) {
            try {
                emotionModel = await tmImage.load(EMOTION_URL + "model.json", EMOTION_URL + "metadata.json");
            } catch (e) { return; }
        }
        const tempImg = new Image();
        tempImg.onload = async () => {
            const prediction = await emotionModel.predict(tempImg);
            let topPrediction = { className: "", probability: 0 };
            prediction.forEach(p => { if (p.probability > topPrediction.probability) topPrediction = p; });
            if (capturedEmotionText) {
                capturedEmotionText.textContent = `감정: ${topPrediction.className}`;
                capturedEmotionText.style.display = 'block';
            }
        };
        tempImg.src = imageDataUrl;
    }

    startEmotionBtn.addEventListener('click', initEmotion);
    stopEmotionBtn.addEventListener('click', stopEmotion);
    captureEmotionBtn.addEventListener('click', captureEmotion);
    rescanEmotionBtn.addEventListener('click', rescanEmotion);

    // --- Camera / Upload ---
    enableCameraBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            videoContainer.style.display = 'block';
            enableCameraBtn.style.display = 'none';
            takePhotoBtn.style.display = 'inline-block';
            takePhotoBtn.disabled = false;
        } catch (err) {
            alert('카메라 접근 권한이 필요합니다.');
        }
    });

    takePhotoBtn.addEventListener('click', async () => {
        if (!video.srcObject) return;
        const imageDataUrl = await processImageSource(video);
        updateFace(imageDataUrl);
        stopWebcam();
    });

    triggerUploadBtn.addEventListener('click', () => uploadPhotoInput.click());

    uploadPhotoInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        triggerUploadBtn.disabled = true;
        triggerUploadBtn.textContent = "처리 중...";
        try {
            const img = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = err => reject(err);
                image.src = URL.createObjectURL(file);
            });
            const imageDataUrl = await processImageSource(img);
            updateFace(imageDataUrl);
        } catch (error) {
            alert("이미지 파일을 불러오는 데 실패했습니다.");
        } finally {
            triggerUploadBtn.disabled = false;
            triggerUploadBtn.textContent = "UPLOAD PHOTO";
            uploadPhotoInput.value = '';
        }
    });

    function stopWebcam() {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            videoContainer.style.display = 'none';
            takePhotoBtn.style.display = 'none';
            enableCameraBtn.style.display = 'inline-block';
        }
    }

    // --- Three.js ---
    let scene, camera, renderer, spheres = [];
    const sphereCount = 20;

    function init3D() {
        const { clientWidth: width, clientHeight: height } = globeContainer;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
        camera.position.set(0, 0.8, 6);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        globeContainer.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const light = new THREE.DirectionalLight(0xffffff, 0.6);
        light.position.set(5, 5, 10);
        scene.add(light);
        createSpheres();
        animate();
    }

    async function createSpheres() {
        spheres.forEach(s => scene.remove(s.mesh));
        spheres = [];
        const geometry = new THREE.SphereGeometry(0.55, 32, 32);
        let faceMaterial = null;
        if (capturedFaceDataUrl) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 256; canvas.height = 256;
            ctx.fillStyle = '#fecb05';
            ctx.fillRect(0, 0, 256, 256);
            const img = await new Promise(resolve => {
                const i = new Image(); i.onload = () => resolve(i); i.src = capturedFaceDataUrl;
            });
            ctx.drawImage(img, 28, 28, 200, 200);
            const texture = new THREE.CanvasTexture(canvas);
            faceMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3 });
        }
        for (let i = 0; i < sphereCount; i++) {
            const material = faceMaterial ? faceMaterial.clone()
                : new THREE.MeshStandardMaterial({
                    color: new THREE.Color().setHSL(Math.random(), 0.6, 0.7),
                    roughness: 0.2,
                    metalness: 0.1
                  });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set((Math.random()-0.5)*4, (Math.random()-0.5)*2 + 0.5, (Math.random()-0.5)*1.5);
            spheres.push({
                mesh,
                velocity: new THREE.Vector3(),
                angularVelocity: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(0.05),
                radius: 0.55
            });
            scene.add(mesh);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        spheres.forEach(sphere => {
            sphere.velocity.y += -0.01;
            sphere.mesh.position.add(sphere.velocity);
            sphere.velocity.multiplyScalar(0.99);
            sphere.mesh.rotation.x += sphere.angularVelocity.x;
            sphere.mesh.rotation.y += sphere.angularVelocity.y;
            if (sphere.mesh.position.y < -1.8) { sphere.mesh.position.y = -1.8; sphere.velocity.y *= -0.6; }
            if (sphere.mesh.position.y > 3.0)  { sphere.mesh.position.y = 3.0;  sphere.velocity.y *= -0.6; }
            if (Math.abs(sphere.mesh.position.x) > 3.0) { sphere.mesh.position.x = Math.sign(sphere.mesh.position.x)*3.0; sphere.velocity.x *= -0.6; }
            if (Math.abs(sphere.mesh.position.z) > 1.5) { sphere.mesh.position.z = Math.sign(sphere.mesh.position.z)*1.5; sphere.velocity.z *= -0.6; }
        });
        for (let i = 0; i < spheres.length; i++) {
            for (let j = i+1; j < spheres.length; j++) {
                const s1 = spheres[i], s2 = spheres[j];
                const diff = s1.mesh.position.clone().sub(s2.mesh.position);
                const dist = diff.length();
                const minDist = s1.radius + s2.radius;
                if (dist < minDist) {
                    const normal = diff.normalize();
                    const overlap = minDist - dist;
                    s1.mesh.position.add(normal.clone().multiplyScalar(overlap/2));
                    s2.mesh.position.sub(normal.clone().multiplyScalar(overlap/2));
                    const relV = s1.velocity.clone().sub(s2.velocity);
                    const vDotN = relV.dot(normal);
                    if (vDotN < 0) {
                        const impulse = normal.multiplyScalar(-(1+0.8)*vDotN/2);
                        s1.velocity.add(impulse);
                        s2.velocity.sub(impulse);
                    }
                }
            }
        }
        renderer.render(scene, camera);
    }

    function spinGacha() {
        if (isSpinning) return;
        isSpinning = true;
        handle.classList.add('spin');
        spheres.forEach(sphere => {
            sphere.velocity.set((Math.random()-0.5)*0.5, Math.random()*0.9, (Math.random()-0.5)*0.5);
        });
        setTimeout(dropCapsule, 800);
        setTimeout(() => { handle.classList.remove('spin'); isSpinning = false; }, 1200);
    }

    async function dropCapsule() {
        const fallingCap = document.createElement('div');
        fallingCap.className = 'capsule falling-capsule';
        if (capturedFaceDataUrl) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 100; canvas.height = 100;
            ctx.fillStyle = '#fecb05';
            ctx.fillRect(0, 0, 100, 100);
            const img = await new Promise(r => { const i = new Image(); i.onload = ()=>r(i); i.src = capturedFaceDataUrl; });
            ctx.drawImage(img, 10, 10, 80, 80);
            fallingCap.style.backgroundImage = `url(${canvas.toDataURL()})`;
            fallingCap.style.backgroundSize = 'cover';
        } else {
            fallingCap.style.backgroundColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.6).getStyle();
        }
        chute.appendChild(fallingCap);
        setTimeout(() => { showResult(fallingCap.style.cssText); fallingCap.remove(); }, 800);
    }

    function showResult(capsuleStyle) {
        document.getElementById('capsule-top').style.cssText = capsuleStyle;
        const randomMsg = positiveMessages[Math.floor(Math.random() * positiveMessages.length)];
        document.getElementById('item-name').textContent = randomMsg;
        modal.style.display = 'flex';
        document.getElementById('capsule-result-container').classList.add('open');
    }

    handle.addEventListener('click', spinGacha);
    spinButton.addEventListener('click', spinGacha);

    loadModel();
    init3D();
});

function closeModal() {
    const modal = document.getElementById('result-modal');
    if (modal) {
        const container = document.getElementById('capsule-result-container');
        if (container) container.classList.remove('open');
        modal.style.display = 'none';
    }
}
