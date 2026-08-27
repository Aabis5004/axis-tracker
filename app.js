let trajData = [];
let pointsData = [];
let trajTotal = 0;
let pointsTotal = 0;
let currentTab = 'trajectories';
let currentPage = 1;
const ITEMS_PER_PAGE = 25;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    document.getElementById('traj-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') calculateRank();
    });
});

async function initApp() {
    const loadingStatus = document.getElementById('loading-status');
    const loadingOverlay = document.getElementById('loading-overlay');
    const dashboard = document.getElementById('dashboard');

    if (loadingStatus) loadingStatus.textContent = 'Connecting to Axis telemetry server...';

    try {
        const resp = await fetch('data.json?t=' + Date.now());
        const data = await resp.json();

        if (data.loading && (!data.trajectories || data.trajectories.length === 0)) {
            if (loadingStatus) loadingStatus.textContent = 'Server fetching live Axis API... please wait.';
            setTimeout(initApp, 3000);
            return;
        }

        trajData = data.trajectories || [];
        pointsData = data.points || [];
        trajTotal = data.traj_total || 28998;
        pointsTotal = data.pts_total || 5000;

        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';

        updateHeaderStats(data.updated);
        renderAll();
    } catch (err) {
        console.warn('Proxy fetch error, retrying...', err);
        setTimeout(initApp, 3000);
    }
}

function updateHeaderStats(updatedTime) {
    const totalUsersEl = document.getElementById('stat-total-users');
    const pagesLoadedEl = document.getElementById('stat-pages-loaded');
    const updatedEl = document.getElementById('stat-last-updated');

    if (totalUsersEl) totalUsersEl.textContent = `${trajTotal.toLocaleString()} Hub Users`;
    if (pagesLoadedEl) pagesLoadedEl.textContent = `${trajData.length.toLocaleString()} Tracked`;
    if (updatedEl) updatedEl.textContent = updatedTime ? `Updated ${updatedTime}` : 'Live';
}

function renderAll() {
    renderKPIs();
    // renderPointsKPIs();
    renderDistribution();
    renderLeaderboard();
    renderMilestones();
}

function renderKPIs() {
    const thresholds = [
        { id: 'val-200plus', min: 200 },
        { id: 'val-500plus', min: 500 },
        { id: 'val-1000plus', min: 1000 },
        { id: 'val-5000plus', min: 5000 },
        { id: 'val-10000plus', min: 10000 },
    ];
    thresholds.forEach(t => {
        const count = trajData.filter(e => (e.trajectories || 0) >= t.min).length;
        animateNumber(t.id, count);
    });
}

