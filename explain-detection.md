# Resource Detection Logic

## What Gets Detected as a Resource?

The analyzer extracts resource names from **routes/paths, ViewSet classes, and function names**. Here's how:

---

## Python Detection

### 1. **ViewSet Classes** (Full CRUD auto-detected)
```python
class UserViewSet(viewsets.ModelViewSet):
    # Detected as: "users" with [CRUD] capabilities
    
class ProductViewSet(viewsets.ViewSet):
    # Detected as: "products" with [CRUD]
```
**Logic**: Strip "ViewSet/View/API/Serializer", pluralize → `UserViewSet` → "users"

### 2. **Django URL/Path Patterns** (Read-only by default)
```python
path('api/v1/zaken/<uuid:pk>/', ZaakDetailView.as_view())
# Detected as: "zaken" with [-R--]

path('admin/', admin.site.urls)
# Detected as: "admin" with [-R--]

path('http://example.com/callback', callback_view)
# Detected as: "http:" with [-R--]
```
**Logic**: Remove `api/`, `v\d+/` prefixes, extract first non-parameter segment

### 3. **@api_view Decorated Functions**
```python
@api_view(['GET', 'POST'])
def user_list(request):
    # Detected as: "user_list" with [CR--]
```
**Logic**: Extract function name, remove HTTP verb prefixes (get_, post_, etc.)

---

## JavaScript Detection

### 1. **Express/Koa Route Definitions**
```javascript
app.get('/api/users/:id', getUser)
// Detected as: "users" with [-R--]

router.post('/products', createProduct)
// Detected as: "products" with [C---]

api.delete('/orders/:id', deleteOrder)
// Detected as: "orders" with [---D]
```
**Logic**: Parse path from route definition, apply same path extraction

### 2. **RESTful Method Handlers**
```javascript
const handlers = {
  get: async function() { },
  post: function() { }
}
// Detected as: "resource" (generic) with [CR--]
```
**Logic**: Generic "resource" when path context unavailable

---

## Go Detection

### 1. **HandleFunc with Paths**
```go
r.HandleFunc("/api/users", usersHandler)
// Detected as: "users" with [-R--]

mux.HandleFunc("/products/{id}", productHandler)
// Detected as: "products" with [-R--]
```
**Logic**: Extract path from HandleFunc, parse first segment

---

## Path Extraction Rules

Given a path like: `api/v1/klantcontacts/<uuid:pk>/detail`

1. Remove prefixes: `api/`, `v\d+/` → `klantcontacts/<uuid:pk>/detail`
2. Split by `/`: `["klantcontacts", "<uuid:pk>", "detail"]`
3. Filter parameters: `["klantcontacts", "detail"]`
4. Take first: **"klantcontacts"**

---

## Examples from Your Results

| Detected Resource | Source Type | CRUD | Likely Origin |
|------------------|------------|------|---------------|
| `audittrails` | ViewSet | CRUD | `class AuditTrailViewSet(...)` |
| `admin` | Path | -R-- | `path('admin/', ...)` |
| `http:` | Path | -R-- | `path('http://...')` (URL, not path!) |
| `importcreates` | ViewSet | CRUD | `class ImportCreateViewSet(...)` |
| `zaken` | Path | -R-- | `path('api/v1/zaken/<uuid:pk>/')` |
| `__debug__` | Path | -R-- | `path('__debug__/', ...)` |
| `klantcontacts` | ViewSet | CRUD | `class KlantContactViewSet(...)` |
| `nestedmixins` | Path | -R-- | Test/debug route |

---

## Current Issues Detected

1. **"http:" as resource** - The regex captures `path('http://...')` where the entire URL is treated as a path
2. **Generic names** - Things like "admin", "__debug__", "ref" are infrastructure, not business resources
3. **Test resources** - "test-view", "nestedmixins", "foo" are test/debug code
4. **Pluralization** - Some ViewSets might already be plural: `ImportCreatesViewSet` → "importcreatess"

---

## What's Working Well

- ✅ ViewSet detection captures most business entities (zaken, klantcontacts, etc.)
- ✅ Path extraction works for standard REST patterns
- ✅ CRUD capability tracking shows which operations are available
- ✅ Deduplication across files merges capabilities

## What Could Be Improved

- 🔧 Filter out infrastructure routes (admin, debug, oidc, ref)
- 🔧 Better URL vs path detection (skip `http://`, `https://`)
- 🔧 Context-aware pluralization (check if already plural)
- 🔧 Extract from more patterns (Serializers, Permission classes)
