document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const handle = document.getElementById('handle');
    const spinButton = document.getElementById('spin-button');
    const chute = document.getElementById('chute');
    const modal = document.getElementById('result-modal');
    const globeContainer = document.querySelector('.globe-container');
    const video = document.getElementById('video');
    const enableCameraBtn = document.getElementById('enable-camera');
    const takePhotoBtn = document.getElementById('take-photo');
    const uploadPhotoInput = document.getElementById('upload-photo');
    const triggerUploadBtn = document.getElementById('trigger-upload');
    const facePreview = document.getElementById('face-preview');
    const capturedFaceImg = document.getElementById('captured-face');
    const videoContainer = document.querySelector('.video-container');
    const loadingStatus = document.getElementById('loading-status');

    // --- State Variables ---
    let segmenter;
    let capturedFaceDataUrl = null;
    let isSpinning = false;
    const positiveMessages = [
        "너의 미래는 밝게 빛나고 있어!", "오늘의 한 걸음이 위대한 내일이 될 거야.", "너는 이미 충분히 멋진 사람이야.",
        "네가 가는 길이 곧 정답이 될 거야.", "작은 노력이 모여 찬란한 꽃을 피울 거야.", "네 안의 무한한 가능성을 믿어봐!",
        "세상은 너의 도전을 기다리고 있어.", "지금의 시련은 너를 더 단단하게 만들 거야.", "너를 응원하는 우주의 기운을 느껴봐!",
        "포기하지 않는 너의 모습이 가장 아름다워.", "기적은 네가 믿는 순간 시작될 거야.", "너는 사랑받기 위해 태어난 소중한 존재야."
    ];

    // --- Core Logic ---

    // 1. Load the AI Model
    async function loadModel() {
        try {
            const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
            const segmenterConfig = { runtime: 'mediapipe', solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation', modelType: 'general' };
            segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
            console.log("AI Model Loaded Successfully.");
            // Enable UI after model is loaded
            loadingStatus.style.display = 'none';
            enableCameraBtn.disabled = false;
            triggerUploadBtn.disabled = false;
        } catch (error) {
            console.error("Error loading AI model:", error);
            loadingStatus.textContent = "AI 모델 로딩 실패!";
        }
    }

    // 2. Process any image source (video or image) to remove background
    async function processImageSource(sourceElement) {
        if (!segmenter) {
            alert("AI 모델이 아직 로딩 중입니다. 잠시 후 다시 시도해주세요.");
            return null;
        }

        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        const scale = 0.5; // Processing at 50% resolution for better performance
        tempCanvas.width = (sourceElement.videoWidth || sourceElement.width) * scale;
        tempCanvas.height = (sourceElement.videoHeight || sourceElement.height) * scale;
        ctx.drawImage(sourceElement, 0, 0, tempCanvas.width, tempCanvas.height);

        try {
            const segmentation = await segmenter.segmentPeople(tempCanvas);
            if (segmentation.length === 0) {
                alert("사진에서 사람을 찾지 못했습니다.");
                return null;
            }

            const personMask = await bodySegmentation.toBinaryMask(segmentation, { r: 0, g: 0, b: 0, a: 0 }, { r: 0, g: 0, b: 0, a: 255 });
            await bodySegmentation.drawMask(tempCanvas, tempCanvas, personMask, 1.0, 0);
            return tempCanvas.toDataURL('image/png');

        } catch (error) {
            console.error("Error during image processing:", error);
            alert("이미지 처리 중 오류가 발생했습니다.");
            return null;
        }
    }
    
    // 3. Update the UI and gacha machine with the processed image
    function updateFace(imageDataUrl) {
        if (!imageDataUrl) return;
        capturedFaceDataUrl = imageDataUrl;
        capturedFaceImg.src = capturedFaceDataUrl;
        capturedFaceImg.style.display = 'block';
        facePreview.style.display = 'none';
        createSpheres(); // Refresh gacha capsules
    }

    // --- Event Handlers ---

    // Handle Webcam Activation
    enableCameraBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            videoContainer.style.display = 'block';
            enableCameraBtn.style.display = 'none';
            takePhotoBtn.style.display = 'inline-block';
            takePhotoBtn.disabled = false; // Explicitly enable button
        } catch (err) {
            console.error("Camera access denied:", err);
            alert('카메라 접근 권한이 필요합니다.');
        }
    });

    // Handle Taking a Photo
    takePhotoBtn.addEventListener('click', async () => {
        if (!video.srcObject) return;
        const imageDataUrl = await processImageSource(video);
        updateFace(imageDataUrl);
        stopWebcam();
    });

    // Handle File Upload Button Click
    triggerUploadBtn.addEventListener('click', () => uploadPhotoInput.click());

    // Handle File Selection
    uploadPhotoInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        triggerUploadBtn.disabled = true;
        triggerUploadBtn.textContent = "처리 중...";

        try {
            const img = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = (err) => reject(err);
                image.src = URL.createObjectURL(file);
            });
            const imageDataUrl = await processImageSource(img);
            updateFace(imageDataUrl);
        } catch (error) {
            console.error("Error loading uploaded file:", error);
            alert("이미지 파일을 불러오는 데 실패했습니다.");
        } finally {
            triggerUploadBtn.disabled = false;
            triggerUploadBtn.textContent = "UPLOAD PHOTO";
            uploadPhotoInput.value = ''; // Reset for next upload
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

    // --- Three.js Gacha Machine ---
    let scene, camera, renderer, spheres = [];
    const sphereCount = 25;

    function init3D() {
        const { clientWidth: width, clientHeight: height } = globeContainer;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 5;
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        globeContainer.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xaaaaaa));
        const light = new THREE.DirectionalLight(0xffffff, 0.8);
        light.position.set(5, 5, 10);
        scene.add(light);

        createSpheres();
        animate();
    }

    function createSpheres() {
        spheres.forEach(s => scene.remove(s.mesh));
        spheres = [];
        const geometry = new THREE.SphereGeometry(0.7, 32, 16);
        const textureLoader = new THREE.TextureLoader();
        const faceMaterial = capturedFaceDataUrl ? new THREE.MeshStandardMaterial({ map: textureLoader.load(capturedFaceDataUrl), roughness: 0.3 }) : null;

        for (let i = 0; i < sphereCount; i++) {
            const material = faceMaterial ? faceMaterial : new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6) });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
            const sphere = { mesh, velocity: new THREE.Vector3(), angularVelocity: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.05) };
            spheres.push(sphere);
            scene.add(mesh);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        const gravity = -0.01;
        const bounce = -0.5;
        const damping = 0.98;

        spheres.forEach(sphere => {
            sphere.velocity.y += gravity;
            sphere.mesh.position.add(sphere.velocity);
            sphere.velocity.multiplyScalar(damping); // Air resistance

            sphere.mesh.rotation.x += sphere.angularVelocity.x;
            sphere.mesh.rotation.y += sphere.angularVelocity.y;

            // Boundary collisions
            if (sphere.mesh.position.y < -2.2) { sphere.mesh.position.y = -2.2; sphere.velocity.y *= bounce; }
            if (Math.abs(sphere.mesh.position.x) > 2.4) { sphere.mesh.position.x = Math.sign(sphere.mesh.position.x) * 2.4; sphere.velocity.x *= bounce; }
            if (Math.abs(sphere.mesh.position.z) > 1.4) { sphere.mesh.position.z = Math.sign(sphere.mesh.position.z) * 1.4; sphere.velocity.z *= bounce; }
        });
        renderer.render(scene, camera);
    }

    // --- Gacha Controls ---
    function spinGacha() {
        if (isSpinning) return;
        isSpinning = true;
        handle.classList.add('spin');
        spheres.forEach(sphere => { // Give capsules a kick
            sphere.velocity.set((Math.random() - 0.5) * 0.4, Math.random() * 0.8, (Math.random() - 0.5) * 0.4);
        });
        setTimeout(dropCapsule, 800);
        setTimeout(() => { handle.classList.remove('spin'); isSpinning = false; }, 1200);
    }

    function dropCapsule() {
        const fallingCap = document.createElement('div');
        fallingCap.className = 'capsule falling-capsule';
        const randomColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.6).getStyle();
        
        if (capturedFaceDataUrl) {
            fallingCap.style.backgroundImage = `url(${capturedFaceDataUrl})`;
            fallingCap.style.backgroundSize = 'cover';
        } else {
            fallingCap.style.backgroundColor = randomColor;
        }
        chute.appendChild(fallingCap);
        setTimeout(() => { showResult(fallingCap.style.cssText); fallingCap.remove(); }, 800);
    }

    function showResult(capsuleStyle) {
        const capsuleTop = document.getElementById('capsule-top');
        const itemName = document.getElementById('item-name');
        capsuleTop.style.cssText = capsuleStyle;
        const randomMsg = positiveMessages[Math.floor(Math.random() * positiveMessages.length)];
        itemName.textContent = randomMsg;
        modal.style.display = 'flex';
        document.getElementById('capsule-result-container').classList.add('open');
    }

    handle.addEventListener('click', spinGacha);
    spinButton.addEventListener('click', spinGacha);

    // --- Initializations ---
    loadModel();
    init3D();
});

function closeModal() {
    const modal = document.getElementById('result-modal');
    if (modal) {
        const container = document.getElementById('capsule-result-container');
        if(container) container.classList.remove('open');
        modal.style.display = 'none';
    }
}
