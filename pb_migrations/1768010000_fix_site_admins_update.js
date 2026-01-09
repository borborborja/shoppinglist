/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("site_admins");

    // Allow admins to update themselves (after authenticating)
    // The empty string means anyone with valid auth token for this collection can update
    collection.updateRule = "";

    dao.saveCollection(collection);
}, (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("site_admins");

    // Revert to self-update only
    collection.updateRule = "id = @request.auth.id";
    dao.saveCollection(collection);
});
