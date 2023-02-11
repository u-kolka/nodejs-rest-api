const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const gravatar = require("gravatar");
const path = require("path");
const fs = require("fs/promises");
const Jimp = require("jimp");
const { nanoid } = require("nanoid");
const { User } = require("../models/users");
const { HttpError } = require("../helpers/error-func");
const { sendMail } = require("../helpers/sendgrid");

require("dotenv").config();
const { JWT_SECRET } = process.env;

async function signupUser(req, res, next) {
    const { password, email, subscription } = req.body;

    try {
        const verificationToken = nanoid(12);
        const newUser = await User.findOne({ email });
        if (newUser) {
            return next(HttpError(409, "Email already in use!!!"));
        }

        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(password, salt);
        const savedUser = await User.create({
            password: hashedPassword,
            email,
            subscription,
            avatarURL: gravatar.url(email),
            verificationToken,
        });

        await sendMail({
            to: email,
            subject: "Please confirm your email",
            html: `<a href="http://localhost:3000/api/users/verify/${verificationToken}">Confirm your email</a>`,
        });

        return res.status(201).json({
            user: {
                email,
                subscription,
                id: savedUser._id,
            },
        });
    } catch (error) {
        return next(HttpError(400, error.message));
    }
}

async function loginUser(req, res, next) {
    const { password, email } = req.body;

    const storedUser = await User.findOne({ email });
    if (!storedUser) {
        return next(HttpError(401, "Email is wrong! Try again."));
    }

    if (!storedUser.verify) {
        return next(HttpError(401, "Email is not verified yet! Please check your mail box"));
      }

    const isPasswordValid = await bcrypt.compare(password, storedUser.password);

    if (!isPasswordValid) {
        return next(HttpError(401, "Password is wrong! Try again."));
    }

    const payload = { id: storedUser._id };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    await User.findByIdAndUpdate(storedUser._id, { token });
    return res.status(200).json({
        token,
        user: {
            email,
            subscription: storedUser.subscription,
        },
    });
}

async function logoutUser(req, res, next) {
    const { _id } = req.user;

    await User.findByIdAndUpdate(_id, { token: null });
    return res.status(204).json();
}

async function currentUser(req, res, next) {
    const { user } = req;
    const { email, subscription, id } = user;

    return res.status(200).json({
        email,
        subscription,
        id,
    });
}

async function updateUser(req, res, next) {
    const { _id } = req.user;
    const { subscription } = req.body;

    const updatedUser = await User.findByIdAndUpdate(_id, { subscription });

    return res.status(200).json(updatedUser);
}

async function uploadImage(req, res, next) {
    const { filename } = req.file;

    try {
        const tmpPath = path.resolve(__dirname, "../tmp", filename);
        const publicPath = path.resolve(__dirname, "../public/avatars", filename);
        await fs.rename(tmpPath, publicPath);

        const resizedImage = await Jimp.read(publicPath);
        resizedImage.resize(250, 250).write(publicPath);
    } catch (error) {
        await fs.unlink(tmpPath);
        return next(HttpError(401, error.message));
    }

    const { _id } = req.user;
    const user = await User.findByIdAndUpdate(_id, {avatarURL: `/avatars/${filename}`});
    return res.status(200).json({
        avatarURL: user.avatarURL,
    });
}

async function verifyEmail(req, res, next) {
    const { verificationToken } = req.params;
    const user = await User.findOne({
        verificationToken,
    });
  
    if (!user) {
        return next(HttpError(404, "User not found"));
    }
  
    await User.findByIdAndUpdate(user._id, {
        verify: true,
        verificationToken: null,
    });
  
    return res.status(200).json({
        message: "Verification successful",
    });
  }

  async function repeatSendVerifyEmail(req, res, next) {
    const { email } = req.body;

    if (!email) {
        return next(HttpError(400, "Missing required field email"));
    }

    const user = await User.findOne({email});
    if (user.verify) {
        return next(HttpError(400, "Verification has already been passed"));
    }

    await sendMail({
        to: email,
        subject: "Please confirm your email",
        html: `<a href="http://localhost:3000/api/users/verify/${user.verificationToken}">Confirm your email</a>`,
    });
  
    return res.status(200).json({
        message: "Verification email sent",
    });
  }

module.exports = {
    signupUser,
    loginUser,
    logoutUser,
    currentUser,
    updateUser,
    uploadImage,
    verifyEmail,
    repeatSendVerifyEmail,
};
