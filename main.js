document.addEventListener('DOMContentLoaded', () => {
    const innerCapsulesContainer = document.getElementById('inner-capsules');
    const handle = document.getElementById('handle');
    const spinButton = document.getElementById('spin-button');
    const chute = document.getElementById('chute');
    const modal = document.getElementById('result-modal');
    
    const colors = ['#ff5f5f', '#5fafff', '#5fff7f', '#ffff5f', '#af5fff', '#ffa500'];
    let isSpinning = false;

    // 1. 초기 캡슐 채우기
    function initCapsules() {
        for (let i = 0; i < 30; i++) {
            const capsule = document.createElement('div');
            capsule.className = 'capsule';
            
            // 내부에 접힌 종이 추가
            const tinyPaper = document.createElement('div');
            tinyPaper.style.cssText = `
                width: 20px;
                height: 12px;
                background: white;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                border-radius: 1px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            `;
            capsule.appendChild(tinyPaper);
            
            // 랜덤 위치 및 색상
            const left = Math.random() * 220 + 20;
            const top = Math.random() * 200 + 40;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const rotation = Math.random() * 360;
            
            capsule.style.left = `${left}px`;
            capsule.style.top = `${top}px`;
            capsule.style.setProperty('--capsule-color', color);
            capsule.style.transform = `rotate(${rotation}deg)`;
            
            innerCapsulesContainer.appendChild(capsule);
        }
    }

    // 2. 가챠 돌리기 로직
    function spinGacha() {
        if (isSpinning) return;
        isSpinning = true;

        handle.classList.add('spin');
        
        const capsules = document.querySelectorAll('.inner-capsules .capsule');
        capsules.forEach(cap => {
            cap.style.transition = 'all 0.5s ease-in-out';
            cap.style.transform = `translate(${Math.random()*10-5}px, ${Math.random()*10-5}px) rotate(${Math.random()*360}deg)`;
        });

        setTimeout(() => {
            dropCapsule();
        }, 500);

        setTimeout(() => {
            handle.classList.remove('spin');
            isSpinning = false;
        }, 1200);
    }

    // 3. 캡슐 떨어뜨리기
    function dropCapsule() {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const fallingCap = document.createElement('div');
        fallingCap.className = 'capsule falling-capsule';
        fallingCap.style.setProperty('--capsule-color', color);
        
        // 내부에 접힌 종이 추가
        const tinyPaper = document.createElement('div');
        tinyPaper.style.cssText = `
            width: 20px;
            height: 12px;
            background: white;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border-radius: 1px;
        `;
        fallingCap.appendChild(tinyPaper);
        
        chute.appendChild(fallingCap);

        setTimeout(() => {
            showResult(color);
            fallingCap.remove();
        }, 800);
    }

    // 4. 결과 모달 표시 및 애니메이션
    function showResult(color) {
        const capsuleBottom = document.getElementById('capsule-bottom');
        const capsuleContainer = document.getElementById('capsule-result-container');
        const resultPaper = document.getElementById('result-paper');

        // 상태 초기화
        capsuleBottom.style.setProperty('--result-color', color);
        capsuleContainer.classList.remove('open');
        
        modal.style.display = 'flex';

        // 0.5초 후 캡슐 열기 및 종이 펼치기
        setTimeout(() => {
            capsuleContainer.classList.add('open');
        }, 500);
    }

    handle.addEventListener('click', spinGacha);
    spinButton.addEventListener('click', spinGacha);

    initCapsules();

    // 5. 제휴 문의 폼 처리
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = new FormData(e.target);
            
            formStatus.textContent = '보내는 중...';
            formStatus.style.color = '#666';

            try {
                const response = await fetch(e.target.action, {
                    method: contactForm.method,
                    body: data,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    formStatus.textContent = '성공적으로 전송되었습니다! 곧 연락드리겠습니다.';
                    formStatus.style.color = 'green';
                    contactForm.reset();
                } else {
                    const result = await response.json();
                    if (Object.hasOwn(result, 'errors')) {
                        formStatus.textContent = result.errors.map(error => error.message).join(", ");
                    } else {
                        formStatus.textContent = '오류가 발생했습니다. 나중에 다시 시도해주세요.';
                    }
                    formStatus.style.color = 'red';
                }
            } catch (error) {
                formStatus.textContent = '네트워크 오류가 발생했습니다.';
                formStatus.style.color = 'red';
            }
        });
    }
});

function closeModal() {
    const modal = document.getElementById('result-modal');
    const capsuleContainer = document.getElementById('capsule-result-container');
    capsuleContainer.classList.remove('open');
    modal.style.display = 'none';
}
