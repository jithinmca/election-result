let currentElectionData = [];
let districtMap = {};

const districtColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1', 
    '#14B8A6', '#D946EF', '#EAB308', '#F43F5E'
];

let stateConfig = {
    code: 'S11',
    count: 140,
    name: 'Kerala',
    fronts: ['LDF', 'UDF', 'NDA']
};

let searchQuery = '';
let currentSortMode = 'district';

document.addEventListener('DOMContentLoaded', () => {
    fetchData(false);
    // Refresh data periodically completely quietly in the background without emptying screen
    setInterval(() => fetchData(true), 30000);
});

window.changeState = function(stateCode) {
    if (stateCode === 'S11') {
        stateConfig = { code: 'S11', count: 140, name: 'Kerala', fronts: ['LDF', 'UDF', 'NDA'] };
        document.getElementById('tab-S11').classList.add('active');
        document.getElementById('tab-S22').classList.remove('active');
    } else {
        stateConfig = { code: 'S22', count: 234, name: 'Tamil Nadu', fronts: ['DMK', 'ADMK', 'NDA', 'TVK'] };
        document.getElementById('tab-S22').classList.add('active');
        document.getElementById('tab-S11').classList.remove('active');
    }
    
    // reset global maps
    districtMap = {};
    currentElectionData = [];
    document.getElementById('districts-container').innerHTML = '';
    
    document.getElementById('global-search').value = '';
    searchQuery = '';
    document.getElementById('sort-select').value = 'district';
    currentSortMode = 'district';
    fetchData(false);
}

window.handleSortChange = function(e) {
    currentSortMode = e.target.value;
    if (currentElectionData.length > 0) {
        processData(currentElectionData, true);
    }
}

window.handleSearch = function(e) {
    searchQuery = e.target.value.toLowerCase().trim();
    applySearchFilter();
}

