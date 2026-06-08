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
    const capturedEmotionText = document.getElementById('captured-emotion-text');
    const capturedEmotionDisplay = document.getElementById('captured-emotion-display');
    const emotionCaptureCanvas = document.getElementById('emotion-capture-canvas');
    const capturedEmotionResult = document.getElementById('captured-emotion-result');
    const musicToggleBtn = document.getElementById('music-toggle');
    const bgm = document.getElementById('bgm');
    const cdCanvas = document.getElementById('cd-canvas');

    let segmenter, capturedFaceDataUrl = null, isSpinning = false, isMusicPlaying = false;
    let emotionModel, emotionWebcam;
    let isEmotionScanning = false, emotionAnimationFrame;
    let lastPredictions = [];
    let cdRotation = 0;

    // 가상 감정 라벨 (모델에 없는 것들은 0.5 고정)
    const EXTRA_EMOTIONS = [
        { className: 'ANXIETY', probability: 0.5 },
        { className: 'LOVE',    probability: 0.5 }
    ];
    // 모델 감정 영어 매핑
    const EMOTION_MAP = { '기쁨': 'JOY', '슬픔': 'SADNESS', '분노': 'ANGER' };

    const positiveMessages = [
        "YOUR FUTURE IS BRIGHT!", "ONE STEP TODAY, A GREAT TOMORROW.", "YOU ARE ALREADY WONDERFUL.",
        "YOUR PATH WILL BECOME THE ANSWER.", "SMALL EFFORTS BLOOM INTO GREATNESS.", "BELIEVE IN YOUR INFINITE POTENTIAL!",
        "THE WORLD IS WAITING FOR YOUR CHALLENGE.", "HARDSHIPS MAKE YOU STRONGER.", "FEEL THE ENERGY OF THE UNIVERSE!",
        "YOUR PERSEVERANCE IS BEAUTIFUL.", "MIRACLES BEGIN WHEN YOU BELIEVE.", "YOU WERE BORN TO BE LOVED."
    ];

    // --- CD Player 2D 애니메이션 ---
    function drawCD(rotation, faceDataUrl) {
        const ctx = cdCanvas.getContext('2d');
        const w = cdCanvas.width, h = cdCanvas.height;
        const cx = w / 2, cy = h / 2, r = w / 2 - 2;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        if (faceDataUrl) {
            // 얼굴 이미지를 원형으로
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.clip();
            const img = new Image();
            img.src = faceDataUrl;
            ctx.drawImage(img, -r, -r, r * 2, r * 2);
            ctx.restore();
        } else {
            // 기본 CD 모양
            const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
            grad.addColorStop(0, '#dddddd');
            grad.addColorStop(0.3, '#cccccc');
            grad.addColorStop(0.6, '#e0e0e0');
            grad.addColorStop(1, '#bbbbbb');
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            // CD 무늬
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, r, (i/8)*Math.PI*2, ((i+0.5)/8)*Math.PI*2);
                ctx.fillStyle = `rgba(255,255,255,${0.1 + (i%2)*0.1})`;
                ctx.fill();
            }
        }

        // 가운데 구멍
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = '#f5f5f5';
        ctx.fill();
        ctx.strokeStyle = '#bbbbbb';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 테두리
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    function cdLoop() {
        if (isMusicPlaying) {
            cdRotation += 0.02;
            drawCD(cdRotation, capturedFaceDataUrl);
        }
        requestAnimationFrame(cdLoop);
    }
    drawCD(0, null);
    cdLoop();

    // --- Music ---
    musicToggleBtn.addEventListener('click', () => {
        if (isMusicPlaying) {
            bgm.pause();
            musicToggleBtn.textContent = 'PLAY';
        } else {
            bgm.play().catch(e => console.error(e));
            musicToggleBtn.textContent = 'STOP';
        }
        isMusicPlaying = !isMusicPlaying;
    });

    // --- AI Model ---
    async function loadModel() {
        try {
            const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
            segmenter = await bodySegmentation.createSegmenter(model, {
                runtime: 'mediapipe',
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation',
                modelType: 'general'
            });
            loadingStatus.style.display = 'none';
            enableCameraBtn.disabled = false;
            triggerUploadBtn.disabled = false;
        } catch (error) {
            loadingStatus.textContent = "Model load failed!";
        }
    }

    async function processImageSource(sourceElement) {
        if (!segmenter) { alert("Model still loading."); return null; }
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        const scale = 0.5;
        tempCanvas.width = (sourceElement.videoWidth || sourceElement.width) * scale;
        tempCanvas.height = (sourceElement.videoHeight || sourceElement.height) * scale;
        ctx.drawImage(sourceElement, 0, 0, tempCanvas.width, tempCanvas.height);
        try {
            const segmentation = await segmenter.segmentPeople(tempCanvas);
            if (!segmentation.length) { alert("No person found."); return null; }
            const personMask = await bodySegmentation.toBinaryMask(segmentation, {r:0,g:0,b:0,a:255}, {r:0,g:0,b:0,a:0});
            const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageData.data, maskData = personMask.data;
            for (let i = 0; i < data.length; i += 4) { if (maskData[i+3] === 0) data[i+3] = 0; }
            ctx.putImageData(imageData, 0, 0);
            return tempCanvas.toDataURL('image/png');
        } catch (e) { alert("Image processing error."); return null; }
    }

    function updateFace(imageDataUrl) {
        if (!imageDataUrl) return;
        capturedFaceDataUrl = imageDataUrl;
        capturedFaceImg.src = capturedFaceDataUrl;
        capturedFaceImg.style.display = 'block';
        facePreview.style.display = 'none';
        drawCD(cdRotation, capturedFaceDataUrl);
        predictCapturedFace(imageDataUrl);
        createSpheres();
    }

    // --- 레이더 차트 ---
    function drawRadar(predictions, webcamCanvas) {
        const radarCanvas = document.getElementById('radar-canvas');
        if (!radarCanvas) return;
        const ctx = radarCanvas.getContext('2d');

        // 모델 감정 영어로 변환 + 가상 감정 추가
        const allPredictions = [
            ...predictions.map(p => ({
                className: EMOTION_MAP[p.className] || p.className.toUpperCase(),
                probability: p.probability
            })),
            ...EXTRA_EMOTIONS
        ];

        const size = radarCanvas.width;
        const cx = size / 2, cy = size / 2;
        const maxR = size * 0.33;
        const labelR = size * 0.46;
        const n = allPredictions.length;

        ctx.clearRect(0, 0, size, size);

        const clipPoints = allPredictions.map((p, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const r = maxR * Math.max(p.probability, 0.05);
            return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
        });

        // 웹캠 다각형 클리핑
        if (webcamCanvas) {
            ctx.save();
            ctx.beginPath();
            clipPoints.forEach((pt, i) => {
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(webcamCanvas, cx - maxR, cy - maxR, maxR * 2, maxR * 2);
            ctx.restore();
        }

        // 동심원
        [0.33, 0.66, 1.0].forEach(ratio => {
            ctx.beginPath();
            ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
            ctx.strokeStyle = ratio === 1.0 ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.15)';
            ctx.lineWidth = ratio === 1.0 ? 1.5 : 1;
            ctx.setLineDash(ratio === 1.0 ? [] : [3, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // 축 + 라벨
        allPredictions.forEach((p, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * maxR;
            const y = cy + Math.sin(angle) * maxR;
            const lx = cx + Math.cos(angle) * labelR;
            const ly = cy + Math.sin(angle) * labelR;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.font = '7px "Press Start 2P", cursive';
            ctx.fillStyle = '#222';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.className, lx, ly);
        });

        // 데이터 다각형
        ctx.beginPath();
        clipPoints.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // --- Emotion ---
    const EMOTION_URL = "https://teachablemachine.withgoogle.com/models/oDqoAdBWt/";

    async function initEmotion() {
        try {
            startEmotionBtn.disabled = true;
            startEmotionBtn.textContent = "LOADING...";
            if (!emotionModel) {
                emotionModel = await tmImage.load(EMOTION_URL + "model.json", EMOTION_URL + "metadata.json");
            }
            emotionWebcam = new tmImage.Webcam(250, 250, true);
            await emotionWebcam.setup();
            await emotionWebcam.play();
            isEmotionScanning = true;

            const radarCanvas = document.getElementById('radar-canvas');
            if (radarCanvas) radarCanvas.style.display = 'block';
            capturedEmotionDisplay.style.display = 'none';
            startEmotionBtn.style.display = 'none';
            stopEmotionBtn.style.display = 'inline-block';
            captureEmotionBtn.style.display = 'inline-block';
            emotionAnimationFrame = window.requestAnimationFrame(emotionLoop);
        } catch (error) {
            console.error(error);
            alert("Emotion model load failed.");
            startEmotionBtn.disabled = false;
            startEmotionBtn.textContent = "SCAN ON";
        }
    }

    function stopEmotion() {
        isEmotionScanning = false;
        if (emotionAnimationFrame) window.cancelAnimationFrame(emotionAnimationFrame);
        if (emotionWebcam) emotionWebcam.stop();
        const radarCanvas = document.getElementById('radar-canvas');
        if (radarCanvas) { radarCanvas.style.display = 'none'; radarCanvas.getContext('2d').clearRect(0,0,radarCanvas.width,radarCanvas.height); }
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
        } catch(e) { console.error(e); }
        emotionAnimationFrame = window.requestAnimationFrame(emotionLoop);
    }

    async function captureEmotion() {
        if (!lastPredictions.length) return;
        isEmotionScanning = false;
        if (emotionAnimationFrame) window.cancelAnimationFrame(emotionAnimationFrame);
        const radarCanvas = document.getElementById('radar-canvas');
        const ctx = emotionCaptureCanvas.getContext('2d');
        emotionCaptureCanvas.width = radarCanvas.width;
        emotionCaptureCanvas.height = radarCanvas.height;
        ctx.drawImage(radarCanvas, 0, 0);

        const allPredictions = [
            ...lastPredictions.map(p => ({ className: EMOTION_MAP[p.className] || p.className.toUpperCase(), probability: p.probability })),
            ...EXTRA_EMOTIONS
        ];
        let top = { className: "", probability: 0 };
        allPredictions.forEach(p => { if (p.probability > top.probability) top = p; });
        capturedEmotionResult.textContent = top.className;

        radarCanvas.style.display = 'none';
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
            try { emotionModel = await tmImage.load(EMOTION_URL + "model.json", EMOTION_URL + "metadata.json"); }
            catch(e) { return; }
        }
        const tempImg = new Image();
        tempImg.onload = async () => {
            const prediction = await emotionModel.predict(tempImg);
            let top = { className: "", probability: 0 };
            prediction.forEach(p => { if (p.probability > top.probability) top = p; });
            const engName = EMOTION_MAP[top.className] || top.className.toUpperCase();
            if (capturedEmotionText) { capturedEmotionText.textContent = `EMOTION: ${engName}`; capturedEmotionText.style.display = 'block'; }
        };
        tempImg.src = imageDataUrl;
    }

    startEmotionBtn.addEventListener('click', initEmotion);
    stopEmotionBtn.addEventListener('click', stopEmotion);
    captureEmotionBtn.addEventListener('click', captureEmotion);
    rescanEmotionBtn.addEventListener('click', rescanEmotion);

    // --- Camera ---
    enableCameraBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            videoContainer.style.display = 'block';
            enableCameraBtn.style.display = 'none';
            takePhotoBtn.style.display = 'inline-block';
            takePhotoBtn.disabled = false;
        } catch (err) { alert('Camera access required.'); }
    });

    takePhotoBtn.addEventListener('click', async () => {
        if (!video.srcObject) return;
        updateFace(await processImageSource(video));
        stopWebcam();
    });

    triggerUploadBtn.addEventListener('click', () => uploadPhotoInput.click());

    uploadPhotoInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        triggerUploadBtn.disabled = true;
        triggerUploadBtn.textContent = "PROCESSING...";
        try {
            const img = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = err => reject(err);
                image.src = URL.createObjectURL(file);
            });
            updateFace(await processImageSource(img));
        } catch(e) { alert("Image load failed."); }
        finally { triggerUploadBtn.disabled = false; triggerUploadBtn.textContent = "UPLOAD PHOTO"; uploadPhotoInput.value = ''; }
    });

    function stopWebcam() {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
            videoContainer.style.display = 'none';
            takePhotoBtn.style.display = 'none';
            enableCameraBtn.style.display = 'inline-block';
        }
    }

    // --- Three.js ---
    let scene, camera, renderer, spheres = [];
    const sphereCount = 20;

    function init3D() {
        const { clientWidth: w, clientHeight: h } = globeContainer;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000);
        camera.position.set(0, 1.8, 6);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(w, h);
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
            const c = document.createElement('canvas');
            const ctx = c.getContext('2d');
            c.width = 256; c.height = 256;
            ctx.fillStyle = '#fecb05';
            ctx.fillRect(0, 0, 256, 256);
            const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = capturedFaceDataUrl; });
            ctx.drawImage(img, 28, 28, 200, 200);
            faceMaterial = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.3 });
        }
        for (let i = 0; i < sphereCount; i++) {
            const material = faceMaterial ? faceMaterial.clone()
                : new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.6, 0.7), roughness: 0.2, metalness: 0.1 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set((Math.random()-0.5)*4, (Math.random()-0.5)*2 + 1.5, (Math.random()-0.5)*1.5);
            spheres.push({ mesh, velocity: new THREE.Vector3(),
                angularVelocity: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(0.05),
                radius: 0.55 });
            scene.add(mesh);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        spheres.forEach(s => {
            s.velocity.y -= 0.01;
            s.mesh.position.add(s.velocity);
            s.velocity.multiplyScalar(0.99);
            s.mesh.rotation.x += s.angularVelocity.x;
            s.mesh.rotation.y += s.angularVelocity.y;
            if (s.mesh.position.y < -0.8) { s.mesh.position.y = -0.8; s.velocity.y *= -0.6; }
            if (s.mesh.position.y > 4.0)  { s.mesh.position.y = 4.0;  s.velocity.y *= -0.6; }
            if (Math.abs(s.mesh.position.x) > 3.0) { s.mesh.position.x = Math.sign(s.mesh.position.x)*3.0; s.velocity.x *= -0.6; }
            if (Math.abs(s.mesh.position.z) > 1.5) { s.mesh.position.z = Math.sign(s.mesh.position.z)*1.5; s.velocity.z *= -0.6; }
        });
        for (let i = 0; i < spheres.length; i++) {
            for (let j = i+1; j < spheres.length; j++) {
                const s1 = spheres[i], s2 = spheres[j];
                const diff = s1.mesh.position.clone().sub(s2.mesh.position);
                const dist = diff.length(), minDist = s1.radius + s2.radius;
                if (dist < minDist) {
                    const n = diff.normalize(), overlap = minDist - dist;
                    s1.mesh.position.add(n.clone().multiplyScalar(overlap/2));
                    s2.mesh.position.sub(n.clone().multiplyScalar(overlap/2));
                    const relV = s1.velocity.clone().sub(s2.velocity), vDotN = relV.dot(n);
                    if (vDotN < 0) {
                        const imp = n.multiplyScalar(-(1+0.8)*vDotN/2);
                        s1.velocity.add(imp); s2.velocity.sub(imp);
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
        spheres.forEach(s => s.velocity.set((Math.random()-0.5)*0.5, Math.random()*0.9, (Math.random()-0.5)*0.5));
        setTimeout(dropCapsule, 800);
        setTimeout(() => { handle.classList.remove('spin'); isSpinning = false; }, 1200);
    }

    async function dropCapsule() {
        const cap = document.createElement('div');
        cap.className = 'capsule falling-capsule';
        if (capturedFaceDataUrl) {
            const c = document.createElement('canvas');
            const ctx = c.getContext('2d');
            c.width = 100; c.height = 100;
            ctx.fillStyle = '#fecb05';
            ctx.fillRect(0, 0, 100, 100);
            const img = await new Promise(r => { const i = new Image(); i.onload = ()=>r(i); i.src = capturedFaceDataUrl; });
            ctx.drawImage(img, 10, 10, 80, 80);
            cap.style.backgroundImage = `url(${c.toDataURL()})`;
            cap.style.backgroundSize = 'cover';
        } else {
            cap.style.backgroundColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.6).getStyle();
        }
        chute.appendChild(cap);
        setTimeout(() => { showResult(cap.style.cssText); cap.remove(); }, 800);
    }

    function showResult(capsuleStyle) {
        document.getElementById('capsule-top').style.cssText = capsuleStyle;
        document.getElementById('item-name').textContent = positiveMessages[Math.floor(Math.random()*positiveMessages.length)];
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
        const c = document.getElementById('capsule-result-container');
        if (c) c.classList.remove('open');
        modal.style.display = 'none';
    }
}
