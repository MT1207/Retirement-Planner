/**
 * Sensex Historical Data with P/E Ratios
 * Close prices are year-end values
 * P/E ratios are year-end trailing P/E
 */

const SENSEX_DATA = {
    1993: 3346.06,
    1994: 3926.90,
    1995: 3110.49,
    1996: 3085.20,
    1997: 3658.98,
    1998: 3055.41,
    1999: 5005.82,
    2000: 3972.12,
    2001: 3262.33,
    2002: 3377.28,
    2003: 5838.96,
    2004: 6602.69,
    2005: 9397.93,
    2006: 13786.91,
    2007: 20286.99,
    2008: 9647.31,
    2009: 17464.81,
    2010: 20509.09,
    2011: 15454.92,
    2012: 19426.71,
    2013: 21170.68,
    2014: 27499.42,
    2015: 26117.54,
    2016: 26626.46,
    2017: 34056.83,
    2018: 36068.33,
    2019: 41253.74,
    2020: 47751.33,
    2021: 58253.82,
    2022: 60840.74,
    2023: 72240.26,
    2024: 78139.01,
    2025: 85220.60
};

/**
 * Sensex P/E Ratios (Year-end values)
 * Source: BSE India / User provided data
 */
const SENSEX_PE = {
    1993: 45.0,
    1994: 24.0,
    1995: 16.0,
    1996: 15.0,
    1997: 13.0,
    1998: 18.0,
    1999: 25.0,
    2000: 20.8,
    2001: 15.6,
    2002: 14.4,
    2003: 17.3,
    2004: 18.2,
    2005: 18.1,
    2006: 22.5,
    2007: 26.9,
    2008: 12.2,
    2009: 21.8,
    2010: 23.0,
    2011: 17.0,
    2012: 18.0,
    2013: 18.0,
    2014: 19.0,
    2015: 20.0,
    2016: 21.0,
    2017: 25.0,
    2018: 23.5,
    2019: 26.0,
    2020: 33.0,
    2021: 28.0,
    2022: 23.7,
    2023: 25.5,
    2024: 22.85,
    2025: 23.5
};

// P/E Statistics
const SENSEX_PE_STATS = {
    average: 21.5,
    median: 20.0,
    low: 12.2,    // 2008 (Financial Crisis)
    high: 45.0,   // 1993 (Post-liberalization boom)
    lowYear: 2008,
    highYear: 1993
};

function getSensexReturns() {
    const returns = {};
    const years = Object.keys(SENSEX_DATA).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < years.length; i++) {
        const year = years[i];
        const prevYear = years[i - 1];
        returns[year] = ((SENSEX_DATA[year] - SENSEX_DATA[prevYear]) / SENSEX_DATA[prevYear]) * 100;
    }
    return returns;
}

function getSensexPE() {
    return SENSEX_PE;
}

function getSensexPEStats() {
    return SENSEX_PE_STATS;
}
