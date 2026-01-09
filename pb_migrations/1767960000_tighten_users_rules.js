/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

    // Restrict list and view rules. 
    // Users can see themselves OR users sharing the same current_list.
    // We add a check for current_list != "" to avoid matching all users with no list.
    collection.listRule = 'id = @request.auth.id || (current_list != "" && current_list = @request.auth.current_list)';
    collection.viewRule = 'id = @request.auth.id || (current_list != "" && current_list = @request.auth.current_list)';

    return dao.saveCollection(collection);
}, (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

    // Revert to open (not recommended, but for rollback safety)
    collection.listRule = "";
    collection.viewRule = "";

    return dao.saveCollection(collection);
});
