import fs from 'fs';

// 1. Read the noise shader code
const noiseCode = fs.readFileSync('noise.glsl', 'utf8');

// 2. Process simulation_shader.glsl
let simShader = fs.readFileSync('simulation_shader.glsl', 'utf8');
// Replace `${this.size.toFixed(1)}` with '256.0' (size is 256)
simShader = simShader.replaceAll('${this.size.toFixed(1)}', '256.0');
fs.writeFileSync('simulation_shader.glsl', simShader, 'utf8');
console.log("Processed simulation_shader.glsl");

// 3. Process vertex_shader.glsl
let vertShader = fs.readFileSync('vertex_shader.glsl', 'utf8');
vertShader = vertShader.replaceAll('${Gh.noise}', noiseCode);
fs.writeFileSync('vertex_shader.glsl', vertShader, 'utf8');
console.log("Processed vertex_shader.glsl");

// 4. Process fragment_shader.glsl
let fragShader = fs.readFileSync('fragment_shader.glsl', 'utf8');
fragShader = fragShader.replaceAll('${Gh.noise}', noiseCode);
// Ensure fragment_shader has a closing brace or discard if it was cut off
if (!fragShader.trim().endsWith('}')) {
    console.log("Fixing cut-off ending of fragment_shader.glsl...");
    fragShader = fragShader.trim();
    // Check if it ends with "discar" or similar
    if (fragShader.endsWith('discar')) {
        fragShader = fragShader.slice(0, -6) + 'discard;\n                }\n            }';
    } else {
        fragShader += '\n                }\n            }';
    }
}
fs.writeFileSync('fragment_shader.glsl', fragShader, 'utf8');
console.log("Processed fragment_shader.glsl");
