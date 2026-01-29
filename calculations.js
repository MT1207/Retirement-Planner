/**
 * Retirement Planner - Calculation Module
 * FIXED: Yield calculation now matches CorposCalculater.py
 */

function calculateYield(annualExpenses, annualReturn, taxRate, inflationRate, maxYears = 100) {
    if (annualExpenses <= 0) {
        return { years: 0, yield: 0, totalBalance: 0, inflationAdjustedExpenses: 0 };
    }
    
    const r = annualReturn / 100;
    const tax = taxRate / 100;
    const inflation = inflationRate / 100;
    
    if (r <= inflation) {
        return { years: maxYears, yield: 1, totalBalance: annualExpenses * maxYears, inflationAdjustedExpenses: annualExpenses * Math.pow(1 + inflation, maxYears) };
    }
    
    const originalAnnualExpenses = annualExpenses;
    let inflationAdjustedExpenses = annualExpenses;
    let incomeAndReturnsTotal = annualExpenses;
    
    for (let year = 1; year <= maxYears; year++) {
        // Step 1: Inflation-adjust expenses
        inflationAdjustedExpenses *= (1 + inflation);
        
        // Step 2: Grow income + returns
        const returns = incomeAndReturnsTotal * r;
        incomeAndReturnsTotal += returns;
        
        // Step 3: Check target condition - FIXED FORMULA matching CorposCalculater.py
        // target = (2 * inflation_adjusted_income) + (tax * (inflation_adjusted_income - original_annual_income))
        const target = (2 * inflationAdjustedExpenses) + (tax * (inflationAdjustedExpenses - originalAnnualExpenses));
        
        if (incomeAndReturnsTotal >= target) {
            const totalBalance = calculateInvestmentFV(originalAnnualExpenses, inflationRate, annualReturn, year);
            const yieldOnInvestment = (inflationAdjustedExpenses / totalBalance) * 100;
            return { 
                years: year, 
                yield: yieldOnInvestment, 
                totalBalance: totalBalance, 
                inflationAdjustedExpenses: inflationAdjustedExpenses 
            };
        }
    }
    
    const finalBalance = calculateInvestmentFV(originalAnnualExpenses, inflationRate, annualReturn, maxYears);
    return { 
        years: maxYears, 
        yield: (inflationAdjustedExpenses / finalBalance) * 100, 
        totalBalance: finalBalance, 
        inflationAdjustedExpenses: inflationAdjustedExpenses 
    };
}

function calculateInvestmentFV(initialAmount, increaseRate, annualReturn, years) {
    if (years <= 0) return 0;
    
    let totalBalance = 0;
    let currentContribution = initialAmount;
    const r = annualReturn / 100;
    const i = increaseRate / 100;
    
    for (let year = 1; year <= years; year++) {
        const monthlyContribution = currentContribution / 12;
        for (let month = 1; month <= 12; month++) {
            const monthlyAmountInvested = totalBalance + monthlyContribution;
            const monthlyReturn = monthlyAmountInvested * (r / 12);
            totalBalance += monthlyReturn + monthlyContribution;
        }
        currentContribution *= (1 + i);
    }
    return totalBalance;
}

function calculateRequiredCorpus(yearlyExpenses, yieldRate) {
    if (yieldRate <= 0) return yearlyExpenses * 100;
    return yearlyExpenses / (yieldRate / 100);
}

function calculateInvestmentProjection(currentEquity, currentDebt, equityReturn, debtReturn, years) {
    if (years <= 0) {
        return { futureEquity: currentEquity, futureDebt: currentDebt, futureTotal: currentEquity + currentDebt, equityGrowth: 1, debtGrowth: 1 };
    }
    const fvEquity = currentEquity * Math.pow(1 + equityReturn / 100, years);
    const fvDebt = currentDebt * Math.pow(1 + debtReturn / 100, years);
    return {
        futureEquity: fvEquity, futureDebt: fvDebt, futureTotal: fvEquity + fvDebt,
        equityGrowth: currentEquity > 0 ? fvEquity / currentEquity : 0,
        debtGrowth: currentDebt > 0 ? fvDebt / currentDebt : 0
    };
}

function calculateInflationAdjustedExpenses(currentExpenses, inflationRate, years) {
    if (years <= 0) return currentExpenses;
    return currentExpenses * Math.pow(1 + inflationRate / 100, years);
}

