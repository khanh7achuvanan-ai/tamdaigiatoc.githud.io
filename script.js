// ============================================
// CẤU HÌNH VÀ BỘ NHỚ
// ============================================
const CONFIG = {
    GEMINI_ENDPOINT: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent'
};

const Storage = {
    save: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    load: (key, defaultValue) => {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    }
};

function getApiKey() { return localStorage.getItem('gemini_api_key'); }

// ============================================
// DỮ LIỆU MẶC ĐỊNH
// ============================================
const DEFAULT_SUBJECTS = {
    math: { name: 'Toán', icon: '📐', real: [6.5, 7.0, 7.2, 7.8], weaknesses: ['Hình học không gian', 'Tích phân'], tip: '🔢 Ôn lại chuyên đề Vector.' },
    english: { name: 'Tiếng Anh', icon: '📘', real: [7.0, 7.3, 7.8, 8.1], weaknesses: ['Từ vựng', 'IELTS Writing'], tip: '📘 Bạn hay quên từ vựng sau 3 ngày.' },
    physics: { name: 'Vật Lý', icon: '⚡', real: [6.0, 6.8, 7.5, 7.9], weaknesses: ['Điện từ', 'Lượng tử'], tip: '⚡ Sai số trong bài động lượng đang tăng.' },
    chemistry: { name: 'Hóa Học', icon: '🧪', real: [7.2, 7.5, 7.9, 8.3], weaknesses: ['Hóa hữu cơ'], tip: '🧪 Phản ứng oxi hóa khử còn yếu.' }
};

