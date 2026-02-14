
export function toRoman(num: number): string {
    const lookup: { [key: string]: number } = {
        M: 1000,
        CM: 900,
        D: 500,
        CD: 400,
        C: 100,
        XC: 90,
        L: 50,
        XL: 40,
        X: 10,
        IX: 9,
        V: 5,
        IV: 4,
        I: 1
    };
    let roman = '';
    for (const i in lookup) {
        while (num >= lookup[i]) {
            roman += i;
            num -= lookup[i];
        }
    }
    return roman;
}

export function generateInvoiceNumber(seq: number, date: Date): string {
    // Force Jakarta timezone for invoice components (Year/Month)
    // to avoid shifts due to server local time vs WIB.
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || date.getFullYear().toString());
    const month = parseInt(parts.find(p => p.type === 'month')?.value || (date.getMonth() + 1).toString());

    const yearRoman = toRoman(year);
    const monthRoman = toRoman(month);

    const seqPadded = seq.toString().padStart(4, '0');

    return `LUG-${yearRoman}-${monthRoman}-${seqPadded}`;
}
