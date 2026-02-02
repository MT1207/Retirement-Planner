/**
 * Retirement Planner - Main Application
 * Updated: Sensex default 12%, S&P default 9%, no PDF
 */

const MARKET_DEFAULTS = {
    sensex: { currency: '₹', currencySymbol: '₹', locale: 'en-IN', averageReturn: 12, taxRate: 12.5, debtReturn: 7, inflation: 7, dataRange: { startYear: 1994, endYear: 2025 } },
    sp500: { currency: '$', currencySymbol: '$', locale: 'en-US', averageReturn: 9, taxRate: 15, debtReturn: 5, inflation: 3, dataRange: { startYear: 1986, endYear: 2025 } }
};

let state = { market: 'sensex', duration: 'perpetual', sipEnabled: false, results: null, planResults: null };

document.addEventListener('DOMContentLoaded', function() {
    selectMarket('sensex');
    selectDuration('perpetual');
    updatePlanMarket();
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
    // Initialize Tab 1 market
    updatePlanMarket();
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
        
        // Run perpetual stress test across ALL starting years with both allocations
        const marketReturns = inputs.market === 'sensex' ? getSensexReturns() : getSP500Returns();
        const peData = inputs.market === 'sensex' ? (typeof getSensexPE === 'function' ? getSensexPE() : {}) : (typeof getSP500PE === 'function' ? getSP500PE() : {});
        const expensesForSim = inputs.yearsToRetire === 0 ? inputs.yearlyExpenses : calculateInflationAdjustedExpenses(inputs.yearlyExpenses, inputs.inflation, inputs.yearsToRetire);
        const allYears = Object.keys(marketReturns).map(Number).sort((a, b) => a - b);
        const validYears = allYears.filter(y => y <= allYears[allYears.length - 1] - 10); // need at least 10 years of data
        
        const failures = [];
        validYears.forEach(startYear => {
            const baseParams = {
                startingCorpus: selectedCorpus.corpus,
                yearlyExpenses: expensesForSim,
                yieldRate: yieldResult.yield,
                debtReturn: inputs.debtReturn,
                inflationRate: inputs.inflation,
                taxRate: inputs.taxRate,
                startYear: startYear,
                marketReturns: marketReturns,
                maxYears: 50
            };
            const r85 = runSimulationWithRebalancing({ ...baseParams, equityRatio: 0.85 });
            const r60 = runSimulationWithRebalancing({ ...baseParams, equityRatio: 0.60 });
            if (!r85.survived || !r60.survived) {
                const prevPE = peData[startYear - 1];
                failures.push({
                    startYear,
                    prevPE: prevPE || null,
                    s85: { survived: r85.survived, yearsLasted: r85.yearsSimulated, ranOutYear: r85.ranOutYear },
                    s60: { survived: r60.survived, yearsLasted: r60.yearsSimulated, ranOutYear: r60.ranOutYear }
                });
            }
        });
        
        if (failures.length === 0) {
            html += `
            <div style="padding: 0.75rem; background: var(--success-bg, #f0fdf4); border: 1px solid var(--success, #22c55e); border-radius: var(--radius-md); margin-top: 0.75rem;">
                <div style="font-size: 0.875rem; color: var(--success, #22c55e); font-weight: 600;">✓ Stress Test Passed</div>
                <div class="text-muted" style="font-size: 0.8rem; margin-top: 0.25rem;">Your perpetual corpus survived all ${validYears.length} historical starting years (${validYears[0]}–${validYears[validYears.length - 1]}) in both 85:15 and 60:40 allocations.</div>
            </div>`;
        } else {
            html += `
            <div style="padding: 0.75rem; background: var(--danger-bg, #fef2f2); border: 1px solid var(--danger, #ef4444); border-radius: var(--radius-md); margin-top: 0.75rem;">
                <div style="font-size: 0.875rem; color: var(--danger, #ef4444); font-weight: 600;">⚠ Stress Test Warning</div>
                <div class="text-muted" style="font-size: 0.8rem; margin-top: 0.25rem;">Your perpetual corpus ran out in ${failures.length} of ${validYears.length} historical scenarios:</div>
                <table class="data-table" style="margin-top: 0.5rem; font-size: 0.8rem;">
                    <thead><tr><th>Starting Year</th><th class="text-center">Prev P/E</th><th class="text-right">85:15</th><th class="text-right">60:40</th></tr></thead><tbody>`;
            failures.forEach(f => {
                const peColor = f.prevPE && f.prevPE > 25 ? 'var(--danger)' : f.prevPE && f.prevPE < 15 ? 'var(--success)' : 'var(--text-secondary)';
                const peLabel = f.prevPE && f.prevPE > 25 ? ' (High)' : f.prevPE && f.prevPE < 15 ? ' (Low)' : '';
                const peText = f.prevPE ? `<span style="color: ${peColor}; font-weight: 500;">${f.prevPE}${peLabel}</span>` : '-';
                const text85 = f.s85.survived ? `<span style="color: var(--success);">Survived</span>` : `<span style="color: var(--danger);">${f.s85.yearsLasted} yrs (${f.s85.ranOutYear})</span>`;
                const text60 = f.s60.survived ? `<span style="color: var(--success);">Survived</span>` : `<span style="color: var(--danger);">${f.s60.yearsLasted} yrs (${f.s60.ranOutYear})</span>`;
                html += `<tr><td>${f.startYear}</td><td class="text-center">${peText}</td><td class="text-right">${text85}</td><td class="text-right">${text60}</td></tr>`;
            });
            html += `</tbody></table>
            </div>`;
        }
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

// ============================================
// TAB 1: RETIREMENT PLANNING
// ============================================

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    
    // Autofill Tab 2 from Tab 1 values
    if (tab === 'crunch') {
        const planMonthly = parseFloat(document.getElementById('planMonthly').value);
        if (planMonthly && planMonthly > 0) {
            const planEquity = parseFloat(document.getElementById('planEquity').value) || 0;
            const planDebt = parseFloat(document.getElementById('planDebt').value) || 0;
            const planYears = document.getElementById('planYears').value;
            const planMarket = document.getElementById('planMarket').value;
            
            document.getElementById('yearlyExpenses').value = Math.round(planMonthly * 12);
            document.getElementById('currentEquity').value = planEquity;
            document.getElementById('currentDebt').value = planDebt;
            if (planYears !== '') document.getElementById('yearsToRetire').value = planYears;
            
            selectMarket(planMarket);
            selectDuration('perpetual');
            
            // Enable SIP if Tab 1 showed a shortfall
            if (state.planResults && !state.planResults.gapAnalysis.isSurplus) {
                document.getElementById('sipToggle').checked = true;
                state.sipEnabled = true;
                document.getElementById('sipOptions').classList.add('show');
            }
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePlanMarket() {
    const market = document.getElementById('planMarket').value;
    const symbol = MARKET_DEFAULTS[market].currencySymbol;
    document.querySelectorAll('.currency-symbol-plan').forEach(el => el.textContent = symbol);
}

function calculatePlan() {
    const errorEl = document.getElementById('planError');
    const monthly = parseFloat(document.getElementById('planMonthly').value);
    const yearsVal = document.getElementById('planYears').value;
    
    // Clear previous errors
    document.querySelectorAll('.story-input.error').forEach(el => el.classList.remove('error'));
    if (errorEl) errorEl.classList.remove('show');
    
    if (!monthly || monthly <= 0) {
        if (errorEl) { errorEl.textContent = 'Please enter your monthly expenses.'; errorEl.classList.add('show'); }
        document.getElementById('planMonthly').classList.add('error');
        document.getElementById('planMonthly').focus();
        return;
    }
    if (yearsVal === '' || isNaN(parseInt(yearsVal)) || parseInt(yearsVal) < 0) {
        if (errorEl) { errorEl.textContent = 'Please enter years to retirement (0 or more).'; errorEl.classList.add('show'); }
        document.getElementById('planYears').classList.add('error');
        document.getElementById('planYears').focus();
        return;
    }
    
    const equity = parseFloat(document.getElementById('planEquity').value) || 0;
    const debt = parseFloat(document.getElementById('planDebt').value) || 0;
    const market = document.getElementById('planMarket').value;
    const years = parseInt(yearsVal);
    const defaults = MARKET_DEFAULTS[market];
    
    const inputs = {
        market, currency: defaults.currency, currencySymbol: defaults.currencySymbol, locale: defaults.locale,
        yearlyExpenses: monthly * 12, currentEquity: equity, currentDebt: debt, yearsToRetire: years,
        duration: 'perpetual', averageReturn: defaults.averageReturn, taxRate: defaults.taxRate,
        debtReturn: defaults.debtReturn, inflation: defaults.inflation,
        sipEnabled: true, sipStepUp: 10, dataRange: defaults.dataRange
    };
    
    try {
        const results = performCalculations(inputs);
        state.planResults = results;
        renderPlanResults(results);
    } catch (e) {
        console.error('Calculation error:', e);
        if (errorEl) { errorEl.textContent = 'Something went wrong. Please check your inputs.'; errorEl.classList.add('show'); }
    }
}

function computePlanStressTest(results) {
    const { inputs, selectedCorpus, yield: yieldResult, expensesAtRetirement } = results;
    const marketReturns = inputs.market === 'sensex' ? getSensexReturns() : getSP500Returns();
    const peData = inputs.market === 'sensex' ? (typeof getSensexPE === 'function' ? getSensexPE() : {}) : (typeof getSP500PE === 'function' ? getSP500PE() : {});
    const expensesForSim = inputs.yearsToRetire === 0 ? inputs.yearlyExpenses : expensesAtRetirement;
    const allYears = Object.keys(marketReturns).map(Number).sort((a, b) => a - b);
    const validYears = allYears.filter(y => y <= allYears[allYears.length - 1] - 10);
    const failures = [];
    
    validYears.forEach(startYear => {
        const baseParams = { startingCorpus: selectedCorpus.corpus, yearlyExpenses: expensesForSim, yieldRate: yieldResult.yield, debtReturn: inputs.debtReturn, inflationRate: inputs.inflation, taxRate: inputs.taxRate, startYear, marketReturns, maxYears: 50 };
        const r85 = runSimulationWithRebalancing({ ...baseParams, equityRatio: 0.85 });
        const r60 = runSimulationWithRebalancing({ ...baseParams, equityRatio: 0.60 });
        if (!r85.survived || !r60.survived) {
            failures.push({ startYear, prevPE: peData[startYear - 1] || null, s85: { survived: r85.survived, yearsLasted: r85.yearsSimulated, ranOutYear: r85.ranOutYear }, s60: { survived: r60.survived, yearsLasted: r60.yearsSimulated, ranOutYear: r60.ranOutYear } });
        }
    });
    
    return { totalCount: validYears.length, failCount: failures.length, failures, peData };
}

function renderPlanResults(results) {
    const { inputs, selectedCorpus, projection, gapAnalysis, sipPlan, yield: yieldResult, expensesAtRetirement } = results;
    const isSurplus = gapAnalysis.isSurplus;
    
    // Q1: How much do I need?
    document.getElementById('planA1').innerHTML = `
        <div class="answer-hero">${formatCurrency(selectedCorpus.corpus, inputs)}</div>
        <div class="answer-explain">This retirement fund will generate ${formatCurrency(expensesAtRetirement, inputs)} every year — enough to cover your expenses forever, even with ${inputs.inflation}% inflation.</div>`;
    
    // Q2: Am I on track?
    const ratio = selectedCorpus.corpus > 0 ? projection.futureTotal / selectedCorpus.corpus : 0;
    const pct = Math.round(ratio * 100);
    const barPct = Math.min(pct, 100);
    const barClass = isSurplus ? 'surplus' : 'shortfall';
    const projLabel = inputs.yearsToRetire > 0
        ? `Your investments will grow to <strong>${formatCurrency(projection.futureTotal, inputs)}</strong> in ${inputs.yearsToRetire} years.`
        : `Your current investments total <strong>${formatCurrency(projection.futureTotal, inputs)}</strong>.`;
    const gapLabel = isSurplus
        ? `That's <strong>${formatCurrency(gapAnalysis.difference, inputs)} more</strong> than you need.`
        : `You need <strong>${formatCurrency(gapAnalysis.difference, inputs)} more</strong> to be fully covered.`;
    
    document.getElementById('planA2').innerHTML = `
        <div class="progress-wrap">
            <div class="progress-bar-bg">
                <div class="progress-bar-fill ${barClass}" style="width: ${barPct}%">${pct}%</div>
            </div>
            <div class="progress-labels">
                <div class="progress-label-left">Your investments → ${formatCurrency(projection.futureTotal, inputs)}</div>
                <div class="progress-label-right">Need ${formatCurrency(selectedCorpus.corpus, inputs)}</div>
            </div>
        </div>
        <div class="answer-explain">${projLabel} ${gapLabel}</div>`;
    
    // Q3: Action / Cushion
    if (isSurplus) {
        document.getElementById('planQ3Title').textContent = 'How much extra cushion do I have?';
        document.getElementById('planA3').innerHTML = `
            <div class="answer-hero success">${formatCurrency(gapAnalysis.difference, inputs)}</div>
            <div class="answer-explain">${inputs.yearsToRetire > 0 ? "Even without investing more, you're covered." : "You already have more than enough."} Your surplus provides a comfortable buffer against unexpected expenses or market downturns.</div>`;
    } else if (sipPlan && sipPlan.totalInitialSIP > 0) {
        document.getElementById('planQ3Title').textContent = 'What should I save every month?';
        document.getElementById('planA3').innerHTML = `
            <div class="answer-hero">${formatCurrency(sipPlan.totalInitialSIP, inputs)}/month</div>
            <div class="answer-explain">Start with this amount and increase it by 10% every year. In ${inputs.yearsToRetire} years, you'll have invested a total of ${formatCurrency(sipPlan.totalInvested, inputs)} to close the gap.</div>`;
    } else if (!isSurplus && inputs.yearsToRetire === 0) {
        document.getElementById('planQ3Title').textContent = 'What should I do?';
        document.getElementById('planA3').innerHTML = `
            <div class="answer-hero warning">${formatCurrency(gapAnalysis.difference, inputs)} short</div>
            <div class="answer-explain">Since you're retiring now, a monthly SIP won't help. Consider consulting a financial advisor, or adjust your expected expenses to match your current savings.</div>`;
    } else {
        document.getElementById('planQ3Title').textContent = 'What should I do?';
        document.getElementById('planA3').innerHTML = `<div class="answer-explain">Consider speaking with a financial advisor about strategies to bridge the gap.</div>`;
    }
    
    // Pre-compute stress test once (used by Q4 and Deeper Dive)
    const stressData = computePlanStressTest(results);
    
    // Q4: Stress test (simplified)
    const marketLabel = inputs.market === 'sensex' ? 'Indian market' : 'US market';
    if (stressData.totalCount === 0) {
        document.getElementById('planA4').innerHTML = '<div class="answer-explain">Insufficient historical data for stress testing.</div>';
    } else if (stressData.failCount === 0) {
        document.getElementById('planA4').innerHTML = `
            <div class="stress-pass">
                <div class="stress-pass-text">✓ Yes, in all historical scenarios.</div>
                <div class="stress-pass-detail">We tested your retirement fund against ${stressData.totalCount} years of real ${marketLabel} history (including 2008). It survived every time.</div>
            </div>`;
    } else {
        const passCount = stressData.totalCount - stressData.failCount;
        document.getElementById('planA4').innerHTML = `
            <div class="stress-warn">
                <div class="stress-warn-text">⚠ Mostly yes — survived ${passCount} of ${stressData.totalCount} scenarios.</div>
                <div class="stress-warn-detail">It struggled in ${stressData.failCount} scenario${stressData.failCount > 1 ? 's' : ''} when markets were at extreme valuations. See Deeper Dive for details.</div>
            </div>`;
    }
    
    // Deeper Dive
    renderDeeperDive(results, stressData);
    
    // Show results, collapse deeper dive
    const resultsEl = document.getElementById('planResults');
    resultsEl.classList.add('show');
    document.getElementById('deeperDiveSection').classList.remove('open');
    setTimeout(() => resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function renderDeeperDive(results, stressData) {
    const { inputs, corpusOptions, selectedCorpus, expensesAtRetirement, yield: yieldResult, reallocation, sipPlan, simulation, simulationCorpus } = results;
    let html = '';
    
    // 1. Duration alternatives
    html += '<div class="dd-item"><div class="dd-question">What if I don\'t need it to last forever?</div><div class="dd-answer">';
    [30, 25, 20, 15].forEach((yrs, idx) => {
        const opt = corpusOptions[yrs.toString()];
        if (opt) {
            const saved = selectedCorpus.corpus - opt.corpus;
            const border = idx < 3 ? 'border-bottom: 1px solid var(--border);' : '';
            html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; ${border}"><span style="font-weight: 500;">${yrs} years</span><span><strong>${formatCurrency(opt.corpus, inputs)}</strong> <span class="text-muted" style="font-size: 0.8125rem;">(save ${formatCurrency(saved, inputs)})</span></span></div>`;
        }
    });
    html += '</div></div>';
    
    // 2. Inflation projection
    if (inputs.yearsToRetire > 0) {
        const mNow = inputs.yearlyExpenses / 12, mRetire = expensesAtRetirement / 12;
        html += `<div class="dd-item"><div class="dd-question">What will my expenses be at retirement?</div><div class="dd-answer">${formatCurrency(mNow, inputs)}/month today → <strong>${formatCurrency(mRetire, inputs)}/month</strong> in ${inputs.yearsToRetire} years (${inputs.inflation}% inflation).</div></div>`;
    }
    
    // 3. Allocation
    const ct = inputs.currentEquity + inputs.currentDebt;
    const eqP = ct > 0 ? Math.round(inputs.currentEquity / ct * 100) : 0;
    const dtP = ct > 0 ? Math.round(inputs.currentDebt / ct * 100) : 0;
    let allocNote = '';
    if (reallocation.action === 'move' && reallocation.from === 'debt') {
        allocNote = `<br><strong>Action:</strong> Move ${formatCurrency(reallocation.amount, inputs)} from debt to equity.`;
    } else if (reallocation.debtShortfallAtRetirement > 0) {
        allocNote = `<br><strong>Plan:</strong> At retirement, move ${formatCurrency(reallocation.debtShortfallAtRetirement, inputs)} from equity to debt.`;
    }
    html += `<div class="dd-item"><div class="dd-question">How should I split equity and debt?</div><div class="dd-answer">Target: <strong>85% equity, 15% debt</strong><br>Current: ${eqP}% equity, ${dtP}% debt${allocNote}</div></div>`;
    
    // 4. SIP schedule
    if (sipPlan && sipPlan.equitySIP && sipPlan.equitySIP.yearlySchedule && sipPlan.equitySIP.yearlySchedule.length > 0) {
        let rows = '';
        sipPlan.equitySIP.yearlySchedule.forEach((item, i) => { rows += `<tr><td>Year ${i + 1}</td><td class="text-right">${formatCurrency(item.monthlySIP, inputs)}</td></tr>`; });
        html += `<div class="dd-item"><div class="dd-question">Year-by-year SIP schedule</div><div class="dd-answer"><div style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.5rem;">10% step-up yearly | Total invested: ${formatCurrency(sipPlan.totalInvested, inputs)}</div><table class="data-table" style="font-size: 0.8125rem;"><thead><tr><th>Year</th><th class="text-right">Monthly SIP</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }
    
    // 5. Yield
    html += `<div class="dd-item"><div class="dd-question">What is my safe withdrawal rate?</div><div class="dd-answer">Your safe annual yield is <strong>${yieldResult.yield.toFixed(2)}%</strong>. This accounts for ${inputs.averageReturn}% average return, ${inputs.taxRate}% tax, and ${inputs.inflation}% inflation.</div></div>`;
    
    // 6. Stress test failure details
    if (stressData && stressData.failures.length > 0) {
        let stressHtml = '<table class="data-table" style="font-size: 0.8125rem;"><thead><tr><th>Start Year</th><th class="text-center">Prev P/E</th><th class="text-right">85:15</th><th class="text-right">60:40</th></tr></thead><tbody>';
        stressData.failures.forEach(f => {
            const peColor = f.prevPE && f.prevPE > 25 ? 'var(--danger)' : f.prevPE && f.prevPE < 15 ? 'var(--success)' : 'var(--text-secondary)';
            const peLabel = f.prevPE && f.prevPE > 25 ? ' (High)' : f.prevPE && f.prevPE < 15 ? ' (Low)' : '';
            const peText = f.prevPE ? `<span style="color: ${peColor}; font-weight: 500;">${f.prevPE}${peLabel}</span>` : '-';
            const t85 = f.s85.survived ? '<span style="color: var(--success);">Survived</span>' : `<span style="color: var(--danger);">${f.s85.yearsLasted} yrs (${f.s85.ranOutYear})</span>`;
            const t60 = f.s60.survived ? '<span style="color: var(--success);">Survived</span>' : `<span style="color: var(--danger);">${f.s60.yearsLasted} yrs (${f.s60.ranOutYear})</span>`;
            stressHtml += `<tr><td>${f.startYear}</td><td class="text-center">${peText}</td><td class="text-right">${t85}</td><td class="text-right">${t60}</td></tr>`;
        });
        stressHtml += '</tbody></table>';
        html += `<div class="dd-item"><div class="dd-question">Stress test failure details</div><div class="dd-answer">${stressHtml}</div></div>`;
    }
    
    // 7. Historical simulation (sample years)
    if (simulation && simulation.split85_15 && simulation.split85_15.results && simulation.split85_15.results.length > 0) {
        const sim85 = simulation.split85_15, sim60 = simulation.split60_40;
        const peData = stressData ? stressData.peData : {};
        const isSurp = results.gapAnalysis.isSurplus;
        
        const fmtPE = (year) => {
            const pe = peData[year - 1];
            if (!pe) return '-';
            let color = 'var(--text-secondary)', label = '';
            if (pe < 15) { color = 'var(--success)'; label = ' (Low)'; }
            else if (pe > 25) { color = 'var(--danger)'; label = ' (High)'; }
            return `<span style="color: ${color}; font-weight: 500;">${typeof pe === 'number' && pe % 1 !== 0 ? pe.toFixed(1) : pe}${label}</span>`;
        };
        
        let simHtml = '<table class="data-table" style="font-size: 0.8125rem;"><thead><tr><th>Start</th><th class="text-center">P/E</th>';
        simHtml += isSurp ? '<th class="text-right">85:15 End</th><th class="text-right">60:40 End</th>' : '<th class="text-right">85:15</th><th class="text-right">60:40</th><th>Status</th>';
        simHtml += '</tr></thead><tbody>';
        for (let i = 0; i < sim85.results.length; i++) {
            const r85 = sim85.results[i], r60 = sim60.results[i];
            simHtml += `<tr><td>${r85.startYear}</td><td class="text-center">${fmtPE(r85.startYear)}</td>`;
            if (isSurp) {
                simHtml += `<td class="text-right">${r85.survived ? formatCurrencyShort(r85.endingCorpus, inputs) : 'Out ' + r85.ranOutYear}</td><td class="text-right">${r60.survived ? formatCurrencyShort(r60.endingCorpus, inputs) : 'Out ' + r60.ranOutYear}</td>`;
            } else {
                const status = !r85.survived || !r60.survived ? '<span style="color: var(--danger);">Ran out</span>' : '<span style="color: var(--success);">OK</span>';
                simHtml += `<td class="text-right">${r85.yearsSimulated} yrs</td><td class="text-right">${r60.yearsSimulated} yrs</td><td>${status}</td>`;
            }
            simHtml += '</tr>';
        }
        simHtml += '</tbody></table>';
        html += `<div class="dd-item"><div class="dd-question">Historical simulation (sample years)</div><div class="dd-answer"><div style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.5rem;">Corpus: ${formatCurrency(simulationCorpus, inputs)} | ${inputs.market === 'sensex' ? 'Sensex' : 'S&P 500'}</div>${simHtml}</div></div>`;
    }
    
    document.getElementById('deeperDiveContent').innerHTML = html;
}

function toggleDeeperDive() {
    document.getElementById('deeperDiveSection').classList.toggle('open');
}
