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
    const capturedEmotionText = document.getElementById('captured-emotion-text');
    const capturedEmotionDisplay = document.getElementById('captured-emotion-display');
    const emotionCaptureCanvas = document.getElementById('emotion-capture-canvas');
    const capturedEmotionResult = document.getElementById('captured-emotion-result');
    const emotionRec = document.getElementById('emotion-recommendation');
    const musicToggleBtn = document.getElementById('music-toggle');
    const bgm = document.getElementById('bgm');
    const cdCanvas = document.getElementById('cd-canvas');
    const langKorBtn = document.getElementById('lang-kor');
    const langEngBtn = document.getElementById('lang-eng');

    let currentLang = 'kor';
    let segmenter, capturedFaceDataUrl = null, isSpinning = false, isMusicPlaying = false;
    let emotionModel, emotionWebcam;
    let isEmotionScanning = false, emotionAnimationFrame;
    let lastPredictions = [];
    let cdRotation = 0;

    // ── 언어 데이터 ──
    const MISSIONS = {
        kor: [
            {
                title: "[미션: 찰나의 연기파]",
                desc: "지금 당장 인생에서 가장 치명적인 미소를 지으며 고개를 까딱해 보세요. 거울이 없다면 앞 화면을 거울이라 생각하세요. 당신의 자존감이 8% 강제 주입됩니다."
            },
            {
                title: "[미션: 귓가에 속삭임]",
                desc: "주변 눈치를 슬쩍 본 뒤, 내 손바닥에 대고 '나는 정말 멋져'라고 아주 작게 속삭이세요. 손바닥이 부끄러워하며 오늘의 잔잔한 행운을 배달해 줄 것입니다."
            },
            {
                title: "[미션: 허공의 오케스트라]",
                desc: "양손을 가슴 높이로 올리고, 허공에 대고 격렬하게 지휘를 5초간 하세요. 방금 머릿속을 복잡하게 만들던 고민의 소음이 강제로 '뮤트(Mute)' 처리됩니다."
            },
            {
                title: "[미션: 귀여움 수치 체크]",
                desc: "오른쪽 검지손가락으로 본인의 오른쪽 볼을 콕 찌른 채 3초간 멈추세요. 방금 당신의 귀여움 지수가 한계치를 돌파하여 스트레스 세포 5,000마리가 소멸했습니다."
            },
            {
                title: "[미션: 중력과의 밀당]",
                desc: "어깨를 귀에 닿을 것처럼 바짝 올렸다가, '툭-' 하고 한 번에 떨어뜨리세요. 방금 당신의 어깨 위에 앉아있던 월요병(혹은 피로) 귀신이 바닥으로 추락했습니다."
            },
            {
                title: "[미션: 눈동자 댄스]",
                desc: "머리는 가만히 두고 눈동자만 시계 방향으로 크게 세 번 돌리세요. 방금 당신의 시야에 낀 미세한 지루함이 12% 걷혔습니다. 눈 앞의 세상이 조금 더 선명해집니다."
            },
            {
                title: "[미션: 비밀 요원의 한 걸음]",
                desc: "다음 장소로 이동할 때, 첫 세 걸음은 비밀 요원이 된 것처럼 아주 은밀하고 조심스럽게 걸어가세요. 지루했던 일상이 갑자기 스펙터클한 영화로 전환됩니다."
            },
            {
                title: "[미션: 윙크 결계]",
                desc: "한쪽 눈으로 완벽한 윙크를 지어보세요. (잘 안된다면 눈을 질끈 감아도 인정) 방금 당신의 앞길을 막던 불운의 결계에 미세한 균열이 생겼습니다."
            },
            {
                title: "[미션: 심호흡 빌런]",
                desc: "코로 숨을 깊게 들이쉬고, 입으로 '후우-' 소리를 내며 뿜어내세요. 이때 세상에서 가장 한심한 한숨을 쉬는 것처럼 연기해야 효과가 좋습니다. 나쁜 기운 배출 완료."
            },
            {
                title: "[미션: 스마트폰과의 거리두기]",
                desc: "스마트폰 화면을 뒤집어 놓거나 주머니에 넣고, 딱 10초 동안만 주변의 가장 쓸데없는 물건 하나를 뚫어지게 쳐다보세요. 뇌가 '어처구니없어' 하며 강제 리프레시됩니다."
            }
        ],
        eng: [
            {
                title: "[Mission: The Subtle Actor]",
                desc: "Flash your most charming smile right now and give a slight tilt of your head. If there's no mirror, just pretend the screen is one. A 8% boost of pure confidence has just been forcefully injected into your system."
            },
            {
                title: "[Mission: Whispers to the Palm]",
                desc: "Quickly look around to check your surroundings, then whisper 'I am absolutely amazing' into your palm. Your palm will blush and deliver a tiny piece of good luck to your day."
            },
            {
                title: "[Mission: The Air Maestro]",
                desc: "Bring both hands up to your chest and conduct an imaginary orchestra aggressively for 5 seconds. All the noisy, complicated thoughts blocking your brain have just been forcefully muted."
            },
            {
                title: "[Mission: Cuteness Overload Check]",
                desc: "Poke your right cheek with your right index finger and hold it for 3 seconds. Your cuteness level has just broken the scale, instantly destroying 5,000 stress cells."
            },
            {
                title: "[Mission: Tug-of-War with Gravity]",
                desc: "Shrug your shoulders up as high as they can go—like they're trying to touch your ears—then drop them all at once. The fatigue monster sitting on your shoulders has just crashed to the floor."
            },
            {
                title: "[Mission: Eye Ball Dance]",
                desc: "Keep your head perfectly still and roll your eyes in a big circle clockwise three times. The subtle fog of boredom in your vision has cleared by 12%. The world looks a bit sharper now."
            },
            {
                title: "[Mission: Secret Agent Steps]",
                desc: "When you walk to your next destination, make your first three steps extremely stealthy and cautious, like a secret agent. Your boring daily routine has just turned into a blockbuster movie."
            },
            {
                title: "[Mission: The Barrier-Breaking Wink]",
                desc: "Give a perfect wink with one eye. (If you can't, blinking both eyes tightly counts too!) A tiny crack has just formed in the barrier of bad luck blocking your path."
            },
            {
                title: "[Mission: The Ultimate Sigh]",
                desc: "Inhale deeply through your nose, then let out a massive breath through your mouth with a 'whoosh' sound. It works best if you dramaticize it, acting like you're having the most pathetic day ever. Bad vibes expelled!"
            },
            {
                title: "[Mission: Distancing from the Screen]",
                desc: "Flip your phone face down or put it in your pocket, and stare at the most useless object around you for exactly 10 seconds. Your brain will think 'well, this is absurd' and trigger a forced refresh."
            }
        ]
    };

    const EMOTION_RECS = {
        kor: {
            JOY:     "기쁨에 어울리는 차: 꿀 카모마일 티. 달콤한 마카롱이나 과일 타르트가 행복을 더해줄 거예요.",
            SADNESS: "따뜻한 호지차나 코코아가 마음을 달래줍니다. 진한 초콜릿과 마들렌이 좋은 친구가 되어줄 거예요.",
            ANGER:   "시원한 페퍼민트 티로 화를 식혀보세요. 오이나 셀러리 스틱이 마음을 리셋시켜 줄 거예요.",
            ANXIETY: "라벤더 또는 레몬밤 차가 불안을 달래줍니다. 담백한 쌀과자나 플레인 요거트를 추천해요.",
            LOVE:    "로즈힙 티가 따뜻한 마음과 잘 어울려요. 딸기 디저트나 크림 슈가 오늘의 달콤함을 완성시켜 줄 거예요."
        },
        eng: {
            JOY:     "Perfect match: chamomile tea with honey. Sweet macarons or fruit tarts will amplify your happiness even more.",
            SADNESS: "A warm cup of hojicha or cocoa will gently comfort your heart. Dark chocolate and soft madeleines are perfect companions.",
            ANGER:   "Cool peppermint tea will calm your heated mind. Crisp cucumber or celery snacks bring a refreshing reset.",
            ANXIETY: "Lavender or lemon balm tea soothes anxious nerves. Light rice crackers or plain yogurt settle an uneasy stomach.",
            LOVE:    "Rose hip tea mirrors your warm and loving heart. Strawberry desserts and soft cream puffs echo your sweetness."
        }
    };

    // ── 언어 토글 ──
    function setLang(lang) {
        currentLang = lang;
        if (lang === 'kor') {
            langKorBtn.classList.add('active');
            langEngBtn.classList.remove('active');
        } else {
            langEngBtn.classList.add('active');
            langKorBtn.classList.remove('active');
        }
    }

    langKorBtn.addEventListener('click', () => setLang('kor'));
    langEngBtn.addEventListener('click', () => setLang('eng'));

    // ── 감정 관련 ──
    const EXTRA_EMOTIONS = [
        { className: 'ANXIETY', probability: 0.5 },
        { className: 'LOVE',    probability: 0.5 }
    ];

    const EMOTION_MAP = {
        '기쁨': 'JOY', '행복': 'JOY', '즐거움': 'JOY',
        '슬픔': 'SADNESS', '슬퍼': 'SADNESS',
        '분노': 'ANGER', '화남': 'ANGER', '화': 'ANGER',
        'angry': 'ANGER', 'anger': 'ANGER',
        'happy': 'JOY', 'joy': 'JOY',
        'sad': 'SADNESS', 'sadness': 'SADNESS',
    };

    function toEng(className) {
        if (!className) return 'UNKNOWN';
        const t = className.trim(), l = t.toLowerCase();
        if (EMOTION_MAP[t]) return EMOTION_MAP[t];
        if (EMOTION_MAP[l]) return EMOTION_MAP[l];
        if (l.includes('분노')||l.includes('화남')||l.includes('화')||l.includes('anger')||l.includes('angry')) return 'ANGER';
        if (l.includes('기쁨')||l.includes('행복')||l.includes('joy')||l.includes('happy')) return 'JOY';
        if (l.includes('슬픔')||l.includes('sad')) return 'SADNESS';
        return t.toUpperCase();
    }

    // ── 빈 레이더 ──
    function drawEmptyRadar() {
        const rc = document.getElementById('radar-canvas');
        if (!rc) return;
        const ctx = rc.getContext('2d');
        const labels = ['JOY','SADNESS','ANGER','ANXIETY','LOVE'];
        const size = rc.width, cx = size/2, cy = size/2;
        const maxR = size*0.33, labelR = size*0.46, n = labels.length;
        ctx.clearRect(0,0,size,size);
        [0.33,0.66,1.0].forEach(ratio => {
            ctx.beginPath(); ctx.arc(cx,cy,maxR*ratio,0,Math.PI*2);
            ctx.strokeStyle = ratio===1.0?'rgba(0,0,0,0.35)':'rgba(0,0,0,0.12)';
            ctx.lineWidth = ratio===1.0?1.5:1;
            ctx.setLineDash(ratio===1.0?[]:[3,4]); ctx.stroke(); ctx.setLineDash([]);
        });
        labels.forEach((label,i) => {
            const angle = (i/n)*Math.PI*2-Math.PI/2;
            ctx.beginPath(); ctx.moveTo(cx,cy);
            ctx.lineTo(cx+Math.cos(angle)*maxR, cy+Math.sin(angle)*maxR);
            ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1; ctx.stroke();
            ctx.font='7px "Press Start 2P", cursive';
            ctx.fillStyle='#555'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(label, cx+Math.cos(angle)*labelR, cy+Math.sin(angle)*labelR);
        });
    }

    // ── CD 2D ──
    const capsuleColors = ['#ff8fa3','#a8d8ea','#b5ead7','#ffd6a5','#c9b1ff','#fdffb6'];

    function drawCD(rotation) {
        const ctx = cdCanvas.getContext('2d');
        const w=cdCanvas.width, h=cdCanvas.height, cx=w/2, cy=h/2, r=w/2-2;
        ctx.clearRect(0,0,w,h);
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(rotation);
        ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle='#dddad2'; ctx.fill();
        for(let i=0;i<4;i++){
            ctx.beginPath(); ctx.arc(0,0,r*(0.4+i*0.15),0,Math.PI*2);
            ctx.strokeStyle=`rgba(255,255,255,${0.25-i*0.05})`; ctx.lineWidth=2; ctx.stroke();
        }
        const orbitR=r*0.6;
        capsuleColors.forEach((color,i)=>{
            const angle=(i/capsuleColors.length)*Math.PI*2;
            ctx.save(); ctx.translate(Math.cos(angle)*orbitR, Math.sin(angle)*orbitR);
            ctx.rotate(angle+Math.PI/2);
            const cr=11;
            ctx.beginPath(); ctx.arc(0,cr*0.25,cr*0.75,0,Math.PI); ctx.fillStyle=color; ctx.fill();
            ctx.beginPath(); ctx.arc(0,cr*0.25,cr*0.75,Math.PI,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
            ctx.beginPath(); ctx.arc(0,cr*0.25,cr*0.75,0,Math.PI*2);
            ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1; ctx.stroke();
            ctx.restore();
        });
        ctx.beginPath(); ctx.arc(0,0,r*0.14,0,Math.PI*2);
        ctx.fillStyle='#f0ede6'; ctx.fill(); ctx.strokeStyle='#bbb'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.restore();
    }

    function cdLoop() {
        if (isMusicPlaying) cdRotation+=0.018;
        drawCD(cdRotation);
        requestAnimationFrame(cdLoop);
    }
    drawCD(0); cdLoop();

    // 페이지 로드시 빈 레이더
    const radarCanvas = document.getElementById('radar-canvas');
    if (radarCanvas) radarCanvas.style.display='block';
    drawEmptyRadar();
    if (emotionRec) { emotionRec.textContent=''; }

    // ── Music ──
    musicToggleBtn.addEventListener('click', ()=>{
        if(isMusicPlaying){ bgm.pause(); musicToggleBtn.textContent='PLAY'; }
        else { bgm.play().catch(e=>console.error(e)); musicToggleBtn.textContent='STOP'; }
        isMusicPlaying=!isMusicPlaying;
    });

    // ── AI Model ──
    async function loadModel() {
        try {
            segmenter = await bodySegmentation.createSegmenter(
                bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
                {runtime:'mediapipe',solutionPath:'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation',modelType:'general'}
            );
            loadingStatus.style.display='none';
            enableCameraBtn.disabled=false;
            triggerUploadBtn.disabled=false;
        } catch(e){ loadingStatus.textContent="Model load failed!"; }
    }

    async function processImageSource(src) {
        if(!segmenter){ alert("Model still loading."); return null; }
        const tmp=document.createElement('canvas'); const ctx=tmp.getContext('2d');
        tmp.width=(src.videoWidth||src.width)*0.5;
        tmp.height=(src.videoHeight||src.height)*0.5;
        ctx.drawImage(src,0,0,tmp.width,tmp.height);
        try {
            const seg=await segmenter.segmentPeople(tmp);
            if(!seg.length){ alert("No person found."); return null; }
            const mask=await bodySegmentation.toBinaryMask(seg,{r:0,g:0,b:0,a:255},{r:0,g:0,b:0,a:0});
            const id=ctx.getImageData(0,0,tmp.width,tmp.height);
            for(let i=0;i<id.data.length;i+=4){ if(mask.data[i+3]===0) id.data[i+3]=0; }
            ctx.putImageData(id,0,0);
            return tmp.toDataURL('image/png');
        } catch(e){ alert("Image processing error."); return null; }
    }

    function updateFace(url) {
        if(!url) return;
        capturedFaceDataUrl=url;
        facePreview.style.display='none';
        capturedFaceImg.src=url;
        capturedFaceImg.style.display='block';
        predictCapturedFace(url);
        createSpheres();
    }

    // ── 레이더 차트 ──
    function drawRadar(predictions, webcamCanvas) {
        const rc=document.getElementById('radar-canvas');
        if(!rc) return;
        const ctx=rc.getContext('2d');
        const all=[
            ...predictions.map(p=>({className:toEng(p.className),probability:p.probability})),
            ...EXTRA_EMOTIONS
        ];
        const size=rc.width, cx=size/2, cy=size/2;
        const maxR=size*0.33, labelR=size*0.46, n=all.length;
        ctx.clearRect(0,0,size,size);
        const pts=all.map((p,i)=>{
            const angle=(i/n)*Math.PI*2-Math.PI/2;
            const r=maxR*Math.max(p.probability,0.05);
            return {x:cx+Math.cos(angle)*r, y:cy+Math.sin(angle)*r};
        });
        function sharpPath(points){
            ctx.beginPath();
            points.forEach((pt,i)=>{ if(i===0) ctx.moveTo(pt.x,pt.y); else ctx.lineTo(pt.x,pt.y); });
            ctx.closePath();
        }
        if(webcamCanvas){
            ctx.save(); sharpPath(pts); ctx.clip();
            ctx.drawImage(webcamCanvas,cx-maxR,cy-maxR,maxR*2,maxR*2);
            ctx.restore();
        }
        [0.33,0.66,1.0].forEach(ratio=>{
            ctx.beginPath(); ctx.arc(cx,cy,maxR*ratio,0,Math.PI*2);
            ctx.strokeStyle=ratio===1.0?'rgba(0,0,0,0.4)':'rgba(0,0,0,0.13)';
            ctx.lineWidth=ratio===1.0?1.5:1;
            ctx.setLineDash(ratio===1.0?[]:[3,4]); ctx.stroke(); ctx.setLineDash([]);
        });
        all.forEach((p,i)=>{
            const angle=(i/n)*Math.PI*2-Math.PI/2;
            const x=cx+Math.cos(angle)*maxR, y=cy+Math.sin(angle)*maxR;
            ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y);
            ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.stroke();
            ctx.font='7px "Press Start 2P", cursive';
            ctx.fillStyle='#222'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(p.className, cx+Math.cos(angle)*labelR, cy+Math.sin(angle)*labelR);
        });
        sharpPath(pts);
        ctx.strokeStyle='rgba(0,0,0,0.65)'; ctx.lineWidth=1.8; ctx.stroke();
    }

    // ── Emotion ──
    const EMOTION_URL="https://teachablemachine.withgoogle.com/models/oDqoAdBWt/";

    async function initEmotion() {
        try {
            startEmotionBtn.disabled=true; startEmotionBtn.textContent="LOADING...";
            if(!emotionModel) emotionModel=await tmImage.load(EMOTION_URL+"model.json",EMOTION_URL+"metadata.json");
            emotionWebcam=new tmImage.Webcam(240,240,true);
            await emotionWebcam.setup(); await emotionWebcam.play();
            isEmotionScanning=true;
            radarCanvas.style.display='block';
            capturedEmotionDisplay.style.display='none';
            if(capturedEmotionResult) capturedEmotionResult.style.display='none';
            startEmotionBtn.style.display='none';
            stopEmotionBtn.style.display='inline-block';
            captureEmotionBtn.style.display='inline-block';
            emotionAnimationFrame=requestAnimationFrame(emotionLoop);
        } catch(e){
            console.error(e); alert("Emotion model load failed.");
            startEmotionBtn.disabled=false; startEmotionBtn.textContent="SCAN ON";
        }
    }

    function stopEmotion() {
        isEmotionScanning=false;
        if(emotionAnimationFrame) cancelAnimationFrame(emotionAnimationFrame);
        if(emotionWebcam) emotionWebcam.stop();
        capturedEmotionDisplay.style.display='none';
        if(capturedEmotionResult){ capturedEmotionResult.textContent=''; capturedEmotionResult.style.display='none'; }
        if(emotionRec) emotionRec.textContent='';
        startEmotionBtn.style.display='inline-block';
        startEmotionBtn.disabled=false; startEmotionBtn.textContent="SCAN ON";
        stopEmotionBtn.style.display='none';
        captureEmotionBtn.style.display='none';
        drawEmptyRadar();
    }

    async function emotionLoop() {
        if(!isEmotionScanning) return;
        emotionWebcam.update();
        try {
            lastPredictions=await emotionModel.predict(emotionWebcam.canvas);
            drawRadar(lastPredictions,emotionWebcam.canvas);
        } catch(e){ console.error(e); }
        emotionAnimationFrame=requestAnimationFrame(emotionLoop);
    }

    async function captureEmotion() {
        if(!lastPredictions.length) return;
        isEmotionScanning=false;
        if(emotionAnimationFrame) cancelAnimationFrame(emotionAnimationFrame);
        const rc=document.getElementById('radar-canvas');
        const ctx=emotionCaptureCanvas.getContext('2d');
        emotionCaptureCanvas.width=rc.width; emotionCaptureCanvas.height=rc.height;
        ctx.drawImage(rc,0,0);
        const all=[
            ...lastPredictions.map(p=>({className:toEng(p.className),probability:p.probability})),
            ...EXTRA_EMOTIONS
        ];
        let top={className:'JOY',probability:0};
        all.forEach(p=>{ if(p.probability>top.probability) top=p; });

        // 감정 이름 원 아래에 표시
        if(capturedEmotionResult){
            capturedEmotionResult.textContent=top.className;
            capturedEmotionResult.style.display='block';
        }
        // 추천 텍스트
        if(emotionRec) emotionRec.textContent=EMOTION_RECS[currentLang][top.className]||EMOTION_RECS[currentLang].JOY;

        rc.style.display='none';
        captureEmotionBtn.style.display='none';
        capturedEmotionDisplay.style.display='block';
    }

    async function predictCapturedFace(url) {
        if(!emotionModel){
            try{ emotionModel=await tmImage.load(EMOTION_URL+"model.json",EMOTION_URL+"metadata.json"); }
            catch(e){ return; }
        }
        const img=new Image();
        img.onload=async()=>{
            const pred=await emotionModel.predict(img);
            let top={className:'JOY',probability:0};
            pred.forEach(p=>{ if(p.probability>top.probability) top=p; });
            const eng=toEng(top.className);
            if(capturedEmotionText){ capturedEmotionText.textContent=`EMOTION: ${eng}`; capturedEmotionText.style.display='block'; }
        };
        img.src=url;
    }

    startEmotionBtn.addEventListener('click', initEmotion);
    stopEmotionBtn.addEventListener('click', stopEmotion);
    captureEmotionBtn.addEventListener('click', captureEmotion);

    // ── Camera ──
    enableCameraBtn.addEventListener('click', async()=>{
        try {
            const stream=await navigator.mediaDevices.getUserMedia({video:true});
            video.srcObject=stream;
            videoContainer.style.display='block';
            enableCameraBtn.style.display='none';
            takePhotoBtn.style.display='inline-block';
            takePhotoBtn.disabled=false;
        } catch(e){ alert('Camera access required.'); }
    });

    takePhotoBtn.addEventListener('click', async()=>{
        if(!video.srcObject) return;
        updateFace(await processImageSource(video));
        stopWebcam();
    });

    triggerUploadBtn.addEventListener('click', ()=>uploadPhotoInput.click());

    uploadPhotoInput.addEventListener('change', async(e)=>{
        const file=e.target.files[0]; if(!file) return;
        triggerUploadBtn.disabled=true; triggerUploadBtn.textContent="PROCESSING...";
        try {
            const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=URL.createObjectURL(file); });
            updateFace(await processImageSource(img));
        } catch(err){ alert("Image load failed."); }
        finally{ triggerUploadBtn.disabled=false; triggerUploadBtn.textContent="UPLOAD PHOTO"; uploadPhotoInput.value=''; }
    });

    function stopWebcam() {
        if(video.srcObject){
            video.srcObject.getTracks().forEach(t=>t.stop());
            videoContainer.style.display='none';
            takePhotoBtn.style.display='none';
            enableCameraBtn.style.display='inline-block';
        }
    }

    // ── Three.js ──
    let scene, camera, renderer, spheres=[];
    const sphereCount=56;

    function init3D() {
        const {clientWidth:w,clientHeight:h}=globeContainer;
        scene=new THREE.Scene();
        camera=new THREE.PerspectiveCamera(40,w/h,0.1,1000);
        camera.position.set(0,2.5,6);
        renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
        renderer.setSize(w,h); renderer.setPixelRatio(window.devicePixelRatio);
        globeContainer.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff,0.8));
        const light=new THREE.DirectionalLight(0xffffff,0.6);
        light.position.set(5,5,10); scene.add(light);
        createSpheres(); animate();
    }

    async function createSpheres() {
        spheres.forEach(s=>scene.remove(s.mesh)); spheres=[];
        const geometry=new THREE.SphereGeometry(0.48,32,32);
        let faceMat=null;
        if(capturedFaceDataUrl){
            const c=document.createElement('canvas'); const ctx=c.getContext('2d');
            c.width=256; c.height=256;
            ctx.fillStyle='#fecb05'; ctx.fillRect(0,0,256,256);
            const img=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=capturedFaceDataUrl;});
            ctx.drawImage(img,28,28,200,200);
            faceMat=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(c),roughness:0.3});
        }
        for(let i=0;i<sphereCount;i++){
            const mat=faceMat?faceMat.clone():new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(i/sphereCount,0.65,0.68),roughness:0.2,metalness:0.1});
            const mesh=new THREE.Mesh(geometry,mat);
            mesh.position.set((Math.random()-0.5)*3.5,1.5+Math.random()*3,(Math.random()-0.5)*1.3);
            spheres.push({mesh,velocity:new THREE.Vector3(0,-0.05-Math.random()*0.05,0),
                angularVelocity:new THREE.Vector3(Math.random()-0.5,Math.random()-0.5,Math.random()-0.5).multiplyScalar(0.04),radius:0.48});
            scene.add(mesh);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        spheres.forEach(s=>{
            s.velocity.y-=0.008; s.mesh.position.add(s.velocity); s.velocity.multiplyScalar(0.99);
            s.mesh.rotation.x+=s.angularVelocity.x; s.mesh.rotation.y+=s.angularVelocity.y;
            if(s.mesh.position.y<0.5){s.mesh.position.y=0.5;s.velocity.y*=-0.55;}
            if(s.mesh.position.y>5.5){s.mesh.position.y=5.5;s.velocity.y*=-0.6;}
            if(Math.abs(s.mesh.position.x)>2.6){s.mesh.position.x=Math.sign(s.mesh.position.x)*2.6;s.velocity.x*=-0.6;}
            if(Math.abs(s.mesh.position.z)>1.3){s.mesh.position.z=Math.sign(s.mesh.position.z)*1.3;s.velocity.z*=-0.6;}
        });
        for(let i=0;i<spheres.length;i++){
            for(let j=i+1;j<spheres.length;j++){
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
        renderer.render(scene,camera);
    }

    function spinGacha() {
        if(isSpinning) return;
        isSpinning=true;
        handle.classList.add('spin');
        spheres.forEach(s=>s.velocity.set((Math.random()-0.5)*0.5,Math.random()*0.8,(Math.random()-0.5)*0.5));
        setTimeout(dropCapsule,800);
        setTimeout(()=>{handle.classList.remove('spin');isSpinning=false;},1200);
    }

    async function dropCapsule() {
        const cap=document.createElement('div');
        cap.className='capsule falling-capsule';
        if(capturedFaceDataUrl){
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
        setTimeout(()=>{ showResult(); cap.remove(); },800);
    }

    function showResult() {
        const missions=MISSIONS[currentLang];
        const picked=missions[Math.floor(Math.random()*missions.length)];
        document.getElementById('item-name').textContent=picked.title;
        document.getElementById('item-desc').textContent=picked.desc;
        document.getElementById('modal-title').textContent=currentLang==='kor'?'YOU GOT':'YOU GOT';
        modal.style.display='flex';
        document.getElementById('capsule-result-container').classList.add('open');
    }

    handle.addEventListener('click', spinGacha);
    spinButton.addEventListener('click', spinGacha);
    loadModel();
    init3D();
});

function closeModal() {
    const modal=document.getElementById('result-modal');
    if(modal){
        const c=document.getElementById('capsule-result-container');
        if(c) c.classList.remove('open');
        modal.style.display='none';
    }
}
