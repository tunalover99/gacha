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
    let cdRotation = 0;

    const EXTRA_EMOTIONS = [
        { className: 'ANXIETY', probability: 0.5 },
        { className: 'LOVE',    probability: 0.5 }
    ];

    // 한글 → 영어 매핑 (모든 가능한 표현 포함)
    const EMOTION_MAP = {
        '기쁨': 'JOY', '행복': 'JOY', '즐거움': 'JOY',
        '슬픔': 'SADNESS', '슬퍼': 'SADNESS',
        '분노': 'ANGER', '화남': 'ANGER', '화': 'ANGER', '怒り': 'ANGER', '怒': 'ANGER',
        'angry': 'ANGER', 'anger': 'ANGER',
        'happy': 'JOY', 'joy': 'JOY',
        'sad': 'SADNESS', 'sadness': 'SADNESS',
    };

    function toEng(className) {
        if (!className) return 'UNKNOWN';
        const lower = className.toLowerCase().trim();
        const direct = EMOTION_MAP[className.trim()] || EMOTION_MAP[lower];
        if (direct) return direct;
        // 포함 검색
        if (lower.includes('분노') || lower.includes('화남') || lower.includes('화') || lower.includes('anger') || lower.includes('angry')) return 'ANGER';
        if (lower.includes('기쁨') || lower.includes('행복') || lower.includes('joy') || lower.includes('happy')) return 'JOY';
        if (lower.includes('슬픔') || lower.includes('sad')) return 'SADNESS';
        return className.toUpperCase().trim();
    }

    const EMOTION_RECS = {
        JOY:     "Chamomile tea with honey perfectly complements your joyful mood. Sweet macarons or fruit tarts will amplify your happiness.",
        SADNESS: "A warm cup of hojicha or cocoa will gently comfort your heart. Dark chocolate and soft madeleines are perfect companions.",
        ANGER:   "Cool peppermint tea will calm your heated mind. Crisp cucumber or celery snacks bring a refreshing reset.",
        ANXIETY: "Lavender or lemon balm tea soothes anxious nerves. Light rice crackers or plain yogurt settle an uneasy stomach.",
        LOVE:    "Rose hip tea mirrors your warm and loving heart. Strawberry desserts and soft cream puffs echo your sweetness."
    };

    const positiveMessages = [
        "YOUR FUTURE IS BRIGHT!", "ONE STEP TODAY, A GREAT TOMORROW.",
        "YOU ARE ALREADY WONDERFUL.", "YOUR PATH WILL BECOME THE ANSWER.",
        "SMALL EFFORTS BLOOM INTO GREATNESS.", "BELIEVE IN YOUR INFINITE POTENTIAL!",
        "THE WORLD IS WAITING FOR YOUR CHALLENGE.", "HARDSHIPS MAKE YOU STRONGER.",
        "FEEL THE ENERGY OF THE UNIVERSE!", "YOUR PERSEVERANCE IS BEAUTIFUL.",
        "MIRACLES BEGIN WHEN YOU BELIEVE.", "YOU WERE BORN TO BE LOVED."
    ];

    // ── 기본 레이더 그리기 (스캔 전 빈 상태) ──
    function drawEmptyRadar() {
        const radarCanvas = document.getElementById('radar-canvas');
        if (!radarCanvas) return;
        const ctx = radarCanvas.getContext('2d');
        const defaultLabels = ['JOY', 'SADNESS', 'ANGER', 'ANXIETY', 'LOVE'];
        const size = radarCanvas.width;
        const cx = size/2, cy = size/2;
        const maxR = size * 0.33;
        const labelR = size * 0.46;
        const n = defaultLabels.length;

        ctx.clearRect(0, 0, size, size);

        // 동심원
        [0.33, 0.66, 1.0].forEach(ratio => {
            ctx.beginPath();
            ctx.arc(cx, cy, maxR*ratio, 0, Math.PI*2);
            ctx.strokeStyle = ratio===1.0 ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)';
            ctx.lineWidth = ratio===1.0 ? 1.5 : 1;
            ctx.setLineDash(ratio===1.0 ? [] : [3,4]);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // 축 + 라벨
        defaultLabels.forEach((label, i) => {
            const angle = (i/n)*Math.PI*2 - Math.PI/2;
            const x = cx + Math.cos(angle)*maxR;
            const y = cy + Math.sin(angle)*maxR;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.font = '7px "Press Start 2P", cursive';
            ctx.fillStyle = '#555';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx+Math.cos(angle)*labelR, cy+Math.sin(angle)*labelR);
        });
    }

    // ── CD 2D ──
    const capsuleColors = ['#ff8fa3','#a8d8ea','#b5ead7','#ffd6a5','#c9b1ff','#fdffb6'];

    function drawCD(rotation) {
        const ctx = cdCanvas.getContext('2d');
        const w = cdCanvas.width, h = cdCanvas.height;
        const cx = w/2, cy = h/2, r = w/2 - 2;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.fillStyle = '#dddad2';
        ctx.fill();
        for (let i=0; i<4; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, r*(0.4+i*0.15), 0, Math.PI*2);
            ctx.strokeStyle = `rgba(255,255,255,${0.25-i*0.05})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        const orbitR = r * 0.6;
        capsuleColors.forEach((color, i) => {
            const angle = (i/capsuleColors.length)*Math.PI*2;
            ctx.save();
            ctx.translate(Math.cos(angle)*orbitR, Math.sin(angle)*orbitR);
            ctx.rotate(angle+Math.PI/2);
            const cr = 11;
            ctx.beginPath(); ctx.arc(0, cr*0.25, cr*0.75, 0, Math.PI); ctx.fillStyle=color; ctx.fill();
            ctx.beginPath(); ctx.arc(0, cr*0.25, cr*0.75, Math.PI, Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
            ctx.beginPath(); ctx.arc(0, cr*0.25, cr*0.75, 0, Math.PI*2); ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1; ctx.stroke();
            ctx.restore();
        });
        ctx.beginPath(); ctx.arc(0,0,r*0.14,0,Math.PI*2); ctx.fillStyle='#f0ede6'; ctx.fill();
        ctx.strokeStyle='#bbb'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.restore();
    }

    function cdLoop() {
        if (isMusicPlaying) cdRotation += 0.018;
        drawCD(cdRotation);
        requestAnimationFrame(cdLoop);
    }
    drawCD(0);
    cdLoop();

    // 페이지 로드시 빈 레이더 바로 표시
    const radarCanvas = document.getElementById('radar-canvas');
    if (radarCanvas) radarCanvas.style.display = 'block';
    drawEmptyRadar();

    // 추천란 공란으로 보여주기
    if (emotionRec) { emotionRec.textContent = ''; emotionRec.style.display = 'block'; }

    // ── Music ──
    musicToggleBtn.addEventListener('click', () => {
        if (isMusicPlaying) { bgm.pause(); musicToggleBtn.textContent = 'PLAY'; }
        else { bgm.play().catch(e=>console.error(e)); musicToggleBtn.textContent = 'STOP'; }
        isMusicPlaying = !isMusicPlaying;
    });

    // ── AI Model ──
    async function loadModel() {
        try {
            segmenter = await bodySegmentation.createSegmenter(
                bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
                { runtime:'mediapipe', solutionPath:'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation', modelType:'general' }
            );
            loadingStatus.style.display = 'none';
            enableCameraBtn.disabled = false;
            triggerUploadBtn.disabled = false;
        } catch(e) { loadingStatus.textContent = "Model load failed!"; }
    }

    async function processImageSource(src) {
        if (!segmenter) { alert("Model still loading."); return null; }
        const tmp = document.createElement('canvas');
        const ctx = tmp.getContext('2d');
        tmp.width = (src.videoWidth||src.width)*0.5;
        tmp.height = (src.videoHeight||src.height)*0.5;
        ctx.drawImage(src, 0, 0, tmp.width, tmp.height);
        try {
            const seg = await segmenter.segmentPeople(tmp);
            if (!seg.length) { alert("No person found."); return null; }
            const mask = await bodySegmentation.toBinaryMask(seg,{r:0,g:0,b:0,a:255},{r:0,g:0,b:0,a:0});
            const id = ctx.getImageData(0,0,tmp.width,tmp.height);
            for (let i=0;i<id.data.length;i+=4){ if(mask.data[i+3]===0) id.data[i+3]=0; }
            ctx.putImageData(id,0,0);
            return tmp.toDataURL('image/png');
        } catch(e) { alert("Image processing error."); return null; }
    }

    function updateFace(url) {
        if (!url) return;
        capturedFaceDataUrl = url;
        // 원 1개만: face-preview 완전히 숨기고 captured-face만
        facePreview.style.display = 'none';
        capturedFaceImg.src = url;
        capturedFaceImg.style.display = 'block';
        predictCapturedFace(url);
        createSpheres();
    }

    // ── 레이더 차트 (각 꼭짓점 완전히 뾰족하게) ──
    function drawRadar(predictions, webcamCanvas) {
        const rc = document.getElementById('radar-canvas');
        if (!rc) return;
        const ctx = rc.getContext('2d');

        const all = [
            ...predictions.map(p => ({
                className: toEng(p.className),
                probability: p.probability
            })),
            ...EXTRA_EMOTIONS
        ];

        const size = rc.width;
        const cx = size/2, cy = size/2;
        const maxR = size * 0.33;
        const labelR = size * 0.46;
        const n = all.length;

        ctx.clearRect(0, 0, size, size);

        // 데이터 포인트
        const pts = all.map((p, i) => {
            const angle = (i/n)*Math.PI*2 - Math.PI/2;
            const r = maxR * Math.max(p.probability, 0.05);
            return { x: cx+Math.cos(angle)*r, y: cy+Math.sin(angle)*r };
        });

        // 완전히 직선으로 뾰족한 별 경로
        function sharpPath(points) {
            ctx.beginPath();
            points.forEach((pt, i) => {
                if (i===0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });
            ctx.closePath();
        }

        // 웹캠 클리핑
        if (webcamCanvas) {
            ctx.save();
            sharpPath(pts);
            ctx.clip();
            ctx.drawImage(webcamCanvas, cx-maxR, cy-maxR, maxR*2, maxR*2);
            ctx.restore();
        }

        // 동심원
        [0.33, 0.66, 1.0].forEach(ratio => {
            ctx.beginPath();
            ctx.arc(cx, cy, maxR*ratio, 0, Math.PI*2);
            ctx.strokeStyle = ratio===1.0 ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.13)';
            ctx.lineWidth = ratio===1.0 ? 1.5 : 1;
            ctx.setLineDash(ratio===1.0 ? [] : [3,4]);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // 축 + 라벨
        all.forEach((p, i) => {
            const angle = (i/n)*Math.PI*2 - Math.PI/2;
            const x = cx+Math.cos(angle)*maxR, y = cy+Math.sin(angle)*maxR;
            ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y);
            ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.stroke();
            ctx.font='7px "Press Start 2P", cursive';
            ctx.fillStyle='#222'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(p.className, cx+Math.cos(angle)*labelR, cy+Math.sin(angle)*labelR);
        });

        // 완전 직선 별 모양
        sharpPath(pts);
        ctx.strokeStyle='rgba(0,0,0,0.65)';
        ctx.lineWidth=1.8;
        ctx.stroke();
    }

    // ── Emotion ──
    const EMOTION_URL = "https://teachablemachine.withgoogle.com/models/oDqoAdBWt/";

    async function initEmotion() {
        try {
            startEmotionBtn.disabled = true;
            startEmotionBtn.textContent = "LOADING...";
            if (!emotionModel) emotionModel = await tmImage.load(EMOTION_URL+"model.json", EMOTION_URL+"metadata.json");
            emotionWebcam = new tmImage.Webcam(240, 240, true);
            await emotionWebcam.setup();
            await emotionWebcam.play();
            isEmotionScanning = true;
            radarCanvas.style.display = 'block';
            capturedEmotionDisplay.style.display = 'none';
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
        capturedEmotionDisplay.style.display = 'none';
        startEmotionBtn.style.display = 'inline-block';
        startEmotionBtn.disabled = false;
        startEmotionBtn.textContent = "SCAN ON";
        stopEmotionBtn.style.display = 'none';
        captureEmotionBtn.style.display = 'none';
        // 빈 레이더로 복원
        drawEmptyRadar();
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

        // 캡처 캔버스에 복사
        const rc = document.getElementById('radar-canvas');
        const ctx = emotionCaptureCanvas.getContext('2d');
        emotionCaptureCanvas.width = rc.width;
        emotionCaptureCanvas.height = rc.height;
        ctx.drawImage(rc, 0, 0);

        const all = [
            ...lastPredictions.map(p => ({ className: toEng(p.className), probability: p.probability })),
            ...EXTRA_EMOTIONS
        ];
        let top = { className:'JOY', probability:0 };
        all.forEach(p => { if (p.probability > top.probability) top = p; });

        // 결과: 원 그래프 아래 큰 글씨
        capturedEmotionResult.textContent = top.className;
        capturedEmotionResult.style.fontSize = '18px';
        capturedEmotionResult.style.fontWeight = 'bold';
        capturedEmotionResult.style.color = '#111';

        // 추천 텍스트
        if (emotionRec) {
            emotionRec.textContent = EMOTION_RECS[top.className] || EMOTION_RECS.JOY;
        }

        rc.style.display = 'none';
        captureEmotionBtn.style.display = 'none';
        capturedEmotionDisplay.style.display = 'block';
    }

    function rescanEmotion() {
        capturedEmotionDisplay.style.display = 'none';
        if (emotionRec) emotionRec.textContent = '';
        radarCanvas.style.display = 'block';
        isEmotionScanning = true;
        captureEmotionBtn.style.display = 'inline-block';
        emotionAnimationFrame = requestAnimationFrame(emotionLoop);
    }

    async function predictCapturedFace(url) {
        if (!emotionModel) {
            try { emotionModel = await tmImage.load(EMOTION_URL+"model.json", EMOTION_URL+"metadata.json"); }
            catch(e) { return; }
        }
        const img = new Image();
        img.onload = async () => {
            const pred = await emotionModel.predict(img);
            let top = { className:'JOY', probability:0 };
            pred.forEach(p => { if (p.probability > top.probability) top = p; });
            const eng = toEng(top.className);
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
            const img = await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=URL.createObjectURL(file); });
            updateFace(await processImageSource(img));
        } catch(err) { alert("Image load failed."); }
        finally { triggerUploadBtn.disabled=false; triggerUploadBtn.textContent="UPLOAD PHOTO"; uploadPhotoInput.value=''; }
    });

    function stopWebcam() {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t=>t.stop());
            videoContainer.style.display='none';
            takePhotoBtn.style.display='none';
            enableCameraBtn.style.display='inline-block';
        }
    }

    // ── Three.js (캡슐 80개, 크기 2배) ──
    let scene, camera, renderer, spheres = [];
    const sphereCount = 80;

    function init3D() {
        const { clientWidth:w, clientHeight:h } = globeContainer;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(40, w/h, 0.1, 1000);
        camera.position.set(0, 2.5, 6);
        renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);
        globeContainer.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const light = new THREE.DirectionalLight(0xffffff, 0.6);
        light.position.set(5,5,10); scene.add(light);
        createSpheres();
        animate();
    }

    async function createSpheres() {
        spheres.forEach(s=>scene.remove(s.mesh));
        spheres = [];
        // 크기 2배: 0.48 → 0.96
        const geometry = new THREE.SphereGeometry(0.96, 32, 32);
        let faceMat = null;
        if (capturedFaceDataUrl) {
            const c = document.createElement('canvas');
            const ctx = c.getContext('2d');
            c.width=256; c.height=256;
            ctx.fillStyle='#fecb05'; ctx.fillRect(0,0,256,256);
            const img = await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=capturedFaceDataUrl;});
            ctx.drawImage(img,28,28,200,200);
            faceMat = new THREE.MeshStandardMaterial({ map:new THREE.CanvasTexture(c), roughness:0.3 });
        }
        for (let i=0; i<sphereCount; i++) {
            const mat = faceMat ? faceMat.clone()
                : new THREE.MeshStandardMaterial({ color:new THREE.Color().setHSL(i/sphereCount,0.65,0.68), roughness:0.2, metalness:0.1 });
            const mesh = new THREE.Mesh(geometry, mat);
            mesh.position.set((Math.random()-0.5)*4, 1.5+Math.random()*4, (Math.random()-0.5)*1.5);
            spheres.push({ mesh, velocity:new THREE.Vector3(0,-0.05-Math.random()*0.05,0),
                angularVelocity:new THREE.Vector3(Math.random()-0.5,Math.random()-0.5,Math.random()-0.5).multiplyScalar(0.04),
                radius:0.96 });
            scene.add(mesh);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        spheres.forEach(s => {
            s.velocity.y -= 0.008;
            s.mesh.position.add(s.velocity);
            s.velocity.multiplyScalar(0.99);
            s.mesh.rotation.x += s.angularVelocity.x;
            s.mesh.rotation.y += s.angularVelocity.y;
            if (s.mesh.position.y < 0.5)  { s.mesh.position.y=0.5;  s.velocity.y*=-0.55; }
            if (s.mesh.position.y > 6.0)  { s.mesh.position.y=6.0;  s.velocity.y*=-0.6; }
            if (Math.abs(s.mesh.position.x)>2.8){ s.mesh.position.x=Math.sign(s.mesh.position.x)*2.8; s.velocity.x*=-0.6; }
            if (Math.abs(s.mesh.position.z)>1.5){ s.mesh.position.z=Math.sign(s.mesh.position.z)*1.5; s.velocity.z*=-0.6; }
        });
        for (let i=0;i<spheres.length;i++){
            for (let j=i+1;j<spheres.length;j++){
                const s1=spheres[i],s2=spheres[j];
                const diff=s1.mesh.position.clone().sub(s2.mesh.position);
                const dist=diff.length(),md=s1.radius+s2.radius;
                if(dist<md){
                    const n=diff.normalize(),ov=md-dist;
                    s1.mesh.position.add(n.clone().multiplyScalar(ov/2));
                    s2.mesh.position.sub(n.clone().multiplyScalar(ov/2));
                    const rv=s1.velocity.clone().sub(s2.velocity),vn=rv.dot(n);
                    if(vn<0){const imp=n.multiplyScalar(-1.8*vn/2);s1.velocity.add(imp);s2.velocity.sub(imp);}
                }
            }
        }
        renderer.render(scene, camera);
    }

    function spinGacha() {
        if (isSpinning) return;
        isSpinning = true;
        handle.classList.add('spin');
        spheres.forEach(s=>s.velocity.set((Math.random()-0.5)*0.5,Math.random()*0.8,(Math.random()-0.5)*0.5));
        setTimeout(dropCapsule, 800);
        setTimeout(()=>{ handle.classList.remove('spin'); isSpinning=false; }, 1200);
    }

    async function dropCapsule() {
        const cap = document.createElement('div');
        cap.className = 'capsule falling-capsule';
        if (capturedFaceDataUrl) {
            const c=document.createElement('canvas'); const ctx=c.getContext('2d');
            c.width=100; c.height=100;
            ctx.fillStyle='#fecb05'; ctx.fillRect(0,0,100,100);
            const img=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=capturedFaceDataUrl;});
            ctx.drawImage(img,10,10,80,80);
            cap.style.backgroundImage=`url(${c.toDataURL()})`; cap.style.backgroundSize='cover';
        } else {
            cap.style.backgroundColor=new THREE.Color().setHSL(Math.random(),0.8,0.65).getStyle();
        }
        chute.appendChild(cap);
        setTimeout(()=>{ showResult(cap.style.cssText); cap.remove(); }, 800);
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