// ============================================
// MODULE CHÍNH
// ============================================
const App = (function() {
    let chart = null;
    let currentSubject = 'english';
    
    // TRÍ NHỚ TRẠNG THÁI
    let subjectData = Storage.load('ai_twin_subjects', DEFAULT_SUBJECTS);
    let twinState = Storage.load('ai_twin_state', { xp: 0, level: 1, energy: 100 });
    let biometrics = Storage.load('ai_twin_biometrics', { heart: 72, focus: 85 });
    
    // LỊCH SỬ CHAT (Bộ nhớ ngữ cảnh của AI trong phiên)
    let chatHistory = []; 

    let streak = 0;
    let lastStudyDate = null;
    let scheduleItems = [];
    let activeSessionIndex = -1;
    let continuousStudySeconds = 0; 

    function saveState() {
        Storage.save('ai_twin_subjects', subjectData);
        Storage.save('ai_twin_state', twinState);
        Storage.save('ai_twin_biometrics', biometrics);
    }

    // GỌI GEMINI API CÓ NGỮ CẢNH
    async function callGemini(prompt, useHistory = false) {
        const apiKey = getApiKey();
        if (!apiKey) return "Vui lòng cài đặt API Key ở góc trên để sử dụng AI nhé!";
        
        let contents = [];
        
        // Nếu dùng cho Chatbox, nhét lịch sử vào để AI "nhớ"
        if (useHistory) {
            chatHistory.forEach(msg => {
                contents.push({ role: msg.role, parts: [{ text: msg.text }] });
            });
            contents.push({ role: "user", parts: [{ text: prompt }] });
        } else {
            contents = [{ parts: [{ text: prompt }] }];
        }

        try {
            const response = await fetch(`${CONFIG.GEMINI_ENDPOINT}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
                })
            });
            const data = await response.json();
            if (data.candidates) return data.candidates[0].content.parts[0].text;
            return "AI đang bận, bạn thử lại sau nhé.";
        } catch (e) {
            console.error(e); return "Lỗi kết nối AI.";
        }
    }

    async function updateDailyInsight() {
        const data = subjectData[currentSubject];
        const lastScore = data.real[data.real.length - 1] || 0;
        const prompt = `Tôi học ${data.name}, điểm: ${lastScore}. Hãy đưa ra 1 lời khuyên 1 câu khắc phục lỗi: ${data.weaknesses.join(', ')}.`;
        const advice = await callGemini(prompt, false);
        document.getElementById('dailyTip').textContent = advice;
    }

    // ... (Giữ nguyên các hàm dự báo điểm, Chart, UpdateStreak, Lịch học, Biometrics của đoạn JS trước đó) ...
    // --- BẮT ĐẦU PHẦN CODE GIỮ NGUYÊN (Để rút gọn hiển thị) ---
    function predictScores(scores) {
        if (scores.length < 2) return [scores[0] + 0.3, scores[0] + 0.6];
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const trend = (scores[scores.length - 1] - scores[0]) / scores.length;
        return [Number((avg + trend + 0.2).toFixed(1)), Number((avg + trend * 2 + 0.4).toFixed(1))].map(v => Math.min(10, Math.max(0, v)));
    }

    function initChart(subject) {
        const ctx = document.getElementById('roadmapChart');
        if (!ctx) return;
        if (chart) chart.destroy();
        if (!subjectData[subject]) subject = Object.keys(subjectData)[0];
        const data = subjectData[subject];
        const predicted = predictScores(data.real);
        const labels = [...data.real.map((_, i) => `Lần ${i+1}`), 'Dự báo 1', 'Dự báo 2'];

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Thực tế', data: [...data.real, null, null], borderColor: '#2a9dff', backgroundColor: 'rgba(42,157,255,0.1)', tension: 0.4 },
                    { label: 'Dự báo', data: [...data.real.map(()=>null).slice(0,-1), data.real[data.real.length-1], predicted[0], predicted[1]], borderColor: '#9d4edd', borderDash: [5,5], tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 10 } }, plugins: { legend: { labels: { color: '#ffffff' } } } }
        });

        const latestScore = data.real[data.real.length-1];
        document.getElementById('statReal').textContent = latestScore ? latestScore.toFixed(1) : '0';
        document.getElementById('statPred1').textContent = predicted[0].toFixed(1);
        document.getElementById('statPred2').textContent = predicted[1].toFixed(1);
    }

    async function addNewScore(score) {
        if (!subjectData[currentSubject]) return;
        subjectData[currentSubject].real.push(score);
        if (subjectData[currentSubject].real.length > 6) subjectData[currentSubject].real.shift();
        saveState(); initChart(currentSubject); updateDailyInsight(); updateKnowledgeGraph(currentSubject);
    }
    // --- KẾT THÚC PHẦN CODE GIỮ NGUYÊN ---

    // KNOWLEDGE GRAPH & TẠO LỘ TRÌNH ACTIONABLE
    function updateKnowledgeGraph(subject) {
        const container = document.getElementById('graphContainer');
        if (!container) return;
        
        const data = subjectData[subject];
        container.innerHTML = '';
        
        ['Kiến thức cơ bản', 'Lý thuyết nền'].forEach(skill => {
            container.innerHTML += `<span class="skill-node mastered">✅ ${skill}</span>`;
        });
        
        ['Bài tập vận dụng'].forEach(skill => {
            container.innerHTML += `<span class="skill-node improving">📈 ${skill}</span>`;
        });
        
        // Tạo node điểm yếu, có thể click để lấy lộ trình
        data.weaknesses.forEach(skill => {
            const node = document.createElement('span');
            node.className = 'skill-node weak';
            node.textContent = `⚠️ ${skill}`;
            node.onclick = () => showActionableRoadmap(skill, data.name);
            container.appendChild(node);
        });
    }

    // Hiển thị Lộ trình dạng Checklist
    async function showActionableRoadmap(skill, subjectName) {
        const modal = document.getElementById('roadmapPopup');
        const content = document.getElementById('popupContent');
        const title = document.getElementById('weaknessTitle');
        
        title.textContent = skill;
        content.innerHTML = '<div class="typing-indicator">🤖 AI đang phân tích và lập lộ trình bài bản cho bạn...</div>';
        modal.classList.add('show');
        
        // Yêu cầu AI trả về format đặc biệt phân cách bằng dấu |
        const prompt = `Bạn là gia sư. Lập lộ trình 3 bước thực hành để khắc phục điểm yếu "${skill}" môn ${subjectName}. 
        Yêu cầu trả về đúng định dạng text sau (không dùng markdown khác):
        Tên bước 1 - Mô tả cách học bước 1|Tên bước 2 - Mô tả cách học bước 2|Tên bước 3 - Mô tả cách học bước 3`;
        
        const aiResponse = await callGemini(prompt, false);
        
        // Parse phản hồi thành Checklist
        const steps = aiResponse.split('|');
        content.innerHTML = ''; // Xóa loading
        
        if (steps.length < 2) {
            // Fallback nếu AI không trả đúng format
            content.innerHTML = `<p>${aiResponse}</p>`;
            return;
        }

        steps.forEach((step, index) => {
            const parts = step.split('-');
            const stepTitle = parts[0] ? parts[0].trim() : `Bước ${index + 1}`;
            const stepDesc = parts[1] ? parts[1].trim() : '';
            
            const stepHtml = `
                <div class="roadmap-step" id="step-${index}">
                    <input type="checkbox" onchange="this.parentElement.classList.toggle('completed'); App.addXP(10);">
                    <div class="roadmap-step-content">
                        <div class="roadmap-step-title">${stepTitle}</div>
                        <div class="roadmap-step-desc">${stepDesc}</div>
                    </div>
                </div>
            `;
            content.innerHTML += stepHtml;
        });
    }

    // CHAT VỚI AI CÓ BỘ NHỚ
    async function handleChat() {
        const input = document.getElementById('searchInput');
        const question = input.value.trim();
        if (!question) return;

        const chatBox = document.getElementById('chatBox');
        chatBox.innerHTML += `<div class="chat-message"><b>🧑 Bạn:</b> ${question}</div>`;
        input.value = '';
        
        // Lưu vào lịch sử (vai trò: user)
        chatHistory.push({ role: "user", text: question });

        // Hiển thị typing indicator
        const typingId = 'typing-' + Date.now();
        chatBox.innerHTML += `<div class="chat-message typing-indicator" id="${typingId}">AI đang suy nghĩ...</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;

        const data = subjectData[currentSubject];
        // Thêm bối cảnh hệ thống ngầm vào prompt
        const contextualPrompt = `(Bối cảnh: Học sinh đang học ${data.name}, năng lượng ${Math.floor(twinState.energy)}%. Yêu cầu: Trả lời ngắn gọn, thân thiện, xưng "mình" và gọi "bạn").\nCâu hỏi: ${question}`;
        
        // Gọi AI với useHistory = true
        const answer = await callGemini(contextualPrompt, true);
        
        // Lưu AI vào lịch sử (vai trò: model)
        chatHistory.push({ role: "model", text: answer });
        
        // Xóa indicator và in câu trả lời
        document.getElementById(typingId).remove();
        chatBox.innerHTML += `<div class="chat-message ai-message"><b>🤖 AI Tutor:</b> ${answer}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
        
        addXP(5); // Thưởng tương tác
    }

    // Các hàm phụ trợ TwinUI, thêm XP... (Giữ nguyên)
    function updateTwinUI() {
        document.getElementById('twinXP').textContent = `${twinState.xp}/${twinState.level * 100}`;
        document.getElementById('twinLevel').textContent = `Lv.${twinState.level}`;
        document.getElementById('twinEnergy').textContent = `${Math.floor(twinState.energy)}%`;
    }

    function addXP(amount) {
        twinState.xp += amount;
        if (twinState.xp >= twinState.level * 100) {
            twinState.xp -= twinState.level * 100;
            twinState.level++;
        }
        updateTwinUI(); saveState();
    }

    // KHỞI TẠO HỆ THỐNG
    function init() {
        updateTwinUI();
        initChart(currentSubject);
        updateDailyInsight();
        updateKnowledgeGraph(currentSubject); // Khởi tạo đồ thị
        
        // Lắng nghe sự kiện click Chat
        document.getElementById('searchBtn').addEventListener('click', handleChat);
        document.getElementById('searchInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChat(); });
        
        // Lắng nghe đổi môn học -> reset lịch sử chat để ko bị nhầm môn
        document.getElementById('subjectSelector').addEventListener('change', (e) => {
            currentSubject = e.target.value;
            document.getElementById('currentSubjectContext').textContent = e.target.options[e.target.selectedIndex].text;
            chatHistory = []; // Reset bộ nhớ chat khi đổi môn
            document.getElementById('chatBox').innerHTML = `<div class="chat-message ai-message"><b>🤖 AI:</b> Chuyển sang môn mới. Cần hỏi gì cứ gõ nhé!</div>`;
            initChart(currentSubject);
            updateDailyInsight();
            updateKnowledgeGraph(currentSubject);
        });

        // Đóng popup
        document.getElementById('closePopupBtn').addEventListener('click', () => {
            document.getElementById('roadmapPopup').classList.remove('show');
        });

        // Cài đặt API
        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('apiKeyInput').value = getApiKey() || '';
            document.getElementById('apiModal').classList.add('show');
        });
        document.getElementById('closeModalBtn').addEventListener('click', () => document.getElementById('apiModal').classList.remove('show'));
        document.getElementById('saveApiBtn').addEventListener('click', () => {
            const key = document.getElementById('apiKeyInput').value.trim();
            if (key) { localStorage.setItem('gemini_api_key', key); location.reload(); }
        });
    }

    return { init, addXP };
})();

window.addEventListener('load', () => App.init());
