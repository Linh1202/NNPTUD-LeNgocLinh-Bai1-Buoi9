let messageModel = require('../schemas/messages');

module.exports = {
    GetMessagesBetweenUsers: async function (user1, user2) {
        return await messageModel.find({
            $or: [
                { from: user1, to: user2 },
                { from: user2, to: user1 }
            ]
        }).sort({ createdAt: 1 });
    },
    CreateMessage: async function (from, to, type, text) {
        let newMessage = new messageModel({
            from: from,
            to: to,
            messageContent: {
                type: type,
                text: text
            }
        });
        await newMessage.save();
        return newMessage;
    },
    GetLastMessagesPerUser: async function (currentUserId) {
        // Query to find all messages involving currentUserId
        // Group by the "other" user
        // Sort by createdAt desc and pick the first one for each group
        return await messageModel.aggregate([
            {
                $match: {
                    $or: [
                        { from: currentUserId },
                        { to: currentUserId }
                    ]
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: {
                            if: { $eq: ["$from", currentUserId] },
                            then: "$to",
                            else: "$from"
                        }
                    },
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'otherUser'
                }
            },
            {
                $unwind: '$otherUser'
            }
        ]);
    }
}
