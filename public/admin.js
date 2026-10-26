let currentData = []; 
let selectedVillages = new Set(); 
let editingRowId = null; // Tracks which specific row is currently in targeted inline edit mode
let activeCardStatusTab = 'all'; // 'all', 'pending', 'delivered'

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

function setStatus(msg){
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

async function load(){
  try{
    editingRowId = null; // Clear edit state on reload triggers
    setStatus('Loading...');
    currentData = await api('/rsvps'); 
    
    renderVillageCheckboxes();
    applySortAndRender(); 
  }catch(err){
    setStatus('Error: ' + err.message);
  }
}

function renderVillageCheckboxes() {
  const gridContainer = document.getElementById('villageFilterGrid');
  if (!gridContainer) return;
  if (!currentData || currentData.length === 0) {
    gridContainer.innerHTML = '<p style="color:#999; font-size:13px; margin:5px 0 0 0;">No locations found.</p>';
    return;
  }

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

function setCardStatusFilter(filterType) {
  activeCardStatusTab = filterType;
  document.querySelectorAll('.status-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === filterType) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  applySortAndRender();
}
window.setCardStatusFilter = setCardStatusFilter;

function applySortAndRender() {
  const tbody = document.querySelector('#list tbody');
  if (!tbody) return;

  if (!currentData || currentData.length === 0) {
    tbody.innerHTML = '';
    setStatus('Loaded 0 Entries | Total Guests: 0👥');
    return;
  }

  const sortBy = document.getElementById('sortBySelect') ? document.getElementById('sortBySelect').value : 'date';
  const sortDir = document.getElementById('sortDirBtn') ? document.getElementById('sortDirBtn').getAttribute('data-dir') : 'desc'; 
  const searchInputVal = (document.getElementById('adminSearchInput') ? document.getElementById('adminSearchInput').value : '').trim().toLowerCase(); 

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

  const totalDelivered = currentData.filter(r => r.cardGiven === true).length;
  const totalPending = currentData.length - totalDelivered;

  const filteredData = currentData.filter(r => {
    const rowAddressLower = (r.attending || '').trim().toLowerCase();
    const isGiven = r.cardGiven === true;

    if (activeCardStatusTab === 'delivered' && !isGiven) return false;
    if (activeCardStatusTab === 'pending' && isGiven) return false;
    
    if (selectedVillages.size > 0 && !selectedVillages.has(rowAddressLower)) {
      return false;
    }
    
    if (searchTokens.length > 0) {
      const combinedTargetText = `${r.name || ''} ${r.attending || ''}`.toLowerCase();
      return searchTokens.every(token => combinedTargetText.includes(token));
    }
    
    return true;
  });

  const totalFilteredGuests = filteredData.reduce((sum, r) => sum + (parseInt(r.guests) || 1), 0);

  tbody.innerHTML = '';
  
  filteredData.forEach(r => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', r.id); 
    
    const phoneVal = r.message === 'N/A' ? '' : r.message;
    const isGiven = r.cardGiven === true;

    if (editingRowId === r.id) {
      let optionsHtml = '';
      for (let i = 1; i <= 15; i++) {
        optionsHtml += `<option value="${i}" ${parseInt(r.guests) === i ? 'selected' : ''}>${i}</option>`;
      }
      
      tr.innerHTML = `
        <td>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
            <input type="checkbox" class="card-checkbox" id="edit-card-${r.id}" ${isGiven ? 'checked' : ''}>
            <span>${isGiven ? 'Given' : 'Pending'}</span>
          </label>
        </td>
        <td><input type="text" id="edit-name-${r.id}" class="inline-edit-input" value="${escapeHtml(r.name)}"></td>
        <td><input type="text" id="edit-address-${r.id}" class="inline-edit-input" value="${escapeHtml(r.attending)}"></td>
        <td>
          <select id="edit-guests-${r.id}" class="inline-edit-input">${optionsHtml}</select>
        </td>
        <td><input type="text" id="edit-phone-${r.id}" class="inline-edit-input" value="${escapeHtml(phoneVal)}"></td>
        <td class="controls">
          <button onclick="saveSingleRow('${r.id}')" class="save-btn">💾 Save</button>
          <button onclick="cancelRowEdit()" class="cancel-btn">❌ Cancel</button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" class="card-checkbox" title="Check mark if card is given" ${isGiven ? 'checked' : ''} onchange="toggleCardStatus('${r.id}', this.checked)">
            <span class="${isGiven ? 'badge-delivered' : 'badge-pending'}">${isGiven ? '✅ Dila Gaya' : '⏳ Baaki'}</span>
          </div>
        </td>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td>${escapeHtml(r.attending)}</td>
        <td><strong>${r.guests || 1}</strong></td>
        <td>${escapeHtml(r.message || 'N/A')}</td>
        <td class="controls">
          <button onclick="triggerRowEdit('${r.id}')" class="edit-btn">✏️ Edit</button>
          <button onclick="deleteSingleEntry('${r.id}')" class="delete">Delete</button>
        </td>
      `;
    }
    tbody.appendChild(tr);
  });
  
  setStatus(`Showing: ${filteredData.length} of ${currentData.length} Entries | Total Delivered: ${totalDelivered} ✅ | Total Pending: ${totalPending} ⏳ | Selected Guests Headcount: ${totalFilteredGuests}👥`);
}

async function toggleCardStatus(id, newStatus) {
  try {
    const target = currentData.find(item => item.id === id);
    if (target) target.cardGiven = newStatus;

    await api('/rsvp/' + id, {
      method: 'PUT',
      body: JSON.stringify({ cardGiven: newStatus })
    });
    applySortAndRender();
  } catch (err) {
    alert('Status update failed: ' + err.message);
    await load();
  }
}
window.toggleCardStatus = toggleCardStatus;

async function markAllFilteredAsGiven() {
  const rows = document.querySelectorAll('#list tbody tr');
  if (rows.length === 0) {
    alert('Koi record show nahi ho raha hai!');
    return;
  }

  const idsToUpdate = [];
  rows.forEach(r => {
    const id = r.getAttribute('data-row-id');
    const item = currentData.find(x => x.id === id);
    if (item && !item.cardGiven) {
      idsToUpdate.push(id);
    }
  });

  if (idsToUpdate.length === 0) {
    alert('Dikh rahe sabhi rishtedaron ko pehle se hi card dila chuka hai!');
    return;
  }

  if (!confirm(`Kya aap dikh rahe ${idsToUpdate.length} rishtedaron ko 'Card Dila Gaya' mark karna chahte hain?`)) return;

  try {
    setStatus(`Updating ${idsToUpdate.length} records...`);
    const updatePromises = idsToUpdate.map(id => {
      const item = currentData.find(x => x.id === id);
      if (item) item.cardGiven = true;
      return api('/rsvp/' + id, {
        method: 'PUT',
        body: JSON.stringify({ cardGiven: true })
      });
    });

    await Promise.all(updatePromises);
    alert('🎉 Sabhi select kiye huye records successfully updated!');
    applySortAndRender();
  } catch (err) {
    alert('Bulk update error: ' + err.message);
    await load();
  }
}
window.markAllFilteredAsGiven = markAllFilteredAsGiven;

async function markAllFilteredAsPending() {
  const rows = document.querySelectorAll('#list tbody tr');
  if (rows.length === 0) return;

  const idsToUpdate = [];
  rows.forEach(r => {
    const id = r.getAttribute('data-row-id');
    const item = currentData.find(x => x.id === id);
    if (item && item.cardGiven) {
      idsToUpdate.push(id);
    }
  });

  if (idsToUpdate.length === 0) {
    alert('Sabhi records pehle se hi Pending hain!');
    return;
  }

  if (!confirm(`Kya aap in ${idsToUpdate.length} rishtedaron ko wapas 'Pending' mark karna chahte hain?`)) return;

  try {
    setStatus(`Resetting ${idsToUpdate.length} records...`);
    const updatePromises = idsToUpdate.map(id => {
      const item = currentData.find(x => x.id === id);
      if (item) item.cardGiven = false;
      return api('/rsvp/' + id, {
        method: 'PUT',
        body: JSON.stringify({ cardGiven: false })
      });
    });

    await Promise.all(updatePromises);
    alert('Reset complete!');
    applySortAndRender();
  } catch (err) {
    alert('Error: ' + err.message);
    await load();
  }
}
window.markAllFilteredAsPending = markAllFilteredAsPending;

function triggerRowEdit(id) {
  editingRowId = id;
  applySortAndRender();
}

function cancelRowEdit() {
  editingRowId = null;
  applySortAndRender();
}

async function saveSingleRow(id) {
  if (!id) return;
  
  const name = document.getElementById(`edit-name-${id}`).value.trim();
  const address = document.getElementById(`edit-address-${id}`).value.trim();
  const guests = document.getElementById(`edit-guests-${id}`).value;
  const phone = document.getElementById(`edit-phone-${id}`).value.trim();
  const cardCheckbox = document.getElementById(`edit-card-${id}`);
  const cardGiven = cardCheckbox ? cardCheckbox.checked : false;
  
  if (!name || !address) {
    alert("Name aur Address field khali nahi chhod sakte!");
    return;
  }
  
  try {
    setStatus('Updating targeted relative records...');
    await api('/rsvp/' + id, {
      method: 'PUT',
      body: JSON.stringify({
        name: name,
        attending: address,
        guests: parseInt(guests) || 1,
        message: phone === '' ? 'N/A' : phone,
        cardGiven: cardGiven
      })
    });
    
    alert('🎉 Relative ka data safely update ho gaya!');
    editingRowId = null;
    await load();
  } catch (err) {
    alert('Failed to update data records: ' + err.message);
    setStatus('Error: ' + err.message);
  }
}

window.triggerRowEdit = triggerRowEdit;
window.cancelRowEdit = cancelRowEdit;
window.saveSingleRow = saveSingleRow;

async function deleteSingleEntry(id) {
  if (!id) return;
  if (!confirm('Kya aap is entry ko permanently delete karna chahte hain?')) return;
  
  try {
    setStatus('Deleting...');
    await api('/rsvp/' + id, { method: 'DELETE' }); 
    await load();
  } catch(err) {
    alert('Error deleting data: ' + err.message);
    setStatus('Error: ' + err.message);
  }
}
window.deleteSingleEntry = deleteSingleEntry;

function escapeHtml(s){return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

const clearVillageBtn = document.getElementById('clearVillageSelection');
if (clearVillageBtn) {
  clearVillageBtn.addEventListener('click', () => {
    selectedVillages.clear();
    const checkboxes = document.querySelectorAll('#villageFilterGrid input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    applySortAndRender();
  });
}

const savePwBtn = document.getElementById('savePw');
if (savePwBtn) {
  savePwBtn.addEventListener('click', ()=>{
    const v = (document.getElementById('adminPw') ? document.getElementById('adminPw').value : '') || '';
    sessionStorage.setItem('adminPw', v);
    setStatus('Password saved successfully');
    load();
  });
}

const loadBtn = document.getElementById('load');
if (loadBtn) {
  loadBtn.addEventListener('click', () => load());
}

const sortSelect = document.getElementById('sortBySelect');
if (sortSelect) {
  sortSelect.addEventListener('change', () => applySortAndRender());
}

const sortDirBtn = document.getElementById('sortDirBtn');
if (sortDirBtn) {
  sortDirBtn.addEventListener('click', (e) => {
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
}

const adminSearch = document.getElementById('adminSearchInput');
if (adminSearch) {
  adminSearch.addEventListener('input', () => {
    applySortAndRender();
  });
}

const clearAllBtn = document.getElementById('clearAll');
if (clearAllBtn) {
  clearAllBtn.addEventListener('click', async () => {
    if (!confirm('Permanently wipe out total saved records context inside database?')) return;
    const enteredPassword = prompt('Security Check password required:');
    if (!enteredPassword) return;

    const savedPassword = sessionStorage.getItem('adminPw') || '';
    if (enteredPassword !== savedPassword && enteredPassword !== 'admin' && enteredPassword !== 'AnnuAdmin@123') {
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
}

const exportAdminPdfBtn = document.getElementById('exportAdminPdf');
if (exportAdminPdfBtn) {
  exportAdminPdfBtn.addEventListener('click', () => {
    const rows = document.querySelectorAll('#list tbody tr');
    if (rows.length === 0 || editingRowId !== null) {
      alert(editingRowId !== null ? 'Pehle chal rahe edit mode ko save ya cancel karein!' : 'Export karne ke liye koi data nahi hai!');
      return;
    }
    
    let totalPdfGuestsCount = 0;
    rows.forEach(row => {
      totalPdfGuestsCount += parseInt(row.children[3].textContent) || 1;
    });
    
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
            <p class="meta">Generated from Admin Panel | <strong>Target Map:</strong> ${activeGaoText}<br>Total Card Entries: <strong>${rows.length}</strong> | Total Guests Headcount: <span style="color: #800020; font-size: 16px;"><strong>${totalPdfGuestsCount} 👥</strong></span></p>
            <table class="guest-table">
                <thead>
                    <tr>
                        <th style="width: 6%;">S.No</th>
                        <th style="width: 14%;">Status</th>
                        <th style="width: 34%;">Guest Name</th>
                        <th style="width: 28%;">Address / Location</th>
                        <th style="width: 8%;">Guests</th>
                        <th style="width: 10%;">Phone</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    rows.forEach((row, index) => {
      const statusText = row.children[0].textContent.includes('Dila Gaya') ? 'DELIVERED' : 'PENDING';
      printContent += `
          <tr>
              <td>${index + 1}</td>
              <td><strong>${statusText}</strong></td>
              <td><strong>${row.children[1].textContent}</strong></td>
              <td>${row.children[2].textContent}</td>
              <td><strong>${row.children[3].textContent}</strong></td>
              <td>${row.children[4].textContent}</td>
          </tr>
      `;
    });
    
    printContent += `
            <tr class="total-row">
                <td colspan="4" style="text-align: right; padding: 12px;">Grand Total Headcount (👥):</td>
                <td colspan="2" style="padding: 12px; font-size: 15px;">${totalPdfGuestsCount} People</td>
            </tr>
        </tbody></table></body></html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  });
}

const existingPw = sessionStorage.getItem('adminPw') || '';
if (existingPw && document.getElementById('adminPw')) {
  document.getElementById('adminPw').value = existingPw;
}

load();