import { TimeAgoPipe } from './time-ago.pipe';

describe('TimeAgoPipe', () => {
  let pipe: TimeAgoPipe;

  beforeEach(() => {
    pipe = new TimeAgoPipe();
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('returns empty string for unparseable values', () => {
    expect(pipe.transform('not-a-date')).toBe('');
  });

  it('formats recent dates as "segundos"', () => {
    const date = new Date(Date.now() - 5_000);
    expect(pipe.transform(date)).toContain('segundos');
  });

  it('formats ~1 minute ago', () => {
    const date = new Date(Date.now() - 60_000);
    expect(pipe.transform(date)).toBe('hace 1 min');
  });

  it('formats minutes ago', () => {
    const date = new Date(Date.now() - 10 * 60_000);
    expect(pipe.transform(date)).toContain('min');
  });

  it('formats hours ago', () => {
    const date = new Date(Date.now() - 3 * 3600_000);
    expect(pipe.transform(date)).toContain('h');
  });

  it('formats "ayer" at ~36 h', () => {
    const date = new Date(Date.now() - 36 * 3600_000);
    expect(pipe.transform(date)).toBe('ayer');
  });

  it('accepts ISO strings, Date objects and epoch numbers', () => {
    const iso = new Date(Date.now() - 5_000).toISOString();
    const num = Date.now() - 5_000;
    expect(pipe.transform(iso)).toContain('segundos');
    expect(pipe.transform(num)).toContain('segundos');
  });
});
