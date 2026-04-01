let express = require('express');
let router = express.Router();
let messageController = require('../controllers/messages');
let { CheckLogin } = require('../utils/authHandler');
let { uploadFile } = require('../utils/uploadHandler');

// GET /:userID - Lấy toàn bộ message giữa user hiện tại và userID
router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let otherUserId = req.params.userID;
        let messages = await messageController.GetMessagesBetweenUsers(currentUserId, otherUserId);
        res.send(messages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST / - Gửi message (text hoặc file)
router.post('/', CheckLogin, uploadFile.single('file'), async function (req, res, next) {
    try {
        let from = req.user._id;
        let to = req.body.to;
        let type, text;

        if (req.file) {
            type = 'file';
            text = req.file.path; // or req.file.filename tùy theo yêu cầu
        } else {
            type = 'text';
            text = req.body.text;
        }

        if (!to || !text) {
            return res.status(400).send({ message: "Thiếu thông tin người nhận hoặc nội dung" });
        }

        let newMessage = await messageController.CreateMessage(from, to, type, text);
        res.send(newMessage);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET / - Lấy message cuối cùng của mỗi user mà user hiện tại nhắn tin hoặc ngược lại
router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let messages = await messageController.GetLastMessagesPerUser(currentUserId);
        res.send(messages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
