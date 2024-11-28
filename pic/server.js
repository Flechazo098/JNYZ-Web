const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require("node:http");
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json()); // 解析 JSON 请求体

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 存储图片元数据的文件
const metadataFile = path.join(__dirname, 'metadata.json');

// 初始化元数据文件
if (!fs.existsSync(metadataFile)) {
    fs.writeFileSync(metadataFile, JSON.stringify({}));
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // 设置文件存储路径为通用目录
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); // 使用时间戳和原文件名
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|mp4/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('文件类型不支持'));
        }
    }
});

app.post('/upload', upload.single('image'), (req, res) => {
    console.log('Received request:', req.body); // 打印请求参数
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const { year, month, date } = req.body;
    if (!year || !month || !date) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    // 读取现有元数据
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));

    // 更新元数据
    if (!metadata[year]) {
        metadata[year] = {};
    }
    if (!metadata[year][month]) {
        metadata[year][month] = {};
    }
    metadata[year][month][date] = req.file.filename;

    // 保存元数据
    fs.writeFileSync(metadataFile, JSON.stringify(metadata));

    res.json({ filename: req.file.filename });
});

// 提供获取元数据的 API
app.get('/metadata/:year/:month', (req, res) => {
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    const { year, month } = req.params;
    const monthMetadata = metadata[year] && metadata[year][month] ? metadata[year][month] : {};
    res.json(monthMetadata);
});

// 新增获取所有元数据的 API
app.get('/metadata', (req, res) => {
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    res.json(metadata);
});

// 删除图片的 API
app.delete('/delete', (req, res) => {
    const { year, month, date } = req.body;

    // 读取现有元数据
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));

    if (metadata[year] && metadata[year][month] && metadata[year][month][date]) {
        const filename = metadata[year][month][date];
        const filePath = path.join(uploadDir, filename);

        // 删除文件
        fs.unlink(filePath, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete file' });
            }

            // 更新元数据
            delete metadata[year][month][date];
            fs.writeFileSync(metadataFile, JSON.stringify(metadata));

            res.json({ message: 'File deleted successfully' });
        });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// 静态文件服务
app.use('/pic', express.static(uploadDir));

// 保存笔记的 API
app.post('/saveNote', (req, res) => {
    const { year, month, date, note } = req.body;

    // 读取现有元数据
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));


    if (!metadata[year]) {
        metadata[year] = {};
    }
    if (!metadata[year][month]) {
        metadata[year][month] = {};
    }
    if (!metadata[year][month][date]) {
        metadata[year][month][date] = {};
    }
    metadata[year][month][date].note = note;

    // 保存元数据
    fs.writeFileSync(metadataFile, JSON.stringify(metadata));

    res.json({ message: 'Note saved successfully' });
});


// 全局错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
