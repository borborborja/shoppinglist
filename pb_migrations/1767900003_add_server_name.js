/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);

    // Add server_name to admin_config
    db.newQuery("INSERT INTO admin_config (id, key, value, created, updated) VALUES ('admin_srv_0001', 'server_name', 'ShoppingList', '2026-01-09 00:00:00.000Z', '2026-01-09 00:00:00.000Z')").execute();
}, (db) => {
    db.newQuery("DELETE FROM admin_config WHERE key = 'server_name'").execute();
})
