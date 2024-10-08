const Cart = require("../../models/cart.model");
const User = require("../../models/user.model");
const ForgotPassword = require("../../models/forgot-password.model");

const md5 = require('md5')

const generateHelper = require("../../helpers/generate");
const sendEmailHelper = require("../../helpers/sendEmail");

// [GET] /user/register
module.exports.register = async (req, res) => {
  res.render("client/pages/user/register", {
    pageTitle: "Đăng ký tài khoản",
  });
};

// [POST] /user/register
module.exports.registerPost = async (req, res) => {
  const existUser = await User.findOne({
    email: req.body.email,
    deleted: false
  });

  if (existUser) {
    req.flash("error", "Email đã tồn tại!");
    res.redirect("back");
    return;
  }

  req.body.password = md5(req.body.password)
  req.body.avatar = "https://robohash.org/hicveldicta.png";

  const user = new User(req.body);
  await user.save();

  res.cookie("tokenUser", user.token);

  req.flash("success", "Đăng ký tài khoản thành công, vui lòng đăng nhập!");
  res.redirect("/user/login");
};

// [GET] /user/login
module.exports.login = async (req, res) => {
  res.render("client/pages/user/login", {
    pageTitle: "Đăng nhập tài khoản",
  });
};

// [POST] /user/login
module.exports.loginPost = async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const user = await User.findOne({
    email: email,
    deleted: false
  });

  if (!user) {
    req.flash("error", "Email không tồn tại!");
    res.redirect("back");
    return;
  }

  if (md5(password) != user.password) {
    req.flash("error", "Sai mật khẩu!");
    res.redirect("back");
    return;
  }

  if (user.status != "active") {
    req.flash("error", "Tài khoản đang bị khóa!");
    res.redirect("back");
    return;
  }

  await Cart.updateOne({
    _id: req.cookies.cartId
  }, {
    user_id: user.id
  });

  res.cookie("tokenUser", user.token);

  await User.updateOne({ _id: user.id }, { statusOnline: "online" });

  _io.once('connection', (socket) => {
    socket.broadcast.emit("SERVER_RETURN_STATUS_ONLINE", {
      userId: user.id,
      statusOnline: "online"
    })
  })

  req.flash("success", "Đăng nhập thành công!");
  res.redirect("/");
};

// [GET] /user/logout
module.exports.logout = async (req, res) => {
  const tokenUser = req.cookies.tokenUser;

  await User.updateOne({ token: tokenUser }, { statusOnline: "offline" });

  _io.once('connection', (socket) => {
    socket.broadcast.emit("SERVER_RETURN_STATUS_ONLINE", {
      userId: res.locals.user.id,
      statusOnline: "offline"
    })
  })
  res.clearCookie("tokenUser");

  req.flash("success", "Đăng xuất thành công!");
  res.redirect("/");
};

// [GET] /user/password/forgot
module.exports.forgotPassword = async (req, res) => {
  res.render("client/pages/user/forgot-password", {
    pageTitle: "Lấy lại mật khẩu",
  });
};

// [POST] /user/password/forgot
module.exports.forgotPasswordPost = async (req, res) => {
  const email = req.body.email;

  const user = await User.findOne({
    email: email,
    deleted: false
  });

  if (!user) {
    req.flash("error", "Email không tồn tại!");
    res.redirect("back");
    return;
  }

  const otp = generateHelper.generateRandomNumber(6)

  // Việc 1: Tạo mã OTP và lưu vào trong database
  const objectForgotPassword = {
    email: email,
    otp: otp,
    expireAt: Date.now() + 3 * 60,
  };

  const forgotPassword = new ForgotPassword(objectForgotPassword);
  await forgotPassword.save();

  // Việc 2: Gửi mã OTP qua email
  const subject = "Lấy lại mật khẩu.";
  const text = `Mã OTP xác thực tài khoản của bạn là: <b>${otp}</b>. Mã OTP có hiệu lực trong vòng 3 phút. Vui lòng không cung cấp mã OTP này với bất kỳ ai.`;
  sendEmailHelper.sendEmail(email, subject, text);

  res.redirect(`/user/password/otp?email=${email}`);
};

// [GET] /user/password/otp
module.exports.otpPassword = async (req, res) => {
  const email = req.query.email;

  res.render("client/pages/user/otp-password", {
    pageTitle: "Nhập mã OTP",
    email: email
  });
};

// [POST] /user/password/otp
module.exports.otpPasswordPost = async (req, res) => {
  const email = req.body.email;
  const otp = req.body.otp;

  const result = await ForgotPassword.findOne({
    email: email,
    otp: otp
  });

  if (!result) {
    req.flash("error", "Mã OTP không hợp lệ!");
    res.redirect("back");
    return;
  }

  const user = await User.findOne({
    email: email
  });

  res.cookie("tokenUser", user.token);

  res.redirect("/user/password/reset");
};

// [GET] /user/password/reset
module.exports.resetPassword = async (req, res) => {
  res.render("client/pages/user/reset-password", {
    pageTitle: "Đổi mật khẩu",
  });
};

// [POST] /user/password/reset
module.exports.resetPasswordPost = async (req, res) => {
  const tokenUser = req.cookies.tokenUser;
  const password = req.body.password;

  const user = await User.findOne({
    token: tokenUser
  });

  if (!user) {
    req.flash("error", "Tài khoản không tồn tại!");
    res.clearCookie("tokenUser");
    res.redirect("/");
    return;
  }

  const newToken = generateHelper.generateRandomString(20);

  await User.updateOne({
    token: tokenUser
  }, {
    password: md5(password),
    token: newToken
  });

  res.cookie("tokenUser", newToken);

  req.flash("success", "Đổi mật khẩu thành công!");
  res.redirect("/");
};

// [GET] /user/profile/edit
module.exports.editProfile = async (req, res) => {
  const user = await User
    .findOne({
      token: req.cookies.tokenUser,
      deleted: false
    })
    .select("-password");

  res.render("client/pages/user/edit-profile", {
    pageTitle: "Chỉnh sửa thông tin tài khoản",
    user: user
  });
}

// [PATCH] /user/profile/edit
module.exports.editProfilePatch = async (req, res) => {
  const id = res.locals.user.id;

  const emailExist = await User.findOne({
    _id: { $ne: id },
    email: req.body.email,
    deleted: false
  });

  if (emailExist) {
    req.flash("error", `Email ${emailExist.email} đã tồn tại`);
    res.redirect("back");
    return;
  }

  await User.updateOne({
    _id: id,
    deleted: false
  }, req.body);

  req.flash("success", "Chỉnh sửa thông tin tài khoản thành công!");

  res.redirect("back");
}

// [GET] /user/:slug
module.exports.profile = async (req, res) => {
  try {
    const slug = req.params.slug;
    const infoUser = await User.findOne({
      slug: slug,
      deleted: false
    }).select("-password");

    const friendsListId = infoUser.friendsList.map(friend => friend.user_id);
    infoUser.friendsListId = friendsListId;
    const friends = await User.find({
      _id: { $in: friendsListId }
    }).select('fullName avatar slug');

    res.render("client/pages/user/profile", {
      pageTitle: "Thông tin tài khoản",
      infoUser: infoUser,
      friends: friends
    });
  } catch (err) {
    console.log(err)
    res.render("client/pages/errors/404", {
      pageTitle: "404 Not Found"
    });
  }
};