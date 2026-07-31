/**
 * FIO API endpoint tests — INTEGRATION.
 *
 * Split out of `tests/fio-integration.test.ts` (2026-07-25). These four cross a
 * real network boundary: they issue HTTP requests against TEST_BASE_URL, which
 * defaults to the deployed dev host. The remaining ~26 tests in that file are
 * pure and stay in the default suite.
 *
 * Moved because it crosses a boundary, NOT because it was failing -- the
 * operator's guardrail. Prerequisite: a reachable app at TEST_BASE_URL.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('FIO API Endpoints', () => {
  describe('POST /api/identity/fio/check-availability', () => {
    it('should return availability status for valid handle', async () => {
      const response = await fetch(`${BASE_URL}/api/identity/fio/check-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: 'test123@aigent' })
      });

      const data = await response.json();
      expect(data).toHaveProperty('ok');
      expect(data).toHaveProperty('available');
      expect(data).toHaveProperty('handle');
    });

    it('should return error for invalid handle format', async () => {
      const response = await fetch(`${BASE_URL}/api/identity/fio/check-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: 'invalid' })
      });

      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data).toHaveProperty('error');
    });

    it('should return error when handle is missing', async () => {
      const response = await fetch(`${BASE_URL}/api/identity/fio/check-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/identity/fio/lookup', () => {
    it('should return handle information for registered handle', async () => {
      const response = await fetch(`${BASE_URL}/api/identity/fio/lookup?handle=test@fio`);

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('ok');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('owner');
        expect(data.data).toHaveProperty('expiration');
      }
    });

    it('should return 404 for non-existent handle', async () => {
      const response = await fetch(`${BASE_URL}/api/identity/fio/lookup?handle=nonexistent999@fio`);

      if (response.status === 404) {
        const data = await response.json();
        expect(data.ok).toBe(false);
        expect(data.error).toContain('not found');
      }
    });

    it('should return error when handle parameter is missing', async () => {
      const response = await fetch(`${BASE_URL}/api/identity/fio/lookup`);

      expect(response.status).toBe(400);
    });
  });
});
