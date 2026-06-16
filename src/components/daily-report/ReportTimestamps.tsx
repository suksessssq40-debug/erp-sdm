import React from 'react';
import { Calendar, History } from 'lucide-react';
import { formatReportDateTime, wasReportUpdated } from '@/utils/dateFormat';

interface ReportTimestampsProps {
  createdAt?: string;
  updatedAt?: string;
  variant?: 'card' | 'detail';
}

export function ReportTimestamps({ createdAt, updatedAt, variant = 'card' }: ReportTimestampsProps) {
  if (!createdAt) return null;

  const showUpdated = wasReportUpdated(createdAt, updatedAt);
  const isCard = variant === 'card';
  const textClass = isCard ? 'text-[9px] font-bold text-slate-400' : 'text-[9px] font-bold text-slate-500';

  return (
    <div className={`flex flex-col ${isCard ? 'items-end gap-0.5' : 'gap-1 mt-3'}`}>
      <div className="flex items-center gap-1.5">
        <Calendar size={10} className="text-emerald-500 shrink-0" />
        <span className={textClass}>Dibuat: {formatReportDateTime(createdAt)}</span>
      </div>
      {showUpdated && updatedAt && (
        <div className="flex items-center gap-1.5">
          <History size={10} className="text-amber-500 shrink-0" />
          <span className={textClass}>Diperbarui: {formatReportDateTime(updatedAt)}</span>
        </div>
      )}
    </div>
  );
}
