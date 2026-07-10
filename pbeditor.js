
(function () {
    const PAGE_SIZE = 20;
    const COLUMNS = [
        { label: '微信ID', key: 'wexinID', type: 'str' },
        { label: '次数', key: 'count', type: 'num' },
        { label: '最佳时间', key: 'PBTime', type: 'str' },
        { label: 'PB日期', key: 'PBDate', type: 'str' },
    ];

    let allItems = [];
    let filteredItems = [];
    let currentPage = 0;
    let sortKey = null;
    let sortAsc = true;
    let editingItem = null;   // reference to item being edited

    // ── filter & sort ─────────────────────────────────
    function applyFilter(query) {
        const q = query.trim().toLowerCase();
        filteredItems = q
            ? allItems.filter(it => (it.wexinID ?? '').toLowerCase().includes(q))
            : allItems.slice();
        applySort();
    }

    function applySort() {
        if (!sortKey) return;
        const col = COLUMNS.find(c => c.key === sortKey);
        filteredItems.sort((a, b) => {
            let va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
            if (col.type === 'num') {
                va = parseFloat(va) || 0;
                vb = parseFloat(vb) || 0;
            } else {
                va = va.toString().toLowerCase();
                vb = vb.toString().toLowerCase();
            }
            if (va > vb) return sortAsc ? 1 : -1;
            if (va < vb) return sortAsc ? -1 : 1;
            return 0;
        });
    }

    // ── modal ─────────────────────────────────────────
    const backdrop = document.getElementById('editBackdrop');
    const closeBtn = document.getElementById('editCloseBtn');
    const deleteBtn = document.getElementById('editDeleteBtn');
    const saveBtn = document.getElementById('editSaveBtn');
    const inCount = document.getElementById('editCount');
    const inPBTime = document.getElementById('editPBTime');
    const inPBDate = document.getElementById('editPBDate');

    function openModal(item) {
        editingItem = item;
        document.getElementById('editModalTitle').textContent =  (item.wexinID ?? '—');
        inCount.value = item.count ?? '';
        inPBTime.value = item.PBTime ?? '';
        inPBDate.value = item.PBDate ?? '';
        backdrop.hidden = false;
        inCount.focus();
    }

    function closeModal() {
        backdrop.hidden = true;
        editingItem = null;
    }

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    deleteBtn.addEventListener('click', async () => {
        if (!editingItem) return;

        const endpoint = 'https://0i6hydevx6.execute-api.us-east-1.amazonaws.com/dev/personalBestTime';
        const originalText = deleteBtn.textContent;
        const removedItem = editingItem;
        const removedKey = String(removedItem.wexinID ?? '').trim();
        const previousAllItems = allItems.slice();
        const previousFilteredItems = filteredItems.slice();
        const resultDiv = document.getElementById('personalBestResult');

        deleteBtn.disabled = true;
        deleteBtn.textContent = '删除中...';

        allItems = allItems.filter(item => String(item.wexinID ?? '').trim() !== removedKey);
        filteredItems = filteredItems.filter(item => String(item.wexinID ?? '').trim() !== removedKey);
        currentPage = 0;
        const q = document.getElementById('pbSearch');
        applyFilter(q ? q.value : '');
        closeModal();
        if (resultDiv) render(resultDiv);

        try {
            const payload = { body: JSON.stringify({ wexinID: removedItem.wexinID }) };
            const resp = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);

            deleteBtn.textContent = '✔ 已删除';
            deleteBtn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
        } catch (e) {
            console.error('Delete failed:', e);
            allItems = previousAllItems;
            filteredItems = previousFilteredItems;
            currentPage = 0;
            applyFilter(q ? q.value : '');
            if (resultDiv) render(resultDiv);
            deleteBtn.textContent = '删除失败';
            deleteBtn.style.background = 'linear-gradient(135deg,#ef4444,#b91c1c)';
            setTimeout(() => {
                deleteBtn.textContent = originalText;
                deleteBtn.style.background = '';
                deleteBtn.disabled = false;
            }, 1600);
            return;
        }

        setTimeout(() => {
            deleteBtn.textContent = '🗑 删除';
            deleteBtn.style.background = '';
            deleteBtn.disabled = false;
        }, 900);
    });

    saveBtn.addEventListener('click', async () => {
        if (!editingItem) return;

        // Apply edits back to the item in allItems (ID is read-only)

        editingItem.count = inCount.value.trim();
        editingItem.PBTime = inPBTime.value.trim();
        editingItem.PBDate = inPBDate.value.trim();

        // Send update to API (PUT)
        const endpoint = 'https://0i6hydevx6.execute-api.us-east-1.amazonaws.com/dev/personalBestTime';
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';

        try {
            const payload = { body: JSON.stringify(editingItem) };
            const resp = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);

            // Visual success
            saveBtn.textContent = '✔ 已保存！';
            saveBtn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
        } catch (e) {
            console.error('Save failed:', e);
            saveBtn.textContent = '保存失败';
            saveBtn.style.background = 'linear-gradient(135deg,#ef4444,#b91c1c)';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
                saveBtn.disabled = false;
            }, 1600);
            return;
        }

        setTimeout(() => {
            saveBtn.textContent = '✔ 保存';
            saveBtn.style.background = '';
            closeModal();
            // Re-apply filter so table reflects name change
            const q = document.getElementById('pbSearch');
            applyFilter(q ? q.value : '');
            const resultDiv = document.getElementById('personalBestResult');
            render(resultDiv);
            saveBtn.disabled = false;
        }, 900);
    });

    // ── render ────────────────────────────────────────
    function render(resultDiv) {
        const existingSearch = resultDiv.querySelector('#pbSearch');
        const searchVal = existingSearch ? existingSearch.value : '';

        resultDiv.innerHTML = '';

        // Search box
        const searchWrap = document.createElement('div');
        searchWrap.className = 'pb-search-wrap';
        const searchInput = document.createElement('input');
        searchInput.id = 'pbSearch';
        searchInput.className = 'pb-search';
        searchInput.type = 'search';
        searchInput.placeholder = '🔍 搜索微信ID…';
        searchInput.value = searchVal;
        searchInput.addEventListener('input', () => {
            currentPage = 0;
            applyFilter(searchInput.value);
            render(resultDiv);
        });
        searchWrap.appendChild(searchInput);
        resultDiv.appendChild(searchWrap);

        // Pagination math
        const total = filteredItems.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (currentPage >= totalPages) currentPage = totalPages - 1;
        const start = currentPage * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, total);

        // Table
        const table = document.createElement('table');
        table.className = 'pb-table';

        // Sortable thead
        const thead = table.createTHead();
        const hrow = thead.insertRow();
        COLUMNS.forEach(col => {
            const th = document.createElement('th');
            const isActive = sortKey === col.key;
            th.className = 'pb-th-sortable' + (isActive ? ' pb-th-active' : '');
            th.title = '点击排序';
            const labelSpan = document.createElement('span');
            labelSpan.textContent = col.label;
            th.appendChild(labelSpan);
            if (isActive) {
                const arrow = document.createElement('span');
                arrow.className = 'sort-arrow';
                arrow.textContent = sortAsc ? ' ▲' : ' ▼';
                th.appendChild(arrow);
            }
            th.addEventListener('click', () => {
                if (sortKey === col.key) { sortAsc = !sortAsc; }
                else { sortKey = col.key; sortAsc = true; }
                applySort();
                currentPage = 0;
                render(resultDiv);
            });
            hrow.appendChild(th);
        });

        // tbody
        const tbody = table.createTBody();
        if (total === 0) {
            const row = tbody.insertRow();
            const td = row.insertCell();
            td.colSpan = COLUMNS.length;
            td.className = 'pb-empty';
            td.textContent = '无匹配记录';
        } else {
            for (let i = start; i < end; i++) {
                const item = filteredItems[i];
                const row = tbody.insertRow();
                COLUMNS.forEach((col, colIdx) => {
                    const td = row.insertCell();
                    if (colIdx === 0) {
                        // wexinID → clickable link
                        const link = document.createElement('a');
                        link.href = '#';
                        link.className = 'pb-id-link';
                        link.textContent = item[col.key] ?? '—';
                        link.addEventListener('click', e => {
                            e.preventDefault();
                            openModal(item);
                        });
                        td.appendChild(link);
                    } else {
                        td.textContent = item[col.key] ?? '—';
                    }
                });
            }
        }
        resultDiv.appendChild(table);

        // Pagination bar
        const pager = document.createElement('div');
        pager.className = 'pb-pager';

        const btnPrev = document.createElement('button');
        btnPrev.className = 'pb-pager-btn';
        btnPrev.textContent = '◀ 上一页';
        btnPrev.disabled = currentPage === 0;
        btnPrev.addEventListener('click', () => { currentPage--; render(resultDiv); });

        const info = document.createElement('span');
        info.className = 'pb-pager-info';
        info.textContent = (currentPage + 1) + ' / ' + totalPages + '  (' + total + ' 条)';

        const btnNext = document.createElement('button');
        btnNext.className = 'pb-pager-btn';
        btnNext.textContent = '下一页 ▶';
        btnNext.disabled = end >= total;
        btnNext.addEventListener('click', () => { currentPage++; render(resultDiv); });

        pager.appendChild(btnPrev);
        pager.appendChild(info);
        pager.appendChild(btnNext);
        resultDiv.appendChild(pager);

        // Restore search focus
        const newSearch = resultDiv.querySelector('#pbSearch');
        if (newSearch) {
            newSearch.focus();
            newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
        }
    }

    // ── fetch ─────────────────────────────────────────
    const btnPersonalBest = document.getElementById('btnPersonalBest');

    async function fetchPersonalBest() {
        const resultDiv = document.getElementById('personalBestResult');
        if (!resultDiv) return;
        resultDiv.innerHTML = '<p class="pb-loading">Loading...</p>';
        try {
            const response = await fetch('https://0i6hydevx6.execute-api.us-east-1.amazonaws.com/dev/personalBestTime');
            const data = await response.json();
            allItems = JSON.parse(data.body);
            if (!Array.isArray(allItems) || allItems.length === 0) {
                resultDiv.innerHTML = '<p class="pb-loading">No data.</p>';
                return;
            }
            filteredItems = allItems.slice();
            currentPage = 0;
            sortKey = 'count';  // default: 2nd column
            sortAsc = false;    // largest → smallest
            applySort();
            render(resultDiv);
        } catch (e) {
            resultDiv.innerHTML = '<p class="pb-loading" style="color:#f87171">Error: ' + e + '</p>';
        }
    }

    if (btnPersonalBest) {
        btnPersonalBest.addEventListener('click', fetchPersonalBest);
    }

    document.addEventListener('DOMContentLoaded', fetchPersonalBest);
})();
