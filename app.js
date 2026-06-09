/* ============================================================
   BAKSO IBU – Sales Dashboard
   Application Logic
   ============================================================ */

// ─── Data Import ───────────────────────────────────────────
let RAW_DATA = [];
const MONTHS_ORDER = ['Januari', 'Februari', 'Maret', 'April', 'Mei'];
const MONTH_SHORT  = { 'Januari':'Jan', 'Februari':'Feb', 'Maret':'Mar', 'April':'Apr', 'Mei':'Mei' };
const ALL_BRANCHES = ['Cab. BTP', 'Cab. Perintis'];
const CATEGORY_COLORS = {
    'MAKANAN': '#6366f1',
    'MINUMAN': '#38bdf8',
    'SNACK':   '#fbbf24',
    'SATUAN':  '#34d399',
    'CUSTOM':  '#a78bfa',
};
const BRANCH_COLORS = {
    'Cab. BTP':      { main: '#6366f1', light: '#818cf8', bg: 'rgba(99,102,241,0.15)' },
    'Cab. Perintis': { main: '#f472b6', light: '#f9a8d4', bg: 'rgba(244,114,182,0.15)' },
};

// ─── State ─────────────────────────────────────────────────
let selectedMonths   = [...MONTHS_ORDER];
let selectedBranches = [...ALL_BRANCHES];
let currentSection   = 'overview';
let productSortKey   = 'revenue';
let productSortDir   = 'desc';

// ─── Chart Instances ────────────────────────────────────────
let charts = {};

// ─── Helpers ────────────────────────────────────────────────
function formatCurrency(val) {
    if (val >= 1e9) return 'Rp ' + (val / 1e9).toFixed(2) + ' M';
    if (val >= 1e6) return 'Rp ' + (val / 1e6).toFixed(1) + ' Jt';
    return 'Rp ' + val.toLocaleString('id-ID');
}

function formatNumber(val) {
    return val.toLocaleString('id-ID');
}

function getFilteredData() {
    return RAW_DATA.filter(d =>
        selectedMonths.includes(d.Bulan) &&
        selectedBranches.includes(d.Cabang)
    );
}

function sumField(data, field) {
    return data.reduce((s, d) => s + (d[field] || 0), 0);
}

function animateValue(el, target, prefix = '', suffix = '', duration = 600) {
    const start = parseInt(el.dataset.current || '0');
    const diff  = target - start;
    const startTime = performance.now();

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + diff * eased);
        el.textContent = prefix + current.toLocaleString('id-ID') + suffix;
        if (progress < 1) requestAnimationFrame(tick);
    }
    el.dataset.current = target;
    requestAnimationFrame(tick);
}

// ─── Shared Chart Config ────────────────────────────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.92)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 10;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.titleFont = { weight: '700', size: 13 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };

function gridConfig() {
    return {
        color: 'rgba(255,255,255,0.05)',
        drawBorder: false,
    };
}

// ─── Build Filters ──────────────────────────────────────────
function buildFilters() {
    const monthContainer = document.getElementById('filterMonths');
    const branchContainer = document.getElementById('filterBranches');

    MONTHS_ORDER.forEach(m => {
        const chip = document.createElement('button');
        chip.className = 'filter-chip active';
        chip.textContent = MONTH_SHORT[m];
        chip.dataset.value = m;
        chip.addEventListener('click', () => toggleMonth(m, chip));
        monthContainer.appendChild(chip);
    });

    ALL_BRANCHES.forEach(b => {
        const chip = document.createElement('button');
        chip.className = 'filter-chip active';
        chip.textContent = b.replace('Cab. ', '');
        chip.dataset.value = b;
        chip.addEventListener('click', () => toggleBranch(b, chip));
        branchContainer.appendChild(chip);
    });

    document.getElementById('btnReset').addEventListener('click', resetFilters);
}

function toggleMonth(month, chip) {
    if (selectedMonths.includes(month)) {
        if (selectedMonths.length === 1) return; // keep at least 1
        selectedMonths = selectedMonths.filter(m => m !== month);
        chip.classList.remove('active');
    } else {
        selectedMonths.push(month);
        selectedMonths.sort((a, b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b));
        chip.classList.add('active');
    }
    updateAll();
}

