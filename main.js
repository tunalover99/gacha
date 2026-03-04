document.addEventListener('DOMContentLoaded', () => {
    const innerCapsulesContainer = document.getElementById('inner-capsules');
    const handle = document.getElementById('handle');
    const spinButton = document.getElementById('spin-button');
    const chute = document.getElementById('chute');
    const modal = document.getElementById('result-modal');
    
    // Face Capture Elements
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const enableCameraBtn = document.getElementById('enable-camera');
    const takePhotoBtn = document.getElementById('take-photo');
    const uploadPhotoInput = document.getElementById('upload-photo');
    const triggerUploadBtn = document.getElementById('trigger-upload');
    const facePreview = document.getElementById('face-preview');
    const videoContainer = document.querySelector('.video-container');

    let capturedFaceDataUrl = null;
    let isSpinning = false;
    const colors = ['#ff5f5f', '#5fafff', '#5fff7f', '#ffff5f', '#af5fff', '#ffa500'];

    // --- Face Capture Logic ---

    // Enable Camera
    enableCameraBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            videoContainer.style.display = 'block';
            enableCameraBtn.style.display = 'none';
            takePhotoBtn.style.display = 'inline-block';
        } catch (err) {
            alert('카메라를 켤 수 없습니다: ' + err.message);
        }
    });

    // Take Photo
    takePhotoBtn.addEventListener('click', () => {
        const context = canvas.getContext('2d');
        // Square crop for face
        const size = Math.min(video.videoWidth, video.videoHeight);
        const sourceX = (video.videoWidth - size) / 2;
        const sourceY = (video.videoHeight - size) / 2;
        
        canvas.width = 160;
        canvas.height = 160;
        context.drawImage(video, sourceX, sourceY, size, size, 0, 0, 160, 160);
        
        capturedFaceDataUrl = canvas.toDataURL('image/png');
        updateFaceUI();
        
        // Stop camera
        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        videoContainer.style.display = 'none';
        takePhotoBtn.style.display = 'none';
        enableCameraBtn.style.display = 'inline-block';
    });

    // Upload Photo
    triggerUploadBtn.addEventListener('click', () => uploadPhotoInput.click());
    uploadPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                capturedFaceDataUrl = event.target.result;
                updateFaceUI();
            };
            reader.readAsDataURL(file);
        }
    });

    function updateFaceUI() {
        if (capturedFaceDataUrl) {
            facePreview.style.backgroundImage = `url(${capturedFaceDataUrl})`;
            // Re-init capsules to show new face
            initCapsules();
        }
    }

    // --- Gacha Logic ---

    function initCapsules() {
        innerCapsulesContainer.innerHTML = '';
        for (let i = 0; i < 25; i++) {
            const capsule = document.createElement('div');
            capsule.className = 'capsule';
            
            const left = Math.random() * 220 + 20;
            const top = Math.random() * 180 + 30;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const rotation = Math.random() * 360;
            
            capsule.style.left = `${left}px`;
            capsule.style.top = `${top}px`;
            capsule.style.transform = `rotate(${rotation}deg)`;
            
            if (capturedFaceDataUrl) {
                capsule.style.backgroundImage = `url(${capturedFaceDataUrl})`;
            } else {
                capsule.style.backgroundColor = color;
            }
            
            innerCapsulesContainer.appendChild(capsule);
        }
    }

    function spinGacha() {
        if (isSpinning) return;
        isSpinning = true;

        handle.classList.add('spin');
        
        const capsules = document.querySelectorAll('.inner-capsules .capsule');
        capsules.forEach(cap => {
            cap.style.transition = 'all 0.3s steps(5)';
            cap.style.transform = `translate(${Math.random()*20-10}px, ${Math.random()*20-10}px) rotate(${Math.random()*360}deg)`;
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
            const color = colors[Math.floor(Math.random() * colors.length)];
            fallingCap.style.backgroundColor = color;
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

        if (capturedFaceDataUrl) {
            capsuleTop.style.backgroundImage = `url(${capturedFaceDataUrl})`;
            capsuleTop.style.backgroundSize = 'cover';
            capsuleTop.style.backgroundPosition = 'center';
        } else {
            capsuleTop.style.backgroundImage = 'none';
            capsuleTop.style.backgroundColor = '#fff';
        }
        
        capsuleContainer.classList.remove('open');
        modal.style.display = 'flex';

        setTimeout(() => {
            capsuleContainer.classList.add('open');
        }, 500);
    }

    handle.addEventListener('click', spinGacha);
    spinButton.addEventListener('click', spinGacha);

    initCapsules();

    // Contact form (simplified)
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('THANK YOU FOR MESSAGE!');
            contactForm.reset();
        });
    }
});

function closeModal() {
    const modal = document.getElementById('result-modal');
    modal.style.display = 'none';
}
