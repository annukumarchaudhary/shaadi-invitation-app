let databaseCache = [];
const FIXED_PORTAL_PASSWORD = "AnnuAdmin@123"; // ✨ Aapka set kiya hua Portal password check

// ✨ Initialization authentication verification hook sequence
window.addEventListener('DOMContentLoaded', async () => {
    checkPortalSession();
});

// Verification block layout execution logic
function checkPortalSession() {
    const sessionAuth = sessionStorage.getItem('portalVerified');
    const loginGate = document.getElementById('loginGate');
    const appContent = document.getElementById('appContent');

    if (sessionAuth === 'true') {
        // If already validated, remove gate sheet and load database collection context
        loginGate.style.display = 'none';
        appContent.style.display = 'block';
        initializeDashboard();
    } else {
        // If unauthenticated, freeze viewport inside gate form
        loginGate.style.display = 'flex';
        appContent.style.display = 'none';
        setupGateListeners();
    }
}

function setupGateListeners() {
    const loginBtn = document.getElementById('btnGateLogin');
    const passwordInput = document.getElementById('gatePassword');
    const errorDiv = document.getElementById('gateError');

    // Trigger on verification click handler
    loginBtn.onclick = () => {
        const inputVal = passwordInput.value.trim();
        if (inputVal === FIXED_PORTAL_PASSWORD) {
            sessionStorage.setItem('portalVerified', 'true');
            sessionStorage.setItem('adminPw', inputVal); // Direct synchronization context with admin panel session memory
            document.getElementById('loginGate').style.display = 'none';
            document.getElementById('appContent').style.display = 'block';
            initializeDashboard();
        } else {
            errorDiv.textContent = "❌ Incorrect Password! Access Denied.";
            passwordInput.value = "";
            passwordInput.focus();
        }
    };

    // Support enter key execution inside password input field container element
    passwordInput.onkeydown = (e) => {
        if (e.key === 'Enter') loginBtn.click();
    };
}

// Global invocation setup triggers once token passes authorization validation pipeline
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

    nameList.innerHTML = [...new Set(databaseCache.map(p => p.name))].map(n => `<option value="${n}">`).join('');
    addressList.innerHTML = [...new Set(databaseCache.map(p => p.address))].map(a => `<option value="${a}">`).join('');
    phoneList.innerHTML = [...new Set(databaseCache.filter(p => p.phone).map(p => p.phone))].map(p => `<option value="${p}">`).join('');
}

document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('relativeForm').reset();
    document.getElementById('lockAddress').checked = false; 
    document.getElementById('guests').value = "1"; 
});

document.getElementById('relativeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const address = document.getElementById('address').value.trim();
    const guests = parseInt(document.getElementById('guests').value) || 1; 
    const phone = document.getElementById('phone').value.trim() || ''; 
    const isLocked = document.getElementById('lockAddress').checked; 

    const isDuplicate = databaseCache.some(person => 
        person.name.toLowerCase() === name.toLowerCase() && 
        person.address.toLowerCase() === address.toLowerCase()
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
                document.getElementById('relativeForm').reset();
                document.getElementById('guests').value = "1";
            }
            
            await fetchSuggestionsData(); 
            renderLiveSearch(); 
            document.getElementById('name').focus();
        }
    } catch (err) {
        console.error('Error saving data:', err);
    }
});

function renderLiveSearch() {
    const searchTerm = (document.getElementById('searchLocation').value || '').trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    const exportArea = document.getElementById('exportArea');

    const filtered = databaseCache.filter(p => {
        const nameText = (p.name || '').toLowerCase();
        const addressText = (p.address || '').toLowerCase();
        return !searchTerm || nameText.includes(searchTerm) || addressText.includes(searchTerm);
    });

    if (filtered.length === 0) {
        resultsDiv.innerHTML = `<p>Koi record nahi mila. ❌</p>`;
        if (exportArea) exportArea.style.display = 'none';
        return;
    }

    if (exportArea) {
        exportArea.style.display = searchTerm ? 'block' : 'none';
    }

    const totalHeadCount = filtered.reduce((sum, p) => sum + (parseInt(p.guests) || 1), 0);

    let html = `<h3>Total records found: ${filtered.length} (Total Guests Headcount: ${totalHeadCount}👥)</h3>`;
    filtered.forEach(p => {
        const phoneDisplay = p.phone ? `📱 ${p.phone}` : `<span style="color: #999; font-style: italic;">No Phone</span>`;
        const currentGuests = p.guests || 1; 
        html += `
            <div class="relative-item">
                <strong>👤 ${p.name}</strong> - ${phoneDisplay} <span style="background: #800020; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-left: 8px;">Guests: ${currentGuests}</span><br>
                <small>📍 ${p.address}</small>
            </div>
        `;
    });
    resultsDiv.innerHTML = html;
}

document.getElementById('searchLocation').addEventListener('input', renderLiveSearch);

// Export PDF directly to stream
const exportPdfBtn = document.getElementById('exportPdfBtn');
if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
        const queryValue = document.getElementById('searchLocation').value.trim();
        const items = document.querySelectorAll('.results-container .relative-item');
        
        if (items.length === 0) return;

        let printContent = `
            <html>
            <head>
                <title>Invitation List - ${queryValue}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #333; }
                    h1 { color: #800020; border-bottom: 2px solid #800020; padding-bottom: 10px; font-size: 24px; text-align: center; }
                    p.meta { font-size: 14px; color: #666; margin-bottom: 20px; text-align: center; }
                    .guest-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    .guest-table th, .guest-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    .guest-table th { background-color: #800020; color: white; font-weight: bold; }
                    .guest-table tr:nth-child(even) { background-color: #f9f9f9; }
                </style>
            </head>
            <body>
                <h1>✨ Didi Ki Shaadi - Invitation List ✨</h1>
                <p class="meta">Live Filter Query: <strong>"${queryValue}"</strong> | Total Card Entries: <strong>${items.length}</strong></p>
                <table class="guest-table">
                    <thead>
                        <tr>
                            <th style="width: 8%;">S.No</th>
                            <th style="width: 42%;">Guest Name</th>
                            <th style="width: 25%;">Address / Location</th>
                            <th style="width: 15%;">Phone Number</th>
                            <th style="width: 10%;">Guests Count</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let totalPdfGuests = 0;
        items.forEach((item, index) => {
            const strongText = item.querySelector('strong').textContent;
            const nameText = strongText.replace('👤 ', '').split(' - ')[0];
            const phoneText = strongText.includes('📱') ? strongText.split('📱 ')[1] : 'N/A';
            const addressText = item.querySelector('small').textContent.replace('📍 ', '');
            const guestText = item.querySelector('span') ? parseInt(item.querySelector('span').textContent.replace('Guests: ', '')) : 1;
            totalPdfGuests += guestText;

            printContent += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${nameText}</strong></td>
                    <td>${addressText}</td>
                    <td>${phoneText}</td>
                    <td><strong>${guestText}</strong></td>
                </tr>
            `;
        });

        printContent += `
                    <tr>
                        <td colspan="4" style="text-align: right; font-weight: bold; background: #eee;">Grand Total Headcount (👥):</td>
                        <td style="font-weight: bold; background: #eee; color: #800020;">${totalPdfGuests}</td>
                    </tr>
                </tbody>
            </table>
            </body></html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    });
}

// Logout session reset configuration handler button interaction 
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('portalVerified');
    sessionStorage.removeItem('adminPw');
    window.location.reload(); // Refresh viewport layout state to close active hooks
});

// Manage button routing pipeline handler
document.getElementById('manageBtn').addEventListener('click', () => {
    window.location.href = '/admin.html';
});