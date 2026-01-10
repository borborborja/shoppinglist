import dotenv from 'dotenv';
import PocketBase from 'pocketbase';
// @ts-ignore
import bringApi from 'bring-api';

dotenv.config();

const PB_URL = process.env.PB_URL || 'http://shoplist:8090';
const PB_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_PASSWORD = process.env.PB_ADMIN_PASSWORD;

const BRING_EMAIL = process.env.BRING_EMAIL;
const BRING_PASSWORD = process.env.BRING_PASSWORD;
const BRING_LIST_UUID = process.env.BRING_LIST_UUID;

const pb = new PocketBase(PB_URL);
const bring = new bringApi({ email: BRING_EMAIL, password: BRING_PASSWORD });

async function main() {
    console.log('Starting ShoppingList <-> Bring Connector...');

    // 1. Login to PocketBase
    try {
        if (PB_EMAIL && PB_PASSWORD) {
            await pb.admins.authWithPassword(PB_EMAIL, PB_PASSWORD);
            console.log('✅ Logged into PocketBase as Admin');
        } else {
            console.warn('⚠️ No PocketBase credentials provided. Skipping login.');
        }
    } catch (e) {
        console.error('❌ Failed to login to PocketBase:', e);
        process.exit(1);
    }

    // 2. Login to Bring
    try {
        await bring.login();
        console.log('✅ Logged into Bring!');

        const lists = await bring.getLists();
        console.log(`📋 Found ${lists.lists.length} Bring lists.`);

        if (BRING_LIST_UUID) {
            const details = await bring.getItems(BRING_LIST_UUID);
            console.log(`📋 Connected to list: ${BRING_LIST_UUID}`);
            console.log(`   Items to purchase: ${details.purchase.length}`);
            console.log(`   Items recently purchased: ${details.recently.length}`);
        } else {
            console.log('ℹ️ No BRING_LIST_UUID provided. Listing first 3 lists for reference:');
            lists.lists.slice(0, 3).forEach((l: any) => console.log(`   - ${l.name} (UUID: ${l.uuid})`));
        }

    } catch (e) {
        console.error('❌ Failed to login to Bring:', e);
        // Don't exit, might just be temporary network issue or config error
    }

    // TODO: Implement Sync Loop
    console.log('🚀 Service started. Sync logic pending implementation.');

    // Keep alive
    setInterval(() => {
        // Heartbeat or sync poll
    }, 60000);
}

main().catch(console.error);
