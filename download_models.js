const fs = require('fs');
const path = require('path');
const https = require('https');

const models = [
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model-shard1',
    'ssd_mobilenetv1_model-shard2',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2'
];

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const outputDir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const downloadFile = (file) => {
    const url = `${baseUrl}/${file}`;
    const filePath = path.join(outputDir, file);
    const fileStream = fs.createWriteStream(filePath);

    console.log(`Downloading ${file}...`);

    https.get(url, (response) => {
        if (response.statusCode !== 200) {
            console.error(`Failed to download ${file}: Status ${response.statusCode}`);
            fileStream.close();
            fs.unlink(filePath, () => { }); // Delete empty file
            return;
        }

        response.pipe(fileStream);

        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`Saved ${file}`);
        });
    }).on('error', (err) => {
        fs.unlink(filePath, () => { });
        console.error(`Error downloading ${file}: ${err.message}`);
    });
};

models.forEach(model => downloadFile(model));