function toggleBranch(branch, chip) {
    if (selectedBranches.includes(branch)) {
        if (selectedBranches.length === 1) return;
        selectedBranches = selectedBranches.filter(b => b !== branch);
        chip.classList.remove('active');
    } else {
        selectedBranches.push(branch);
        chip.classList.add('active');
    }
    updateAll();
}

function resetFilters() {
    selectedMonths   = [...MONTHS_ORDER];
    selectedBranches = [...ALL_BRANCHES];
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.add('active'));
    updateAll();
}

// ─── Navigation ─────────────────────────────────────────────
function setupNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) overlay.classList.remove('active');
        });
    });

    // Mobile
    document.getElementById('hamburger').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }
        overlay.classList.toggle('active', sidebar.classList.contains('open'));
    });
}

function switchSection(section) {
    currentSection = section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + section).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.section === section);
    });
}

// ─── Update All ─────────────────────────────────────────────
function updateAll() {
    updateFilterSummary();
    updateKPIs();
    updateChartTrend();
    updateChartCategory();
    updateChartTopProducts();
    updateChartBranchPie();
    updateBranchComparison();
    updateMonthComparison();
    updateCategoryTrend();
    updateProductTable();
}

function updateFilterSummary() {
    const months = selectedMonths.length === MONTHS_ORDER.length
        ? 'Semua Bulan'
        : selectedMonths.map(m => MONTH_SHORT[m]).join(', ');
    const branches = selectedBranches.length === ALL_BRANCHES.length
        ? 'Semua Cabang'
        : selectedBranches.map(b => b.replace('Cab. ', '')).join(', ');
    document.getElementById('filterSummary').textContent = months + ' • ' + branches;
}

// ─── KPIs ───────────────────────────────────────────────────
function updateKPIs() {
    const data = getFilteredData();
    const revenue = sumField(data, 'total sales amount');
    const orders  = sumField(data, 'total sales order');
    const qty     = sumField(data, 'sold qty');
    const profit  = sumField(data, 'profit');

    document.getElementById('kpiRevenue').textContent = formatCurrency(revenue);
    document.getElementById('kpiOrders').textContent  = formatNumber(orders);
    document.getElementById('kpiQty').textContent     = formatNumber(qty);
    document.getElementById('kpiProfit').textContent  = formatCurrency(profit);
}

// ─── Chart: Trend ───────────────────────────────────────────
function updateChartTrend() {
    const ctx = document.getElementById('chartTrend');
    if (charts.trend) charts.trend.destroy();

    const months = selectedMonths;

    // Build datasets per branch
    const datasets = selectedBranches.map(branch => {
        const bColor = BRANCH_COLORS[branch];
        const values = months.map(m => {
            return RAW_DATA
                .filter(d => d.Bulan === m && d.Cabang === branch)
                .reduce((s, d) => s + d['total sales amount'], 0);
        });
        return {
            label: branch,
            data: values,
            borderColor: bColor.main,
            backgroundColor: bColor.bg,
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: bColor.main,
            pointBorderColor: '#0b0f19',
            pointBorderWidth: 2,
        };
    });

    charts.trend = new Chart(ctx, {
        type: 'line',
        data: { labels: months.map(m => MONTH_SHORT[m]), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    grid: gridConfig(),
                    ticks: {
                        callback: v => formatCurrency(v),
                    }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.dataset.label + ': ' + formatCurrency(ctx.raw)
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: { weight: '600', size: 12 }
                    }
                }
            }
        }
    });
}