function applySearchFilter() {
    const cards = document.querySelectorAll('.constituency-card');
    cards.forEach(card => {
        if (!searchQuery) {
            card.classList.remove('hidden');
            return;
        }
        
        let shouldShow = false;
        
        // Check constituency name
        const cName = card.querySelector('.c-name').textContent.toLowerCase();
        if (cName.includes(searchQuery)) shouldShow = true;
        
        // Check district string from title bar wrapper
        const distSection = card.closest('.district-section');
        if (distSection) {
            const dTitle = distSection.querySelector('.district-title-bar span').textContent.toLowerCase();
            if (dTitle.includes(searchQuery)) shouldShow = true;
        }

        // Check candidate names
        const candNames = card.querySelectorAll('.cand-name');
        candNames.forEach(cn => {
            if (cn.textContent.toLowerCase().includes(searchQuery)) shouldShow = true;
        });
        
        // Check party badges
        const badges = card.querySelectorAll('.party-badge');
        badges.forEach(b => {
             if (b.textContent.toLowerCase().includes(searchQuery) || b.title.toLowerCase().includes(searchQuery)) shouldShow = true;
        });

        if (shouldShow) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
    
    // Hide empty district sections
    const sections = document.querySelectorAll('.district-section');
    sections.forEach(sec => {
        const visibleCards = sec.querySelectorAll('.constituency-card:not(.hidden)');
        if (visibleCards.length === 0) {
            sec.classList.add('hidden');
        } else {
            sec.classList.remove('hidden');
        }
    });
}

async function fetchDistrictMap() {
    try {
        if (stateConfig.code === 'S11') {
            const response = await fetch('https://utility-backend.asianetnews.com/election/kerala/result');
            if (response.ok) {
                const data = await response.json();
                data.forEach(item => {
                    districtMap[item.acno] = item.district;
                });
            }
        }
        // TN doesn't have an easily available backup api for districts right now,
        // so it will fall back to the generic "TAMIL NADU STATE" grouping
    } catch(e) {
        console.warn("Could not load district map fallback");
    }
}

async function fetchData(isBackgroundRefresh = false) {
    await fetchDistrictMap();
    
    if (!isBackgroundRefresh) {
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('loader').style.display = 'block';
    } else {
        document.getElementById('sync-indicator').style.display = 'inline';
    }
    
    document.getElementById('fetch-total').innerText = stateConfig.count;
    document.getElementById('fetch-progress').innerText = 0;

    try {
        const promises = [];
        let completed = 0;
        
        for (let i = 1; i <= stateConfig.count; i++) {
            const p = fetch(`https://results.eci.gov.in/ResultAcGenMay2026/Constituencywise${stateConfig.code}${i}.htm`)
                .then(r => r.text())
                .then(html => {
                    completed++;
                    document.getElementById('fetch-progress').innerText = completed;
                    return parseEciHtml(html, i, stateConfig.code);
                })
                .catch(e => {
                    completed++;
                    return null;
                });
            promises.push(p);
        }
        
        const results = await Promise.all(promises);
        currentElectionData = results.filter(r => r !== null && r.candidates.length > 0);
        
        processData(currentElectionData, isBackgroundRefresh);
    } catch (error) {
        console.error("Fetch failed", error);
        if (!isBackgroundRefresh) {
            document.getElementById('loader').innerText = 'CRITICAL ERROR fetching ECI data.';
        }
    } finally {
        if (isBackgroundRefresh) {
            setTimeout(() => {
                document.getElementById('sync-indicator').style.display = 'none';
            }, 1000);
        }
    }
}

function getFrontFromParty(party, stateCode) {
    if (!party) return 'OTH';
    party = party.toUpperCase();
    
    if (stateCode === 'S11') { // Kerala
        const ldf = ['COMMUNIST', 'JANATA DAL', 'NATIONALIST CONGRESS', 'INDIAN NATIONAL LEAGUE', 'KERALA CONGRESS (M)'];
        const udf = ['INDIAN NATIONAL CONGRESS', 'INDIAN UNION MUSLIM LEAGUE', 'KERALA CONGRESS', 'REVOLUTIONARY SOCIALIST PARTY'];
        const nda = ['BHARATIYA JANATA PARTY', 'BHARATH DHARMA JANA SENA'];
        
        if (ldf.some(p => party.includes(p))) return 'LDF';
        if (udf.some(p => party.includes(p))) return 'UDF';
        if (nda.some(p => party.includes(p))) return 'NDA';
    } 
    else if (stateCode === 'S22') { // Tamil Nadu
        const dmk = ['DRAVIDA MUNNETRA KAZHAGAM', 'INDIAN NATIONAL CONGRESS', 'VIDUTHALAI CHIRUTHAIGAL KATCHI', 'COMMUNIST PARTY', 'MARUMALARCHI DRAVIDA MUNNETRA KAZHAGAM'];
        const admk = ['ALL INDIA ANNA DRAVIDA MUNNETRA KAZHAGAM', 'DESIYA MURPOKKU DRAVIDA KAZHAGAM'];
        const nda = ['BHARATIYA JANATA PARTY', 'PATTALI MAKKAL KATCHI', 'AMMA MAKKAL MUNNETRA KAZHAGAM'];
        const tvk = ['TAMILAGA VETTRI KAZHAGAM', 'TAMILAGA VETTRI'];
        
        if (tvk.some(p => party.includes(p))) return 'TVK';
        if (admk.some(p => party.includes(p))) return 'ADMK';
        if (dmk.some(p => party.includes(p))) return 'DMK';
        if (nda.some(p => party.includes(p))) return 'NDA';
    }
    
    return 'OTH';
}

function parseEciHtml(html, acno, stateCode) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let roundStatus = '';
    let isCompleted = false;
    const roundEl = doc.querySelector('.round-status');
    if (roundEl) {
        const text = roundEl.textContent;
        if (text.toLowerCase().includes('result')) {
            isCompleted = true;
            roundStatus = 'Final';
        } else {
            const match = text.match(/(\d+)\s*\/\s*(\d+)/);
            if (match) {
                roundStatus = match[1] + '/' + match[2];
                if (parseInt(match[1]) === parseInt(match[2]) && parseInt(match[2]) > 0) {
                    isCompleted = true;
                }
            }
        }
    } else if (doc.body && doc.body.textContent.toLowerCase().includes('result declared')) {
         isCompleted = true;
         roundStatus = 'Final';
    }
    
    const titleEl = doc.querySelector('h2 span');
    let cName = `AC-${acno}`;
    if (titleEl) {
        // "1 - MANJESHWAR (Kerala)" -> Extracting name dynamically
        const text = titleEl.textContent;
        const splitDash = text.split('-');
        if (splitDash.length > 1) {
            cName = splitDash[1].replace(/\(Kerala\)|\(Tamil Nadu.*?\)/i, '').trim();
        }
    }
    
    const candidates = [];
    const rows = doc.querySelectorAll('.custom-table tbody tr');
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 7) {
            const name = cols[1].textContent.trim();
            const party = cols[2].textContent.trim();
            const totalVotes = parseInt(cols[5].textContent.trim().replace(/,/g, '')) || 0;
            
            candidates.push({
                name_eng: name,
                party: party,
                votes: totalVotes,
                front: name.toUpperCase() === 'NOTA' ? 'OTH' : getFrontFromParty(party, stateCode)
            });
        }
    });
    
    candidates.sort((a,b) => b.votes - a.votes);
    candidates.forEach((c, idx) => c.position = idx + 1);
    
    let margin = 0;
    if (candidates.length > 1) {
        margin = candidates[0].votes - candidates[1].votes;
    }
    
    return {
        acno: acno,
        district: districtMap[acno] || (stateCode === 'S11' ? 'KERALA STATE' : 'TAMIL NADU STATE'),
        constituency: cName,
        leadvotes: margin,
        roundText: roundStatus,
        isCompleted: isCompleted,
        candidates: candidates
    };
}

