import fs from 'fs';
import path from 'path';

function findRoutes(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findRoutes(fullPath, baseDir));
    } else if (file === 'route.ts' || file === 'route.js') {
      const relPath = path.relative(baseDir, path.dirname(fullPath)).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath, 'utf-8');
      const methods = [];
      if (content.includes('export async function GET') || content.includes('export function GET')) methods.push('GET');
      if (content.includes('export async function POST') || content.includes('export function POST')) methods.push('POST');
      if (content.includes('export async function PATCH') || content.includes('export function PATCH')) methods.push('PATCH');
      if (content.includes('export async function PUT') || content.includes('export function PUT')) methods.push('PUT');
      if (content.includes('export async function DELETE') || content.includes('export function DELETE')) methods.push('DELETE');
      results.push({
        path: '/api/' + relPath,
        methods: methods.length ? methods : ['CUSTOM']
      });
    }
  }
  return results;
}

const routes = findRoutes('D:\\AIcloser\\application\\src\\app\\api');
fs.writeFileSync('D:\\new aicloser UI\\app-routes-inventory.json', JSON.stringify(routes, null, 2), 'utf-8');
console.log('Found', routes.length, 'live API routes in D:\\AIcloser\\application\\src\\app\\api');
