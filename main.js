document.addEventListener('DOMContentLoaded', async () => {
    // --- Elements ---
    const handle = document.getElementById('handle');
    const spinButton = document.getElementById('spin-button');
    const chute = document.getElementById('chute');
    const modal = document.getElementById('result-modal');
    const globeContainer = document.querySelector('.globe-container');
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const enableCameraBtn = document.getElementById('enable-camera');
    const takePhotoBtn = document.getElementById('take-photo');
    const uploadPhotoInput = document.getElementById('upload-photo');
    const triggerUploadBtn = document.getElementById('trigger-upload');
    const facePreview = document.getElementById('face-preview');
    const videoContainer = document.querySelector('.video-container');

    // --- Face Recognition Model (BlazeFace) ---
    let model;
    async function loadModel() {
        model = await blazeface.load();
        console.log("BlazeFace Model Loaded");
    }
    loadModel();

    // --- State ---
    let capturedFaceDataUrl = null;
    let isSpinning = false;
    const positiveMessages = [
        "너의 미래는 밝게 빛나고 있어!",
        "오늘의 한 걸음이 위대한 내일이 될 거야.",
        "너는 이미 충분히 멋진 사람이야.",
        "네가 가는 길이 곧 정답이 될 거야.",
        "작은 노력이 모여 찬란한 꽃을 피울 거야.",
        "네 안의 무한한 가능성을 믿어봐!",
        "세상은 너의 도전을 기다리고 있어.",
        "지금의 시련은 너를 더 단단하게 만들 거야.",
        "너를 응원하는 우주의 기운을 느껴봐.",
        "포기하지 않는 너의 모습이 가장 아름다워.",
        "기적은 네가 믿는 순간 시작될 거야.",
        "너는 사랑받기 위해 태어난 소중한 존재야."
    ];

    // --- Three.js Physics Setup ---
    let scene, camera, renderer, spheres = [];
    const sphereCount = 20;
    const gravity = 0.005;
    const friction = 0.98;
    const wallFriction = 0.8;

    function init3D() {
        const width = globeContainer.clientWidth;
        const height = globeContainer.clientHeight;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 5;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio / 4);
        globeContainer.appendChild(renderer.domElement);

        const light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(5, 5, 5);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0x808080));

        createSpheres();
        animate();
    }

    function createSpheres() {
        spheres.forEach(s => scene.remove(s));
        spheres = [];

        const geometry = new THREE.SphereGeometry(0.7, 32, 32);
        const textureLoader = new THREE.TextureLoader();
        
        for (let i = 0; i < sphereCount; i++) {
            let material;
            if (capturedFaceDataUrl) {
                const texture = textureLoader.load(capturedFaceDataUrl);
                material = new THREE.MeshStandardMaterial({ 
                    map: texture,
                    transparent: true,
                    roughness: 0.1,
                    metalness: 0.1
                });
            } else {
                const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
                material = new THREE.MeshStandardMaterial({ color: color });
            }

            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set((Math.random()-0.5)*3, -1.5+(Math.random()*0.5), (Math.random()-0.5)*1.5);
            sphere.userData.velocity = new THREE.Vector3(0, 0, 0);

            scene.add(sphere);
            spheres.push(sphere);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        spheres.forEach((sphere, idx) => {
            sphere.userData.velocity.y -= gravity;
            sphere.position.add(sphere.userData.velocity);

            const floorLevel = -2.2;
            const wallX = 2.4;
            const wallZ = 1.4;

            if (sphere.position.y <= floorLevel) {
                sphere.position.y = floorLevel;
                sphere.userData.velocity.y *= -0.4;
                sphere.userData.velocity.multiplyScalar(friction);
            }
            if (Math.abs(sphere.position.x) > wallX) {
                sphere.position.x = Math.sign(sphere.position.x)*wallX;
                sphere.userData.velocity.x *= -wallFriction;
            }
            if (Math.abs(sphere.position.z) > wallZ) {
                sphere.position.z = Math.sign(sphere.position.z)*wallZ;
                sphere.userData.velocity.z *= -wallFriction;
            }
            for (let j = idx + 1; j < spheres.length; j++) {
                const other = spheres[j];
                const dist = sphere.position.distanceTo(other.position);
                if (dist < 1.4) {
                    const push = new THREE.Vector3().subVectors(sphere.position, other.position).normalize().multiplyScalar(0.01);
                    sphere.userData.velocity.add(push);
                    other.userData.velocity.sub(push);
                }
            }
            sphere.rotation.y += sphere.userData.velocity.length() * 0.1;
        });
        renderer.render(scene, camera);
    }

    // --- AI Face Crop & Recognition Function ---
    async function processFaceImage(imgSource) {
        if (!model) {
            alert("모델이 로드 중입니다. 잠시만 기다려 주세요.");
            return null;
        }

        // Detect Face
        const predictions = await model.estimateFaces(imgSource, false);

        if (predictions.length === 0) {
            alert("얼굴을 찾을 수 없습니다. 정면을 응시해 주세요.");
            return null;
        }

        const face = predictions[0];
        const start = face.topLeft;
        const end = face.bottomRight;
        const size = [end[0] - start[0], end[1] - start[1]];

        // Create Canvas for Processing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 256;
        tempCanvas.height = 256;
        const ctx = tempCanvas.getContext('2d');

        // Draw Circular Mask
        ctx.beginPath();
        ctx.arc(128, 128, 128, 0, Math.PI * 2);
        ctx.clip();

        // Draw the Detected Face
        const margin = 0.2; // Add some space around face
        const sourceX = start[0] - size[0] * margin;
        const sourceY = start[1] - size[1] * margin;
        const sourceWidth = size[0] * (1 + margin * 2);
        const sourceHeight = size[1] * (1 + margin * 2);

        ctx.drawImage(imgSource, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 256, 256);

        return tempCanvas.toDataURL('image/png');
    }

    // --- Face Capture UI Logic ---
    enableCameraBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            videoContainer.style.display = 'block';
            enableCameraBtn.style.display = 'none';
            takePhotoBtn.style.display = 'inline-block';
        } catch (err) {
            alert('카메라 접근 권한이 필요합니다.');
        }
    });

    takePhotoBtn.addEventListener('click', async () => {
        takePhotoBtn.textContent = "WAIT...";
        const result = await processFaceImage(video);
        if (result) {
            capturedFaceDataUrl = result;
            facePreview.style.backgroundImage = `url(${capturedFaceDataUrl})`;
            createSpheres();
            
            // Stop camera
            const tracks = video.srcObject.getTracks();
            tracks.forEach(t => t.stop());
            videoContainer.style.display = 'none';
            takePhotoBtn.style.display = 'none';
            enableCameraBtn.style.display = 'inline-block';
        }
        takePhotoBtn.textContent = "TAKE PHOTO";
    });

    triggerUploadBtn.addEventListener('click', () => uploadPhotoInput.click());
    uploadPhotoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            triggerUploadBtn.textContent = "WAIT...";
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = async () => {
                const result = await processFaceImage(img);
                if (result) {
                    capturedFaceDataUrl = result;
                    facePreview.style.backgroundImage = `url(${capturedFaceDataUrl})`;
                    createSpheres();
                }
                triggerUploadBtn.textContent = "UPLOAD PHOTO";
            };
        }
    });

    // --- Gacha Control Logic ---
    function spinGacha() {
        if (isSpinning) return;
        isSpinning = true;
        handle.classList.add('spin');
        
        spheres.forEach(sphere => {
            sphere.userData.velocity.set((Math.random()-0.5)*0.8, (Math.random()+0.5)*0.5, (Math.random()-0.5)*0.8);
        });

        setTimeout(() => dropCapsule(), 600);
        setTimeout(() => {
            handle.classList.remove('spin');
            isSpinning = false;
        }, 1100);
    }

    function dropCapsule() {
        const fallingCap = document.createElement('div');
        fallingCap.className = 'capsule falling-capsule';
        if (capturedFaceDataUrl) {
            fallingCap.style.backgroundImage = `url(${capturedFaceDataUrl})`;
        } else {
            fallingCap.style.backgroundColor = '#fecb05';
        }
        chute.appendChild(fallingCap);
        setTimeout(() => {
            showResult();
            fallingCap.remove();
        }, 800);
    }

    function showResult() {
        const capsuleTop = document.getElementById('capsule-top');
        const capsuleContainer = document.getElementById('capsule-result-container');
        const itemName = document.getElementById('item-name');

        if (capturedFaceDataUrl) {
            capsuleTop.style.backgroundImage = `url(${capturedFaceDataUrl})`;
            capsuleTop.style.backgroundSize = 'cover';
        } else {
            capsuleTop.style.backgroundColor = '#fff';
        }
        
        const randomMsg = positiveMessages[Math.floor(Math.random() * positiveMessages.length)];
        itemName.textContent = randomMsg;
        modal.style.display = 'flex';
        setTimeout(() => capsuleContainer.classList.add('open'), 500);
    }

    handle.addEventListener('click', spinGacha);
    spinButton.addEventListener('click', spinGacha);
    init3D();
});

function closeModal() {
    const modal = document.getElementById('result-modal');
    const capsuleContainer = document.getElementById('capsule-result-container');
    capsuleContainer.classList.remove('open');
    modal.style.display = 'none';
}
