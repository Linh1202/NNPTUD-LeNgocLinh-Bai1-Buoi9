let mongoose = require('mongoose');

let messageSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    messageContent: {
        type: {
            type: String,
            enum: ['file', 'text'],
            required: true
        },
        text: {
            type: String,
            required: true
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('messages', messageSchema);
