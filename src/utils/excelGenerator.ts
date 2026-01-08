
import { utils, writeFile } from 'xlsx';

export const generateFinanceExcel = (
  title: string,
  data: (string | number)[][],
  columns: string[]
) => {
  // 1. Create Header Row
  const wsData = [
    [title.toUpperCase()],
    [`Generated at: ${new Date().toLocaleString('id-ID')}`],
    [''], // Spacer
    columns, // Check headers
    ...data // Body
  ];

  const ws = utils.aoa_to_sheet(wsData);

  // Styling (Col Widths)
  ws['!cols'] = columns.map(() => ({ wch: 20 })); // Default width 20
  
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Laporan");
  
  writeFile(wb, `${title.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
};
