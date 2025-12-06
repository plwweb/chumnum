// ⚠️ URL ของ Web App (ต้องตรงกับตำแหน่ง api.php บน InfinityFree)
const WEB_APP_URL = 'https://sapaplw.site/api.php';

// --- Auth Check ---
let currentAdminUser = sessionStorage.getItem('adminUser');
if (!currentAdminUser) {
    window.location.href = 'login.html';
}

// --- Helper Functions ---
function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toastContainer');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 5000);
}

function showLoading() { 
    const el = document.getElementById('loadingOverlay');
    if(el) el.classList.add('active'); 
}
function hideLoading() { 
    const el = document.getElementById('loadingOverlay');
    if(el) el.classList.remove('active'); 
}

function toLocalISOString(dateString) {
    try {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const offsetMs = date.getTimezoneOffset() * 60 * 1000;
        const msLocal = date.getTime() - offsetMs;
        return new Date(msLocal).toISOString().slice(0, 16);
    } catch (e) { return ''; }
}

// ฟังก์ชันแสดงตัวอย่างภาพ
window.previewImage = function(input) {
    const file = input.files[0];
    const preview = document.getElementById('imagePreview');
    const nameDisplay = document.getElementById('fileNameDisplay');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            nameDisplay.textContent = file.name;
        }
        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
        nameDisplay.textContent = 'ยังไม่ได้เลือกไฟล์';
    }
};

// --- API Function ---
async function callApi(action, data = {}) {
    if (currentAdminUser) { data.username = currentAdminUser; } 
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error calling API:', error);
        showToast('การเชื่อมต่อขัดข้อง: ' + error.message, 'error');
        return { status: 'error', message: error.message };
    }
}

// --- Global State ---
let allStudentsData = [];
let allVoteDesigns = [];
let currentUserView = 'voted';
let chartInstance;

function displayVoteChart(votes) {
    const ctx = document.getElementById('voteChart')?.getContext('2d');
    if(!ctx) return;
    if(chartInstance) chartInstance.destroy();
    
    if (!Array.isArray(votes)) return;

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: votes.map(v => `${v[0]} - ${v[1]}`),
            datasets: [{
                label: 'คะแนนโหวต',
                data: votes.map(v => v[2]),
                backgroundColor: votes.map(() => `rgba(${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},0.7)`)
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ✅ ฟังก์ชันนาฬิกา Real-time
function startRealtimeClock() {
    const clockEl = document.getElementById('liveClock');
    if (!clockEl) return;

    const update = () => {
        const now = new Date();
        const options = { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            timeZone: 'Asia/Bangkok'
        };
        clockEl.textContent = now.toLocaleDateString('th-TH', options);
    };

    update(); 
    setInterval(update, 1000); 
}

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const adminNameEl = document.getElementById('admin-profile-name');
    if(adminNameEl) adminNameEl.textContent = currentAdminUser || 'Admin';
    const welcomeEl = document.getElementById('welcome-message');
    if(welcomeEl) welcomeEl.textContent = `ยินดีต้อนรับ, ${currentAdminUser}`;

    initializeApp();
    startRealtimeClock(); // เริ่มนาฬิกา
});

function initializeApp() {
    setupSidebar();
    loadAllAdminData();
    setupEventListeners();
    setupNotifications();
}

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileToggle = document.getElementById('mobileToggle');
    const themeToggle = document.getElementById('themeToggle');

    if(sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    if(mobileToggle) mobileToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
    
    if(themeToggle) {
        themeToggle.addEventListener('click', () => {
            const curr = document.documentElement.getAttribute('data-theme');
            document.documentElement.setAttribute('data-theme', curr === 'dark' ? 'light' : 'dark');
        });
    }

    const userMenu = document.querySelector('.user-menu .user-avatar');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenu && userDropdown) {
        userMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) { 
                userDropdown.classList.remove('active'); 
            }
        });
    }

    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = link.getAttribute('data-page');
            navigateToPage(pageName);
        });
    });
}

