const userscontroller = require("./../controllers").users;
const multer = require("multer");

const path = require("path");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

var upload = multer({ storage: storage });

module.exports = (app) => {
  app.get("/api", (req, res) => {
    res.json({
      status: "success",
      message: "YIPL API",
      data: { version_number: "v1.0.0" },
    });
  });

  app.get("/api/users/:id?", userscontroller.index);
  app.post(
    "/api/users/bulkImport",
    upload.single("file"),
    userscontroller.bulkImport
  );
  app.post("/api/users/emailGuesser", userscontroller.emailGuesser);
  app.post("/api/users/add", userscontroller.add);
};
