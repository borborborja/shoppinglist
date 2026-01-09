/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("admin_config");

    dao.saveRecord(new Record(collection, {
        "key": "enable_usernames",
        "value": "false"
    }));
}, (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("admin_config");

    const record = dao.findFirstRecordByData("admin_config", "key", "enable_usernames");
    if (record) {
        dao.deleteRecord(record);
    }
});
