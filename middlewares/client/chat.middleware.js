const RoomChat = require("../../models/room-chat.model");

module.exports.isAccess = async (req, res, next) => {
    try {
        const roomChatId = req.params.roomChatId;
        const userId = res.locals.user.id;

        const userInRoomChat = await RoomChat.findOne({
            _id: roomChatId,
            "users.user_id": userId,
            deleted: false
        });

        if (!userInRoomChat) {
            res.redirect("/client/pages/errors/404");
            return;
        }

        next();
    } catch (error) {
        res.redirect("/client/pages/errors/404");
    }
}