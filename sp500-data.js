/**
 * S&P 500 Historical Data with P/E Ratios
 * Close prices are year-end values
 * P/E ratios are January 1 trailing P/E (from Robert Shiller / multpl.com)
 */

const SP500_DATA = {
    1985: 211.28,
    1986: 242.17,
    1987: 247.08,
    1988: 277.72,
    1989: 353.40,
    1990: 330.22,
    1991: 417.09,
    1992: 435.71,
    1993: 466.45,
    1994: 459.27,
    1995: 615.93,
    1996: 740.74,
    1997: 970.43,
    1998: 1229.23,
    1999: 1469.25,
    2000: 1320.28,
    2001: 1148.08,
    2002: 879.82,
    2003: 1111.92,
    2004: 1211.92,
    2005: 1248.29,
    2006: 1418.30,
    2007: 1468.36,
    2008: 903.25,
    2009: 1115.10,
    2010: 1257.64,
    2011: 1257.60,
    2012: 1426.19,
    2013: 1848.36,
    2014: 2058.90,
    2015: 2043.94,
    2016: 2238.83,
    2017: 2673.61,
    2018: 2506.85,
    2019: 3230.78,
    2020: 3756.07,
    2021: 4766.18,
    2022: 3839.50,
    2023: 4769.83,
    2024: 5881.63,
    2025: 6040.53
};

/**
 * S&P 500 P/E Ratios (January 1 values - trailing 12 month)
 * Source: Robert Shiller / multpl.com
 */
const SP500_PE = {
    1985: 10.36,
    1986: 14.28,
    1987: 18.01,
    1988: 14.02,
    1989: 11.82,
    1990: 15.13,
    1991: 15.35,
    1992: 25.93,
    1993: 22.50,
    1994: 21.34,
    1995: 14.89,
    1996: 18.08,
    1997: 19.53,
    1998: 24.29,
    1999: 32.92,
    2000: 29.04,
    2001: 27.55,
    2002: 46.17,  // Post dot-com crash, earnings collapsed
    2003: 31.43,
    2004: 22.73,
    2005: 19.99,
    2006: 18.07,
    2007: 17.36,
    2008: 21.46,
    2009: 70.91,  // Financial crisis, near-zero earnings
    2010: 20.70,
    2011: 16.30,
    2012: 14.87,
    2013: 17.03,
    2014: 18.15,
    2015: 20.02,
    2016: 22.18,
    2017: 23.59,
    2018: 24.97,
    2019: 19.60,
    2020: 24.88,
    2021: 35.96,
    2022: 23.11,
    2023: 22.82,
    2024: 25.01,
    2025: 28.16
};

// P/E Statistics
const SP500_PE_STATS = {
    averageSince1957: 19.69,
    median: 17.99,
    low: 7.39,     // 1980
    high: 70.91,   // 2009 (Financial crisis - earnings collapsed)
    normalHigh: 35.96, // 2021 (excluding crisis distortions)
    lowYear: 1980,
    highYear: 2009,
    source: "Robert Shiller / multpl.com"
};

function getSP500Returns() {
    const returns = {};
    const years = Object.keys(SP500_DATA).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < years.length; i++) {
        const year = years[i];
        const prevYear = years[i - 1];
        returns[year] = ((SP500_DATA[year] - SP500_DATA[prevYear]) / SP500_DATA[prevYear]) * 100;
    }
    return returns;
}

function getSP500PE() {
    return SP500_PE;
}

function getSP500PEStats() {
    return SP500_PE_STATS;
}
