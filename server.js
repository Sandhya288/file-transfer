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
    const cors = require("cors");
    const bodyParser = require("body-parser");
    app.use(cors());
    app.use(bodyParser.json());
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

        const { ObjectId } = require('mongodb');

        app.post("/payment", async function(request, result) {
            try {
                // Retrieve form fields
                var constructorName = request.fields.constructorName;
                var location = request.fields.location;
                var projectSiteName = request.fields.projectSiteName;
                var modeOfPayment = request.fields.modeOfPayment;
                var date = request.fields.date;
                var amount = request.fields.amount;

                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("Payment", {
                        request: request,
                        payments: [],
                    });
                }

                // Validate required fields
                if (!constructorName ||
                    !location ||
                    !projectSiteName ||
                    !modeOfPayment ||
                    !date ||
                    !amount
                ) {
                    request.status = "error";
                    request.message = "All fields are required.";
                    const payments = await database
                        .collection("payments")
                        .find({
                            userId: request.session.user._id,
                        })
                        .toArray(); // Fetch existing payments
                    return result.render("Payment", {
                        request: request,
                        payments: payments,
                    });
                }

                // Insert payment data into the database
                await database.collection("payments").insertOne({
                    userId: request.session.user._id, // Use the logged-in user's ID
                    constructorName: constructorName,
                    location: location,
                    projectSiteName: projectSiteName,
                    modeOfPayment: modeOfPayment,
                    date: new Date(date), // Convert to Date object
                    amount: parseFloat(amount), // Ensure amount is a number
                    createdAt: new Date(), // Add a timestamp
                });

                // Fetch updated payment list in descending order by creation date
                const payments = await database
                    .collection("payments")
                    .find({
                        userId: request.session.user._id,
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Success response
                request.status = "success";
                request.message = "Payment submitted successfully.";
                result.render("Payment", {
                    request: request,
                    payments: payments, // Pass the updated payment list
                });
            } catch (error) {
                console.error("Error processing payment:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                const payments = await database
                    .collection("payments")
                    .find({
                        userId: request.session.user._id,
                    })
                    .toArray(); // Fetch existing payments
                result.render("Payment", { request: request, payments: payments });
            }
        });


        app.get("/payment", async function(request, result) {
            try {
                // Ensure the user is logged in
                if (!request.session.user) {
                    request.status = "error";
                    request.message = "Unauthorized: Please log in.";
                    return result.render("Payment", {
                        request: request,
                        payments: [],
                    });
                }

                // Retrieve payments for the logged-in user in descending order by creation date
                const payments = await database
                    .collection("payments")
                    .find({
                        userId: request.session.user._id, // Use the logged-in user's ID
                    })
                    .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
                    .toArray();

                // Render the Payment page with the payment list
                request.status = "success";
                request.message = "Payments fetched successfully.";
                result.render("Payment", {
                    request: request,
                    payments: payments, // Ensure `payments` is passed to the EJS template
                });
            } catch (error) {
                console.error("Error fetching payments:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("Payment", { request: request, payments: [] });
            }
        });

        app.get("/payment/share/:id", async(request, response) => {
            try {
                const paymentId = request.params.id;
                const payment = await database.collection("payments").findOne({
                    _id: new ObjectId(paymentId),
                });

                if (!payment) {
                    return response
                        .status(404)
                        .json({ message: "Payment not found." });
                }

                // Share logic here (e.g., generate a shareable link or email the details)
                const shareableLink = `${request.protocol}://${request.get(
             "host"
           )}/payment/view/${paymentId}`;

                console.log("Shareable Link:", shareableLink);
            } catch (error) {
                console.error("Error sharing payment:", error);
                response
                    .status(500)
                    .json({ message: "An error occurred while sharing the payment." });
            }
        });

       app.post("/notes", async function (req, res) {
         try {
           const { name, money, paid } = req.fields;

           // Ensure the user is logged in
           if (!req.session.user) {
             req.session.status = "error";
             req.session.message = "Unauthorized: Please log in.";
             return res.redirect("/notes");
           }

           // Validate required fields
           if (!name || !money || !paid) {
             req.session.status = "error";
             req.session.message = "All fields are required.";
             return res.redirect("/notes");
           }

           // Insert note into the database
           await database.collection("notes").insertOne({
             userId: req.session.user._id,
             name: name.trim(),
             money: parseFloat(money),
             paid: parseFloat(paid),
             createdAt: new Date(),
           });

           // Set success message in session
           req.session.status = "success";
           req.session.message = "Note added successfully.";
           return res.redirect("/notes");
         } catch (error) {
           console.error("Error adding note:", error);
           req.session.status = "error";
           req.session.message = "An unexpected error occurred.";
           return res.redirect("/notes");
         }
       });


        app.get("/notes", async function (req, res) {
          try {
            // Ensure the user is logged in
            if (!req.session.user) {
              req.status = "error";
              req.message = "Unauthorized: Please log in.";
              return res.render("notes", {
                request: req,
                notes: [],
              });
            }

            // Fetch notes for the logged-in user
            const notes = await database
              .collection("notes")
              .find({ userId: req.session.user._id }) // Filter by logged-in user ID
              .sort({ createdAt: -1 }) // Sort in descending order by creation date
              .toArray();

            // Render the notes page with the fetched notes
            res.render("notes", {
              request: req,
              notes: notes,
            });
          } catch (error) {
            console.error("Error fetching notes:", error);
            req.status = "error";
            req.message = "An unexpected error occurred.";
            res.render("notes", { request: req, notes: [] });
          }
        });

       app.get("/mycredit", async function (req, res) {
         try {
           if (!req.session.user) {
             req.session.status = "error";
             req.session.message = "Unauthorized: Please log in.";
             return res.redirect("/login");
           }

           const userId = req.session.user._id;

           // Fetch credit and debit history for the logged-in user
           const transactions = await database
             .collection("credits")
             .find({ userId: userId })
             .sort({ date: -1 }) // Sort by date in descending order
             .toArray();

           // Calculate total credits and debits
           const totalCredits = transactions
             .filter((txn) => txn.type === "Credit")
             .reduce((sum, txn) => sum + txn.amount, 0);

           const totalDebits = transactions
             .filter((txn) => txn.type === "Debit")
             .reduce((sum, txn) => sum + txn.amount, 0);

           // Calculate current balance
           const currentBalance = totalCredits - totalDebits;

           res.render("mycredit", {
             request: req,
             currentBalance: currentBalance,
             transactions: transactions, // Pass all transactions for the table
           });
         } catch (error) {
           console.error("Error fetching credit data:", error);
           res.status(500).send("An error occurred.");
         }
       });


app.post("/mycredit", async function (req, res) {
  try {
    if (!req.session.user) {
      req.session.status = "error";
      req.session.message = "Unauthorized: Please log in.";
      return res.redirect("/login");
    }

    const { amount } = req.fields;

    // Validate the input
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      req.session.status = "error";
      req.session.message = "Please enter a valid amount.";
      return res.redirect("/mycredit");
    }

    const userId = req.session.user._id;

    // Insert the credit record
    await database.collection("credits").insertOne({
      userId: userId,
      amount: parseFloat(amount),
      type: "Credit", // Mark this as a credit
      date: new Date(),
    });

    req.session.status = "success";
    req.session.message = "Amount added successfully.";
    res.redirect("/mycredit");
  } catch (error) {
    console.error("Error adding credit:", error);
    req.session.status = "error";
    req.session.message = "An unexpected error occurred.";
    res.redirect("/mycredit");
  }
});



        app.get("/sharedpayments", async(request, response) => {
            try {
                if (!request.session.user) {
                    return response.redirect("/login");
                }

                const userId = new ObjectId(request.session.user._id);

                // Fetch payments shared with the logged-in user
                const sharedWithMe = await database
                    .collection("payment_share")
                    .aggregate([{
                            $match: { "sharedWith._id": userId },
                        },
                        {
                            $lookup: {
                                from: "payments",
                                localField: "paymentId",
                                foreignField: "_id",
                                as: "paymentDetails",
                            },
                        },
                        { $unwind: "$paymentDetails" },
                        {
                            $project: {
                                _id: 1,
                                paymentId: 1,
                                sharedBy: 1,
                                sharedWith: 1,
                                createdAt: 1,
                                "paymentDetails.constructorName": 1,
                                "paymentDetails.location": 1,
                                "paymentDetails.projectSiteName": 1,
                                "paymentDetails.modeOfPayment": 1,
                                "paymentDetails.date": 1,
                                "paymentDetails.amount": 1,
                            },
                        },
                    ])
                    .toArray();

                // Fetch payments shared by the logged-in user
                const sharedByMe = await database
                    .collection("payment_share")
                    .aggregate([{
                            $match: { "sharedBy._id": userId },
                        },
                        {
                            $lookup: {
                                from: "payments",
                                localField: "paymentId",
                                foreignField: "_id",
                                as: "paymentDetails",
                            },
                        },
                        { $unwind: "$paymentDetails" },
                        {
                            $project: {
                                _id: 1,
                                paymentId: 1,
                                sharedBy: 1,
                                sharedWith: 1,
                                createdAt: 1,
                                "paymentDetails.constructorName": 1,
                                "paymentDetails.location": 1,
                                "paymentDetails.projectSiteName": 1,
                                "paymentDetails.modeOfPayment": 1,
                                "paymentDetails.date": 1,
                                "paymentDetails.amount": 1,
                            },
                        },
                    ])
                    .toArray();

                // Render the page with both data sets
                response.render("sharedpayments", {
                    sharedWithMe,
                    sharedByMe,
                    request,
                });
            } catch (error) {
                console.error("Error fetching shared payments:", error);
                response.render("sharedpayments", {
                    sharedWithMe: [],
                    sharedByMe: [],
                    request,
                });
            }
        });







        let materials = []; // In-memory materials array for simplicity

        // Add material



        app.get("/materials", function(request, result) {
            result.render("materials", {
                "request": request
            });
        });

        app.get("/notes", function(request, result) {
            result.render("notes", {
                "request": request
            });
        });





        // app.get('/payment', (req, res) => {
        //     if (!req.session.user) {
        //         return res.redirect('/Login');
        //     }

        //     res.render('payment', {
        //         mainURL: app.locals.mainURL, // Pass the main URL or other required data
        //         request: req // Optionally pass the request object for dynamic rendering
        //     });
        // });



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
                const user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                const folder = request.fields.folder || ""; // Folder name (empty if root)
                const folderPath = `public/uploads/${user.email}/${folder}`;

                if (request.files.file.size > 0) {
                    const uploadedObj = {
                        "_id": ObjectId(),
                        "size": request.files.file.size, // in bytes
                        "name": request.files.file.name,
                        "type": request.files.file.type,
                        "filePath": "",
                        "createdAt": new Date().getTime()
                    };

                    const filePath = `${folderPath}/${new Date().getTime()}-${request.files.file.name}`;
                    uploadedObj.filePath = filePath;




                    if (!fileSystem.existsSync(folderPath)) {
                        fileSystem.mkdirSync(folderPath, { recursive: true });
                    }

                    fileSystem.readFile(request.files.file.path, function(err, data) {
                        if (err) throw err;
                        console.log('File read!');

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

                        fileSystem.unlink(request.files.file.path, function(err) {
                            if (err) throw err;
                            console.log('Temporary file deleted!');
                        });
                    });
                } else {
                    request.session.status = "error";
                    request.session.message = "Please select a valid file.";
                    result.redirect("/MyUploads");
                }
            } else {
                result.redirect("/Login");
            }
        });
        app.post("/MoveFileToFolder", (req, res) => {
            const { fileId, fileName, folderName } = req.body;
            const currentPath = path.join(__dirname, "uploads", fileName);
            const folderPath = path.join(__dirname, "uploads", folderName);

            // Ensure folder exists
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            const newPath = path.join(folderPath, fileName);

            // Move the file
            fs.rename(currentPath, newPath, (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send({ success: false, message: "File move failed" });
                }
                res.send({ success: true });
            });
        });

        app.get("/PreviewFile/:fileId", async(req, res) => {
            try {
                const fileId = req.params.fileId;
                const file = await database.collection("files").findOne({ "_id": new ObjectId(fileId) });

                if (!file) {
                    return res.status(404).send("File not found");
                }

                const filePath = path.join(__dirname, 'uploads', file.path); // Adjust path based on your file storage setup

                const fileType = file.type;
                res.setHeader('Content-Type', fileType);

                if (fileType.startsWith("image/")) {
                    // If image, send as image
                    res.sendFile(filePath);
                } else if (fileType === "application/pdf") {
                    // If PDF, send as PDF
                    res.sendFile(filePath);
                } else if (fileType.startsWith("text/")) {
                    // If text, read the file and send as text
                    const content = fs.readFileSync(filePath, 'utf-8');
                    res.send(content);
                } else {
                    res.status(415).send("Unsupported file type");
                }
            } catch (error) {
                console.error(error);
                res.status(500).send("Server error");
            }
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
            try {
                var name = request.fields.name;
                var email = request.fields.email;
                var password = request.fields.password;
                var reset_token = "";
                var isVerified = true;
                var verification_token = new Date().getTime();

                // Check if the user already exists
                var user = await database.collection("users").findOne({
                    email: email,
                });

                if (user == null) {
                    // Hash the password before saving
                    bcrypt.hash(password, 10, async function(error, hash) {
                        if (error) {
                            console.error("Error hashing password:", error);
                            request.status = "error";
                            request.message = "An error occurred while processing your request.";
                            return result.render("Register", { request: request });
                        }

                        // Insert the new user with an empty payments array
                        await database.collection("users").insertOne({
                            name: name,
                            email: email,
                            password: hash,
                            reset_token: reset_token,
                            uploaded: [],
                            sharedWithMe: [],
                            isVerified: isVerified,
                            verification_token: verification_token,
                            payments: [], // Empty payments array
                        });

                        // Success response
                        request.status = "success";
                        request.message = "Signed up successfully. You can login now.";

                        result.render("Register", {
                            request: request,
                        });
                    });
                } else {
                    // User already exists
                    request.status = "error";
                    request.message = "Email already exists.";

                    result.render("Register", {
                        request: request,
                    });
                }
            } catch (error) {
                console.error("Error during registration:", error);
                request.status = "error";
                request.message = "An unexpected error occurred.";
                result.render("Register", { request: request });
            }
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

        const paymentSchema = new mongoose.Schema({
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            }, // Reference to the user
            constructorName: { type: String, required: true },
            location: { type: String, required: true },
            projectSiteName: { type: String, required: true },
            modeOfPayment: { type: String, required: true },
            date: { type: Date, required: true },
            amount: { type: Number, required: true },
        });

        const Bill = mongoose.model('bill', billSchema);
        const Payment = mongoose.model("Payment", paymentSchema);
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

        app.get("/sharedpayments", function(request, result) {
            result.render("sharedpayments", {
                request: request,
            });
        });

        app.get("/mycredits", function(request, result) {
            result.render("mycredits", {
                request: request,
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