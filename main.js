document.addEventListener('DOMContentLoaded', () => {
    const innerCapsulesContainer = document.getElementById('inner-capsules');
    const handle = document.getElementById('handle');
    const spinButton = document.getElementById('spin-button');
    const chute = document.getElementById('chute');
    const modal = document.getElementById('result-modal');
    const capsuleResult = document.getElementById('capsule-result');
    
    const colors = ['#ff5f5f', '#5fafff', '#5fff7f', '#ffff5f', '#af5fff', '#ffa500'];
    let isSpinning = false;

    // 1. 초기 캡슐 채우기
    function initCapsules() {
        for (let i = 0; i < 30; i++) {
            const capsule = document.createElement('div');
            capsule.className = 'capsule';
            
            // 랜덤 위치 및 색상
            const left = Math.random() * 200 + 20;
            const top = Math.random() * 180 + 40;
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

        // 레버 애니메이션
        handle.classList.add('spin');
        
        // 내부 캡슐들 흔들기 효과
        const capsules = document.querySelectorAll('.inner-capsules .capsule');
        capsules.forEach(cap => {
            cap.style.transition = 'all 0.5s ease-in-out';
            cap.style.transform = `translate(${Math.random()*10-5}px, ${Math.random()*10-5}px) rotate(${Math.random()*360}deg)`;
        });

        // 0.5초 후 캡슐 나옴
        setTimeout(() => {
            dropCapsule();
        }, 500);

        // 1초 후 레버 상태 초기화
        setTimeout(() => {
            handle.classList.remove('spin');
            isSpinning = false;
        }, 1000);
    }

    // 3. 캡슐 떨어뜨리기
    function dropCapsule() {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const fallingCap = document.createElement('div');
        fallingCap.className = 'capsule falling-capsule';
        fallingCap.style.setProperty('--capsule-color', color);
        
        chute.appendChild(fallingCap);

        // 애니메이션 완료 후 결과 표시
        setTimeout(() => {
            showResult(color);
            fallingCap.remove();
        }, 800);
    }

    // 4. 결과 모달 표시
    function showResult(color) {
        capsuleResult.style.setProperty('--result-color', color);
        modal.style.display = 'flex';
    }

    // 이벤트 리스너
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

// 모달 닫기 (글로벌 함수)
function closeModal() {
    document.getElementById('result-modal').style.display = 'none';
}
