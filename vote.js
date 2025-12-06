// ⚠️ URL ของ Web App
const WEB_APP_URL = 'https://sapaplw.site/api.php';

// --- Auth Check ---
if (!sessionStorage.getItem('studentId')) window.location.href = 'login.html';

// --- DOM Variables ---
const voteForm = document.getElementById('voteForm');
const voteOptionsSection = document.getElementById('vote-options-section');
const statsDashboard = document.getElementById('stats-dashboard');
const designOptionsDiv = document.getElementById('design-options');
const studentIdDisplay = document.getElementById('studentIdDisplay'); 
const fullNameInput = document.getElementById('fullName');
const gradeInput = document.getElementById('grade');
const roomInput = document.getElementById('room');
const submitVoteButton = document.getElementById('submitVoteButton');
const voteStatusBox = document.getElementById('vote-status-box');
const votingStatusDiv = document.getElementById('voting-status');
const countdownTimerDiv = document.getElementById('countdown-timer');
const resultsSection = document.getElementById('results-section');
const resultsContentWrapper = document.getElementById('results-content-wrapper');
const resultsPlaceholder = document.getElementById('results-placeholder');
const voteResultsDiv = document.getElementById('vote-results');
const logoutButton = document.getElementById('logoutButton');
const feedbackForm = document.getElementById('feedbackForm');

// Mobile Nav Elements
const mobileNavItems = document.querySelectorAll('.mobile-bottom-nav .nav-item');
const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

let voteChartInstance = null;
let countdownInterval;
let currentVerifiedStudentId = null; 
let currentVerifiedStudentName = null; 
let allVoteDesigns = [];

// --- Utils ---
function parseDate(dateStr) {
    if (!dateStr) return null;
    let safeStr = dateStr.toString().replace(/-/g, '/').replace('T', ' ');
    let d = new Date(safeStr);
    if (!isNaN(d.getTime())) return d.getTime();
    return null; 
}

function formatThaiDateTime(dateObj) {
    return new Date(dateObj).toLocaleString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.';
}

function showToast(message, type = 'info') { Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: type==='error'?'error':'success', title: message }); }
function showLoading(show = true) { document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none'; }
function showSkeletonLoader() { if(designOptionsDiv) designOptionsDiv.innerHTML = `<p>Loading...</p>`; }

function formatTimeLeft(distance) {
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    let text = "";
    if(days > 0) text += days + "วัน ";
    if(hours > 0) text += hours + "ชม. ";
    text += minutes + "นาที " + seconds + "วิ";
    return text;
}

async function callApi(action, data = {}) {
    if (currentVerifiedStudentId) { data.username = currentVerifiedStudentId; }
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data }),
        });
        return await response.json();
    } catch (error) { return { status: 'error', message: error.message }; }
}

function handleLogout() {
    Swal.fire({ title: 'ออกจากระบบ?', icon: 'question', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ใช่' }).then((result) => {
        if (result.isConfirmed) { sessionStorage.clear(); window.location.href = 'login.html'; }
    });
}

function initializeMainApp() {
    if (!populateUserInfoFromSession()) return;
    loadInitialData();
    bindEventListeners();
}

function populateUserInfoFromSession() {
    const studentId = sessionStorage.getItem('studentId');
    if (!studentId) { window.location.href = 'login.html'; return false; }
    currentVerifiedStudentId = studentId;
    currentVerifiedStudentName = sessionStorage.getItem('fullName');
    
    if(studentIdDisplay) studentIdDisplay.value = studentId;
    if(fullNameInput) fullNameInput.value = currentVerifiedStudentName;
    if(gradeInput) gradeInput.value = sessionStorage.getItem('grade');
    if(roomInput) roomInput.value = sessionStorage.getItem('room');
    
    document.querySelectorAll('#user-profile-name').forEach(el => el.textContent = currentVerifiedStudentName);
    document.querySelectorAll('#user-profile-id').forEach(el => el.textContent = studentId);
    return true;
}

async function loadInitialData() {
    showSkeletonLoader();
    const result = await callApi('getVotePageData');
    if (result.status !== 'success') { Swal.fire('Error', result.message, 'error'); return; }

    loadAnnouncement(result.announcement); 
    const helpContainer = document.getElementById('help-content-container');
    if(helpContainer) helpContainer.innerHTML = result.helpContent || '<p>ไม่มีข้อมูล</p>';
    
    loadPublicStats(result.stats); 
    if (result.results) {
        allVoteDesigns = result.results;
        displayDesignOptions(result.results);
        displayVoteResults(result.results);
        displayVoteChart(result.results);
    }
    startVotingTimer(result.voteTime);
}

