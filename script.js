// ============================================
// CẤU HÌNH VÀ BIẾN TOÀN CỤC
// ============================================
const CONFIG = {
    // Endpoint chính xác cho Gemini 1.5 Pro
    GEMINI_ENDPOINT: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent'
};

// Module quản lý lưu trữ
const Storage = {
    save: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('Lưu thất bại', e);
        }
    },
    load: (key, defaultValue) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }
};

// Lấy API key từ localStorage
function getApiKey() {
    return localStorage.getItem('gemini_api_key');
}

// ============================================
// MODULE CHÍNH
// ============================================
const App = (function() {
    // Private variables
    let chart = null;
    let currentSubject = 'english';
    let xp = 0;
    let level = 1;
    let energy = 100;
    let streak = 0;
    let lastStudyDate = null;
    let scheduleItems = [];
    let countdownInterval = null;
    let biometricsInterval = null;
    let activeSessionIndex = -1;
    
    // Dữ liệu môn học
    const subjectData = {
        math: {
            name: 'Toán',
            icon: '📐',
            real: [6.5, 7.0, 7.2, 7.8],
            weaknesses: ['Hình học không gian', 'Tích phân', 'Số phức'],
            tip: '🔢 Ôn lại chuyên đề Vector.'
        },
        english: {
            name: 'Tiếng Anh',
            icon: '📘',
            real: [7.0, 7.3, 7.8, 8.1],
            weaknesses: ['Từ vựng', 'Phrasal verbs', 'IELTS Writing'],
            tip: '📘 Bạn hay quên từ vựng sau 3 ngày.'
        },
        physics: {
            name: 'Vật Lý',
            icon: '⚡',
            real: [6.0, 6.8, 7.5, 7.9],
            weaknesses: ['Điện từ', 'Lượng tử ánh sáng', 'Dao động'],
            tip: '⚡ Sai số trong bài động lượng đang tăng.'
        },
        chemistry: {
            name: 'Hóa Học',
            icon: '🧪',
            real: [7.2, 7.5, 7.9, 8.3],
            weaknesses: ['Hóa hữu cơ', 'Phản ứng oxi hóa khử'],
            tip: '🧪 Phản ứng oxi hóa khử còn yếu.'
        },
        biology: {
            name: 'Sinh Học',
            icon: '🧬',
            real: [7.5, 7.8, 8.0, 8.2],
            weaknesses: ['Cấu trúc tế bào', 'Di truyền học'],
            tip: '🧬 Cần ôn lại cấu trúc tế bào.'
        },
        literature: {
            name: 'Ngữ Văn',
            icon: '📖',
            real: [7.0, 7.3, 7.6, 7.8],
            weaknesses: ['Nghị luận xã hội', 'Phân tích thơ'],
            tip: '📖 Phân tích tác phẩm còn sơ sài.'
        },
        history: {
            name: 'Lịch Sử',
            icon: '🏛️',
            real: [7.8, 8.0, 8.2, 8.5],
            weaknesses: ['Mốc thời gian', 'Sự kiện thế giới'],
            tip: '🏛️ Hay nhầm mốc thời gian.'
        },
        geography: {
            name: 'Địa Lý',
            icon: '🌍',
            real: [7.4, 7.7, 8.0, 8.3],
            weaknesses: ['Bản đồ', 'Kinh tế vùng'],
            tip: '🌍 Bản đồ các vùng kinh tế còn lúng túng.'
        },
        civics: {
            name: 'GDCD',
            icon: '🤝',
            real: [8.0, 8.2, 8.4, 8.6],
            weaknesses: ['Pháp luật', 'Đạo đức kinh doanh'],
            tip: '🤝 Cần liên hệ thực tế nhiều hơn.'
        },
        informatics: {
            name: 'Tin Học',
            icon: '💻',
            real: [7.9, 8.1, 8.3, 8.5],
            weaknesses: ['Thuật toán', 'Cấu trúc dữ liệu'],
            tip: '💻 Thuật toán sắp xếp còn sai.'
        },
        technology: {
            name: 'Công Nghệ',
            icon: '🔧',
            real: [7.3, 7.6, 7.9, 8.2],
            weaknesses: ['Bản vẽ kỹ thuật', 'Vật liệu cơ khí'],
            tip: '🔧 Bản vẽ kỹ thuật chưa chính xác.'
        }
    };

    // Lưu subjectData vào storage
    function saveSubjectData() {
        Storage.save('subjectData', subjectData);
    }

    // Gọi Gemini API với xử lý lỗi tốt hơn
    async function callGemini(prompt) {
        const apiKey = getApiKey();
        
        if (!apiKey) {
            console.log('Không có API key, dùng mock response');
            return mockAIResponse(prompt);
        }

        try {
            console.log('Đang gọi Gemini API với key:', apiKey.substring(0, 10) + '...');
            
            const response = await fetch(`${CONFIG.GEMINI_ENDPOINT}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 200,
                    }
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error('Lỗi HTTP:', response.status, data);
                throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
            }

            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else {
                console.error('Response không hợp lệ:', data);
                return mockAIResponse(prompt);
            }
        } catch (error) {
            console.error('Lỗi gọi Gemini chi tiết:', error);
            return mockAIResponse(prompt);
        }
    }

    // Mock response khi không có API hoặc lỗi
    function mockAIResponse(prompt) {
        if (prompt.includes('insight')) {
            const insights = [
                'Hôm nay bạn nên tập trung vào môn bạn yếu nhất.',
                'Đừng quên ôn lại bài cũ trước khi học mới.',
                'Học 25 phút, nghỉ 5 phút để đạt hiệu quả cao nhất.',
                'Bạn đang tiến bộ, hãy duy trì nhịp độ này!'
            ];
            return insights[Math.floor(Math.random() * insights.length)];
        }
        if (prompt.includes('dự báo')) {
            return '8.2, 8.5';
        }
        if (prompt.includes('lộ trình')) {
            return 'Bước 1: Ôn lý thuyết (15p)\nBước 2: Làm bài tập cơ bản (20p)\nBước 3: Làm bài tập nâng cao (20p)\nBước 4: Tổng kết (5p)';
        }
        return 'Tôi là AI trợ lý học tập, sẵn sàng hỗ trợ bạn!';
    }

    // Cập nhật Daily Insight
    async function updateDailyInsight() {
        const data = subjectData[currentSubject];
        const lastScore = data.real[data.real.length - 1];
        const focus = document.getElementById('focusLevel').textContent;
        
        const prompt = `Học sinh môn ${data.name} có điểm hiện tại ${lastScore}, mức tập trung ${focus}. Hãy đưa ra một lời khuyên học tập ngắn gọn (dưới 100 ký tự), tập trung vào điểm yếu: ${data.weaknesses.join(', ')}.`;
        
        const advice = await callGemini(prompt);
        document.getElementById('dailyTip').textContent = advice;
    }

    // Dự báo điểm
    function predictScores(scores) {
        if (scores.length < 2) return [scores[0] + 0.3, scores[0] + 0.6];
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const trend = (scores[scores.length - 1] - scores[0]) / scores.length;
        return [
            Number((avg + trend + 0.2).toFixed(1)),
            Number((avg + trend * 2 + 0.4).toFixed(1))
        ].map(v => Math.min(10, Math.max(0, v)));
    }

    // Khởi tạo biểu đồ
    function initChart(subject) {
        const ctx = document.getElementById('roadmapChart');
        if (!ctx) return;
        if (chart) chart.destroy();

        const data = subjectData[subject];
        const predicted = predictScores(data.real);

        const labels = [...data.real.map((_, i) => `Tuần ${i+1}`), 'Dự báo 1', 'Dự báo 2'];
        const realData = [...data.real, null, null];
        const predData = [null, null, null, null, predicted[0], predicted[1]];

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Điểm thực tế',
                        data: realData,
                        borderColor: '#2a9dff',
                        backgroundColor: 'rgba(42, 157, 255, 0.1)',
                        tension: 0.4,
                        pointBackgroundColor: '#2a9dff',
                        pointBorderColor: '#fff',
                        pointRadius: 6
                    },
                    {
                        label: 'Dự báo',
                        data: predData,
                        borderColor: '#9d4edd',
                        borderDash: [5, 5],
                        tension: 0.4,
                        pointBackgroundColor: '#9d4edd',
                        pointBorderColor: '#fff',
                        pointRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 0,
                        max: 10,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#8f9bb3' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8f9bb3' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                }
            }
        });

        document.getElementById('statReal').textContent = data.real[data.real.length-1].toFixed(1);
        document.getElementById('statPred1').textContent = predicted[0].toFixed(1);
        document.getElementById('statPred2').textContent = predicted[1].toFixed(1);
        document.getElementById('currentGPA').textContent = data.real[data.real.length-1].toFixed(1);
        document.getElementById('confidenceValue').textContent = Math.floor(70 + Math.random() * 20) + '%';
    }

    // Thêm điểm mới
    async function addNewScore(score) {
        const data = subjectData[currentSubject];
        data.real.push(score);
        if (data.real.length > 6) data.real.shift();
        
        saveSubjectData();
        initChart(currentSubject);
        await updateDailyInsight();
        updateStreak();
    }

    // Cập nhật streak
    function updateStreak() {
        const today = new Date().toDateString();
        if (!lastStudyDate) {
            streak = 1;
        } else if (lastStudyDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastStudyDate === yesterday.toDateString()) {
                streak++;
            } else {
                streak = 1;
            }
        }
        lastStudyDate = today;
        Storage.save('streak', { streak, lastStudyDate });
        document.getElementById('streakBadge').textContent = `🔥 ${streak} ngày`;
    }

    // Render lịch học
    function renderSchedule() {
        const list = document.getElementById('scheduleList');
        list.innerHTML = '';
        scheduleItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'schedule-item';
            if (index === activeSessionIndex) {
                div.classList.add('active-session');
            }
            div.draggable = true;
            div.dataset.index = index;
            div.innerHTML = `
                <span class="subject">${item.subject}</span>
                <span class="time">${item.time}</span>
                <span class="countdown-timer" id="countdown-${index}"></span>
                <span class="delete-schedule" onclick="App.deleteScheduleItem(${index})">✖</span>
            `;
            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', index);
                div.classList.add('dragging');
            });
            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
            });
            list.appendChild(div);
        });
        Storage.save('schedule', scheduleItems);
        checkActiveSession();
    }

    // Xử lý drop
    function handleDrop(e) {
        e.preventDefault();
        const fromIndex = e.dataTransfer.getData('text/plain');
        const toElement = e.target.closest('.schedule-item');
        if (!toElement) return;
        const toIndex = toElement.dataset.index;
        if (fromIndex === toIndex) return;
        
        [scheduleItems[fromIndex], scheduleItems[toIndex]] = [scheduleItems[toIndex], scheduleItems[fromIndex]];
        renderSchedule();
    }

    // Thêm lịch học
    function addScheduleItem(subject, time) {
        scheduleItems.push({ subject, time, completed: false });
        renderSchedule();
        updateStreak();
    }

    // Xóa lịch học
    function deleteScheduleItem(index) {
        scheduleItems.splice(index, 1);
        renderSchedule();
    }

    // Kiểm tra ca học hiện tại
    function checkActiveSession() {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        let newActiveIndex = -1;
        
        scheduleItems.forEach((item, index) => {
            const [start, end] = item.time.split(' - ').map(t => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            });
            if (currentTime >= start && currentTime < end) {
                newActiveIndex = index;
            }
        });

        if (newActiveIndex !== activeSessionIndex) {
            activeSessionIndex = newActiveIndex;
            renderSchedule();
            if (activeSessionIndex !== -1) {
                startCountdownForSession(activeSessionIndex);
            } else {
                if (countdownInterval) clearInterval(countdownInterval);
            }
        }
    }

    // Bắt đầu đếm ngược
    function startCountdownForSession(index) {
        if (countdownInterval) clearInterval(countdownInterval);
        const item = scheduleItems[index];
        const endTimeStr = item.time.split(' - ')[1];
        
        countdownInterval = setInterval(() => {
            const now = new Date();
            const [h, m] = endTimeStr.split(':').map(Number);
            const end = new Date(now);
            end.setHours(h, m, 0);
            const diff = end - now;
            
            const timerSpan = document.getElementById(`countdown-${index}`);
            if (!timerSpan) return;
            
            if (diff <= 0) {
                timerSpan.textContent = '✅ Hoàn thành';
                clearInterval(countdownInterval);
                item.completed = true;
                document.getElementById('notificationSound').play().catch(() => {});
                updateDailyInsight();
                activeSessionIndex = -1;
                renderSchedule();
                return;
            }
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            timerSpan.textContent = `⏳ ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    // AI tạo lịch
    function generateAISchedule() {
        const subjects = Object.values(subjectData).map(s => s.icon + ' ' + s.name);
        const times = ['07:30 - 09:00', '09:15 - 10:45', '13:30 - 15:00', '15:15 - 16:45', '19:00 - 20:30'];
        scheduleItems = [];
        for (let i = 0; i < 4; i++) {
            const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
            const randomTime = times[Math.floor(Math.random() * times.length)];
            scheduleItems.push({ subject: randomSubject, time: randomTime, completed: false });
        }
        renderSchedule();
    }

    // Click vào Digital Twin
    function handleTwinClick() {
        const avatar = document.getElementById('twinAvatar');
        const status = document.getElementById('twinStatus');
        
        avatar.className = 'twin-avatar stressed';
        status.textContent = '⚠️ Phát hiện stress - Đề xuất nghỉ 2 phút';
        energy = Math.max(0, energy - 5);
        document.getElementById('twinEnergy').textContent = energy + '%';
        
        setTimeout(() => {
            avatar.className = 'twin-avatar idle';
            status.textContent = 'Hệ thống đồng bộ ổn định';
        }, 2000);
        
        addXP(5);
    }

    // Thêm XP
    function addXP(amount) {
        xp += amount;
        const xpNeeded = level * 100;
        if (xp >= xpNeeded) {
            level++;
            xp = xp - xpNeeded;
            document.getElementById('twinLevel').textContent = `Lv.${level}`;
        }
        document.getElementById('twinXP').textContent = `${xp}/${level * 100}`;
    }

    // Animation sinh trắc học
    function startBiometricsAnimation() {
        if (biometricsInterval) clearInterval(biometricsInterval);
        biometricsInterval = setInterval(() => {
            const heartElem = document.getElementById('heartRate');
            const focusElem = document.getElementById('focusLevel');
            const burnoutElem = document.getElementById('burnoutRisk');
            
            let heart = parseInt(heartElem.textContent) || 72;
            let focus = parseInt(focusElem.textContent) || 85;
            
            heart += Math.floor(Math.random() * 3) - 1;
            focus += Math.floor(Math.random() * 3) - 1;
            
            heart = Math.max(60, Math.min(100, heart));
            focus = Math.max(60, Math.min(100, focus));
            
            heartElem.textContent = heart + ' bpm';
            focusElem.textContent = focus + '%';
            
            const burnout = Math.min(100, Math.floor(streak * 5 + (100 - energy) * 0.5 + (heart - 70) * 0.5));
            burnoutElem.textContent = burnout + '%';
            
            if (burnout > 50) {
                document.getElementById('twinStatus').textContent = '⚠️ Bạn cần nghỉ ngơi!';
                document.getElementById('twinAvatar').className = 'twin-avatar stressed';
            }
        }, 3000);
    }

    // Cập nhật Knowledge Graph
    function updateKnowledgeGraph(subject) {
        const container = document.getElementById('graphContainer');
        if (!container) return;
        
        const data = subjectData[subject];
        container.innerHTML = '';
        
        const mastered = ['Kiến thức cơ bản', 'Lý thuyết nền'];
        mastered.forEach(skill => {
            const node = document.createElement('span');
            node.className = 'skill-node mastered';
            node.textContent = `✅ ${skill}`;
            container.appendChild(node);
        });
        
        const improving = ['Bài tập vận dụng'];
        improving.forEach(skill => {
            const node = document.createElement('span');
            node.className = 'skill-node improving';
            node.textContent = `📈 ${skill}`;
            container.appendChild(node);
        });
        
        data.weaknesses.forEach(skill => {
            const node = document.createElement('span');
            node.className = 'skill-node weak';
            node.textContent = `⚠️ ${skill}`;
            node.onclick = () => showRoadmapPopup(skill);
            container.appendChild(node);
        });
    }

    // Hiển thị popup lộ trình
    async function showRoadmapPopup(skill) {
        const modal = document.getElementById('roadmapPopup');
        const content = document.getElementById('popupContent');
        content.textContent = 'Đang tải lộ trình...';
        modal.classList.add('show');
        
        const data = subjectData[currentSubject];
        const prompt = `Tạo lộ trình học cấp tốc cho kỹ năng "${skill}" môn ${data.name}. Gồm 3-4 bước ngắn gọn.`;
        const roadmap = await callGemini(prompt);
        content.innerHTML = roadmap.replace(/\n/g, '<br>');
    }

    // Xử lý chat
    async function handleChat() {
        const input = document.getElementById('searchInput');
        const question = input.value.trim();
        if (!question) return;

        const chatBox = document.getElementById('chatBox');
        chatBox.innerHTML += `<div class="chat-message"><b>🧑 Bạn:</b> ${question}</div>`;
        input.value = '';

        const data = subjectData[currentSubject];
        const prompt = `Học sinh hỏi: "${question}" trong môn ${data.name}. Trả lời ngắn gọn, hữu ích.`;
        const answer = await callGemini(prompt);
        chatBox.innerHTML += `<div class="chat-message ai-message"><b>AI:</b> ${answer}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
        addXP(2);
    }

    // Cài đặt modal API
    function setupApiModal() {
        const modal = document.getElementById('apiModal');
        const settingsBtn = document.getElementById('settingsBtn');
        const closeBtn = document.getElementById('closeModalBtn');
        const saveBtn = document.getElementById('saveApiBtn');
        const apiInput = document.getElementById('apiKeyInput');

        settingsBtn.addEventListener('click', () => {
            apiInput.value = getApiKey() || '';
            modal.classList.add('show');
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });

        saveBtn.addEventListener('click', () => {
            const key = apiInput.value.trim();
            if (key) {
                localStorage.setItem('gemini_api_key', key);
                alert('Đã lưu API key!');
                modal.classList.remove('show');
                location.reload();
            } else {
                alert('Vui lòng nhập key');
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }

    // Khởi tạo
    function init() {
        console.log('Khởi động AI Study Twin...');
        
        // Load dữ liệu
        const savedStreak = Storage.load('streak', { streak: 0, lastStudyDate: null });
        streak = savedStreak.streak;
        lastStudyDate = savedStreak.lastStudyDate;
        document.getElementById('streakBadge').textContent = `🔥 ${streak} ngày`;

        scheduleItems = Storage.load('schedule', [
            { subject: '📘 Tiếng Anh', time: '08:00 - 09:30', completed: false },
            { subject: '📐 Toán', time: '09:45 - 11:15', completed: false }
        ]);
        renderSchedule();

        // Khởi tạo
        initChart(currentSubject);
        updateDailyInsight();
        updateKnowledgeGraph(currentSubject);
        startBiometricsAnimation();

        // Sự kiện
        document.getElementById('subjectSelector').addEventListener('change', (e) => {
            currentSubject = e.target.value;
            initChart(currentSubject);
            updateDailyInsight();
            updateKnowledgeGraph(currentSubject);
        });

        document.getElementById('searchBtn').addEventListener('click', handleChat);
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleChat();
        });

        document.getElementById('addScheduleBtn').addEventListener('click', () => {
            const subject = document.getElementById('subjectInput').value.trim();
            const time = document.getElementById('timeSelect').value;
            if (subject) addScheduleItem(subject, time);
        });

        document.getElementById('generateScheduleBtn').addEventListener('click', generateAISchedule);
        document.getElementById('twinAvatar').addEventListener('click', handleTwinClick);

        document.getElementById('updateScoreBtn').addEventListener('click', async () => {
            const input = document.getElementById('newScoreInput');
            const score = parseFloat(input.value);
            if (isNaN(score) || score < 0 || score > 10) {
                alert('Nhập điểm từ 0 đến 10');
                return;
            }
            await addNewScore(score);
            input.value = '';
        });

        document.getElementById('closePopupBtn').addEventListener('click', () => {
            document.getElementById('roadmapPopup').classList.remove('show');
        });

        setupApiModal();

        setInterval(checkActiveSession, 60000);
        checkActiveSession();
    }

    // Public API
    return {
        init,
        handleDrop,
        deleteScheduleItem: (index) => deleteScheduleItem(index),
    };
})();

// Khởi động
window.addEventListener('load', () => App.init());
