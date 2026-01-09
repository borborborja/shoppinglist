/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);

    // Open delete rules for users collection so admin panel can wipe users
    const usersCollection = dao.findCollectionByNameOrId("_pb_users_auth_");
    usersCollection.deleteRule = "";
    dao.saveCollection(usersCollection);

    // Ensure admin_config has open rules (it should already, but double-check)
    const adminConfig = dao.findCollectionByNameOrId("admin_config");
    adminConfig.listRule = "";
    adminConfig.viewRule = "";
    adminConfig.createRule = "";
    adminConfig.updateRule = "";
    adminConfig.deleteRule = "";
    dao.saveCollection(adminConfig);

}, (db) => {
    const dao = new Dao(db);

    // Rollback: restrict delete to only admins (null means admin-only)
    const usersCollection = dao.findCollectionByNameOrId("_pb_users_auth_");
    usersCollection.deleteRule = null;
    dao.saveCollection(usersCollection);
});
