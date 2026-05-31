const fs = require('fs');
const path = require('path');

const files = [
    'refined_tpd_mastery_blueprint.md',
    'video_notes_7_11.md',
    'video_notes_12_15.md',
    'video_notes_17_22.md'
];

for (const file of files) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.log(`Not found: ${filePath}`);
        continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`=== SEARCHING: ${file} ===`);
    lines.forEach((line, index) => {
        const lower = line.toLowerCase();
        if (lower.includes('90') || lower.includes('minute') || lower.includes('cycle')) {
            console.log(`${index + 1}: ${line.trim()}`);
        }
    });
}
