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
    const emotionRec = document.getElementById('emotion-recommendation');
    const musicToggleBtn = document.getElementById('music-toggle');
    const bgm = document.getElementById('bgm');
    const cdCanvas = document.getElementById('cd-canvas');

    let segmenter, capturedFaceDataUrl = null, isSpinning = false, isMusicPlaying = false;
    let emotionModel, emotionWebcam;
    let isEmotionScanning = false, emotionAnimationFrame;
    let lastPredictions = [];
    let cdRotation = 0, cdAnimFrame = null;

    const EXTRA_EMOTIONS = [
        { className: 'ANXIETY', probability: 0.5 },
        { className: 'LOVE',    probability: 0.5 }
    ];
    const EMOTION_MAP = { '기쁨': 'JOY', '슬픔': 'SADNESS', '분노': 'ANGER' };

    const EMOTION_RECS = {
        JOY:     "Chamomile tea with honey perfectly complements your joyful mood. Sweet macarons or fruit tarts will amplify your happiness. A warm latte with cinnamon is also a great match for your bright energy today.",
        SADNESS: "A warm cup of hojicha or cocoa will gently comfort your heart. Dark chocolate and soft madeleines are perfect companions for quiet moments. Let a bowl of warm porridge or soup slowly ease your feelings.",
        ANGER:   "Cool peppermint tea will help calm your heated mind. Crisp cucumber or celery snacks bring a refreshing reset. Sparkling water with lemon zest cleanses tension and restores your balance.",
        ANXIETY: "Lavender or lemon balm tea soothes anxious nerves beautifully. Light rice crackers or plain yogurt settle an uneasy stomach. A small piece of dark chocolate can quietly ease your restless mind.",
        LOVE:    "Rose hip tea or hibiscus tea mirrors your warm and loving heart. Strawberry desserts and soft cream puffs echo the sweetness of your emotion. Share a slice of tiramisu with someone special today."
    };

    const positiveMessages = [
        "YOUR FUTURE IS BRIGHT!", "ONE STEP TODAY, A GREAT TOMORROW.",
        "YOU ARE ALREADY WONDERFUL.", "YOUR PATH WILL BECOME THE ANSWER.",
        "SMALL EFFORTS BLOOM INTO GREATNESS.", "BELIEVE IN YOUR INFINITE POTENTIAL!",
        "THE WORLD IS WAITING FOR YOUR CHALLENGE.", "HARDSHIPS MAKE YOU STRONGER.",
        "FEEL THE ENERGY OF THE UNIVERSE!", "YOUR PERSEVERANCE IS BEAUTIFUL.",
        "MIRACLES BEGIN WHEN YOU BELIEVE.", "YOU WERE BORN TO BE LOVED."
    ];

    // ── CD 2D 애니메이션 (가챠 캡슐 이미지) ──
    const capsuleColors = ['#ff8fa3','#a8d8ea','#b5ead7','#ffd6a5','#c9b1ff','#fdffb6'];

    function drawCDGacha(rotation) {
        const ctx = cdCanvas.getContext('2d');
        const w = cdCanvas.width, h = cdCanvas.height;
        const cx = w / 2, cy = h / 2;
        const r = w / 2 - 3;
        ctx.clearRect(0, 0, w, h);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        // 원형 배경
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = '#f0f0f0';
        ctx.fill();
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 미니 캡슐 6개 원형으로 배치
        const capsuleR = 14;
        const orbitR = r * 0.62;
        capsuleColors.forEach((color, i) => {
            const angle = (i / capsuleColors.length) * Math.PI * 2;
            const cx2 = Math.cos(angle) * orbitR;
            const cy2 = Math.sin(angle) * orbitR;

            // 캡슐 몸통
            ctx.save();
            ctx.translate(cx2, cy2);
            ctx.rotate(angle + Math.PI / 2);

            // 아래 반구
            ctx.beginPath();
            ctx.arc(0, capsuleR * 0.25, capsuleR * 0.75, 0, Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // 위 반구
            ctx.beginPath();
            ctx.arc(0, capsuleR * 0.25, capsuleR * 0.75, Math.PI, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // 테두리
            ctx.beginPath();
            ctx.arc(0, capsuleR * 0.25, capsuleR * 0.75, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 중앙선
            ctx.beginPath();
            ctx.moveTo(-capsuleR * 0.75, capsuleR * 0.25);
            ctx.lineTo(capsuleR * 0.75, capsuleR * 0.25);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        });

        // 가운데 구멍
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#bbbbbb';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }

    function cdLoop() {
        if (isMusicPlaying) cdRotation += 0.018;
        drawCDGacha(cdRotation);
        requestAnimationFrame(cdLoop);
    }
    drawCDGacha(0);
    cdLoop();

    // ── Music ──
    musicToggleBtn.addEventListener('click', () => {
        if (isMusicPlaying) {
            bgm.pause(); musicToggleBtn.textContent = 'PLAY';
        } else {
            bgm.play().catch(e => console.error(e)); musicToggleBtn.textContent = 'STOP';
        }
        isMusicPlaying = !isMusicPlaying;
    });

    // ── AI Model ──
    async function loadModel() {
        try {
            segmenter = await bodySegmentation.createSegmenter(
                bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
                { runtime: 'mediapipe', solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation', modelType: 'general' }
            );
            loadingStatus.style.display = 'none';
            enableCameraBtn.disabled = false;
            triggerUploadBtn.disabled = false;
        } catch (e) { loadingStatus.textContent = "Model load failed!"; }
    }

    async function processImageSource(src) {
        if (!segmenter) { alert("Model still loading."); return null; }
        const tmp = document.createElement('canvas');
        const ctx = tmp.getContext('2d');
        const s = 0.5;
        tmp.width = (src.videoWidth || src.width) * s;
        tmp.height = (src.videoHeight || src.height) * s;
        ctx.drawImage(src, 0, 0, tmp.width, tmp.height);
        try {
            const seg = await segmenter.segmentPeople(tmp);
            if (!seg.length) { alert("No person found."); return null; }
            const mask = await bodySegmentation.toBinaryMask(seg, {r:0,g:0,b:0,a:255}, {r:0,g:0,b:0,a:0});
            const id = ctx.getImageData(0, 0, tmp.width, tmp.height);
            for (let i = 0; i < id.data.length; i += 4) { if (mask.data[i+3] === 0) id.data[i+3] = 0; }
            ctx.putImageData(id, 0, 0);
            return tmp.toDataURL('image/png');
        } catch(e) { alert("Image processing error."); return null; }
    }

    function updateFace(url) {
        if (!url) return;
        capturedFaceDataUrl = url;
        capturedFaceImg.src = url;
        capturedFaceImg.style.display = 'block';
        facePreview.style.display = 'none';
        predictCapturedFace(url);
        createSpheres();
    }

    // ── 레이더 차트 (곡선 다각형 + 다각형 클리핑) ──
    function drawRadar(predictions, webcamCanvas) {
        const radarCanvas = document.getElementById('radar-canvas');
        if (!radarCanvas) return;
        const ctx = radarCanvas.getContext('2d');

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

        // 데이터 포인트
        const pts = allPredictions.map((p, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const r = maxR * Math.max(p.probability, 0.05);
            return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
        });

        // 곡선 경로 만들기 (cardinal spline)
        function curvedPath(points) {
            ctx.beginPath();
            const len = points.length;
            for (let i = 0; i < len; i++) {
                const p0 = points[(i - 1 + len) % len];
                const p1 = points[i];
                const p2 = points[(i + 1) % len];
                const p3 = points[(i + 2) % len];
                if (i === 0) ctx.moveTo(p1.x, p1.y);
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
            ctx.closePath();
        }

        // 웹캠 곡선 클리핑
        if (webcamCanvas) {
            ctx.save();
            curvedPath(pts);
            ctx.clip();
            ctx.drawImage(webcamCanvas, cx - maxR, cy - maxR, maxR * 2, maxR * 2);
            ctx.restore();
        }

        // 동심원
        [0.33, 0.66, 1.0].forEach(ratio => {
            ctx.beginPath();
            ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
            ctx.strokeStyle = ratio === 1.0 ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.13)';
            ctx.lineWidth = ratio === 1.0 ? 1.5 : 1;
            ctx.setLineDash(ratio === 1.0 ? [] : [3,4]);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // 축 + 라벨
        allPredictions.forEach((p, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * maxR;
            const y = cy + Math.sin(angle) * maxR;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
            ctx.strokeStyle = 'rgba(0,0,0,0.18)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.font = '7px "Press Start 2P", cursive';
            ctx.fillStyle = '#222';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.className, cx + Math.cos(angle) * labelR, cy + Math.sin(angle) * labelR);
        });

        // 곡선 다각형 테두리
        curvedPath(pts);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // ── Emotion ──
    const EMOTION_URL = "https://teachablemachine.withgoogle.com/models/oDqoAdBWt/";

    async function initEmotion() {
        try {
            startEmotionBtn.disabled = true;
            startEmotionBtn.textContent = "LOADING...";
            if (!emotionModel) emotionModel = await tmImage.load(EMOTION_URL + "model.json", EMOTION_URL + "metadata.json");
            emotionWebcam = new tmImage.Webcam(250, 250, true);
            await emotionWebcam.setup();
            await emotionWebcam.play();
            isEmotionScanning = true;
            const rc = document.getElementById('radar-canvas');
            if (rc) rc.style.display = 'block';
            capturedEmotionDisplay.style.display = 'none';
            if (emotionRec) emotionRec.style.display = 'none';
            startEmotionBtn.style.display = 'none';
            stopEmotionBtn.style.display = 'inline-block';
            captureEmotionBtn.style.display = 'inline-block';
            emotionAnimationFrame = requestAnimationFrame(emotionLoop);
        } catch(e) {
            console.error(e);
            alert("Emotion model load failed.");
            startEmotionBtn.disabled = false;
            startEmotionBtn.textContent = "SCAN ON";
        }
    }

    function stopEmotion() {
        isEmotionScanning = false;
        if (emotionAnimationFrame) cancelAnimationFrame(emotionAnimationFrame);
        if (emotionWebcam) emotionWebcam.stop();
        const rc = document.getElementById('radar-canvas');
        if (rc) { rc.style.display = 'none'; rc.getContext('2d').clearRect(0,0,rc.width,rc.height); }
        capturedEmotionDisplay.style.display = 'none';
        if (emotionRec) emotionRec.style.display = 'none';
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
            lastPredictions = await emotionModel.predict(emotionWebcam.canvas);
            drawRadar(lastPredictions, emotionWebcam.canvas);
        } catch(e) { console.error(e); }
        emotionAnimationFrame = requestAnimationFrame(emotionLoop);
    }

    async function captureEmotion() {
        if (!lastPredictions.length) return;
        isEmotionScanning = false;
        if (emotionAnimationFrame) cancelAnimationFrame(emotionAnimationFrame);

        const rc = document.getElementById('radar-canvas');
        const ctx = emotionCaptureCanvas.getContext('2d');
        emotionCaptureCanvas.width = rc.width;
        emotionCaptureCanvas.height = rc.height;
        ctx.drawImage(rc, 0, 0);

        const all = [
            ...lastPredictions.map(p => ({ className: EMOTION_MAP[p.className] || p.className.toUpperCase(), probability: p.probability })),
            ...EXTRA_EMOTIONS
        ];
        let top = { className: "JOY", probability: 0 };
        all.forEach(p => { if (p.probability > top.probability) top = p; });
        capturedEmotionResult.textContent = top.className;

        // 추천 텍스트
        if (emotionRec) {
            emotionRec.textContent = EMOTION_RECS[top.className] || EMOTION_RECS.JOY;
            emotionRec.style.display = 'block';
        }

        rc.style.display = 'none';
        captureEmotionBtn.style.display = 'none';
        capturedEmotionDisplay.style.display = 'block';
    }

    function rescanEmotion() {
        capturedEmotionDisplay.style.display = 'none';
        if (emotionRec) emotionRec.style.display = 'none';
        const rc = document.getElementById('radar-canvas');
        if (rc) rc.style.display = 'block';
        isEmotionScanning = true;
        captureEmotionBtn.style.display = 'inline-block';
        emotionAnimationFrame = requestAnimationFrame(emotionLoop);
    }

    async function predictCapturedFace(url) {
        if (!emotionModel) {
            try { emotionModel = await tmImage.load(EMOTION_URL + "model.json", EMOTION_URL + "metadata.json"); }
            catch(e) { return; }
        }
        const img = new Image();
        img.onload = async () => {
            const pred = await emotionModel.predict(img);
            let top = { className: "JOY", probability: 0 };
            pred.forEach(p => { if (p.probability > top.probability) top = p; });
            const eng = EMOTION_MAP[top.className] || top.className.toUpperCase();
            if (capturedEmotionText) { capturedEmotionText.textContent = `EMOTION: ${eng}`; capturedEmotionText.style.display = 'block'; }
        };
        img.src = url;
    }

    startEmotionBtn.addEventListener('click', initEmotion);
    stopEmotionBtn.addEventListener('click', stopEmotion);
    captureEmotionBtn.addEventListener('click', captureEmotion);
    rescanEmotionBtn.addEventListener('click', rescanEmotion);

    // ── Camera ──
    enableCameraBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            videoContainer.style.display = 'block';
            enableCameraBtn.style.display = 'none';
            takePhotoBtn.style.display = 'inline-block';
            takePhotoBtn.disabled = false;
        } catch(e) { alert('Camera access required.'); }
    });

    takePhotoBtn.addEventListener('click', async () => {
        if (!video.srcObject) return;
        updateFace(await processImageSource(video));
        stopWebcam();
    });

    triggerUploadBtn.addEventListener('click', () => uploadPhotoInput.click());

    uploadPhotoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        triggerUploadBtn.disabled = true;
        triggerUploadBtn.textContent = "PROCESSING...";
        try {
            const img = await new Promise((res, rej) => {
                const i = new Image();
                i.onload = () => res(i); i.onerror = rej;
                i.src = URL.createObjectURL(file);
            });
            updateFace(await processImageSource(img));
        } catch(err) { alert("Image load failed."); }
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

    // ── Three.js (캡슐 40개) ──
    let scene, camera, renderer, spheres = [];
    const sphereCount = 40;

    function init3D() {
        const { clientWidth: w, clientHeight: h } = globeContainer;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000);
        camera.position.set(0, 2.2, 6);
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
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
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
                : new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(i / sphereCount, 0.65, 0.68), roughness: 0.2, metalness: 0.1 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set((Math.random()-0.5)*4, (Math.random()-0.5)*2 + 2.0, (Math.random()-0.5)*1.5);
            spheres.push({ mesh, velocity: new THREE.Vector3(),
                angularVelocity: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(0.05),
                radius: 0.5 });
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
            // 바닥을 올려서 캡슐이 케이스 위로 나오게
            if (s.mesh.position.y < -0.3) { s.mesh.position.y = -0.3; s.velocity.y *= -0.6; }
            if (s.mesh.position.y > 4.5)  { s.mesh.position.y = 4.5;  s.velocity.y *= -0.6; }
            if (Math.abs(s.mesh.position.x) > 2.8) { s.mesh.position.x = Math.sign(s.mesh.position.x)*2.8; s.velocity.x *= -0.6; }
            if (Math.abs(s.mesh.position.z) > 1.4) { s.mesh.position.z = Math.sign(s.mesh.position.z)*1.4; s.velocity.z *= -0.6; }
        });
        for (let i = 0; i < spheres.length; i++) {
            for (let j = i+1; j < spheres.length; j++) {
                const s1 = spheres[i], s2 = spheres[j];
                const diff = s1.mesh.position.clone().sub(s2.mesh.position);
                const dist = diff.length(), md = s1.radius + s2.radius;
                if (dist < md) {
                    const n = diff.normalize(), ov = md - dist;
                    s1.mesh.position.add(n.clone().multiplyScalar(ov/2));
                    s2.mesh.position.sub(n.clone().multiplyScalar(ov/2));
                    const rv = s1.velocity.clone().sub(s2.velocity), vn = rv.dot(n);
                    if (vn < 0) { const imp = n.multiplyScalar(-(1.8)*vn/2); s1.velocity.add(imp); s2.velocity.sub(imp); }
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
            ctx.fillRect(0,0,100,100);
            const img = await new Promise(r => { const i = new Image(); i.onload = ()=>r(i); i.src = capturedFaceDataUrl; });
            ctx.drawImage(img, 10, 10, 80, 80);
            cap.style.backgroundImage = `url(${c.toDataURL()})`;
            cap.style.backgroundSize = 'cover';
        } else {
            cap.style.backgroundColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.65).getStyle();
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
