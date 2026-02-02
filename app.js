/**
 * Retirement Planner - Main Application
 * Updated: Sensex default 12%, S&P default 9%, no PDF
 */

const MARKET_DEFAULTS = {
    sensex: { currency: '₹', currencySymbol: '₹', locale: 'en-IN', averageReturn: 12, taxRate: 12.5, debtReturn: 7, inflation: 7, dataRange: { startYear: 1994, endYear: 2025 } },
    sp500: { currency: '$', currencySymbol: '$', locale: 'en-US', averageReturn: 9, taxRate: 15, debtReturn: 5, inflation: 3, dataRange: { startYear: 1986, endYear: 2025 } }
};

let state = { market: 'sensex', duration: 'perpetual', sipEnabled: false, results: null };

document.addEventListener('DOMContentLoaded', function() {
    selectMarket('sensex');
    selectDuration('perpetual');
    document.getElementById('sipToggle').addEventListener('change', function() {
        state.sipEnabled = this.checked;
        document.getElementById('sipOptions').classList.toggle('show', this.checked);
    });
    document.querySelectorAll('.expandable-header').forEach(header => {
        header.addEventListener('click', function() { this.closest('.expandable-section').classList.toggle('open'); });
    });
    document.getElementById('disclaimerToggle').addEventListener('click', function() {
        document.getElementById('disclaimerContent').classList.toggle('show');
        this.querySelector('.toggle-icon').textContent = document.getElementById('disclaimerContent').classList.contains('show') ? '▲' : '▼';
    });
});

function selectMarket(market) {
    state.market = market;
    document.querySelectorAll('.market-toggle').forEach(btn => btn.classList.toggle('active', btn.dataset.market === market));
    const defaults = MARKET_DEFAULTS[market];
    document.getElementById('averageReturn').value = defaults.averageReturn;
    document.getElementById('taxRate').value = defaults.taxRate;
    document.getElementById('debtReturn').value = defaults.debtReturn;
    document.getElementById('inflation').value = defaults.inflation;
    document.querySelectorAll('.currency-symbol').forEach(el => el.textContent = defaults.currencySymbol);
}