// --- Notification System ---
function setupNotifications() {
    const notifToggle = document.getElementById('notifToggle');
    const notifDropdown = document.getElementById('notifDropdown');
    
    if(notifToggle && notifDropdown) {
        notifToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('active');
            if(notifDropdown.classList.contains('active')) {
                loadNotifications();
                const badge = document.getElementById('notifBadge');
                if(badge) badge.style.display = 'none';
            }
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notifications-wrapper')) {
                notifDropdown.classList.remove('active');
            }
        });
    }
    loadNotifications();
    setInterval(loadNotifications, 30000); 
}

async function loadNotifications() {
    const result = await callApi('getSystemNotifications');
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    
    if(!list || !badge) return;

    if (result.status === 'success' && result.notifications) {
        if (result.notifications.length === 0) {
            list.innerHTML = '<div style="padding:15px; text-align:center; color:#999;">ไม่มีการแจ้งเตือน</div>';
            badge.style.display = 'none';
            return;
        }
        
        const toShow = result.notifications.slice(0, 20);
        const lastSeen = localStorage.getItem('lastSeenNotifTime');
        const latestTime = toShow[0].timestamp;
        
        if (!lastSeen || new Date(latestTime) > new Date(lastSeen)) {
            badge.style.display = 'block'; 
            badge.textContent = '•'; 
            localStorage.setItem('lastSeenNotifTime', latestTime);
        } else {
            badge.style.display = 'none';
        }

        list.innerHTML = toShow.map(n => {
            let icon = '<i class="fas fa-info-circle text-info"></i>';
            let action = '';
            if(n.type === 'Vote') {
                icon = '<i class="fas fa-vote-yea text-success" style="color:var(--success-color)"></i>';
                action = 'onclick="navigateToPage(\'users\')"'; 
            }
            return `
                <div class="notif-item" ${action} style="cursor: pointer;">
                    <div class="notif-icon">${icon}</div>
                    <div class="notif-content">
                        ${n.message}
                        <span class="notif-time">${new Date(n.timestamp).toLocaleString('th-TH')}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// --- Feedback System ---
async function loadFeedbackLogs() {
    showLoading();
    try {
        const result = await callApi('getFeedbackLogs');
        const tbody = document.querySelector('#feedbackTable tbody');
        if(tbody) {
            tbody.innerHTML = '';
            if (result.status === 'success' && result.logs && result.logs.length > 0) {
                result.logs.forEach(log => {
                    const tr = document.createElement('tr');
                    const shortMsg = log.message.length > 50 ? log.message.substring(0, 50) + '...' : log.message;
                    tr.innerHTML = `
                        <td>${new Date(log.timestamp).toLocaleString('th-TH')}</td>
                        <td>${log.studentId}</td>
                        <td>${shortMsg}</td>
                        <td>
                            <button class="action-btn edit" onclick="viewFullFeedback('${encodeURIComponent(log.message)}', '${log.studentId}')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">ยังไม่มีข้อเสนอแนะ</td></tr>';
            }
        }
    } finally {
        hideLoading();
    }
}

window.viewFullFeedback = (encodedMsg, studentId) => {
    const msg = decodeURIComponent(encodedMsg);
    Swal.fire({ title: `ข้อความจากรหัส ${studentId}`, text: msg, confirmButtonText: 'ปิด' });
};

