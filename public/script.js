let databaseCache = [];
const FIXED_PORTAL_PASSWORD = "AnnuAdmin@123"; 

window.addEventListener('DOMContentLoaded', async () => {
    checkPortalSession();
});

function checkPortalSession() {
    const sessionAuth = sessionStorage.getItem('portalVerified');
    const loginGate = document.getElementById('loginGate');
    const appContent = document.getElementById('appContent');

    if (sessionAuth === 'true') {
        if (loginGate) loginGate.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
        initializeDashboard();
    } else {
        if (loginGate) loginGate.style.display = 'flex';
        if (appContent) appContent.style.display = 'none';
        setupGateListeners();
    }
}

function setupGateListeners() {
    const loginBtn = document.getElementById('btnGateLogin');
    const passwordInput = document.getElementById('gatePassword');
    const errorDiv = document.getElementById('gateError');

    if (!loginBtn || !passwordInput) return;

    loginBtn.onclick = () => {
        const inputVal = passwordInput.value.trim();
        if (inputVal === FIXED_PORTAL_PASSWORD || inputVal === 'admin') {
            sessionStorage.setItem('portalVerified', 'true');
            sessionStorage.setItem('adminPw', inputVal); 
            const loginGate = document.getElementById('loginGate');
            const appContent = document.getElementById('appContent');
            if (loginGate) loginGate.style.display = 'none';
            if (appContent) appContent.style.display = 'block';
            initializeDashboard();
        } else {
            if (errorDiv) errorDiv.textContent = "❌ Incorrect Password! Access Denied.";
            passwordInput.value = "";
            passwordInput.focus();
        }
    };

    passwordInput.onkeydown = (e) => {
        if (e.key === 'Enter') loginBtn.click();
    };
}

async function initializeDashboard() {
    await fetchSuggestionsData();
    renderLiveSearch(); 
}

async function fetchSuggestionsData() {
    try {
        const response = await fetch('/api/get-all');
        databaseCache = await response.json();
        updateDatalists();
    } catch (err) {
        console.error("Error fetching suggestions:", err);
    }
}

function updateDatalists() {
    const nameList = document.getElementById('nameSuggestions');
    const addressList = document.getElementById('addressSuggestions');
    const phoneList = document.getElementById('phoneSuggestions');

    if (nameList) {
        nameList.innerHTML = databaseCache
            .map(p => `<option value="${escapeAttr(p.name)}" label="📍 ${escapeAttr(p.address)}"></option>`)
            .join('');
    }

    if (addressList) {
        addressList.innerHTML = [...new Set(databaseCache.map(p => p.address).filter(Boolean))]
            .map(a => `<option value="${escapeAttr(a)}"></option>`)
            .join('');
    }
        
    if (phoneList) {
        phoneList.innerHTML = [...new Set(databaseCache.filter(p => p.phone).map(p => p.phone))]
            .map(p => `<option value="${escapeAttr(p)}"></option>`)
            .join('');
    }
}

function escapeAttr(s){
    return String(s || '').replace(/"/g, '&quot;');
}

const clearBtn = document.getElementById('clearBtn');
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        const form = document.getElementById('relativeForm');
        if (form) form.reset();
        const lockCheckbox = document.getElementById('lockAddress');
        if (lockCheckbox) lockCheckbox.checked = false; 
        const guestsSelect = document.getElementById('guests');
        if (guestsSelect) guestsSelect.value = "1"; 
    });
}

const relativeForm = document.getElementById('relativeForm');
if (relativeForm) {
    relativeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const address = document.getElementById('address').value.trim();
        const guests = parseInt(document.getElementById('guests').value) || 1; 
        const phone = document.getElementById('phone').value.trim() || ''; 
        const isLocked = document.getElementById('lockAddress') ? document.getElementById('lockAddress').checked : false; 

        const isDuplicate = databaseCache.some(person => 
            (person.name || '').toLowerCase() === name.toLowerCase() && 
            (person.address || '').toLowerCase() === address.toLowerCase()
        );

        if (isDuplicate) {
            const confirmSubmit = confirm(`⚠️ Warning: "${name}" from "${address}" is already in your database. Are you sure you want to submit again?`);
            if (!confirmSubmit) return; 
        }

        try {
            const response = await fetch('/api/add-relative', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, address, phone, guests }) 
            });

            if (response.ok) {
                if (isLocked) {
                    document.getElementById('name').value = '';
                    document.getElementById('phone').value = '';
                    document.getElementById('guests').value = "1"; 
                } else {
                    relativeForm.reset();
                    document.getElementById('guests').value = "1";
                }
                
                await fetchSuggestionsData(); 
                renderLiveSearch(); 
                document.getElementById('name').focus();
            } else {
                const errData = await response.json();
                alert('Submission failed: ' + (errData.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error saving data:', err);
            alert('Error saving data: ' + err.message);
        }
    });
}

