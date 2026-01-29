/**
 * Retirement Planner - Simulation Module
 */

function runSimulationWithRebalancing(params) {
    const { startingCorpus, yearlyExpenses, equityRatio, yieldRate, debtReturn, dividendYield, inflationRate, taxRate, startYear, marketReturns, maxYears = 50 } = params;
    if (!startingCorpus || startingCorpus <= 0) {
        return { startYear: startYear, yearsSimulated: 0, finalYear: startYear, startingCorpus: 0, endingCorpus: 0, survived: false, ranOutYear: startYear, yearlyData: [] };
    }
    const debtRatio = 1 - equityRatio;
    let equity = startingCorpus * equityRatio, debt = startingCorpus * debtRatio, costBasis = equity, currentExpenses = yearlyExpenses;
    const yearlyData = [];
    const availableYears = Object.keys(marketReturns).map(Number).sort((a, b) => a - b);
    const endYear = availableYears[availableYears.length - 1];
    let year = startYear, simulationYear = 0, ranOut = false, ranOutYear = null;

    while (simulationYear < maxYears && year <= endYear && !ranOut) {
        simulationYear++;
        const marketReturn = marketReturns[year] !== undefined ? marketReturns[year] / 100 : 0.05;
        const totalEquityReturn = marketReturn + (dividendYield / 100);
        const debtReturnRate = debtReturn / 100, inflation = inflationRate / 100, tax = taxRate / 100, yield_rate = yieldRate / 100;
        currentExpenses *= (1 + inflation);
        const preTaxExpenses = currentExpenses / (1 - tax);
        const equityAfterReturn = equity * (1 + totalEquityReturn);
        const debtAfterReturn = debt * (1 + debtReturnRate);
        const equityYieldAmount = equityAfterReturn * yield_rate;
        let equityWithdrawal = 0, debtWithdrawal = 0, equityAfterWithdrawal = equityAfterReturn, debtAfterWithdrawal = debtAfterReturn;
        if (equityYieldAmount >= preTaxExpenses) {
            equityWithdrawal = preTaxExpenses;
            equityAfterWithdrawal = equityAfterReturn - equityWithdrawal;
        } else {
            equityWithdrawal = equityYieldAmount;
            debtWithdrawal = preTaxExpenses - equityYieldAmount;
            equityAfterWithdrawal = equityAfterReturn - equityWithdrawal;
            debtAfterWithdrawal = debtAfterReturn - debtWithdrawal;
        }
        if (equityAfterReturn > 0 && equityWithdrawal > 0) {
            costBasis = costBasis * (1 - equityWithdrawal / equityAfterReturn);
        }
        if (debtAfterWithdrawal < 0) {
            const shortfall = Math.abs(debtAfterWithdrawal);
            equityAfterWithdrawal -= shortfall;
            debtAfterWithdrawal = 0;
            if (equityAfterWithdrawal > 0) costBasis = costBasis * (1 - shortfall / (equityAfterWithdrawal + shortfall));
        }
        if (equityAfterWithdrawal <= 0) {
            ranOut = true;
            ranOutYear = year;
            equityAfterWithdrawal = 0;
        }
        let totalWealth = equityAfterWithdrawal + debtAfterWithdrawal, rebalancingTax = 0;
        if (!ranOut && totalWealth > 0) {
            const idealEquity = totalWealth * equityRatio;
            if (equityAfterWithdrawal > idealEquity) {
                const excessEquity = equityAfterWithdrawal - idealEquity;
                const gainRatio = equityAfterWithdrawal > costBasis ? (equityAfterWithdrawal - costBasis) / equityAfterWithdrawal : 0;
                rebalancingTax = Math.max(0, excessEquity * gainRatio * tax);
                costBasis = costBasis * (1 - excessEquity / equityAfterWithdrawal);
                totalWealth -= rebalancingTax;
            } else if (equityAfterWithdrawal < idealEquity) {
                costBasis += idealEquity - equityAfterWithdrawal;
            }
            equity = totalWealth * equityRatio;
            debt = totalWealth * debtRatio;
        } else {
            equity = equityAfterWithdrawal;
            debt = debtAfterWithdrawal;
        }
        yearlyData.push({ year: year, simulationYear: simulationYear, marketReturn: marketReturn * 100, expenses: currentExpenses, equityWithdrawal: equityWithdrawal, debtWithdrawal: debtWithdrawal, rebalancingTax: rebalancingTax, equity: equity, debt: debt, totalWealth: equity + debt, ranOut: ranOut });
        year++;
    }
    return { startYear: startYear, yearsSimulated: simulationYear, finalYear: year - 1, startingCorpus: startingCorpus, endingCorpus: equity + debt, survived: !ranOut, ranOutYear: ranOutYear, yearlyData: yearlyData };
}