// ─── Chart: Category Donut ──────────────────────────────────
function updateChartCategory() {
    const ctx = document.getElementById('chartCategory');
    if (charts.category) charts.category.destroy();

    const data = getFilteredData();
    const groups = Object.keys(CATEGORY_COLORS);
    const values = groups.map(g => data.filter(d => d.group === g).reduce((s, d) => s + d['total sales amount'], 0));
    const total = values.reduce((a, b) => a + b, 0);

    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: groups,
            datasets: [{
                data: values,
                backgroundColor: groups.map(g => CATEGORY_COLORS[g]),
                borderColor: 'rgba(11,15,25,0.8)',
                borderWidth: 3,
                hoverBorderWidth: 0,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                        font: { weight: '600', size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                            return ctx.label + ': ' + formatCurrency(ctx.raw) + ' (' + pct + '%)';
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const { ctx: c, chartArea } = chart;
                const cx = (chartArea.left + chartArea.right) / 2;
                const cy = (chartArea.top + chartArea.bottom) / 2;
                c.save();
                c.font = '700 14px "Plus Jakarta Sans"';
                c.fillStyle = '#94a3b8';
                c.textAlign = 'center';
                c.fillText('Total', cx, cy - 10);
                c.font = '800 18px "Plus Jakarta Sans"';
                c.fillStyle = '#f1f5f9';
                c.fillText(formatCurrency(total), cx, cy + 14);
                c.restore();
            }
        }]
    });
}

// ─── Chart: Top Products ────────────────────────────────────
function updateChartTopProducts() {
    const ctx = document.getElementById('chartTopProducts');
    if (charts.topProducts) charts.topProducts.destroy();

    const data = getFilteredData();
    // Aggregate by product
    const productMap = {};
    data.forEach(d => {
        if (!productMap[d.product]) productMap[d.product] = { qty: 0, revenue: 0 };
        productMap[d.product].qty += d['sold qty'];
        productMap[d.product].revenue += d['total sales amount'];
    });

    const sorted = Object.entries(productMap)
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 10);

    const gradient = ctx.getContext('2d');
    const grad = gradient.createLinearGradient(0, 0, ctx.width, 0);
    grad.addColorStop(0, 'rgba(99,102,241,0.85)');
    grad.addColorStop(1, 'rgba(244,114,182,0.85)');

    charts.topProducts = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(s => s[0]),
            datasets: [{
                data: sorted.map(s => s[1].qty),
                backgroundColor: grad,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.7,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: gridConfig(),
                    ticks: { font: { weight: '600' } }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { weight: '600', size: 11 } }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: ctx => {
                            const rev = sorted[ctx.dataIndex][1].revenue;
                            return 'Revenue: ' + formatCurrency(rev);
                        }
                    }
                }
            }
        }
    });
}

// ─── Chart: Branch Pie ──────────────────────────────────────
function updateChartBranchPie() {
    const ctx = document.getElementById('chartBranchPie');
    if (charts.branchPie) charts.branchPie.destroy();

    const data = getFilteredData();
    const values = selectedBranches.map(b =>
        data.filter(d => d.Cabang === b).reduce((s, d) => s + d['total sales amount'], 0)
    );
    const total = values.reduce((a, b) => a + b, 0);

    charts.branchPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: selectedBranches,
            datasets: [{
                data: values,
                backgroundColor: selectedBranches.map(b => BRANCH_COLORS[b].main),
                borderColor: 'rgba(11,15,25,0.8)',
                borderWidth: 3,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                        font: { weight: '600', size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                            return ctx.label + ': ' + formatCurrency(ctx.raw) + ' (' + pct + '%)';
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText2',
            afterDraw(chart) {
                const { ctx: c, chartArea } = chart;
                const cx = (chartArea.left + chartArea.right) / 2;
                const cy = (chartArea.top + chartArea.bottom) / 2;
                c.save();
                c.font = '700 14px "Plus Jakarta Sans"';
                c.fillStyle = '#94a3b8';
                c.textAlign = 'center';
                c.fillText('Total', cx, cy - 10);
                c.font = '800 18px "Plus Jakarta Sans"';
                c.fillStyle = '#f1f5f9';
                c.fillText(formatCurrency(total), cx, cy + 14);
                c.restore();
            }
        }]
    });
}

