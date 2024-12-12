// using express JS
var express = require("express");
var app = express();
const mongoose = require('mongoose');
// express formidable is used to parse the form data values
var formidable = require("express-formidable");
app.use(formidable());

// use mongo DB as database
var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;

// the unique ID for each mongo DB document
var ObjectId = mongodb.ObjectId;

// receiving http requests
var httpObj = require("http");
var http = httpObj.createServer(app);

// to encrypt/decrypt passwords
var bcrypt = require("bcrypt");

// to store files
var fileSystem = require("fs");

// to start the session
var session = require("express-session");
app.use(session({
    secret: 'secret key',
    resave: false,
    saveUninitialized: false
}));

// define the publically accessible folders
app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/img", express.static(__dirname + "/public/img"));
app.use("/public/font-awesome-4.7.0", express.static(__dirname + "/public/font-awesome-4.7.0"));
app.use("/public/fonts", express.static(__dirname + "/public/fonts"));
app.use(express.static("public"));

// using EJS as templating engine
app.set("view engine", "ejs");

// main URL of website
var mainURL = "http://localhost:3000";

// global database object
var database = null;

// app middleware to attach main URL and user object with each request
app.use(function(request, result, next) {
    request.mainURL = mainURL;
    request.isLogin = (typeof request.session.user !== "undefined");
    request.user = request.session.user;

    // continue the request
    next();
});

// recursive function to get the file from uploaded
function recursiveGetFile(files, _id) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        const file = files[a];

        // return if file type is not folder and ID is found
        if (file.type != "folder") {
            if (file._id == _id) {
                return file;
            }
        }

        // if it is a folder and have files, then do the recursion
        if (file.type == "folder" && file.files.length > 0) {
            singleFile = recursiveGetFile(file.files, _id);
            // return the file if found in sub-folders
            if (singleFile != null) {
                return singleFile;
            }
        }
    }
}

// function to add new uploaded object and return the updated array
function getUpdatedArray(arr, _id, uploadedObj) {
    for (var a = 0; a < arr.length; a++) {
        // push in files array if type is folder and ID is found
        if (arr[a].type == "folder") {
            if (arr[a]._id == _id) {
                arr[a].files.push(uploadedObj);
                arr[a]._id = ObjectId(arr[a]._id);
            }

            // if it has files, then do the recursion
            if (arr[a].files.length > 0) {
                arr[a]._id = ObjectId(arr[a]._id);
                getUpdatedArray(arr[a].files, _id, uploadedObj);
            }
        }
    }

    return arr;
}

// recursive function to remove the file and return the updated array
function removeFileReturnUpdated(arr, _id) {
    for (var a = 0; a < arr.length; a++) {
        if (arr[a].type != "folder" && arr[a]._id == _id) {
            // remove the file from uploads folder
            try {
                fileSystem.unlinkSync(arr[a].filePath);
            } catch (exp) {
                // 
            }
            // remove the file from array
            arr.splice(a, 1);
            break;
        }

        // do the recursion if it has sub-folders
        if (arr[a].type == "folder" && arr[a].files.length > 0) {
            arr[a]._id = ObjectId(arr[a]._id);
            removeFileReturnUpdated(arr[a].files, _id);
        }
    }

    return arr;
}

// recursive function to search uploaded files
function recursiveSearch(files, query) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        const file = files[a];

        if (file.type == "folder") {
            // search folder case-insensitive
            if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }

            if (file.files.length > 0) {
                singleFile = recursiveSearch(file.files, query);
                if (singleFile != null) {
                    // need parent folder in case of files
                    if (singleFile.type != "folder") {
                        singleFile.parent = file;
                    }
                    return singleFile;
                }
            }
        } else {
            if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }
        }
    }
}

