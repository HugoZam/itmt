var user = require("../models/user");

module.exports = {
    isLoggedIn: function(req, res, next){
        if(req.isAuthenticated()){
            return next();
        }
        req.flash("error", "Sorry, You must sign in first!");
        res.redirect("/login");
    }
}
