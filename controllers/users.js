const User = require("../db/models").User;
const XLSX = require("xlsx");
const fs = require("fs");
const validator = require("validator");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

module.exports = {
  /**
   * List Users
   */
  async index(req, res, next) {
    let result = {};
    if (req.params.id > 0) {
      const { id } = req.params;
      try {
        const users = await User.findOne({
          where: {
            id,
          },
        });
        result.response = "success";
        result.data = users;
        res.status(200).send(result);
      } catch (err) {
        next(err);
      }
    } else {
      try {
        const users = await User.findAll({
          order: [["id", "DESC"]],
        });
        result.response = "success";
        result.data = users;
        res.status(200).send(result);
      } catch (err) {
        next(err);
      }
    }
  },

  /**
   * Add User
   */
  async add(req, res, next) {
    let result = {};
    let errors = [];
    if (!req.is("application/json")) {
      errors.push({ msg: "Expects application/json" });
      return res.status(406).send(errors);
    }

    const { fullname, email } = req.body;

    if (validator.isEmpty(fullname)) {
      errors.push({
        msg: "Please enter a valid fullname.",
      });
    }

    if (!validator.isEmail(email)) {
      errors.push({
        msg: "Please enter a valid email.",
      });
    }

    if (errors.length > 0) {
      result.response = "error";
      result.error = errors;
      return res.status(200).send(result);
    }

    try {
      const {
        firstName,
        middleName,
        lastName,
        domain,
        counter,
      } = await generatePattern(email);
      await User.build({
        firstName,
        middleName,
        lastName,
        domain,
        counter,
      })
        .save()
        .then((inserted) => {
          if (inserted) {
            result.response = "success";
            result.id = inserted;
            res.status(200).send(result);
          }
        })
        .catch((error) => {
          result.response = "error";
          errors.push({ msg: error });
          result.errors = errors;
          return res.status(200).send(error);
        });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Bulk Import User
   */
  async bulkImport(req, res, next) {
    if (req?.file?.filename) {
      const workbook = XLSX.readFile(
        __basedir + "/public/" + req.file.filename,
        {
          cellDates: true,
          cellText: false,
        }
      );
      const sheetNameList = workbook.SheetNames;
      try {
        const userData = XLSX.utils.sheet_to_json(
          workbook.Sheets[sheetNameList[0]],
          {
            range: 0,
            header: 0,
            dateNF: "YYYY-MM-DD",
          }
        );

        let promises = [];
        if (userData.length > 0) {
          for (var i = 0; i < userData.length; i++) {
            const email = userData[i]["Email"];
            const {
              firstName,
              middleName,
              lastName,
              domain,
              counter,
            } = await generatePattern(email);
            await User.build({
              firstName,
              middleName,
              lastName,
              domain,
              counter,
            })
              .save()
              .then(() => {
                promises.push({ response: "success" });
              })
              .catch((error) => {
                console.log("========Error========");
                return {
                  response: "error",
                };
              });
          }

          const response = await Promise.all(promises);
          fs.unlinkSync(__basedir + "/public/" + req.file.filename);
          res.status(200).send(response);
        }
      } catch (err) {
        next(err);
      }
    }
  },

  /**
   * Email Guesser from full name and domain
   */
  async emailGuesser(req, res, next) {
    try {
      let result = {};
      let errors = [];
      if (!req.is("application/json")) {
        errors.push({ msg: "Expects application/json" });
        return res.status(406).send(errors);
      }

      const { fullname, domain } = req.body;

      if (validator.isEmpty(fullname)) {
        errors.push({
          msg: "Please enter a valid fullname.",
        });
      }

      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:.[a-zA-Z]{2,})+$/;

      if (validator.isEmpty(domain) || !domainRegex.test(domain)) {
        errors.push({
          msg: "Please enter a valid domain.",
        });
      }

      if (errors.length > 0) {
        result.response = "error";
        result.error = errors;
        return res.status(200).send(result);
      }

      const split = fullname.trim().split(" ");
      let n = split.length - 1;
      let email = fullname;

      switch (true) {
        case n === 1:
          email = `${split[0]}.${split[n]}`;
          break;

        case n === 2:
          email = `${split[0]}.${split[1]}.${split[n]}`;
          break;

        case n > 2:
          email = `${split[0]}.${split[1]}${split[n - 1]}.${split[n]}`;
          break;

        default:
          email = fullname;
      }
      result.response = "success";
      result.email = `${email}@${domain}`;
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  },
};

async function generatePattern(email) {
  const name = email.substring(0, email.lastIndexOf("@"));
  const domain = email.substring(email.lastIndexOf("@") + 1);

  const split = name.trim().split(".");

  let n = split.length - 1;
  let firstName = null;
  let middleName = null;
  let lastName = null;
  let where = {
    firstName: {
      [Op.ne]: null,
    },
    middleName: {
      [Op.eq]: null,
    },
    lastName: {
      [Op.eq]: null,
    },
    domain,
  };

  switch (true) {
    case n === 1:
      firstName = split[0];
      lastName = split[n];
      where = {
        firstName: {
          [Op.ne]: null,
        },
        middleName: {
          [Op.eq]: null,
        },
        lastName: {
          [Op.ne]: null,
        },
        domain,
      };
      break;

    case n === 2:
      firstName = split[0];
      middleName = split[1];
      lastName = split[n];
      where = {
        firstName: {
          [Op.ne]: null,
        },
        middleName: {
          [Op.ne]: null,
        },
        lastName: {
          [Op.ne]: null,
        },
        domain,
      };

      break;

    case n > 2:
      firstName = split[0];
      middleName = split[1] + split[n - 1];
      lastName = split[n];
      where = {
        firstName: {
          [Op.ne]: null,
        },
        middleName: {
          [Op.ne]: null,
        },
        lastName: {
          [Op.ne]: null,
        },
        domain,
      };
      break;

    default:
      firstName = name;
  }

  let user = await User.findOne({
    attributes: ["counter"],
    where,
    order: [["id", "DESC"]],
  });
  let counter = 1;
  if (user) counter = user.counter + 1;
  return {
    firstName,
    middleName,
    lastName,
    domain,
    counter,
  };
}
