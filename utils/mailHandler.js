const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 25,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "75696530a5f510",
        pass: "192a1c119729ed",
    },
});

module.exports = {
    sendMail: async (to, url) => {
        const info = await transporter.sendMail({
            from: 'admin@haha.com',
            to: to,
            subject: "RESET PASSWORD REQUEST",
            text: "lick vo day de doi pass", // Plain-text version of the message
            html: "lick vo <a href=" + url + ">day</a> de doi pass", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendPasswordMail: async (to, username, password) => {
        const info = await transporter.sendMail({
            from: 'admin@haha.com',
            to: to,
            subject: "Chào mừng bạn đến với hệ thống!",
            text: `Chào ${username},\nTài khoản của bạn đã được tạo thành công.\nUsername: ${username}\nPassword: ${password}`,
            html: `<p>Chào <b>${username}</b>,</p>
                   <p>Tài khoản của bạn đã được tạo thành công.</p>
                   <p><b>Username:</b> ${username}</p>
                   <p><b>Password:</b> ${password}</p>`
        });
        console.log("Account info sent to:", to);
    }
}