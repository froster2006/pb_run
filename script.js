let tableData = [];
let apiPbData = [];

// 解析 MM:SS 或 MM:SS.xx 为毫秒
function parseDuration(timeString){
    if(!timeString) return NaN;
    let raw = timeString.trim();
    let parts = raw.split(':');
    if(parts.length !== 2) return NaN;

    let minutes = Number(parts[0]);
    if(Number.isNaN(minutes)) return NaN;

    let secondsPart = parts[1];
    let secondsParts = secondsPart.split('.');
    let seconds = Number(secondsParts[0]);
    if(Number.isNaN(seconds)) return NaN;

    let fraction = secondsParts[1] ? secondsParts[1].padEnd(3, '0').slice(0,3) : '000';
    let millis = Number(fraction);
    if(Number.isNaN(millis)) return NaN;

    return minutes * 60000 + seconds * 1000 + millis;
}

function trimZeroNum(str){
    return String(Number(str.trim()));
}

function parsePbEntries(text){
    let entries = [];
    text.split('\n').forEach(line => {
        let trimmed = line.trim();
        if(!trimmed) return;
        let parts = trimmed.split(/\s+/);
        if(parts.length < 2) return;
        let pb = parts.pop();
        let id = parts.join(' ').trim();
        if(id && pb){
            entries.push({ id, pb });
        }
    });
    return entries;
}

function buildPbMap(entries){
    let map = {};
    entries.forEach(entry => {
        map[entry.id] = entry.pb;
    });
    return map;
}

function getCurrentDateValue(){
    return new Date().toISOString().slice(0,10);
}

function updateTableHeader(){
    let dateInput = document.getElementById('dateInput');
    let value = dateInput && dateInput.value ? dateInput.value : getCurrentDateValue();
    let header = document.getElementById('tableHeader');
    if(header){
        header.textContent = `${value} PB Run 成绩`;
    }
}

function initDateInput(){
    let dateInput = document.getElementById('dateInput');
    if(!dateInput) return;
    dateInput.value = getCurrentDateValue();
    dateInput.addEventListener('input', updateTableHeader);
    updateTableHeader();
}

function loadPbData(){
    fetch('pb.json')
        .then(response => {
            if(!response.ok) throw new Error('pb.json 无法加载');
            return response.json();
        })
        .then(data => {
            pbMap = {};
            data.forEach(item => {
                if(item.ID && item.PB){
                    pbMap[item.ID.trim()] = item.PB.trim();
                }
            });
        })
        .catch(error => {
            console.error('加载 PB 数据失败:', error);
            pbMap = {};
        });
}

function normalizeApiPbRecord(item){
    let id = '';
    let pbTime = '';

    if(item){
        id = item.wexinID || item.wexinid || item.ID || item.id || '';
        pbTime = item.PBTime || item.pbTime || item.PB || item.pb || '';
    }

    return {
        id: String(id).trim(),
        pbTime: String(pbTime).trim()
    };
}

function buildApiPbMap(records){
    let map = {};
    (Array.isArray(records) ? records : []).forEach(item => {
        let record = normalizeApiPbRecord(item);
        if(record.id){
            map[record.id] = record.pbTime;
        }
    });
    return map;
}

function buildApiIdCountMap(records){
    let counts = {};
    (Array.isArray(records) ? records : []).forEach(item => {
        let record = normalizeApiPbRecord(item);
        if(record.id){
            counts[record.id] = (counts[record.id] || 0) + 1;
        }
    });
    return counts;
}

