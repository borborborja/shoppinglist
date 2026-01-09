/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    // Add enable_remote_access config (default: false for security)
    db.newQuery(`
        INSERT INTO admin_config (id, key, value, created, updated) 
        VALUES ('remote_access_001', 'enable_remote_access', 'false', datetime('now'), datetime('now'))
    `).execute();
}, (db) => {
    // Rollback
    db.newQuery("DELETE FROM admin_config WHERE key = 'enable_remote_access'").execute();
});
