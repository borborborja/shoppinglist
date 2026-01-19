# 👑 Panel de Administración

El Panel de Administración te permite gestionar todos los aspectos del servidor y el catálogo de productos.

## 🔑 Acceso

Puedes acceder al panel mediante la ruta `/admin` en tu navegador.
- **URL**: `http://tu-servidor/admin`
- **Autenticación**: Requiere una contraseña de administrador configurada.

---

## 📦 Gestión del Catálogo

### Categorías
Puedes crear categorías para organizar los productos. Cada categoría tiene:
- **Nombre**: En tres idiomas (ES, CA, EN).
- **Emoji**: Un icono visual que ayuda a identificar la sección rápidamente.
- **Color**: Se utiliza en los bordes y acentos de la UI.
- **Orden de pasillo**: Un número (0-100) que determina cómo se ordenan los productos en la lista principal para optimizar tu ruta por el supermercado.

### Productos
El catálogo maestro de productos. Cuando un usuario escribe un nombre, la app busca aquí para asignar automáticamente la categoría correcta.
- Soporta traducciones en los tres idiomas principales.
- Se pueden marcar productos como "ocultos" para que no aparezcan en las sugerencias de búsqueda.

---

## ⚙️ Configuración del Sistema

En la pestaña de **Ajustes**, puedes configurar:

- **Nombre del Servidor**: El nombre que aparece en la parte superior de la app.
- **Modo Backend-Only**: Si se activa, la interfaz web pública se desactiva, sirviendo solo como servidor para las aplicaciones móviles. Útil para mayor privacidad.
- **Gestión de Usuarios**: Ver quién está conectado y gestionar quién tiene acceso.
- **Importar/Exportar**: Permite descargar una copia de seguridad de todo tu catálogo en formato JSON y restaurarla fácilmente.

---

## 🔄 Actualizaciones

El panel incluye un **Comprobador de Versiones**:
1. Compara tu versión actual con la última disponible en el repositorio de GitHub.
2. Si hay una actualización, te mostrará un aviso y las notas del lanzamiento (Changelog).

---

## 🛠 Bases de Datos y Migraciones

ShoppingList utiliza PocketBase como motor. Los datos se guardan en la carpeta `pb_data/`. 
- **Backups**: Es recomendable hacer copias de seguridad periódicas de esta carpeta.
- **Migrations**: No borres nunca la carpeta `pb_migrations/`, ya que contiene la estructura necesaria para que el servidor funcione.
