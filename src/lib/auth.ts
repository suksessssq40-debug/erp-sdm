import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'sdm_erp_dev_secret';

export interface AuthPayload {
  id: string;
  role: string;
}

export async function getUser(): Promise<AuthPayload | null> {
  const headersList = await headers();
  const token = headersList.get('authorization')?.split(' ')[1];

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function authorize(allowedRoles?: string[]) {
  const user = await getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new Error('Forbidden');
  }
  return user;
}
