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

    // --- AI Model Loading (BodyPix) ---
    let net;
    async function loadModel() {
        net = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        console.log("AI Model Loaded");
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
        renderer.setPixelRatio(window.devicePixelRatio / 4); // Pixelated effect
        globeContainer.appendChild(renderer.domElement);

        const light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(5, 5, 5);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0x606060));

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
                    roughness: 0.2,
                    metalness: 0.1
                });
            } else {
                const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
                material = new THREE.MeshStandardMaterial({ color: color });
            }

            const sphere = new THREE.Mesh(geometry, material);
            
            // Random initial pos (stacked at bottom initially)
            sphere.position.set(
                (Math.random() - 0.5) * 3,
                -1.5 + (Math.random() * 0.5), // Start at bottom
                (Math.random() - 0.5) * 1.5
            );
            
            // Initial velocity is zero (static)
            sphere.userData.velocity = new THREE.Vector3(0, 0, 0);

            scene.add(sphere);
            spheres.push(sphere);
        }
    }

    function animate() {
        requestAnimationFrame(animate);

        spheres.forEach((sphere, idx) => {
            // Apply Gravity
            sphere.userData.velocity.y -= gravity;

            // Apply Velocity
            sphere.position.add(sphere.userData.velocity);

            // Floor & Wall Collision (simple logic)
            const floorLevel = -2.2;
            const wallX = 2.4;
            const wallZ = 1.4;

            if (sphere.position.y <= floorLevel) {
                sphere.position.y = floorLevel;
                sphere.userData.velocity.y *= -0.5; // Bounce
                sphere.userData.velocity.multiplyScalar(friction); // Ground friction
            }

            if (Math.abs(sphere.position.x) > wallX) {
                sphere.position.x = Math.sign(sphere.position.x) * wallX;
                sphere.userData.velocity.x *= -wallFriction;
            }

            if (Math.abs(sphere.position.z) > wallZ) {
                sphere.position.z = Math.sign(sphere.position.z) * wallZ;
                sphere.userData.velocity.z *= -wallFriction;
            }

            // Simple Sphere-Sphere collision (pseudo-repulsion)
            for (let j = idx + 1; j < spheres.length; j++) {
                const other = spheres[j];
                const dist = sphere.position.distanceTo(other.position);
                const minBox = 1.4;
                if (dist < minBox) {
                    const push = new THREE.Vector3().subVectors(sphere.position, other.position).normalize().multiplyScalar(0.01);
                    sphere.userData.velocity.add(push);
                    other.userData.velocity.sub(push);
                }
            }

            // Rotation
            sphere.rotation.y += sphere.userData.velocity.length() * 0.2;
        });

        renderer.render(scene, camera);
    }

    // AI Background Removal Function
    async function processFaceImage(imgSource) {
        if (!net) return imgSource.src;

        const segmentation = await net.segmentPerson(imgSource, {
            flipHorizontal: false,
            internalResolution: 'medium',
            segmentationThreshold: 0.7
        });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgSource.width || imgSource.videoWidth;
        tempCanvas.height = imgSource.height || imgSource.videoHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(imgSource, 0, 0);

        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        // Apply Mask (remove background)
        for (let i = 0; i < segmentation.data.length; i++) {
            if (segmentation.data[i] === 0) { // Background
                data[i * 4 + 3] = 0; // Set Alpha to 0
            }
        }

        ctx.putImageData(imageData, 0, 0);
        
        // Final square crop for texture
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 256;
        finalCanvas.height = 256;
        const fctx = finalCanvas.getContext('2d');
        const size = Math.min(tempCanvas.width, tempCanvas.height);
        fctx.drawImage(tempCanvas, (tempCanvas.width-size)/2, (tempCanvas.height-size)/2, size, size, 0, 0, 256, 256);
        
        return finalCanvas.toDataURL('image/png');
    }

    // --- Face Capture Logic ---
    enableCameraBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            videoContainer.style.display = 'block';
            enableCameraBtn.style.display = 'none';
            takePhotoBtn.style.display = 'inline-block';
        } catch (err) {
            alert('카메라 권한을 허용해 주세요.');
        }
    });

    takePhotoBtn.addEventListener('click', async () => {
        takePhotoBtn.textContent = "Processing...";
        capturedFaceDataUrl = await processFaceImage(video);
        facePreview.style.backgroundImage = `url(${capturedFaceDataUrl})`;
        
        // Update 3D scene
        createSpheres();

        // Stop camera
        const tracks = video.srcObject.getTracks();
        tracks.forEach(t => t.stop());
        videoContainer.style.display = 'none';
        takePhotoBtn.style.display = 'none';
        takePhotoBtn.textContent = "TAKE PHOTO";
        enableCameraBtn.style.display = 'inline-block';
    });

    triggerUploadBtn.addEventListener('click', () => uploadPhotoInput.click());
    uploadPhotoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            triggerUploadBtn.textContent = "Processing...";
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = async () => {
                capturedFaceDataUrl = await processFaceImage(img);
                facePreview.style.backgroundImage = `url(${capturedFaceDataUrl})`;
                createSpheres();
                triggerUploadBtn.textContent = "UPLOAD PHOTO";
            };
        }
    });

    // --- Gacha Control ---
    function spinGacha() {
        if (isSpinning) return;
        isSpinning = true;

        handle.classList.add('spin');
        
        // Apply Impulse (Shaking)
        spheres.forEach(sphere => {
            sphere.userData.velocity.set(
                (Math.random() - 0.5) * 0.8,
                (Math.random() + 0.5) * 0.5,
                (Math.random() - 0.5) * 0.8
            );
        });

        setTimeout(() => {
            dropCapsule();
        }, 600);

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
        } else {
            capsuleTop.style.backgroundColor = '#fff';
        }
        
        const randomMsg = positiveMessages[Math.floor(Math.random() * positiveMessages.length)];
        itemName.textContent = randomMsg;

        capsuleContainer.classList.remove('open');
        modal.style.display = 'flex';

        setTimeout(() => {
            capsuleContainer.classList.add('open');
        }, 500);
    }

    handle.addEventListener('click', spinGacha);
    spinButton.addEventListener('click', spinGacha);

    init3D();
});

function closeModal() {
    document.getElementById('result-modal').style.display = 'none';
}
