import { describe, expect, it } from 'vitest';
import { readZaiQuota } from '../zai/quota';
import { failingFetch, fakeFetch, NOW } from './helpers';

const KEY = 'abc123.secretKEYvalue';
const env = (fetch: typeof globalThis.fetch) => ({
  fetch,
  userAgent: 'resetowl-desktop/test',
  now: () => NOW,
});
const at = (hours: number) => NOW.getTime() + hours * 3_600_000;

const answer = (limits: unknown[], extra: Record<string, unknown> = {}) => ({
  code: 200,
  success: true,
  data: { level: 'Pro', limits },
  ...extra,
});

describe('readZaiQuota', () => {
  it('sends the raw key to Z.AI only, honestly named, and maps the 5-hour, weekly and MCP windows', async () => {
    const { fn, calls } = fakeFetch(
      answer([
        { type: 'TIME_LIMIT', unit: 5, number: 1, percentage: 3, nextResetTime: at(400) },
        { type: 'TOKENS_LIMIT', unit: 6, number: 1, percentage: 44, nextResetTime: at(90) },
        { type: 'TOKENS_LIMIT', unit: 3, number: 5, percentage: 12, nextResetTime: at(2) },
      ]),
    );

    const reading = await readZaiQuota(env(fn), { provider: 'zai', apiKey: ` ${KEY} ` });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.z.ai/api/monitor/usage/quota/limit');
    expect(calls[0].headers.Authorization).toBe(KEY);
    expect(calls[0].headers['User-Agent']).toBe('resetowl-desktop/test');
    expect(reading.status).toBe('ok');
    expect(reading.reportedPlan).toBe('pro');
    expect(reading.snapshot?.source).toBe('unofficial');
    expect(reading.snapshot?.windows).toEqual([
      {
        key: 'five_hour',
        kind: 'session',
        label: '5-hour',
        utilization: 12,
        resetsAt: new Date(at(2)).toISOString(),
        windowMinutes: 300,
      },
      {
        key: 'weekly',
        kind: 'weekly',
        label: 'Weekly',
        utilization: 44,
        resetsAt: new Date(at(90)).toISOString(),
        windowMinutes: 10080,
      },
      {
        key: 'mcp_monthly',
        kind: 'monthly',
        label: 'MCP tools',
        utilization: 3,
        resetsAt: new Date(at(400)).toISOString(),
        windowMinutes: 43200,
      },
    ]);
    expect(JSON.stringify(reading)).not.toContain(KEY);
  });

  it('reads a BigModel plan from open.bigmodel.cn, never from Z.AI', async () => {
    const { fn, calls } = fakeFetch(
      answer([{ type: 'CREDIT_LIMIT', unit: 3, number: 5, percentage: 10 }]),
    );
    await readZaiQuota(env(fn), { provider: 'bigmodel', apiKey: KEY });
    expect(calls[0].url).toBe('https://open.bigmodel.cn/api/monitor/usage/quota/limit');
  });

  it('prefers credit counts over a percentage that lags them', async () => {
    const { fn } = fakeFetch(
      answer([
        { type: 'CREDIT_LIMIT', unit: 3, number: 5, usage: 2000, currentValue: 500, percentage: 0 },
        { type: 'CREDIT_LIMIT', unit: 6, number: 1, usage: 10000, remaining: 8000, percentage: 0 },
      ]),
    );
    const reading = await readZaiQuota(env(fn), { provider: 'zai', apiKey: KEY });
    expect(reading.snapshot?.windows.map((w) => w.utilization)).toEqual([25, 20]);
  });

  it('drops a 5-hour reset more than 5 hours away but keeps its value', async () => {
    const { fn } = fakeFetch(
      answer([{ type: 'TOKENS_LIMIT', unit: 3, number: 5, percentage: 25, nextResetTime: at(10) }]),
    );
    const reading = await readZaiQuota(env(fn), { provider: 'zai', apiKey: KEY });
    expect(reading.snapshot?.windows[0]).toMatchObject({ utilization: 25, resetsAt: null });
  });

  it('turns a refused key into auth_expired without sending it anywhere else', async () => {
    const { fn, calls } = fakeFetch({ error: 'denied' }, 401);
    const reading = await readZaiQuota(env(fn), { provider: 'zai', apiKey: KEY });
    expect(calls).toHaveLength(1);
    expect(reading).toMatchObject({ status: 'auth_expired', snapshot: null });
  });

  it('reports a 429 as rate_limited', async () => {
    const { fn } = fakeFetch({}, 429);
    expect((await readZaiQuota(env(fn), { provider: 'zai', apiKey: KEY })).status).toBe(
      'rate_limited',
    );
  });

  it('treats an answer without usable limits as an error, scrubbing the key from its message', async () => {
    const { fn } = fakeFetch({ success: false, code: 1001, msg: `bad token ${KEY}` });
    const reading = await readZaiQuota(env(fn), { provider: 'zai', apiKey: KEY });
    expect(reading.status).toBe('error');
    expect(reading.message).toContain('bad token [key]');
    expect(reading.message).not.toContain(KEY);
  });

  it('never sends a key that is not one line of printable text', async () => {
    const { fn, calls } = fakeFetch(answer([]));
    const reading = await readZaiQuota(env(fn), { provider: 'zai', apiKey: 'abc\r\nX-Evil: 1' });
    expect(calls).toHaveLength(0);
    expect(reading.status).toBe('no_credentials');
  });

  it('never throws when the network fails', async () => {
    const reading = await readZaiQuota(env(failingFetch(`offline ${KEY}`)), {
      provider: 'zai',
      apiKey: KEY,
    });
    expect(reading.status).toBe('error');
    expect(reading.message).not.toContain(KEY);
  });
});