// ─── Chart: Branch Comparison ───────────────────────────────
function updateBranchComparison() {
    const ctx = document.getElementById('chartBranchComparison');
    if (charts.branchComp) charts.branchComp.destroy();

    const months = selectedMonths;
    const datasets = ALL_BRANCHES.map(branch => {
        const bColor = BRANCH_COLORS[branch];
        return {
            label: branch,
            data: months.map(m =>
                RAW_DATA.filter(d => d.Bulan === m && d.Cabang === branch)
                    .reduce((s, d) => s + d['total sales amount'], 0)
            ),
            backgroundColor: bColor.main,
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
        };
    });

    charts.branchComp = new Chart(ctx, {
        type: 'bar',
        data: { labels: months.map(m => MONTH_SHORT[m]), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: gridConfig(),
                    ticks: { callback: v => formatCurrency(v) }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        padding: 20,
                        font: { weight: '600', size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.dataset.label + ': ' + formatCurrency(ctx.raw)
                    }
                }
            }
        }
    });

    // Update comparison stat cards
    updateCompCards();
}

function updateCompCards() {
    const data = getFilteredData();

    ALL_BRANCHES.forEach(branch => {
        const bData = data.filter(d => d.Cabang === branch);
        const prefix = branch === 'Cab. BTP' ? 'compBTP' : 'compPerintis';
        const revenue = sumField(bData, 'total sales amount');
        const orders  = sumField(bData, 'total sales order');
        const qty     = sumField(bData, 'sold qty');
        const avg     = orders > 0 ? (qty / orders).toFixed(2) : '0';

        document.getElementById(prefix + 'Revenue').textContent = formatCurrency(revenue);
        document.getElementById(prefix + 'Orders').textContent  = formatNumber(orders);
        document.getElementById(prefix + 'Qty').textContent     = formatNumber(qty);
        document.getElementById(prefix + 'Avg').textContent     = avg;
    });
}

// ─── Chart: Month Growth ────────────────────────────────────
function updateMonthComparison() {
    const ctx = document.getElementById('chartMonthGrowth');
    if (charts.monthGrowth) charts.monthGrowth.destroy();

    const months = selectedMonths;
    const monthRevenues = months.map(m =>
        RAW_DATA.filter(d => d.Bulan === m && selectedBranches.includes(d.Cabang))
            .reduce((s, d) => s + d['total sales amount'], 0)
    );

    // Growth percentages
    const growthPct = monthRevenues.map((rev, i) => {
        if (i === 0) return 0;
        const prev = monthRevenues[i - 1];
        return prev > 0 ? ((rev - prev) / prev * 100) : 0;
    });

    const colors = growthPct.map(g => g >= 0 ? '#34d399' : '#f87171');

    charts.monthGrowth = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => MONTH_SHORT[m]),
            datasets: [
                {
                    label: 'Total Penjualan',
                    type: 'bar',
                    data: monthRevenues,
                    backgroundColor: 'rgba(99,102,241,0.6)',
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: 0.5,
                    yAxisID: 'y',
                    order: 2,
                },
                {
                    label: 'Growth %',
                    type: 'line',
                    data: growthPct,
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251,191,36,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2.5,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    pointBackgroundColor: colors,
                    pointBorderColor: '#0b0f19',
                    pointBorderWidth: 2,
                    yAxisID: 'y1',
                    order: 1,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    position: 'left',
                    grid: gridConfig(),
                    ticks: { callback: v => formatCurrency(v) }
                },
                y1: {
                    position: 'right',
                    grid: { display: false },
                    ticks: { callback: v => v.toFixed(0) + '%' }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: { weight: '600', size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.datasetIndex === 0) return 'Penjualan: ' + formatCurrency(ctx.raw);
                            return 'Growth: ' + ctx.raw.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });

    // Update month comparison table
    updateMonthTable(months, monthRevenues, growthPct);
}

