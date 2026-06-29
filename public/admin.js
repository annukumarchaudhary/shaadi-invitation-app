let currentData = []; 
let isEditingMode = false; 
let selectedVillages = new Set(); // Tracks currently checked villages matrix

async function api(path, opts={}){
  const pw = sessionStorage.getItem('adminPw') || '';
  const headers = Object.assign({'Content-Type':'application/json'}, opts.headers || {});
  if (pw) headers['x-admin-password'] = pw;
  
  const res = await fetch(path, Object.assign({}, opts, {headers}));
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

function setStatus(msg){document.getElementById('status').textContent = msg}

async function load(){
  try{
    if(isEditingMode) {
      isEditingMode = false;
      toggleEditModeUI();
    }
    setStatus('Loading...');
    currentData = await api('/rsvps'); 
    
    // Generate dynamic checkboxes based on legacy and live entries stream
    renderVillageCheckboxes();
    applySortAndRender(); 
  }catch(err){
    setStatus('Error: ' + err.message);
  }
}

// ✨ NEW: Dynamic creation engine for unique village checkbox layout matrices
function renderVillageCheckboxes() {
  const gridContainer = document.getElementById('villageFilterGrid');
  if (!currentData || currentData.length === 0) {
    gridContainer.innerHTML = '<p style="color:#999; font-size:13px; margin:5px 0 0 0;">No locations found.</p>';
    return;
  }

  // Extract clean unique address records and sort them alphabetically (A-Z)
  const uniqueAddresses = [...new Set(currentData.map(r => (r.attending || '').trim()))]
    .filter(addr => addr.length > 0)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  gridContainer.innerHTML = '';
  uniqueAddresses.forEach(addr => {
    const label = document.createElement('label');
    label.className = 'village-item';
    
    const isChecked = selectedVillages.has(addr.toLowerCase());
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(addr)}" ${isChecked ? 'checked' : ''}>
      <span>${escapeHtml(addr)}</span>
    `;

    // Attach real-time filter toggle sequence mapping configuration
    label.querySelector('input').addEventListener('change', (e) => {
      const lowerAddr = e.target.value.toLowerCase();
      if (e.target.checked) {
        selectedVillages.add(lowerAddr);
      } else {
        selectedVillages.delete(lowerAddr);
      }
      applySortAndRender();
    });

    gridContainer.appendChild(label);
  });
}

function applySortAndRender() {
  if (!currentData || currentData.length === 0) {
    document.querySelector('#list tbody').innerHTML = '';
    setStatus('Loaded 0 Entries | Total Guests: 0👥');
    return;
  }

  const sortBy = document.getElementById('sortBySelect').value;
  const sortDir = document.getElementById('sortDirBtn').getAttribute('data-dir'); 
  const searchInputVal = (document.getElementById('adminSearchInput').value || '').trim().toLowerCase(); 

  // Sort mechanism logic
  currentData.sort((a, b) => {
    let fieldA = '', fieldB = '';
    if (sortBy === 'name') {
      fieldA = (a.name || '').toString().toLowerCase();
      fieldB = (b.name || '').toString().toLowerCase();
    } else if (sortBy === 'address') {
      fieldA = (a.attending || '').toString().toLowerCase(); 
      fieldB = (b.attending || '').toString().toLowerCase();
    } else if (sortBy === 'date') {
      fieldA = (a.id || '').toString(); 
      fieldB = (b.id || '').toString();
    }
    if (fieldA < fieldB) return sortDir === 'asc' ? -1 : 1;
    if (fieldA > fieldB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const searchTokens = searchInputVal.split(/\s+/).filter(token => token.length > 0);

  // ✨ COMPREHENSIVE INTERSECTION: Filters via selected checkboxes AND space-separated strings
  const filteredData = currentData.filter(r => {
    const rowAddressLower = (r.attending || '').trim().toLowerCase();
    
    // 1. Checkbox validation loop layer
    if (selectedVillages.size > 0 && !selectedVillages.has(rowAddressLower)) {
      return false;
    }
    
    // 2. Space separated string tokens validation layer
    if (searchTokens.length > 0) {
      const combinedTargetText = `${r.name || ''} ${r.attending || ''}`.toLowerCase();
      return searchTokens.every(token => combinedTargetText.includes(token));
    }
    
    return true;
  });

  const totalMasterGuests = currentData.reduce((sum, r) => sum + (parseInt(r.guests) || 1), 0);
  const totalFilteredGuests = filteredData.reduce((sum, r) => sum + (parseInt(r.guests) || 1), 0);

  const tbody = document.querySelector('#list tbody');
  tbody.innerHTML = '';
  
  filteredData.forEach(r => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', r.id); 
    
    if (isEditingMode) {
      let optionsHtml = '';
      for (let i = 1; i <= 15; i++) {
        optionsHtml += `<option value="${i}" ${parseInt(r.guests) === i ? 'selected' : ''}>${i}</option>`;
      }
      
      tr.innerHTML = `
        <td><input type="text" class="inline-edit-input edit-name" value="${escapeHtml(r.name)}"></td>
        <td><input type="text" class="inline-edit-input edit-address" value="${escapeHtml(r.attending)}"></td>
        <td>
          <select class="inline-edit-input edit-guests">${optionsHtml}</select>
        </td>
        <td><input type="text" class="inline-edit-input edit-phone" value="${r.message === 'N/A' ? '' : escapeHtml(r.message)}"></td>
        <td class="controls"><button data-id="${r.id}" class="delete">Delete</button></td>
      `;
    } else {
      tr.innerHTML = `
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td>${escapeHtml(r.attending)}</td>
        <td><strong>${r.guests || 1}</strong></td>
        <td>${escapeHtml(r.message)}</td>
        <td class="controls"><button data-id="${r.id}" class="delete">Delete</button></td>
      `;
    }
    tbody.appendChild(tr);
  });
  
  if (searchTokens.length > 0 || selectedVillages.size > 0) {
    setStatus(`Filtered: ${filteredData.length} of ${currentData.length} Entries | Selected Guests: ${totalFilteredGuests}👥 (Total Database Guests: ${totalMasterGuests}👥)`);
  } else {
    setStatus(`Loaded ${currentData.length} of ${currentData.length} Entries | Total Guests: ${totalMasterGuests}👥`);
  }
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function toggleEditModeUI() {
  const editModeBtn = document.getElementById('editModeBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const searchInput = document.getElementById('adminSearchInput');
  const sortSelect = document.getElementById('sortBySelect');

  if (isEditingMode) {
    editModeBtn.textContent = '💾 Save All Changes';
    editModeBtn.classList.add('editing-active');
    cancelEditBtn.style.display = 'inline-block';
    searchInput.disabled = true;
    sortSelect.disabled = true;
  } else {
    editModeBtn.textContent = '✏️ Bulk Edit Mode';
    editModeBtn.classList.remove('editing-active');
    cancelEditBtn.style.display = 'none';
    searchInput.disabled = false;
    sortSelect.disabled = false;
  }
}

document.getElementById('editModeBtn').addEventListener('click', async () => {
  if (!isEditingMode) {
    isEditingMode = true;
    toggleEditModeUI();
    applySortAndRender();
  } else {
    const rows = document.querySelectorAll('#list tbody tr');
    if (rows.length === 0) {
      isEditingMode = false;
      toggleEditModeUI();
      applySortAndRender();
      return;
    }

    if (!confirm('Kya aap saare inline changes ek sath database me save karna chahte hain?')) return;

    try {
      setStatus('Saving batch updates...');
      const updatePromises = [];

      rows.forEach(row => {
        const id = row.getAttribute('data-row-id');
        const name = row.querySelector('.edit-name').value.trim();
        const address = row.querySelector('.edit-address').value.trim();
        const guests = row.querySelector('.edit-guests').value;
        const phone = row.querySelector('.edit-phone').value.trim() || 'N/A';

        if (name && address) {
          const promise = api('/rsvp/' + id, {
            method: 'PUT',
            body: JSON.stringify({ name, attending: address, guests: guests, message: phone })
          });
          updatePromises.push(promise);
        }
      });

      await Promise.all(updatePromises);
      alert('🎉 Saare inline changes successfully update ho gaye hain!');
      isEditingMode = false;
      toggleEditModeUI();
      await load();
    } catch (err) {
      alert('Bulk saving configuration failed: ' + err.message);
      setStatus('Error: ' + err.message);
    }
  }
});

document.getElementById('cancelEditBtn').addEventListener('click', () => {
  if (!confirm('Discard all unsaved inline adjustments? Data purana hi rahega.')) return;
  isEditingMode = false;
  toggleEditModeUI();
  applySortAndRender();
});

// Master Reset Action for checkboxes triggers array clearing
document.getElementById('clearVillageSelection').addEventListener('click', () => {
  selectedVillages.clear();
  const checkboxes = document.querySelectorAll('#villageFilterGrid input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = false);
  applySortAndRender();
});

document.getElementById('savePw').addEventListener('click', ()=>{
  const v = document.getElementById('adminPw').value || '';
  sessionStorage.setItem('adminPw', v);
  setStatus('Password saved successfully');
});

document.getElementById('load').addEventListener('click', ()=>load());
document.getElementById('sortBySelect').addEventListener('change', () => applySortAndRender());

document.getElementById('sortDirBtn').addEventListener('click', (e) => {
  const currentDir = e.target.getAttribute('data-dir');
  if (currentDir === 'asc') {
    e.target.setAttribute('data-dir', 'desc');
    e.target.textContent = 'Order: Descending (Z-A) ↓';
  } else {
    e.target.setAttribute('data-dir', 'asc');
    e.target.textContent = 'Order: Ascending (A-Z) ↑';
  }
  applySortAndRender(); 
});

document.getElementById('adminSearchInput').addEventListener('input', () => {
    applySortAndRender();
});

document.getElementById('clearAll').addEventListener('click', async () => {
  if (!confirm('Permanently wipe out total saved records context inside database?')) return;
  const enteredPassword = prompt('Security Check password required:');
  if (!enteredPassword) return;

  const savedPassword = sessionStorage.getItem('adminPw') || '';
  if (enteredPassword !== savedPassword && enteredPassword !== 'admin') {
    alert('❌ Password mismatch context!');
    return;
  }
  try {
    await api('/rsvps/clear', {method:'POST'});
    await load();
  } catch(err) {
    setStatus('Error: '+err.message);
  }
});

document.getElementById('exportAdminPdf').addEventListener('click', () => {
    const rows = document.querySelectorAll('#list tbody tr');
    if (rows.length === 0 || isEditingMode) {
        alert(isEditingMode ? 'Pehle bulk edit mode ko save ya cancel karein!' : 'Export karne ke liye koi data nahi hai!');
        return;
    }
    
    let totalPdfGuestsCount = 0;
    rows.forEach(row => {
        totalPdfGuestsCount += parseInt(row.children[2].textContent) || 1;
    });
    
    // Create smart localized string representing active chune huye villages context configuration
    let activeGaoText = "All Villages Master List";
    if (selectedVillages.size > 0) {
      activeGaoText = "Filtered Villages: " + [...selectedVillages].map(g => g.toUpperCase()).join(', ');
    }

    let printContent = `
        <html>
        <head>
            <title>Master List</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #333; }
                h1 { color: #800020; border-bottom: 2px solid #800020; padding-bottom: 10px; font-size: 24px; text-align: center; margin-bottom: 5px; }
                p.meta { font-size: 14px; color: #444; margin-bottom: 25px; text-align: center; font-weight: 500; line-height: 1.5; }
                .guest-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .guest-table th, .guest-table td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
                .guest-table th { background-color: #800020; color: white; font-weight: bold; }
                .guest-table tr:nth-child(even) { background-color: #f9f9f9; }
                .total-row { font-weight: bold; background-color: #eee !important; color: #800020; font-size: 14px; }
            </style>
        </head>
        <body>
            <h1>✨ Didi Ki Shaadi - Master Invitation List ✨</h1>
            <p class="meta">Generated from Admin Panel | <strong>Target Map:</strong> ${activeGaoText}<br>Total Card Entries: <strong>${rows.length}</strong> | Total Guests Headcount: <span style="color: #800020; font-size: 15px;"><strong>${totalPdfGuestsCount} 👥</strong></span></p>
            <table class="guest-table">
                <thead>
                    <tr>
                        <th style="width: 7%;">S.No</th>
                        <th style="width: 38%;">Guest Name</th>
                        <th style="width: 35%;">Address / Location</th>
                        <th style="width: 10%;">Guests</th>
                        <th style="width: 10%;">Phone</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    rows.forEach((row, index) => {
        printContent += `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${row.children[0].textContent}</strong></td>
                <td>${row.children[1].textContent}</td>
                <td><strong>${row.children[2].textContent}</strong></td>
                <td>${row.children[3].textContent}</td>
            </tr>
        `;
    });
    
    printContent += `
            <tr class="total-row">
                <td colspan="3" style="text-align: right; padding: 12px;">Grand Total Headcount (👥):</td>
                <td colspan="2" style="padding: 12px; font-size: 15px;">${totalPdfGuestsCount} People</td>
            </tr>
        </tbody></table></body></html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
});

load();