function renderPointsKPIs() {
    const thresholds = [
        { id: 'val-pts-5000', min: 5000 },
        { id: 'val-pts-1000', min: 1000 },
        { id: 'val-pts-2000', min: 2000 },
        { id: 'val-pts-5000', min: 5000 },
    ];
    thresholds.forEach(t => {
        const count = pointsData.filter(e => (e.total_points || 0) >= t.min).length;
        animateNumber(t.id, count);
    });
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const duration = 700;
    const start = performance.now();
    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function renderDistribution() {
    const ranges = [
        { label: '10,000+', min: 10000, max: Infinity, color: '#f43f5e' },
        { label: '5,000–9,999', min: 5000, max: 9999, color: '#fb923c' },
        { label: '2,000–4,999', min: 2000, max: 4999, color: '#facc15' },
        { label: '1,000–1,999', min: 1000, max: 1999, color: '#4ade80' },
        { label: '500–999', min: 500, max: 999, color: '#38bdf8' },
        { label: '200–499', min: 200, max: 499, color: '#a855f7' },
        { label: '100–199', min: 100, max: 199, color: '#c084fc' },
    ];

    const chartEl = document.getElementById('dist-chart');
    if (!chartEl) return;
    const counts = ranges.map(r => trajData.filter(e => (e.trajectories || 0) >= r.min && (e.trajectories || 0) <= r.max).length);
    const maxCount = Math.max(...counts, 1);

    chartEl.innerHTML = ranges.map((r, i) => {
        const count = counts[i];
        const pct = (count / maxCount) * 100;
        return `
            <div class="dist-bar-wrapper">
                <span class="dist-bar-label">${r.label}</span>
                <div class="dist-bar-track">
                    <div class="dist-bar-fill" style="width:${Math.max(pct, 2)}%; background:${r.color};">
                        ${count > 0 ? count : ''}
                    </div>
                </div>
                <span class="dist-bar-count">${count.toLocaleString()}</span>
            </div>
        `;
    }).join('');

    const summaryEl = document.getElementById('dist-summary');
    if (summaryEl) {
        const totalTracked = trajData.length;
        const avg = totalTracked > 0 ? Math.round(trajData.reduce((s, e) => s + (e.trajectories || 0), 0) / totalTracked) : 0;
        const median = totalTracked > 0 ? (trajData[Math.floor(totalTracked / 2)]?.trajectories || 0) : 0;
        const top = trajData.length > 0 ? (trajData[0].trajectories || 0) : 0;

        summaryEl.innerHTML = `
            <div class="dist-summary-item">
                <div class="dist-summary-label">Top Tracked</div>
                <div class="dist-summary-value">${totalTracked.toLocaleString()}</div>
            </div>
            <div class="dist-summary-item">
                <div class="dist-summary-label">Average (Tracked)</div>
                <div class="dist-summary-value">${avg.toLocaleString()}</div>
            </div>
            <div class="dist-summary-item">
                <div class="dist-summary-label">Median (Tracked)</div>
                <div class="dist-summary-value">${median.toLocaleString()}</div>
            </div>
            <div class="dist-summary-item">
                <div class="dist-summary-label">Highest Trajectories</div>
                <div class="dist-summary-value">${top.toLocaleString()}</div>
            </div>
        `;
    }
}

function renderLeaderboard() {
    const data = currentTab === 'trajectories' ? trajData : pointsData;
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageData = data.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    const thMetric = document.getElementById('th-metric');
    const thSecondary = document.getElementById('th-secondary');
    if (thMetric) thMetric.textContent = currentTab === 'trajectories' ? 'Trajectories' : 'Total Points';
    if (thSecondary) thSecondary.textContent = currentTab === 'trajectories' ? 'Avg Score' : 'Task / Referral';

    const tbody = document.getElementById('leaderboard-tbody');
    if (tbody) {
        tbody.innerHTML = pageData.map(entry => {
            const rank = entry.rank;
            let rankBadge = `<span class="rank-cell">#${rank}</span>`;
            if (rank === 1) rankBadge = '<span class="rank-badge gold">1</span>';
            else if (rank === 2) rankBadge = '<span class="rank-badge silver">2</span>';
            else if (rank === 3) rankBadge = '<span class="rank-badge bronze">3</span>';

            const addr = entry.wallet_address ? entry.wallet_address.slice(0, 6) + '...' + entry.wallet_address.slice(-4) : '—';
            let metricVal, secondaryVal;
            if (currentTab === 'trajectories') {
                metricVal = (entry.trajectories || 0).toLocaleString();
                secondaryVal = entry.avg_trajectory_score ? entry.avg_trajectory_score.toFixed(1) : '—';
            } else {
                metricVal = (entry.total_points || 0).toLocaleString();
                secondaryVal = `${(entry.task_points || 0).toLocaleString()} / ${(entry.referral_points || 0).toLocaleString()}`;
            }

            
            const encodedData = encodeURIComponent(JSON.stringify(entry).replace(/'/g, "%27"));
            return `
                <tr class="clickable-row" onclick="openModal('${encodedData}')">
                    <td>${rankBadge}</td>
                    <td class="user-cell">${escapeHtml(entry.username || 'Anonymous')}</td>
                    <td class="address-cell" title="${entry.wallet_address || ''}">${addr}</td>
                    <td class="metric-cell">${metricVal}</td>
                    <td class="score-cell">${secondaryVal}</td>
                </tr>
            `;
        }).join('');
    }

    const infoEl = document.getElementById('table-info');
    if (infoEl) infoEl.textContent = `Showing ${startIdx + 1}–${Math.min(startIdx + ITEMS_PER_PAGE, totalItems)} of ${totalItems.toLocaleString()} tracked contributors`;

    const pagEl = document.getElementById('table-pagination');
    if (pagEl) {
        let pagHtml = '';
        const maxButtons = 7;
        const startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        const endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if (currentPage > 1) pagHtml += `<button class="page-btn" onclick="goToPage(${currentPage - 1})">←</button>`;
        for (let p = startPage; p <= endPage; p++) pagHtml += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
        if (currentPage < totalPages) pagHtml += `<button class="page-btn" onclick="goToPage(${currentPage + 1})">→</button>`;
        pagEl.innerHTML = pagHtml;
    }
}

function switchTab(tab) {
    currentTab = tab;
    currentPage = 1;
    document.getElementById('tab-traj')?.classList.toggle('active', tab === 'trajectories');
    document.getElementById('tab-pts')?.classList.toggle('active', tab === 'points');
    renderLeaderboard();
}

function goToPage(page) {
    currentPage = page;
    renderLeaderboard();
    document.getElementById('leaderboard-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function calculateRank() {
    const input = document.getElementById('traj-input');
    const val = parseInt(input.value);
    if (isNaN(val) || val < 0) return;

    let rank = 1;
    for (const e of trajData) {
        if (val >= (e.trajectories || 0)) break;
        rank++;
    }

    const isEstimated = rank > trajData.length;
    if (isEstimated) {
        const lastKnown = trajData.length > 0 ? (trajData[trajData.length - 1].trajectories || 0) : 0;
        if (val < lastKnown) {
            const ratio = val / Math.max(lastKnown, 1);
            rank = Math.round(trajData.length + (trajTotal - trajData.length) * (1 - ratio));
        }
    }

    const above = rank - 1;
    const below = Math.max(0, trajTotal - rank);
    const topPct = ((rank / trajTotal) * 100).toFixed(2);

    const resultBox = document.getElementById('calc-result');
    if (resultBox) resultBox.style.display = 'block';

    const rankValEl = document.getElementById('result-rank-value');
    const topPctEl = document.getElementById('result-top-pct');
    const aboveEl = document.getElementById('result-above');
    const belowEl = document.getElementById('result-below');

    if (rankValEl) rankValEl.textContent = `#${rank.toLocaleString()}${isEstimated ? '*' : ''}`;
    if (topPctEl) topPctEl.textContent = `Top ${topPct}%`;
    if (aboveEl) aboveEl.textContent = above.toLocaleString();
    if (belowEl) belowEl.textContent = `~${below.toLocaleString()}`;

    const neighborsEl = document.getElementById('result-neighbors');
    if (neighborsEl) {
        let html = '';
        const insertIdx = rank - 1;
        const startIdx = Math.max(0, insertIdx - 2);
        const endIdx = Math.min(trajData.length - 1, insertIdx + 2);

        for (let i = startIdx; i <= endIdx; i++) {
            if (i === insertIdx && !isEstimated) {
                html += `<div class="neighbor-item you"><span class="neighbor-rank">#${rank}</span><span class="neighbor-name">→ YOU (${val.toLocaleString()} trajectories)</span><span class="neighbor-count">${val.toLocaleString()}</span></div>`;
            }
            if (i < trajData.length) {
                const e = trajData[i];
                html += `<div class="neighbor-item"><span class="neighbor-rank">#${e.rank}</span><span class="neighbor-name">${escapeHtml(e.username || 'Anonymous')}</span><span class="neighbor-count">${(e.trajectories || 0).toLocaleString()}</span></div>`;
            }
        }

        if (isEstimated && insertIdx >= trajData.length) {
            html = `<div class="neighbor-item you"><span class="neighbor-rank">~#${rank.toLocaleString()}</span><span class="neighbor-name">→ YOU (${val.toLocaleString()} trajectories)</span><span class="neighbor-count">${val.toLocaleString()}</span></div><p style="font-size:11px; color:var(--text-muted); margin-top:8px;">* Rank projected based on lower trajectory volume ratio</p>`;
        }
        neighborsEl.innerHTML = html;
    }
}

function quickCalc(val) {
    const input = document.getElementById('traj-input');
    if (input) {
        input.value = val;
        calculateRank();
    }
}

function renderMilestones() {
    const milestones = [50, 100, 200, 250, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000];
    const body = document.getElementById('milestone-body');
    if (body) {
        body.innerHTML = milestones.map(m => {
            const count = trajData.filter(e => (e.trajectories || 0) >= m).length;
            const pct = trajTotal > 0 ? ((count / trajTotal) * 100).toFixed(2) : '0';
            return `<div class="milestone-item"><div class="milestone-threshold">${m >= 1000 ? (m/1000) + 'K' : m}+</div><div class="milestone-count">${count.toLocaleString()} users</div><div class="milestone-pct">Top ${pct}% of Hub</div></div>`;
        }).join('');
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function openModal(dataString) {
    const data = JSON.parse(decodeURIComponent(dataString));
    document.getElementById('modal-username').textContent = data.username || 'Anonymous';
    document.getElementById('modal-wallet').textContent = data.wallet_address || '—';
    document.getElementById('modal-rank').textContent = '#' + (data.rank || '—');
    document.getElementById('modal-traj').textContent = (data.trajectories || 0).toLocaleString();
    document.getElementById('modal-avg-score').textContent = data.avg_trajectory_score ? data.avg_trajectory_score.toFixed(2) : '—';
    document.getElementById('modal-points').textContent = (data.total_points || 0).toLocaleString();
    document.getElementById('modal-split').textContent = `${(data.task_points || 0).toLocaleString()} / ${(data.referral_points || 0).toLocaleString()}`;
    document.getElementById('user-modal').style.display = 'flex';
}
function closeModal() {
    document.getElementById('user-modal').style.display = 'none';
}
window.onclick = function(event) {
    const modal = document.getElementById('user-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

let isRefreshing = false;
async function forceRefresh() {
    if (isRefreshing) return;
    const btn = document.getElementById('refresh-btn');
    if(btn) {
        btn.textContent = 'RELOADING...';
        btn.style.opacity = '0.7';
    }
    isRefreshing = true;
    
    try {
        await initApp(); // reload everything from data.json
        if(btn) {
            setTimeout(() => {
                btn.textContent = 'SYNC NOW';
                btn.style.opacity = '1';
                isRefreshing = false;
            }, 1000);
        }
    } catch(e) {
        if(btn) btn.textContent = 'ERROR';
        setTimeout(() => { if(btn) btn.textContent = 'SYNC NOW'; isRefreshing = false; }, 3000);
    }
}
