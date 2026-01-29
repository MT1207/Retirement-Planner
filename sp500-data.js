/**
 * S&P 500 Historical Data (1985-2025)
 */
const SP500_DATA = {
    1985: 211.28, 1986: 242.17, 1987: 247.08, 1988: 277.72, 1989: 353.40,
    1990: 330.22, 1991: 417.09, 1992: 435.71, 1993: 466.45, 1994: 459.27,
    1995: 615.93, 1996: 740.74, 1997: 970.43, 1998: 1229.23, 1999: 1469.25,
    2000: 1320.28, 2001: 1148.08, 2002: 879.82, 2003: 1111.92, 2004: 1211.92,
    2005: 1248.29, 2006: 1418.30, 2007: 1468.36, 2008: 903.25, 2009: 1115.10,
    2010: 1257.64, 2011: 1257.60, 2012: 1426.19, 2013: 1848.36, 2014: 2058.90,
    2015: 2043.94, 2016: 2238.83, 2017: 2673.61, 2018: 2506.85, 2019: 3230.78,
    2020: 3756.07, 2021: 4766.18, 2022: 3839.50, 2023: 4769.83, 2024: 5881.63,
    2025: 6845.50
};

function getSP500Returns() {
    const returns = {};
    const years = Object.keys(SP500_DATA).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < years.length; i++) {
        const prevYear = years[i - 1];
        const currYear = years[i];
        returns[currYear] = ((SP500_DATA[currYear] - SP500_DATA[prevYear]) / SP500_DATA[prevYear]) * 100;
    }
    return returns;
}

function getSP500Range() {
    const years = Object.keys(SP500_DATA).map(Number).sort((a, b) => a - b);
    return { startYear: years[0], endYear: years[years.length - 1], totalYears: years.length };
}
