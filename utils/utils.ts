import * as fs from 'fs';
import * as path from 'path';

export function resolveDate(expr: string): Date {
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  if (expr === 'today') return base;

  const dayMatch = expr.match(/^today\+(\d+)$/);
  if (dayMatch) {
    base.setDate(base.getDate() + parseInt(dayMatch[1]));
    return base;
  }

  if (expr === 'today+month') {
    base.setMonth(base.getMonth() + 1);
    return base;
  }

  throw new Error(`Unknown date expression: ${expr}`);
}

export function formatDisplay(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export interface SearchRow {
  from: string;
  to: string;
  depart: Date;
  return: Date;
  guests: number;
}

export function loadSearchData(csvPath: string): SearchRow[] {
  const content = fs.readFileSync(path.resolve(csvPath), 'utf-8');
  const [headerLine, ...rows] = content.trim().split('\n');
  const headers = headerLine.split(',');

  return rows.map(row => {
    const values = row.split(',');
    const record: Record<string, string> = {};
    headers.forEach((h, i) => (record[h.trim()] = values[i].trim()));

    return {
      from: record.from,
      to: record.to,
      depart: resolveDate(record.depart),
      return: resolveDate(record.return),
      guests: parseInt(record.guests),
    };
  });
}
