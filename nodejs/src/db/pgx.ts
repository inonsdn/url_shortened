import type { Pool } from "pg";

export function createStore(db: Pool) {
    return {
        async findCodeByUrl(url: string): Promise<string|null> {
            const { rows } = await db.query("SELECT code FROM links WHERE url = $1 LIMIT 1", [url])
            return rows[0]?.code ?? null
        },

        async findUrlByCode(code: string): Promise<string|null> {
            const { rows } = await db.query("SELECT url FROM links WHERE code = $1 LIMIT 1", [code])
            return rows[0]?.url ?? null
        },

        async save(code: string, url: string): Promise<boolean> {
            try {
                await db.query("INSERT INTO links (code, url) VALUES ($1, $2)", [code, url])
                return true
            } catch (err: any) {
                if ( err.code === "23505" ) {
                    return false;
                }
                throw err
            }
        }
    }
}