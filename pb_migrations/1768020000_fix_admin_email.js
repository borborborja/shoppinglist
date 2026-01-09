/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
    const dao = new Dao(db);

    // Update the admin email to a valid format
    const record = dao.findFirstRecordByData("site_admins", "username", "admin");
    if (record) {
        record.set("email", "admin@localhost.local");
        dao.saveRecord(record);
    }
}, (db) => {
    // No rollback needed
});
