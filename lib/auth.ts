import { PrivyClient } from '@privy-io/server-auth';

let _privy: PrivyClient | null = null;
function privy() {
  if (!_privy) {
    _privy = new PrivyClient(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
      process.env.PRIVY_APP_SECRET!
    );
  }
  return _privy;
}

export async function verifyAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization token');
  }
  const token = authHeader.slice(7);
  const { userId } = await privy().verifyAuthToken(token);
  return userId;
}

export async function getPrivyUserEmail(userId: string): Promise<string> {
  try {
    const user = await privy().getUser(userId);
    return user.email?.address || user.google?.email || '';
  } catch {
    return '';
  }
}
