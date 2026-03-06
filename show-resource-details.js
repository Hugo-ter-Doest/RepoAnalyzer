const results = require('./results.json');

console.log('\n📊 API RESOURCE DETAILS\n');

// Get all unique resources across all repos
const allResources = new Map();

results.repositories.forEach(repo => {
  const resources = repo.analysis.code.apiResources.resources || {};
  
  Object.entries(resources).forEach(([name, crud]) => {
    if (!allResources.has(name)) {
      allResources.set(name, {
        name: name,
        repos: new Set(),
        totalCrud: { create: 0, read: 0, update: 0, delete: 0 }
      });
    }
    
    const resource = allResources.get(name);
    resource.repos.add(repo.name);
    if (crud.create) resource.totalCrud.create++;
    if (crud.read) resource.totalCrud.read++;
    if (crud.update) resource.totalCrud.update++;
    if (crud.delete) resource.totalCrud.delete++;
  });
});

// Sort by number of repos using this resource
const sortedResources = Array.from(allResources.values())
  .sort((a, b) => b.repos.size - a.repos.size);

console.log(`Total unique resources across all repos: ${allResources.size}\n`);

console.log('Most common resources (used in multiple repos):');
console.log('='.repeat(75));
console.log('Resource'.padEnd(25) + ' Repos  C  R  U  D');
console.log('='.repeat(75));

sortedResources
  .filter(r => r.repos.size > 1)
  .slice(0, 20)
  .forEach(r => {
    console.log(
      r.name.padEnd(25) +
      r.repos.size.toString().padStart(6) +
      r.totalCrud.create.toString().padStart(4) +
      r.totalCrud.read.toString().padStart(3) +
      r.totalCrud.update.toString().padStart(3) +
      r.totalCrud.delete.toString().padStart(3)
    );
  });

console.log('\n\nSample resources from Openzaak:');
console.log('='.repeat(75));

const openzaakResources = results.repositories
  .find(r => r.name === 'Openzaak')
  ?.analysis.code.apiResources.resources || {};

Object.entries(openzaakResources)
  .slice(0, 20)
  .forEach(([name, crud]) => {
    const crudStr = [
      crud.create ? 'C' : '-',
      crud.read ? 'R' : '-',
      crud.update ? 'U' : '-',
      crud.delete ? 'D' : '-'
    ].join('');
    console.log(`  ${name.padEnd(30)} [${crudStr}]`);
  });

console.log('\n');
