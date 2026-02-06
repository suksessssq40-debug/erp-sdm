
import { prisma } from './prisma';

/**
 * Recursively serializes BigInt and Date objects in any data structure.
 * BigInt -> Number
 * Date -> ISO String
 */
export const serialize = (data: any): any => {
    if (data === null || data === undefined) return data;
    if (typeof data === 'bigint') return Number(data);
    if (data instanceof Date) return data.toISOString();
    if (Array.isArray(data)) return data.map(serialize);
    if (typeof data === 'object') {
        const obj: any = {};
        for (const key in data) {
            obj[key] = serialize(data[key]);
        }
        return obj;
    }
    return data;
};

/**
 * Returns current date and time in Asia/Jakarta timezone.
 */
export const getJakartaNow = () => {
    const now = new Date();
    const jakartaFormatter = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = jakartaFormatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

    return {
        isoDate: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
        isoTime: `${getPart('hour')}:${getPart('minute')}`,
        full: `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`,
        parts: {
            yyyy: getPart('year'),
            mm: getPart('month'),
            dd: getPart('day'),
            hh: getPart('hour'),
            min: getPart('minute'),
            sec: getPart('second')
        }
    };
};

/**
 * Unified system logging to the database.
 */
export const recordSystemLog = async (params: {
    actorId?: string;
    actorName?: string;
    actorRole?: string;
    actionType: string;
    details: string;
    targetObj?: string;
    metadata?: any;
    tenantId: string;
}) => {
    try {
        await (prisma as any).systemLog.create({
            data: {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: BigInt(Date.now()),
                actorId: params.actorId || 'SYSTEM',
                actorName: params.actorName || 'System Process',
                actorRole: params.actorRole || 'SYSTEM',
                actionType: params.actionType,
                details: params.details,
                targetObj: params.targetObj,
                metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
                tenantId: params.tenantId
            }
        });
    } catch (e) {
        console.error('[recordSystemLog Error]', e);
    }
};
