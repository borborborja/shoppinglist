/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

    // Add display_name
    collection.schema.addField(new SchemaField({
        "system": false,
        "id": "user_display_name",
        "name": "display_name",
        "type": "text",
        "required": false,
        "presentable": true,
        "unique": false,
        "options": {
            "min": null,
            "max": null,
            "pattern": ""
        }
    }));

    // Add current_list
    collection.schema.addField(new SchemaField({
        "system": false,
        "id": "user_current_list",
        "name": "current_list",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
            "min": null,
            "max": null,
            "pattern": ""
        }
    }));

    // Add last_active_at
    collection.schema.addField(new SchemaField({
        "system": false,
        "id": "user_last_active_at",
        "name": "last_active_at",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
            "min": "",
            "max": ""
        }
    }));

    return dao.saveCollection(collection);
}, (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

    collection.schema.removeField("user_display_name");
    collection.schema.removeField("user_current_list");
    collection.schema.removeField("user_last_active_at");

    return dao.saveCollection(collection);
});
