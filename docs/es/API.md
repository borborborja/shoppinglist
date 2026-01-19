# 📖 La Biblia del API y Base de Datos (ShoppingList)

Este documento es la referencia definitiva para desarrolladores que deseen integrar aplicaciones externas o crear clientes alternativos para el servidor de **ShoppingList**.

## 🔌 Tecnologías Core

El servidor está construido sobre **PocketBase** (v0.22+), lo que significa que hereda toda su potencia:
- **REST API**: Acceso estándar vía HTTP.
- **SDKs Oficiales**: Disponibles para JavaScript/TypeScript, Dart, Go.
- **SSE (Real-time)**: Sincronización instantánea mediante Server-Sent Events.

---

## 🔐 Modelo de Seguridad y Autenticación

### 1. Acceso a las Listas (Modo Usuario)
El acceso a una lista de la compra **no requiere login de usuario tradicional**. Se basa en un **Código de Sincronización** (`code`) de 6 caracteres.

- **Flujo**:
    1. Se busca en la colección `shopping_lists` el registro cuyo campo `code` coincida.
    2. Si existe, se obtiene el `recordId` de esa lista.
    3. Todas las operaciones posteriores sobre items (`shopping_items`) deben incluir ese `recordId`.

### 2. Acceso Administrativo
Para gestionar el catálogo global o ajustes del sistema, se requiere autenticación como administrador:
- Colección: `site_admins` (Auth Collection).
- Autenticación: Vía `authWithPassword(email, password)`.

### 3. Configuración de CORS
Si desarrollas una App externa (ej: Capacitor), asegúrate de que el servidor tenga activado:
- `enable_remote_access: "true"` en la colección `admin_config`.
- El servidor permite por defecto `capacitor://localhost` y `http://localhost`.

---

## 🗃️ Colecciones de la Base de Datos

### 1. `shopping_lists` (Gestión de Listas)
Cada lista compartida en el mundo tiene un registro aquí.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | Record ID | Identificador único interno. |
| `code` | Plain Text | El código de 6 letras (ej: `ABCDEF`) que usa el usuario. |
| `name` | Plain Text | Nombre personalizado de la lista. |

### 2. `shopping_items` (Items de la Lista)
Los productos que están actualmente en la "nevera" o en el carrito.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `list` | Relation | Enlace al ID de `shopping_lists`. |
| `name` | Plain Text | Nombre del producto. |
| `checked` | Bool | `true` si ya está en el carro de la compra. |
| `in_list` | Bool | `true` si el item es activo, `false` si es "usado recientemente". |
| `category`| Plain Text | Key de la categoría (ej: `fruits`). |
| `note` | Plain Text | Notas adicionales o cantidad. |

### 3. `catalog_items` (Diccionario Maestro)
El catálogo global que contiene miles de productos para autocompletado y categorización automática.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `name_es` | Plain Text | Nombre en Castellano. |
| `name_ca` | Plain Text | Nombre en Catalán. |
| `name_en` | Plain Text | Nombre en Inglés. |
| `category`| Relation | Enlace a `catalog_categories`. |
| `hidden` | Bool | Si es `true`, no debe aparecer en búsquedas. |

### 4. `catalog_categories` (Categorías Globales)

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `key` | Plain Text | Identificador único (ej: `bakery`). |
| `icon` | Plain Text | Emoji o ID de icono. |
| `color` | Plain Text | Color CSS hexadecimal. |
| `order` | Number | Posición en el pasillo del súper (0-100). |
| `name_es/ca/en` | Plain Text | Traducciones del nombre. |

---

## 📡 Sincronización en Tiempo Real (SSE)

Para que tu app se actualice sin refrescar, debes suscribirte a los cambios:

```javascript
// Ejemplo con PocketBase JS SDK
pb.collection('shopping_items').subscribe('*', function (e) {
    console.log(e.action); // 'create', 'update' o 'delete'
    console.log(e.record); // Los datos del item cambiado
}, {
    // Muy importante: Filtrar por la lista que tienes abierta
    filter: `list = "${currentListId}"`
});
```

---

## 🛠 Ejemplos de Peticiones (cURL)

### Obtener los items de una lista
```bash
curl -X GET "http://tu-servidor:8090/api/collections/shopping_items/records?filter=(list='ID_DE_LA_LISTA')&sort=-updated"
```

### Crear un nuevo item
```bash
curl -X POST "http://tu-servidor:8090/api/collections/shopping_items/records" \
     -H "Content-Type: application/json" \
     -d '{"list": "ID_DE_LA_LISTA", "name": "Leche", "category": "dairy", "in_list": true}'
```

### Autenticación Admin (Token)
```bash
curl -X POST "http://tu-servidor:8090/api/collections/site_admins/auth-with-password" \
     -d "identity=admin@example.com" \
     -d "password=tu_contraseña"
```

---

## 💡 Consejos para Desarrolladores

1.  **Optimistic UI**: ShoppingList usa actualizaciones optimistas. Actualiza tu interfaz local inmediatamente y lanza la petición al API en segundo plano.
2.  **Categorización Automática**: Al añadir un producto, busca su nombre en `catalog_items` para obtener la categoría por defecto. Si no existe, usa `other`.
3.  **Persistencia**: Guarda el `code` y el `recordId` en el almacenamiento local del dispositivo para que el usuario no tenga que volver a introducirlo al reabrir la app.
