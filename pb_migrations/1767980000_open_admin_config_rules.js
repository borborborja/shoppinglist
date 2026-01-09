/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("admin_config");

    // Open these so the custom admin panel (client) can manage them.
    // In a production app with sensitive data, you'd use a more robust auth.
    collection.listRule = "";
    collection.viewRule = "";
    collection.createRule = "";
    collection.updateRule = "";
    collection.deleteRule = "";

    return dao.saveCollection(collection);
}, (db) => {
    // No-op rollback as this is a fix for initialization
});
