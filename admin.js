/* === [ JS: utils.js (ใหม่) ] === */
function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toastContainer');
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
function showLoading() { document.getElementById('loadingOverlay').classList.add('active'); }
function hideLoading() { document.getElementById('loadingOverlay').classList.remove('active'); }
const storage = {
  set: (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error('Error saving to localStorage', e); } },
  get: (key) => { try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : null; } catch (e) { console.error('Error reading from localStorage', e); return null; } },
  remove: (key) => { try { localStorage.removeItem(key); } catch (e) { console.error('Error removing from localStorage', e); } }
};
function validateForm(formElement) {
    const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    inputs.forEach(input => {
        if (!input.value.trim()) { isValid = false; }
    });
    return isValid;
}

/* === [ JS: api.js (แทนที่ด้วยระบบเก่า) ] === */
// 🚨 (อัปเดตแล้ว!) นี่คือ URL ใหม่ที่คุณเพิ่งให้มา 🚨
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwwJzP_jTHieO4asdyGAJk1hYHxP5gYSIZu2XNp_myLqtAqxmMMsekofM4Xl3GguKlvCQ/exec';
let currentAdminUser = '';
let allUsersData = [];
async function callApi(action, data = {}) {
    if (currentAdminUser) { data.username = currentAdminUser; }
    try {
        // ⭐️ (สำคัญ) เปลี่ยน google.script.run เป็น fetch
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...data }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error calling API:', error);
        showToast('API call failed: ' + error.message, 'error');
        return { status: 'error', message: 'API call failed: ' + error.message };
    }
}

