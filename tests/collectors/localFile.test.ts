import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { LocalFileCollector } from '../../src/collectors/localFile.js';

describe('LocalFileCollector', () => {
  let collector: LocalFileCollector;

  beforeEach(() => {
    collector = new LocalFileCollector('/test/data');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when directory does not exist', async () => {
    vi.spyOn(fs, 'readdir').mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

    const items = await collector.collect();
    expect(items).toEqual([]);
  });

  it('returns RawItems for .geojson files', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue(
      ['area.geojson', 'zones.geojson', 'readme.txt'] as unknown as ReturnType<typeof fs.readdir>,
    );

    const items = await collector.collect();
    expect(items).toHaveLength(2);
    expect(items[0].source).toBe('local_file');
    expect(items[0].title).toBe('area.geojson');
    expect(items[0].url).toMatch(/^file:\/\//);
    expect(items[0].id).toBeTruthy();
  });

  it('returns RawItems for .shp files', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue(
      ['shapefile.shp'] as unknown as ReturnType<typeof fs.readdir>,
    );

    const items = await collector.collect();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('shapefile.shp');
  });

  it('ignores non-GIS files', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue(
      ['data.csv', 'notes.md', 'image.png'] as unknown as ReturnType<typeof fs.readdir>,
    );

    const items = await collector.collect();
    expect(items).toEqual([]);
  });

  it('uses default data directory', () => {
    const defaultCollector = new LocalFileCollector();
    expect(defaultCollector).toBeInstanceOf(LocalFileCollector);
  });
});
