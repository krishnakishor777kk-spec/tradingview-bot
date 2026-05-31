const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Install megajs if not already present
try {
    require.resolve('megajs');
} catch (e) {
    console.log("Installing megajs library...");
    execSync('npm install megajs', { stdio: 'inherit' });
    console.log("megajs installed successfully!");
}

// Now we can require megajs
const { File } = require('megajs');

const urls = [
    "https://mega.nz/file/MUM2STga#kQHW_lWlgh4ys24Qd5j6o31y0X4ykA-KdJVY--_BWD0",
    "https://mega.nz/file/oRUFDYgZ#TU_W3NFbzUzfZF45RkwpwXkmeJrsmAyTGEenTz4Uj0w",
    "https://mega.nz/file/FM0QCQQT#ThbQuDMrKQenhxC3aPaga8TmzC2J7kdR01YYdPH4Vo8",
    "https://mega.nz/file/gANh1IAQ#LOmDJxGBA4ug1dw2rQanPwGRLxoT3MAc3jk3UtciSSM",
    "https://mega.nz/file/YIsHDTJB#-VCSvuGozwf3peCjCpVoCby112KpYDM87PDc2VyIFTk",
    "https://mega.nz/file/8NFTmQ6J#k9Y1bm-mwsARQuvGBXsfFzoYk0PYfE7-qIr58ZbxkV8",
    "https://mega.nz/file/hEd2kKSQ#q4TLkDM-oMBJniCciB8-Pb8PkS980pKKLH5T5PYMpt8",
    "https://mega.nz/file/FVNAkYQI#_byMRj0J_yfETJsn60VlIBVHedGK61eVrJzgycJvFxI",
    "https://mega.nz/file/0NtwFCTB#mUgIPKpxd1uDVPVu_O6tuXndx92LjroYJ75Nb-ysYxM",
    "https://mega.nz/file/QclTRC7Z#qVnjgOGdoKUo3B37hKdLgDr9bzJ_mqrnsm6G5Nq1TOo",
    "https://mega.nz/file/YVV0BLxa#Q3aSdFY43ghIkhqW82w9LisOuUCK5ZAgwTw4R6XU6P0",
    "https://mega.nz/file/0MtWnYpR#Sh3-WbaRFW97ec99IRlhyGKzpVaMzwb15P51p-Zqa-Q",
    "https://mega.nz/file/BV13zbaT#5DrR6057kOrthkCsWOrCYIyRme7J49e6khyY4XmbLRI",
    "https://mega.nz/file/QIsUmahK#qAeY4COqzGRc2l1BWikomfx-9ujYddehwuyCSrmyD80",
    "https://mega.nz/file/4JEWUAID#LpMf2AY3MAIAoj5-Rt8M3M1vBsY61_isYB-hCszzXLU",
    "https://mega.nz/file/kVlFhZJT#3we1cYLXFbWuuX3Ko9iMWHT4SFzS7HZv_5nKpLyn92U",
    "https://mega.nz/file/AFsBUIID#_BFjgcljzySHdvOI0fwR6-51udiNrzGos3n0qhjzBKk",
    "https://mega.nz/file/1R1QmZTT#j3_kLsitOJIlgspi8xPzEFXOiG52gAZrVU1eU6FRG_I",
    "https://mega.nz/file/EFc0mLiL#1xXMZW4WQiwIuSllbWTBFBFt95mCXU5PSroAvMsc9ck",
    "https://mega.nz/file/NUNVmQTC#eYSkgcaws_DrcC5fBIXx0QS2TT-Dd3MYz1AF34wTJR8",
    "https://mega.nz/file/NJk1TRxa#nf8zZ63ci4AYAIrIX2Yi_obAOm5ezfnYE47SmCpz_ZE"
];

const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

async function downloadFile(url, index) {
    return new Promise((resolve, reject) => {
        console.log(`\n[${index}/${urls.length}] Connecting to: ${url}`);
        try {
            const file = File.fromURL(url);
            file.loadAttributes((error, loadedFile) => {
                if (error) {
                    console.error(`Error loading attributes:`, error);
                    return reject(error);
                }

                const fileName = loadedFile.name;
                const fileSize = loadedFile.size;
                const destPath = path.join(downloadDir, fileName);

                // Skip if already completely downloaded
                if (fs.existsSync(destPath)) {
                    const stats = fs.statSync(destPath);
                    // Check if file size matches closely (within 10KB to handle minor stream variances)
                    if (Math.abs(stats.size - fileSize) < 10240) {
                        console.log(`--> Already downloaded: "${fileName}". Skipping!`);
                        return resolve();
                    } else {
                        console.log(`--> File exists but size mismatch (${stats.size} vs ${fileSize} bytes). Redownloading...`);
                    }
                }

                console.log(`Downloading: "${fileName}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);

                const stream = loadedFile.download();
                const writeStream = fs.createWriteStream(destPath);

                let bytesLoaded = 0;
                let lastLoggedPercent = -10;

                stream.on('data', (chunk) => {
                    bytesLoaded += chunk.length;
                    const percent = Math.floor((bytesLoaded / fileSize) * 100);
                    if (percent % 10 === 0 && percent !== lastLoggedPercent) {
                        console.log(`Progress: ${percent}% (${(bytesLoaded / (1024 * 1024)).toFixed(2)} / ${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
                        lastLoggedPercent = percent;
                    }
                });

                stream.on('error', (err) => {
                    console.error(`Error downloading file data:`, err);
                    reject(err);
                });

                writeStream.on('error', (err) => {
                    console.error(`Error writing file to disk:`, err);
                    reject(err);
                });

                writeStream.on('finish', () => {
                    console.log(`Successfully saved to ${destPath}`);
                    resolve();
                });

                stream.pipe(writeStream);
            });
        } catch (e) {
            console.error(`Failed to initialize download:`, e);
            reject(e);
        }
    });
}

async function startDownloads() {
    console.log(`Starting Node.js downloader for ${urls.length} files...`);
    for (let i = 0; i < urls.length; i++) {
        try {
            await downloadFile(urls[i], i + 1);
        } catch (error) {
            console.error(`Skipping file due to error:`, error.message || error);
        }
    }
    console.log("\nAll downloads finished!");
}

startDownloads();
