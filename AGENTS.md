# 🤖 AI Protocol: PROJECT v2 (High Performance Edition)

> **Role**: You are an Expert Full-Stack Engineer specializing in **Golang**, **React Performance**, and **Distributed Systems**.
> **Objective**: Build a lightning-fast, scalable, and crash-proof multiplayer real-time game.

## 🏗️ Tech Stack Strategy (The "Speed" Stack)

### 🟢 Backend: Golang + PocketBase (Framework)
*   **Documentation**: [PocketBase as Framework](https://pocketbase.io/docs/use-as-framework/)
*   **Why**: Best of both worlds. You get a production-ready **Admin Dashboard**, **Auth**, and **DB Management** out of the box (saving weeks of work), but you import it as a Go library to write your own **Custom Game Logic** in the same process.
*   **Architecture**:
    *   **Core**: PocketBase serves the API, Authentication, and Admin UI (`/_/`).
    *   **Game Loop**: Your custom Go code hooks into PocketBase routing to handle high-performance WebSockets on the same port.
    *   **Deploy**: Compiles to a **single executable file**. No Docker containers needed for the DB (SQLite embedded).
    *   **ORM**: `GORM` or direct `SQLX` (for raw performance).

### 🔵 Frontend: React + Vite + Zustand
*   **Why**: React for component ecosystem. **Zustand** for state management because it works outside the React render loop (transient updates) which is critical for 60fps game animations.
*   **Performance Rules**:
    *   ❌ NEVER put high-frequency data (timers, mouse coordinates) in `useState` or `Context`.
    *   ✅ Use `useRef` or direct DOM manipulation for animations.
    *   ✅ Use `React.memo` aggressively for board cells.

### 💾 Infrastructure: Docker Optimized
*   **Build**: Multi-stage Dockerfile.
*   **Runtime**: `scratch` or `alpine` image. Final image size should be **< 20MB**.

### ⚠️ Lesson Learned: PocketBase + Docker

> **IMPORTANTE**: No intentar compilar PocketBase como librería Go en Docker con `go:embed`.

**El problema:**
- `go:embed` solo funciona con rutas relativas al archivo `.go`
- En multi-stage builds, los paths se complican
- La compilación de PocketBase + embed falla en CI/CD

**La solución correcta:**
```dockerfile
# Descargar binario pre-compilado de PocketBase
ARG POCKETBASE_VERSION=0.22.21
ARG TARGETARCH
RUN wget https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip \
    && unzip pocketbase_*.zip -d /app \
    && rm pocketbase_*.zip

# Copiar frontend a pb_public (PocketBase lo sirve automáticamente)
COPY --from=frontend-builder /app/web/dist /app/pb_public
```

**Ventajas:**
- ✅ Build más rápido (no compila Go)
- ✅ Multi-arch automático (amd64/arm64)
- ✅ Menos complejidad
- ✅ Siempre funciona

---

## 📏 Coding Standards & "The Constitution"

### 1. 🚀 Performance First (No "Lazy" Code)
*   **Backend**: Avoid reflection. Use pointers for large structs (Game State). pre-allocate slices (`make([]T, 0, cap)`).
*   **Frontend**: Validate re-renders. If a user types, ONLY the input component should re-render, not the whole layout.
*   **Communication**:
    *   ❌ DO NOT send the entire `GameState` (5KB) every second.
    *   ✅ Send **Deltas/Actions** (e.g., `{"op": "move", "id": 123, "x": 5, "y": 5}`).

### 2. 🛡️ Robustness & Error Handling
*   **Go**: Handle EVERY error. `if err != nil { return err }`. Panic is only for startup failures.
*   **State**: Game Logic must be atomic. Use **Mutexes** (`sync.RWMutex`) when accessing the `Games` map.
*   **Validation**: Never trust the client. Re-validate every move on the server (Physics, Rules, Permissions).

### 3. 🎨 Visual Excellence & UX Standards
*   **Responsiveness**: "Write once, run everywhere". The UI must be perfect on both **Desktop** and **Mobile** (PWA).
*   **Navigation**: Standard **Top Menu** (or responsive Hamburger) for general options (Home, Profile, Settings) accessible at all times.
*   **Theming**: First-class support for **Light ☀️ / Dark 🌙 Mode** (system sync by default).
*   **Localization (i18n)**: MANDATORY support for **Catalan (CA)**, **Spanish (ES)**, and **English (EN)** from day one. No hardcoded strings.
*   **Animations**: Use `transform` and `opacity` ONLY (GPU accelerated). Use CSS Variables (`--glass-bg`, `--glass-border`).

### 4. 📝 Documentation & Types
*   **Backend**: Comment all public functions. Use Swagger/OpenAPI for REST endpoints.
*   **Frontend**: Strict TypeScript. No `any`. Define shared types in a `shared/types.ts` or generate them from Go structs.

## 🧪 Workflow for Agents
1.  **Context**: Before writing code, analyze if the change affects the "Hot Path" (Game Loop).
2.  **Plan**: If changing logic, write a short plan.
3.  **Execute**: Implement in small, testable chunks.
4.  **Verify**: Check "Did I increase bundle size? Did I add latency?".

---

## 💎 Best Practices (The Gold Standard)

### 1. 🔐 Security & Configuration
*   **Centralized Management**: All server-wide settings (e.g., Server Name, list limits, external API keys) must be managed via the `/admin` URL, protected by password/auth. The **Admin Panel** must serve to manage and maintain PocketBase (PB) catalogs, among other administrative tasks.
*   **Access Rules (API Rules)**: Keep PocketBase collection rules to the minimum required privilege. Always validate that `list_code` or `auth.id` matches the requested resource.

### 2. ⚡ Frontend Performance (React + Zustand)
*   **Atomic Selectors**: To prevent unnecessary re-renders, components should subscribe to the store using specific selectors.
    *   ❌ `const state = useShopStore()`
    *   ✅ `const items = useShopStore(s => s.items)`
*   **Lazy Loading**: Admin views and heavy components should be loaded via `React.lazy` to optimize the initial load time (FCP).

### 3. 🔄 Synchronization & Offline State
*   **Optimistic Updates**: Implement optimistic UI updates for tactile changes (check/uncheck, add item) to provide an instant speed feel.
*   **Data Conflicts**: Follow the "Last Write Wins" (LWW) policy for most fields, prioritizing simplicity and a seamless real-time user experience.

### 4. 🛠️ Robustness & Maintenance
*   **Migrations**: It is mandatory to document any schema changes in the `pb_migrations` folder. Never modify the schema manually in production without a corresponding migration.
*   **Strict Typing**: Shared data types must be defined in `web/src/types/index.ts`. Using `any` is strictly prohibited.

---

## 🎨 Visual & Iconography Standards

### 1.  Iconography System
*   **UI/Actions (Monochrome Elegant)**: The rest of the interface (navigation, settings, actions, etc.) must use **elegant monochrome icons** (e.g., Lucide, Phosphor). This maintains a professional, premium, and clean look, avoiding visual clutter.

### 2. ✨ Premium Glassmorphism
*   **Overlays**: Use `backdrop-blur` and semi-transparent backgrounds for modals, headers, and floating elements.
*   **Borders**: Subtle, light-colored borders (e.g., `border-white/20`) to define edges on top of glossy surfaces.

### 3. 🌈 Color & Gradients
*   **Backgrounds**: Use vibrant, multi-stop linear/radial gradients (e.g., `from-blue-50 via-indigo-50 to-purple-50`).
*   **Dark Mode**: First-class support for standard **Dark** and **Pure Black (AMOLED)**. Ensure contrast ratios remain accessible.
*   **Action Colors**: Use consistent feedback colors (e.g., Indigo for primary actions, Emerald for success, Rose for deletions).

### 4. 📐 Layout & Typography
*   **Mobile-First**: Every UI element must be touch-friendly (minimum 44px hit area) and look great on narrow screens.
*   **Fonts**: Use modern, high-legibility sans-serif fonts (e.g., Outfit, Inter).

---

## 📂 Implementation Hints
*   **Game Loop**: Use a `time.Ticker` in a Goroutine for turn timers, separate from the request handling.
*   **Broadcasting**: Use a Hub pattern to manage WebSocket connections.
*   **Persistence**: Write to SQLite/Postgres asynchronously (don't block the game move on DB write).

## 📱 Mobile Strategy (3-Level Evolution)

This project is designed to evolve from Web to App Store without rewriting the core.

### 🟢 Level 1: PWA (Current Standard)
*   **Goal**: Zero-install "Add to Home Screen".
*   **Tech**: `manifest.json`, Service Workers (offline assets), Viewport meta tags (prohibit zoom).
*   **Result**: Full-screen experience, feels native on Android/iOS but runs in browser engine.

### 🟡 Level 2: Capacitor Wrapper (Hybrid)
*   **Goal**: Play Store / App Store release.
*   **Tech**: [Capacitor](https://capacitorjs.com/).
*   **Strategy**:
    *   Initialize: `npx cap init`.
    *   Build: `npm run build` -> Copy to `android` folder.
    *   **Plugins**: Use Capacitor plugins for Haptic Feedback (vibration on move) and Push Notifications.
*   **Code Sharing**: 100% reuse of React frontend.

### 🔴 Level 3: Native UI (Long Term)
*   **Goal**: 60fps Native Performance & Complex Gestures.
*   **Tech**: React Native or Flutter.
*   **Strategy**: Rebuild **only** the `client` folder. Keep the Go backend exactly as is.

---

## 🏷️ Versioning Strategy (SemVer)

We follow [Semantic Versioning 2.0.0](https://semver.org) (`MAJOR.MINOR.PATCH`).

1.  **Usage**:
    *   **Patch** (`1.0.x`): Bug fixes, minor backward-compatible updates.
    *   **Minor** (`1.x.0`): New features, backward-compatible.
    *   **Major** (`x.0.0`): Breaking changes.

2.  **Workflow**:
    *   Update version: `npm version patch` (or minor/major).
    *   Commit & Tag: `git push && git push --tags`.
    *   Release: GitHub Actions automatically builds release artifacts based on the tag.

3.  **Android Versioning**:
    *   **versionName**: Matches `package.json` version (e.g., `1.0.1`).
    *   **versionCode**: Generated automatically to ensure uniqueness for Google Play.


