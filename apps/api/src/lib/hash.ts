import bcrypt from 'bcryptjs';

const COST = 12;

// Pre-computed dummy hash for timing attack prevention
let DUMMY_HASH: string;

export async function initDummyHash(): Promise<void> {
  DUMMY_HASH = await bcrypt.hash('dummy-password-for-timing', COST);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function comparePasswordSafe(password: string, hash: string | null): Promise<boolean> {
  // Always run bcrypt compare even if user not found (timing attack defense)
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
