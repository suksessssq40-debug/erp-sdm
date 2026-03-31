const d1 = new Date('2026-03-30T17:00:00.000Z');
console.log(d1.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
console.log(d1.toISOString());
