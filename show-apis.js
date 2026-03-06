const results = require('./results.json');

console.log('\n📊 API RESOURCES BY REPOSITORY\n');
console.log('Repository'.padEnd(30) + ' Resources  Full-CRUD  Read-Only  Partial');
console.log('='.repeat(75));

let totalResources = 0, totalFullCrud = 0, totalReadOnly = 0, totalPartial = 0;

results.repositories.forEach(repo => {
  const apiResources = repo.analysis.code.apiResources;
  
  let fullCrud = apiResources.fullCrudCount || 0;
  let readOnly = apiResources.readOnlyCount || 0;
  let partial = apiResources.partialCount || 0;

  // Backward compatibility with older results.json that still contains resource names
  if ((fullCrud === 0 && readOnly === 0 && partial === 0) && apiResources.resources) {
    Object.values(apiResources.resources).forEach(r => {
      if (r.create && r.read && r.update && r.delete) {
        fullCrud++;
      } else if (r.read && !r.create && !r.update && !r.delete) {
        readOnly++;
      } else {
        partial++;
      }
    });
  }
  
  console.log(
    repo.name.padEnd(30) +
    apiResources.uniqueCount.toString().padStart(10) +
    fullCrud.toString().padStart(11) +
    readOnly.toString().padStart(11) +
    partial.toString().padStart(9)
  );
  
  totalResources += apiResources.uniqueCount;
  totalFullCrud += fullCrud;
  totalReadOnly += readOnly;
  totalPartial += partial;
});

console.log('='.repeat(75));
console.log(
  'TOTAL'.padEnd(30) +
  totalResources.toString().padStart(10) +
  totalFullCrud.toString().padStart(11) +
  totalReadOnly.toString().padStart(11) +
  totalPartial.toString().padStart(9)
);
console.log('\n');