function updateMonthTable(months, revenues, growth) {
    const tbody = document.getElementById('monthCompBody');
    tbody.innerHTML = '';

    const data = RAW_DATA.filter(d => selectedBranches.includes(d.Cabang));

    months.forEach((m, i) => {
        const mData = data.filter(d => d.Bulan === m);
        const rev    = revenues[i];
        const orders = sumField(mData, 'total sales order');
        const qty    = sumField(mData, 'sold qty');
        const avg    = orders > 0 ? (qty / orders).toFixed(2) : '-';
        const g      = growth[i];
        const gClass = i === 0 ? 'neutral' : (g >= 0 ? 'positive' : 'negative');
        const gText  = i === 0 ? '-' : (g >= 0 ? '+' : '') + g.toFixed(1) + '%';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${m}</strong></td>
            <td>${formatCurrency(rev)}</td>
            <td class="${gClass}">${gText}</td>
            <td>${formatNumber(orders)}</td>
            <td>${formatNumber(qty)}</td>
            <td>${avg}</td>
        `;
        tbody.appendChild(row);
    });
}

// ─── Chart: Category Trend ──────────────────────────────────
function updateCategoryTrend() {
    const ctx = document.getElementById('chartCategoryTrend');
    if (charts.catTrend) charts.catTrend.destroy();

    const months = selectedMonths;
    const groups = Object.keys(CATEGORY_COLORS);
    const data = getFilteredData();

    const datasets = groups.map(g => ({
        label: g,
        data: months.map(m =>
            data.filter(d => d.Bulan === m && d.group === g)
                .reduce((s, d) => s + d['total sales amount'], 0)
        ),
        backgroundColor: CATEGORY_COLORS[g],
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
    }));

    charts.catTrend = new Chart(ctx, {
        type: 'bar',
        data: { labels: months.map(m => MONTH_SHORT[m]), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: {
                    stacked: true,
                    grid: gridConfig(),
                    ticks: { callback: v => formatCurrency(v) }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        padding: 20,
                        font: { weight: '600', size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.dataset.label + ': ' + formatCurrency(ctx.raw)
                    }
                }
            }
        }
    });
}

// ─── Product Table ──────────────────────────────────────────
function updateProductTable(searchTerm = '') {
    const data = getFilteredData();
    const productMap = {};

    data.forEach(d => {
        const key = d.product;
        if (!productMap[key]) {
            productMap[key] = { product: d.product, group: d.group, qty: 0, revenue: 0, orders: 0, profit: 0 };
        }
        productMap[key].qty     += d['sold qty'];
        productMap[key].revenue += d['total sales amount'];
        productMap[key].orders  += d['total sales order'];
        productMap[key].profit  += d['profit'];
    });

    let rows = Object.values(productMap);
    rows.forEach(r => r.avg = r.orders > 0 ? (r.qty / r.orders) : 0);

    // Filter by search
    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        rows = rows.filter(r => r.product.toLowerCase().includes(s) || r.group.toLowerCase().includes(s));
    }

    // Sort
    rows.sort((a, b) => {
        let va = a[productSortKey], vb = b[productSortKey];
        if (typeof va === 'string') {
            return productSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return productSortDir === 'asc' ? va - vb : vb - va;
    });

    const tbody = document.getElementById('productBody');
    tbody.innerHTML = '';
    document.getElementById('productCount').textContent = rows.length + ' produk';

    rows.forEach(r => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${r.product}</strong></td>
            <td><span class="category-badge cat-${r.group}">${r.group}</span></td>
            <td>${formatNumber(r.qty)}</td>
            <td>${formatCurrency(r.revenue)}</td>
            <td>${formatNumber(r.orders)}</td>
            <td>${r.avg.toFixed(2)}</td>
            <td>${formatCurrency(r.profit)}</td>
        `;
        tbody.appendChild(row);
    });
}

// ─── Product Sort ───────────────────────────────────────────
function setupProductSort() {
    document.querySelectorAll('.data-table .sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (productSortKey === key) {
                productSortDir = productSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                productSortKey = key;
                productSortDir = 'desc';
            }
            // Update visual
            document.querySelectorAll('.sortable').forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(productSortDir === 'asc' ? 'sort-asc' : 'sort-desc');

            const search = document.getElementById('productSearch').value;
            updateProductTable(search);
        });
    });

    document.getElementById('productSearch').addEventListener('input', (e) => {
        updateProductTable(e.target.value);
    });
}

// ─── Date Display ───────────────────────────────────────────
function showDate() {
    const d = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = d.toLocaleDateString('id-ID', opts);
}

// ─── Initialize ─────────────────────────────────────────────
async function init() {
    showDate();

    // Load data from JSON file
    try {
        const response = await fetch('master_data.json');
        RAW_DATA = await response.json();
    } catch (e) {
        console.error('Error loading data:', e);
        return;
    }

    buildFilters();
    setupNav();
    setupProductSort();
    updateAll();
}

document.addEventListener('DOMContentLoaded', init);
