import { build } from 'esbuild';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
await mkdir('public/embed',{recursive:true});
await build({entryPoints:['components/companion-widget-entry.tsx'],outfile:'public/embed/sozo-widget.js',bundle:true,minify:true,format:'iife',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'inline-css',setup(b){b.onLoad({filter:/.*/,namespace:'inline-css'},async(args)=>({contents:await readFile(args.path,'utf8'),loader:'text'}));b.onResolve({filter:/\.css\?inline$/},args=>({path:new URL(args.path,`file://${args.resolveDir}/`).pathname,namespace:'inline-css'}));}}]});
await mkdir('public/docs',{recursive:true});
await writeFile('public/docs/companion-integration.md',await readFile('docs/COMPANION-INTEGRATION.md'));
console.log('SOZO companion widget bundled.');
