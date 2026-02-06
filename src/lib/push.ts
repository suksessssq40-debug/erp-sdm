import webpush from 'web-push';
import { prisma } from './prisma';

interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    }
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

let vapidSet = false;
function ensureVapid() {
    if (vapidSet) return;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
            'mailto:admin@suksesdigitalmedia.com',
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );
        vapidSet = true;
    }
}

export async function sendPushNotification(userId: string, payload: { title: string; body: string; icon?: string; url?: string }) {
    ensureVapid();
    if (!vapidSet) {
        console.warn('Push notification skipped: VAPID keys not configured');
        return [];
    }
    const subscriptions = await (prisma as any).pushSubscription.findMany({
        where: { userId }
    });

    const results = await Promise.allSettled(
        subscriptions.map(async (sub: any) => {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth
                        }
                    } as PushSubscriptionData,
                    JSON.stringify(payload)
                );
            } catch (error: any) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    // Subscription has expired or is no longer valid
                    await (prisma as any).pushSubscription.delete({ where: { id: sub.id } });
                }
                throw error;
            }
        })
    );

    return results;
}