window.togglePin = function(acno) {
    // Unique pin storage per state
    const storageKey = 'pinnedConstituencies_' + stateConfig.code;
    let pinnedIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    if (pinnedIds.includes(acno)) {
        pinnedIds = pinnedIds.filter(id => id !== acno);
    } else {
        pinnedIds.push(acno);
    }
    localStorage.setItem(storageKey, JSON.stringify(pinnedIds));
    
    if (currentElectionData.length > 0) {
        processData(currentElectionData);
    }
}

function generateSummaryCards(frontCounts) {
    const container = document.getElementById('dynamic-summary-cards');
    container.innerHTML = '';
    
    stateConfig.fronts.forEach(front => {
        const count = frontCounts[front] || 0;
        const cls = front.toLowerCase();
        
        container.innerHTML += `
            <div class="card card-${cls}">
                ${front}: <span>${count}</span>
            </div>
        `;
    });
    
    container.innerHTML += `<div class="card card-oth">OTH: <span>${frontCounts['OTH'] || 0}</span></div>`;
}

function processData(data, isBackgroundRefresh = false) {
    if (!isBackgroundRefresh) {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
    }

    const frontCounts = {};
    stateConfig.fronts.forEach(f => frontCounts[f] = 0);
    frontCounts['OTH'] = 0;

    const districts = {};
    const storageKey = 'pinnedConstituencies_' + stateConfig.code;
    const pinnedIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
    let pinnedList = [];

    data.forEach(item => {
        const leadingCandidate = item.candidates.find(c => c.position === 1) || item.candidates[0];
        if (leadingCandidate) {
            const front = leadingCandidate.front || 'OTH';
            if (frontCounts[front] !== undefined) {
                frontCounts[front]++;
            } else {
                frontCounts['OTH']++;
            }
        }

        const distName = currentSortMode === 'district' ? item.district : 'ALL CONSTITUENCIES';
        if (!districts[distName]) {
            districts[distName] = [];
        }
        districts[distName].push(item);
        
        if (pinnedIds.includes(item.acno)) {
            pinnedList.push(item);
        }
    });

    if (pinnedList.length > 0) {
        districts[' PINNED'] = pinnedList;
    }

    if (currentSortMode === 'margin_asc') {
        if (districts['ALL CONSTITUENCIES']) {
            districts['ALL CONSTITUENCIES'].sort((a, b) => a.leadvotes - b.leadvotes);
        }
    } else if (currentSortMode === 'margin_desc') {
        if (districts['ALL CONSTITUENCIES']) {
            districts['ALL CONSTITUENCIES'].sort((a, b) => b.leadvotes - a.leadvotes);
        }
    }

    generateSummaryCards(frontCounts);
    renderGrid(districts, pinnedIds);
    
    if (searchQuery) {
        applySearchFilter();
    }
}

function determineRowClass(front) {
    front = front ? front.toUpperCase() : '';
    const cls = front.toLowerCase();
    if (['ldf', 'udf', 'nda', 'dmk', 'admk', 'tvk'].includes(cls)) return 'row-' + cls;
    return 'row-oth';
}

function determineSubClass(front) {
    front = front ? front.toUpperCase() : '';
    const cls = front.toLowerCase();
    if (['ldf', 'udf', 'nda', 'dmk', 'admk', 'tvk'].includes(cls)) return cls;
    return 'oth';
}

