/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);

    // Create site_admins auth collection
    const collection = new Collection({
        "name": "site_admins",
        "type": "auth",
        "schema": [
            {
                "name": "display_name",
                "type": "text",
                "required": false,
                "options": {
                    "min": null,
                    "max": 100
                }
            }
        ],
        // Only authenticated site_admins can list/view other admins
        "listRule": "@request.auth.id != '' && @collection.site_admins.id ?= @request.auth.id",
        "viewRule": "@request.auth.id != '' && @collection.site_admins.id ?= @request.auth.id",
        // Only existing site_admins can create new ones (or use PocketBase superadmin)
        "createRule": null,
        // Admins can update themselves
        "updateRule": "id = @request.auth.id",
        // Only PocketBase superadmins can delete
        "deleteRule": null,
        // Auth options
        "options": {
            "allowEmailAuth": true,
            "allowOAuth2Auth": false,
            "allowUsernameAuth": true,
            "exceptEmailDomains": null,
            "manageRule": null,
            "minPasswordLength": 4,
            "onlyEmailDomains": null,
            "onlyVerified": false,
            "requireEmail": false
        }
    });

    dao.saveCollection(collection);

    // Create default admin user using the DAO API
    const record = new Record(collection);
    record.set("username", "admin");
    record.set("email", "admin@local");
    record.set("verified", true);
    record.set("display_name", "Administrador");
    record.setPassword("admin123");

    dao.saveRecord(record);

}, (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("site_admins");
    if (collection) {
        dao.deleteCollection(collection);
    }
});
