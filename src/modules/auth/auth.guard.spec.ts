import { JwtService } from '@nestjs/jwt';
import { vi } from 'vitest';
import { AuthGuard } from './auth.guard.js';

describe('AuthGuard', () => {
  it('should be defined', () => {
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;

    expect(new AuthGuard(jwtService)).toBeDefined();
  });
});