function renderGrid(districts, pinnedIds) {
    const container = document.getElementById('districts-container');
    container.innerHTML = '';

    const districtNames = Object.keys(districts).sort((a,b) => {
        if (a === ' PINNED') return -1;
        if (b === ' PINNED') return 1;
        return a.localeCompare(b);
    });

    let colorIndex = 0;

    districtNames.forEach(distName => {
        const districtData = districts[distName];
        if (currentSortMode === 'district' || distName === ' PINNED') {
             districtData.sort((a, b) => a.acno - b.acno);
        }

        const isPinnedSection = distName === ' PINNED';
        const dColor = isPinnedSection ? '#EAB308' : districtColors[colorIndex % districtColors.length];
        
        if (!isPinnedSection) colorIndex++;
        
        const districtSection = document.createElement('div');
        districtSection.className = 'district-section';
        if (districtData.length > 25) {
            districtSection.classList.add('full-width');
        }
        districtSection.style.borderTopColor = dColor;

        const titleText = isPinnedSection ? '📌 PINNED FAVORITES' : distName.toUpperCase();
        
        const titleBar = document.createElement('div');
        titleBar.className = 'district-title-bar';
        titleBar.style.color = dColor;
        titleBar.innerHTML = `
            <span>${titleText}</span>
            <span>${districtData.length}</span>
        `;
        districtSection.appendChild(titleBar);

        const grid = document.createElement('div');
        grid.className = 'constituency-grid';

        districtData.forEach(constituency => {
            const sortedCandidates = [...constituency.candidates].sort((a, b) => a.position - b.position);
            const leadingCandidate = sortedCandidates[0];
            
            let leadText = '';
            let leadColorClass = 'lead-oth';

            if (leadingCandidate) {
                let margin = constituency.leadvotes || 0;
                if (margin >= 1000) {
                    margin = (margin / 1000).toFixed(1) + 'k';
                }
                leadText = `+${margin}`;
                leadColorClass = 'lead-' + determineSubClass(leadingCandidate.front);
            }

            let candidateRows = '';
            const topCandidates = sortedCandidates.slice(0, 3);
            
            topCandidates.forEach((cand, idx) => {
                const isPos1 = idx === 0 ? 'pos-1' : '';
                const rowFrontClass = determineRowClass(cand.front);
                const subClass = determineSubClass(cand.front);
                
                let candVotes = cand.votes || 0;
                if (candVotes >= 1000) {
                    candVotes = (candVotes / 1000).toFixed(1) + 'k';
                }
                
                let partyAlias = cand.party.substring(0,3);
                if (cand.party.includes('Communist Party of India (Marxist)')) partyAlias = 'CPM';
                else if (cand.party.includes('Communist Party of India')) partyAlias = 'CPI';
                else if (cand.party.includes('Congress')) partyAlias = 'INC';
                else if (cand.party.includes('Bharatiya Janata')) partyAlias = 'BJP';
                else if (cand.party.includes('Anna Dravida Munnetra Kazhagam')) partyAlias = 'ADM';
                else if (cand.party.includes('Dravida Munnetra Kazhagam')) partyAlias = 'DMK';
                else if (cand.party.includes('Tamilaga Vettri Kazhagam')) partyAlias = 'TVK';

                const crownHtml = (idx === 0 && constituency.isCompleted) ? '<span title="Winner!" style="font-size: 11px; margin-right: 2px;">👑</span>' : '';

                candidateRows += `
                    <div class="cand-row ${isPos1} ${rowFrontClass}">
                        <div class="cand-left">
                            <span class="party-badge party-${subClass}" title="${cand.party}">${partyAlias}</span>
                            ${crownHtml}<span class="cand-name" title="${cand.name_eng}">${cand.name_eng}</span>
                        </div>
                        <span class="cand-votes">${candVotes}</span>
                    </div>
                `;
            });

            const isPinned = pinnedIds.includes(constituency.acno);
            const pinChar = isPinned ? '★' : '☆';
            const pinClass = isPinned ? 'pin-btn pinned' : 'pin-btn';
            
            const roundHtml = constituency.roundText 
                ? `<span style="font-size: 9px; color: #475569; font-weight: 700; margin-left: 2px;">[${constituency.roundText}]</span>` 
                : '';

            const completedClass = constituency.isCompleted ? ' completed' : '';
            const card = document.createElement('div');
            card.className = 'constituency-card' + completedClass;
            card.innerHTML = `
                <div class="c-name-bar">
                    <div class="c-name-wrap">
                        <span class="c-name" title="${constituency.constituency}">${constituency.constituency}</span>
                        ${roundHtml}
                        <span class="${pinClass}" onclick="togglePin(${constituency.acno})" title="Toggle Pin">${pinChar}</span>
                    </div>
                    <span class="c-lead ${leadColorClass}">${leadText}</span>
                </div>
                <div class="cand-list">
                    ${candidateRows}
                </div>
            `;
            grid.appendChild(card);
        });

        districtSection.appendChild(grid);
        container.appendChild(districtSection);
    });
}
