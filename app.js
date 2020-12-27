const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
global.__basedir = __dirname;
require("dotenv").config();

const port = process.env.PORT || 3010;

const app = express();

app.use(bodyParser.json());

var publicDir = require("path").join(__dirname, "/public");
app.use(express.static(publicDir));

require("./routes")(app); // For API

app.set("port", port);
const server = http.createServer(app);
server.listen(port, () =>
  console.log(`Server is running at port no : ${port}`)
);

module.exports = app;
