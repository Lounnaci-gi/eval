import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string) {
  return await bcrypt.compare(plain, hash);
}