/* === [ JS: charts.js (แทนที่ด้วยระบบเก่า) ] === */
let voteChartInstance = null;
function displayVoteChart(votes) {
    const ctx = document.getElementById('voteChart')?.getContext('2d');
    if (!ctx) return;
    if (voteChartInstance) voteChartInstance.destroy();
    voteChartInstance = new Chart(ctx, {
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

/* === [ JS: dashboard.js / users.js (รวมและดัดแปลงจากระบบเก่า) ] === */
const dashboardSummaryDiv = document.getElementById('dashboard-summary');
const gradeFilterSelect = document.getElementById('gradeFilter');
const userSearchInput = document.getElementById('userSearchInput');
const statTotalVoters = document.getElementById('stat-total-voters');
const statTotalVotes = document.getElementById('stat-total-votes');

async function loadAllAdminData() {
    showLoading();
    await loadAdminData();
    await loadDashboardData();
    // ⭐️ (ลบออก) loadSiteSettings();
    hideLoading();
}

async function loadDashboardData() {
    dashboardSummaryDiv.innerHTML = '<p>กำลังโหลดข้อมูลสรุป...</p>';
    const result = await callApi('getAdminDashboardData');
    if (result.status === 'success') {
        statTotalVoters.textContent = result.totalVoters.toLocaleString() || '0';
        statTotalVotes.textContent = result.totalVotes.toLocaleString() || '0';

        let summaryHtml = `<p><strong>จำนวนผู้โหวตทั้งหมด:</strong> ${result.totalVoters} คน</p>`;
        summaryHtml += '<strong>ผู้โหวตแยกตามระดับชั้นและห้อง:</strong>';
        const sortedGrades = Object.keys(result.votesByGradeAndRoom).sort();
        summaryHtml += '<ul>';
        for (const grade of sortedGrades) {
            const gradeData = result.votesByGradeAndRoom[grade];
            summaryHtml += `<li><strong>${grade}</strong> (รวม ${gradeData.total} คน)`;
            const sortedRooms = Object.keys(gradeData.rooms).sort((a, b) => a - b);
            if (sortedRooms.length > 0) {
                summaryHtml += '<ul>';
                for (const room of sortedRooms) {
                    summaryHtml += `<li>ห้อง ${room}: ${gradeData.rooms[room]} คน</li>`;
                }
                summaryHtml += '</ul>';
            }
            summaryHtml += '</li>';
        }
        summaryHtml += '</ul>';
        dashboardSummaryDiv.innerHTML = summaryHtml;
    } else {
        dashboardSummaryDiv.innerHTML = '<p class="message error">ไม่สามารถโหลดข้อมูลสรุปได้</p>';
        statTotalVoters.textContent = 'Error';
        statTotalVotes.textContent = 'Error';
    }
}

async function loadAdminData() {
    const result = await callApi('getAdminData');
    if (result.status === 'success') {
        displayAdminVoteResults(result.votes);
        allUsersData = result.users;
        displayAdminUsers(allUsersData);
        displayVoteChart(result.votes);
    }
}

async function loadVoteTime() {
    // ⭐️ (ถอยกลับ) กลับไปใช้ API เดิม
    const result = await callApi('getVoteTime');
    if (result.status === 'success') {
        const display = document.getElementById('current-vote-time');
        display.textContent = (result.startTime && result.endTime) ?
            `เวลาโหวต: ${new Date(result.startTime).toLocaleString('th-TH')} - ${new Date(result.endTime).toLocaleString('th-TH')}` :
            'ยังไม่มีการตั้งเวลาโหวต';
        
        if (result.startTime) document.getElementById('voteStartTime').value = result.startTime.slice(0, 16); // ปรับ format ให้ตรง
        if (result.endTime) document.getElementById('voteEndTime').value = result.endTime.slice(0, 16); // ปรับ format ให้ตรง
    }
}

// ⭐️ (ลบออก) ฟังก์ชัน loadAnnouncement()
// ⭐️ (ลบออก) ฟังก์ชัน loadSiteSettings()

async function loadAdminAccounts() {
    const result = await callApi('getAdminAccounts');
    const tbody = document.querySelector('#adminAccountsTable tbody');
    tbody.innerHTML = '';
    if (result.status === 'success' && result.accounts.length > 0) {
        result.accounts.forEach(account => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${account[0]}</td><td>${account[2] || ''}</td>
            <td class="table-actions-cell">
                <button class="action-btn delete delete-admin-button" data-username="${account[0]}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>`;
            tbody.appendChild(tr);
        });
    }
}

function displayAdminVoteResults(votes) {
    const tbody = document.querySelector('#adminVoteResultsTable tbody');
    tbody.innerHTML = '';
    votes.sort((a, b) => b[2] - a[2]); // Sort by vote count desc
    votes.forEach(row => {
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

function displayAdminUsers(users) {
    const tbody = document.querySelector('#adminUsersTable tbody');
    tbody.innerHTML = '';
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">ไม่พบข้อมูลผู้ใช้งาน</td></tr>';
        return;
    }
    users.forEach(row => {
        const tr = document.createElement('tr');
        tr.dataset.studentId = row[0];
        tr.innerHTML = `
            <td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td>
            <td>${new Date(row[4]).toLocaleString('th-TH')}</td>
            <td>${row[5]}</td>
            <td class="table-actions-cell">
                <button class="action-btn delete delete-user-button" title="Delete"><i class="fas fa-trash"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function filterAndSearchUsers() {
    const selectedGrade = gradeFilterSelect.value;
    const searchTerm = userSearchInput.value.toLowerCase().trim();
    const filteredUsers = allUsersData.filter(user => {
        const gradeMatch = selectedGrade === 'all' || user[2] === selectedGrade;
        const searchMatch = user[0].toLowerCase().includes(searchTerm) || user[1].toLowerCase().includes(searchTerm);
        return gradeMatch && searchMatch;
    });
    displayAdminUsers(filteredUsers);
}

/* === [ JS: app.js (ดัดแปลง) + auth.js (รวม) + Logic เก่า ] === */
document.addEventListener('DOMContentLoaded', () => {
    const loginPage = document.getElementById('login-page');
    const mainDashboard = document.getElementById('main-dashboard');
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const loginMessage = document.getElementById('login-message');

    // ⭐️ (ลบออก) loadSiteSettings();

    // --- 1. ระบบ Login (จาก auth.js + ระบบเก่า) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        if(!username || !password) {
            loginMessage.textContent = 'กรุณากรอก Username และ Password';
            loginMessage.className = 'message error';
            return;
        }
        loginMessage.textContent = 'กำลังเข้าสู่ระบบ...';
        loginMessage.className = 'message loading';
        loginButton.disabled = true;

        const result = await callApi('login', { username, password });
        
        if (result.status === 'success') {
            currentAdminUser = username;
            loginMessage.textContent = 'เข้าสู่ระบบสำเร็จ!';
            loginMessage.className = 'message success';
            
            // อัปเดตชื่อ Admin
            document.getElementById('admin-profile-name').textContent = result.fullName || username;
            document.getElementById('welcome-message').textContent = `ยินดีต้อนรับคุณ ${result.fullName || username}!`;

            // ซ่อนหน้า Login และแสดง Dashboard
            setTimeout(() => {
                loginPage.style.display = 'none';
                mainDashboard.style.display = 'flex';
                // เริ่มต้นการทำงานของ Dashboard
                initializeApp();
            }, 1000);
        } else {
            loginMessage.textContent = result.message;
            loginMessage.className = 'message error';
            loginButton.disabled = false;
        }
    });

    // --- 2. ฟังก์ชันเริ่มต้นการทำงาน (จาก app.js) ---
    function initializeApp() {
        // โหลดข้อมูลทั้งหมดเป็นครั้งแรก
        loadAllAdminData();
        // ⭐️ (ลบออก) loadSiteSettings();

        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
        }
        // Mobile toggle
        const mobileToggle = document.getElementById('mobileToggle');
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
        }
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                storage.set('theme', newTheme);
                const icon = themeToggle.querySelector('i');
                if (newTheme === 'dark') { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); }
                else { icon.classList.remove('fa-sun'); icon.classList.add('fa-moon'); }
            });
            const savedTheme = storage.get('theme');
            if (savedTheme) {
                document.documentElement.setAttribute('data-theme', savedTheme);
                const icon = themeToggle.querySelector('i');
                if (savedTheme === 'dark') { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); }
            }
        }
        // User dropdown
        const userMenu = document.querySelector('.user-menu .user-avatar');
        const userDropdown = document.getElementById('userDropdown');
        const userMenuContainer = document.querySelector('.user-menu');
        if (userMenu && userDropdown) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });
            if (userMenuContainer) { userMenuContainer.addEventListener('click', (e) => e.stopPropagation()); }
            document.addEventListener('click', (e) => {
                if (!userMenuContainer.contains(e.target)) { userDropdown.classList.remove('active'); }
            });
        }
        // Logout Button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                currentAdminUser = '';
                mainDashboard.style.display = 'none';
                loginPage.style.display = 'flex';
                loginForm.reset();
                loginMessage.textContent = '';
                loginMessage.className = 'message';
                loginButton.disabled = false;
            });
        }
        // Navigation links
        document.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageName = link.getAttribute('data-page');
                navigateToPage(pageName);
            });
        });
        // Modal close buttons
        document.querySelectorAll('[data-modal]').forEach(btn => {
            btn.addEventListener('click', () => closeModal(btn.getAttribute('data-modal')));
        });
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) { modal.classList.remove('active'); }
            });
        });
        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (sidebar && mobileToggle && !sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            }
        });

        // --- 3. เชื่อมต่อ Event Listeners (จากระบบเก่า) ---
        document.getElementById('refreshDataButton').addEventListener('click', () => {
            showToast('กำลังรีเฟรชข้อมูล...', 'info');
            loadAllAdminData().then(() => showToast('ข้อมูลอัปเดตแล้ว!', 'success'));
        });
        gradeFilterSelect.addEventListener('change', filterAndSearchUsers);
        userSearchInput.addEventListener('input', filterAndSearchUsers);
        
        // --- ตั้งค่าระบบ (Settings Page) ---
        
        // ⭐️ (ลบออก) 'saveSiteSettingsButton' listener
        // ⭐️ (ลบออก) 'saveAnnouncementButton' listener
        
        document.getElementById('setVoteTimeButton').addEventListener('click', async () => {
            const startTime = document.getElementById('voteStartTime').value;
            const endTime = document.getElementById('voteEndTime').value;
            if (!startTime || !endTime) { showToast('กรุณาเลือกเวลาเริ่มต้นและสิ้นสุด', 'warning'); return; }
            showLoading();
            const result = await callApi('updateVoteTime', { startTime, endTime });
            hideLoading();
            if (result.status === 'success') { showToast('ตั้งเวลาสำเร็จ!', 'success'); loadVoteTime(); }
            else { showToast(result.message, 'error'); }
        });
        document.getElementById('closeVotingNowButton').addEventListener('click', () => {
            Swal.fire({ title: 'ยืนยันการปิดโหวต?', text: "คุณต้องการปิดรับการโหวตทั้งหมดทันทีใช่ไหม?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ใช่, ปิดทันที!', cancelButtonText: 'ยกเลิก'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const apiResult = await callApi('closeVotingNow');
                    if (apiResult.status === 'success') { showToast('ปิดการโหวตเรียบร้อยแล้ว', 'success'); loadVoteTime(); } else { showToast(apiResult.message, 'error'); }
                }
            });
        });
        document.getElementById('addAdminButton').addEventListener('click', async () => {
            const username = document.getElementById('newAdminUsername').value.trim();
            const password = document.getElementById('newAdminPassword').value.trim();
            const fullName = document.getElementById('newAdminFullName').value.trim();
            if (!username || !password || !fullName) { showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning'); return; }
            const result = await callApi('addAdminAccount', { username, password, fullName });
            if (result.status === 'success') {
                showToast('เพิ่มบัญชีสำเร็จ!', 'success');
                loadAdminAccounts();
                document.getElementById('newAdminUsername').value = '';
                document.getElementById('newAdminPassword').value = '';
                document.getElementById('newAdminFullName').value = '';
            } else { showToast(result.message, 'error'); }
        });
        
        // ⭐️ (ใหม่) ปุ่มคำนวณคะแนนใหม่
        document.getElementById('recalculateVotesButton').addEventListener('click', () => {
            Swal.fire({
                title: 'ยืนยันการคำนวณคะแนนใหม่?',
                text: "ระบบจะนับคะแนนใหม่ทั้งหมดจากชีตรายชื่อนักเรียน (Master_Students) เพื่อให้แน่ใจว่าผลโหวตถูกต้อง",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#f59e0b',
                confirmButtonText: 'ใช่, คำนวณใหม่!',
                cancelButtonText: 'ยกเลิก'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    showLoading();
                    const apiResult = await callApi('recalculateVotes');
                    hideLoading();
                    if(apiResult.status === 'success') {
                        showToast(apiResult.message, 'success');
                        loadAllAdminData(); 
                    } else {
                        showToast(apiResult.message, 'error');
                    }
                }
            });
        });

        document.getElementById('resetVotesButton').addEventListener('click', () => {
            Swal.fire({ title: 'ยืนยันการรีเซ็ตคะแนน?', text: "การกระทำนี้จะลบคะแนนโหวตทั้งหมด (ตั้งเป็น 0) และไม่สามารถย้อนกลับได้!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'ใช่, รีเซ็ตเลย!', cancelButtonText: 'ยกเลิก'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    showLoading();
                    const apiResult = await callApi('resetVotes');
                    hideLoading();
                    if(apiResult.status === 'success') { showToast(apiResult.message, 'success'); loadAllAdminData(); } else { showToast(apiResult.message, 'error'); }
                }
            });
        });
        document.getElementById('clearUsersButton').addEventListener('click', () => {
            Swal.fire({ title: 'ยืนยันการล้างข้อมูลผู้ใช้?', text: "ข้อมูลผู้โหวตทั้งหมดในชีต Master_Students จะถูกล้างสถานะและไม่สามารถย้อนกลับได้!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'ใช่, ล้างข้อมูล!', cancelButtonText: 'ยกเลิก'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    showLoading();
                    const apiResult = await callApi('clearUsers');
                    hideLoading();
                    if(apiResult.status === 'success') { showToast(apiResult.message, 'success'); loadAllAdminData(); } else { showToast(apiResult.message, 'error'); }
                }
            });
        });

        // ⭐️ (ใหม่) Import CSV (Settings Page)
        document.getElementById('uploadCsvButton').addEventListener('click', () => {
            const fileInput = document.getElementById('csvFile');
            const file = fileInput.files[0];
            const uploadMessage = document.getElementById('upload-csv-message');

            if (!file) {
                uploadMessage.textContent = 'กรุณาเลือกไฟล์ .csv ก่อนครับ';
                uploadMessage.className = 'message error';
                return;
            }

            Swal.fire({
                title: 'ยืนยันการ Import ข้อมูล?',
                text: "ข้อมูลนักเรียนเก่าทั้งหมดจะถูกลบ และแทนที่ด้วยข้อมูลจากไฟล์นี้! การกระทำนี้ย้อนกลับไม่ได้",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'ใช่, ลบและ Import ใหม่!',
                cancelButtonText: 'ยกเลิก'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    showLoading();
                    uploadMessage.textContent = 'กำลังอ่านไฟล์...';
                    uploadMessage.className = 'message loading';

                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        try {
                            const base64String = e.target.result.split(',')[1];
                            uploadMessage.textContent = 'กำลังอัปโหลดและประมวลผล...';
                            const apiResult = await callApi('importStudents', { base64Data: base64String });
                            hideLoading();

                            if(apiResult.status === 'success') {
                                uploadMessage.textContent = apiResult.message;
                                uploadMessage.className = 'message success';
                                showToast('Import สำเร็จ!', 'success');
                                loadAdminData(); 
                            } else {
                                uploadMessage.textContent = 'ผิดพลาด: ' + apiResult.message;
                                uploadMessage.className = 'message error';
                                showToast(apiResult.message, 'error');
                            }
                        } catch (err) {
                            hideLoading();
                            uploadMessage.textContent = 'เกิดข้อผิดพลาดในการอ่านไฟล์: ' + err.message;
                            uploadMessage.className = 'message error';
                        }
                    };
                    reader.onerror = () => {
                        hideLoading();
                        uploadMessage.textContent = 'ไม่สามารถอ่านไฟล์ได้';
                        uploadMessage.className = 'message error';
                    };
                    reader.readAsDataURL(file);
                }
            });
        });
        
        // --- ข้อมูลผู้โหวต (Users Page) ---
        document.getElementById('exportUsersPdfButton').addEventListener('click', async () => {
            showLoading();
            const result = await callApi('exportPdf', { dataType: 'users' });
            hideLoading();
            if (result.status === 'success') {
                Swal.fire({ title: 'สร้างไฟล์สำเร็จ!', html: `<a href="${result.pdfUrl}" target="_blank" rel="noopener noreferrer">คลิกที่นี่เพื่อเปิด PDF</a>`, icon: 'success', showConfirmButton: true });
            } else { showToast(result.message, 'error'); }
        });
        document.querySelector('#adminUsersTable tbody').addEventListener('click', async (event) => {
            const target = event.target.closest('.delete-user-button');
            if (!target) return;
            const row = target.closest('tr');
            const studentId = row.dataset.studentId;
            Swal.fire({ title: 'ยืนยันการลบ?', text: `คุณต้องการลบข้อมูลของนักเรียนรหัส '${studentId}' ใช่ไหม? (คะแนนโหวตจะไม่ลดตามอัตโนมัติ ให้ใช้ปุ่ม 'คำนวณคะแนนใหม่' เพื่ออัปเดต)`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const apiResult = await callApi('deleteUser', { studentId: studentId });
                    if (apiResult.status === 'success') { showToast(apiResult.message, 'success'); loadAllAdminData(); } else { showToast(apiResult.message, 'error'); }
                }
            });
        });
        document.querySelector('#adminAccountsTable tbody').addEventListener('click', (e) => {
            const target = e.target.closest('.delete-admin-button');
            if(!target) return;
            const username = target.dataset.username;
            Swal.fire({ title: 'แน่ใจหรือไม่?', text: `คุณต้องการลบบัญชี '${username}' จริงๆ ใช่ไหม`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const delResult = await callApi('deleteAdminAccount', { usernameToDelete: username });
                    if (delResult.status === 'success') { showToast(delResult.message, 'success'); loadAdminAccounts(); }
                    else { showToast(delResult.message, 'error'); }
                }
            });
        });

        // --- จัดการแบบเสื้อ (Products Page) ---
        document.getElementById('addDesignBtn').addEventListener('click', () => {
            document.getElementById('designForm').reset();
            document.getElementById('designModalTitle').textContent = 'เพิ่มแบบเสื้อใหม่';
            document.getElementById('editMode').value = 'false';
            document.getElementById('designIdInput').disabled = false;
            openModal('designModal');
        });
        
        document.querySelector('#adminVoteResultsTable tbody').addEventListener('click', async (event) => {
            const target = event.target.closest('button');
            if (!target) return;
            const row = target.closest('tr');
            const designId = row.dataset.designId;

            if (target.classList.contains('edit-design-button')) {
                document.getElementById('designForm').reset();
                document.getElementById('designModalTitle').textContent = 'แก้ไขแบบเสื้อ';
                document.getElementById('editMode').value = 'true';
                document.getElementById('editDesignIdHidden').value = designId;
                
                document.getElementById('designIdInput').value = designId;
                document.getElementById('designIdInput').disabled = true; // ห้ามแก้ ID
                document.getElementById('designNameInput').value = row.dataset.designName;
                document.getElementById('designImageUrlInput').value = row.dataset.imageUrl;
                
                openModal('designModal');
            }
            if (target.classList.contains('delete-design-button')) {
                Swal.fire({ title: 'ยืนยันการลบ?', text: `คุณต้องการลบแบบเสื้อ '${designId}' ใช่ไหม? (คะแนนที่โหวตให้แบบนี้ไปแล้วจะค้างอยู่ ควรใช้ปุ่ม 'คำนวณคะแนนใหม่' หลังลบ)`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        const apiResult = await callApi('deleteDesign', { designId: designId });
                        if (apiResult.status === 'success') { showToast(apiResult.message, 'success'); loadAdminData(); } else { showToast(apiResult.message, 'error'); }
                    }
                });
            }
        });
        
        // ฟอร์มใน Modal (สำหรับ Add/Edit)
        document.getElementById('designForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const isEditMode = document.getElementById('editMode').value === 'true';
            const id = isEditMode ? document.getElementById('editDesignIdHidden').value : document.getElementById('designIdInput').value.trim().toUpperCase();
            const name = document.getElementById('designNameInput').value.trim();
            const imageUrl = document.getElementById('designImageUrlInput').value.trim();

            if (!id || !name) { showToast('กรุณากรอก Design ID และชื่อแบบเสื้อ', 'warning'); return; }

            showLoading();
            const action = isEditMode ? 'editDesign' : 'addDesign';
            const data = { designId: id, designName: name, imageUrl: imageUrl };
            
            const result = await callApi(action, data);
            hideLoading();

            if (result.status === 'success') {
                showToast(result.message, 'success');
                closeModal('designModal');
                loadAdminData();
            } else {
                showToast(result.message, 'error');
            }
        });
    }
});

// --- Navigation (จาก app.js) ---
function navigateToPage(pageName) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  const targetPage = document.getElementById(`${pageName}-page`);
  if (targetPage) targetPage.classList.add('active');

  document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
  const activeLink = document.querySelector(`[data-page="${pageName}"]`);
  if (activeLink) activeLink.parentElement.classList.add('active');

  // โหลดข้อมูลเฉพาะเมื่อหน้านั้นถูกเปิด
  switch (pageName) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'products':
      loadAdminData();
      break;
    case 'users':
      loadAdminData();
      break;
    case 'settings':
      loadVoteTime();
      loadAdminAccounts();
      // ⭐️ (ลบออก) loadAnnouncement();
      // ⭐️ (ลบออก) loadSiteSettings();
      break;
  }
}
// Modal Functions (จาก app.js)
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}