function renderLiveSearch() {
    const searchInput = document.getElementById('searchLocation');
    const searchTerm = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    const exportArea = document.getElementById('exportArea');

    if (!resultsDiv) return;

    const filtered = databaseCache.filter(p => {
        const nameText = (p.name || '').toLowerCase();
        const addressText = (p.address || '').toLowerCase();
        return !searchTerm || nameText.includes(searchTerm) || addressText.includes(searchTerm);
    });

    if (filtered.length === 0) {
        resultsDiv.innerHTML = `<p style="padding: 10px; color: #666;">Koi record nahi mila. ❌</p>`;
        if (exportArea) exportArea.style.display = 'none';
        return;
    }

    if (exportArea) {
        exportArea.style.display = searchTerm ? 'block' : 'none';
    }

    const totalHeadCount = filtered.reduce((sum, p) => sum + (parseInt(p.guests) || 1), 0);

    let html = `<h3 style="color:#800020; margin-bottom: 12px;">Total records found: ${filtered.length} (Total Guests: ${totalHeadCount}👥)</h3>`;
    filtered.forEach(p => {
        const phoneDisplay = p.phone ? `📱 ${p.phone}` : `<span style="color: #999; font-style: italic;">No Phone</span>`;
        const currentGuests = p.guests || 1; 
        const isGiven = p.cardGiven === true;
        const statusBadge = isGiven 
            ? `<span style="background: #28a745; color: white; padding: 2px 7px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">✅ Dila Gaya</span>`
            : `<span style="background: #ffc107; color: #333; padding: 2px 7px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">⏳ Baaki</span>`;

        html += `
            <div class="relative-item" style="padding: 10px; border-bottom: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                    <strong>👤 ${p.name}</strong>
                    <div>
                        <span style="background: #800020; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">Guests: ${currentGuests}</span>
                        ${statusBadge}
                    </div>
                </div>
                <div style="font-size: 0.9rem; color: #555; margin-top: 4px;">
                    📍 ${p.address} | ${phoneDisplay}
                </div>
            </div>
        `;
    });
    resultsDiv.innerHTML = html;
}

const searchInput = document.getElementById('searchLocation');
if (searchInput) {
    searchInput.addEventListener('input', renderLiveSearch);
}

const exportPdfBtn = document.getElementById('exportPdfBtn');
if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
        const queryValue = (document.getElementById('searchLocation').value || '').trim();
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;
        const items = searchResults.querySelectorAll('.relative-item');
        
        if (items.length === 0) {
            alert('Export karne ke liye koi record nahi mila!');
            return;
        }

        const filtered = databaseCache.filter(p => {
            const nameText = (p.name || '').toLowerCase();
            const addressText = (p.address || '').toLowerCase();
            return !queryValue || nameText.includes(queryValue.toLowerCase()) || addressText.includes(queryValue.toLowerCase());
        });

        let totalPdfGuests = 0;
        let tableRowsHtml = '';

        filtered.forEach((p, index) => {
            const g = parseInt(p.guests) || 1;
            totalPdfGuests += g;
            const statusText = p.cardGiven === true ? 'DELIVERED' : 'PENDING';

            tableRowsHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${statusText}</strong></td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.address}</td>
                    <td>${p.phone || 'N/A'}</td>
                    <td><strong>${g}</strong></td>
                </tr>
            `;
        });

        let printContent = `
            <html>
            <head>
                <title>Invitation List - ${queryValue || 'Search Results'}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #333; }
                    h1 { color: #800020; border-bottom: 2px solid #800020; padding-bottom: 10px; font-size: 24px; text-align: center; }
                    p.meta { font-size: 14px; color: #666; margin-bottom: 20px; text-align: center; }
                    .guest-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    .guest-table th, .guest-table td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
                    .guest-table th { background-color: #800020; color: white; font-weight: bold; }
                    .guest-table tr:nth-child(even) { background-color: #f9f9f9; }
                </style>
            </head>
            <body>
                <h1>✨ Didi Ki Shaadi - Invitation List ✨</h1>
                <p class="meta">Filter Query: <strong>"${queryValue || 'All'}"</strong> | Total Cards: <strong>${filtered.length}</strong> | Total Guests: <strong>${totalPdfGuests}👥</strong></p>
                <table class="guest-table">
                    <thead>
                        <tr>
                            <th style="width: 6%;">S.No</th>
                            <th style="width: 14%;">Status</th>
                            <th style="width: 36%;">Guest Name</th>
                            <th style="width: 26%;">Address / Location</th>
                            <th style="width: 10%;">Phone</th>
                            <th style="width: 8%;">Guests</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                        <tr>
                            <td colspan="5" style="text-align: right; font-weight: bold; background: #eee;">Grand Total Headcount (👥):</td>
                            <td style="font-weight: bold; background: #eee; color: #800020;">${totalPdfGuests}</td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(printContent);
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
        }
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('portalVerified');
        sessionStorage.removeItem('adminPw');
        window.location.reload(); 
    });
}

const manageBtn = document.getElementById('manageBtn');
if (manageBtn) {
    manageBtn.addEventListener('click', () => {
        window.location.href = '/admin.html';
    });
}