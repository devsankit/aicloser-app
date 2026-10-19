import fs from 'fs';

const content = fs.readFileSync('D:\\AIcloser\\application\\src\\lib\\api-client.ts', 'utf-8');

const lines = content.split('\n');
const modules = {};
let currentModule = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect top-level module: e.g. "  leads: {"
  const modMatch = line.match(/^\s{2}([a-zA-Z0-9_]+):\s*\{/);
  if (modMatch && !line.includes('const') && !line.includes('interface')) {
    currentModule = modMatch[1];
    modules[currentModule] = [];
    continue;
  }

  // Detect method inside module: e.g. "    async list(" or "    list("
  if (currentModule) {
    const fnMatch = line.match(/^\s{4}(?:async\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      const params = fnMatch[2].trim();
      
      // Look forward a few lines for the endpoint URL and method
      let endpoint = '';
      let method = 'GET';
      for (let j = i; j < Math.min(i + 20, lines.length); j++) {
        const nextLine = lines[j];
        const urlMatch = nextLine.match(/request(?:<[^>]+>)?\(\s*[`"']([^`"']+)`|request(?:<[^>]+>)?\(\s*[`"']([^`"']+)[`"']/);
        if (urlMatch) {
          endpoint = urlMatch[1] || urlMatch[2];
        }
        const methodMatch = nextLine.match(/method:\s*["'](GET|POST|PUT|PATCH|DELETE)["']/i);
        if (methodMatch) {
          method = methodMatch[1].toUpperCase();
        }
        if (nextLine.includes('return ') || nextLine.includes('};')) break;
      }
      
      modules[currentModule].push({ fnName, params, endpoint, method });
    }
  }
}

fs.writeFileSync('D:\\new aicloser UI\\api-inventory.json', JSON.stringify(modules, null, 2), 'utf-8');
console.log('Successfully wrote UTF-8 api-inventory.json with', Object.keys(modules).length, 'modules');
