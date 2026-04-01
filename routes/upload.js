var express = require("express");
var router = express.Router();
let { uploadImage, uploadExcel } = require('../utils/uploadHandler')
let exceljs = require('exceljs')
let path = require('path')
let categoriesModel = require('../schemas/categories')
let productModel = require('../schemas/products')
let inventoryModel = require('../schemas/inventories')
let mongoose = require('mongoose');
let slugify = require('slugify')
let userController = require('../controllers/users')
let roleModel = require('../schemas/roles')
let mailHandler = require('../utils/mailHandler')
let crypto = require('crypto')

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generatePassword(length = 16) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    for (let i = 0; i < length; ++i) {
        const randomIndex = crypto.randomInt ? crypto.randomInt(0, charset.length) : Math.floor(Math.random() * charset.length);
        retVal += charset.charAt(randomIndex);
    }
    return retVal;
}
//client ->upload->save

router.post('/one_file', uploadImage.single('file'), function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file khong duoc de trong"
        })
    } else {
        res.send({
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size
        })
    }
})
router.get('/:filename', function (req, res, next) {
    let pathFile = path.join(__dirname, '../uploads', req.params.filename)
    res.sendFile(pathFile)
})

router.post('/multiple_files', uploadImage.array('files'), function (req, res, next) {
    if (!req.files) {
        res.status(404).send({
            message: "file khong duoc de trong"
        })
    } else {
        res.send(req.files.map(f => {
            return {
                filename: f.filename,
                path: f.path,
                size: f.size
            }
        }))
    }
})


router.post('/excel', uploadExcel.single('file'), async function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file khong duoc de trong"
        })
    } else {
        //workbook->worksheet->row/column->cell
        let workbook = new exceljs.Workbook();
        let pathFile = path.join(__dirname, '../uploads', req.file.filename)
        await workbook.xlsx.readFile(pathFile)
        let worksheet = workbook.worksheets[0];
        let categories = await categoriesModel.find({});
        let categoriesMap = new Map();
        for (const category of categories) {
            categoriesMap.set(category.name, category._id)
        }
        let products = await productModel.find({});
        let getTitle = products.map(p => p.title)
        let getSku = products.map(p => p.sku)
        //Map key->value
        let result = []
        for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
            let errorsInRow = [];
            const row = worksheet.getRow(rowIndex);
            let sku = row.getCell(1).value
            let title = row.getCell(2).value
            let category = row.getCell(3).value
            let price = Number.parseInt(row.getCell(4).value)
            let stock = Number.parseInt(row.getCell(5).value)
            if (price < 0 || isNaN(price)) {
                errorsInRow.push("price la so duong")
            }
            if (stock < 0 || isNaN(stock)) {
                errorsInRow.push("stock la so duong")
            }
            if (!categoriesMap.has(category)) {
                errorsInRow.push("category khong hop le")
            }
            if (getTitle.includes(title)) {
                errorsInRow.push("title khong duoc trung")
            }
            if (getSku.includes(sku)) {
                errorsInRow.push("sku khong duoc trung")
            }
            if (errorsInRow.length > 0) {
                result.push(errorsInRow);
                continue
            }
            let session = await mongoose.startSession()
            session.startTransaction()
            try {
                let newProduct = new productModel({
                    sku: sku,
                    title: title,
                    slug: slugify(title, {
                        replacement: '-',
                        remove: undefined,
                        lower: true
                    }),
                    price: price,
                    description: title,
                    category: categoriesMap.get(category)
                })
                await newProduct.save({ session })
                let newInventory = new inventoryModel({
                    product: newProduct._id,
                    stock: stock
                })
                await newInventory.save({ session });
                await newInventory.populate('product')
                await session.commitTransaction();
                await session.endSession()
                getTitle.push(title);
                getSku.push(sku)
                result.push(newInventory)
            } catch (error) {
                await session.abortTransaction();
                await session.endSession()
                result.push(error.message)
            }
        }
        res.send(result)
    }
})

router.post('/users-excel', uploadExcel.single('file'), async function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file khong duoc de trong"
        })
    } else {
        try {
            let workbook = new exceljs.Workbook();
            let pathFile = path.join(__dirname, '../uploads', req.file.filename)
            await workbook.xlsx.readFile(pathFile)
            let worksheet = workbook.worksheets[0];

            let userRole = await roleModel.findOne({ name: 'user' });
            if (!userRole) {
                userRole = new roleModel({ name: 'user', description: 'Regular User' });
                await userRole.save();
            }

            let results = [];
            for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
                const row = worksheet.getRow(rowIndex);
                let username = row.getCell(1).text || row.getCell(1).value;
                let email = row.getCell(2).text || row.getCell(2).value;

                if (username && email) {
                    // Check if exists
                    const existingByUsername = await userController.GetAnUserByUsername(username);
                    const existingByEmail = await userController.GetAnUserByEmail(email);

                    if (existingByUsername || existingByEmail) {
                        results.push({ username, email, status: "Skipped (Exists)" });
                        continue;
                    }

                    let password = generatePassword(16);
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

                    // Send email with error handling to avoid stopping the whole process
                    try {
                        await mailHandler.sendPasswordMail(email, username, password);
                        results.push({ username, email, status: "Created & Email Sent" });
                    } catch (mailError) {
                        console.error(`[MAIL ERROR] Failed to send email to ${email}:`, mailError.message);
                        results.push({ username, email, status: "Created but Email Failed", error: mailError.message });
                    }

                    // Wait 3 seconds before next user to avoid Mailtrap rate limit
                    await sleep(3000);
                }
            }
            res.send(results);
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    }
})

module.exports = router;