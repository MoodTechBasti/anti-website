const fs = require('fs');
const js = fs.readFileSync('main-SUIVHLSS.js', 'utf8');

function findOccurrences(query, sizeBefore = 100, sizeAfter = 1000) {
    console.log(`\n=== Occurrences of "${query}" ===`);
    let idx = 0;
    let count = 0;
    while (true) {
        idx = js.indexOf(query, idx);
        if (idx === -1) break;
        count++;
        if (count > 5) {
            console.log("Too many matches, stopping search.");
            break;
        }
        console.log(`Match ${count} at index ${idx}. Context:`);
        const start = Math.max(0, idx - sizeBefore);
        const end = Math.min(js.length, idx + query.length + sizeAfter);
        console.log(js.slice(start, end));
        console.log("-----------------------------------------");
        idx += query.length;
    }
}

findOccurrences("vertexShader:", 50, 1500);
findOccurrences("fragmentShader:", 50, 1500);
