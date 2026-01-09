/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

    // Open list and view rules so presence and admin panel can work
    // In a production app, you'd restrict this to authenticaded admins
    collection.listRule = "";
    collection.viewRule = "";

    return dao.saveCollection(collection);
}, (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

    // Revert to default (only self can see self)
    collection.listRule = "id = @request.auth.id";
    collection.viewRule = "id = @request.auth.id";

    return dao.saveCollection(collection);
});