async function loadPbFromApi(){
    let textarea = document.getElementById('text3');
    if(!textarea) return;

    textarea.value = '正在加载 PB 数据...';

    try {
        let response = await fetch('https://0i6hydevx6.execute-api.us-east-1.amazonaws.com/dev/personalBestTime');
        if(!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        let payload = await response.json();
        let bodyData = payload;
        if(payload && typeof payload.body === 'string') {
            try {
                bodyData = JSON.parse(payload.body);
            } catch (parseError) {
                bodyData = [];
            }
        }

        let items = Array.isArray(bodyData) ? bodyData : [];
        apiPbData = items;
        let lines = items.map(item => {
            let record = normalizeApiPbRecord(item);
            return `${record.id}\t${record.pbTime}`;
        }).filter(line => line && line !== '\t');

        textarea.value = lines.join('\n');
    } catch (error) {
        console.error('加载 PB 数据失败:', error);
        textarea.value = '';
        alert('加载 PB 数据失败，请稍后重试。');
    }
}

function makeTable(){
    let str1 = document.getElementById('text1').value.trim();
    let str2 = document.getElementById('text2').value.trim();
    let str3 = document.getElementById('text3').value.trim();
    let arr1 = str1.split('\n').filter(x => x.trim() !== '');
    let arr2 = str2.split('\n').filter(x => x.trim() !== '');
    let pbEntries = parsePbEntries(str3);
    let pbMap = buildPbMap(pbEntries);

    let rankToId = {};
    let unmatchedIds = [];
    for(let i = 0; i < arr1.length; i += 2){
        let first = arr1[i].trim();
        let second = arr1[i+1] ? arr1[i+1].trim() : '';
        let rank = '';
        let id = '';
        let firstIsNum = /^\d+$/.test(first);
        let secondIsNum = /^\d+$/.test(second);

        if(firstIsNum && !secondIsNum){
            rank = trimZeroNum(first);
            id = second;
        } else if(!firstIsNum && secondIsNum){
            rank = trimZeroNum(second);
            id = first;
        } else if(!firstIsNum && !secondIsNum){
            rank = trimZeroNum(second);
            id = first;
        } else {
            rank = trimZeroNum(first);
            id = second;
        }

        if(rank){
            rankToId[rank] = id;
        } else if(id){
            unmatchedIds.push(id);
        }
    }

    let rankToTime = {};
    arr2.forEach(line => {
        let parts = line.trim().split(/\s+/);
        if(parts.length >= 2){
            let rawRank = parts[0];
            let realRank = trimZeroNum(rawRank);
            let time = parts[1];
            if(realRank) {
                rankToTime[realRank] = time;
            }
        }
    });

    let allRanks = new Set([...Object.keys(rankToId), ...Object.keys(rankToTime)]);
    tableData = [];
    Array.from(allRanks).sort((a,b) => Number(a) - Number(b)).forEach(r => {
        let id = rankToId[r] || '';
        let time = rankToTime[r] || '';
        let isPb = false;
        let pbLabel = '';

        if(time && id){
            if(pbMap[id]){
                let currentMs = parseDuration(time);
                let pbMs = parseDuration(pbMap[id]);
                if(!Number.isNaN(currentMs) && !Number.isNaN(pbMs) && currentMs < pbMs){
                    isPb = true;
                    pbLabel = 'PB!';
                }
            } else {
                pbLabel = 'New!';
            }
        }

        tableData.push({
            rank: r,
            id,
            time,
            pbLabel,
            isPb
        });
    });

    unmatchedIds.forEach(id => {
        tableData.push({
            rank: '',
            id,
            time: '',
            pbLabel: '',
            isPb: false
        });
    });

    let tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    tableData.forEach(item => {
        let tr = document.createElement('tr');
        if(item.isPb){
            tr.classList.add('pb-row');
        }
        if(item.pbLabel === 'New!'){
            tr.classList.add('new-row');
        }
        tr.innerHTML = `<td>${item.rank}</td><td>${item.id}</td><td>${item.time}</td><td>${item.pbLabel}</td>`;
        tbody.appendChild(tr);
    });
}

function exportExcel(){
    if(tableData.length === 0){
        alert('请先生成成绩表格！');
        return;
    }

    const dateInput = document.getElementById('dateInput');
    const dateValue = dateInput && dateInput.value ? dateInput.value : getCurrentDateValue();
    const apiPbMap = buildApiPbMap(apiPbData);
    const apiIdCounts = buildApiIdCountMap(apiPbData);

    let sheetData = [
        ['名次','wexinID','count','PBTime','PBDate','type'],
        ...tableData.map(item => {
            let normalizedId = item.id ? item.id.trim() : '';
            let countValue = normalizedId ? (apiIdCounts[normalizedId] || 1) : 1;
            let typeValue = '';
            let pbDateValue = '';

            if(normalizedId && item.time){
                let currentMs = parseDuration(item.time);
                let existingPb = apiPbMap[normalizedId];
                let existingPbMs = existingPb ? parseDuration(existingPb) : NaN;

                if(!existingPb || Number.isNaN(existingPbMs)){
                    typeValue = 'New!';
                    pbDateValue = dateValue;
                } else if(!Number.isNaN(currentMs) && !Number.isNaN(existingPbMs) && currentMs < existingPbMs){
                    typeValue = 'PB!';
                    pbDateValue = dateValue;
                }
            }

            return [item.rank, item.id, countValue, item.time, pbDateValue, typeValue];
        })
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '本周成绩');

    XLSX.writeFile(wb, `PBRun-${dateValue}.xlsx`);
}

initDateInput();
let loadPbBtn = document.getElementById('loadPbBtn');
if(loadPbBtn){
    loadPbBtn.addEventListener('click', loadPbFromApi);
}