function selectDuration(duration) {
    state.duration = duration;
    document.querySelectorAll('.duration-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.duration === duration));
}

function validateForm() {
    const fields = ['yearlyExpenses', 'currentEquity', 'currentDebt', 'yearsToRetire'];
    let valid = true;
    fields.forEach(id => {
        const el = document.getElementById(id);
        const wrapper = el.closest('.form-group');
        const errorEl = wrapper ? wrapper.querySelector('.form-error') : null;
        if (!el.value || isNaN(parseFloat(el.value))) {
            el.classList.add('error');
            if (errorEl) errorEl.textContent = 'This field is required';
            valid = false;
        } else {
            el.classList.remove('error');
            if (errorEl) errorEl.textContent = '';
        }
    });
    return valid;
}

function calculate() {
    if (!validateForm()) return;
    document.getElementById('spinnerOverlay').classList.add('show');
    setTimeout(() => {
        try {
            const inputs = getInputValues();
            const results = performCalculations(inputs);
            state.results = results;
            renderResults(results);
        } catch (e) {
            console.error('Calculation error:', e);
            alert('Error during calculation. Please check inputs.');
        } finally {
            document.getElementById('spinnerOverlay').classList.remove('show');
        }
    }, 100);
}

function getInputValues() {
    const market = state.market;
    const defaults = MARKET_DEFAULTS[market];
    return {
        market, currency: defaults.currency, currencySymbol: defaults.currencySymbol, locale: defaults.locale,
        yearlyExpenses: parseFloat(document.getElementById('yearlyExpenses').value) || 0,
        currentEquity: parseFloat(document.getElementById('currentEquity').value) || 0,
        currentDebt: parseFloat(document.getElementById('currentDebt').value) || 0,
        yearsToRetire: parseInt(document.getElementById('yearsToRetire').value) || 0,
        duration: state.duration,
        averageReturn: parseFloat(document.getElementById('averageReturn').value) || defaults.averageReturn,
        taxRate: parseFloat(document.getElementById('taxRate').value) || defaults.taxRate,
        debtReturn: parseFloat(document.getElementById('debtReturn').value) || defaults.debtReturn,
        inflation: parseFloat(document.getElementById('inflation').value) || defaults.inflation,
        sipEnabled: state.sipEnabled,
        sipStepUp: parseFloat(document.getElementById('sipStepUp').value) || 10,
        dataRange: defaults.dataRange
    };
}

function performCalculations(inputs) {
    const marketReturns = inputs.market === 'sensex' ? getSensexReturns() : getSP500Returns();
    const yieldResult = calculateYield(inputs.yearlyExpenses, inputs.averageReturn, inputs.taxRate, inputs.inflation);
    const expensesAtRetirement = calculateInflationAdjustedExpenses(inputs.yearlyExpenses, inputs.inflation, inputs.yearsToRetire);
    const perpetualCorpus = calculateRequiredCorpus(expensesAtRetirement, yieldResult.yield);
    const corpusOptions = calculateCorpusOptions(inputs, expensesAtRetirement, yieldResult.yield, marketReturns, inputs.dataRange);
    const selectedCorpus = corpusOptions[inputs.duration] || corpusOptions['perpetual'];
    const projection = calculateInvestmentProjection(inputs.currentEquity, inputs.currentDebt, inputs.averageReturn, inputs.debtReturn, inputs.yearsToRetire);
    const gapAnalysis = calculateGapAnalysis(selectedCorpus.corpus, projection.futureTotal);
    const idealAllocation = calculateIdealAllocation(selectedCorpus.corpus, 0.85);
    const reallocation = calculateReallocation(inputs.currentEquity, inputs.currentDebt, idealAllocation.idealEquity, idealAllocation.idealDebt, inputs.averageReturn, inputs.debtReturn, inputs.yearsToRetire);
    
    let sipPlan = null;
    if (inputs.sipEnabled && gapAnalysis.status === 'shortfall') {
        const newProjection = calculateInvestmentProjection(reallocation.newEquity, reallocation.newDebt, inputs.averageReturn, inputs.debtReturn, inputs.yearsToRetire);
        const totalGap = selectedCorpus.corpus - newProjection.futureTotal;
        if (totalGap > 0 && inputs.yearsToRetire > 0) {
            const equitySIP = calculateSIPForTarget(totalGap, inputs.averageReturn, inputs.sipStepUp, inputs.yearsToRetire);
            sipPlan = { equitySIP, debtSIP: { monthlySIP: 0 }, totalInitialSIP: equitySIP.monthlySIP, totalFinalSIP: equitySIP.finalMonthlySIP, totalInvested: equitySIP.totalInvested, moveToDebtAtRetirement: idealAllocation.idealDebt - newProjection.futureDebt };
        }
    }
    
    const simulationCorpus = inputs.yearsToRetire === 0 ? inputs.currentEquity + inputs.currentDebt : projection.futureTotal;
    const simulation = runHistoricalSimulation(inputs, simulationCorpus, yieldResult.yield, marketReturns, inputs.dataRange, gapAnalysis.isSurplus);
    
    return { inputs, yield: yieldResult, expensesAtRetirement, expensesGrowth: inputs.yearsToRetire > 0 ? expensesAtRetirement / inputs.yearlyExpenses : 1, corpusOptions, selectedCorpus, projection, gapAnalysis, idealAllocation, reallocation, sipPlan, simulation, simulationCorpus };
}

function calculateCorpusOptions(inputs, expensesAtRetirement, perpetualYield, marketReturns, dataRange) {
    const options = { perpetual: { duration: 'Perpetual', corpus: calculateRequiredCorpus(expensesAtRetirement, perpetualYield), range: null } };
    [30, 25, 20, 15].forEach(years => {
        const validYears = getValidStartingYears(dataRange, years);
        if (validYears.length >= 1) {
            const testYears = selectSimulationYears(validYears, Math.min(5, validYears.length), [], marketReturns);
            if (testYears.length > 0) {
                try {
                    const corpusResult = findCorpusForDuration({ yearlyExpenses: expensesAtRetirement, equityRatio: 0.85, yieldRate: perpetualYield, debtReturn: inputs.debtReturn, inflationRate: inputs.inflation, taxRate: inputs.taxRate }, years, testYears, marketReturns);
                    options[years.toString()] = { duration: `${years} years`, corpus: corpusResult.avgCorpus, range: { min: corpusResult.minCorpus, max: corpusResult.maxCorpus, minYear: corpusResult.minYear, maxYear: corpusResult.maxYear } };
                } catch (e) {
                    options[years.toString()] = { duration: `${years} years`, corpus: options.perpetual.corpus * (years / 50), range: null, estimated: true };
                }
            }
        } else {
            options[years.toString()] = { duration: `${years} years`, corpus: options.perpetual.corpus * (years / 50), range: null, estimated: true };
        }
    });
    return options;
}

function runHistoricalSimulation(inputs, corpus, yieldRate, marketReturns, dataRange, isSurplus) {
    const validYears = getValidStartingYears(dataRange, 15);
    const mustInclude = [];
    if (validYears.includes(2000)) mustInclude.push(2000);
    if (validYears.includes(2008)) mustInclude.push(2008);
    const testYears = selectSimulationYears(validYears, 5, mustInclude, marketReturns);
    if (testYears.length === 0) return { split85_15: { results: [], analysis: analyzeSimulationResults([]) }, split60_40: { results: [], analysis: analyzeSimulationResults([]) } };
    
    const expensesForSim = inputs.yearsToRetire === 0 ? inputs.yearlyExpenses : calculateInflationAdjustedExpenses(inputs.yearlyExpenses, inputs.inflation, inputs.yearsToRetire);
    const results85_15 = [], results60_40 = [];
    
    testYears.forEach(startYear => {
        const params = { startingCorpus: corpus, yearlyExpenses: expensesForSim, yieldRate, debtReturn: inputs.debtReturn, inflationRate: inputs.inflation, taxRate: inputs.taxRate, startYear, marketReturns, maxYears: 50 };
        results85_15.push(runSimulationWithRebalancing({ ...params, equityRatio: 0.85 }));
        results60_40.push(runSimulationWithRebalancing({ ...params, equityRatio: 0.60 }));
    });
    
    return { split85_15: { results: results85_15, analysis: analyzeSimulationResults(results85_15) }, split60_40: { results: results60_40, analysis: analyzeSimulationResults(results60_40) }, isSurplus };
}

function renderResults(results) {
    const outputSection = document.getElementById('outputSection');
    outputSection.classList.add('show');
    renderSummaryCard(results);
    renderCorpusOptions(results);
    renderProjection(results);
    renderGapAnalysis(results);
    renderReallocation(results);
    const sipSection = document.getElementById('sipSection');
    if (results.sipPlan && results.sipPlan.totalInitialSIP > 0) { sipSection.classList.remove('hidden'); renderSIPPlan(results); } else { sipSection.classList.add('hidden'); }
    renderSimulation(results);
    outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSummaryCard(results) {
    const { inputs, selectedCorpus, projection, gapAnalysis, sipPlan, yield: yieldResult } = results;
    const statusClass = gapAnalysis.isSurplus ? 'success' : 'warning';
    const statusIcon = gapAnalysis.isSurplus ? '✓' : '⚠';
    const statusText = gapAnalysis.isSurplus ? "You're on track!" : 'Action needed';
    document.getElementById('summaryContent').innerHTML = `
        <div class="summary-grid">
            <div class="summary-item"><div class="summary-label">Required Corpus</div><div class="summary-value">${formatCurrency(selectedCorpus.corpus, inputs)}</div></div>
            <div class="summary-item"><div class="summary-label">Projected Corpus</div><div class="summary-value">${formatCurrency(projection.futureTotal, inputs)}</div></div>
            <div class="summary-item"><div class="summary-label">${gapAnalysis.isSurplus ? 'Surplus' : 'Shortfall'}</div><div class="summary-value ${statusClass}">${formatCurrency(gapAnalysis.difference, inputs)}</div></div>
            <div class="summary-item"><div class="summary-label">${sipPlan && sipPlan.totalInitialSIP > 0 ? 'SIP Required' : 'Yield'}</div><div class="summary-value">${sipPlan && sipPlan.totalInitialSIP > 0 ? formatCurrency(sipPlan.totalInitialSIP, inputs) + '/mo' : yieldResult.yield.toFixed(2) + '%'}</div></div>
        </div>
        <div class="summary-status"><span>${statusIcon}</span><span>${statusText}</span></div>`;
}

function renderCorpusOptions(results) {
    const { inputs, corpusOptions, selectedCorpus, yield: yieldResult } = results;
    let html = `
        <div class="metric-grid" style="grid-template-columns: 1fr;">
            <div class="metric-box highlight" style="background: var(--primary-bg); border-color: var(--primary);">
                <div class="metric-label">Your Selection: ${selectedCorpus.duration}</div>
                <div class="metric-value" style="font-size: 1.5rem;">${formatCurrency(selectedCorpus.corpus, inputs)}</div>
                <div class="text-muted mt-2">Yield: ${yieldResult.yield.toFixed(2)}%</div>
            </div>
        </div>`;
    
    // Show info message based on selection
    if (inputs.duration === 'perpetual') {
        html += `
        <div class="info-box mt-3">
            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <div>This corpus is designed to last indefinitely by withdrawing only the sustainable yield each year, preserving your principal while keeping pace with inflation.</div>
        </div>`;
    } else {
        html += `
        <div class="info-box mt-3">
            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <div>This corpus is calculated to last ${selectedCorpus.duration} based on historical market simulations. The range shows minimum to maximum corpus needed across different starting years.</div>
        </div>`;
        
        // Show range only for non-perpetual options
        if (selectedCorpus.range) {
            // Get P/E data for context
            const peData = inputs.market === 'sensex' ? (typeof getSensexPE === 'function' ? getSensexPE() : {}) : (typeof getSP500PE === 'function' ? getSP500PE() : {});
            const minYear = selectedCorpus.range.minYear;
            const maxYear = selectedCorpus.range.maxYear;
            const minPrevPE = minYear && peData[minYear - 1] ? peData[minYear - 1] : null;
            const maxPrevPE = maxYear && peData[maxYear - 1] ? peData[maxYear - 1] : null;
            
            const minYearText = minYear ? `Starting ${minYear}` : 'Best case';
            const maxYearText = maxYear ? `Starting ${maxYear}` : 'Worst case';
            const minPEText = minPrevPE ? ` · P/E ${minPrevPE}` : '';
            const maxPEText = maxPrevPE ? ` · P/E ${maxPrevPE}` : '';
            
            html += `
            <div class="metric-grid mt-3">
                <div class="metric-box">
                    <div class="metric-label">Minimum Required</div>
                    <div class="metric-value">${formatCurrency(selectedCorpus.range.min, inputs)}</div>
                    <div class="text-muted">${minYearText}${minPEText}</div>
                </div>
                <div class="metric-box">
                    <div class="metric-label">Maximum Required</div>
                    <div class="metric-value">${formatCurrency(selectedCorpus.range.max, inputs)}</div>
                    <div class="text-muted">${maxYearText}${maxPEText}</div>
                </div>
            </div>`;
        }
    }
    
    document.getElementById('corpusOptionsContent').innerHTML = html;
}

function renderProjection(results) {
    const { inputs, projection, expensesAtRetirement, expensesGrowth } = results;
    const years = inputs.yearsToRetire;
    let expensesHtml = '';
    if (years > 0) {
        expensesHtml = `<div class="metric-grid mb-4"><div class="metric-box"><div class="metric-label">Yearly Expenses Today</div><div class="metric-value">${formatCurrency(inputs.yearlyExpenses, inputs)}</div></div><div class="metric-box"><div class="metric-label">Expenses at Retirement (${years} yrs)</div><div class="metric-value">${formatCurrency(expensesAtRetirement, inputs)}</div><div class="text-muted mt-1">${expensesGrowth.toFixed(2)}x due to ${inputs.inflation}% inflation</div></div></div>`;
    }
    document.getElementById('projectionContent').innerHTML = `${expensesHtml}<p class="text-muted mb-3">Investment growth over ${years} years</p><table class="data-table"><thead><tr><th>Investment</th><th class="text-right">Current</th><th class="text-right">Future Value</th><th class="text-right">Growth</th></tr></thead><tbody><tr><td>Equity</td><td class="text-right">${formatCurrency(inputs.currentEquity, inputs)}</td><td class="text-right">${formatCurrency(projection.futureEquity, inputs)}</td><td class="text-right">${projection.equityGrowth.toFixed(1)}x</td></tr><tr><td>Debt</td><td class="text-right">${formatCurrency(inputs.currentDebt, inputs)}</td><td class="text-right">${formatCurrency(projection.futureDebt, inputs)}</td><td class="text-right">${projection.debtGrowth.toFixed(1)}x</td></tr><tr class="highlight"><td><strong>Total</strong></td><td class="text-right"><strong>${formatCurrency(inputs.currentEquity + inputs.currentDebt, inputs)}</strong></td><td class="text-right"><strong>${formatCurrency(projection.futureTotal, inputs)}</strong></td><td class="text-right"><strong>${((inputs.currentEquity + inputs.currentDebt) > 0 ? (projection.futureTotal / (inputs.currentEquity + inputs.currentDebt)).toFixed(1) : 0)}x</strong></td></tr></tbody></table>`;
}

function renderGapAnalysis(results) {
    const { inputs, gapAnalysis, selectedCorpus, projection } = results;
    const statusClass = gapAnalysis.isSurplus ? 'success' : 'warning';
    const statusIcon = gapAnalysis.isSurplus ? '🎉' : '📊';
    const statusText = gapAnalysis.isSurplus ? "Great News! You're on track!" : 'You have a shortfall';
    document.getElementById('gapAnalysisContent').innerHTML = `<div style="text-align: center; padding: 1rem; background: var(--${statusClass}-bg); border-radius: var(--radius-md); margin-bottom: 1rem;"><div style="font-size: 2rem; margin-bottom: 0.5rem;">${statusIcon}</div><div style="font-weight: 600; color: var(--${statusClass});">${statusText}</div></div><div class="metric-grid"><div class="metric-box"><div class="metric-label">Required Corpus</div><div class="metric-value">${formatCurrency(selectedCorpus.corpus, inputs)}</div></div><div class="metric-box"><div class="metric-label">Projected Corpus</div><div class="metric-value">${formatCurrency(projection.futureTotal, inputs)}</div></div></div><div class="metric-box mt-3" style="text-align: center;"><div class="metric-label">${gapAnalysis.isSurplus ? 'Surplus' : 'Shortfall'}</div><div class="metric-value ${statusClass}" style="font-size: 1.5rem;">${formatCurrency(gapAnalysis.difference, inputs)}</div></div>`;
}

function renderReallocation(results) {
    const { inputs, reallocation, idealAllocation, projection } = results;
    const currentTotal = inputs.currentEquity + inputs.currentDebt;
    const currentEquityPct = currentTotal > 0 ? (inputs.currentEquity / currentTotal * 100).toFixed(0) : 0;
    const currentDebtPct = currentTotal > 0 ? (inputs.currentDebt / currentTotal * 100).toFixed(0) : 0;
    let actionHtml = '';
    if (reallocation.action === 'move' && reallocation.from === 'debt') {
        actionHtml = `<div style="padding: 1rem; background: var(--primary-bg); border-radius: var(--radius-md); margin-top: 1rem;"><div style="font-weight: 600; color: var(--primary); margin-bottom: 0.5rem;">➡️ ACTION NOW: Move ${formatCurrency(reallocation.amount, inputs)} from Debt to Equity</div><div class="text-muted" style="font-size: 0.875rem;">After reallocation: Equity: ${formatCurrency(reallocation.newEquity, inputs)}, Debt: ${formatCurrency(reallocation.newDebt, inputs)}</div></div>`;
    } else if (reallocation.debtShortfallAtRetirement > 0) {
        actionHtml = `<div style="padding: 1rem; background: var(--warning-bg); border-radius: var(--radius-md); margin-top: 1rem;"><div style="font-weight: 600; color: var(--warning); margin-bottom: 0.5rem;">📋 PLAN: Debt shortfall of ${formatCurrency(reallocation.debtShortfallAtRetirement, inputs)} at retirement</div><div class="text-muted" style="font-size: 0.875rem;">Strategy: Invest all SIP in equity now. At retirement: Move ${formatCurrency(reallocation.debtShortfallAtRetirement, inputs)} from equity to debt for 85:15 split.</div></div>`;
    } else {
        actionHtml = `<div style="padding: 1rem; background: var(--success-bg); border-radius: var(--radius-md); margin-top: 1rem;"><div style="font-weight: 600; color: var(--success);">✓ No reallocation needed</div></div>`;
    }
    document.getElementById('reallocationContent').innerHTML = `<p class="text-muted mb-3">Ideal split at retirement: 85% Equity / 15% Debt</p><div class="metric-grid"><div class="metric-box"><div class="metric-label">Your Current Split</div><div class="metric-value">${currentEquityPct}% / ${currentDebtPct}%</div></div><div class="metric-box"><div class="metric-label">Ideal Split</div><div class="metric-value">85% / 15%</div></div></div>${actionHtml}`;
}

function renderSIPPlan(results) {
    const { inputs, sipPlan } = results;
    if (!sipPlan || sipPlan.totalInitialSIP <= 0) { document.getElementById('sipContent').innerHTML = '<p class="text-muted">No SIP required.</p>'; return; }
    let scheduleHtml = '';
    sipPlan.equitySIP.yearlySchedule.forEach((item, i) => { scheduleHtml += `<tr><td>${i + 1}</td><td class="text-right">${formatCurrency(item.monthlySIP, inputs)}</td></tr>`; });
    document.getElementById('sipContent').innerHTML = `<div class="metric-box" style="text-align: center; margin-bottom: 1rem; background: var(--primary-bg); border-color: var(--primary);"><div class="metric-label">Equity SIP (Year 1)</div><div class="metric-value" style="font-size: 1.5rem; color: var(--primary);">${formatCurrency(sipPlan.totalInitialSIP, inputs)}/month</div><div class="text-muted mt-2">Step-up: ${inputs.sipStepUp}% annually | Final Year: ${formatCurrency(sipPlan.totalFinalSIP, inputs)}/month</div><div class="text-muted">Total Investment: ${formatCurrency(sipPlan.totalInvested, inputs)}</div></div>${sipPlan.moveToDebtAtRetirement > 0 ? `<div style="padding: 0.75rem; background: var(--warning-bg); border-radius: var(--radius-md); margin-bottom: 1rem;"><div class="text-muted" style="font-size: 0.875rem;"><strong>At retirement:</strong> Move ${formatCurrency(sipPlan.moveToDebtAtRetirement, inputs)} from equity to debt for 85:15 split.</div></div>` : ''}<h4 style="margin: 1rem 0 0.75rem; font-size: 0.875rem; color: var(--text-secondary);">Year-wise Schedule</h4><div style="max-height: 300px; overflow-y: auto;"><table class="data-table"><thead><tr><th>Year</th><th class="text-right">Equity SIP/month</th></tr></thead><tbody>${scheduleHtml}</tbody></table></div>`;
}

function renderSimulation(results) {
    const { inputs, simulation, gapAnalysis, simulationCorpus } = results;
    if (!simulation || !simulation.split85_15.results || simulation.split85_15.results.length === 0) { document.getElementById('simulationContent').innerHTML = '<p class="text-muted">Insufficient historical data for simulation.</p>'; return; }
    const sim85 = simulation.split85_15, sim60 = simulation.split60_40;
    const isSurplus = gapAnalysis.isSurplus;
    
    // Get P/E data based on market
    const peData = inputs.market === 'sensex' ? (typeof getSensexPE === 'function' ? getSensexPE() : {}) : (typeof getSP500PE === 'function' ? getSP500PE() : {});
    const avgPE = inputs.market === 'sensex' ? 21.5 : 19.7;
    
    // Helper to format P/E with color coding
    const formatPE = (year) => {
        const pe = peData[year - 1]; // Previous year's P/E
        if (!pe) return '<span class="text-muted">-</span>';
        let color = 'var(--text-secondary)';
        let label = '';
        if (pe < 15) { color = 'var(--success)'; label = ' (Low)'; }
        else if (pe > 25) { color = 'var(--danger)'; label = ' (High)'; }
        return `<span style="color: ${color}; font-weight: 500;">${pe.toFixed(1)}${label}</span>`;
    };
    
    let tableHtml = `<div class="info-box mb-3"><svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><div>This simulation shows how your retirement corpus would have performed if you had invested in different historical market conditions (${inputs.market === 'sensex' ? 'Sensex 1994-2025' : 'S&P 500 1986-2025'}). <strong>Prev P/E</strong> shows the previous year's P/E ratio - <span style="color: var(--success);">Low P/E (&lt;15)</span> historically leads to better returns, <span style="color: var(--danger);">High P/E (&gt;25)</span> to lower returns.</div></div>`;
    tableHtml += `<p class="text-muted mb-3">Your Corpus: ${formatCurrency(simulationCorpus, inputs)}</p>`;
    
    if (isSurplus) {
        tableHtml += `<h4 style="margin: 1rem 0 0.75rem; font-size: 0.875rem; color: var(--text-secondary);">Corpus Growth After Yearly Withdrawals</h4><table class="data-table"><thead><tr><th>Starting Year</th><th class="text-center">Prev P/E</th><th class="text-right">Period</th><th class="text-right">Ending Corpus (85:15)</th><th class="text-right">Ending Corpus (60:40)</th></tr></thead><tbody>`;
        for (let i = 0; i < sim85.results.length; i++) {
            const r85 = sim85.results[i], r60 = sim60.results[i];
            const result85 = r85.survived ? formatCurrency(r85.endingCorpus, inputs) : `Ran out year ${r85.ranOutYear}`;
            const result60 = r60.survived ? formatCurrency(r60.endingCorpus, inputs) : `Ran out year ${r60.ranOutYear}`;
            const return85 = r85.survived && simulationCorpus > 0 ? `<br><span class="text-success text-muted">(${((r85.endingCorpus / simulationCorpus - 1) * 100).toFixed(0)}%)</span>` : '';
            const return60 = r60.survived && simulationCorpus > 0 ? `<br><span class="text-success text-muted">(${((r60.endingCorpus / simulationCorpus - 1) * 100).toFixed(0)}%)</span>` : '';
            tableHtml += `<tr><td>${r85.startYear}</td><td class="text-center">${formatPE(r85.startYear)}</td><td class="text-right">${r85.yearsSimulated} years</td><td class="text-right">${result85}${return85}</td><td class="text-right">${result60}${return60}</td></tr>`;
        }
    } else {
        tableHtml += `<h4 style="margin: 1rem 0 0.75rem; font-size: 0.875rem; color: var(--text-secondary);">How Long Your Money Lasts</h4><table class="data-table"><thead><tr><th>Starting Year</th><th class="text-center">Prev P/E</th><th class="text-right">85:15 Split</th><th class="text-right">60:40 Split</th><th>Status</th></tr></thead><tbody>`;
        for (let i = 0; i < sim85.results.length; i++) {
            const r85 = sim85.results[i], r60 = sim60.results[i];
            const result85 = r85.survived ? `${r85.yearsSimulated} years (${formatCurrencyShort(r85.endingCorpus, inputs)} left)` : `${r85.yearsSimulated} years`;
            const result60 = r60.survived ? `${r60.yearsSimulated} years (${formatCurrencyShort(r60.endingCorpus, inputs)} left)` : `${r60.yearsSimulated} years`;
            const status = !r85.survived || !r60.survived ? '<span class="badge badge-danger">Ran out</span>' : '<span class="badge badge-success">Survived</span>';
            tableHtml += `<tr><td>${r85.startYear}</td><td class="text-center">${formatPE(r85.startYear)}</td><td class="text-right">${result85}</td><td class="text-right">${result60}</td><td>${status}</td></tr>`;
        }
    }
    tableHtml += `</tbody></table>`;
    tableHtml += `<div class="metric-grid mt-4"><div class="metric-box"><div class="metric-label">85:15 Survival Rate</div><div class="metric-value ${sim85.analysis.survivalRate >= 80 ? 'success' : sim85.analysis.survivalRate >= 50 ? 'warning' : 'danger'}">${sim85.analysis.survivalRate.toFixed(0)}%</div></div><div class="metric-box"><div class="metric-label">60:40 Survival Rate</div><div class="metric-value ${sim60.analysis.survivalRate >= 80 ? 'success' : sim60.analysis.survivalRate >= 50 ? 'warning' : 'danger'}">${sim60.analysis.survivalRate.toFixed(0)}%</div></div></div>`;
    document.getElementById('simulationContent').innerHTML = tableHtml;
}

function formatCurrency(amount, inputs) {
    if (amount === undefined || amount === null || isNaN(amount)) return '-';
    const { currencySymbol, locale } = inputs;
    if (locale === 'en-IN') {
        if (Math.abs(amount) >= 10000000) return `${currencySymbol}${(amount / 10000000).toFixed(2)} Cr`;
        if (Math.abs(amount) >= 100000) return `${currencySymbol}${(amount / 100000).toFixed(2)} L`;
        return `${currencySymbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    } else {
        if (Math.abs(amount) >= 1000000) return `${currencySymbol}${(amount / 1000000).toFixed(2)}M`;
        if (Math.abs(amount) >= 100000) return `${currencySymbol}${(amount / 1000).toFixed(0)}K`;
        return `${currencySymbol}${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
}

function formatCurrencyShort(amount, inputs) {
    if (amount === undefined || amount === null || isNaN(amount)) return '-';
    const { currencySymbol, locale } = inputs;
    if (locale === 'en-IN') {
        if (Math.abs(amount) >= 10000000) return `${currencySymbol}${(amount / 10000000).toFixed(1)} Cr`;
        if (Math.abs(amount) >= 100000) return `${currencySymbol}${(amount / 100000).toFixed(1)} L`;
        return `${currencySymbol}${(amount / 1000).toFixed(0)}K`;
    } else {
        if (Math.abs(amount) >= 1000000) return `${currencySymbol}${(amount / 1000000).toFixed(1)}M`;
        return `${currencySymbol}${(amount / 1000).toFixed(0)}K`;
    }
}

function resetForm() {
    document.getElementById('calculatorForm').reset();
    selectMarket('sensex');
    selectDuration('perpetual');
    state.sipEnabled = false;
    document.getElementById('sipToggle').checked = false;
    document.getElementById('sipOptions').classList.remove('show');
    document.getElementById('outputSection').classList.remove('show');
    document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
}
