import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const TOKEN_EXPIRY = '7d';

// Pre-hash the password at startup for comparison
let hashedPassword: string | null = null;

async function getHashedPassword(): Promise<string> {
  if (!hashedPassword) {
    const password = process.env.AUTH_PASSWORD || 'admin';
    hashedPassword = await bcrypt.hash(password, 10);
  }
  return hashedPassword;
}

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const expectedUsername = process.env.AUTH_USERNAME || 'admin';

  if (username !== expectedUsername) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Compare against the raw env password directly (no need to hash-then-compare for single user)
  const expectedPassword = process.env.AUTH_PASSWORD || 'admin';
  if (password !== expectedPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  res.json({ token, username });
});

router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    res.json({ valid: true, username: decoded.userId });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
