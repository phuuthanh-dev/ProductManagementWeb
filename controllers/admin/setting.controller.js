const SettingGeneral = require("../../models/setting-general.model");

// [GET] /admin/settings/general
module.exports.general = async (req, res) => {
    const settingGeneral = await SettingGeneral.findOne({});

    res.render("admin/pages/settings/general", {
        pageTitle: "Thông tin Website",
        settingGeneral: settingGeneral
    });
};

// [PATCH] /admin/settings/general
module.exports.generalPatch = async (req, res) => {
    const settingGeneral = await SettingGeneral.findOne({});
    
    if (settingGeneral) {
        await SettingGeneral.updateOne({
            _id: settingGeneral.id
        }, req.body);
    } else {
        const record = new SettingGeneral(req.body);
        await record.save();
    }

    req.flash("success", "Cập nhật cài đặt chung thành công!");
    res.redirect("back");
};