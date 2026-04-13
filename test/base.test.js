import { BaseAdapter } from '../src/core/adapter/base.js';

describe('BaseAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new BaseAdapter({ host: 'localhost' });
    });

    it('stores config on construction', () => {
        expect(adapter.config).toEqual({ host: 'localhost' });
    });

    it('connect() throws "not implemented"', async () => {
        await expect(adapter.connect()).rejects.toThrow('Method connect not implemented');
    });

    it('query() throws "not implemented"', async () => {
        await expect(adapter.query('SELECT 1', [])).rejects.toThrow('Method query not implemented');
    });

    it('begin() throws "not implemented"', async () => {
        await expect(adapter.begin()).rejects.toThrow('Method begin not implemented');
    });

    it('commit() throws "not implemented"', async () => {
        await expect(adapter.commit()).rejects.toThrow('Method commit not implemented');
    });

    it('rollback() throws "not implemented"', async () => {
        await expect(adapter.rollback()).rejects.toThrow('Method rollback not implemented');
    });

    it('end() throws "not implemented"', async () => {
        await expect(adapter.end()).rejects.toThrow('Method end not implemented');
    });
});