function setupEventListeners() {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Swal.fire({
                title: 'ออกจากระบบ?', icon: 'question', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ใช่, ออกจากระบบ', cancelButtonText: 'ยกเลิก'
            }).then((result) => {
                if (result.isConfirmed) { sessionStorage.clear(); window.location.href = 'login.html'; }
            });
        });
    }

    const saveHelpBtn = document.getElementById('saveHelpContentButton');
    if(saveHelpBtn) {
        saveHelpBtn.addEventListener('click', async () => {
            showLoading();
            try {
                const val = document.getElementById('helpContentInput').value;
                await callApi('updateHelpContent', { text: val });
                showToast('บันทึกคู่มือเรียบร้อย', 'success');
            } finally { hideLoading(); }
        });
    }

    const refreshBtn = document.getElementById('refreshDataButton');
    if(refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showToast('กำลังรีเฟรชข้อมูล...', 'info');
            loadAllAdminData().then(() => showToast('ข้อมูลอัปเดตแล้ว!', 'success'));
        });
    }

    window.openModal = (id) => { const m = document.getElementById(id); if(m) m.classList.add('active'); };
    window.closeModal = (id) => { const m = document.getElementById(id); if(m) m.classList.remove('active'); };
    document.querySelectorAll('[data-modal]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.modal)));
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    });

    const userTabs = document.getElementById('userTabs');
    if(userTabs) {
        userTabs.addEventListener('click', (e) => {
            const target = e.target.closest('.tab-btn');
            if (!target) return;
            currentUserView = target.dataset.status;
            document.querySelectorAll('#userTabs .tab-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            filterAndSearchUsers();
        });
    }
    
    const gradeFilter = document.getElementById('gradeFilter');
    const userSearchInput = document.getElementById('userSearchInput');
    if(gradeFilter) gradeFilter.addEventListener('change', filterAndSearchUsers);
    if(userSearchInput) userSearchInput.addEventListener('input', filterAndSearchUsers);

    // --- Actions ---
    const addDesignBtn = document.getElementById('addDesignBtn');
    if(addDesignBtn) {
        addDesignBtn.addEventListener('click', () => {
            document.getElementById('designForm').reset();
            document.getElementById('designModalTitle').textContent = 'เพิ่มแบบเสื้อใหม่';
            document.getElementById('editMode').value = 'false';
            document.getElementById('designIdInput').disabled = false;
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('fileNameDisplay').textContent = 'ยังไม่ได้เลือกไฟล์';
            openModal('designModal');
        });
    }

    const designForm = document.getElementById('designForm');
    if(designForm) {
        designForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const isEdit = document.getElementById('editMode').value === 'true';
            const id = isEdit ? document.getElementById('editDesignIdHidden').value : document.getElementById('designIdInput').value;
            const name = document.getElementById('designNameInput').value;
            
            let imageUrl = document.getElementById('designImageUrlInput').value;
            const fileInput = document.getElementById('designImageFile');
            
            showLoading();
            
            if(fileInput.files.length > 0) {
                const reader = new FileReader();
                reader.onload = async function(evt) {
                    const base64 = evt.target.result;
                    try {
                        const res = await callApi(isEdit ? 'editDesign' : 'addDesign', { 
                            designId: id, 
                            designName: name, 
                            imageUrl: base64
                        });
                        if(res.status === 'success') { showToast('บันทึกสำเร็จ', 'success'); closeModal('designModal'); loadAdminData(); }
                        else showToast(res.message, 'error');
                    } finally { hideLoading(); }
                };
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                try {
                    const res = await callApi(isEdit ? 'editDesign' : 'addDesign', { 
                        designId: id, 
                        designName: name, 
                        imageUrl: imageUrl 
                    });
                    if(res.status === 'success') { showToast('บันทึกสำเร็จ', 'success'); closeModal('designModal'); loadAdminData(); }
                    else showToast(res.message, 'error');
                } finally { hideLoading(); }
            }
        });
    }

    const editVoteForm = document.getElementById('editVoteForm');
    if(editVoteForm) {
        editVoteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentId = document.getElementById('editVoteStudentId').value;
            const oldVoteChoice = document.getElementById('editVoteOldChoice').value;
            const newVoteChoice = document.getElementById('newVoteChoiceSelect').value;
            if (oldVoteChoice === newVoteChoice) { showToast('คุณยังไม่ได้เปลี่ยนการโหวต', 'warning'); return; }
            showLoading();
            try {
                const result = await callApi('adminUpdateVote', { studentId, oldVoteChoice, newVoteChoice });
                if (result.status === 'success') { showToast('แก้ไขการโหวตแล้ว', 'success'); closeModal('editVoteModal'); loadAllAdminData(); }
                else { showToast(result.message, 'error'); }
            } finally { hideLoading(); }
        });
    }

    const setVoteTimeBtn = document.getElementById('setVoteTimeButton');
    if(setVoteTimeBtn) {
        setVoteTimeBtn.addEventListener('click', async () => {
            const startTime = document.getElementById('voteStartTime').value;
            const endTime = document.getElementById('voteEndTime').value;
            showLoading();
            try {
                const result = await callApi('updateVoteTime', { startTime, endTime });
                if (result.status === 'success') { showToast('ตั้งเวลาสำเร็จ!', 'success'); loadSettings(); }
                else { showToast(result.message, 'error'); }
            } finally { hideLoading(); }
        });
    }
    
    const saveAnnBtn = document.getElementById('saveAnnouncementButton');
    if(saveAnnBtn) {
        saveAnnBtn.addEventListener('click', async () => {
            showLoading();
            try {
                await callApi('updateAnnouncementText', { text: document.getElementById('announcementText').value });
                showToast('บันทึกประกาศแล้ว', 'success');
            } finally { hideLoading(); }
        });
    }
    
    const closeVoteBtn = document.getElementById('closeVotingNowButton');
    if(closeVoteBtn) {
        closeVoteBtn.addEventListener('click', () => {
            Swal.fire({ title: 'ปิดโหวตทันที?', text: "ปิดรับการลงคะแนนเดี๋ยวนี้?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ปิดทันที' }).then(async (r) => {
                if (r.isConfirmed) { await callApi('closeVotingNow'); showToast('ปิดโหวตเรียบร้อย', 'success'); loadSettings(); }
            });
        });
    }

    const addAdminBtn = document.getElementById('addAdminButton');
    if(addAdminBtn) {
        addAdminBtn.addEventListener('click', async () => {
            const u = document.getElementById('newAdminUsername').value.trim();
            const p = document.getElementById('newAdminPassword').value.trim();
            const n = document.getElementById('newAdminFullName').value.trim();
            if(!u || !p || !n) return showToast('กรอกข้อมูลให้ครบ', 'warning');
            const res = await callApi('addAdminAccount', { usernameToAdd: u, passwordToAdd: p, fullNameToAdd: n });
            if(res.status==='success') { showToast('เพิ่ม Admin สำเร็จ', 'success'); loadAdminAccounts(); document.getElementById('newAdminUsername').value=''; document.getElementById('newAdminPassword').value=''; document.getElementById('newAdminFullName').value=''; }
            else showToast(res.message, 'error');
        });
    }
    
    const recalBtn = document.getElementById('recalculateVotesButton');
    if(recalBtn) {
        recalBtn.addEventListener('click', () => {
            Swal.fire({ title: 'คำนวณคะแนนใหม่?', text: "ระบบจะนับคะแนนจากรายชื่อนักเรียนใหม่ทั้งหมด", icon: 'warning', showCancelButton: true, confirmButtonText: 'คำนวณ' }).then(async r => {
                if(r.isConfirmed) { showLoading(); try { const res = await callApi('recalculateVotes'); showToast(res.message, res.status); loadAllAdminData(); } finally { hideLoading(); } }
            });
        });
    }
    
    const resetBtn = document.getElementById('resetVotesButton');
    if(resetBtn) {
        resetBtn.addEventListener('click', () => {
            Swal.fire({ title: 'รีเซ็ตคะแนนทั้งหมด?', text: "คะแนนจะเป็น 0 ทั้งหมด! (ระวัง)", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ยืนยัน รีเซ็ต' }).then(async r => {
                if(r.isConfirmed) { showLoading(); try { await callApi('resetVotes'); showToast('รีเซ็ตคะแนนแล้ว', 'success'); loadAllAdminData(); } finally { hideLoading(); } }
            });
        });
    }
    
    const clearUserBtn = document.getElementById('clearUsersButton');
    if(clearUserBtn) {
        clearUserBtn.addEventListener('click', () => {
            Swal.fire({ title: 'ล้างสถานะผู้ใช้?', text: "ทุกคนจะกลับมาโหวตได้ใหม่อีกครั้ง", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ล้างข้อมูล' }).then(async r => {
                if(r.isConfirmed) { showLoading(); try { await callApi('clearUsers'); showToast('ล้างประวัติแล้ว', 'success'); loadAllAdminData(); } finally { hideLoading(); } }
            });
        });
    }
    
    const studentForm = document.getElementById('student-form');
    if(studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                studentId: document.getElementById('manualStudentId').value.trim(),
                password: document.getElementById('manualPassword').value.trim(),
                fullName: document.getElementById('manualFullName').value.trim(),
                grade: document.getElementById('manualGrade').value,
                room: document.getElementById('manualRoom').value
            };
            showLoading();
            try {
                const res = await callApi('addOrUpdateStudent', data);
                if(res.status==='success') { showToast('บันทึกข้อมูลนักเรียนแล้ว', 'success'); document.getElementById('student-form').reset(); loadAdminData(); }
                else showToast(res.message, 'error');
            } finally { hideLoading(); }
        });
    }
    
    const uploadCsvBtn = document.getElementById('uploadCsvButton');
    if(uploadCsvBtn) {
        uploadCsvBtn.addEventListener('click', () => {
            const file = document.getElementById('csvFile').files[0];
            if(!file) return showToast('เลือกไฟล์ก่อน', 'warning');
            Swal.fire({ title: 'Import CSV?', text: "ข้อมูลเก่าจะถูกแทนที่ด้วยข้อมูลใหม่", icon: 'warning', showCancelButton: true, confirmButtonText: 'Import' }).then(async r => {
                if(r.isConfirmed) {
                    showLoading();
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const base64 = e.target.result.split(',')[1];
                        try {
                            const res = await callApi('importStudents', { base64Data: base64 });
                            if(res.status==='success') { showToast('Import สำเร็จ', 'success'); loadAdminData(); }
                            else showToast(res.message, 'error');
                        } finally { hideLoading(); }
                    };
                    reader.readAsDataURL(file);
                }
            });
        });
    }
    
    // --- ✅ 1. ส่วน Export ผู้ใช้งาน (Native Print) ---
    const exportBtn = document.getElementById('exportUsersPdfButton');
    if(exportBtn) {
        exportBtn.addEventListener('click', () => {
            if(!allStudentsData || allStudentsData.length === 0) {
                showToast('ไม่มีข้อมูลนักเรียนให้ส่งออก', 'warning');
                return;
            }

            const win = window.open('', '_blank');
            
            const rows = allStudentsData.map((u, i) => `
                <tr>
                    <td style="text-align:center">${i+1}</td>
                    <td style="text-align:center">${u[0]}</td>
                    <td>${u[1]}</td>
                    <td style="text-align:center">${u[2]}</td>
                    <td style="text-align:center">${u[3]}</td>
                    <td style="text-align:center; color:${u[6]?'green':'red'}; font-weight:bold;">
                        ${u[6]?'โหวตแล้ว':'ยังไม่โหวต'}
                    </td>
                </tr>`).join('');

            win.document.write(`
                <html>
                <head>
                    <title>รายงานรายชื่อนักเรียน - ${new Date().toLocaleDateString('th-TH')}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Sarabun', sans-serif; padding: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .logo { height: 80px; margin-bottom: 10px; }
                        h2 { margin: 5px 0; }
                        p { color: #666; margin: 0; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #333; padding: 8px; font-size: 14px; }
                        th { background-color: #f0f0f0; }
                        @media print { body { -webkit-print-color-adjust: exact; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <img src="https://img5.pic.in.th/file/secure-sv1/IMG_60290ec6a71fd92a13d0.png" class="logo" alt="Logo">
                        <h2>รายชื่อนักเรียนทั้งหมด</h2>
                        <p>ระบบเลือกตั้งสภานักเรียน โรงเรียนภูหลวงวิทยา</p>
                        <p>ข้อมูล ณ วันที่: ${new Date().toLocaleString('th-TH')} | จำนวน: ${allStudentsData.length} คน</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width:50px">ลำดับ</th>
                                <th style="width:100px">รหัส</th>
                                <th>ชื่อ - นามสกุล</th>
                                <th style="width:80px">ชั้น</th>
                                <th style="width:80px">ห้อง</th>
                                <th style="width:100px">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <script>setTimeout(() => { window.print(); }, 1000);<\/script>
                </body>
                </html>
            `);
            win.document.close();
        });
    }

    // --- ✅ 2. ส่วน Export ผลโหวต (Native Print + Image) ---
    const exportVotesBtn = document.getElementById('exportVotesPdfButton');
    if(exportVotesBtn) {
        exportVotesBtn.addEventListener('click', () => {
            if(!allVoteDesigns || allVoteDesigns.length === 0) {
                showToast('ไม่มีข้อมูลแบบเสื้อ', 'warning');
                return;
            }

            const sortedVotes = [...allVoteDesigns].sort((a, b) => b[2] - a[2]);

            const win = window.open('', '_blank');
            
            const rows = sortedVotes.map((v, i) => `
                <tr>
                    <td style="text-align:center; font-weight:bold;">${i+1}</td>
                    <td style="text-align:center">${v[0]}</td>
                    <td style="text-align:center">
                        ${v[3] ? `<img src="${v[3]}" style="height:60px; border-radius:5px;">` : '-'}
                    </td>
                    <td>${v[1]}</td>
                    <td style="text-align:center; font-size:18px; font-weight:bold;">${v[2]}</td>
                </tr>`).join('');

            win.document.write(`
                <html>
                <head>
                    <title>รายงานผลคะแนน - ${new Date().toLocaleDateString('th-TH')}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Sarabun', sans-serif; padding: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .logo { height: 80px; margin-bottom: 10px; }
                        h2 { margin: 5px 0; }
                        p { color: #666; margin: 0; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #333; padding: 10px; font-size: 16px; vertical-align: middle; }
                        th { background-color: #f0f0f0; }
                        @media print { body { -webkit-print-color-adjust: exact; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <img src="https://img5.pic.in.th/file/secure-sv1/IMG_60290ec6a71fd92a13d0.png" class="logo" alt="Logo">
                        <h2>สรุปผลคะแนนโหวตแบบเสื้อ</h2>
                        <p>ระบบเลือกตั้งสภานักเรียน โรงเรียนภูหลวงวิทยา</p>
                        <p>ข้อมูล ณ วันที่: ${new Date().toLocaleString('th-TH')}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width:60px">อันดับ</th>
                                <th style="width:100px">รหัสแบบ</th>
                                <th style="width:100px">รูปภาพ</th>
                                <th>ชื่อแบบเสื้อ</th>
                                <th style="width:120px">คะแนนโหวต</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <script>setTimeout(() => { window.print(); }, 1000);<\/script>
                </body>
                </html>
            `);
            win.document.close();
        });
    }

    // --- Table Actions (Delegation) ---
    document.querySelector('body').addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if(!btn) return;

        if(btn.classList.contains('edit-design-button')) {
            const tr = btn.closest('tr');
            document.getElementById('designForm').reset();
            document.getElementById('designModalTitle').textContent = 'แก้ไขแบบเสื้อ';
            document.getElementById('editMode').value = 'true';
            document.getElementById('editDesignIdHidden').value = tr.dataset.designId;
            document.getElementById('designIdInput').value = tr.dataset.designId;
            document.getElementById('designIdInput').disabled = true;
            document.getElementById('designNameInput').value = tr.dataset.designName;
            
            const oldUrl = tr.dataset.imageUrl;
            document.getElementById('designImageUrlInput').value = oldUrl;
            
            if(oldUrl) {
                document.getElementById('imagePreview').src = oldUrl;
                document.getElementById('imagePreview').style.display = 'block';
            } else {
                document.getElementById('imagePreview').style.display = 'none';
            }
            
            document.getElementById('fileNameDisplay').textContent = 'ยังไม่ได้เลือกไฟล์ใหม่';
            
            openModal('designModal');
        }
        
        if(btn.classList.contains('delete-design-button')) {
            const id = btn.closest('tr').dataset.designId;
            Swal.fire({ title:'ลบแบบเสื้อ?', icon:'warning', showCancelButton:true, confirmButtonColor:'#d33' }).then(async r => {
                if(r.isConfirmed) { await callApi('deleteDesign', {designId:id}); loadAdminData(); }
            });
        }

        if(btn.classList.contains('delete-user-button')) {
            const id = btn.closest('tr').dataset.studentId;
            window.deleteUser(id); 
        }

        if(btn.classList.contains('edit-vote-button')) {
            const tr = btn.closest('tr');
            const id = tr.dataset.studentId;
            const name = tr.dataset.studentName;
            const choice = tr.dataset.voteChoice;
            document.getElementById('editVoteStudentId').value = id;
            document.getElementById('editVoteOldChoice').value = choice;
            document.getElementById('editVoteStudentInfo').value = `${id} - ${name}`;
            const sel = document.getElementById('newVoteChoiceSelect');
            sel.innerHTML = '';
            if(allVoteDesigns) {
                allVoteDesigns.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d[0]; opt.text = `${d[0]} - ${d[1]}`;
                    if(d[0] === choice) opt.selected = true;
                    sel.appendChild(opt);
                });
            }
            openModal('editVoteModal');
        }

        if(btn.classList.contains('delete-admin-button')) {
            const u = btn.dataset.username;
            Swal.fire({ title:'ลบผู้ดูแล?', icon:'warning', showCancelButton:true, confirmButtonColor:'#d33' }).then(async r => {
                if(r.isConfirmed) { await callApi('deleteAdminAccount', {usernameToDelete:u}); loadAdminAccounts(); }
            });
        }
    });
}

