/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);
    const lists = dao.findCollectionByNameOrId("shopping_lists");

    // 1. Create list_categories - custom categories per list
    const categories = new Collection({
        "name": "list_categories",
        "type": "base",
        "system": false,
        "schema": [
            {
                "system": false,
                "name": "list",
                "type": "relation",
                "required": true,
                "options": {
                    "collectionId": lists.id,
                    "cascadeDelete": true,
                    "minSelect": null,
                    "maxSelect": 1,
                    "displayFields": null
                }
            },
            {
                "name": "key",
                "type": "text",
                "required": true,
                "options": { "pattern": "" }
            },
            {
                "name": "icon",
                "type": "text",
                "required": true,
                "options": { "pattern": "" }
            },
            {
                "name": "name",
                "type": "text",
                "required": false,
                "options": { "pattern": "" }
            }
        ],
        "indexes": [],
        "listRule": "",
        "viewRule": "",
        "createRule": "",
        "updateRule": "",
        "deleteRule": ""
    });
    dao.saveCollection(categories);

    // 2. Create list_items - custom products per list category
    const items = new Collection({
        "name": "list_items",
        "type": "base",
        "system": false,
        "schema": [
            {
                "system": false,
                "name": "list",
                "type": "relation",
                "required": true,
                "options": {
                    "collectionId": lists.id,
                    "cascadeDelete": true,
                    "minSelect": null,
                    "maxSelect": 1,
                    "displayFields": null
                }
            },
            {
                "name": "category_key",
                "type": "text",
                "required": true,
                "options": { "pattern": "" }
            },
            {
                "name": "name",
                "type": "text",
                "required": true,
                "options": { "pattern": "" }
            }
        ],
        "indexes": [],
        "listRule": "",
        "viewRule": "",
        "createRule": "",
        "updateRule": "",
        "deleteRule": ""
    });
    dao.saveCollection(items);

}, (db) => {
    const dao = new Dao(db);
    try {
        const items = dao.findCollectionByNameOrId("list_items");
        dao.deleteCollection(items);
    } catch (_) { }
    try {
        const categories = dao.findCollectionByNameOrId("list_categories");
        dao.deleteCollection(categories);
    } catch (_) { }
});