function runMultipleSimulations(params, startingYears, marketReturns) {
    return startingYears.map(startYear => runSimulationWithRebalancing({ ...params, startYear: startYear, marketReturns: marketReturns }));
}

function findCorpusForDuration(params, targetYears, testYears, marketReturns) {
    if (!testYears || testYears.length === 0) {
        return { results: [], minCorpus: params.yearlyExpenses * targetYears, maxCorpus: params.yearlyExpenses * targetYears, avgCorpus: params.yearlyExpenses * targetYears };
    }
    const corpusResults = [];
    for (const startYear of testYears) {
        let low = params.yearlyExpenses * 5, high = params.yearlyExpenses * 100;
        const tolerance = params.yearlyExpenses * 0.05;
        let iterations = 0;
        while (high - low > tolerance && iterations < 50) {
            iterations++;
            const mid = (low + high) / 2;
            const result = runSimulationWithRebalancing({ ...params, startingCorpus: mid, startYear: startYear, marketReturns: marketReturns, maxYears: targetYears + 5 });
            if (result.survived && result.yearsSimulated >= targetYears) high = mid; else low = mid;
        }
        corpusResults.push({ startYear: startYear, corpus: (low + high) / 2 });
    }
    const corpusValues = corpusResults.map(r => r.corpus);
    return { results: corpusResults, minCorpus: Math.min(...corpusValues), maxCorpus: Math.max(...corpusValues), avgCorpus: corpusValues.reduce((a, b) => a + b, 0) / corpusValues.length };
}

function getValidStartingYears(dataRange, duration) {
    const validYears = [];
    for (let year = dataRange.startYear; year <= dataRange.endYear - duration; year++) validYears.push(year);
    return validYears;
}

function selectSimulationYears(validYears, count, mustInclude = [], marketReturns = null) {
    if (!validYears || validYears.length === 0) return [];
    const selectedYears = new Set();
    for (const year of mustInclude) if (validYears.includes(year)) selectedYears.add(year);
    if (marketReturns && selectedYears.size < count) {
        const goodYears = validYears.filter(y => marketReturns[y + 1] && marketReturns[y + 1] > 15);
        const badYears = validYears.filter(y => marketReturns[y + 1] && marketReturns[y + 1] < -10);
        if (goodYears.length > 0 && selectedYears.size < count) selectedYears.add(goodYears[Math.floor(Math.random() * goodYears.length)]);
        if (badYears.length > 0 && selectedYears.size < count) selectedYears.add(badYears[Math.floor(Math.random() * badYears.length)]);
    }
    const remainingYears = validYears.filter(y => !selectedYears.has(y));
    const step = Math.max(1, Math.floor(remainingYears.length / (count - selectedYears.size + 1)));
    let idx = 0;
    while (selectedYears.size < count && idx < remainingYears.length) { selectedYears.add(remainingYears[idx]); idx += step; }
    idx = 0;
    while (selectedYears.size < count && idx < remainingYears.length) { selectedYears.add(remainingYears[idx]); idx++; }
    return Array.from(selectedYears).sort((a, b) => a - b);
}

function analyzeSimulationResults(results) {
    if (!results || results.length === 0) return { totalSimulations: 0, survived: 0, failed: 0, survivalRate: 0, bestCase: null, worstCase: null, averageEndingCorpus: 0 };
    const survivedResults = results.filter(r => r.survived), failedResults = results.filter(r => !r.survived);
    let bestCase = null, worstCase = null;
    if (survivedResults.length > 0) {
        bestCase = survivedResults.reduce((best, curr) => curr.endingCorpus > best.endingCorpus ? curr : best);
        worstCase = survivedResults.reduce((worst, curr) => curr.endingCorpus < worst.endingCorpus ? curr : worst);
    }
    if (failedResults.length > 0) {
        const worstFailure = failedResults.reduce((worst, curr) => curr.yearsSimulated < worst.yearsSimulated ? curr : worst);
        if (!worstCase || worstFailure.yearsSimulated < worstCase.yearsSimulated) worstCase = worstFailure;
    }
    return { totalSimulations: results.length, survived: survivedResults.length, failed: failedResults.length, survivalRate: results.length > 0 ? (survivedResults.length / results.length) * 100 : 0, bestCase: bestCase, worstCase: worstCase, averageEndingCorpus: survivedResults.length > 0 ? survivedResults.reduce((sum, r) => sum + r.endingCorpus, 0) / survivedResults.length : 0 };
}
