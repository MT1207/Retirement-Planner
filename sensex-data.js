/**
 * Sensex Historical Data (1991-2025)
 */
const SENSEX_DATA = {
    1991: 1908.85, 1992: 2615.37, 1993: 3346.06, 1994: 3926.90, 1995: 3110.49,
    1996: 3085.20, 1997: 3658.98, 1998: 3055.41, 1999: 5005.82, 2000: 3972.12,
    2001: 3262.33, 2002: 3377.28, 2003: 5838.96, 2004: 6602.69, 2005: 9397.93,
    2006: 13786.91, 2007: 20286.99, 2008: 9647.31, 2009: 17464.81, 2010: 20509.09,
    2011: 15454.92, 2012: 19426.71, 2013: 21170.68, 2014: 27499.42, 2015: 26117.54,
    2016: 26626.46, 2017: 34056.83, 2018: 36068.33, 2019: 41253.74, 2020: 47751.33,
    2021: 58253.82, 2022: 60840.74, 2023: 72240.26, 2024: 78139.01, 2025: 85220.60
};

function getSensexReturns() {
    const returns = {};
    const years = Object.keys(SENSEX_DATA).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < years.length; i++) {
        const prevYear = years[i - 1];
        const currYear = years[i];
        returns[currYear] = ((SENSEX_DATA[currYear] - SENSEX_DATA[prevYear]) / SENSEX_DATA[prevYear]) * 100;
    }
    return returns;
}

function getSensexRange() {
    const years = Object.keys(SENSEX_DATA).map(Number).sort((a, b) => a - b);
    return { startYear: years[0], endYear: years[years.length - 1], totalYears: years.length };
}
