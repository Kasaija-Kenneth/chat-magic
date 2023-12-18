const User = require("./../Models/userModel");
const jwt = require("jsonwebtoken");
const util = require("util");

// const tokenGen = (payload) => {
//   return jwt.sign(payload, process.env.S_KEY, {
//     expiresIn: process.env.MAX_AGE,
//   });
// };

exports.isOwner = (req, res, next) => {
  try {
    //credentials and user objects are defined in the 'protect' middleware function
    const credentials = req.credentials;
    const user = req.user;
    const owner = user && credentials && credentials.id === user._id;
    if (!owner) {
      throw new Error(
        "You are not authorized to perform this action. Only profile owners can update/ delete"
      );
    }
    next();
  } catch (error) {
    res.status(400).json({
      status: "Failed",
      message: error.message,
    });
  }
};

exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    //check if email and password are provided
    if (!email || !password)
      throw new Error("Email and password are required for signing in");

    const user = await User.findOne({ email });
    if (!user) throw new Error("User not registered");
    //check if email/ password matched

    if (!(await user.isAuthentic(password)))
      throw new Error("User email/password incorrect");

    //if all conditions matched, generate toten and render user
    const token = user.generateJWToken();

    //create a cookie definition
    let options = {
      maxAge: 1000 * 60 * 20, // would expire in 20minutes
      httpOnly: true, // The cookie is only accessible by the web server
      secure: true,
      sameSite: "None",
    };

    user.password = undefined;
    res.cookie("SessionID", token, options); // set the token to respons header, so that the client sends it back on each subsequent request
    res.status(200).json({
      status: "Success",
      message: "You have successfully logged in",
    });
  } catch (error) {
    res.status(400).json({
      status: "Fail",
      message: error.message,
    });
  }
};

exports.signOut = async (req, res) => {};

exports.register = async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    res.status(201).json({
      status: "Success",
      data: {
        user: newUser,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "Fail",
      error,
    });
  }
};

exports.protect = async (req, res, next) => {
  try {
    //check if token exists
    let token = req.headers.cookie ? req.headers.cookie : null;
    console.log(req.headers);
    if (!token) throw new Error("You are not authenticated. Please login");

    //validate the received token
    if (token.startsWith("authID")) {
      token = await util.promisify(jwt.verify)(
        token.split(" ")[1],
        process.env.S_KEY
      );
    }

    //check if user exists
    const user = await User.findById(token.id).select("-password");
    if (!user) throw new Error("The user does not exist");

    //check if user changed password after issuance of token (i.e after login)
    if (await user.isUserUpdated(token.iat))
      throw new Error(
        "Your User Profile was recently updated. Please login again"
      );

    //Add decoded token to req object
    req.credentials = token;

    //add user details to request object
    req.user;
    next();
  } catch (error) {
    res.json({
      error: error.message,
    });
  }
};
