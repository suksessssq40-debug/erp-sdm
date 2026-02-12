
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
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12

    const yearRoman = toRoman(year);
    const monthRoman = toRoman(month);

    const seqPadded = seq.toString().padStart(4, '0');

    return `LUG-${yearRoman}-${monthRoman}-${seqPadded}`;
}