// recursive function to search shared files
function recursiveSearchShared(files, query) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        var file = (typeof files[a].file === "undefined") ? files[a] : files[a].file;

        if (file.type == "folder") {
            if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }

            if (file.files.length > 0) {
                singleFile = recursiveSearchShared(file.files, query);
                if (singleFile != null) {
                    if (singleFile.type != "folder") {
                        singleFile.parent = file;
                    }
                    return singleFile;
                }
            }
        } else {
            if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }
        }
    }
}

// start the http server
http.listen(3000, function() {
    console.log("Server started at " + mainURL);

    // connect with mongo DB server
    mongoClient.connect("mongodb+srv://sandhyarameshnaik12:UrK6iexZ8hGpQ6wD@cluster0.wu4bo.mongodb.net", {
        useUnifiedTopology: true
    }, function(error, client) {

        // connect database (it will automatically create the database if not exists)
        database = client.db("file_transfer");
        console.log("Database connected.");

        const mongoose = require('mongoose');
        const Schema = mongoose.Schema;

        // Billing Schema
        const billingSchema = new Schema({
            invoiceNumberc: {
                type: String,
                required: true,
                unique: true // Ensures invoice number is unique
            },
            customerName: {
                type: String,
                required: true
            },
            customerEmail: {
                type: String,
                required: true,
                match: /.+\@.+\..+/ // Ensures valid email format
            },
            items: {
                type: [String], // Array of item names
                required: true
            },
            quantity: {
                type: [Number], // Array of quantities for each item
                required: true
            },
            price: {
                type: [Number], // Array of prices for each item
                required: true
            },
            total: {
                type: Number,
                required: true
            }
        }, {
            timestamps: true // Adds createdAt and updatedAt fields
        });

        // Create model based on the schema
        const Billing = mongoose.model('Bill', billingSchema);

        module.exports = Billing;



        app.post('/api/billing', async(req, res) => {
            try {
                const { invoiceNumber, customerName, customerEmail, items, quantity, price, total } = req.body;

                // Split items, quantity, and price into arrays
                const itemsArray = items.split(',').map(item => item.trim()); // Trim any extra spaces
                const quantityArray = quantity.split(',').map(qty => parseInt(qty.trim())); // Convert to integers
                const priceArray = price.split(',').map(pr => parseFloat(pr.trim())); // Convert to floats

                // Ensure the arrays have the same length
                if (itemsArray.length !== quantityArray.length || itemsArray.length !== priceArray.length) {
                    return res.status(400).json({ message: 'Items, quantity, and price arrays must have the same length.' });
                }

                // Calculate the total if necessary (this should match the client-side calculation logic)
                const calculatedTotal = quantityArray.reduce((acc, qty, index) => acc + qty * priceArray[index], 0);

                // Create new billing document
                const newBilling = new Billing({
                    invoiceNumber,
                    customerName,
                    customerEmail,
                    items: itemsArray,
                    quantity: quantityArray,
                    price: priceArray,
                    total: calculatedTotal // Use the calculated total
                });

                // Save the billing data to MongoDB
                await newBilling.save();

                res.status(200).json({ message: 'Billing data saved successfully!' });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Error saving billing data', error });
            }
        });

        app.get('/api/billing', (req, res) => {
            // Render the billing page using EJS (or render it as needed)
            res.render('billing', {
                title: 'Billing',
                mainURL: req.protocol + '://' + req.get('host'), // Pass the base URL to the template
                isLogin: req.session.isLogin,
                user: req.session.user,
            });
        });

        app.get("/pro-versions", function(request, result) {
            result.render("proVersions", {
                "request": request
            });
        });

        app.get("/Admin", async function(request, result) {
            // render an HTML page with number of pages, and posts data
            result.render("Admin", {
                request: request
            });
        });

        // search files or folders
        app.get("/Search", async function(request, result) {
            const search = request.query.search;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });
                var fileUploaded = await recursiveSearch(user.uploaded, search);
                var fileShared = await recursiveSearchShared(user.sharedWithMe, search);

                // check if file is uploaded or shared with user
                if (fileUploaded == null && fileShared == null) {
                    request.status = "error";
                    request.message = "File/folder '" + search + "' is neither uploaded nor shared with you.";

                    result.render("Search", {
                        "request": request
                    });
                    return false;
                }

                var file = (fileUploaded == null) ? fileShared : fileUploaded;
                file.isShared = (fileUploaded == null);
                result.render("Search", {
                    "request": request,
                    "file": file
                });

                return false;
            }

            result.redirect("/Login");
        });

        app.get("/Blog", async function(request, result) {
            // render an HTML page with number of pages, and posts data
            result.render("Blog", {
                request: request
            });
        });


        const cors = require('cors');
        const bodyParser = require('body-parser');
        app.use(cors());
        app.use(bodyParser.json());



        // GET /Billing





        // get all files shared with logged-in user
        app.get("/sharedWithMe", async function(req, res) {
            if (!req.session.user) {
                return res.redirect("/Login");
            }

            const sharedLinks = await database.collection("public_links").find({
                "sharedWith.email": req.session.user.email,
            }).toArray();

            res.render("sharedWithMe", {
                mainURL: app.locals.mainURL, // Pass the main URL
                sharedLinks: sharedLinks,
                request: req,
            });
        });

        app.post("/payment", async function(req, res) {
            // Check if the user is logged in


            // Extract payment data from the request body
            const { constructorName, location, projectSiteName, modeOfPayment, date, amount } = req.body;

            // Validate the input
            if (!constructorName || !location || !projectSiteName || !modeOfPayment || !date || !amount) {
                return res.status(400).send("All payment details are required.");
            }

            try {
                // Prepare the payment record
                const paymentRecord = {
                    userEmail: req.session.user.email, // Associate the payment with the logged-in user's email
                    constructorName,
                    location,
                    projectSiteName,
                    modeOfPayment,
                    date: new Date(date), // Ensure the date is stored in the correct format
                    amount: parseFloat(amount) // Convert amount to a number
                };

                // Insert the payment record into the `payments` collection
                const result = await database.collection("payments").insertOne(paymentRecord);

                // Respond with success
                res.status(201).send({ message: "Payment record added successfully!", paymentId: result.insertedId });
            } catch (error) {
                console.error("Error adding payment record:", error);
                res.status(500).send("An error occurred while saving the payment record.");
            }
        });


        app.get("/payment", async function(req, res) {
            // Check if the user is logged in


            try {
                // Query the `payments` collection for entries related to the logged-in user
                const payments = await database.collection("payments").find({
                    "userEmail": req.session.user.email, // Match based on the user's email
                }).toArray();

                // Render the payment page with the retrieved data
                res.render("payment", {
                    mainURL: app.locals.mainURL, // Pass the main URL
                    payments: payments, // Pass the payments data to the view
                    request: req, // Pass the request object for dynamic rendering
                });
            } catch (error) {
                console.error("Error fetching payments:", error);
                res.status(500).send("An error occurred while fetching payments.");
            }
        });


        app.post("/DeleteLink", async function(request, result) {

            const _id = request.fields._id;

            if (request.session.user) {
                var link = await database.collection("public_links").findOne({
                    $and: [{
                        "uploadedBy._id": ObjectId(request.session.user._id)
                    }, {
                        "_id": ObjectId(_id)
                    }]
                });

                if (link == null) {
                    request.session.status = "error";
                    request.session.message = "Link does not exists.";

                    const backURL = request.header("Referer") || "/";
                    result.redirect(backURL);
                    return false;
                }

                await database.collection("public_links").deleteOne({
                    $and: [{
                        "uploadedBy._id": ObjectId(request.session.user._id)
                    }, {
                        "_id": ObjectId(_id)
                    }]
                });

                request.session.status = "success";
                request.session.message = "Link has been deleted.";

                const backURL = request.header("Referer") || "/";
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        });


        app.get("/estimation", (req, res) => {
            res.render("estimation");
        });

        app.get("/MySharedLinks", async function(request, result) {
            if (request.session.user) {
                var links = await database.collection("public_links").find({
                    "uploadedBy._id": ObjectId(request.session.user._id)
                }).toArray();

                result.render("MySharedLinks", {
                    "request": request,
                    "links": links
                });
                return false;
            }

            result.redirect("/Login");
        });

        app.get("/SharedViaLink/:hash", async function(request, result) {
            const hash = request.params.hash;

            var link = await database.collection("public_links").findOne({
                "hash": hash
            });

            if (link == null) {
                request.session.status = "error";
                request.session.message = "Link expired.";

                result.render("SharedViaLink", {
                    "request": request
                });
                return false;
            }

            result.render("SharedViaLink", {
                "request": request,
                "link": link
            });
        });

        app.post("/ShareViaLink", async function(request, result) {
            const { _id, email, projectName } = request.fields; // Extract projectName

            if (request.session.user) {
                const user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id),
                });

                const recipient = await database.collection("users").findOne({
                    email: email, // Check if the email exists
                });

                if (!recipient) {
                    // If recipient email is not registered
                    request.session.status = "error";
                    request.session.message = "Recipient email is not registered!";
                    return result.redirect("back");
                }

                const file = await recursiveGetFile(user.uploaded, _id);

                if (!file) {
                    request.session.status = "error";
                    request.session.message = "File does not exist.";
                    return result.redirect("back");
                }

                bcrypt.hash(file.name, 10, async function(error, hash) {
                    hash = hash.substring(10, 20);
                    const link = `${mainURL}/SharedViaLink/${hash}`;

                    await database.collection("public_links").insertOne({
                        hash: hash,
                        file: file,
                        projectName: projectName, // Store the project name
                        sharedWith: {
                            _id: recipient._id,
                            email: recipient.email,
                            name: recipient.name,
                        },
                        uploadedBy: {
                            _id: user._id,
                            email: user.email,
                            name: user.name,
                        },
                        createdAt: new Date().getTime(),
                    });

                    request.session.status = "success";
                    request.session.message = `Share link for project "${projectName}" sent to ${email}: ${link}`;
                    result.redirect("back");
                });
            } else {
                result.redirect("/Login");
            }
        });




        // delete uploaded file
        app.post("/DeleteFile", async function(request, result) {
            const _id = request.fields._id;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var updatedArray = await removeFileReturnUpdated(user.uploaded, _id);
                for (var a = 0; a < updatedArray.length; a++) {
                    updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                }

                await database.collection("users").updateOne({
                    "_id": ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "uploaded": updatedArray
                    }
                });

                const backURL = request.header('Referer') || '/';
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        });

        // download file
        app.post("/DownloadFile", async function(request, result) {
            const _id = request.fields._id;

            var link = await database.collection("public_links").findOne({
                "file._id": ObjectId(_id)
            });

            if (link != null) {
                fileSystem.readFile(link.file.filePath, function(error, data) {
                    // console.log(error);

                    result.json({
                        "status": "success",
                        "message": "Data has been fetched.",
                        "arrayBuffer": data,
                        "fileType": link.file.type,
                        // "file": mainURL + "/" + file.filePath,
                        "fileName": link.file.name
                    });
                });
                return false;
            }

            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var fileUploaded = await recursiveGetFile(user.uploaded, _id);

                if (fileUploaded == null) {
                    result.json({
                        "status": "error",
                        "message": "File is neither uploaded nor shared with you."
                    });
                    return false;
                }

                var file = fileUploaded;

                fileSystem.readFile(file.filePath, function(error, data) {
                    // console.log(error);

                    result.json({
                        "status": "success",
                        "message": "Data has been fetched.",
                        "arrayBuffer": data,
                        "fileType": file.type,
                        // "file": mainURL + "/" + file.filePath,
                        "fileName": file.name
                    });
                });
                return false;
            }

            result.json({
                "status": "error",
                "message": "Please login to perform this action."
            });
            return false;
        });

        app.get("/DownloadFile/:id", async(req, res) => {
            try {
                const fileId = req.params.id;

                // Check if the file is shared via a public link
                const link = await database.collection("public_links").findOne({
                    "file._id": ObjectId(fileId)
                });

                if (link) {
                    const filePath = link.file.filePath;
                    return res.download(filePath, link.file.name);
                }

                // If user is logged in, check their uploaded files
                if (req.session.user) {
                    const user = await database.collection("users").findOne({
                        "_id": ObjectId(req.session.user._id)
                    });

                    const fileUploaded = await recursiveGetFile(user.uploaded, fileId);

                    if (!fileUploaded) {
                        return res.status(404).send("File not found.");
                    }

                    return res.download(fileUploaded.filePath, fileUploaded.name);
                }

                res.status(401).send("Please login to download this file.");
            } catch (error) {
                console.error("Error downloading file:", error);
                res.status(500).send("An error occurred.");
            }
        });


        // view all files uploaded by logged-in user
        app.get("/MyUploads", async function(request, result) {
            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var uploaded = user.uploaded;

                result.render("MyUploads", {
                    "request": request,
                    "uploaded": uploaded
                });
                return false;
            }

            result.redirect("/Login");
        });

        // upload new file
        app.post("/UploadFile", async function(request, result) {
            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                if (request.files.file.size > 0) {

                    const _id = request.fields._id;

                    var uploadedObj = {
                        "_id": ObjectId(),
                        "size": request.files.file.size, // in bytes
                        "name": request.files.file.name,
                        "type": request.files.file.type,
                        "filePath": "",
                        "createdAt": new Date().getTime()
                    };

                    var filePath = "public/uploads/" + user.email + "/" + new Date().getTime() + "-" + request.files.file.name;
                    uploadedObj.filePath = filePath;

                    if (!fileSystem.existsSync("public/uploads/" + user.email)) {
                        fileSystem.mkdirSync("public/uploads/" + user.email);
                    }

                    // Read the file
                    fileSystem.readFile(request.files.file.path, function(err, data) {
                        if (err) throw err;
                        console.log('File read!');

                        // Write the file
                        fileSystem.writeFile(filePath, data, async function(err) {
                            if (err) throw err;
                            console.log('File written!');

                            await database.collection("users").updateOne({
                                "_id": ObjectId(request.session.user._id)
                            }, {
                                $push: {
                                    "uploaded": uploadedObj
                                }
                            });

                            request.session.status = "success";
                            request.session.message = "File has been uploaded.";

                            result.redirect("/MyUploads");
                        });

                        // Delete the file
                        fileSystem.unlink(request.files.file.path, function(err) {
                            if (err) throw err;
                            console.log('File deleted!');
                        });
                    });

                } else {
                    request.status = "error";
                    request.message = "Please select valid image.";

                    result.render("MyUploads", {
                        "request": request
                    });
                }

                return false;
            }

            result.redirect("/Login");
        });

        // logout the user
        app.get("/Logout", function(request, result) {
            request.session.destroy();
            result.redirect("/");
        });

        // show page to login
        app.get("/Login", function(request, result) {
            result.render("Login", {
                "request": request
            });
        });

        // authenticate the user
        app.post("/Login", async function(request, result) {
            var email = request.fields.email;
            var password = request.fields.password;

            var user = await database.collection("users").findOne({
                "email": email
            });

            if (user == null) {
                request.status = "error";
                request.message = "Email does not exist.";
                result.render("Login", {
                    "request": request
                });

                return false;
            }

            bcrypt.compare(password, user.password, function(error, isVerify) {
                if (isVerify) {
                    request.session.user = user;
                    result.redirect("/");

                    return false;
                }

                request.status = "error";
                request.message = "Password is not correct.";
                result.render("Login", {
                    "request": request
                });
            });
        });

        // register the user
        app.post("/Register", async function(request, result) {

            var name = request.fields.name;
            var email = request.fields.email;
            var password = request.fields.password;
            var reset_token = "";
            var isVerified = true;
            var verification_token = new Date().getTime();

            var user = await database.collection("users").findOne({
                "email": email
            });

            if (user == null) {
                bcrypt.hash(password, 10, async function(error, hash) {
                    await database.collection("users").insertOne({
                        "name": name,
                        "email": email,
                        "password": hash,
                        "reset_token": reset_token,
                        "uploaded": [],

                        "sharedWithMe": [],
                        "isVerified": isVerified,
                        "verification_token": verification_token
                    }, async function(error, data) {

                        request.status = "success";
                        request.message = "Signed up successfully. You can login now.";

                        result.render("Register", {
                            "request": request
                        });

                    });
                });
            } else {
                request.status = "error";
                request.message = "Email already exist.";

                result.render("Register", {
                    "request": request
                });
            }
            result.redirect("/Login");
        });

        // Backend Route to Render Billing Page
        app.get("/billing", (req, res) => {
            // Generate a random 6-digit invoice number
            const invoice_number = "INV-" + Math.floor(100000 + Math.random() * 900000);

            // Render the billing page and pass the invoice_number to the template
            res.render("billing", {
                invoice_number: invoice_number
            });
        });
        app.get("/bill2", (req, res) => {
            // Generate a random 6-digit invoice number
            const invoice_number = "INV-" + Math.floor(100000 + Math.random() * 900000);

            // Render the billing page and pass the invoice_number to the template
            res.render("bill2", {
                invoice_number: invoice_number
            });
        });
        const itemSchema = new mongoose.Schema({
            name: String,
            quantity: Number,
            price: Number
        });

        const billSchema = new mongoose.Schema({
            invoiceNumber: String,
            customerName: String,
            customerEmail: String,
            items: [itemSchema],
            total: Number,
            date: { type: Date, default: Date.now }
        });

        const Bill = mongoose.model('bill', billSchema);
        app.use(express.json());
        // API Routes
        app.post('/submitBill', async(req, res) => {
            try {
                const { invoice_number, customer_name, customer_email, items, total } = req.body;

                // Check for missing fields
                if (!invoice_number || !customer_name || !customer_email || !items || !total) {
                    return res.status(400).json({ message: 'All fields are required' });
                }

                // Create new bill
                const newBill = new Bill({
                    invoiceNumber: invoice_number,
                    customerName: customer_name,
                    customerEmail: customer_email,
                    items,
                    total
                });

                // Save to MongoDB
                const savedBill = await newBill.save();
                res.status(201).json({
                    message: 'Bill saved successfully',
                    bill: savedBill
                });
            } catch (err) {
                console.error('Error saving bill:', err); // Log error for debugging
                res.status(500).json({
                    message: 'Server error',
                    error: err.message
                });
            }
        });
        app.get('/bills', async(req, res) => {
            try {
                const bills = await Bill.find().exec(); // Ensure it uses `.exec()`
                res.status(200).json(bills);
            } catch (err) {
                console.error('Error fetching bills:', err);
                res.status(500).json({ message: 'Server error', error: err.message });
            }
        });


        app.get('/submitBill', async(req, res) => {
            try {
                const { invoiceNumber } = req.params;
                const bill = await Bill.findOne({ invoiceNumber }); // Find the bill by invoiceNumber

                if (!bill) {
                    return res.status(404).json({
                        message: 'Bill not found'
                    });
                }

                res.status(200).json({
                    message: 'Bill retrieved successfully',
                    bill
                });
            } catch (err) {
                console.error('Error fetching bill:', err);
                res.status(500).json({
                    message: 'Server error',
                    error: err.message
                });
            }
        });







        // show page to do the registration
        app.get("/Register", function(request, result) {
            result.render("Register", {
                "request": request
            });
        });

        // home page
        app.get("/", function(request, result) {
            result.render("index", {
                "request": request
            });
        });
    });
});