window.deleteUser = (id) => {
    Swal.fire({
        title: 'รีเซ็ตสิทธิ์การโหวต?',
        html: `ต้องการล้างสถานะการโหวตของรหัส <b>${id}</b> หรือไม่?<br><span style="font-size:0.9em; color:#666;">(ข้อมูลนักเรียนจะยังอยู่ แต่จะกลับมาโหวตใหม่ได้)</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b', 
        confirmButtonText: 'ใช่, รีเซ็ตเลย',
        cancelButtonText: 'ยกเลิก'
    }).then(async r => {
        if(r.isConfirmed) {
            const res = await callApi('deleteUser', {studentId:id});
            if(res.status === 'success') {
                showToast('รีเซ็ตสถานะเรียบร้อยแล้ว', 'success'); 
                loadAdminData().then(filterAndSearchUsers);
            } else {
                showToast(res.message, 'error');
            }
        }
    });
};

function navigateToPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const target = document.getElementById(`${pageName}-page`);
    if(target) target.classList.add('active');
    
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const link = document.querySelector(`[data-page="${pageName}"]`);
    if(link) link.closest('li').classList.add('active');
    
    if(window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('active');
    
    if(pageName === 'dashboard') loadDashboardData();
    else if(pageName === 'feedbacks') loadFeedbackLogs(); 
    else if(pageName === 'products') loadAdminData();
    else if(pageName === 'users') loadAdminData().then(filterAndSearchUsers);
    else if(pageName === 'settings') loadSettings();
    else if(pageName === 'accounts') loadAccounts();
}

async function loadAllAdminData() {
    showLoading();
    try {
        await Promise.all([loadDashboardData(), loadAdminData(), loadSettings()]);
    } catch (e) {
        console.error("Critical Load Error", e);
        showToast("โหลดข้อมูลบางส่วนไม่สำเร็จ", "error");
    } finally {
        hideLoading();
    }
}

async function loadDashboardData() {
    const dashboardSummaryDiv = document.getElementById('dashboard-summary');
    if(!dashboardSummaryDiv) return;
    const result = await callApi('getAdminDashboardData');
    if (result.status === 'success') {
        const total = result.totalStudentsCount || 0;
        const voted = result.totalVoters || 0;
        const votes = result.totalVotes || 0;
        const percent = result.turnoutPercentage || 0;

        document.getElementById('stat-total-students').textContent = total.toLocaleString();
        document.getElementById('stat-total-votes').textContent = votes.toLocaleString();
        document.getElementById('stat-turnout-percent').textContent = `${percent}%`;

        let summaryHtml = `<p><strong>จำนวนผู้มาใช้สิทธิ์:</strong> ${voted} คน (จากทั้งหมด ${total} คน)</p>`;
        summaryHtml += '<strong>ผู้โหวตแยกตามระดับชั้นและห้อง:</strong>';
        
        if (result.votesByGradeAndRoom) {
            const sortedGrades = Object.keys(result.votesByGradeAndRoom).sort();
            summaryHtml += '<ul>';
            for (const grade of sortedGrades) {
                const gradeData = result.votesByGradeAndRoom[grade];
                summaryHtml += `<li><strong>${grade}</strong> (รวม ${gradeData.total} คน)`;
                const sortedRooms = Object.keys(gradeData.rooms).sort((a, b) => a - b);
                if (sortedRooms.length > 0) {
                    summaryHtml += '<ul>';
                    for (const room of sortedRooms) summaryHtml += `<li>ห้อง ${room}: ${gradeData.rooms[room]} คน</li>`;
                    summaryHtml += '</ul>';
                }
                summaryHtml += '</li>';
            }
            summaryHtml += '</ul>';
        }
        dashboardSummaryDiv.innerHTML = summaryHtml;
    }
}

async function loadAdminData() {
    const result = await callApi('getAdminData');
    if (result.status === 'success') {
        allVoteDesigns = result.votes;
        allStudentsData = result.allStudents;
        displayAdminVoteResults(result.votes);
        filterAndSearchUsers();
        displayVoteChart(result.votes);
    }
}

async function loadSettings() {
    const t = await callApi('getVoteTime');
    if(t && t.startTime) {
        document.getElementById('voteStartTime').value = toLocalISOString(t.startTime);
        document.getElementById('voteEndTime').value = toLocalISOString(t.endTime);
        const display = document.getElementById('current-vote-time');
        if(display) display.textContent = `กำหนดการ: ${new Date(t.startTime).toLocaleString('th-TH')} - ${new Date(t.endTime).toLocaleString('th-TH')}`;
    }
    const a = await callApi('getAnnouncementText');
    const ann = document.getElementById('announcementText');
    if(ann && a) ann.value = a.text;
    const h = await callApi('getHelpContent');
    const helpInput = document.getElementById('helpContentInput');
    if(helpInput && h) helpInput.value = h.text;
}

async function loadAccounts() {
    const res = await callApi('getAdminAccounts');
    const tbody = document.querySelector('#adminAccountsTable tbody');
    if(tbody && res.accounts) {
        tbody.innerHTML = res.accounts.map(a => `<tr><td>${a[0]}</td><td>${a[2]}</td><td class="table-actions-cell"><button class="action-btn delete delete-admin-button" data-username="${a[0]}"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    }
}

function displayAdminVoteResults(votes) {
    const tbody = document.querySelector('#adminVoteResultsTable tbody');
    if(!tbody || !votes) return;
    tbody.innerHTML = '';
    const sortedVotes = [...votes].sort((a, b) => b[2] - a[2]); 
    sortedVotes.forEach(row => {
        const tr = document.createElement('tr');
        tr.dataset.designId = row[0];
        tr.dataset.designName = row[1];
        tr.dataset.imageUrl = row[3] || '';
        tr.innerHTML = `
            <td>${row[0]}</td>
            <td>${row[1]}</td>
            <td><strong>${row[2]}</strong></td>
            <td class="admin-table-image"><img src="${row[3] || 'https://via.placeholder.com/60'}" alt="Image"></td>
            <td class="table-actions-cell">
                <button class="action-btn edit edit-design-button" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete delete-design-button" title="Delete"><i class="fas fa-trash"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function filterAndSearchUsers() {
    const grade = document.getElementById('gradeFilter').value;
    const search = document.getElementById('userSearchInput').value.toLowerCase();
    const isVoted = currentUserView === 'voted';
    
    const filtered = allStudentsData.filter(u => {
        const statusMatch = u[6] === isVoted;
        const gradeMatch = grade === 'all' || u[2] === grade;
        const searchMatch = u[0].toString().includes(search) || u[1].toLowerCase().includes(search);
        return statusMatch && gradeMatch && searchMatch;
    });
    
    const vSpan = document.getElementById('voted-count');
    const uSpan = document.getElementById('unvoted-count');
    if(vSpan) vSpan.textContent = allStudentsData.filter(u=>u[6]).length;
    if(uSpan) uSpan.textContent = allStudentsData.filter(u=>!u[6]).length;
    
    const tbody = document.querySelector('#adminUsersTable tbody');
    if(!tbody) return;
    document.querySelectorAll('.voted-col').forEach(c => c.style.display = isVoted?'table-cell':'none');
    if(filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">ไม่พบข้อมูล</td></tr>'; return; }
    
    tbody.innerHTML = filtered.map(u => `
        <tr data-student-id="${u[0]}" data-student-name="${u[1]}" data-vote-choice="${u[5]}">
            <td>${u[0]}</td>
            <td>${u[1]}</td>
            <td>${u[2]}</td>
            <td>${u[3]}</td>
            ${isVoted ? `<td class="voted-col">${new Date(u[4]).toLocaleString('th-TH')}</td>
                         <td class="voted-col">${u[5]}</td>
                         <td class="voted-col table-actions-cell">
                            <button class="action-btn edit edit-vote-button"><i class="fas fa-edit"></i></button>
                            <button class="action-btn delete delete-user-button"><i class="fas fa-trash"></i></button>
                         </td>` : `<td class="table-actions-cell"><button class="action-btn delete delete-user-button"><i class="fas fa-trash"></i></button></td>`}
        </tr>
    `).join('');
}