let tableData = [];
let pbMap = {};

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

function makeTable(){
    let str1 = document.getElementById('text1').value.trim();
    let str2 = document.getElementById('text2').value.trim();
    let arr1 = str1.split('\n').filter(x => x.trim() !== '');
    let arr2 = str2.split('\n').filter(x => x.trim() !== '');

    let rankToId = {};
    for(let i = 0; i < arr1.length; i += 2){
        let id = arr1[i].trim();
        let rankRaw = arr1[i+1] ? arr1[i+1].trim() : '';
        let rank = trimZeroNum(rankRaw);
        if(rank) rankToId[rank] = id;
    }

    let rankToTime = {};
    arr2.forEach(line => {
        let parts = line.trim().split(/\s+/);
        if(parts.length >= 2){
            let rawRank = parts[0];
            let realRank = trimZeroNum(rawRank);
            let time = parts[1];
            rankToTime[realRank] = time;
        }
    });

    tableData = [];
    for(let r in rankToId){
        let id = rankToId[r];
        let time = rankToTime[r] || '无记录';
        let isPb = false;
        let pbLabel = '';

        if(time !== '无记录' && pbMap[id]){
            let currentMs = parseDuration(time);
            let pbMs = parseDuration(pbMap[id]);
            if(!Number.isNaN(currentMs) && !Number.isNaN(pbMs) && currentMs < pbMs){
                isPb = true;
                pbLabel = 'PB';
            }
        }

        tableData.push({
            rank: r,
            id,
            time,
            pbLabel,
            isPb
        });
    }

    tableData.sort((a,b) => Number(a.rank) - Number(b.rank));

    let tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    tableData.forEach(item => {
        let tr = document.createElement('tr');
        if(item.isPb){
            tr.classList.add('pb-row');
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
    let sheetData = [
        ['名次','ID','用时','PB'],
        ...tableData.map(item => [item.rank, item.id, item.time, item.pbLabel])
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '本周成绩');
    const dateValue = document.getElementById('dateInput')?.value || 'date';
    XLSX.writeFile(wb, `PBRun-${dateValue}.xlsx`);
}

initDateInput();
loadPbData();