function calculateSIPForTarget(target, annualReturn, stepUpRate, years) {
    if (target <= 0 || years <= 0) {
        return { monthlySIP: 0, finalMonthlySIP: 0, yearlySchedule: [], totalInvested: 0 };
    }
    let low = 0, high = target / (years * 6);
    const tolerance = 100;
    let iterations = 0;
    while (high - low > tolerance && iterations < 100) {
        iterations++;
        const mid = (low + high) / 2;
        const fv = calculateSIPFutureValue(mid, annualReturn, stepUpRate, years);
        if (fv < target) low = mid; else high = mid;
    }
    const initialMonthlySIP = (low + high) / 2;
    const yearlySchedule = [];
    let currentSIP = initialMonthlySIP, totalInvested = 0;
    for (let year = 1; year <= years; year++) {
        yearlySchedule.push({ year: year, monthlySIP: currentSIP, yearlySIP: currentSIP * 12 });
        totalInvested += currentSIP * 12;
        currentSIP *= (1 + stepUpRate / 100);
    }
    return { monthlySIP: initialMonthlySIP, finalMonthlySIP: yearlySchedule.length > 0 ? yearlySchedule[yearlySchedule.length - 1].monthlySIP : 0, yearlySchedule: yearlySchedule, totalInvested: totalInvested };
}

function calculateSIPFutureValue(initialMonthly, annualReturn, stepUpRate, years) {
    if (years <= 0 || initialMonthly <= 0) return 0;
    const monthlyRate = annualReturn / 100 / 12;
    const annualGrowth = 1 + annualReturn / 100;
    const stepUp = stepUpRate / 100;
    let totalFV = 0, currentMonthly = initialMonthly;
    for (let year = 1; year <= years; year++) {
        let yearEndFV = monthlyRate > 0 ? currentMonthly * (((Math.pow(1 + monthlyRate, 12) - 1) / monthlyRate)) * (1 + monthlyRate) : currentMonthly * 12;
        totalFV += yearEndFV * Math.pow(annualGrowth, years - year);
        currentMonthly *= (1 + stepUp);
    }
    return totalFV;
}

function calculateIdealAllocation(totalCorpus, equityRatio) {
    return { idealEquity: totalCorpus * equityRatio, idealDebt: totalCorpus * (1 - equityRatio) };
}

function calculateReallocation(currentEquity, currentDebt, idealEquityAtRetirement, idealDebtAtRetirement, equityReturn, debtReturn, years) {
    const equityRate = equityReturn / 100, debtRate = debtReturn / 100;
    const projectedEquity = currentEquity * Math.pow(1 + equityRate, years);
    const projectedDebt = currentDebt * Math.pow(1 + debtRate, years);
    const idealDebtNow = years > 0 ? idealDebtAtRetirement / Math.pow(1 + debtRate, years) : idealDebtAtRetirement;
    const debtExcessNow = currentDebt - idealDebtNow;
    let recommendation = { action: 'none', amount: 0, from: '', to: '', newEquity: currentEquity, newDebt: currentDebt, projectedEquity: projectedEquity, projectedDebt: projectedDebt, debtShortfallAtRetirement: 0, debtExcessAtRetirement: 0 };
    if (debtExcessNow > 1000) {
        recommendation = { action: 'move', amount: debtExcessNow, from: 'debt', to: 'equity', newEquity: currentEquity + debtExcessNow, newDebt: currentDebt - debtExcessNow, projectedEquity: (currentEquity + debtExcessNow) * Math.pow(1 + equityRate, years), projectedDebt: idealDebtAtRetirement, debtShortfallAtRetirement: 0, debtExcessAtRetirement: 0 };
    } else if (projectedDebt < idealDebtAtRetirement) {
        const shortfall = idealDebtAtRetirement - projectedDebt;
        recommendation = { action: 'none', amount: 0, from: '', to: '', newEquity: currentEquity, newDebt: currentDebt, projectedEquity: projectedEquity, projectedDebt: projectedDebt, debtShortfallAtRetirement: shortfall, debtExcessAtRetirement: 0, moveAtRetirement: shortfall };
    }
    return recommendation;
}

function calculateGapAnalysis(requiredCorpus, projectedCorpus) {
    const difference = projectedCorpus - requiredCorpus;
    return { required: requiredCorpus, projected: projectedCorpus, difference: Math.abs(difference), isSurplus: difference >= 0, status: difference >= 0 ? 'surplus' : 'shortfall' };
}
