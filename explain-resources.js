const results = require('./results.json');

console.log('\n📋 WHAT IS DETECTED AS A RESOURCE?\n');
console.log('The analyzer extracts resources from 3 main sources:\n');

console.log('1️⃣  ViewSet Classes (Python/Django)');
console.log('   Example: class UserViewSet(...) → Resource: "users" [CRUD]');
console.log('   Logic: Strip "ViewSet/View/API" suffix, pluralize name\n');

console.log('2️⃣  URL/Path Patterns (Django, Express, Go)');
console.log('   Example: path("api/v1/zaken/<pk>/") → Resource: "zaken" [-R--]');
console.log('   Logic: Remove "api/", "v\d+/" prefixes, take first non-parameter segment\n');

console.log('3️⃣  Route Definitions (JavaScript)');
console.log('   Example: app.get("/products/:id") → Resource: "products" [-R--]');
console.log('   Logic: Parse path from route handler\n');

console.log('═'.repeat(75));
console.log('\n📊 ACTUAL DETECTED RESOURCES FROM OPENZAAK:\n');

const openzaak = results.repositories.find(r => r.name === 'Openzaak');
const resources = openzaak.analysis.code.apiResources.resources;

// Categorize resources
const businessResources = [];
const infrastructureResources = [];
const testResources = [];

Object.entries(resources).forEach(([name, crud]) => {
  const crudStr = [
    crud.create ? 'C' : '-',
    crud.read ? 'R' : '-',
    crud.update ? 'U' : '-',
    crud.delete ? 'D' : '-'
  ].join('');
  
  const item = { name, crud: crudStr };
  
  if (name.includes('test') || name === 'foo' || name.includes('nested')) {
    testResources.push(item);
  } else if (name === 'admin' || name === '__debug__' || name === 'oidc' || 
             name === 'ref' || name === 'auth' || name.startsWith('http')) {
    infrastructureResources.push(item);
  } else {
    businessResources.push(item);
  }
});

console.log('🏢 Business/Domain Resources (likely ViewSets):');
console.log('─'.repeat(75));
businessResources.slice(0, 15).forEach(r => {
  console.log(`   ${r.name.padEnd(30)} [${r.crud}]`);
});
console.log(`   ... and ${businessResources.length - 15} more\n`);

console.log('⚙️  Infrastructure/Framework Resources (URL patterns):');
console.log('─'.repeat(75));
infrastructureResources.forEach(r => {
  console.log(`   ${r.name.padEnd(30)} [${r.crud}]  ← Framework route`);
});

console.log('\n🧪 Test/Debug Resources:');
console.log('─'.repeat(75));
testResources.forEach(r => {
  console.log(`   ${r.name.padEnd(30)} [${r.crud}]  ← Test code`);
});

console.log('\n═'.repeat(75));
console.log('\n💡 INSIGHTS:\n');
console.log(`   Total Resources:      ${Object.keys(resources).length}`);
console.log(`   Business Resources:   ${businessResources.length} (ViewSets, APIs)`);
console.log(`   Infrastructure:       ${infrastructureResources.length} (admin, debug, auth)`);
console.log(`   Test/Debug:           ${testResources.length}\n`);

console.log('🎯 DETECTION QUALITY:\n');
console.log('   ✅ Business resources detected: ViewSets like "zaken", "besluiten", etc.');
console.log('   ✅ CRUD capabilities tracked per resource');
console.log('   ⚠️  Infrastructure routes included (admin, oidc, ref)');
console.log('   ⚠️  Some edge cases: "http:" detected from URL patterns\n');