function bindEventListeners() {
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPage(link.dataset.page);
        });
    });

    if (mobileNavItems) {
        mobileNavItems.forEach(item => {
            if (item.id === 'mobileLogoutBtn') return;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                mobileNavItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                navigateToPage(item.dataset.page);
            });
        });
    }

    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    
    if(voteForm) voteForm.addEventListener('submit', handleVoteSubmit);
    if(designOptionsDiv) designOptionsDiv.addEventListener('change', () => { if(submitVoteButton) submitVoteButton.disabled = false; });
    if(feedbackForm) feedbackForm.addEventListener('submit', handleSubmitFeedback);
}

async function handleVoteSubmit(event) {
    event.preventDefault();
    const el = document.querySelector('input[name="voteChoice"]:checked');
    if (!el) return;
    const val = el.value;
    const name = document.querySelector(`label[for="design-${val}"] .design-name`).textContent.trim();
    const imgSrc = document.querySelector(`label[for="design-${val}"] img`).src;

    Swal.fire({
        title: 'ยืนยันการโหวต', html: `คุณเลือก: <b style="color:#6366f1">${name}</b>`, 
        imageUrl: imgSrc, imageWidth: 200, imageHeight: 'auto',
        showCancelButton: true, confirmButtonText: 'ยืนยัน', confirmButtonColor: '#10b981', cancelButtonColor: '#d33'
    }).then(async (result) => {
        if (result.isConfirmed) {
            showLoading();
            const res = await callApi('registerAndVote', { studentId: currentVerifiedStudentId, voteChoice: val });
            showLoading(false);
            if (res.status === 'success') {
                if(typeof confetti === 'function') confetti({ particleCount: 150, spread: 180 });
                sessionStorage.setItem('hasVoted', 'true');
                sessionStorage.setItem('voteChoice', val);
                await Swal.fire({ title: 'สำเร็จ!', icon: 'success', timer: 2000, showConfirmButton: false });
                location.reload(); 
            } else { Swal.fire('ผิดพลาด', res.message, 'error'); }
        }
    });
}

async function handleSubmitFeedback(e) {
    e.preventDefault();
    const t = document.getElementById('feedbackText').value;
    if(!t.trim()) return;
    showLoading();
    const res = await callApi('submitFeedback', { feedbackText: t });
    showLoading(false);
    if(res.status==='success') { showToast('ส่งแล้ว'); feedbackForm.reset(); }
}

function navigateToPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const desktopLink = document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`);
    if(desktopLink) desktopLink.closest('li').classList.add('active');

    if (mobileNavItems) {
        mobileNavItems.forEach(item => {
            item.classList.remove('active');
            if(item.dataset.page === pageName) item.classList.add('active');
        });
    }

    if(pageName === 'results') checkResultsPageVisibility();
}

function loadAnnouncement(text) {
    const bar = document.getElementById('announcement-bar'); 
    if (text && text.trim() !== '') {
        bar.querySelector('.scrolling-text').textContent = text; 
        bar.style.display = 'block'; 
    } else bar.style.display = 'none';
}

function loadPublicStats(stats) {
    if (stats && statsDashboard) {
        document.getElementById('stat-voted-count').textContent = `${stats.votedCount} / ${stats.totalStudents}`;
        document.getElementById('stat-turnout').textContent = `${stats.turnoutPercentage.toFixed(2)}%`;
        document.getElementById('stat-top-grade').textContent = stats.topGrade;
        statsDashboard.style.display = 'grid'; 
    }
}

// ✅ (แก้ข้อ 3) ลบฟังก์ชันคลิกดูรูป (Zoom) ออกแล้ว
function displayDesignOptions(designs) {
    if(!designOptionsDiv) return;
    designOptionsDiv.innerHTML = '';
    designs.forEach(design => {
        const div = document.createElement('div');
        div.classList.add('design-card');
        div.innerHTML = `
            <input type="radio" id="design-${design.designId}" name="voteChoice" value="${design.designId}" required>
            <label for="design-${design.designId}" class="design-label">
                <div class="check-icon"><i class="fas fa-check"></i></div>
                <img src="${design.imageUrl}" alt="${design.designName}">
                <div class="design-info"><div class="design-name">${design.designName}</div><div class="design-id">ID: ${design.designId}</div></div>
            </label>`;
        designOptionsDiv.appendChild(div);
    });
}

function displayVoteResults(results) {
    if(!voteResultsDiv) return;
    voteResultsDiv.innerHTML = '';
    if (results.length === 0) { voteResultsDiv.innerHTML = '<p>ยังไม่มีผล</p>'; return; }
    results.sort((a, b) => b.voteCount - a.voteCount);
    results.forEach(item => {
        voteResultsDiv.innerHTML += `<div class="vote-item"><span>${item.designName}:</span><span class="vote-count">${item.voteCount}</span></div>`;
    });
}

function displayVoteChart(votes) {
    const ctx = document.getElementById('voteChart')?.getContext('2d');
    if(!ctx) return;
    if (voteChartInstance) voteChartInstance.destroy();
    votes.sort((a, b) => b.voteCount - a.voteCount); 
    voteChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: votes.map(v => v.designName),
            datasets: [{ label: 'คะแนน', data: votes.map(v => v.voteCount), backgroundColor: 'rgba(99, 102, 241, 0.7)' }]
        },
        options: { responsive: true, indexAxis: 'y' }
    });
}

function startVotingTimer(voteTime) {
    const start = parseDate(voteTime.startTime);
    const end = parseDate(voteTime.endTime);
    if (!start || !end) return;
    
    const statusBox = document.getElementById('vote-status-box');
    let scheduleInfo = document.getElementById('schedule-info');
    if (!scheduleInfo) {
        scheduleInfo = document.createElement('div');
        scheduleInfo.id = 'schedule-info';
        scheduleInfo.style.marginTop = '15px';
        scheduleInfo.style.padding = '10px';
        scheduleInfo.style.backgroundColor = 'var(--bg-tertiary)';
        scheduleInfo.style.borderRadius = '8px';
        scheduleInfo.style.fontSize = '0.9em';
        scheduleInfo.style.color = 'var(--text-secondary)';
        scheduleInfo.style.textAlign = 'center';
        statusBox.appendChild(scheduleInfo);
    }
    scheduleInfo.innerHTML = `<div style="margin-bottom:5px;"><i class="fas fa-clock"></i> <strong>เปิด:</strong> ${formatThaiDateTime(start)}</div><div><i class="fas fa-history"></i> <strong>ปิด:</strong> ${formatThaiDateTime(end)}</div>`;

    const hasVoted = sessionStorage.getItem('hasVoted') === 'true';
    
    const update = () => {
        const now = new Date().getTime();
        
        if (now < start) {
            votingStatusDiv.className = 'status-message';
            votingStatusDiv.innerHTML = '<i class="fas fa-hourglass-start"></i> ยังไม่เปิดรับการโหวต';
            countdownTimerDiv.style.display = 'block';
            countdownTimerDiv.innerHTML = `จะเปิดโหวตในอีก:<br><span style="color:var(--custom-pink-dark);">${formatTimeLeft(start - now)}</span>`;
            voteOptionsSection.classList.add('hidden');
            resultsSection.classList.remove('hidden'); resultsPlaceholder.style.display = 'block'; resultsContentWrapper.style.display = 'none';
        } 
        else if (now >= start && now < end) {
            votingStatusDiv.className = 'status-message open';
            votingStatusDiv.innerHTML = '<i class="fas fa-check-circle"></i> เปิดให้โหวตแล้ว';
            countdownTimerDiv.style.display = 'block';
            countdownTimerDiv.innerHTML = `เหลือเวลาโหวตอีก:<br><span style="color:var(--custom-pink-dark);">${formatTimeLeft(end - now)}</span>`;

            if(hasVoted) {
                document.getElementById('voted-choice-display').textContent = sessionStorage.getItem('voteChoice');
                document.getElementById('ticket-student-name').textContent = sessionStorage.getItem('fullName'); 
                document.getElementById('voted-confirmation').classList.remove('hidden');
                voteOptionsSection.classList.add('hidden');
            } else {
                document.getElementById('voted-confirmation').classList.add('hidden');
                voteOptionsSection.classList.remove('hidden');
            }
            resultsSection.classList.remove('hidden'); resultsPlaceholder.style.display = 'block'; resultsContentWrapper.style.display = 'none';
        } 
        else {
            votingStatusDiv.className = 'status-message closed';
            votingStatusDiv.innerHTML = '<i class="fas fa-lock"></i> ปิดรับการโหวตแล้ว';
            countdownTimerDiv.style.display = 'none';
            voteOptionsSection.classList.add('hidden', 'locked');
            if (allVoteDesigns.length > 0) {
                resultsSection.classList.remove('hidden'); resultsPlaceholder.style.display = 'none'; resultsContentWrapper.style.display = 'block';
            }
            clearInterval(countdownInterval);
        }
    };
    update();
    countdownInterval = setInterval(update, 1000);
}

function checkResultsPageVisibility() {
    const isOpen = votingStatusDiv.classList.contains('open');
    if(isOpen) {
         resultsPlaceholder.style.display = 'block';
         resultsContentWrapper.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => initializeMainApp());