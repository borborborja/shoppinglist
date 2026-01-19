# 📖 The API and Database Bible (ShoppingList)

This document is the definitive reference for developers who wish to integrate external applications or create alternative clients for the **ShoppingList** server.

## 🔌 Core Technologies

The server is built on **PocketBase** (v0.22+), which means it inherits all its power:
- **REST API**: Standard access via HTTP.
- **Official SDKs**: Available for JavaScript/TypeScript, Dart, Go.
- **SSE (Real-time)**: Instant synchronization via Server-Sent Events.

---

## 🔐 Security and Authentication Model

### 1. Accessing Lists (User Mode)
Accessing a shopping list **does not require a traditional user login**. It is based on a 6-character **Sync Code** (`code`).

- **Workflow**:
    1. Search the `shopping_lists` collection for the record whose `code` field matches.
    2. If it exists, obtain the `recordId` of that list.
    3. All subsequent operations on items (`shopping_items`) must include that `recordId`.

### 2. Administrative Access
To manage the global catalog or system settings, administration authentication is required:
- Collection: `site_admins` (Auth Collection).
- Authentication: Via `authWithPassword(email, password)`.

### 3. CORS Configuration
If you develop an external App (e.g., Capacitor), make sure the server has activated:
- `enable_remote_access: "true"` in the `admin_config` collection.
- The server allows `capacitor://localhost` and `http://localhost` by default.

---

## 🗃️ Database Collections

### 1. `shopping_lists` (List Management)
Each shared list in the world has a record here.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Record ID | Internal unique identifier. |
| `code` | Plain Text | The 6-letter code (e.g., `ABCDEF`) used by the user. |
| `name` | Plain Text | Custom name of the list. |

### 2. `shopping_items` (List Items)
Products that are currently in the "pantry" or in the cart.

| Field | Type | Description |
| :--- | :--- | :--- |
| `list` | Relation | Link to the `shopping_lists` ID. |
| `name` | Plain Text | Product name. |
| `checked` | Bool | `true` if already in the shopping cart. |
| `in_list` | Bool | `true` if the item is active, `false` if it is "recently used". |
| `category`| Plain Text | Category key (e.g., `fruits`). |
| `note` | Plain Text | Additional notes or quantity. |

### 3. `catalog_items` (Master Dictionary)
The global catalog containing thousands of products for autocompletion and automatic categorization.

| Field | Type | Description |
| :--- | :--- | :--- |
| `name_es` | Plain Text | Name in Spanish. |
| `name_ca` | Plain Text | Name in Catalan. |
| `name_en` | Plain Text | Name in English. |
| `category`| Relation | Link to `catalog_categories`. |
| `hidden` | Bool | If `true`, it should not appear in searches. |

### 4. `catalog_categories` (Global Categories)

| Field | Type | Description |
| :--- | :--- | :--- |
| `key` | Plain Text | Unique identifier (e.g., `bakery`). |
| `icon` | Plain Text | Emoji or icon ID. |
| `color` | Plain Text | Hexadecimal CSS color. |
| `order` | Number | Supermarket aisle position (0-100). |
| `name_es/ca/en` | Plain Text | Name translations. |

---

## 📡 Real-time Synchronization (SSE)

To keep your app updated without refreshing, you must subscribe to changes:

```javascript
// Example with PocketBase JS SDK
pb.collection('shopping_items').subscribe('*', function (e) {
    console.log(e.action); // 'create', 'update', or 'delete'
    console.log(e.record); // Data of the changed record
}, {
    // Very important: Filter by the list you have open
    filter: `list = "${currentListId}"`
});
```

---

## 🛠 Request Examples (cURL)

### Get items from a list
```bash
curl -X GET "http://your-server:8090/api/collections/shopping_items/records?filter=(list='LIST_ID')&sort=-updated"
```

### Create a new item
```bash
curl -X POST "http://your-server:8090/api/collections/shopping_items/records" \
     -H "Content-Type: application/json" \
     -d '{"list": "LIST_ID", "name": "Milk", "category": "dairy", "in_list": true}'
```

### Admin Authentication (Token)
```bash
curl -X POST "http://your-server:8090/api/collections/site_admins/auth-with-password" \
     -d "identity=admin@example.com" \
     -d "password=your_password"
```

---

## 💡 Tips for Developers

1.  **Optimistic UI**: ShoppingList uses optimistic updates. Update your local interface immediately and launch the API request in the background.
2.  **Automatic Categorization**: When adding a product, search for its name in `catalog_items` to get the default category. If it doesn't exist, use `other`.
3.  **Persistence**: Save the `code` and `recordId` in the device's local storage so the user doesn't have to enter them again when reopening the app.
