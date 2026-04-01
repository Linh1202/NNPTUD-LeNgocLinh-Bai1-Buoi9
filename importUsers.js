const mongoose = require('mongoose');
const fs = require('fs');
const Excel = require('exceljs');
const userController = require('./controllers/users');
const roleModel = require('./schemas/roles');
const mailHandler = require('./utils/mailHandler');
const crypto = require('crypto');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// MongoDB Connection string (matching app.js)
const MONGO_URI = 'mongodb://localhost:27017/NNPTUD-C4';

// Function to generate a random 16-character password
function generatePassword(length = 16) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    for (let i = 0; i < length; ++i) {
        const randomIndex = crypto.randomInt ? crypto.randomInt(0, charset.length) : Math.floor(Math.random() * charset.length);
        retVal += charset.charAt(randomIndex);
    }
    return retVal;
}

async function importUsers() {
    try {
        console.log("Connecting to Database...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected to Database.");

        // 1. Find the 'user' role
        let userRole = await roleModel.findOne({ name: 'user' });
        if (!userRole) {
            console.log("'user' role not found. Creating it...");
            userRole = new roleModel({ name: 'user', description: 'Regular User' });
            await userRole.save();
        }
        console.log(`Using role: ${userRole.name} (${userRole._id})`);

        // 2. Load data from Excel or JSON
        let usersToImport = [];

        if (fs.existsSync('./user.xlsx')) {
            console.log("Reading from user.xlsx...");
            const workbook = new Excel.Workbook();
            await workbook.xlsx.readFile('./user.xlsx');
            const worksheet = workbook.getWorksheet(1); // First sheet

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header
                const username = row.getCell(1).text || row.getCell(1).value;
                const email = row.getCell(2).text || row.getCell(2).value;
                if (username && email) {
                    usersToImport.push({ username, email });
                }
            });
        } else if (fs.existsSync('./users_import.json')) {
            console.log("user.xlsx not found. Reading from users_import.json instead...");
            usersToImport = JSON.parse(fs.readFileSync('./users_import.json', 'utf8'));
        } else {
            console.error("Neither user.xlsx nor users_import.json found!");
            process.exit(1);
        }

        console.log(`Starting import of ${usersToImport.length} users...`);

        let count = 0;
        for (const userData of usersToImport) {
            const { username, email } = userData;
            
            // Check if user already exists
            const existingByUsername = await userController.GetAnUserByUsername(username);
            const existingByEmail = await userController.GetAnUserByEmail(email);

            if (existingByUsername || existingByEmail) {
                console.log(`[SKIP] User ${username} (${email}) already exists.`);
                continue;
            }

            // 3. Generate random password
            const password = generatePassword(16);

            // 4. Create user
            try {
                await userController.CreateAnUser(
                    username, 
                    password, 
                    email, 
                    userRole._id, 
                    null, // session
                    username, // fullName
                    undefined, // avatarUrl
                    true, // status (active)
                    0 // loginCount
                );
                
                // 5. Send email
                await mailHandler.sendPasswordMail(email, username, password);
                count++;
                console.log(`[SUCCESS] (${count}/${usersToImport.length}) Created user: ${username} - Password sent to ${email}`);

                // Wait 2 seconds before next user to avoid Mailtrap rate limit
                await sleep(2000);
            } catch (err) {
                console.error(`[ERROR] Failed to create user ${username}:`, err.message);
            }
        }

        console.log(`\nImport completed! Total users created: ${count}`);
        mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("Import process failed:", error);
        if (mongoose.connection.readyState !== 0) mongoose.connection.close();
        process.exit(1);
    }
}

importUsers();

