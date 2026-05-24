import fs from 'fs';

const js = fs.readFileSync('main-SUIVHLSS.js', 'utf8');

const startQuery = "var Eoe=`";
const startIdx = js.indexOf(startQuery);
if (startIdx === -1) {
    console.log("Could not find start index");
} else {
    const endQuery = "`,Gh={noise:Eoe}";
    const endIdx = js.indexOf(endQuery, startIdx);
    if (endIdx === -1) {
        console.log("Could not find end index");
    } else {
        const noiseCode = js.slice(startIdx + startQuery.length, endIdx);
        fs.writeFileSync("noise.glsl", noiseCode, "utf8");
        console.log("Saved noise.glsl!");
    }
}
