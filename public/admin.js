let currentData = []; 
let isEditingMode = false; 

// Generic API network client helper
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
    applySortAndRender(); 
  }catch(err){
    setStatus('Error: ' + err.message);
  }
}

// Memory sorting and conditional HTML grid rendering engine
function applySortAndRender() {
  if (!currentData || currentData.length === 0) {
    document.querySelector('#list tbody').innerHTML = '';
    setStatus('Loaded 0 Entries | Total Guests: 0👥');
    return;
  }

  const sortBy = document.getElementById('sortBySelect').value;
  const sortDir = document.getElementById('sortDirBtn').getAttribute('data-dir'); 
  const searchTerm = (document.getElementById('adminSearchInput').value || '').trim().toLowerCase(); 

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

  // Filter criteria execution context
  const filteredData = currentData.filter(r => {
    const nameText = (r.name || '').toString().toLowerCase();
    const addressText = (r.attending || '').toString().toLowerCase();
    return !searchTerm || nameText.includes(searchTerm) || addressText.includes(searchTerm);
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
  
  // Dynamic Counter Status Layout
  if (searchTerm) {
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
    
    let printContent = `
        <html>
        <head>
            <title>Master List</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #333; }
                h1 { color: #800020; border-bottom: 2px solid #800020; padding-bottom: 10px; font-size: 24px; text-align: center; margin-bottom: 5px; }
                p.meta { font-size: 15px; color: #444; margin-bottom: 25px; text-align: center; font-weight: 500; }
                .guest-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .guest-table th, .guest-table td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
                .guest-table th { background-color: #800020; color: white; font-weight: bold; }
                .guest-table tr:nth-child(even) { background-color: #f9f9f9; }
                .total-row { font-weight: bold; background-color: #eee !important; color: #800020; font-size: 14px; }
            </style>
        </head>
        <body>
            <h1>✨ Didi Ki Shaadi - Master Invitation List ✨</h1>
            <p class="meta">Generated from Admin Panel | Total Card Entries: <strong>${rows.length}</strong> | Total Guests Headcount: <span style="color: #800020; font-size: 16px;"><strong>${totalPdfGuestsCount} 👥</strong></span></p>
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

document.querySelector('#list tbody').addEventListener('click', async (e)=>{
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  
  if (btn.classList.contains('delete')){
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
});

load();