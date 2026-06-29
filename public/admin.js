let currentData = []; 
let selectedVillages = new Set(); 
let editingRowId = null; // Tracks which specific row is currently in targeted inline edit mode

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

function applySortAndRender() {
  if (!currentData || currentData.length === 0) {
    document.querySelector('#list tbody').innerHTML = '';
    setStatus('Loaded 0 Entries | Total Guests: 0👥');
    return;
  }

  const sortBy = document.getElementById('sortBySelect').value;
  const sortDir = document.getElementById('sortDirBtn').getAttribute('data-dir'); 
  const searchInputVal = (document.getElementById('adminSearchInput').value || '').trim().toLowerCase(); 

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

  const filteredData = currentData.filter(r => {
    const rowAddressLower = (r.attending || '').trim().toLowerCase();
    
    if (selectedVillages.size > 0 && !selectedVillages.has(rowAddressLower)) {
      return false;
    }
    
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
    
    const phoneVal = r.message === 'N/A' ? '' : r.message;

    // ✨ INTERACTION LOGIC: Checking if this specific row is triggered into targeted single edit mode
    if (editingRowId === r.id) {
      let optionsHtml = '';
      for (let i = 1; i <= 15; i++) {
        optionsHtml += `<option value="${i}" ${parseInt(r.guests) === i ? 'selected' : ''}>${i}</option>`;
      }
      
      tr.innerHTML = `
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
  
  if (searchTokens.length > 0 || selectedVillages.size > 0) {
    setStatus(`Filtered: ${filteredData.length} of ${currentData.length} Entries | Selected Guests: ${totalFilteredGuests}👥 (Total Database Guests: ${totalMasterGuests}👥)`);
  } else {
    setStatus(`Loaded ${currentData.length} of ${currentData.length} Entries | Total Guests: ${totalMasterGuests}👥`);
  }
}

// ✨ NEW ARCHITECTURE FUNCTION: Triggers a single isolated row into inputs frame
function triggerRowEdit(id) {
  editingRowId = id;
  applySortAndRender(); // Re-render to load input forms inside selected row boundary
}

// ✨ NEW ARCHITECTURE FUNCTION: Discards inline row modifications
function cancelRowEdit() {
  editingRowId = null;
  applySortAndRender();
}

// ✨ NEW ARCHITECTURE FUNCTION: Securely patches comprehensive modifications into MongoDB Atlas cloud database
async function saveSingleRow(id) {
  if (!id) return;
  
  const name = document.getElementById(`edit-name-${id}`).value.trim();
  const address = document.getElementById(`edit-address-${id}`).value.trim();
  const guests = document.getElementById(`edit-guests-${id}`).value;
  const phone = document.getElementById(`edit-phone-${id}`).value.trim();
  
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
        message: phone === '' ? 'N/A' : phone
      })
    });
    
    alert('🎉 Relative ka data safely update ho gaya!');
    editingRowId = null; // Revert layout to standard mode
    await load();
  } catch (err) {
    alert('Failed to update data records: ' + err.message);
    setStatus('Error: ' + err.message);
  }
}

// Expose single-row operations context seamlessly to window instance layer
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
    if (rows.length === 0 || editingRowId !== null) {
        alert(editingRowId !== null ? 'Pehle chal rahe edit mode ko save ya cancel karein!' : 'Export karne ke liye koi data nahi hai!');
        return;
    }
    
    let totalPdfGuestsCount = 0;
    rows.forEach(row => {
        totalPdfGuestsCount += parseInt(row.children[2].textContent) || 1;
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